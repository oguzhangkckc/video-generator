// Skill auto-mode run log → out/<slug>/run-log.jsonl (events) and run-log.md (tables, rewritten on every call).
//   node scripts/runlog.mjs <slug> start <adım> | end <adım> ["not"]
//                                  | round <check|qa-layout|qa> [--errors N] [--warnings N] [--fixed] ["ne değişti"]
//                                  | fix <check|qa-layout|qa|kontrol-listesi|editor> "<hata>" --change "<ne değiştirildi>" --why "<neden>"
//                                  | stop "<sebep>" | user <adım> "<istek>" | note "<metin>" | show
// qa rounds read their counts and said-element shares from out/<slug>/qa.json; a run limited with --from/--to is not a
// round. After a round with errors, the gate's next round needs the fixes logged first.
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "./lib/args.mjs";
import { FIX_SOURCES, GATES, dropText, lastRoundOf, lastStartedStep, missingFix, nextRound, renderLog, verdictText } from "./lib/runlog.mjs";
import { ROOT, loadTiming, outDir, requireSlug } from "./lib/video.mjs";

const USAGE = [
  "Usage: npm run log -- <slug> start|end <adım> [\"not\"]",
  "  | round <check|qa-layout|qa> [--errors N] [--warnings N] [--fixed] [\"ne değişti\"]",
  '  | fix <check|qa-layout|qa|kontrol-listesi|editor> "<hata>" --change "<ne değiştirildi>" --why "<neden>"',
  '  | stop "<sebep>" | user <adım> "<istek>" | note "<metin>" | show',
].join("\n");
const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const { positional, flags } = parseArgs(process.argv.slice(2), { errors: "number", warnings: "number", fixed: "boolean", change: "string", why: "string" });
const [slugArg, cmd, ...rest] = positional;
const slug = requireSlug(slugArg);
const dir = outDir(slug);
const jsonl = path.join(dir, "run-log.jsonl");
const md = path.join(dir, "run-log.md");

const events = existsSync(jsonl)
  ? readFileSync(jsonl, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line))
  : [];

const voice = () => {
  const source = loadTiming(slug)?.source;
  if (!source) return "yok";
  if (source.startsWith("placeholder")) return "taslak (say), yayına uygun değil";
  if (source.startsWith("whisper")) return "insan kaydı (whisper ile hizalı)";
  return `gerçek (${source})`;
};

const write = () => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(md, renderLog(slug, events, { voice: voice() }));
};
const add = (event) => {
  const e = { at: new Date().toISOString(), ...event };
  mkdirSync(dir, { recursive: true });
  appendFileSync(jsonl, `${JSON.stringify(e)}\n`);
  events.push(e);
  return e;
};

/** The qa run this round stands for: a full run (no --from/--to) newer than the gate's last round. */
const qaReport = (gate) => {
  const file = path.join(dir, "qa.json");
  if (!existsSync(file)) fail(`${path.relative(ROOT, file)} yok — önce npm run qa -- ${slug}${gate === "qa-layout" ? " --layout" : ""}`);
  const report = JSON.parse(readFileSync(file, "utf8"));
  if (report.range) fail(`qa.json kısmi bir çalıştırmadan (${report.range.from ?? 0}–${report.range.to ?? "son"} sn): tur sayılmaz, tam çalıştır`);
  if (!report.checked?.layout) fail("qa.json yerleşimi denetlememiş: tam çalıştır");
  if (gate === "qa" && !report.checked.audio) fail(`qa.json sesi denetlememiş: önce render, sonra npm run qa -- ${slug}`);
  const previous = events.findLast((e) => e.type === "round" && e.gate === gate);
  if (previous && statSync(file).mtime <= new Date(previous.at)) fail(`qa.json ${gate} kapısının önceki turundan eski: qa'yı yeniden çalıştır`);
  return { errors: report.errors.length, warnings: report.warnings.length, said: report.said ?? undefined, phraseTiming: report.phraseTiming ?? undefined };
};

const text = rest.slice(1).join(" ") || undefined;

if (cmd === "start" || cmd === "end") {
  if (!rest[0]) fail(USAGE);
  add({ type: cmd, step: rest[0], text });
} else if (cmd === "round") {
  const gate = rest[0];
  if (!GATES.includes(gate)) fail(`kapı: ${GATES.join(" | ")}\n${USAGE}`);
  if (missingFix(events, gate)) {
    fail(`${gate} kapısının önceki turunda hata vardı ama düzeltme kaydı yok. Her düzeltmeyi önce yaz:\n  npm run log -- ${slug} fix ${gate} "<hata>" --change "<ne değiştirildi>" --why "<neden>"`);
  }
  const counts = gate === "check" ? { errors: flags.errors, warnings: flags.warnings } : qaReport(gate);
  if (gate === "check" && !Number.isInteger(counts.errors)) fail("check turunda --errors N zorunlu (check ilk spec hatasında durur)");
  if (flags.errors !== undefined && gate !== "check" && flags.errors !== counts.errors) fail(`--errors ${flags.errors}, ama qa.json ${counts.errors} hata diyor`);
  const round = add(nextRound(events, { gate, ...counts, fixed: flags.fixed, text }));
  const warnings = round.warnings === undefined ? "" : `, ${round.warnings} uyarı`;
  console.log(`${gate} tur ${round.round}: ${round.errors} hata${warnings} → ${verdictText({ state: round.verdict, why: round.why })}`);
  for (const d of round.drops ?? []) console.log(`  söylenen öğe ekrandan çıktı: ${dropText(d)}`);
  if (round.verdict === "ihlal") console.log(`Düzeltmeyi geri al (npm run log -- ${slug} fix ${gate} "…" --change "geri alındı" --why "…"), başka yol dene.`);
  if (round.verdict === "dur") {
    add({ type: "stop", step: lastStartedStep(events), text: `düzeltme döngüsü sonuçsuz (${gate}, ${round.why})` });
    console.log(`Zorunlu durma noktası: kullanıcıya durumu raporla; yanıtını npm run log -- ${slug} user … ile kaydet.`);
  }
} else if (cmd === "fix") {
  const gate = rest[0];
  if (!FIX_SOURCES.includes(gate)) fail(`kaynak: ${FIX_SOURCES.join(" | ")}\n${USAGE}`);
  if (!text || !flags.change || !flags.why) fail(`fix: hata, --change ve --why zorunlu\n${USAGE}`);
  const e = add({ type: "fix", gate, round: lastRoundOf(events, gate), step: lastStartedStep(events), text, change: flags.change, why: flags.why });
  console.log(`düzeltme (${gate}${e.round ? `, tur ${e.round}` : ""}): ${text} → ${flags.change}`);
} else if (cmd === "stop") {
  if (!rest.length) fail(USAGE);
  add({ type: "stop", step: lastStartedStep(events), text: rest.join(" ") });
} else if (cmd === "user") {
  if (rest.length < 2) fail(USAGE);
  add({ type: "user", step: rest[0], text });
} else if (cmd === "note") {
  if (!rest.length) fail(USAGE);
  add({ type: "note", step: lastStartedStep(events), text: rest.join(" ") });
} else if (cmd !== "show") {
  fail(USAGE);
}

write();
if (cmd === "show") console.log(readFileSync(md, "utf8"));
else console.log(path.relative(ROOT, md));
