/**
 * Telegram bildirim metinleri. Telegram'in HTML modu kullaniliyor:
 * sadece <b> <i> <s> <a> <code> etiketleri gecerli, geri kalan her sey kacilmali.
 */
import {
  MAX_OVERFLOW_MESSAGES,
  PRICE_LIMITS,
  TELEGRAM_CAPTION_LIMIT,
  TELEGRAM_MESSAGE_LIMIT,
} from "./config.ts";
import type { Notification, ScoredListing } from "./types.ts";

/** Telegram HTML modunda metin icinde gecmesi gereken kacislar. */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const formatTl = (value: number) => `${value.toLocaleString("tr-TR")} TL`;

export function mapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

const TR_MONTHS = [
  "Oca", "Şub", "Mar", "Nis", "May", "Haz",
  "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
];

/** "2026-07-24" -> "24 Tem 2026 (2 gün önce)" */
function formatPostedAt(isoDate: string | null, now: Date): string | null {
  if (!isoDate) return null;
  const posted = new Date(isoDate);
  if (Number.isNaN(posted.getTime())) return null;

  const label = `${posted.getUTCDate()} ${TR_MONTHS[posted.getUTCMonth()]} ${posted.getUTCFullYear()}`;
  const days = Math.floor((now.getTime() - posted.getTime()) / 86_400_000);
  if (days <= 0) return `${label} (bugün)`;
  if (days === 1) return `${label} (dün)`;
  return `${label} (${days} gün önce)`;
}

function headerLine(notification: Notification): string {
  const { kind, scored } = notification;
  const kindLabel = kind === "new" ? "🆕 YENİ İLAN" : "📉 FİYAT DÜŞTÜ";
  const matchLabel = scored.match === "exact" ? "🎯 KESİN EŞLEŞME" : "🟡 YAKIN EŞLEŞME";
  return `${kindLabel} · ${matchLabel} · ⭐ ${scored.score}/100`;
}

function priceLine(notification: Notification): string {
  const { listing } = notification.scored;
  const unit = listing.tradeType === "kiralik" ? " / ay" : "";
  const limit = PRICE_LIMITS[listing.tradeType];
  const ratio = Math.round((listing.price / limit) * 100);

  if (notification.kind === "price-drop" && notification.previousPrice) {
    const dropPercent = Math.round(
      ((notification.previousPrice - listing.price) / notification.previousPrice) * 100,
    );
    return (
      `💰 <s>${formatTl(notification.previousPrice)}</s> → <b>${formatTl(listing.price)}</b>` +
      `${unit} · <b>-%${dropPercent}</b>`
    );
  }

  return `💰 <b>${formatTl(listing.price)}</b>${unit} · bütçe kullanımı %${ratio}`;
}

function sellerLine(scored: ScoredListing): string {
  return scored.listing.isOwner
    ? "👤 <b>SAHİBİNDEN</b> — emlakçı komisyonu yok ✅"
    : "🏢 Emlak ofisi ilanı — komisyon çıkabilir";
}

/** "1+1 · 65 m² · 3. Kat · Bina yaşı 5-10" */
function propertyLine(scored: ScoredListing): string {
  const { listing, detail } = scored;
  const parts = [listing.rooms, listing.areaSqm ? `${listing.areaSqm} m²` : null];

  parts.push(listing.floorText ? `<b>${escapeHtml(listing.floorText)}</b>` : null);

  const totalFloors = detail.specs["Kat Sayısı"];
  if (totalFloors) parts.push(`${escapeHtml(totalFloors)} katlı bina`);

  const buildingAge = detail.specs["Bina Yaşı"];
  if (buildingAge) parts.push(`Bina yaşı ${escapeHtml(buildingAge)}`);

  return `🏠 ${parts.filter(Boolean).join(" · ")}`;
}

/** Isitma, esya, banyo, otopark, asansor gibi ikinci satir ozellikleri. */
function featureLine(scored: ScoredListing): string | null {
  const { specs } = scored.detail;
  const parts: string[] = [];

  const heating = specs["Isıtma Tipi"];
  if (heating) parts.push(`🔥 ${escapeHtml(heating)}`);

  const furnished = specs["Eşya Durumu"];
  if (furnished) parts.push(`🛋 ${escapeHtml(furnished)}`);

  const bathrooms = specs["Banyo Sayısı"];
  if (bathrooms) parts.push(`🛁 ${escapeHtml(bathrooms)} banyo`);

  if (specs["Asansör"] === "Var") parts.push("🛗 Asansör");
  if (specs["Otopark"]) parts.push(`🅿️ ${escapeHtml(specs["Otopark"])}`);
  if (specs["Balkon"] === "Var") parts.push("🌤 Balkon");

  return parts.length > 0 ? parts.join(" · ") : null;
}

