// out/<slug>/review.html: every sentence whose intonation was flagged, with its takes to listen to. For a TTS
// voice-over each take can be chosen (served by `npm run review -- <slug>`, which writes spec voiceover.picks);
// for a recording the page is the "re-record" list.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { outDir, writeWav } from "./video.mjs";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const flagText = (flags) =>
  flags.map((f) => (f === "rise" ? "sonda yükseliyor" : f === "decay" ? "sonu kesik" : f)).join(", ") || "temiz";

const metrics = (c) =>
  `yükselme ${c.rise == null ? "—" : `${c.rise > 0 ? "+" : ""}${c.rise.toFixed(1)} yt`} · sönüm ${c.decay == null ? "—" : `${Math.round(c.decay * 1000)} ms`}`;

/**
 * items: [{ n, text, candidates: [{ seed, label, pcm, rise, decay, flags, auto?, picked? }] }]; pcm is mono.
 * mode "tts" offers a choice per sentence, "recording" lists what to record again.
 */
export const writeReview = (slug, { mode, items, limits }) => {
  const dir = path.join(outDir(slug), "review");
  mkdirSync(dir, { recursive: true });
  for (const item of items) {
    for (const c of item.candidates) {
      c.file = `review/s${item.n}-${c.seed}.wav`;
      writeWav(path.join(outDir(slug), c.file), c.pcm);
    }
  }
  const cards = items
    .map((item) => {
      const rows = item.candidates
        .map((c) => {
          const badges = [
            c.picked ? '<span class="badge you">senin seçimin</span>' : "",
            c.auto && !c.picked ? '<span class="badge auto">otomatik seçim</span>' : "",
            c.flags.length ? `<span class="badge flag">${esc(flagText(c.flags))}</span>` : '<span class="badge ok">temiz</span>',
          ].join("");
          const button = mode === "tts" ? `<button data-n="${item.n}" data-seed="${c.seed}">Bunu seç</button>` : "";
          return `<div class="take${c.picked || (c.auto && !item.candidates.some((x) => x.picked)) ? " chosen" : ""}">
  <div class="label">${esc(c.label)} ${badges}</div>
  <audio controls preload="none" src="${esc(c.file)}"></audio>
  <div class="metrics">${esc(metrics(c))}</div>${button}
</div>`;
        })
        .join("\n");
      return `<section class="card"><h2><span class="n">${item.n}</span> ${esc(item.text)}</h2>${mode === "recording" ? '<p class="redo">Yeniden kaydet</p>' : ""}${rows}</section>`;
    })
    .join("\n");

  const intro =
    mode === "tts"
      ? `İşaretli cümlelerin çekimleri. Seçimin spec'e (<code>voiceover.picks</code>) yazılır, ses önbellekten kredisiz yeniden kurulur. Seçmek için sayfayı <code>npm run review -- ${esc(slug)}</code> ile aç.`
      : "İnsan kaydında yeniden üretim yok: bu cümleleri yeniden kaydet ve <code>npm run align</code> ile tekrar hizala.";
  const html = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Seslendirme seçimi · ${esc(slug)}</title>
<style>
:root { --bg: #f6f7f9; --card: #fff; --text: #16181d; --muted: #5d6470; --line: #e2e5ea; --accent: #2457d6; --ok: #1d7a46; --warn: #b4531a; }
@media (prefers-color-scheme: dark) { :root { --bg: #101318; --card: #181c23; --text: #e8ebf0; --muted: #9aa3b1; --line: #2a303a; --accent: #7aa2ff; --ok: #5fd08f; --warn: #ffa264; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 760px; margin: 0 auto; padding: 24px 16px 64px; }
h1 { font-size: 22px; margin: 0 0 4px; }
.intro, .limits { color: var(--muted); margin: 0 0 16px; }
code { font: 13px ui-monospace, Menlo, monospace; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 16px; margin: 0 0 16px; }
h2 { font-size: 17px; margin: 0 0 12px; }
.n { display: inline-block; min-width: 26px; color: var(--muted); }
.redo { color: var(--warn); font-weight: 600; margin: 0 0 8px; }
.take { display: grid; grid-template-columns: 1fr; gap: 6px; padding: 10px 0; border-top: 1px solid var(--line); }
.take.chosen .label { font-weight: 600; }
audio { width: 100%; }
.metrics { color: var(--muted); font-size: 13px; }
.badge { display: inline-block; font-size: 12px; padding: 1px 8px; border-radius: 99px; margin-left: 6px; border: 1px solid currentColor; }
.badge.ok { color: var(--ok); } .badge.flag { color: var(--warn); } .badge.auto, .badge.you { color: var(--accent); }
button { justify-self: start; font: inherit; padding: 6px 14px; border-radius: 8px; border: 1px solid var(--accent); background: transparent; color: var(--accent); cursor: pointer; }
button:disabled { opacity: .5; cursor: default; }
#status { position: sticky; bottom: 0; background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; display: none; white-space: pre-wrap; }
</style>
</head>
<body>
<main>
<h1>Seslendirme seçimi · ${esc(slug)}</h1>
<p class="intro">${intro}</p>
<p class="limits">Ölçüt: sonda +${limits.riseSt} yarım tondan fazla yükselme ya da ${Math.round(limits.decayS * 1000)} ms'den kısa sönüm (nokta ile biten cümleler ve soru kelimesiyle kurulan sorular).</p>
${cards || "<p>İşaretli cümle yok.</p>"}
<div id="status"></div>
</main>
<script>
const status = document.getElementById("status");
const show = (text) => { status.style.display = "block"; status.textContent = text; };
document.querySelectorAll("button[data-n]").forEach((b) => b.addEventListener("click", async () => {
  const n = Number(b.dataset.n), seed = Number(b.dataset.seed);
  const command = "npm run voiceover -- pick ${esc(slug)} " + n + " " + seed;
  if (location.protocol === "file:") return show("Sayfa sunucusuz açık. Seçim için:\\n" + command);
  document.querySelectorAll("button").forEach((x) => (x.disabled = true));
  show("Kaydediliyor, ses yeniden kuruluyor…");
  try {
    const res = await fetch("/pick", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ n, seed }) });
    const out = await res.json();
    if (!res.ok) throw new Error(out.log || res.statusText);
    location.reload();
  } catch (e) {
    show("Olmadı: " + e.message + "\\nElle: " + command);
    document.querySelectorAll("button").forEach((x) => (x.disabled = false));
  }
}));
</script>
</body>
</html>
`;
  const file = path.join(outDir(slug), "review.html");
  writeFileSync(file, html);
  return file;
};
