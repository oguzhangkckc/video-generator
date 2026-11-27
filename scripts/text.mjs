// The script audit (src/spec/script-audit.ts) with its warnings, for specs and for skill step c) drafts.
//   node scripts/text.mjs                         → every videos/<slug>/spec.json (part of npm run check)
//   node scripts/text.mjs <slug|metin.json>…      → those specs, or drafts with all their hook and final options
// Exit 1 when an error is not waived by `styleExceptions: [{ rule, why }]`.
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { auditScript, waivedRules } from "../src/spec/script-audit.ts";
import { readDraft, variantsOf } from "./lib/draft.mjs";
import { ROOT, loadSpec, requireSlug, videoDir } from "./lib/video.mjs";

const allSlugs = () =>
  readdirSync(path.join(ROOT, "videos"), { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(path.join(videoDir(d.name), "spec.json")))
    .map((d) => d.name)
    .sort();

/** Findings of every variant, each once, with the variants it appears in. */
const auditDraft = (file) => {
  const seen = new Map();
  const variants = variantsOf(readDraft(file));
  for (const v of variants) {
    for (const f of auditScript(v.sections)) {
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
  return auditScript(spec.voiceover.sections, { template: spec.template, waived: waivedRules(spec.styleExceptions) });
};

const LABEL = { error: "HATA ", warning: "uyarı" };
const targets = process.argv.slice(2);
let failed = false;
for (const target of targets.length ? targets : allSlugs()) {
  const findings = target.endsWith(".json") ? auditDraft(path.resolve(target)) : auditSpec(target);
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
