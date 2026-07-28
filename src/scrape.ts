/**
 * Emlakjet tarama akisi: liste sayfalarini gezer, ilanlari toplar ve
 * gerektiginde detay sayfasindan zenginlestirir.
 */
import { EMLAKJET_BASE_URL, LIST_PAGE_SIZE, MAX_PAGES_PER_URL } from "./config.ts";
import { buildListSources, withPage } from "./emlakjet/urls.ts";
import { parseListPage } from "./emlakjet/listPage.ts";
import { EMPTY_DETAIL, parseDetailPage } from "./emlakjet/detailPage.ts";
import { BlockedError, fetchHtml } from "./http.ts";
import type { Listing, ListingDetail } from "./types.ts";

/** Bir liste URL'inin tum sayfalarini gezer. Yeni ilan gelmeyince durur. */
async function collectFromSource(
  baseUrl: string,
  tradeType: Listing["tradeType"],
  ownerOnly: boolean,
): Promise<Listing[]> {
  const collected: Listing[] = [];
  const seenIds = new Set<string>();

  for (let page = 1; page <= MAX_PAGES_PER_URL; page++) {
    const html = await fetchHtml(withPage(baseUrl, page));
    const listings = parseListPage(html, tradeType, ownerOnly);

    const fresh = listings.filter((listing) => !seenIds.has(listing.id));
    if (fresh.length === 0) break;

    for (const listing of fresh) {
      seenIds.add(listing.id);
      collected.push(listing);
    }

    // Sayfa dolmadiysa son sayfadayiz.
    if (listings.length < LIST_PAGE_SIZE) break;
  }

  return collected;
}

/**
 * Tum liste kaynaklarini tarar.
 *
 * Ayni ilan hem genel hem "sahibinden" listesinde cikabilir; sahibinden
 * listesinden gelen isaret korunur (emlakci olmadigini gosterir).
 */
export async function scrapeListings(): Promise<Listing[]> {
  const byId = new Map<string, Listing>();

  for (const source of buildListSources()) {
    const listings = await collectFromSource(source.url, source.tradeType, source.ownerOnly);
    console.log(
      `  ${listings.length.toString().padStart(4)} ilan · ${source.url.replace(EMLAKJET_BASE_URL, "")}`,
    );

    for (const listing of listings) {
      const existing = byId.get(listing.id);
      byId.set(listing.id, {
        ...listing,
        isOwner: listing.isOwner || (existing?.isOwner ?? false),
      });
    }
  }

  return [...byId.values()];
}

/**
 * Detay sayfasini ceker. Tek bir ilanin detayi alinamazsa tarama durmaz;
 * ilan koordinatsiz devam eder ve mesafeler "hesaplanamadi" olarak gosterilir.
 */
export async function fetchDetail(listing: Listing): Promise<ListingDetail> {
  try {
    return parseDetailPage(await fetchHtml(listing.url));
  } catch (error) {
    // Bot korumasi devredeyse bunu yutmak yanlis olur - tarama iptal edilmeli.
    if (error instanceof BlockedError) throw error;
    console.warn(`  detay alinamadi (${listing.id}): ${(error as Error).message}`);
    return EMPTY_DETAIL;
  }
}
