/**
 * Telegram Bot API istemcisi. Gorsel varsa sendPhoto + caption, yoksa sendMessage.
 * Telegram gorsel URL'ini kendisi cekemezse gorsel indirilip dosya olarak yuklenir;
 * o da olmazsa ilan gorselsiz metin olarak gider. Tek bir gorsel taramayi durdurmaz.
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

const IMAGE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
  Referer: "https://www.emlakjet.com/",
};

/** Telegram'in sendPhoto ile kabul ettigi en buyuk dosya boyutu. */
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

async function callApi(
  credentials: TelegramCredentials,
  method: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await postApi(credentials, method, {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: credentials.chatId, ...payload }),
  });
}

async function postApi(
  credentials: TelegramCredentials,
  method: string,
  init: { headers?: Record<string, string>; body: string | FormData },
): Promise<void> {
  const response = await fetch(`${API_BASE}/bot${credentials.botToken}/${method}`, {
    method: "POST",
    ...init,
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

/** Gorseli kendimiz indirir; Telegram'in URL'den cekemedigi durumlar icin. */
async function downloadImage(url: string): Promise<Blob> {
  const response = await fetch(url, {
    headers: IMAGE_HEADERS,
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Gorsel indirilemedi: HTTP ${response.status} - ${url}`);

  const type = response.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) throw new Error(`Gorsel degil (${type || "tip yok"}) - ${url}`);

  const blob = await response.blob();
  if (blob.size === 0 || blob.size > MAX_PHOTO_BYTES) {
    throw new Error(`Gorsel boyutu uygun degil (${blob.size} bayt) - ${url}`);
  }
  return blob;
}

async function sendPhotoUpload(
  credentials: TelegramCredentials,
  photoUrl: string,
  caption: string,
  replyMarkup: unknown,
): Promise<void> {
  const image = await downloadImage(photoUrl);
  const extension = image.type.split("/")[1]?.replace("jpeg", "jpg") || "jpg";

  const form = new FormData();
  form.append("chat_id", credentials.chatId);
  form.append("photo", image, `ilan.${extension}`);
  form.append("caption", caption);
  form.append("parse_mode", "HTML");
  form.append("reply_markup", JSON.stringify(replyMarkup));

  await postApi(credentials, "sendPhoto", { body: form });
}

/**
 * Ilan bildirimi gonderir: gorsel varsa fotografli, yoksa metin olarak.
 * Gorsel adimlari basarisiz olursa metne duser; boylece ilan yine iletilir.
 */
export async function sendListing(
  credentials: TelegramCredentials,
  notification: Notification,
  caption: string,
): Promise<void> {
  const photo = notification.scored.listing.imageUrls[0];
  const reply_markup = { inline_keyboard: buildButtons(notification) };

  if (photo) {
    try {
      await callApi(credentials, "sendPhoto", {
        photo,
        caption,
        parse_mode: "HTML",
        reply_markup,
      });
      return;
    } catch (urlError) {
      console.warn(`sendPhoto (URL) basarisiz, gorsel yukleniyor: ${(urlError as Error).message}`);
    }

    try {
      await sendPhotoUpload(credentials, photo, caption, reply_markup);
      return;
    } catch (uploadError) {
      console.warn(`sendPhoto (yukleme) basarisiz, metne dusuluyor: ${(uploadError as Error).message}`);
    }
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
