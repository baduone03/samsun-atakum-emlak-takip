# Samsun Atakum Emlak Takip

Atakum'un **Atakent** ve **Körfez** mahallelerindeki kiralık/satılık daire ilanlarını saat başı
tarar, kriterlere uyanları **Telegram**'dan zengin bildirimle gönderir.

GitHub Actions üzerinde çalışır — bilgisayarın kapalıyken de tarama devam eder.

---

## Arama kriterleri

| Kriter | Değer |
|---|---|
| Mahalle | Atakent Mahallesi, Körfez Mahallesi (Atakum / Samsun) |
| Oda | `1+1`, `2+1` |
| Kiralık üst sınır | **25.000 TL** |
| Satılık üst sınır | **2.200.000 TL** |
| Kat | Giriş / zemin / bodrum / bahçe katı **hariç** |
| Tercih | Sahibinden ilanlar öne çıkar (emlakçı komisyonu yok) |
| Konum tercihi | Tramvay ile deniz arası; tramvaya 10–15 dk yürüme mesafesi |

**Yakın eşleşme** (`🟡` etiketiyle ayrı gösterilir): fiyatı üst sınırı en fazla %10 aşan
veya `3+1` olan ilanlar. Kat ve mahalle kuralları burada da geçerlidir.

Kriterleri değiştirmek için tek dosya: [src/config.ts](src/config.ts).

---

## Nasıl çalışıyor

```
emlakjet liste sayfaları (ld+json)
   ↓ ucuz eleme: fiyat / oda / kat / mahalle
detay sayfası (sadece yeni ilanlar için)
   ↓ koordinat + özellikler
geo.ts: en yakın tramvay durağı, sahil mesafesi, yürüme dakikası
   ↓
score.ts: 0-100 puan
   ↓
state/seen.json ile karşılaştır → yeni ilan / fiyat düşüşü
   ↓
Telegram
```

**Kaynak neden sadece emlakjet?** `sahibinden.com` (DataDome) ve `hepsiemlak.com` (Cloudflare)
otomatik istekleri **HTTP 403** ile reddediyor. emlakjet hem erişilebilir hem de sayfalarında
`ld+json` yapısal verisi sunuyor — CSS seçici kırılganlığı olmadan okunuyor. emlakjet'in kendi
`/sahibinden` filtresi sayesinde emlakçı olmayan ilanlar da ayırt edilebiliyor.

**Konum verisi** OpenStreetMap'ten bir kez çekilip repoya işlendi
([data/tram-stations.json](data/tram-stations.json), [data/coastline.json](data/coastline.json))
— tarama sırasında dış servise istek atılmaz. Yenilemek için `npm run geo`.

> emlakjet, ilan sahibi haritayı gizlediğinde koordinat olarak mahalle merkezini döndürüyor.
> Bu durumda mesafeler **"~yaklaşık, harita gizli"** etiketiyle gösterilir ve mesafeye dayalı
> puanlar yarıya indirilir.

---

## Kurulum

### 1. Telegram

@BotFather'dan bot oluştur, token'ı al. Chat id için bota bir mesaj at ve şu adresi aç:
`https://api.telegram.org/bot<TOKEN>/getUpdates` → `result[0].message.chat.id`

### 2. GitHub secrets

```bash
gh secret set TELEGRAM_BOT_TOKEN
gh secret set TELEGRAM_CHAT_ID
```

### 3. İlk çalıştırma

Önce Telegram'a mesaj göndermeden dene:

```bash
gh workflow run scan.yml -f dry_run=true
gh run watch
```

Sonra gerçeğini çalıştır (ilk koşu mevcut ilanları gönderir):

```bash
gh workflow run scan.yml
gh run watch
```

Bundan sonra saat başı kendiliğinden çalışır.

### Yerel geliştirme

