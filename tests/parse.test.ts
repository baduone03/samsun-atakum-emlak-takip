import { test } from "node:test";
import assert from "node:assert/strict";

import { parseListPage } from "../src/emlakjet/listPage.ts";
import { parseDetailPage } from "../src/emlakjet/detailPage.ts";
import { extractListingId } from "../src/emlakjet/urls.ts";
import { readFixture } from "./helpers.ts";

const listHtml = readFixture("list-page.html");
const detailHtml = readFixture("detail-page.html");

test("liste sayfasi gercek fixture'dan ilanlari cikarir", () => {
  const listings = parseListPage(listHtml, "kiralik", false);

  assert.ok(listings.length >= 20, `beklenen 20+, gelen ${listings.length}`);
  assert.equal(new Set(listings.map((l) => l.id)).size, listings.length, "tekrar eden id var");

  for (const listing of listings) {
    assert.match(listing.id, /^\d{6,}$/);
    assert.ok(listing.url.startsWith("https://www.emlakjet.com/ilan/"));
    assert.ok(listing.price > 0);
    assert.equal(listing.tradeType, "kiralik");
    assert.equal(listing.isOwner, false);
  }
});

test("liste sayfasi alanlari dogru ayristirir", () => {
  const listing = parseListPage(listHtml, "kiralik", true).find((l) => l.id === "19655011");

  assert.ok(listing, "bilinen ilan fixture'da yok");
  assert.equal(listing.rooms, "1+1");
  assert.equal(listing.floorText, "6. Kat");
  assert.equal(listing.areaSqm, 60);
  assert.equal(listing.price, 18_500);
  assert.equal(listing.neighborhood, "Atakent Mahallesi");
  assert.equal(listing.locationText, "Atakent Mahallesi, Atakum");
  assert.equal(listing.postedAt, "2026-07-27");
  assert.ok(listing.imageUrls.length > 0);
  assert.equal(listing.isOwner, true, "kaynak bayragi ilana gecmeli");
});

/** Verilen `image` degeriyle tek ilanlik minimal bir ld+json sayfasi uretir. */
function listPageWithImage(image: unknown): string {
  const listing = {
    "@type": "RealEstateListing",
    name: "Test ilani",
    url: "https://www.emlakjet.com/ilan/test-ilani-19999001",
    image,
    offers: { price: 20_000 },
    additionalProperty: [{ name: "Oda Sayısı", value: "2+1" }],
  };
  return `<script type="application/ld+json">${JSON.stringify(listing)}</script>`;
}

// Emlakjet 2026-08-07'de `image` alanini diziden duz string'e cevirdi ve
// tarama her kosuda coktu. Iki bicim de desteklenmeli.
test("liste sayfasi hem string hem dizi image alanini kabul eder", () => {
  const url = "https://imaj.emlakjet.com/a.jpg";

  const fromString = parseListPage(listPageWithImage(url), "kiralik", false);
  assert.deepEqual(fromString[0]?.imageUrls, [url]);

  const fromArray = parseListPage(listPageWithImage([url]), "kiralik", false);
  assert.deepEqual(fromArray[0]?.imageUrls, [url]);
});

test("liste sayfasi beklenmedik image bicimlerinde patlamaz", () => {
  for (const image of [undefined, null, "", 42, {}, [null, 7]]) {
    const listings = parseListPage(listPageWithImage(image), "kiralik", false);
    assert.equal(listings.length, 1, `ilan ${JSON.stringify(image)} icin kayboldu`);
    assert.deepEqual(listings[0]?.imageUrls, []);
  }
});

test("liste sayfasi gercek giris kat metinlerini korur", () => {
  const floors = new Set(parseListPage(listHtml, "kiralik", false).map((l) => l.floorText));
  assert.ok(floors.has("Düz Giriş (Zemin)"), "zemin kat vakasi fixture'da olmali");
  assert.ok(floors.has("Yüksek giriş"), "yuksek giris vakasi fixture'da olmali");
});

test("bos ve bozuk HTML sessizce bos liste dondurur", () => {
  assert.deepEqual(parseListPage("", "kiralik", false), []);
  assert.deepEqual(
    parseListPage('<script type="application/ld+json">{bozuk</script>', "kiralik", false),
    [],
  );
});

test("ilan id'si URL'den cikarilir", () => {
  assert.equal(
    extractListingId("https://www.emlakjet.com/ilan/atakent-kiralik-31-daire-19642002"),
    "19642002",
  );
  assert.equal(extractListingId("https://www.emlakjet.com/ilan/slug-yok"), null);
});

test("detay sayfasi koordinat, adres ve harita ayarini cikarir", () => {
  const detail = parseDetailPage(detailHtml);

  assert.ok(detail.coordinates);
  assert.ok(Math.abs(detail.coordinates.lat - 41.3427) < 0.001);
  assert.ok(Math.abs(detail.coordinates.lng - 36.2446) < 0.001);
  assert.equal(detail.address, "Atakum - Atakent Mahallesi");
  // Bu ilanda ilan sahibi haritayi gizlemis - mesafeler yaklasik gosterilmeli
  assert.equal(detail.coordinatesExact, false);
});

test("detay sayfasi ozellik tablosunu okur", () => {
  const { specs, transport } = parseDetailPage(detailHtml);

  assert.equal(specs["Isıtma Tipi"], "Kombi Doğalgaz");
  assert.equal(specs["Asansör"], "Var");
  assert.equal(specs["Bina Yaşı"], "11-15");
  assert.equal(specs["Kat Sayısı"], "5");
  assert.equal(specs["Banyo Sayısı"], "1");
  assert.deepEqual(transport, ["Anayol", "Tramvay", "Dolmuş", "Minibüs"]);
});

test("detay sayfasi bozuksa bos deger doner, hata firlatmaz", () => {
  const detail = parseDetailPage("<html><body>bos</body></html>");
  assert.equal(detail.coordinates, null);
  assert.equal(detail.coordinatesExact, false);
  assert.deepEqual(detail.specs, {});
  assert.deepEqual(detail.transport, []);
});
