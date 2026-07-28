/**
 * Gorulen ilanlarin kalici kaydi. GitHub Actions her kosuda bu dosyayi repoya
 * geri commit eder; boylece ayni ilan icin ikinci kez bildirim gitmez.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { STATE_VERSION } from "./config.ts";
import type { Notification, ScoredListing, State, StateEntry } from "./types.ts";

const ROOT_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
export const STATE_PATH = join(ROOT_DIR, "state", "seen.json");

export function emptyState(): State {
  return { version: STATE_VERSION, updatedAt: new Date().toISOString(), listings: {} };
}

/** Dosya yoksa bos durum doner. Bozuksa hata firlatir - sessizce sifirlamak veri kaybi olur. */
export function loadState(path = STATE_PATH): State {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyState();
    throw error;
  }

  const parsed = JSON.parse(raw) as State;
  if (parsed.version !== STATE_VERSION) {
    throw new Error(
      `state surumu uyusmuyor: dosya ${parsed.version}, beklenen ${STATE_VERSION}`,
    );
  }
  return parsed;
}

export function saveState(state: State, path = STATE_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2) + "\n");
}

/**
 * Kriterlere uyan ilanlari onceki durumla karsilastirir.
 * Yeni ilanlar ve fiyati dusenler bildirilir; degismeyenler sessiz gecer.
 */
export function diffAgainstState(scored: ScoredListing[], state: State): Notification[] {
  const notifications: Notification[] = [];

  for (const item of scored) {
    const previous = state.listings[item.listing.id];

    if (!previous) {
      notifications.push({ kind: "new", scored: item, previousPrice: null });
      continue;
    }
    if (item.listing.price < previous.price) {
      notifications.push({ kind: "price-drop", scored: item, previousPrice: previous.price });
    }
  }

  return notifications;
}

/**
 * Durumu bu kosunun sonuclariyla gunceller.
 *
 * Sadece kriterlere uyan ilanlar icin kayit tutulur; elenen ilanlar zaten her
 * kosuda ucuz filtreden geciyor, onlari saklamak dosyayi sisirir.
 *
 * Hicbir sey degismediyse mevcut durum oldugu gibi dondurulur - boylece dosya
 * bayt bayt ayni kalir ve GitHub Actions bos commit atmaz.
 */
export function updateState(state: State, scored: ScoredListing[], now = new Date()): State {
  const timestamp = now.toISOString();
  const listings: Record<string, StateEntry> = { ...state.listings };

  for (const item of scored) {
    const previous = listings[item.listing.id];
    listings[item.listing.id] = {
      price: item.listing.price,
      firstSeenAt: previous?.firstSeenAt ?? timestamp,
      detail: item.detail,
    };
  }

  if (JSON.stringify(listings) === JSON.stringify(state.listings)) return state;

  return { version: STATE_VERSION, updatedAt: timestamp, listings };
}
