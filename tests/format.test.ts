import { test } from "node:test";
import assert from "node:assert/strict";

import { buildMessage, buildOverflowSummary, escapeHtml } from "../src/format.ts";
import {
  MAX_OVERFLOW_MESSAGES,
  TELEGRAM_CAPTION_LIMIT,
  TELEGRAM_MESSAGE_LIMIT,
} from "../src/config.ts";
import { describeLocation } from "../src/geo.ts";
import { scoreListing } from "../src/score.ts";
import { makeDetail, makeListing } from "./helpers.ts";
import type { Notification, ScoredListing } from "../src/types.ts";

const NOW = new Date("2026-07-28T12:00:00Z");

function makeNotification(overrides: {
  notification?: Partial<Notification>;
  scored?: Partial<ScoredListing>;
} = {}): Notification {
  const listing = overrides.scored?.listing ?? makeListing();
  const detail =
    overrides.scored?.detail ??
    makeDetail({ coordinates: { lat: 41.3438, lng: 36.2448 }, coordinatesExact: true });
  const geo = detail.coordinates
    ? describeLocation(detail.coordinates, detail.coordinatesExact)
    : null;
  const { score, breakdown } = scoreListing(listing, geo, listing.floorText !== null, NOW);

  return {
    kind: "new",
    previousPrice: null,
    ...overrides.notification,
    scored: {
      listing,
      detail,
      geo,
      match: "exact",
      nearReasons: [],
      score,
      breakdown,
      warnings: [],
      ...overrides.scored,
    },
  };
}

test("HTML kacislari uygulanir", () => {
  assert.equal(escapeHtml("A & B <c> \"d\""), "A &amp; B &lt;c&gt; \"d\"");
});

test("baslikta gecen HTML karakterleri mesaji bozmaz", () => {
  const title = 'Daire <b>ÖZEL</b> & "Fırsat" > hepsi';
  const message = buildMessage(
    makeNotification({ scored: { listing: makeListing({ title }) } }),
    NOW,
  );

  assert.ok(message.includes("&lt;b&gt;ÖZEL&lt;/b&gt;"), "baslik kacisi yapilmamis");
  assert.ok(message.includes("&amp;"), "& kacisi yapilmamis");
  // Kalan etiketler sadece bizim urettiklerimiz olmali
  const tags = [...message.matchAll(/<\/?([a-z]+)>/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(tags)].sort(), ["b", "i", "s"].filter((t) => tags.includes(t)));
});

test("yeni ilan mesaji beklenen bolumleri icerir", () => {
  const message = buildMessage(makeNotification(), NOW);

  assert.match(message, /🆕 YENİ İLAN/);
  assert.match(message, /🎯 KESİN EŞLEŞME/);
  assert.match(message, /20\.000 TL/);
  assert.match(message, /Atakent durağı/);
  assert.match(message, /Sahil/);
  assert.match(message, /📅 İlan tarihi/);
});

test("sahibinden ve emlakci ilanlari farkli etiketlenir", () => {
  const owner = buildMessage(
    makeNotification({ scored: { listing: makeListing({ isOwner: true }) } }),
    NOW,
  );
  assert.match(owner, /SAHİBİNDEN/);

  const agency = buildMessage(makeNotification(), NOW);
  assert.match(agency, /Emlak ofisi/);
});

test("fiyat dusus mesaji eski fiyati ve orani gosterir", () => {
  const message = buildMessage(
    makeNotification({
      notification: { kind: "price-drop", previousPrice: 28_000 },
      scored: { listing: makeListing({ price: 21_000 }) },
    }),
    NOW,
  );

  assert.match(message, /📉 FİYAT DÜŞTÜ/);
  assert.match(message, /<s>28\.000 TL<\/s>/);
  assert.match(message, /21\.000 TL/);
  assert.match(message, /-%25/);
});

test("yakin eslesme sebebi ve uyarilar mesaja girer", () => {
  const message = buildMessage(
    makeNotification({
      scored: {
        match: "near",
        nearReasons: ["Bütçeyi 2.000 TL aşıyor"],
        warnings: ["Kat bilgisi ilanda belirtilmemiş — giriş kat olabilir"],
      },
    }),
    NOW,
  );

  assert.match(message, /🟡 YAKIN EŞLEŞME/);
  assert.match(message, /Bütçeyi 2\.000 TL aşıyor/);
  assert.match(message, /⚠️ Kat bilgisi/);
});

test("yaklasik koordinat mesajda belirtilir", () => {
  const message = buildMessage(
    makeNotification({
      scored: {
        detail: makeDetail({
          coordinates: { lat: 41.3438, lng: 36.2448 },
          coordinatesExact: false,
        }),
      },
    }),
    NOW,
  );
  assert.match(message, /yaklaşık, harita gizli/);
});

test("koordinat yoksa mesafe yerine aciklama yazilir", () => {
  const message = buildMessage(
    makeNotification({ scored: { detail: makeDetail(), geo: null } }),
    NOW,
  );
  assert.match(message, /Konum bilgisi alınamadı/);
  assert.ok(!message.includes("durağı"));
});

test("uzun icerikte caption Telegram sinirini asmaz", () => {
  const message = buildMessage(
    makeNotification({
      scored: {
        listing: makeListing({ title: "Ç".repeat(900) }),
        detail: makeDetail({
          coordinates: { lat: 41.3438, lng: 36.2448 },
          coordinatesExact: true,
          address: "A".repeat(300),
          specs: { "Isıtma Tipi": "K".repeat(200), Asansör: "Var", Balkon: "Var" },
          transport: ["Tramvay", "Anayol"],
        }),
        nearReasons: ["N".repeat(200)],
        warnings: ["U".repeat(200)],
      },
    }),
    NOW,
  );

  assert.ok(
    message.length <= TELEGRAM_CAPTION_LIMIT,
    `caption ${message.length} karakter, sinir ${TELEGRAM_CAPTION_LIMIT}`,
  );
});

test("tasma ozeti tum ilanlari listeler", () => {
  const messages = buildOverflowSummary([
    makeNotification({ scored: { listing: makeListing({ id: "1", title: "Bir" }) } }),
    makeNotification({ scored: { listing: makeListing({ id: "2", title: "İki & <x>" }) } }),
  ]);

  assert.equal(messages.length, 1);
  assert.match(messages[0]!, /2 ilan daha/);
  assert.match(messages[0]!, /Bir/);
  assert.match(messages[0]!, /İki &amp; &lt;x&gt;/);
});

test("tasacak ilan yoksa ozet mesaji uretilmez", () => {
  assert.deepEqual(buildOverflowSummary([]), []);
});

test("tasma ozeti Telegram mesaj sinirini ve parca sayisini asmaz", () => {
  const many = Array.from({ length: 500 }, (_, index) =>
    makeNotification({
      scored: { listing: makeListing({ id: String(index), title: `İlan ${index} `.repeat(5) }) },
    }),
  );

  const messages = buildOverflowSummary(many);

  assert.ok(messages.length <= MAX_OVERFLOW_MESSAGES, `${messages.length} parca`);
  for (const message of messages) {
    assert.ok(
      message.length <= TELEGRAM_MESSAGE_LIMIT,
      `parca ${message.length} karakter, sinir ${TELEGRAM_MESSAGE_LIMIT}`,
    );
  }
  assert.match(messages.at(-1)!, /ilan daha/);
});
