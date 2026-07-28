/**
 * Ilan eleme. Sadece liste sayfasindan gelen alanlara bakar - detay sayfasi
 * acmadan karar verir, boylece gereksiz istek atilmaz.
 */
import {
  EXACT_ROOM_TYPES,
  GROUND_FLOOR_PATTERN,
  NEAR_MATCH_PRICE_TOLERANCE,
  NEAR_ROOM_TYPES,
  PRICE_LIMITS,
  SEARCH_AREAS,
} from "./config.ts";
import type { Listing, MatchLevel } from "./types.ts";

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

  // Giris/zemin kat kesin eleme. Kat belirtilmemisse elemiyoruz ama uyariyoruz.
  const groundFloor = isGroundFloor(listing.floorText);
  if (groundFloor === true) {
    return reject(`giris/zemin kat: ${listing.floorText}`);
  }
  if (groundFloor === null) {
    warnings.push("Kat bilgisi ilanda belirtilmemiş — giriş kat olabilir");
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
