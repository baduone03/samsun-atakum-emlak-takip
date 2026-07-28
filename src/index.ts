/**
 * Tarama girisi.
 *
 *   node src/index.ts            gercek tarama, Telegram'a gonderir
 *   node src/index.ts --dry-run  tarar ve konsola basar, mesaj gondermez
 */
import { MAX_DETAIL_FETCHES_PER_RUN, MAX_MESSAGES_PER_RUN } from "./config.ts";
import { EMPTY_DETAIL, hasDetail } from "./emlakjet/detailPage.ts";
import { evaluate, type FilterResult } from "./filter.ts";
import { buildMessage, buildOverflowSummary } from "./format.ts";
import { describeLocation } from "./geo.ts";
import { BlockedError } from "./http.ts";
import { scoreListing } from "./score.ts";
import { fetchDetail, scrapeListings } from "./scrape.ts";
import { diffAgainstState, loadState, saveState, updateState } from "./state.ts";
import {
  readCredentials,
  sendListing,
  sendText,
  telegramPause,
  type TelegramCredentials,
} from "./telegram.ts";
import type { Listing, Notification, ScoredListing, State } from "./types.ts";

// Yerel calistirmada .env dosyasini yukle; GitHub Actions'ta degerler zaten ortamda.
try {
  process.loadEnvFile();
} catch {
  // .env yok - sorun degil
}

const dryRun = process.argv.includes("--dry-run");

type Candidate = {
  listing: Listing;
  match: Exclude<FilterResult["level"], "reject">;
  result: FilterResult;
};

/**
 * Detay butcesi sinirli oldugu icin en umut verici ilanlar one alinir:
 * once sahibinden, sonra kesin eslesme, sonra en yeni ilan.
 */
function detailPriority({ listing, match }: Candidate): number {
  return (
    (listing.isOwner ? 4 : 0) +
    (match === "exact" ? 2 : 0) +
    (listing.postedAt ? Date.parse(listing.postedAt) / 1e13 : 0)
  );
}

function selectCandidates(listings: Listing[]): Candidate[] {
  const candidates: Candidate[] = [];

  for (const listing of listings) {
    const result = evaluate(listing);
    if (result.level === "reject") continue;
    candidates.push({ listing, match: result.level, result });
  }

  return candidates.sort((a, b) => detailPriority(b) - detailPriority(a));
}

/** Kriterlere uyan ilanlari detaylandirip skorlar. */
async function buildScoredListings(listings: Listing[], state: State): Promise<ScoredListing[]> {
  const candidates = selectCandidates(listings);
  const scored: ScoredListing[] = [];
  let detailFetches = 0;

  for (const { listing, match, result } of candidates) {
    // Detay sayfasi maliyetli: gercekten alinmis detay onbellekten okunur,
    // geri kalanlarda kosu basina istek sayisi sinirlanir. Butce dolduğunda
    // eksik kalanlar sonraki kosularda tamamlanir.
    const cached = state.listings[listing.id]?.detail;
    let detail = cached ?? EMPTY_DETAIL;

    if (!(cached && hasDetail(cached)) && detailFetches < MAX_DETAIL_FETCHES_PER_RUN) {
      detail = await fetchDetail(listing);
      detailFetches++;
    }

    const geo = detail.coordinates
      ? describeLocation(detail.coordinates, detail.coordinatesExact)
      : null;
    const { score, breakdown } = scoreListing(listing, geo, listing.floorText !== null);

    scored.push({
      listing,
      detail,
      geo,
      match,
      nearReasons: result.nearReasons,
      score,
      breakdown,
      warnings: result.warnings,
    });
  }

  return scored;
}

/** Kesin eslesmeler once, her grup kendi icinde skora gore. */
function sortNotifications(notifications: Notification[]): Notification[] {
  const rank = (notification: Notification) => (notification.scored.match === "exact" ? 0 : 1);
  return notifications
    .slice()
    .sort((a, b) => rank(a) - rank(b) || b.scored.score - a.scored.score);
}

async function deliver(
  credentials: TelegramCredentials,
  notifications: Notification[],
): Promise<void> {
  const detailed = notifications.slice(0, MAX_MESSAGES_PER_RUN);
  const overflow = notifications.slice(MAX_MESSAGES_PER_RUN);

  for (const notification of detailed) {
    await sendListing(credentials, notification, buildMessage(notification));
    await telegramPause();
  }

  for (const summary of buildOverflowSummary(overflow)) {
    await sendText(credentials, summary);
    await telegramPause();
  }
}

function printDryRun(notifications: Notification[]): void {
  console.log(`\n=== --dry-run: ${notifications.length} bildirim (gonderilmedi) ===\n`);
  for (const notification of notifications) {
    console.log(buildMessage(notification).replace(/<[^>]+>/g, ""));
    console.log(notification.scored.listing.url);
    console.log("-".repeat(60));
  }
}

async function main(): Promise<void> {
  // Kimlik bilgilerini basta dogrula - tarama bittikten sonra patlamasin.
  const credentials = dryRun ? null : readCredentials();

  console.log(`Tarama basliyor${dryRun ? " (dry-run)" : ""}...`);
  const listings = await scrapeListings();
  console.log(`Toplam ${listings.length} benzersiz ilan bulundu.`);

  if (listings.length === 0) {
    throw new Error("Hic ilan alinamadi - sayfa yapisi degismis olabilir.");
  }

  const state = loadState();
  const scored = await buildScoredListings(listings, state);
  console.log(`Kriterlere uyan: ${scored.length} ilan.`);

  const notifications = sortNotifications(diffAgainstState(scored, state));
  console.log(`Bildirilecek: ${notifications.length} ilan.`);

  if (dryRun) {
    printDryRun(notifications);
    return;
  }

  if (notifications.length > 0 && credentials) {
    await deliver(credentials, notifications);
  }

  saveState(updateState(state, scored));
  console.log("state/seen.json guncellendi.");
}

try {
  await main();
} catch (error) {
  const message = (error as Error).message;
  console.error(`HATA: ${message}`);

  // Bot korumasina takildiysak sessizce olmek yerine haber ver; state'e dokunma.
  if (error instanceof BlockedError && !dryRun) {
    try {
      await sendText(
        readCredentials(),
        `⚠️ <b>Tarama başarısız</b>\n\nEmlakjet isteği engelledi (HTTP ${error.status}).\n` +
          `Sunucu IP'si engellenmiş olabilir. Bir sonraki saatlik denemede tekrar denenecek.`,
      );
    } catch (notifyError) {
      console.error(`Uyari mesaji da gonderilemedi: ${(notifyError as Error).message}`);
    }
  }

  process.exitCode = 1;
}
