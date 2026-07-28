/**
 * Emlakjet icin HTTP katmani: gercekci tarayici basliklari, yeniden deneme ve
 * istekler arasi gecikme. Bot korumasina takilmamak icin tek noktadan yonetilir.
 */
import { REQUEST_DELAY_MS, REQUEST_RETRIES, REQUEST_TIMEOUT_MS } from "./config.ts";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
};

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Hedef sitenin istegi reddettigini (bot korumasi) belirtir. */
export class BlockedError extends Error {
  readonly status: number;

  constructor(status: number, url: string) {
    super(`Emlakjet istegi engelledi: HTTP ${status} - ${url}`);
    this.name = "BlockedError";
    this.status = status;
  }
}

const BLOCKING_STATUSES = new Set([401, 403, 407, 429, 451]);

let lastRequestAt = 0;

/** Ardisik istekler arasinda en az REQUEST_DELAY_MS bosluk birakir. */
async function throttle(): Promise<void> {
  const waitMs = lastRequestAt + REQUEST_DELAY_MS - Date.now();
  if (waitMs > 0) await sleep(waitMs);
  lastRequestAt = Date.now();
}

/**
 * Sayfa HTML'ini getirir.
 * @throws {BlockedError} bot korumasi devredeyse (yeniden denenmez, anlamsiz)
 * @throws {Error} diger tum hatalarda, REQUEST_RETRIES denemeden sonra
 */
export async function fetchHtml(url: string): Promise<string> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= REQUEST_RETRIES; attempt++) {
    await throttle();
    try {
      const response = await fetch(url, {
        headers: BROWSER_HEADERS,
        redirect: "follow",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (BLOCKING_STATUSES.has(response.status)) {
        throw new BlockedError(response.status, url);
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} - ${url}`);
      }
      return await response.text();
    } catch (error) {
      if (error instanceof BlockedError) throw error;
      lastError = error as Error;
      if (attempt < REQUEST_RETRIES) {
        await sleep(attempt * 2000);
      }
    }
  }

  throw new Error(`${REQUEST_RETRIES} denemede alinamadi: ${url} - ${lastError?.message}`);
}