```bash
npm install
cp .env.example .env      # token'ları doldur (.env asla commit edilmez)

npm run scan:dry          # gerçek tarama, Telegram'a göndermez
npm run telegram:test     # örnek bildirim gönder, formatı gör
npm test                  # 53 test
npm run typecheck
```

Node **24+** gerekli — `.ts` dosyaları derlenmeden çalışır, runtime bağımlılığı yoktur.

---

## Bildirim türleri

| Etiket | Ne zaman |
|---|---|
| `🆕 YENİ İLAN` | İlan ilk kez görüldüğünde |
| `📉 FİYAT DÜŞTÜ` | Daha önce görülen ilanın fiyatı düştüğünde |
| `🎯 KESİN EŞLEŞME` | Tüm kriterlere uyuyor |
| `🟡 YAKIN EŞLEŞME` | Bütçeyi %10'a kadar aşıyor veya 3+1 |
| `⚠️` | Kat bilgisi ilanda belirtilmemiş |

**İlk koşuda** o an kriterlere uyan tüm mevcut ilanlar (şu anda ~470 tane) "yeni" sayılır.
En yüksek puanlı 15 tanesi detaylı mesaj olarak, kalanı en fazla 3 özet mesajında gelir; geri kalanı
sessizce kaydedilir. Sonraki koşularda sadece gerçekten yeni çıkan ve fiyatı düşen ilanlar bildirilir.

Fiyat artışları bildirilmez.

---

## İşleyiş notları

- **Cron**: saat başı (`:17` UTC). Değiştirmek için
  [.github/workflows/scan.yml](.github/workflows/scan.yml). Private repo Actions kotası 2000 dk/ay;
  saatlik tarama ~720–900 dk/ay tutar. Kısmak için cron'u `17 6-23 * * *` yapabilirsin.
- **Durum**: `state/seen.json` her koşuda `github-actions[bot]` tarafından repoya geri commit edilir.
  Aynı ilan için ikinci kez bildirim gitmemesini bu dosya sağlar.
- **Engellenme**: emlakjet, GitHub Actions runner IP'lerini engellemiyor — bulutta çalıştırılan
  dry-run taraması yereldekiyle birebir aynı sonucu verdi (1117 ilan, 2 dk 30 sn). İleride
  engellenirse `state` dosyasına dokunulmaz, Telegram'a uyarı mesajı gider ve iş kırmızı biter;
  bir sonraki saatlik koşuda tekrar denenir.
- **İstek yükü**: 24 liste URL'i (2 işlem türü × 2 mahalle × 3 oda tipi × sahibinden varyantı)
  + sayfalama ≈ 55 istek, aralarında 1,5 sn. Detay sayfası yalnızca daha önce görülmemiş ilanlar
  için ve koşu başına en fazla 40 tane çekilir; ilk koşudan sonra bu sayı sıfıra yaklaşır.
- **Neden oda filtresi**: Körfez Mahallesi'nde tek başına 900'den fazla satılık daire ilanı var.
  Filtresiz tarama sayfa limitine takılıp sonuçları kesiyordu. `?filtreler=oda-sayisi=1-1` gibi
  oda bazlı tarama hem tam kapsama veriyor hem de daha az istek atıyor
  (1117 ilan görülüyor, filtresiz taramada 499'da kalıyordu).

## Bilinen sınırlar

- `sahibinden.com` ve `hepsiemlak.com` kapsam dışı (bot koruması). Sadece emlakjet'te yayınlanan
  ilanlar yakalanır.
- Emlakjet detay sayfasının HTML tablosu değişirse ısıtma/asansör gibi **ek özellikler** boş kalır;
  filtreleme bundan etkilenmez (liste sayfası `ld+json`'ına dayanır), bildirim sadeleşir.
- "Tramvay ile deniz arasında" testi Atakum'un coğrafyasına özeldir (deniz kuzeyde, hat kıyıya
  paralel): ilan en yakın durağın kuzeyindeyse arada sayılır.
