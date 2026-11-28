import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { formatDuration, missingFix, nextRound, renderLog, saidDrops, summary, verdict } from "../lib/runlog.mjs";
import { ROOT, isPlaceholderVoice, renderFile } from "../lib/video.mjs";

const rounds = (...errors) => errors.map((e) => ({ errors: e }));
const states = (...errors) => errors.map((_, i) => verdict(rounds(...errors.slice(0, i + 1))).state);

test("a loop stops when two rounds in a row bring no fewer errors", () => {
  assert.deepEqual(states(3, 3, 4), ["devam", "devam", "dur"]);
  assert.equal(verdict(rounds(3, 3, 4)).why, "hata sayısı iki tur üst üste azalmadı");
  assert.deepEqual(states(3, 2, 2, 1), ["devam", "devam", "devam", "devam"]);
});

test("a loop is clean at zero errors and stops when five rounds do not get there", () => {
  assert.deepEqual(states(5, 3, 1, 0), ["devam", "devam", "devam", "temiz"]);
  assert.deepEqual(states(9, 8, 7, 6, 5), ["devam", "devam", "devam", "devam", "dur"]);
  assert.equal(verdict(rounds(9, 8, 7, 6, 5)).why, "5 turda sıfıra inmedi");
  assert.equal(verdict(rounds(9, 8, 7, 6, 0)).state, "temiz");
});

test("check stops at its first error: a fixed previous error is progress at the same count", () => {
  const fixed = [{ errors: 1 }, { errors: 1, fixed: true }, { errors: 1, fixed: true }];
  assert.equal(verdict(fixed).state, "devam");
  assert.equal(verdict([{ errors: 1 }, { errors: 1 }, { errors: 1 }]).state, "dur");
});

const at = (min) => new Date(Date.UTC(2026, 10, 27, 10, min)).toISOString();

test("rounds number within a gate's loop; a finished loop starts the next one at 1", () => {
  const events = [];
  const add = (e, min) => events.push({ at: at(min), ...e });
  add(nextRound(events, { gate: "qa-layout", errors: 4 }), 0);
  add(nextRound(events, { gate: "check", errors: 1 }), 1);
  add(nextRound(events, { gate: "qa-layout", errors: 0 }), 2);
  assert.deepEqual(events.map((e) => [e.gate, e.round, e.verdict]), [["qa-layout", 1, "devam"], ["check", 1, "devam"], ["qa-layout", 2, "temiz"]]);
  assert.equal(nextRound(events, { gate: "qa-layout", errors: 2 }).round, 1);
  assert.equal(nextRound(events, { gate: "check", errors: 0 }).round, 2);
});

