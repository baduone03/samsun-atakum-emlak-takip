import { afterEach, test } from "node:test";
import assert from "node:assert/strict";

import { sendListing, TelegramError } from "../src/telegram.ts";
import { makeDetail, makeListing } from "./helpers.ts";
import type { Notification } from "../src/types.ts";

const credentials = { botToken: "TOKEN", chatId: "42" };
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function makeNotification(imageUrls: string[]): Notification {
  return {
    kind: "new",
    previousPrice: null,
    scored: {
      listing: makeListing({ imageUrls }),
      detail: makeDetail(),
      geo: null,
      match: "exact",
      nearReasons: [],
      score: 50,
      breakdown: [],
      warnings: [],
    },
  } as Notification;
}

/** Her cagrida sirayla verilen yaniti donen sahte fetch; cagrilan metodlari kaydeder. */
function mockFetch(responses: Array<{ status: number; body: string }>): string[] {
  const methods: string[] = [];
  globalThis.fetch = (async (url: string | URL) => {
    methods.push(String(url).split("/").pop()!);
    const next = responses.shift()!;
    return new Response(next.body, { status: next.status });
  }) as typeof fetch;
  return methods;
}

test("gorsel Telegram'a indirilemezse ilan metin olarak gonderilir", async () => {
  const methods = mockFetch([
    {
      status: 400,
      body: '{"ok":false,"error_code":400,"description":"Bad Request: failed to get HTTP URL content"}',
    },
    { status: 200, body: '{"ok":true}' },
  ]);

  await sendListing(credentials, makeNotification(["https://img.example/1.jpg"]), "caption");

  assert.deepEqual(methods, ["sendPhoto", "sendMessage"]);
});

test("gorsel yoksa dogrudan metin gonderilir", async () => {
  const methods = mockFetch([{ status: 200, body: '{"ok":true}' }]);

  await sendListing(credentials, makeNotification([]), "caption");

  assert.deepEqual(methods, ["sendMessage"]);
});

test("400 disindaki Telegram hatalari yutulmaz", async () => {
  const methods = mockFetch([{ status: 401, body: '{"ok":false,"error_code":401}' }]);

  await assert.rejects(
    sendListing(credentials, makeNotification(["https://img.example/1.jpg"]), "caption"),
    (error) => error instanceof TelegramError && error.status === 401,
  );
  assert.deepEqual(methods, ["sendPhoto"]);
});
