// The run log of skill auto mode (out/<slug>/run-log.jsonl → run-log.md): steps, fix rounds, fixes, stops and the
// user's interventions. Pure functions; scripts/runlog.mjs reads and writes the files.

export const GATES = ["check", "qa-layout", "qa"];
export const FIX_SOURCES = [...GATES, "kontrol-listesi", "editor"];
export const MAX_ROUNDS = 5;
/** One lost 0.25 s sample in a sentence of ~2 s is 0.12; below this the share did not really move. */
export const SAID_DROP = 0.05;

/**
 * Where one fix loop stands. A round progresses when it has fewer errors than the last round that broke no rule, or
 * when the previous round's error is gone (`fixed`: check stops at the first spec error, so its count is usually 1).
 * A round whose fix took a said element off screen (`violation`) never progresses.
 */
export const verdict = (rounds) => {
  const n = rounds.length;
  const last = rounds[n - 1];
  if (!last.violation && last.errors === 0) return { state: "temiz" };
  const progressed = (i) => {
    if (rounds[i].violation) return false;
    const before = rounds.slice(0, i).findLast((r) => !r.violation);
    return !before || rounds[i].errors < before.errors || Boolean(rounds[i].fixed);
  };
  const stuck = n >= 3 && !progressed(n - 1) && !progressed(n - 2);
  if (stuck || n >= MAX_ROUNDS) {
    if (last.violation) return { state: "dur", why: "hata ancak söylenen öğeyi ekrandan kaldırarak çözülüyor" };
    return { state: "dur", why: stuck ? "hata sayısı iki tur üst üste azalmadı" : `${MAX_ROUNDS} turda sıfıra inmedi` };
  }
  if (last.violation) return { state: "ihlal", why: "düzeltme söylenen öğeyi ekrandan kaldırdı: geri al, başka yol dene" };
  return { state: "devam" };
};

export const verdictText = (v) => (v.state === "dur" ? `DUR: ${v.why}` : v.state === "ihlal" ? `İHLAL: ${v.why}` : v.state);

/** A loop that ended clean or stopped leaves the gate's next round to start a new loop. */
export const openLoop = (events, gate) => {
  let loop = [];
  for (const e of events) {
    if (e.type !== "round" || e.gate !== gate) continue;
    loop.push(e);
    if (e.verdict === "temiz" || e.verdict === "dur") loop = [];
  }
  return loop.map((e) => ({ errors: e.errors, fixed: e.fixed, violation: e.verdict === "ihlal" || Boolean(e.drops) }));
};

/** said: [element, sentence, share of the sentence on screen] from qa.json. */
export const saidDrops = (before, after) => {
  const now = new Map(after.map(([element, phrase, share]) => [`${element}\n${phrase}`, share]));
  return before.flatMap(([element, phrase, share]) => {
    const to = now.get(`${element}\n${phrase}`) ?? 0;
    return to < share - SAID_DROP ? [{ element, phrase, from: share, to }] : [];
  });
};

/** The latest qa round of either gate at the same sentence timing whose fixes broke no rule. */
export const baselineOf = (events, phraseTiming) =>
  events.findLast((e) => e.type === "round" && e.said && e.phraseTiming === phraseTiming && !e.drops);

const pct = (x) => `%${Math.round(x * 100)}`;
export const dropText = (d) => `${d.element} "${d.phrase}" ${pct(d.from)} → ${pct(d.to)}`;

export const nextRound = (events, { gate, errors, warnings, fixed, text, said, phraseTiming }) => {
  const base = said && phraseTiming ? baselineOf(events, phraseTiming) : undefined;
  const drops = base ? saidDrops(base.said, said) : [];
  const rounds = [...openLoop(events, gate), { errors, fixed, violation: drops.length > 0 }];
  const v = verdict(rounds);
  const why = drops.length ? `${v.why} (${drops.map(dropText).join("; ")})` : v.why;
  return {
    type: "round",
    gate,
    round: rounds.length,
    errors,
    warnings,
    fixed: fixed || undefined,
    text,
    said: said ?? undefined,
    phraseTiming: phraseTiming ?? undefined,
    drops: drops.length ? drops : undefined,
    verdict: v.state,
    why,
  };
};

/** After a round with errors (or a broken rule), the next round of the gate waits for the fixes to be logged. */
export const missingFix = (events, gate) => {
  const i = events.findLastIndex((e) => e.type === "round" && e.gate === gate);
  if (i < 0) return false;
  const last = events[i];
  if (last.errors === 0 && !last.drops) return false;
  return !events.slice(i + 1).some((e) => e.type === "fix" && e.gate === gate);
};

export const lastRoundOf = (events, gate) => events.findLast((e) => e.type === "round" && e.gate === gate)?.round;
export const lastStartedStep = (events) => events.findLast((e) => e.type === "start")?.step;

export const formatDuration = (ms) => {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} sn`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} dk`;
  return `${Math.floor(m / 60)} sa ${m % 60} dk`;
};

