export type TradeType = "kiralik" | "satilik";

export type MatchLevel = "exact" | "near" | "reject";

export type Coordinates = {
  lat: number;
  lng: number;
};

export type TramStation = Coordinates & {
  name: string;
};

/** Liste sayfasindaki ld+json blogundan cikarilan ham ilan. */
export type Listing = {
  /** URL sonundaki emlakjet ilan numarasi - kalici kimlik. */
  id: string;
  url: string;
  title: string;
  tradeType: TradeType;
  price: number;
  /** "1+1", "2+1", "3+1"... ld+json'da yoksa null. */
  rooms: string | null;
  /** Brut metrekare. Ayristirilamazsa null. */
  areaSqm: number | null;
  /** Ham kat metni: "3. Kat", "Zemin Kat", "Ara Kat"... yoksa null. */
  floorText: string | null;
  /** "Atakent Mahallesi, Atakum" gibi ham konum metni. */
  locationText: string | null;
  neighborhood: string | null;
  /** ISO tarih (YYYY-MM-DD) veya null. */
  postedAt: string | null;
  imageUrls: string[];
  /** Emlakjet'in /sahibinden filtresinde gorundu mu. */
  isOwner: boolean;
};

/** Detay sayfasindan gelen ek bilgiler. Detay cekilemezse alanlar bos kalir. */
export type ListingDetail = {
  coordinates: Coordinates | null;
  /**
   * emlakjet `displaySettings.showOnMap` degeri. false ise koordinat mahalle
   * merkezi olabilir - mesafeler "yaklasik" olarak gosterilir.
   */
  coordinatesExact: boolean;
  address: string | null;
  /**
   * Detay sayfasindaki etiket/deger tablosu, oldugu gibi:
   * "Isıtma Tipi" -> "Kombi Doğalgaz", "Bina Yaşı" -> "11-15", "Asansör" -> "Var" ...
   */
  specs: Record<string, string>;
  /** Konum Ozellikleri > Ulasim listesi: "Tramvay", "Anayol", "Dolmuş" ... */
  transport: string[];
};

export type GeoInfo = {
  nearestStation: TramStation;
  stationDistanceM: number;
  stationWalkMinutes: number;
  coastDistanceM: number;
  coastWalkMinutes: number;
  /** Ilan, en yakin duragin deniz tarafinda mi. */
  betweenTramAndSea: boolean;
  /** Koordinat kesin degilse mesafeler yaklasik gosterilir. */
  approximate: boolean;
};

export type ScoreBreakdown = {
  label: string;
  points: number;
};

export type ScoredListing = {
  listing: Listing;
  detail: ListingDetail;
  geo: GeoInfo | null;
  match: Exclude<MatchLevel, "reject">;
  /** "near" ise bunun sebebi; "exact" ise bos. */
  nearReasons: string[];
  score: number;
  breakdown: ScoreBreakdown[];
  /** Kat bilgisi eksik gibi kullaniciya gosterilecek uyarilar. */
  warnings: string[];
};

/** state/seen.json icinde ilan basina tutulan kayit. */
export type StateEntry = {
  price: number;
  firstSeenAt: string;
  lastSeenAt: string;
  /** Detay sayfasi tekrar tekrar cekilmesin diye onbellek. */
  detail: ListingDetail;
};

export type State = {
  version: number;
  updatedAt: string;
  listings: Record<string, StateEntry>;
};

export type NotificationKind = "new" | "price-drop";

export type Notification = {
  kind: NotificationKind;
  scored: ScoredListing;
  /** Sadece price-drop icin dolu. */
  previousPrice: number | null;
};
