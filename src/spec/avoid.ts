// Phrases the voice-over avoids: translationese, and technical terms whose everyday meaning is something else.
// `match` is a stem: each word may take a suffix ("ateşlen" finds "ateşleniyor", not "ateş"). npm run check warns.
// Shared by the bundle and the Node scripts (type stripping), so it imports only pure modules.
import { mentions } from "./sentences.ts";

export type Avoid = { match: string; why: string; instead: string };

export const AVOID: Avoid[] = [
  { match: "ateşlen", why: "çeviri kokuyor (İng. fire)", instead: "kendiliğinden bir elektrik sinyali çıkarıyor, kıvılcım çakıyor" },
  { match: "uyarıl", why: "teknik terim; günlük dilde 'ikaz edilmek' demek", instead: "sinyal ulaşıyor, elektriği alıyor" },
  { match: "tarafından", why: "edilgen çeviri kalıbı (İng. by)", instead: "yapanı özne yap: 'X, Y'yi yapıyor'" },
  { match: "gerçekleştir", why: "çeviri kalıbı (İng. perform)", instead: "yap-, ol-, ya da asıl fiil" },
  { match: "sahip ol", why: "çeviri kalıbı (İng. have)", instead: "'…var', '…lı'" },
  { match: "deneyimle", why: "çeviri (İng. experience)", instead: "yaşa-, gör-, hisset-" },
  { match: "anlamına gel", why: "çeviri (İng. it means)", instead: "'yani', 'demek ki'" },
  { match: "söz konusu", why: "resmî yazı dili", instead: "'bu', ya da adını söyle" },
  { match: "sıkış", why: "kalp için günlükte 'kalp sıkışması' (kriz) demek", instead: "kasılıyor, kanı itiyor" },
  { match: "bir şekilde", why: "belirsiz dolgu (İng. somehow)", instead: "nasıl olduğunu söyle ya da sil" },
  { match: "anlar için", why: "çeviri kalıbı (İng. for … moments)", instead: "'bir anlığına', 'kısa süreliğine'" },
  {
    match: "anahtar kapan",
    why: "elektrikte kapanan anahtar akımı geçirir; günlük dilde kapatmak söndürmek demek, izleyici ters anlar",
    instead: "'düğmeye basınca', 'açılınca' (günlük anlamıyla)",
  },
];

/** Entries of the avoid list a phrase uses. */
export const avoidedIn = (text: string) => AVOID.filter((a) => mentions(text, a.match));