test("the log splits work from waiting at stops and forced stops", () => {
  const events = [
    { at: at(0), type: "start", step: "a" },
    { at: at(10), type: "end", step: "a" },
    { at: at(10), type: "start", step: "durak-1" },
    { at: at(40), type: "end", step: "durak-1" },
    { at: at(40), type: "user", step: "durak-1", text: "kanca 2, final 1" },
    { at: at(40), type: "start", step: "e" },
    { at: at(55), type: "end", step: "e" },
    { at: at(55), type: "stop", step: "e", text: "yeni sahne türü" },
    { at: at(60), type: "user", step: "e", text: "flow ile yap" },
    { at: at(60), type: "start", step: "e" },
  ];
  const s = summary(events);
  assert.equal(formatDuration(s.work), "25 dk");
  assert.equal(formatDuration(s.wait), "35 dk");
  assert.equal(s.stops, 1);
  assert.equal(s.interventions, 2);
  const md = renderLog("deneme", events, { voice: "taslak (say), yayına uygun değil" });
  assert.match(md, /- Ses: taslak \(say\), yayına uygun değil/);
  assert.match(md, /\| durak-1 \| .* \| 30 dk \(bekleme\) \|/);
  assert.match(md, /\| e \| .* \| sürüyor \|/);
  assert.match(md, /\| .* \| e \| yeni sahne türü \| 5 dk \|/);
  assert.match(md, /\| .* \| durak-1 \| kanca 2, final 1 \|/);
  assert.match(md, /## Düzeltme turları\n\nYok\./);
});

test("a step started again closes its open run: at the stop it waited on, else at the restart", () => {
  const events = [
    { at: at(0), type: "start", step: "c" },
    { at: at(20), type: "start", step: "durak-1" },
    { at: at(28), type: "end", step: "durak-1" },
    { at: at(28), type: "start", step: "c" },
    { at: at(30), type: "end", step: "c" },
    { at: at(30), type: "start", step: "e" },
    { at: at(35), type: "start", step: "e" },
    { at: at(50), type: "end", step: "e" },
  ];
  const s = summary(events);
  assert.equal(formatDuration(s.work), "42 dk");
  assert.equal(formatDuration(s.wait), "8 dk");
  const md = renderLog("deneme", events);
  assert.doesNotMatch(md, /sürüyor/);
  assert.match(md, /\| c \| .* \| 20 dk \| durak-1 ile ara \|/);
  assert.match(md, /\| e \| .* \| 5 dk \| yeniden başladı \|/);
});

test("the log renders rounds with their verdicts and escapes table pipes", () => {
  const events = [];
  for (const [min, errors] of [[0, 3], [5, 3], [9, 4]]) events.push({ at: at(min), ...nextRound(events, { gate: "qa", errors, warnings: 1, text: "a | b" }) });
  const md = renderLog("deneme", events);
  assert.match(md, /\| qa \| 3 \| 4 \| 1 \| a \\\| b \| DUR: hata sayısı iki tur üst üste azalmadı \|/);
  assert.match(md, /- Ses: yok/);
});

test("a fix that takes a said element off screen is a violation, never progress", () => {
  assert.equal(verdict([{ errors: 3 }, { errors: 0, violation: true }]).state, "ihlal");
  assert.equal(verdict([{ errors: 3 }, { errors: 1, violation: true }, { errors: 2 }]).state, "devam");
  const twice = verdict([{ errors: 3 }, { errors: 1, violation: true }, { errors: 1, violation: true }]);
  assert.deepEqual(twice, { state: "dur", why: "hata ancak söylenen öğeyi ekrandan kaldırarak çözülüyor" });
});

test("said shares: a drop beyond one sample counts, a missing element counts as gone", () => {
  const before = [["body.sa", "Kalbinin sağ üstünde", 1], ["body.av", "Sonra kapıya geliyor", 0.75]];
  assert.deepEqual(saidDrops(before, [["body.sa", "Kalbinin sağ üstünde", 0.98], ["body.av", "Sonra kapıya geliyor", 0.75]]), []);
  assert.deepEqual(saidDrops(before, [["body.sa", "Kalbinin sağ üstünde", 0.6]]), [
    { element: "body.sa", phrase: "Kalbinin sağ üstünde", from: 1, to: 0.6 },
    { element: "body.av", phrase: "Sonra kapıya geliyor", from: 0.75, to: 0 },
  ]);
});

test("rounds compare said shares with the last rule-abiding qa round at the same sentence timing", () => {
  const events = [];
  const add = (e, min) => events.push({ at: at(min), ...e });
  const said = (share) => [["flow.kart", "Kartı okuyucuya yaklaştır.", share]];
  add(nextRound(events, { gate: "qa-layout", errors: 2, said: said(1), phraseTiming: "t1" }), 0);
  add({ type: "fix", gate: "qa-layout", text: "boş alan", change: "zoom 1,4", why: "kare boş" }, 1);
  const bad = nextRound(events, { gate: "qa-layout", errors: 0, said: said(0.5), phraseTiming: "t1" });
  assert.equal(bad.verdict, "ihlal");
  assert.match(bad.why, /flow\.kart "Kartı okuyucuya yaklaştır\." %100 → %50/);
  add(bad, 2);
  add({ type: "fix", gate: "qa-layout", text: "ihlal", change: "geri alındı", why: "kart kadraj dışı" }, 3);
  assert.equal(nextRound(events, { gate: "qa-layout", errors: 1, said: said(1), phraseTiming: "t1" }).verdict, "devam");
  assert.equal(nextRound(events, { gate: "qa", errors: 0, said: said(0.2), phraseTiming: "t2" }).verdict, "temiz");
});

test("after a round with errors the gate waits for the fixes to be logged", () => {
  const events = [{ at: at(0), ...nextRound([], { gate: "check", errors: 1 }) }];
  assert.equal(missingFix(events, "check"), true);
  assert.equal(missingFix(events, "qa-layout"), false);
  events.push({ at: at(1), type: "fix", gate: "check", round: 1, text: "subject eksik", change: "subject: body", why: "özne yok" });
  assert.equal(missingFix(events, "check"), false);
  const md = renderLog("deneme", events);
  assert.match(md, /## Düzeltmeler\n\n\| Zaman \| Kapı \| Tur \| Hata \| Ne değiştirildi \| Neden \|/);
  assert.match(md, /\| check \| 1 \| subject eksik \| subject: body \| özne yok \|/);
  events.push({ at: at(2), ...nextRound(events, { gate: "check", errors: 0 }) });
  assert.equal(missingFix(events, "check"), false);
});

test("a placeholder voice renders only as the draft file", () => {
  assert.equal(renderFile("gps"), path.join(ROOT, "out", "gps.mp4"));
  assert.equal(renderFile("gps", { draft: true }), path.join(ROOT, "out", "gps.draft.mp4"));
  assert.equal(isPlaceholderVoice({ source: "placeholder:say/Yelda" }), true);
  assert.equal(isPlaceholderVoice({ source: "elevenlabs:abc/eleven_multilingual_v2" }), false);
  assert.equal(isPlaceholderVoice(null), false);
});
