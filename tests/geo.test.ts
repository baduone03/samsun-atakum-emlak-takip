import { test } from "node:test";
import assert from "node:assert/strict";

import {
  COASTLINE,
  TRAM_STATIONS,
  coastDistanceMeters,
  describeLocation,
  haversineMeters,
  isBetweenTramAndSea,
  nearestStation,
  walkingMinutes,
} from "../src/geo.ts";

/** Atakent Mahallesi'nde gercek bir emlakjet ilanindan alinan koordinat. */
const ATAKENT_LISTING = { lat: 41.34272548740704, lng: 36.24464163488721 };

test("geo verisi yuklendi", () => {
  assert.ok(TRAM_STATIONS.length >= 25, "tramvay duraklari eksik");
  assert.ok(COASTLINE.length >= 500, "kiyi cizgisi eksik");
  assert.ok(TRAM_STATIONS.some((station) => station.name === "Atakent"));
  assert.ok(TRAM_STATIONS.some((station) => station.name === "Körfez"));
});

test("haversine bilinen mesafeyi dogru hesaplar", () => {
  const atakent = TRAM_STATIONS.find((station) => station.name === "Atakent")!;
  // OSM'de duragin iki yon icin iki noktasi var (~60 m arayla); veri seti
  // isme gore tekillestirdigi icin sonuc bu araliga dusuyor.
  const distance = haversineMeters(ATAKENT_LISTING, atakent);
  assert.ok(distance > 80 && distance < 160, `beklenen 80-160 m, gelen ${distance}`);

  assert.equal(haversineMeters(atakent, atakent), 0);
});

test("en yakin durak dogru secilir", () => {
  const { station, distanceM } = nearestStation(ATAKENT_LISTING);
  assert.equal(station.name, "Atakent");
  assert.ok(distanceM < 200);

  // Korfez duraginin uzerinde durursak Korfez cikmali
  const korfez = TRAM_STATIONS.find((s) => s.name === "Körfez")!;
  assert.equal(nearestStation(korfez).station.name, "Körfez");
});

test("sahil mesafesi makul araliktha", () => {
  const distance = coastDistanceMeters(ATAKENT_LISTING);
  assert.ok(distance > 750 && distance < 850, `beklenen ~800 m, gelen ${distance}`);
});

test("yurume dakikasi dolambac payini uygular", () => {
  // 800 m * 1.3 / 80 = 13 dk
  assert.equal(walkingMinutes(800), 13);
  // cok kisa mesafelerde bile en az 1 dk
  assert.equal(walkingMinutes(5), 1);
});

test("tramvay ile deniz arasinda testi enlemi kullanir", () => {
  const station = { name: "Test", lat: 41.34, lng: 36.24 };
  assert.equal(isBetweenTramAndSea({ lat: 41.35, lng: 36.24 }, station), true);
  assert.equal(isBetweenTramAndSea({ lat: 41.33, lng: 36.24 }, station), false);
});

test("describeLocation kesin olmayan koordinati isaretler", () => {
  const exact = describeLocation(ATAKENT_LISTING, true);
  assert.equal(exact.approximate, false);
  assert.equal(exact.nearestStation.name, "Atakent");
  assert.ok(exact.stationWalkMinutes <= 3);

  const approximate = describeLocation(ATAKENT_LISTING, false);
  assert.equal(approximate.approximate, true);
});
