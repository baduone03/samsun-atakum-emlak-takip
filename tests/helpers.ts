import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import type { Listing, ListingDetail } from "../src/types.ts";

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

export const readFixture = (name: string): string =>
  readFileSync(join(FIXTURE_DIR, name), "utf8");

/** Testlerde tek tek alan degistirmek icin makul varsayilanlara sahip ilan. */
export function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: "1",
    url: "https://www.emlakjet.com/ilan/ornek-1",
    title: "Örnek ilan",
    tradeType: "kiralik",
    price: 20_000,
    rooms: "1+1",
    areaSqm: 60,
    floorText: "3. Kat",
    locationText: "Atakent Mahallesi, Atakum",
    neighborhood: "Atakent Mahallesi",
    postedAt: "2026-07-27",
    imageUrls: [],
    isOwner: false,
    ...overrides,
  };
}

export function makeDetail(overrides: Partial<ListingDetail> = {}): ListingDetail {
  return {
    coordinates: null,
    coordinatesExact: false,
    address: null,
    specs: {},
    transport: [],
    ...overrides,
  };
}
