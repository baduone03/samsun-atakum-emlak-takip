/**
 * Detay sayfasi ayristirici.
 *
 * Iki kaynaktan besleniyor:
 *  1. `self.__next_f.push([1,"..."])` icindeki React akis verisi - koordinat,
 *     adres, harita gizlilik ayari ve ulasim ozellikleri buradan gelir.
 *  2. Sunucuda basilmis HTML tablolari - isitma, asansor, bina yasi gibi
 *     etiket/deger ciftleri buradan gelir.
 *
 * Bu veriler bildirim zenginligi icindir, filtreleme kararlari liste
 * sayfasindan gelen alanlara dayanir. Site tasarimi degisip tablolar
 * okunamazsa bildirim sadelesir, sistem calismaya devam eder.
 */
import type { Coordinates, ListingDetail } from "../types.ts";

export const EMPTY_DETAIL: ListingDetail = {
  coordinates: null,
  coordinatesExact: false,
  address: null,
  specs: {},
  transport: [],
};

/**
 * Detay gercekten alinmis mi.
 *
 * Detay butcesi dolduğunda veya istek basarisiz oldugunda EMPTY_DETAIL yaziliyor.
 * Bunu "onbellekte var" saymak, o ilanin detayinin bir daha hic cekilmemesine
 * yol acar - bu yuzden dolu olup olmadigi acikca sorulur.
 */
export function hasDetail(detail: ListingDetail): boolean {
  return detail.coordinates !== null || Object.keys(detail.specs).length > 0;
}

const FLIGHT_CHUNK = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g;

/** `location` nesnesi: koordinatlarin hemen ardindan adres geliyor. */
const LOCATION_PATTERN =
  /"coordinates":\{"lat":(-?\d+(?:\.\d+)?),"lng":(-?\d+(?:\.\d+)?)\},"address":"((?:[^"\\]|\\.)*)"/;

const SHOW_ON_MAP_PATTERN = /"showOnMap":(true|false)/;

/** Konum Ozellikleri > Ulasim dizisi. */
const TRANSPORT_PATTERN = /"Konum Özellikleri":\{[^}]*?"Ulaşım":\[([^\]]*)\]/;

/** "İlan Detayları" tablosu: <li><span>etiket</span><span>deger</span></li> */
const SPEC_ROW_PATTERN =
  /<li[^>]*>\s*<span[^>]*>([^<]+)<\/span>\s*<span[^>]*>([^<]+)<\/span>\s*<\/li>/g;

/** Ust ozet kutulari: <p ...font-semibold...>deger</p><p ...text-xs...>etiket</p> */
const SPEC_TILE_PATTERN =
  /<p[^>]*font-semibold[^>]*>([^<]+)<\/p>\s*<p[^>]*text-xs[^>]*>([^<]+)<\/p>/g;

/** Kacislari cozup React akis metnini tek parca halinde birlestirir. */
function extractFlightText(html: string): string {
  let text = "";
  for (const match of html.matchAll(FLIGHT_CHUNK)) {
    const chunk = match[1];
    if (!chunk) continue;
    try {
      text += JSON.parse(chunk) as string;
    } catch {
      // bozuk parca digerlerini engellemesin
    }
  }
  return text;
}

function parseCoordinates(flightText: string): {
  coordinates: Coordinates | null;
  address: string | null;
} {
  const match = LOCATION_PATTERN.exec(flightText);
  if (!match?.[1] || !match[2]) return { coordinates: null, address: null };

  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { coordinates: null, address: null };
  }

  return {
    coordinates: { lat, lng },
    address: match[3]?.replace(/\\(.)/g, "$1").trim() || null,
  };
}

function parseTransport(flightText: string): string[] {
  const match = TRANSPORT_PATTERN.exec(flightText);
  if (!match?.[1]) return [];
  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1] ?? "").filter(Boolean);
}

const decodeEntities = (value: string) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));

function parseSpecs(html: string): Record<string, string> {
  const body = html.replace(/<script[\s\S]*?<\/script>/g, "");
  const specs: Record<string, string> = {};

  const add = (label: string, value: string) => {
    const key = decodeEntities(label).trim();
    const text = decodeEntities(value).trim();
    if (key && text && !(key in specs)) specs[key] = text;
  };

  for (const row of body.matchAll(SPEC_ROW_PATTERN)) add(row[1] ?? "", row[2] ?? "");
  // Ozet kutularinda sira ters: once deger, sonra etiket.
  for (const tile of body.matchAll(SPEC_TILE_PATTERN)) add(tile[2] ?? "", tile[1] ?? "");

  return specs;
}

export function parseDetailPage(html: string): ListingDetail {
  const flightText = extractFlightText(html);
  const { coordinates, address } = parseCoordinates(flightText);

  return {
    coordinates,
    coordinatesExact: SHOW_ON_MAP_PATTERN.exec(flightText)?.[1] === "true",
    address,
    specs: parseSpecs(html),
    transport: parseTransport(flightText),
  };
}
