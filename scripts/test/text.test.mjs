import assert from "node:assert/strict";
import { test } from "node:test";
import { needsReading, spoken, spokenWords, splitToken, unreadable } from "../../src/spec/lexicon.ts";
import { pauseAfter } from "../../src/spec/pauses.ts";
import { labelQuantity, namedQuantities, quantityMismatches } from "../../src/spec/quantities.ts";
import { endsOnQuestionWord, sentenceKind, sentencesOf } from "../../src/spec/sentences.ts";

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
