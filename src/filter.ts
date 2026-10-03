/**
 * Ilan eleme. Sadece liste sayfasindan gelen alanlara bakar - detay sayfasi
 * acmadan karar verir, boylece gereksiz istek atilmaz.
 */
import {
  EXACT_ROOM_TYPES,
  TRAM_MAX_MINUTES,
  FIRST_FLOOR_PATTERN,
  GROUND_FLOOR_PATTERN,
  NEAR_MATCH_PRICE_TOLERANCE,
  NEAR_ROOM_TYPES,
  PRICE_LIMITS,
  SEARCH_AREAS,
} from "./config.ts";
import type { GeoInfo, Listing, MatchLevel } from "./types.ts";

export type FilterResult = {
  level: MatchLevel;
  /** level === "near" ise kullaniciya gosterilecek sebepler. */
  nearReasons: string[];
  /** level === "reject" ise log icin tek satirlik sebep. */
  rejectReason: string | null;
  /** Bildirimde gosterilecek uyarilar (orn. kat bilgisi yok). */
  warnings: string[];
};

const ALLOWED_NEIGHBORHOODS: string[] = SEARCH_AREAS.map((area) => area.name);

const formatTl = (value: number) => `${value.toLocaleString("tr-TR")} TL`;

/** Giris/zemin kat mi. Kat bilgisi yoksa "bilinmiyor" (null) doner. */
export function isGroundFloor(floorText: string | null): boolean | null {
  if (!floorText) return null;
  return GROUND_FLOOR_PATTERN.test(floorText);
}

/** 1. kat mi. Kat bilgisi yoksa "bilinmiyor" (null) doner. */
export function isFirstFloor(floorText: string | null): boolean | null {
  if (!floorText) return null;
  return FIRST_FLOOR_PATTERN.test(floorText);
}

/**
 * Kullanicinin istemedigi kat icin eleme sebebi, istenen katsa null.
 * Hem liste sayfasindaki kat metni hem de detaydaki "Bulunduğu Kat" icin kullanilir.
 */
export function excludedFloorReason(floorText: string | null): string | null {
  if (isGroundFloor(floorText)) return `giris/zemin kat: ${floorText}`;
  if (isFirstFloor(floorText)) return `1. kat: ${floorText}`;
  return null;
}

export function evaluate(listing: Listing): FilterResult {
  const nearReasons: string[] = [];
  const warnings: string[] = [];
  const reject = (rejectReason: string): FilterResult => ({
    level: "reject",
    nearReasons: [],
    rejectReason,
    warnings: [],
  });

  if (!listing.neighborhood || !ALLOWED_NEIGHBORHOODS.includes(listing.neighborhood)) {
    return reject(`mahalle disi: ${listing.neighborhood ?? "bilinmiyor"}`);
  }

  // Giris/zemin kat ve 1. kat kesin eleme. Kat belirtilmemisse elemiyoruz ama uyariyoruz.
  const floorReason = excludedFloorReason(listing.floorText);
  if (floorReason) {
    return reject(floorReason);
  }
  if (!listing.floorText) {
    warnings.push("Kat bilgisi ilanda belirtilmemiş — giriş ya da 1. kat olabilir");
  }

  if (!listing.rooms) {
    return reject("oda sayisi bilinmiyor");
  }
  if (!EXACT_ROOM_TYPES.includes(listing.rooms)) {
    if (!NEAR_ROOM_TYPES.includes(listing.rooms)) {
      return reject(`oda sayisi disinda: ${listing.rooms}`);
    }
    nearReasons.push(`${listing.rooms} — aradığın ${EXACT_ROOM_TYPES.join(" / ")} değil`);
  }

  const limit = PRICE_LIMITS[listing.tradeType];
  const nearLimit = Math.round(limit * (1 + NEAR_MATCH_PRICE_TOLERANCE));
  if (listing.price > nearLimit) {
    return reject(`fiyat cok yuksek: ${listing.price} > ${nearLimit}`);
  }
  if (listing.price > limit) {
    nearReasons.push(`Bütçeyi ${formatTl(listing.price - limit)} aşıyor`);
  }

  return {
    level: nearReasons.length > 0 ? "near" : "exact",
    nearReasons,
    rejectReason: null,
    warnings,
  };
}

/**
 * Tramvay duragina yurume suresi siniri asiyorsa eleme sebebi, yoksa null.
 * Koordinat yoksa mesafe bilinemez; ilan elenmez.
 */
export function tramTooFarReason(geo: GeoInfo | null): string | null {
  if (!geo || geo.stationWalkMinutes <= TRAM_MAX_MINUTES) return null;
  return `tramvaya uzak: ${geo.stationWalkMinutes} dk > ${TRAM_MAX_MINUTES} dk`;
}
