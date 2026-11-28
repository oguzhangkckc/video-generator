import assert from "node:assert/strict";
import { test } from "node:test";
import { avoidedIn } from "../../src/spec/avoid.ts";
import { needsReading, spoken, spokenWords, splitToken, unreadable } from "../../src/spec/lexicon.ts";
import { pauseAfter } from "../../src/spec/pauses.ts";
import { labelQuantity, namedQuantities, quantityMismatches } from "../../src/spec/quantities.ts";
import { auditScript, waivedRules } from "../../src/spec/script-audit.ts";
import { endsOnQuestionWord, sentenceKind, sentencesOf } from "../../src/spec/sentences.ts";
import { captionMisfits } from "../../src/spec/timing.ts";
import { isFormOf, sayAliases, unboundVisualNouns, visualNounsIn } from "../../src/spec/visual-words.ts";
import { variantsOf } from "../lib/draft.mjs";

test("the voice reads the spoken form, the captions keep one word per written word", () => {
  assert.equal(spoken("İşte QRS: asıl vuruşun işareti."), "İşte kü re se: asıl vuruşun işareti.");
  assert.equal(spoken("QRS'nin süresi"), "kü re se'nin süresi");
  const groups = spokenWords("Bu düzlük, PR bölümü.");
  assert.equal(groups.length, 4);
  assert.deepEqual(groups[2], ["pe", "re"]);
});

test("abbreviations, units, digits and symbols need a reading; words and dashes do not", () => {
  assert.deepEqual(unreadable("Bu düzlük, PR bölümü."), []);
  assert.deepEqual(unreadable("Sinyal 10 mV kadar"), ["10"]);
  assert.deepEqual(unreadable("O halde XYZ geliyor"), ["XYZ"]);
  assert.equal(needsReading(splitToken("—").base), false);
  assert.equal(needsReading("elektrokardiyogram"), false);
  assert.equal(needsReading("T"), true);
});

test("sentence kinds and the question-word stress rule", () => {
  assert.equal(sentenceKind("Bu çizgi ne anlatıyor?"), "wh-question");
  assert.equal(sentenceKind("Peki ya uydudaki saatler yanlışsa?"), "yes-no");
  assert.equal(sentenceKind("Bunu duydun mu?"), "yes-no");
  assert.equal(sentenceKind("Kan aşağı dolsun diye."), "statement");
  assert.equal(sentenceKind("Bunun adı:"), "fragment");
  assert.equal(endsOnQuestionWord("Peki o sivri tepe ne?"), true);
  assert.equal(endsOnQuestionWord("Peki ya o sivri tepe?"), false);
  assert.equal(endsOnQuestionWord("Bu çizgi ne anlatıyor?"), false);
});

test("sentences span caption phrases and close at a section end", () => {
  const s = sentencesOf([{ phrases: ["Ama uydular seni", "görmüyor bile.", "Hepsi aynı şeyi fısıldıyor:"] }, { phrases: ["Peki neden?"] }]);
  assert.deepEqual(
    s.map((x) => [x.first, x.last, x.kind]),
    [
      [0, 1, "statement"],
      [2, 2, "fragment"],
      [3, 3, "wh-question"],
    ],
  );
});

test("STYLE pauses", () => {
  assert.equal(pauseAfter("kalem pilin binde birinden az."), 0.4);
  assert.equal(pauseAfter("Bu çizgi ne anlatıyor?"), 0.6);
  assert.equal(pauseAfter("Kapı açılıyor,"), 0.2);
  assert.equal(pauseAfter("Ama saat"), 0.1);
  assert.equal(pauseAfter("son.", { sectionEnd: true }), 0.7);
});

