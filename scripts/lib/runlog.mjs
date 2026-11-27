// The run log of skill auto mode (out/<slug>/run-log.jsonl → run-log.md): steps, fix rounds, stops and the user's
// interventions. Pure functions; scripts/runlog.mjs reads and writes the files.

export const GATES = ["check", "qa-layout", "qa"];
export const MAX_ROUNDS = 5;

/**
 * Where one fix loop stands. A round progresses when it has fewer errors than the one before, or when the previous
 * round's error is gone (`fixed`): check stops at the first spec error, so its count is usually 1.
 */
export const verdict = (rounds) => {
  const n = rounds.length;
  if (rounds[n - 1].errors === 0) return { state: "temiz" };
  const progressed = (i) => rounds[i].errors < rounds[i - 1].errors || Boolean(rounds[i].fixed);
  if (n >= 3 && !progressed(n - 1) && !progressed(n - 2)) return { state: "dur", why: "hata sayısı iki tur üst üste azalmadı" };
  if (n >= MAX_ROUNDS) return { state: "dur", why: `${MAX_ROUNDS} turda sıfıra inmedi` };
  return { state: "devam" };
};

export const verdictText = (v) => (v.state === "dur" ? `DUR: ${v.why}` : v.state);

/** A loop that ended clean or stopped leaves the gate's next round to start a new loop. */
export const openLoop = (events, gate) => {
  let loop = [];
  for (const e of events) {
    if (e.type !== "round" || e.gate !== gate) continue;
    loop.push(e);
    if (e.verdict !== "devam") loop = [];
  }
  return loop;
};

export const nextRound = (events, { gate, errors, warnings, fixed, text }) => {
  const rounds = [...openLoop(events, gate), { errors, fixed }];
  const v = verdict(rounds);
  return { type: "round", gate, round: rounds.length, errors, warnings, fixed: fixed || undefined, text, verdict: v.state, why: v.why };
};

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

/** Each `end` closes the latest open `start` of the same step, so a step can run again (after a stop). */
export const stepSpans = (events) => {
  const spans = [];
  for (const e of events) {
    if (e.type === "start") spans.push({ step: e.step, from: e.at, to: null, text: undefined });
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
  const stops = stopSpans(events).map((e) => [formatTime(e.at), e.step, e.text, e.answered ? formatDuration(ms(e.at, e.answered)) : "yanıt bekliyor"]);
  const byTime = (type) => events.filter((e) => e.type === type).map((e) => [formatTime(e.at), e.step, e.text]);
  return [
    `# Run log: ${slug}`,
    "",
    `- Ses: ${voice ?? "yok"}`,
    `- Çalışma ${formatDuration(s.work)} · kullanıcı bekleme ${formatDuration(s.wait)} · düzeltme turu ${s.rounds} · durma ${s.stops} · müdahale ${s.interventions}`,
    "",
    "## Adımlar",
    "",
    table(["Adım", "Başlangıç", "Bitiş", "Süre", "Not"], steps),
    "",
    "## Düzeltme turları",
    "",
    table(["Kapı", "Tur", "Hata", "Uyarı", "Ne değişti", "Karar"], rounds),
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
