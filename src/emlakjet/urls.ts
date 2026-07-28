import { EMLAKJET_BASE_URL, ROOM_FILTERS, SEARCH_AREAS, TRADE_TYPES } from "../config.ts";
import type { TradeType } from "../types.ts";

export type ListSource = {
  url: string;
  tradeType: TradeType;
  areaName: string;
  /** Bu URL'in filtreledigi oda tipi ("1+1" gibi). */
  rooms: string;
  /** Bu URL emlakjet'in "sahibinden" filtresini kullaniyor mu. */
  ownerOnly: boolean;
};

/**
 * Taranacak liste sayfalarinin ilk sayfa URL'lerini uretir.
 *
 * Uc boyut carpilir: islem turu × mahalle × oda tipi, her biri iki varyantla
 * (tum ilanlar / sadece sahibinden). Sahibinden varyanti, ilanin emlakci mi
 * sahibi mi oldugunu detay sayfasi acmadan belirlemek icin kullanilir.
 */
export function buildListSources(): ListSource[] {
  const sources: ListSource[] = [];

  for (const tradeType of TRADE_TYPES) {
    for (const area of SEARCH_AREAS) {
      for (const [rooms, roomSlug] of Object.entries(ROOM_FILTERS)) {
        for (const ownerOnly of [false, true]) {
          const ownerSegment = ownerOnly ? "/sahibinden" : "";
          sources.push({
            url:
              `${EMLAKJET_BASE_URL}/${tradeType}-daire/${area.slug}${ownerSegment}` +
              `?filtreler=oda-sayisi=${roomSlug}`,
            tradeType,
            areaName: area.name,
            rooms,
            ownerOnly,
          });
        }
      }
    }
  }

  return sources;
}

/** Sayfa 1 icin URL degismez; sonrakilere sayfa parametresi eklenir. */
export function withPage(url: string, page: number): string {
  if (page <= 1) return url;
  return `${url}${url.includes("?") ? "&" : "?"}sayfa=${page}`;
}

/** Ilan URL'inin sonundaki sayisal id'yi cikarir: .../kiralik-31-daire-19642002 -> "19642002" */
export function extractListingId(url: string): string | null {
  const match = /-(\d{6,})(?:\/|\?|#|$)/.exec(url);
  return match?.[1] ?? null;
}