test("a label's unit and the quantity the voice names must agree", () => {
  assert.equal(labelQuantity("SİNYAL ≈ 1 mV"), "gerilim");
  assert.equal(labelQuantity("≈ 0,1 SN BEKLEME"), "süre");
  assert.equal(labelQuantity("14.000 km/sa"), "hız");
  assert.equal(labelQuantity("DAKİKADA 60–100"), null);
  assert.deepEqual([...namedQuantities("Kalbinin akımı cildine ulaşıyor:")], ["akım"]);
  const phrases = [
    { text: "Kalbinin akımı cildine ulaşıyor:", start: 9.5, end: 10.9 },
    { text: "Cihazın kendi akımı ise", start: 13.1, end: 14.1 },
  ];
  const found = quantityMismatches(
    [
      { text: "SİNYAL ≈ 1 mV", at: 10.1 },
      { text: "CİHAZ AKIMI ≤ 10 µA", at: 13.3 },
    ],
    phrases,
  );
  assert.deepEqual(
    found.map((m) => m.label),
    ["SİNYAL ≈ 1 mV"],
  );
});

const rules = (sections, options) => auditScript(sections, options).map((f) => `${f.level}:${f.rule}${f.waived ? ":waived" : ""}`);

test("the avoid list matches suffixed forms, not lookalike words", () => {
  assert.deepEqual(avoidedIn("Bir hücre kümesi ateşleniyor:").map((a) => a.match), ["ateşlen"]);
  assert.deepEqual(avoidedIn("karıncıklar birden uyarılıyor.").map((a) => a.match), ["uyarıl"]);
  assert.deepEqual(avoidedIn("Bu bir uyarı işareti."), []);
  assert.deepEqual(avoidedIn("Ateş gibi yanıyor."), []);
  assert.deepEqual(avoidedIn("Kalp dört odaya sahip oluyor.").map((a) => a.match), ["sahip ol"]);
  assert.deepEqual(avoidedIn("alanını çok kısa anlar için kısıyor.").map((a) => a.match), ["anlar için"]);
  assert.deepEqual(avoidedIn("İnsanlar için kolay."), []);
  assert.deepEqual(avoidedIn("Anahtar kapanınca kart enerji çekiyor.").map((a) => a.match), ["anahtar kapan"]);
  assert.deepEqual(avoidedIn("Kart anahtarı açıp kapatıyor."), []);
});

test("a phrase misfits the caption line only when it fits neither as one page nor as two of 2–6 words", () => {
  const fits = (text) => text.length <= 24;
  assert.deepEqual(captionMisfits(["Kısa bir cümle.", "Bunun yerine okuyucunun alanını kullanıyor."], fits), []);
  // Three long words: the line is too wide and a 2 + 1 split leaves a one-word page.
  assert.deepEqual(captionMisfits(["Okuyucunun alanını kullanıyor."], fits), ["Okuyucunun alanını kullanıyor."]);
});

test("a draft's planned labels are checked against what is said around them and the quantity it names", () => {
  const sections = [
    { id: "kanca", window: [0, 5], phrases: ["Kartında pil yok.", "Okuyucuya nasıl cevap veriyor?"] },
    { id: "alan", window: [5, 12], phrases: ["Alanın yönü saniyede milyonlarca kez değişiyor.", "Gerilim kalem pilin binde biri."] },
  ];
  const rules = (labels) => auditScript(sections, { labels }).map((f) => `${f.level}:${f.rule}`);
  assert.deepEqual(rules([{ text: "SANİYEDE 13,56 MİLYON KEZ", cue: "Alanın yönü" }]), []);
  assert.deepEqual(rules([{ text: "BOBİN", cue: "Alanın yönü" }]), ["error:etiket-sozu"]);
  assert.deepEqual(rules([{ text: "AKIM", cue: "Yok böyle bir cümle" }]), ["error:etiket-plani"]);
  // The label shows a frequency while the phrase spoken as it appears names a voltage.
  assert.deepEqual(rules([{ text: "GERİLİM 13,56 MHz", cue: "Gerilim kalem" }]), ["warning:nicelik"]);
});

