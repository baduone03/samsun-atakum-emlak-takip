import { test } from "node:test";
import assert from "node:assert/strict";

import { scoreListing } from "../src/score.ts";
import { MAX_SCORE, SCORE_WEIGHTS } from "../src/config.ts";
import { describeLocation } from "../src/geo.ts";
import { makeListing } from "./helpers.ts";

const NOW = new Date("2026-07-28T12:00:00Z");

/** Atakent duraginin hemen kuzeyi: tramvaya da sahile de yakin. */
const IDEAL_SPOT = { lat: 41.3455, lng: 36.2448 };

const totalOf = (label: RegExp, breakdown: { label: string; points: number }[]) =>
  breakdown.find((item) => label.test(item.label))?.points ?? 0;

test("sahibinden ilani puan alir", () => {
  const withOwner = scoreListing(makeListing({ isOwner: true }), null, true, NOW);
  const withoutOwner = scoreListing(makeListing({ isOwner: false }), null, true, NOW);

  assert.equal(withOwner.score - withoutOwner.score, SCORE_WEIGHTS.owner);
});

test("konum puanlari yakinliga gore verilir", () => {
  const geo = describeLocation(IDEAL_SPOT, true);
  const { breakdown } = scoreListing(makeListing(), geo, true, NOW);

  assert.equal(totalOf(/Tramvaya/, breakdown), SCORE_WEIGHTS.tramNear);
  assert.equal(totalOf(/arasında/, breakdown), SCORE_WEIGHTS.betweenTramAndSea);
});

test("yaklasik koordinatta konum puanlari yariya iner", () => {
  const exact = scoreListing(makeListing(), describeLocation(IDEAL_SPOT, true), true, NOW);
  const approx = scoreListing(makeListing(), describeLocation(IDEAL_SPOT, false), true, NOW);

  assert.ok(approx.score < exact.score, "yaklasik konum daha dusuk puan almali");
  assert.equal(totalOf(/Tramvaya/, approx.breakdown), Math.round(SCORE_WEIGHTS.tramNear / 2));
  assert.match(approx.breakdown.find((b) => /Tramvaya/.test(b.label))!.label, /yaklaşık/);
});

test("uzak konum tramvay puani almaz", () => {
  // Kilicdede duragi civari - Atakent'ten cok uzak, ama yine de bir durak yakininda.
  const farFromEverything = { lat: 41.28, lng: 36.15 };
  const { breakdown } = scoreListing(makeListing(), describeLocation(farFromEverything, true), true, NOW);

  assert.equal(totalOf(/Tramvaya/, breakdown), 0);
});

test("butce alti fiyat ve net kat bilgisi puan ekler", () => {
  const cheap = scoreListing(makeListing({ price: 15_000 }), null, true, NOW);
  const atLimit = scoreListing(makeListing({ price: 25_000 }), null, true, NOW);
  assert.equal(cheap.score - atLimit.score, SCORE_WEIGHTS.wellUnderBudget);

  const noFloor = scoreListing(makeListing({ price: 15_000 }), null, false, NOW);
  assert.equal(cheap.score - noFloor.score, SCORE_WEIGHTS.floorKnown);
});

test("yeni ilan bonusu tarihe gore verilir", () => {
  const fresh = scoreListing(makeListing({ postedAt: "2026-07-27" }), null, true, NOW);
  const old = scoreListing(makeListing({ postedAt: "2026-05-01" }), null, true, NOW);
  const unknown = scoreListing(makeListing({ postedAt: null }), null, true, NOW);

  assert.equal(fresh.score - old.score, SCORE_WEIGHTS.freshListing);
  assert.equal(unknown.score, old.score);
});

test("skor 100'u asmaz", () => {
  const best = makeListing({ isOwner: true, price: 10_000, postedAt: "2026-07-28" });
  const { score } = scoreListing(best, describeLocation(IDEAL_SPOT, true), true, NOW);

  assert.ok(score <= MAX_SCORE, `skor ${score}`);
});
