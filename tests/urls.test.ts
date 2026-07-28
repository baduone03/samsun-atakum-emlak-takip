import { test } from "node:test";
import assert from "node:assert/strict";

import { buildListSources, withPage } from "../src/emlakjet/urls.ts";
import { ROOM_FILTERS, SEARCH_AREAS, TRADE_TYPES } from "../src/config.ts";

test("her islem turu / mahalle / oda / sahiplik kombinasyonu uretilir", () => {
  const sources = buildListSources();
  const expected =
    TRADE_TYPES.length * SEARCH_AREAS.length * Object.keys(ROOM_FILTERS).length * 2;

  assert.equal(sources.length, expected);
  assert.equal(new Set(sources.map((source) => source.url)).size, expected, "tekrar eden URL var");
});

test("URL'ler oda filtresi ve sahibinden segmentini dogru kurar", () => {
  const sources = buildListSources();

  const ownerFiltered = sources.find(
    (source) =>
      source.tradeType === "kiralik" &&
      source.rooms === "2+1" &&
      source.ownerOnly &&
      source.areaName === "Atakent Mahallesi",
  );

  assert.equal(
    ownerFiltered?.url,
    "https://www.emlakjet.com/kiralik-daire/samsun-atakum-atakent-mahallesi/sahibinden?filtreler=oda-sayisi=2-1",
  );

  const plain = sources.find(
    (source) =>
      source.tradeType === "satilik" &&
      source.rooms === "1+1" &&
      !source.ownerOnly &&
      source.areaName === "Körfez Mahallesi",
  );

  assert.equal(
    plain?.url,
    "https://www.emlakjet.com/satilik-daire/samsun-atakum-korfez-mahallesi?filtreler=oda-sayisi=1-1",
  );
});

test("sayfa parametresi mevcut sorguya eklenir", () => {
  const withQuery = "https://www.emlakjet.com/kiralik-daire/x?filtreler=oda-sayisi=1-1";

  assert.equal(withPage(withQuery, 1), withQuery, "ilk sayfada URL degismemeli");
  assert.equal(withPage(withQuery, 3), `${withQuery}&sayfa=3`);
  assert.equal(withPage("https://www.emlakjet.com/kiralik-daire/x", 2), "https://www.emlakjet.com/kiralik-daire/x?sayfa=2");
});