test("at most two sections open with a Peki question", () => {
  const body = (opener) => ({ id: opener, phrases: [opener, "Bir cümle."] });
  const three = [{ id: "kanca", phrases: ["Bu ne anlatıyor?"] }, body("Peki bu nasıl oluyor?"), body("Ama o değil."), body("Peki şu neden var?"), body("Peki ya o?"), { id: "final", phrases: ["Cevap bu."] }];
  assert.deepEqual(rules(three), ["error:peki-siniri"]);
  assert.deepEqual(rules(three.filter((s) => s.id !== "Peki ya o?")), []);
  // "Peki" inside a section, or as a statement, does not open it with a question.
  assert.deepEqual(rules([body("Peki bu nasıl oluyor?"), body("Peki, böyle."), { id: "x", phrases: ["Bir cümle.", "Peki şu neden var?", "Bir cümle."] }, body("Peki ya o?")]), []);
});

test("a video does not end on a question, unless the spec waives it", () => {
  const sections = [{ id: "kanca", phrases: ["Nasıl biliyor?"] }, { id: "son", phrases: ["Ama saat şaşarsa,", "Peki ya uydudaki saatler yanlışsa?"] }];
  assert.deepEqual(rules(sections), ["error:acik-final"]);
  assert.deepEqual(rules(sections, { waived: waivedRules(["metin", { rule: "acik-final", why: "pilot" }]) }), ["error:acik-final:waived"]);
  assert.deepEqual(rules([sections[0], { id: "son", phrases: ["Bunun adı:", "elektrokardiyogram."] }]), []);
});

test("the moved script rules keep their behaviour", () => {
  assert.deepEqual(rules([{ id: "a", phrases: ["Peki bu nasıl oluyor?", "Peki ya şu?"] }, { id: "b", phrases: ["Son."] }]), ["error:peki-art-arda"]);
  assert.deepEqual(rules([{ id: "a", phrases: ["Sinyal geliyor: XYZ."] }, { id: "b", phrases: ["Son."] }]), ["error:okunus", "error:kisaltma-sonu"]);
  assert.deepEqual(rules([{ id: "a", phrases: ["Peki o sivri tepe ne?"] }, { id: "b", phrases: ["Son."] }]), ["error:soru-kelimesi-sonu"]);
  assert.deepEqual(rules([{ id: "a", phrases: ["[Kanca] XYZ"] }, { id: "b", phrases: ["Peki ne?"] }], { template: true }), []);
});

test("a draft's hook and final options each replace one end of the text", () => {
  const draft = {
    slug: "x",
    sections: [{ id: "kanca", phrases: ["K0?"] }, { id: "govde", phrases: ["G."] }, { id: "final", phrases: ["F0."] }],
    options: { kanca: [["K1?"], ["K2?"]], final: [["F1."]] },
  };
  const v = variantsOf(draft);
  assert.deepEqual(v.map((x) => x.name), ["tam", "kanca-1", "kanca-2", "final-1"]);
  assert.deepEqual(v[2].sections.map((s) => s.phrases[0]), ["K2?", "G.", "F0."]);
  assert.deepEqual(v[3].sections.map((s) => s.phrases[0]), ["K0?", "G.", "F1."]);
});

test("a label must show what the voice-over says around it", async () => {
  const { unspokenLabels, sameWord } = await import("../../src/spec/label-speech.ts");
  assert.equal(sameWord("bekleme", "bekliyor"), true);
  assert.equal(sameWord("sağın", "sağ"), true);
  assert.equal(sameWord("karıncıklar", "odalar"), false);
  assert.equal(sameWord("sa", "sağ"), false);
  const phrases = [
    { text: "Kalbinin kendi saati var:", start: 10, end: 11.2 },
    { text: "sağ üst köşede bir hücre kümesi.", start: 11.4, end: 13 },
    { text: "Emir alt odaların", start: 20, end: 21 },
    { text: "kapısında bekliyor:", start: 21.2, end: 22 },
    { text: "saniyenin onda biri kadar.", start: 22.2, end: 23.3 },
  ];
  const texts = (labels) => unspokenLabels(labels, phrases).map((u) => u.text);
  // Lines left over after their sentence was cut, and a technical name the script replaced.
  assert.deepEqual(texts([{ text: "DAKİKADA 60–100", at: 12 }, { text: "SA DÜĞÜMÜ", at: 12 }, { text: "KARINCIKLAR", at: 21 }]), [
    "DAKİKADA 60–100",
    "SA DÜĞÜMÜ",
    "KARINCIKLAR",
  ]);
  // Said with a suffix or narrowed vowel, half the words said, a number said in words, a unit not counted as a term.
  assert.deepEqual(texts([{ text: "◀ SENİN SAĞIN", at: 11.7 }, { text: "KALBİN SAATİ", at: 12 }, { text: "KAPI", at: 20.4 }, { text: "≈ 0,1 SN BEKLEME", at: 22.4 }]), []);
  // A number shown while none is said is reported even when the word is said.
  assert.deepEqual(unspokenLabels([{ text: "KAPI 3", at: 20.1 }], phrases.slice(2, 4)).map((u) => u.number), [true]);
});

