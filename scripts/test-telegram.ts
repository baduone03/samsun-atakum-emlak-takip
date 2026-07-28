/**
 * Telegram baglantisini ve mesaj bicimini dogrular.
 * Gercek bir ilan uydurmaz - ornek veriyle tam formatli bir mesaj gonderir.
 *
 *   npm run telegram:test
 */
import { buildMessage } from "../src/format.ts";
import { describeLocation } from "../src/geo.ts";
import { scoreListing } from "../src/score.ts";
import { readCredentials, sendListing, sendText } from "../src/telegram.ts";
import type { Listing, ListingDetail, Notification } from "../src/types.ts";

try {
  process.loadEnvFile();
} catch {
  // .env yok - degerler ortamdan gelecek
}

const credentials = readCredentials();

const listing: Listing = {
  id: "0",
  url: "https://www.emlakjet.com/",
  title: "ÖRNEK — Atakent'te Tramvaya Yakın Eşyalı 1+1 Daire",
  tradeType: "kiralik",
  price: 22_000,
  rooms: "1+1",
  areaSqm: 65,
  floorText: "3. Kat",
  locationText: "Atakent Mahallesi, Atakum",
  neighborhood: "Atakent Mahallesi",
  postedAt: new Date().toISOString().slice(0, 10),
  imageUrls: [],
  isOwner: true,
};

const detail: ListingDetail = {
  coordinates: { lat: 41.3438, lng: 36.2448 },
  coordinatesExact: true,
  address: "Atakum - Atakent Mahallesi",
  specs: {
    "Isıtma Tipi": "Kombi Doğalgaz",
    "Eşya Durumu": "Eşyalı",
    "Banyo Sayısı": "1",
    "Kat Sayısı": "6",
    "Bina Yaşı": "5-10",
    Asansör: "Var",
    Balkon: "Var",
  },
  transport: ["Tramvay", "Anayol", "Dolmuş"],
};

const geo = describeLocation(detail.coordinates!, detail.coordinatesExact);
const { score, breakdown } = scoreListing(listing, geo, true);

const notification: Notification = {
  kind: "new",
  scored: {
    listing,
    detail,
    geo,
    match: "exact",
    nearReasons: [],
    score,
    breakdown,
    warnings: [],
  },
  previousPrice: null,
};

await sendText(
  credentials,
  "🧪 <b>Test mesajı</b> — Samsun Atakum emlak takip sistemi bağlantısı çalışıyor.\n" +
    "Aşağıda örnek bir ilan bildirimi görüyorsun:",
);
await sendListing(credentials, notification, buildMessage(notification));

console.log("Test mesajlari gonderildi. Telegram'i kontrol et.");
