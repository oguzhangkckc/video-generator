// The script audit (src/spec/script-audit.ts) with its warnings, for specs and for skill step c) drafts.
//   node scripts/text.mjs                         → every videos/<slug>/spec.json (part of npm run check)
//   node scripts/text.mjs <slug|metin.json>…      → those specs, or drafts with all their hook and final options
// A draft is also held to the checks a spec meets later, so nothing in the words can stop the video after Durak 1:
// caption fit (measured in the browser, as npm run check does), and its planned data lines (`labels`) against what
// is said around them and the quantity it names. Exit 1 when an error is not waived by `styleExceptions`.
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { captionsSchema, layoutSchema } from "../src/kit/overlays/schema.ts";
import { auditScript, waivedRules } from "../src/spec/script-audit.ts";
import { sayAliases } from "../src/spec/visual-words.ts";
import { captionMisfits } from "./lib/caption-fit.mjs";
import { readDraft, variantsOf } from "./lib/draft.mjs";
import { ROOT, loadSpec, requireSlug, videoDir } from "./lib/video.mjs";

const CAPTION = { size: captionsSchema.parse({}).size, width: layoutSchema.parse({}).contentWidth };

const allSlugs = () =>
  readdirSync(path.join(ROOT, "videos"), { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(path.join(videoDir(d.name), "spec.json")))
    .map((d) => d.name)
    .sort();

/** Findings of every variant, each once, with the variants it appears in; planned labels belong to the full text. */
const auditDraft = (draft, misfits) => {
  const seen = new Map();
  const variants = variantsOf(draft);
  for (const v of variants) {
    const caption = v.sections
      .flatMap((s) => s.phrases)
      .filter((p) => misfits.has(p))
      .map((p) => ({
        level: "error",
        rule: "altyazi",
        text: p,
        message: `"${p}": does not fit the caption line at ${CAPTION.size} px (${CAPTION.width} px), not even as two pages of 2–6 words — shorten or reword it`,
      }));
    for (const f of [...auditScript(v.sections, { labels: v.name === "tam" ? (draft.labels ?? []) : [] }), ...caption]) {
      const key = `${f.rule}\n${f.message}`;
      if (!seen.has(key)) seen.set(key, { ...f, variants: [] });
      seen.get(key).variants.push(v.name);
    }
  }
  // A finding in every variant needs no list of where it is.
  return [...seen.values()].map((f) => (f.variants.length === variants.length ? { ...f, variants: undefined } : f));
};

const auditSpec = (slug) => {
  const { spec } = loadSpec(requireSlug(slug));
  return auditScript(spec.voiceover.sections, { template: spec.template, waived: waivedRules(spec.styleExceptions), say: sayAliases(spec.layers) });
};

const LABEL = { error: "HATA ", warning: "uyarı" };
const targets = process.argv.slice(2);
const drafts = new Map(targets.filter((t) => t.endsWith(".json")).map((t) => [t, readDraft(path.resolve(t))]));
const draftPhrases = [...drafts.values()].flatMap((d) => variantsOf(d).flatMap((v) => v.sections.flatMap((s) => s.phrases)));
const misfits = new Set(await captionMisfits([...new Set(draftPhrases)]));
let failed = false;
for (const target of targets.length ? targets : allSlugs()) {
  const findings = drafts.has(target) ? auditDraft(drafts.get(target), misfits) : auditSpec(target);
  if (!findings.length) {
    console.log(`${target}: temiz`);
    continue;
  }
  console.log(target);
  for (const f of findings) {
    const label = f.waived ? "muaf " : LABEL[f.level];
    const where = f.variants ? ` [${f.variants.join(", ")}]` : "";
    console.log(`  ${label}  ${f.rule.padEnd(18)} ${f.message}${where}`);
    if (f.level === "error" && !f.waived) failed = true;
  }
}
if (failed) {
  console.error("\nMetin denetimi: hata var (STYLE.md \"Anlatım\"). Bilinçli bir sapma ise spec'te styleExceptions: [{ rule, why }].");
  process.exit(1);
}