function locationLines(scored: ScoredListing): string[] {
  const { listing, detail, geo } = scored;
  const lines = [`📍 ${escapeHtml(detail.address ?? listing.locationText ?? "Atakum")}`];

  if (!geo) {
    lines.push("🚊 Konum bilgisi alınamadı — mesafe hesaplanamadı");
    return lines;
  }

  const approx = geo.approximate ? " <i>(yaklaşık, harita gizli)</i>" : "";
  lines.push(
    `🚊 ${escapeHtml(geo.nearestStation.name)} durağı — <b>${geo.stationDistanceM} m</b>` +
      ` (~${geo.stationWalkMinutes} dk yürüme)${approx}`,
  );
  lines.push(
    `🌊 Sahil — <b>${geo.coastDistanceM} m</b> (~${geo.coastWalkMinutes} dk yürüme)${approx}`,
  );
  if (geo.betweenTramAndSea) {
    lines.push("✅ Tramvay ile deniz arasında");
  }

  if (detail.transport.length > 0) {
    lines.push(`🚏 Ulaşım: ${escapeHtml(detail.transport.join(", "))}`);
  }

  return lines;
}

/** Telegram caption sinirina sigmasi icin sondan satir atarak kirpar. */
function fitToCaption(lines: string[]): string {
  const rendered = lines.join("\n");
  if (rendered.length <= TELEGRAM_CAPTION_LIMIT) return rendered;

  const kept = [...lines];
  while (kept.length > 1 && kept.join("\n").length > TELEGRAM_CAPTION_LIMIT) {
    kept.pop();
  }
  return kept.join("\n");
}

export function buildMessage(notification: Notification, now = new Date()): string {
  const { scored } = notification;
  const { listing } = scored;

  const lines = [
    headerLine(notification),
    "",
    `<b>${escapeHtml(listing.title)}</b>`,
    "",
    priceLine(notification),
    sellerLine(scored),
    "",
    propertyLine(scored),
  ];

  const features = featureLine(scored);
  if (features) lines.push(features);

  lines.push("", ...locationLines(scored));

  if (scored.nearReasons.length > 0) {
    lines.push("", `🟡 ${scored.nearReasons.map(escapeHtml).join(" · ")}`);
  }
  for (const warning of scored.warnings) {
    lines.push(`⚠️ ${escapeHtml(warning)}`);
  }

  const posted = formatPostedAt(listing.postedAt, now);
  if (posted) lines.push("", `📅 İlan tarihi: ${posted}`);

  if (scored.breakdown.length > 0) {
    const top = scored.breakdown
      .slice()
      .sort((a, b) => b.points - a.points)
      .slice(0, 3)
      .map((item) => `${escapeHtml(item.label)} +${item.points}`);
    lines.push(`⭐ Puan: ${top.join(" · ")}`);
  }

  return fitToCaption(lines);
}

/** Ozet listesinde basliklarin satiri tasirmamasi icin ust sinir. */
const SUMMARY_TITLE_LIMIT = 70;

/** Son parcanin sonuna eklenen "… ve N ilan daha" notu icin ayrilan yer. */
const SUMMARY_FOOTER_RESERVE = 200;

function summaryLine(notification: Notification): string {
  const { listing, score, match } = notification.scored;
  const badge = listing.isOwner ? "👤" : "🏢";
  const level = match === "exact" ? "🎯" : "🟡";
  const title =
    listing.title.length > SUMMARY_TITLE_LIMIT
      ? `${listing.title.slice(0, SUMMARY_TITLE_LIMIT - 1)}…`
      : listing.title;

  return (
    `${badge}${level} <a href="${listing.url}">${escapeHtml(title)}</a> — ` +
    `<b>${formatTl(listing.price)}</b> · ${escapeHtml(listing.rooms ?? "?")} · ⭐${score}`
  );
}

/**
 * MAX_MESSAGES_PER_RUN asildiginda gonderilen toplu ozet.
 *
 * Telegram tek mesajda TELEGRAM_MESSAGE_LIMIT karakteri asamaz, bu yuzden
 * cikti parcalara bolunur. Ilk kosuda yuzlerce ilan eslesebilecegi icin
 * parca sayisi da sinirlidir; kalanlar sayi olarak bildirilir.
 */
export function buildOverflowSummary(remaining: Notification[]): string[] {
  if (remaining.length === 0) return [];

  // Sondaki nota yer birakmak icin butce mesaj sinirinin bir miktar altinda.
  const budget = TELEGRAM_MESSAGE_LIMIT - SUMMARY_FOOTER_RESERVE;
  const messages: string[] = [];
  let current = [`📋 <b>${remaining.length} ilan daha</b> kriterlere uyuyor:`, ""];
  let listed = 0;

  for (const notification of remaining) {
    const line = summaryLine(notification);

    if ([...current, line].join("\n").length > budget) {
      messages.push(current.join("\n"));
      if (messages.length >= MAX_OVERFLOW_MESSAGES) break;
      current = [];
    }

    current.push(line);
    listed++;
  }

  if (messages.length < MAX_OVERFLOW_MESSAGES && current.length > 0) {
    messages.push(current.join("\n"));
  }

  const hidden = remaining.length - listed;
  if (hidden > 0) {
    const last = messages.length - 1;
    messages[last] +=
      `\n\n… ve <b>${hidden} ilan daha</b>. Hepsi kaydedildi; ` +
      "bundan sonra sadece yeni çıkanlar ve fiyatı düşenler bildirilecek.";
  }

  return messages;
}
