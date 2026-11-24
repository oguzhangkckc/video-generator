// Credits: a per-sentence cache shared by every video, each video's ledger of characters spent, and the check run
// before any request goes out (what is cached, what the rest would bill, what the account and the budget allow).
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ROOT, outDir } from "../video.mjs";

export const cacheDir = (provider) => path.join(ROOT, "out", "tts-cache", provider.id);

/** What a take's sound depends on (provider.key leaves the context text out, so neighbours stay cached). */
export const cacheKey = (provider, request) =>
  createHash("sha1").update(JSON.stringify({ provider: provider.id, ...provider.key(request) })).digest("hex");

export const isCached = (provider, request) => existsSync(path.join(cacheDir(provider), `${cacheKey(provider, request)}.json`));

/** Requests not cached yet (each once) and the characters they would bill. */
export const estimate = (provider, requests) => {
  const seen = new Set();
  const todo = requests.filter((r) => {
    const key = cacheKey(provider, r);
    if (seen.has(key) || isCached(provider, r)) return false;
    seen.add(key);
    return true;
  });
  return { todo, chars: todo.reduce((n, r) => n + provider.cost(r), 0) };
};

/** Why a batch may not go ahead, or null: first what is left on the account, then the video's budget. */
export const overspend = ({ chars, remaining, spent, budget }) => {
  if (remaining !== undefined && chars > remaining) return `hesapta ${remaining} karakter kaldı, bu iş ${chars} karakter istiyor`;
  if (budget !== undefined && spent + chars > budget) return `bütçe aşılıyor: bu video ${spent} karakter harcadı, +${chars} → ${spent + chars} (bütçe ${budget})`;
  return null;
};

const ledgerFile = (slug) => path.join(outDir(slug), "tts-ledger.json");

/** Characters this video has cost so far, with one row per billed request. */
export const readLedger = (slug) => (existsSync(ledgerFile(slug)) ? JSON.parse(readFileSync(ledgerFile(slug), "utf8")) : { spent: 0, rows: [] });

export const record = (slug, provider, chars, text) => {
  if (!chars) return;
  const ledger = readLedger(slug);
  ledger.spent += chars;
  ledger.rows.push({ at: new Date().toISOString(), provider: provider.id, chars, text: text.slice(0, 80) });
  mkdirSync(outDir(slug), { recursive: true });
  writeFileSync(ledgerFile(slug), `${JSON.stringify(ledger, null, 2)}\n`);
};