const pad = (n) => String(n).padStart(2, "0");
export const formatTime = (iso) => {
  const d = new Date(iso);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const cell = (v) => (v === undefined || v === null || v === "" ? "—" : String(v).replaceAll("|", "\\|").replaceAll("\n", " "));
const table = (head, rows) =>
  rows.length ? [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`)].join("\n") : "Yok.";

const isWaiting = (step) => step.startsWith("durak");
const ms = (from, to) => new Date(to) - new Date(from);

/**
 * Each `end` closes the latest open `start` of the same step, so a step can run again (after a stop). A step started
 * again while its last run is still open (it went on after a stop without an `end`, as c after Durak 1) closes that
 * run first: where the first wait after it began, so the wait is not counted as work, else at the new start.
 */
export const stepSpans = (events) => {
  const spans = [];
  for (const e of events) {
    if (e.type === "start") {
      const stale = spans.findLast((s) => s.step === e.step && s.to === null);
      if (stale) {
        const pause = spans.find((s) => s !== stale && isWaiting(s.step) && ms(stale.from, s.from) >= 0 && ms(s.from, e.at) >= 0);
        Object.assign(stale, pause ? { to: pause.from, text: `${pause.step} ile ara` } : { to: e.at, text: "yeniden başladı" });
      }
      spans.push({ step: e.step, from: e.at, to: null, text: undefined });
    }
    if (e.type === "end") {
      const open = spans.findLast((s) => s.step === e.step && s.to === null);
      if (open) Object.assign(open, { to: e.at, text: e.text });
    }
  }
  return spans;
};

/** A forced stop waits until the user's next intervention. */
export const stopSpans = (events) =>
  events.flatMap((e, i) => (e.type === "stop" ? [{ ...e, answered: events.slice(i + 1).find((x) => x.type === "user")?.at ?? null }] : []));

export const summary = (events) => {
  const closed = stepSpans(events).filter((s) => s.to);
  const sum = (spans) => spans.reduce((total, s) => total + ms(s.from, s.to), 0);
  const stopWaits = stopSpans(events)
    .filter((s) => s.answered)
    .reduce((total, s) => total + ms(s.at, s.answered), 0);
  return {
    work: sum(closed.filter((s) => !isWaiting(s.step))),
    wait: sum(closed.filter((s) => isWaiting(s.step))) + stopWaits,
    rounds: events.filter((e) => e.type === "round").length,
    fixes: events.filter((e) => e.type === "fix").length,
    stops: events.filter((e) => e.type === "stop").length,
    interventions: events.filter((e) => e.type === "user").length,
  };
};

export const renderLog = (slug, events, { voice } = {}) => {
  const s = summary(events);
  const steps = stepSpans(events).map((x) => [
    x.step,
    formatTime(x.from),
    x.to ? formatTime(x.to) : "sürüyor",
    x.to ? `${formatDuration(ms(x.from, x.to))}${isWaiting(x.step) ? " (bekleme)" : ""}` : undefined,
    x.text,
  ]);
  const rounds = events
    .filter((e) => e.type === "round")
    .map((e) => [e.gate, e.round, e.errors, e.warnings, e.fixed ? `${e.text ?? ""} (önceki hata giderildi)`.trim() : e.text, verdictText({ state: e.verdict, why: e.why })]);
  const fixes = events.filter((e) => e.type === "fix").map((e) => [formatTime(e.at), e.gate, e.round, e.text, e.change, e.why]);
  const stops = stopSpans(events).map((e) => [formatTime(e.at), e.step, e.text, e.answered ? formatDuration(ms(e.at, e.answered)) : "yanıt bekliyor"]);
  const byTime = (type) => events.filter((e) => e.type === type).map((e) => [formatTime(e.at), e.step, e.text]);
  return [
    `# Run log: ${slug}`,
    "",
    `- Ses: ${voice ?? "yok"}`,
    `- Çalışma ${formatDuration(s.work)} · kullanıcı bekleme ${formatDuration(s.wait)} · düzeltme turu ${s.rounds} · düzeltme ${s.fixes} · durma ${s.stops} · müdahale ${s.interventions}`,
    "",
    "## Adımlar",
    "",
    table(["Adım", "Başlangıç", "Bitiş", "Süre", "Not"], steps),
    "",
    "## Düzeltme turları",
    "",
    table(["Kapı", "Tur", "Hata", "Uyarı", "Ne değişti", "Karar"], rounds),
    "",
    "## Düzeltmeler",
    "",
    table(["Zaman", "Kapı", "Tur", "Hata", "Ne değiştirildi", "Neden"], fixes),
    "",
    "## Durma noktaları",
    "",
    table(["Zaman", "Adım", "Sebep", "Bekleme"], stops),
    "",
    "## Müdahaleler",
    "",
    table(["Zaman", "Adım", "İstek"], byTime("user")),
    "",
    "## Notlar",
    "",
    table(["Zaman", "Adım", "Not"], byTime("note")),
    "",
  ].join("\n");
};
