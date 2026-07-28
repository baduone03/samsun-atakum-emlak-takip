import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { diffAgainstState, emptyState, loadState, saveState, updateState } from "../src/state.ts";
import { STATE_VERSION } from "../src/config.ts";
import { makeDetail, makeListing } from "./helpers.ts";
import type { ScoredListing } from "../src/types.ts";

const tempPath = (name: string) => join(mkdtempSync(join(tmpdir(), "emlak-")), name);

function makeScored(id: string, price: number): ScoredListing {
  return {
    listing: makeListing({ id, price }),
    detail: makeDetail(),
    geo: null,
    match: "exact",
    nearReasons: [],
    score: 50,
    breakdown: [],
    warnings: [],
  };
}

test("dosya yoksa bos durum doner", () => {
  const state = loadState(tempPath("yok.json"));
  assert.equal(state.version, STATE_VERSION);
  assert.deepEqual(state.listings, {});
});

test("bozuk state sessizce sifirlanmaz, hata firlatir", () => {
  const path = tempPath("bozuk.json");
  writeFileSync(path, "{bu json degil");
  assert.throws(() => loadState(path));
});

test("surum uyusmazliginda hata firlatir", () => {
  const path = tempPath("eski.json");
  writeFileSync(path, JSON.stringify({ version: 999, updatedAt: "", listings: {} }));
  assert.throws(() => loadState(path), /surum/);
});

test("kaydedilen durum geri okunur", () => {
  const path = tempPath("seen.json");
  const state = updateState(emptyState(), [makeScored("1", 20_000)]);

  saveState(state, path);
  const reloaded = loadState(path);

  assert.deepEqual(reloaded.listings["1"]?.price, 20_000);
});

test("ilk gorulen ilan yeni olarak bildirilir", () => {
  const notifications = diffAgainstState([makeScored("1", 20_000)], emptyState());

  assert.equal(notifications.length, 1);
  assert.equal(notifications[0]?.kind, "new");
  assert.equal(notifications[0]?.previousPrice, null);
});

test("degismeyen ilan tekrar bildirilmez", () => {
  const scored = [makeScored("1", 20_000)];
  const state = updateState(emptyState(), scored);

  assert.deepEqual(diffAgainstState(scored, state), []);
});

test("fiyat dususu bildirilir, artis bildirilmez", () => {
  const state = updateState(emptyState(), [makeScored("1", 20_000)]);

  const drop = diffAgainstState([makeScored("1", 17_500)], state);
  assert.equal(drop.length, 1);
  assert.equal(drop[0]?.kind, "price-drop");
  assert.equal(drop[0]?.previousPrice, 20_000);

  assert.deepEqual(diffAgainstState([makeScored("1", 24_000)], state), []);
});

test("firstSeenAt korunur, lastSeenAt guncellenir", () => {
  const first = new Date("2026-07-01T00:00:00Z");
  const later = new Date("2026-07-28T00:00:00Z");

  const initial = updateState(emptyState(), [makeScored("1", 20_000)], first);
  const updated = updateState(initial, [makeScored("1", 19_000)], later);

  assert.equal(updated.listings["1"]?.firstSeenAt, first.toISOString());
  assert.equal(updated.listings["1"]?.lastSeenAt, later.toISOString());
  assert.equal(updated.listings["1"]?.price, 19_000);
});
