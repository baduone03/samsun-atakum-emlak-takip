/**
 * Ilan siralamasi icin 0-100 arasi skor. Kullanicinin oncelikleri agirliklara
 * donusturuldu: sahibinden olmak, tramvay/sahil yakinligi ve tramvay ile deniz
 * arasinda kalmak.
 */
import {
  APPROXIMATE_COORD_SCORE_FACTOR,
  COAST_NEAR_MINUTES,
  COAST_OK_MINUTES,
  FRESH_LISTING_DAYS,
  MAX_SCORE,
  PRICE_LIMITS,
  SCORE_WEIGHTS,
  TRAM_NEAR_MINUTES,
  TRAM_OK_MINUTES,
  WELL_UNDER_BUDGET_RATIO,
} from "./config.ts";
import type { GeoInfo, Listing, ScoreBreakdown } from "./types.ts";

const DAY_MS = 86_400_000;

function daysSince(isoDate: string | null, now: Date): number | null {
  if (!isoDate) return null;
  const posted = new Date(isoDate);
  if (Number.isNaN(posted.getTime())) return null;
  return Math.floor((now.getTime() - posted.getTime()) / DAY_MS);
}

/** Koordinat yaklasikken mesafeye dayali puanlari kirpar - yanlis kesinlik verilmesin. */
function distancePoints(points: number, geo: GeoInfo): number {
  return geo.approximate ? Math.round(points * APPROXIMATE_COORD_SCORE_FACTOR) : points;
}

function geoBreakdown(geo: GeoInfo): ScoreBreakdown[] {
  const items: ScoreBreakdown[] = [];
  const suffix = geo.approximate ? " (konum yaklaşık)" : "";

  if (geo.stationWalkMinutes <= TRAM_NEAR_MINUTES) {
    items.push({
      label: `Tramvaya ${geo.stationWalkMinutes} dk${suffix}`,
      points: distancePoints(SCORE_WEIGHTS.tramNear, geo),
    });
  } else if (geo.stationWalkMinutes <= TRAM_OK_MINUTES) {
    items.push({
      label: `Tramvaya ${geo.stationWalkMinutes} dk${suffix}`,
      points: distancePoints(SCORE_WEIGHTS.tramOk, geo),
    });
  }

  if (geo.coastWalkMinutes <= COAST_NEAR_MINUTES) {
    items.push({
      label: `Sahile ${geo.coastWalkMinutes} dk${suffix}`,
      points: distancePoints(SCORE_WEIGHTS.coastNear, geo),
    });
  } else if (geo.coastWalkMinutes <= COAST_OK_MINUTES) {
    items.push({
      label: `Sahile ${geo.coastWalkMinutes} dk${suffix}`,
      points: distancePoints(SCORE_WEIGHTS.coastOk, geo),
    });
  }

  if (geo.betweenTramAndSea) {
    items.push({
      label: `Tramvay ile deniz arasında${suffix}`,
      points: distancePoints(SCORE_WEIGHTS.betweenTramAndSea, geo),
    });
  }

  return items;
}

export function scoreListing(
  listing: Listing,
  geo: GeoInfo | null,
  hasFloorInfo: boolean,
  now = new Date(),
): { score: number; breakdown: ScoreBreakdown[] } {
  const breakdown: ScoreBreakdown[] = [];

  if (listing.isOwner) {
    breakdown.push({ label: "Sahibinden (komisyon yok)", points: SCORE_WEIGHTS.owner });
  }

  if (geo) breakdown.push(...geoBreakdown(geo));

  const limit = PRICE_LIMITS[listing.tradeType];
  if (listing.price <= limit * WELL_UNDER_BUDGET_RATIO) {
    breakdown.push({ label: "Bütçenin belirgin altında", points: SCORE_WEIGHTS.wellUnderBudget });
  }

  if (hasFloorInfo) {
    breakdown.push({ label: "Kat bilgisi net", points: SCORE_WEIGHTS.floorKnown });
  }

  const age = daysSince(listing.postedAt, now);
  if (age !== null && age <= FRESH_LISTING_DAYS) {
    breakdown.push({ label: "Yeni ilan", points: SCORE_WEIGHTS.freshListing });
  }

  const total = breakdown.reduce((sum, item) => sum + item.points, 0);
  return { score: Math.min(MAX_SCORE, total), breakdown };
}
