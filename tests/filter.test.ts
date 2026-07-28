import { test } from "node:test";
import assert from "node:assert/strict";

import { evaluate, isGroundFloor } from "../src/filter.ts";
import { PRICE_LIMITS } from "../src/config.ts";
import { makeListing } from "./helpers.ts";

test("giris/zemin kat varyantlari elenir", () => {
  // Emlakjet'te gercekten gorulen degerler
  for (const floor of ["Düz Giriş (Zemin)", "Yüksek giriş", "Zemin Kat", "Bahçe Katı", "Bodrum Kat", "Kot 1"]) {
    assert.equal(isGroundFloor(floor), true, `${floor} giris kat sayilmali`);
    assert.equal(evaluate(makeListing({ floorText: floor })).level, "reject");
  }
});

test("normal katlar gecer", () => {
  for (const floor of ["1. Kat", "3. Kat", "9. Kat", "Ara Kat", "Çatı Katı", "2.Kat"]) {
    assert.equal(isGroundFloor(floor), false, `${floor} giris kat sayilmamali`);
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
