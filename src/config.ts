/**
 * Arama kriterlerinin tek kaynagi. Kriter degisikligi burada yapilir,
 * kodun baska hicbir yerinde esik/sabit hardcode edilmez.
 */
import type { TradeType } from "./types.ts";

export const SEARCH_AREAS = [
  { slug: "samsun-atakum-atakent-mahallesi", name: "Atakent Mahallesi" },
  { slug: "samsun-atakum-korfez-mahallesi", name: "Körfez Mahallesi" },
] as const;

export const TRADE_TYPES: TradeType[] = ["kiralik", "satilik"];

/** Kesin eslesme icin ust fiyat sinirlari (TL). */
export const PRICE_LIMITS: Record<TradeType, number> = {
  kiralik: 25_000,
  satilik: 2_200_000,
};

/** Yakin eslesme, ust siniri bu orana kadar asabilir. */
export const NEAR_MATCH_PRICE_TOLERANCE = 0.1;

/** Kesin eslesme icin kabul edilen oda sayilari. */
export const EXACT_ROOM_TYPES = ["1+1", "2+1"];

/** Kesin degil ama yine de haber verilecek oda sayilari. */
export const NEAR_ROOM_TYPES = ["3+1"];

/**
 * Aranan oda tipleri ve emlakjet URL filtresindeki karsiliklari.
 *
 * Mahalleler cok yogun (tek mahallede 900+ ilan); filtresiz tarama sayfa
 * limitine takilip sonuclari kesiyordu. Oda tipi basina ayri tarama yapinca
 * kapsama tam oluyor ve istek sayisi da dusuyor.
 */
export const ROOM_FILTERS: Record<string, string> = {
  "1+1": "1-1",
  "2+1": "2-1",
  "3+1": "3-1",
};

/**
 * Giris/zemin katlari eleyen desen. Kullanici acikca "giris kat ya da zemin kat
 * olmayacak" dedi; "Bahce Kati", "Kot 1", "Yuksek Giris" de fiilen giris kattir.
 */
export const GROUND_FLOOR_PATTERN =
  /zemin|giri[sş]|bodrum|bah[çc]e\s*kat|kot\s*-?\d|yar[ıi]\s*bodrum|teras\s*kat[ıi]?\s*giri[sş]/i;

/** Yurume hizi ve dolambac payi - kus ucusu mesafeyi dakikaya cevirmek icin. */
export const WALKING_SPEED_M_PER_MIN = 80;
export const WALKING_DETOUR_FACTOR = 1.3;

/**
 * Tramvay esikleri yurume dakikasi cinsinden - kullanicinin istegi
 * "10 dk, azami 15 dk yurume mesafesi" seklindeydi.
 */
export const TRAM_NEAR_MINUTES = 10;
export const TRAM_OK_MINUTES = 15;

/** Sahil esikleri (yurume dakikasi). */
export const COAST_NEAR_MINUTES = 8;
export const COAST_OK_MINUTES = 15;

export const SCORE_WEIGHTS = {
  owner: 25,
  tramNear: 20,
  tramOk: 10,
  coastNear: 15,
  coastOk: 8,
  betweenTramAndSea: 20,
  wellUnderBudget: 10,
  floorKnown: 5,
  freshListing: 5,
} as const;

/** Fiyat, sinirin bu oraninin altindaysa bonus verilir. */
export const WELL_UNDER_BUDGET_RATIO = 0.85;

/** Ilan bu gun sayisindan yeniyse bonus verilir. */
export const FRESH_LISTING_DAYS = 3;

/** Koordinat kesin degilse mesafeye dayali puanlar bu oranla carpilir. */
export const APPROXIMATE_COORD_SCORE_FACTOR = 0.5;

export const MAX_SCORE = 100;

// --- Kazima ayarlari ---

export const EMLAKJET_BASE_URL = "https://www.emlakjet.com";

/** Bir liste URL'i icin taranacak en fazla sayfa sayisi (gozlemlenen en derin liste: 18). */
export const MAX_PAGES_PER_URL = 25;

/** Emlakjet liste sayfasi basina ilan sayisi - bundan azi son sayfa demek. */
export const LIST_PAGE_SIZE = 30;

/**
 * Bir kosuda en fazla kac ilan icin detay sayfasi acilir.
 *
 * Detay sayfasi koordinat ve ozellik icin gerekli ama pahali. Ilk kosuda
 * yuzlerce ilan birden eslesebilir; hepsinin detayini cekmek hem uzun surer
 * hem de gereksiz yuk olur. Sinirin disinda kalanlar mesafesiz gosterilir ve
 * zaten ozet listesine duser. Sonraki kosularda yeni ilan sayisi az oldugu
 * icin bu sinira pratikte takilinmaz.
 */
export const MAX_DETAIL_FETCHES_PER_RUN = 40;

/** Emlakjet'e ardisik istekler arasinda beklenecek sure (ms). */
export const REQUEST_DELAY_MS = 1500;

export const REQUEST_TIMEOUT_MS = 30_000;
export const REQUEST_RETRIES = 3;

// --- Telegram ayarlari ---

/** Tek koşuda gonderilecek en fazla detayli mesaj; fazlasi ozet listeye duser. */
export const MAX_MESSAGES_PER_RUN = 15;

/** Telegram mesajlari arasinda beklenecek sure (ms) - rate limit icin. */
export const TELEGRAM_DELAY_MS = 1200;

/** sendPhoto caption sinirinin altinda guvenli kalmak icin. */
export const TELEGRAM_CAPTION_LIMIT = 1024;

/** sendMessage metin siniri. */
export const TELEGRAM_MESSAGE_LIMIT = 4096;

/**
 * Tasma ozeti icin en fazla mesaj sayisi. Ilk kosuda yuzlerce mevcut ilan
 * eslesebilir; hepsini tek tek gondermek yerine sinirli bir ozet verilir.
 */
export const MAX_OVERFLOW_MESSAGES = 3;

// --- Dosya yollari ---

export const STATE_VERSION = 1;
