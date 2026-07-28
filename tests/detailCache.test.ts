import { test } from "node:test";
import assert from "node:assert/strict";

import { EMPTY_DETAIL, hasDetail, parseDetailPage } from "../src/emlakjet/detailPage.ts";
import { makeDetail, readFixture } from "./helpers.ts";

test("bos detay onbellek sayilmaz", () => {
  // Detay butcesi dolduğunda EMPTY_DETAIL yaziliyor; bunu "alinmis" saymak
  // o ilanin detayinin bir daha hic cekilmemesine yol acardi.
  assert.equal(hasDetail(EMPTY_DETAIL), false);
  assert.equal(hasDetail(makeDetail()), false);
});

test("koordinat veya ozellik varsa detay alinmis sayilir", () => {
  assert.equal(hasDetail(makeDetail({ coordinates: { lat: 41.34, lng: 36.24 } })), true);
  assert.equal(hasDetail(makeDetail({ specs: { "Isıtma Tipi": "Kombi Doğalgaz" } })), true);
});

test("gercek detay sayfasi onbelleklenebilir sayilir", () => {
  assert.equal(hasDetail(parseDetailPage(readFixture("detail-page.html"))), true);
});
