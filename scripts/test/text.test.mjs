import assert from "node:assert/strict";
import { test } from "node:test";
import { avoidedIn } from "../../src/spec/avoid.ts";
import { needsReading, spoken, spokenWords, splitToken, unreadable } from "../../src/spec/lexicon.ts";
import { pauseAfter } from "../../src/spec/pauses.ts";
import { labelQuantity, namedQuantities, quantityMismatches } from "../../src/spec/quantities.ts";
import { auditScript, waivedRules } from "../../src/spec/script-audit.ts";
import { endsOnQuestionWord, sentenceKind, sentencesOf } from "../../src/spec/sentences.ts";
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
