/**
 * Liste sayfasi ayristirici.
 *
 * Emlakjet, liste sayfasina `<script type="application/ld+json">` icinde
 * `@graph: RealEstateListing[]` gomuyor. CSS secici yerine bu yapisal veriyi
 * okuyoruz - tema degisikliklerinden etkilenmez.
 */
import type { Listing, TradeType } from "../types.ts";
import { extractListingId } from "./urls.ts";

type PropertyValue = { name?: string; value?: string };

type RawListing = {
  "@type"?: string;
  name?: string;
  url?: string;
  image?: string[];
  datePosted?: string;
  offers?: { price?: number };
  additionalProperty?: PropertyValue[];
};

const LD_JSON_BLOCK = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;

/** ld+json bloklarindan RealEstateListing nesnelerini toplar. */
function collectRawListings(html: string): RawListing[] {
  const raw: RawListing[] = [];

  for (const match of html.matchAll(LD_JSON_BLOCK)) {
    const body = match[1];
    if (!body) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      continue; // bozuk blok digerlerini engellemesin
    }

    const candidates = Array.isArray(parsed)
      ? parsed
      : [parsed, ...((parsed as { "@graph"?: unknown[] })?.["@graph"] ?? [])];

    for (const candidate of candidates) {
      if ((candidate as RawListing)?.["@type"] === "RealEstateListing") {
        raw.push(candidate as RawListing);
      }
    }
  }

  return raw;
}

function readProperty(properties: PropertyValue[], name: string): string | null {
  const value = properties.find((property) => property.name === name)?.value;
  return value?.trim() || null;
}

/** "60 m²" -> 60 */
function parseArea(value: string | null): number | null {
  if (!value) return null;
  const match = /(\d[\d.]*)/.exec(value.replace(/\./g, ""));
  return match?.[1] ? Number(match[1]) : null;
}

/** "Atakent Mahallesi, Atakum" -> "Atakent Mahallesi" */
function parseNeighborhood(value: string | null): string | null {
  return value?.split(",")[0]?.trim() || null;
}

function toListing(raw: RawListing, tradeType: TradeType, isOwner: boolean): Listing | null {
  const url = raw.url;
  const price = raw.offers?.price;
  if (!url || typeof price !== "number") return null;

  const id = extractListingId(url);
  if (!id) return null;

  const properties = raw.additionalProperty ?? [];
  const locationText = readProperty(properties, "Konum");

  return {
    id,
    url,
    title: raw.name?.trim() || "(başlıksız ilan)",
    tradeType,
    price,
    rooms: readProperty(properties, "Oda Sayısı"),
    areaSqm: parseArea(readProperty(properties, "Metrekare")),
    floorText: readProperty(properties, "Kat"),
    locationText,
    neighborhood: parseNeighborhood(locationText),
    postedAt: raw.datePosted?.trim() || null,
    imageUrls: raw.image?.filter((image) => typeof image === "string") ?? [],
    isOwner,
  };
}

/** Bir liste sayfasi HTML'inden ilanlari cikarir. URL'e gore tekillestirir. */
export function parseListPage(
  html: string,
  tradeType: TradeType,
  isOwner: boolean,
): Listing[] {
  const byId = new Map<string, Listing>();

  for (const raw of collectRawListings(html)) {
    const listing = toListing(raw, tradeType, isOwner);
    if (listing && !byId.has(listing.id)) {
      byId.set(listing.id, listing);
    }
  }

  return [...byId.values()];
}
