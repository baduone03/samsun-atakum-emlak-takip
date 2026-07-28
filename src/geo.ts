/**
 * Konum hesaplari: en yakin tramvay duragi, sahil mesafesi ve yurume suresi.
 * Durak/kiyi verisi repoda hazir duruyor (data/), calisma aninda ag istegi yok.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { WALKING_DETOUR_FACTOR, WALKING_SPEED_M_PER_MIN } from "./config.ts";
import type { Coordinates, GeoInfo, TramStation } from "./types.ts";

const DATA_DIR = join(dirname(dirname(fileURLToPath(import.meta.url))), "data");

const readJson = <T>(fileName: string): T =>
  JSON.parse(readFileSync(join(DATA_DIR, fileName), "utf8")) as T;

export const TRAM_STATIONS = readJson<TramStation[]>("tram-stations.json");
export const COASTLINE = readJson<Coordinates[]>("coastline.json");

const EARTH_RADIUS_M = 6_371_000;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Iki koordinat arasindaki kus ucusu mesafe (metre). */
export function haversineMeters(from: Coordinates, to: Coordinates): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/** Kus ucusu mesafeyi dolambac payiyla yurume dakikasina cevirir. */
export function walkingMinutes(meters: number): number {
  return Math.max(1, Math.round((meters * WALKING_DETOUR_FACTOR) / WALKING_SPEED_M_PER_MIN));
}

export function nearestStation(point: Coordinates): {
  station: TramStation;
  distanceM: number;
} {
  let best = TRAM_STATIONS[0];
  if (!best) throw new Error("data/tram-stations.json bos - `npm run geo` calistir");

  let bestDistance = haversineMeters(point, best);
  for (const station of TRAM_STATIONS.slice(1)) {
    const distance = haversineMeters(point, station);
    if (distance < bestDistance) {
      best = station;
      bestDistance = distance;
    }
  }

  return { station: best, distanceM: bestDistance };
}

export function coastDistanceMeters(point: Coordinates): number {
  let best = Infinity;
  for (const coastPoint of COASTLINE) {
    const distance = haversineMeters(point, coastPoint);
    if (distance < best) best = distance;
  }
  return best;
}

/**
 * Ilan, tramvay hatti ile deniz arasinda mi.
 *
 * Atakum'da Karadeniz kuzeyde, tramvay hatti kiyiya paralel guneyinde uzaniyor.
 * Bu yuzden "arada olmak" = en yakin duragin kuzeyinde ve kiyinin guneyinde olmak.
 */
export function isBetweenTramAndSea(point: Coordinates, station: TramStation): boolean {
  return point.lat > station.lat;
}

export function describeLocation(point: Coordinates, coordinatesExact: boolean): GeoInfo {
  const { station, distanceM } = nearestStation(point);
  const coastDistanceM = coastDistanceMeters(point);

  return {
    nearestStation: station,
    stationDistanceM: Math.round(distanceM),
    stationWalkMinutes: walkingMinutes(distanceM),
    coastDistanceM: Math.round(coastDistanceM),
    coastWalkMinutes: walkingMinutes(coastDistanceM),
    betweenTramAndSea: isBetweenTramAndSea(point, station),
    approximate: !coordinatesExact,
  };
}
