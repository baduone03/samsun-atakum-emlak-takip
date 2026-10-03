import { test } from "node:test";
import assert from "node:assert/strict";

import { evaluate, excludedFloorReason, isFirstFloor, isGroundFloor, tramTooFarReason } from "../src/filter.ts";
import { PRICE_LIMITS, TRAM_MAX_MINUTES } from "../src/config.ts";
import type { GeoInfo } from "../src/types.ts";
import { makeListing } from "./helpers.ts";

test("giris/zemin kat varyantlari elenir", () => {
  // Emlakjet'te gercekten gorulen degerler
  for (const floor of ["Düz Giriş (Zemin)", "Yüksek giriş", "Zemin Kat", "Bahçe Katı", "Bodrum Kat", "Kot 1"]) {
    assert.equal(isGroundFloor(floor), true, `${floor} giris kat sayilmali`);
    assert.equal(evaluate(makeListing({ floorText: floor })).level, "reject");
  }
});

test("1. kat varyantlari elenir", () => {
  for (const floor of ["1. Kat", "1.Kat", "1 Kat", "Kat 1", "Birinci Kat"]) {
    assert.equal(isFirstFloor(floor), true, `${floor} 1. kat sayilmali`);
    assert.equal(evaluate(makeListing({ floorText: floor })).level, "reject");
    assert.ok(excludedFloorReason(floor));
  }
});

test("normal katlar gecer", () => {
  for (const floor of ["2. Kat", "3. Kat", "9. Kat", "10.Kat", "11. Kat", "21. Kat", "Ara Kat", "Çatı Katı", "2.Kat"]) {
    assert.equal(isGroundFloor(floor), false, `${floor} giris kat sayilmamali`);
    assert.equal(isFirstFloor(floor), false, `${floor} 1. kat sayilmamali`);
    assert.equal(excludedFloorReason(floor), null);
    assert.equal(evaluate(makeListing({ floorText: floor })).level, "exact");
  }
});

test("kat bilgisi yoksa elenmez ama uyari verilir", () => {
  const result = evaluate(makeListing({ floorText: null }));
  assert.equal(isGroundFloor(null), null);
  assert.equal(result.level, "exact");
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0]!, /Kat bilgisi/);
});

test("kiralik fiyat siniri: tam sinir gecer, ustu yakin eslesme olur", () => {
  const limit = PRICE_LIMITS.kiralik;

  assert.equal(evaluate(makeListing({ price: limit })).level, "exact");

  const over = evaluate(makeListing({ price: limit + 1 }));
  assert.equal(over.level, "near");
  assert.match(over.nearReasons[0]!, /Bütçeyi/);

  // %10 toleransin da ustu tamamen elenir
  assert.equal(evaluate(makeListing({ price: Math.round(limit * 1.11) })).level, "reject");
});

test("satilik fiyat siniri kendi esigini kullanir", () => {
  const satilik = { tradeType: "satilik" as const, price: PRICE_LIMITS.satilik };
  assert.equal(evaluate(makeListing(satilik)).level, "exact");
  assert.equal(
    evaluate(makeListing({ ...satilik, price: PRICE_LIMITS.satilik + 1 })).level,
    "near",
  );
  // Ayni fiyat kiralik olsaydi elenirdi - esiklerin karismadigini dogrular
  assert.equal(
    evaluate(makeListing({ tradeType: "kiralik", price: PRICE_LIMITS.satilik })).level,
    "reject",
  );
});

test("oda sayisi: 1+1 ve 2+1 kesin, 3+1 yakin, digerleri elenir", () => {
  assert.equal(evaluate(makeListing({ rooms: "1+1" })).level, "exact");
  assert.equal(evaluate(makeListing({ rooms: "2+1" })).level, "exact");

  const near = evaluate(makeListing({ rooms: "3+1" }));
  assert.equal(near.level, "near");
  assert.match(near.nearReasons[0]!, /3\+1/);

  assert.equal(evaluate(makeListing({ rooms: "4+1" })).level, "reject");
  assert.equal(evaluate(makeListing({ rooms: "1+0" })).level, "reject");
  assert.equal(evaluate(makeListing({ rooms: null })).level, "reject");
});

test("hedef mahalleler disi elenir", () => {
  assert.equal(evaluate(makeListing({ neighborhood: "Körfez Mahallesi" })).level, "exact");
  assert.equal(evaluate(makeListing({ neighborhood: "Denizevleri Mahallesi" })).level, "reject");
  assert.equal(evaluate(makeListing({ neighborhood: null })).level, "reject");
});

test("birden fazla yakin eslesme sebebi birikir", () => {
  const result = evaluate(
    makeListing({ rooms: "3+1", price: PRICE_LIMITS.kiralik + 2000 }),
  );
  assert.equal(result.level, "near");
  assert.equal(result.nearReasons.length, 2);
});

test("tramvaya 10 dk'dan uzak ilanlar elenir, konum yoksa elenmez", () => {
  const geoAt = (minutes: number) => ({ stationWalkMinutes: minutes }) as GeoInfo;

  assert.equal(tramTooFarReason(geoAt(8)), null);
  assert.equal(tramTooFarReason(geoAt(TRAM_MAX_MINUTES)), null);
  assert.match(tramTooFarReason(geoAt(TRAM_MAX_MINUTES + 1))!, /tramvaya uzak/);
  assert.equal(tramTooFarReason(null), null);
});
