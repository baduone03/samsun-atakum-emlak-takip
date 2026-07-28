/**
 * data/tram-stations.json ve data/coastline.json dosyalarini OpenStreetMap'ten yeniden uretir.
 *
 * Elle calistirilir: `npm run geo`
 * Uretilen dosyalar repoya commit edilir; tarama sirasinda OSM'e istek atilmaz.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/** Ana sunucu sik sik 504 donuyor; sirayla denenecek aynalar. */
const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.osm.jp/api/interpreter",
];

const ATTEMPTS_PER_MIRROR = 2;

/** Samsun tramvay hatti + Atakum kiyisini kapsayan bbox: guney,bati,kuzey,dogu */
const BBOX = "41.28,36.10,41.42,36.40";

const DATA_DIR = join(dirname(dirname(fileURLToPath(import.meta.url))), "data");

type OverpassNode = {
  type: "node";
  lat: number;
  lon: number;
  tags?: Record<string, string>;
};

type OverpassWay = {
  type: "way";
  geometry?: Array<{ lat: number; lon: number }>;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function overpass<T>(query: string): Promise<{ elements: T[] }> {
  const failures: string[] = [];

  for (const mirror of OVERPASS_MIRRORS) {
    for (let attempt = 1; attempt <= ATTEMPTS_PER_MIRROR; attempt++) {
      try {
        // Overpass POST'u bu istemciden 406 donduruyor; GET + acik User-Agent calisiyor.
        const response = await fetch(`${mirror}?${new URLSearchParams({ data: query })}`, {
          headers: { "User-Agent": "samsun-atakum-emlak-takip/1.0 (kisisel emlak takibi)" },
          signal: AbortSignal.timeout(120_000),
        });
        if (response.ok) {
          return (await response.json()) as { elements: T[] };
        }
        failures.push(`${mirror} -> HTTP ${response.status}`);
      } catch (error) {
        failures.push(`${mirror} -> ${(error as Error).message}`);
      }
      console.warn(`  yeniden deneniyor: ${failures.at(-1)}`);
      await sleep(attempt * 5000);
    }
  }

  throw new Error(`Overpass tum aynalarda basarisiz:\n  ${failures.join("\n  ")}`);
}

async function fetchTramStations() {
  const { elements } = await overpass<OverpassNode>(
    `[out:json][timeout:100];node["railway"="tram_stop"](${BBOX});out body;`,
  );

  // Ayni durak iki yon icin iki node olarak isaretlenmis: isme gore tekillestir.
  const byName = new Map<string, { name: string; lat: number; lng: number }>();
  for (const node of elements) {
    const name = node.tags?.name?.trim();
    if (!name) continue;
    if (byName.has(name)) continue;
    byName.set(name, { name, lat: node.lat, lng: node.lon });
  }

  const stations = [...byName.values()].sort((a, b) => a.lng - b.lng);
  if (stations.length < 20) {
    throw new Error(`Beklenenden az tramvay duragi bulundu: ${stations.length}`);
  }
  return stations;
}

async function fetchCoastline() {
  const { elements } = await overpass<OverpassWay>(
    `[out:json][timeout:100];way["natural"="coastline"](${BBOX});out geom;`,
  );

  const points = elements
    .flatMap((way) => way.geometry ?? [])
    .map((point) => ({ lat: point.lat, lng: point.lon }));

  if (points.length < 100) {
    throw new Error(`Beklenenden az kiyi noktasi bulundu: ${points.length}`);
  }
  return points;
}

// Overpass es zamanli sorgulari 406 ile reddediyor - sirayla ve arada bekleyerek iste.
const stations = await fetchTramStations();
await sleep(5000);
const coastline = await fetchCoastline();

await mkdir(DATA_DIR, { recursive: true });
await writeFile(
  join(DATA_DIR, "tram-stations.json"),
  JSON.stringify(stations, null, 2) + "\n",
);
await writeFile(
  join(DATA_DIR, "coastline.json"),
  JSON.stringify(coastline) + "\n",
);

console.log(`tram-stations.json: ${stations.length} durak`);
console.log(`coastline.json: ${coastline.length} nokta`);