test("nouns that point at the screen are found with their endings, not as other words", () => {
  assert.deepEqual(visualNounsIn("Bu çizgiyi dizilerde mutlaka görmüşsündür."), ["çizgi"]);
  assert.deepEqual(visualNounsIn("kalbin elektrikle yazdığı yazı."), ["yazı"]);
  assert.deepEqual(visualNounsIn("haritada üç yüz metre kayarsın."), ["harita"]);
  assert.deepEqual(visualNounsIn("Yani küçük tepe üst odalar, ilk düzlük kapıdaki bekleme,"), ["tepe", "düzlük"]);
  assert.equal(isFormOf("düzlüğü", "düzlük"), true);
  assert.equal(isFormOf("tepeler", "tepe"), true);
  assert.equal(isFormOf("çizginin", "çizgi"), true);
  // Verbs, adjectives and other nouns sharing the start are not the visual noun.
  for (const [word, noun] of [["yazıyor", "yazı"], ["yazıcı", "yazı"], ["çizgili", "çizgi"], ["yazdığı", "yazı"], ["şemsiye", "şema"]]) {
    assert.equal(isFormOf(word, noun), false, word);
  }
});

test("a visual noun is bound when the phrase says an element's say alias that contains it", () => {
  assert.deepEqual(unboundVisualNouns("kalbin elektrikle yazdığı yazı.", []), ["yazı"]);
  assert.deepEqual(unboundVisualNouns("kalbin elektrikle yazdığı yazı.", ["yazı", "çizgi"]), []);
  assert.deepEqual(unboundVisualNouns("Bu çizgiyi dizilerde mutlaka görmüşsündür.", ["veri çizgisi"]), ["çizgi"]);
  assert.deepEqual(unboundVisualNouns("Bu çizgiyi dizilerde mutlaka görmüşsündür.", ["kalp"]), ["çizgi"]);
  const layers = [
    { type: "flow", regions: [{ say: ["kalp"] }], paths: [], nodes: [{ say: ["düğme"] }] },
    { type: "trace", say: ["çizgi", "yazı"], parts: [{ say: ["tepe"] }] },
    { type: "cityMap", say: ["harita"] },
    { type: "globe", location: { say: [] }, hero: { say: ["uydu"] } },
  ];
  assert.deepEqual(sayAliases(layers), ["kalp", "düğme", "çizgi", "yazı", "tepe", "harita", "uydu"]);
});

test("a spec's unbound visual nouns are warnings, and a spec can waive them", () => {
  const sections = [{ id: "final", phrases: ["Artık okumaya başladın.", "kalbin elektrikle yazdığı yazı."] }];
  const found = auditScript(sections, { say: [] }).filter((f) => f.rule === "gorsel-soz");
  assert.equal(found.length, 1);
  assert.equal(found[0].level, "warning");
  assert.deepEqual(auditScript(sections, { say: ["yazı"] }).filter((f) => f.rule === "gorsel-soz"), []);
  // A draft has no scenes: no say, no finding.
  assert.deepEqual(auditScript(sections).filter((f) => f.rule === "gorsel-soz"), []);
  assert.equal(auditScript(sections, { say: [], waived: ["gorsel-soz"] }).find((f) => f.rule === "gorsel-soz").waived, true);
});
