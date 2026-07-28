/**
 * Telegram Bot API istemcisi. Gorsel varsa sendPhoto + caption, yoksa sendMessage.
 * Her ilanin altina "İlana Git" ve "Haritada Gör" butonlari eklenir.
 */
import { TELEGRAM_DELAY_MS } from "./config.ts";
import { sleep } from "./http.ts";
import { mapsUrl } from "./format.ts";
import type { Notification } from "./types.ts";

const API_BASE = "https://api.telegram.org";

export type TelegramCredentials = {
  botToken: string;
  chatId: string;
};

type InlineButton = { text: string; url: string };

/** Ortam degiskenlerinden kimlik bilgilerini okur. */
export function readCredentials(env: NodeJS.ProcessEnv = process.env): TelegramCredentials {
  const botToken = env["TELEGRAM_BOT_TOKEN"]?.trim();
  const chatId = env["TELEGRAM_CHAT_ID"]?.trim();

  if (!botToken || !chatId) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN ve TELEGRAM_CHAT_ID tanimli degil. " +
        "Yerelde .env dosyasina, GitHub'da repository secrets'a ekle.",
    );
  }
  return { botToken, chatId };
}

async function callApi(
  credentials: TelegramCredentials,
  method: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const response = await fetch(`${API_BASE}/bot${credentials.botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: credentials.chatId, ...payload }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    // Yanit govdesinde token yok; guvenle loglanabilir.
    const detail = await response.text().catch(() => "");
    throw new Error(`Telegram ${method} basarisiz: HTTP ${response.status} ${detail.slice(0, 300)}`);
  }
}

function buildButtons(notification: Notification): InlineButton[][] {
  const { listing, detail } = notification.scored;
  const row: InlineButton[] = [{ text: "🔗 İlana Git", url: listing.url }];

  if (detail.coordinates) {
    row.push({
      text: "🗺 Haritada Gör",
      url: mapsUrl(detail.coordinates.lat, detail.coordinates.lng),
    });
  }

  return [row];
}

/** Duz metin mesaji gonderir (ozet, uyari, test mesajlari icin). */
export async function sendText(
  credentials: TelegramCredentials,
  text: string,
): Promise<void> {
  await callApi(credentials, "sendMessage", {
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
  });
}

/** Ilan bildirimi gonderir: gorsel varsa fotografli, yoksa metin olarak. */
export async function sendListing(
  credentials: TelegramCredentials,
  notification: Notification,
  caption: string,
): Promise<void> {
  const photo = notification.scored.listing.imageUrls[0];
  const reply_markup = { inline_keyboard: buildButtons(notification) };

  if (photo) {
    await callApi(credentials, "sendPhoto", {
      photo,
      caption,
      parse_mode: "HTML",
      reply_markup,
    });
    return;
  }

  await callApi(credentials, "sendMessage", {
    text: caption,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup,
  });
}

/** Telegram rate limitine takilmamak icin mesajlar arasi bekleme. */
export const telegramPause = () => sleep(TELEGRAM_DELAY_MS);
