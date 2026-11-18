# Açıklayıcı video sistemi (Remotion)

Her video tek bir tarif dosyasından üretilir: `videos/<slug>/spec.json`. Görseller bir sahne kütüphanesinden
(`src/kit/`) gelir, kurallar `STYLE.md`'de durur. İlk örnek, "Telefonun konumu nasıl buluyor?" pilotudur
(`videos/gps-pilot/`).

## Kurulum

```bash
nvm use 22          # Node 22+ gerekir: script'ler şemayı doğrudan .ts olarak içe aktarır
npm install
npm run studio      # önizleme; videos/ altındaki her tarif "videolar" klasöründe ayrı kompozisyon
```

## Yeni video

Konuyu Claude Code'a verirseniz skill bütün akışı onay noktalarıyla yürütür:

```
/aciklayici-video <konu>
```

Elle yapmak isterseniz:

```bash
npm run new -- uydu-interneti "İnternet uzaydan nasıl geliyor?"   # şablondan videos/uydu-interneti/spec.json
# spec.json'u düzenle: metin, sahneler, ekran yazıları, kaynaklar, krediler
npm run check                                                     # tür kontrolü + tüm tariflerin doğrulaması
npm run stills -- uydu-interneti 0.5s 6s 12s 22s --sheet          # out/uydu-interneti/stills/sheet.png
npm run align -- uydu-interneti ~/Desktop/seslendirme.wav         # Whisper ile kelime zamanları + vo.wav
npm run render -- uydu-interneti                                  # out/uydu-interneti.mp4, −14 LUFS
```

Ses yokken altyazılar ve cümleye bağlı zamanlar tahmini zamanlamayla (2,5 kelime/sn) çalışır, yani ses gelmeden
de kareler incelenebilir.

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run studio` | Remotion Studio |
| `npm run check` | `tsc` + her `spec.json`'un doğrulanması ve çözülmesi (hatalar alan yoluyla) |
| `npm run new -- <slug> "<başlık>"` | `videos/sablon`'dan yeni tarif |
| `npm run stills -- <slug> <kare\|12.5s>… [--every N] [--out dir] [--sheet]` | still kareler (+ kare sayfası) |
| `npm run align -- <slug> <ses> [--dry]` | whisper.cpp (yerel) ile kelime zamanları → `timing.json`, `vo.wav` |
| `npm run voiceover -- build <slug> <voiceId>` | ElevenLabs taslak seslendirme → `timing.json`, `vo.wav` |
| `npm run render -- <slug>` | render + mastering (−14 LUFS, ≈ −1,5 dBTP) → `out/<slug>.mp4` |
| `npm run sfx [id…]` | ElevenLabs efektlerini katalogdan üretir → `public/kit/sfx/` |
| `npm run music -- list` | lisanslı müzik kütüphanesini listeler ve doğrular |
| `npm run compare -- <dirA> <dirB>` | kare kare SSIM (ya da iki ses dosyasında null test); regresyon kontrolü |

## Tarif formatı (`spec.json`)

Şema `src/spec/schema.ts`'te (zod). Tam bir örnek için `videos/gps-pilot/spec.json`'a bakın.

| Alan | İçerik |
|---|---|
| `title`, `lang`, `durationSec` | başlık, dil (`tr`), süre (sn); format sabit: 1080×1920, 30 fps |
| `voiceover.sections[]` | `id`, `window` [başlangıç, bitiş] sn, `phrases[]` (her cümle bir altyazı sayfası) |
| `voiceover.audio`, `voice` | isteğe bağlı; ses yolu varsayılan olarak `timing.json`'dan gelir |
| `marks` | adlandırılmış zamanlar ve aralıklar (`"signal": 15`, `"lock": [11, 13]`) |
| `curves` | parçalı eğriler (doğrusal / log, easing); sayaç, harita zoom'u ve 3D kamera aynı eğriyi kullanır |
| `layers[]` | sahneler ve geçişler, dizi sırasıyla çizilir (aşağıdaki tablo) |
| `labels[]`, `notes[]`, `titles[]` | monospace veri satırları (sesiyle), dürüstlük notları, kanca başlıkları |
| `counter`, `countdown`, `concept`, `darken` | sağ üst sayaç, doruk geri sayımı, kavram kartı, final kararması |
| `captions` | karaoke altyazı ayarları (varsayılanlar STYLE'a uygun) |
| `sound` | `beds[]` (konuşmada kısılan ambiyans), `hits[]` (efektler), `music` (lisanslı parça) |
| `sources[]` | her iddia: değer, url, erişim tarihi, `verified` / `simplified` / `disputed` |
| `credits[]` | her model, ses, doku, yazı tipi, müzik ve kod: sahibi + lisansı |
| `styleExceptions[]` | STYLE.md'den bilinçli sapmalar ve gerekçeleri |

**Zaman yazımı.** Zaman alan her alan şunlardan birini kabul eder:

- sayı (saniye)
- işaret: `"@signal"`, `"@signal+0.35"`, aralığın ucu `"@lock.start"`, `"@slide.end-0.2"`. `"@end"` hazır gelir.
- cümleye bağlı: `{ "cue": "Peki ya", "offset": -0.3 }` → o cümlenin başladığı an

Cümleye bağlı zamanlar ses değişince kendiliğinden kayar. `@` ile başlayan metinler işaret sayılır.

**Zamanlama dosyası.** `videos/<slug>/timing.json` elle düzenlenmez; `align` ya da `voiceover` yazar. Metin
değişirse eskir: Studio uyarı verip tahmini zamanlamaya düşer, render ise hata verir.

## Sahne türleri

**Katmanlar** (`layers[]`, `type` alanıyla):

| Tür | Ne işe yarar | Ana parametreler |
|---|---|---|
| `globe` | 3D gezegen (NASA gece dokusu), atmosfer, yıldızlar; isteğe bağlı yörüngeler, kahraman uydu, yayın parlaması | `window`, `texture`, `location`, `orbits`, `hero`, `flash`, `camera[]` |
| ↳ `camera[]` | ilkel çekimler: `pullback` (yüzeyden geniş plana, eğriyle), `follow` (uyduyu arkadan, dönerek), `descend` (önceki çekimden konuma iniş); `blendIn` ile yumuşak geçiş | `from`, çekime göre `progress` / `curve` / `blendIn` |
| `cityMap` | prosedürel, soyut gece şehri ve konum işaretçisi; zoom bir eğriyi izler; işaretçi kayabilir (hata) | `visible[]`, `zoom`, `rotation`, `marker`, `offset`, `seed` |
| `haze` | **nesnenin içinden geçme:** atmosfer pusu | `envelopes[]` |
| `speedLines` | ışık hızı çizgileri | `envelope` |
| `signalPass` | **halkanın içinden geçme:** bir küredeki 3D noktadan çıkıp kameradan geçen halkalar | `anchor` {`layer`, `point`}, `emits[]` |
| `ringShrink` | **şekil eşleştirme:** ekranı dolduran halka işaretçinin halesine oturur | `range`, `toRadius` |

**Üst yazılar** (sabit sırayla en üstte): `labels` → `notes` → `titles` → `darken` → `countdown` → `concept` →
`counter` → `captions`. Renkler anlamsal adlarla yazılır: `text`, `you`, `danger`, `secondary`, `marker`, `muted`.

**Yeni tür eklemek:**

1. Bileşeni ve zod şemasını `src/kit/<kategori>/` altına koyun. Renk ve font yalnızca `src/kit/theme.ts`'ten gelir;
   hikâyeye özgü her sabit bir parametre olur.
2. Türü `src/spec/schema.ts`'teki layer birleşimine ve `src/kit/registry.tsx`'e ekleyin; TypeScript eksik kaydı
   yakalar.
3. Bu tabloya bir satır ekleyin.
4. GPS regresyonunu çalıştırın:
   `npm run stills -- gps-pilot --every 10 --out out/regress/frames` ve ardından
   `npm run compare -- out/baseline/frames out/regress/frames`. Referans kareler değişiklikten önce aynı komutla
   `out/baseline/frames`'e alınır.

## Ses

- **Seslendirme:** İnsan kaydı ya da herhangi bir TTS → `npm run align`. Hizalama whisper.cpp ile yerelde yapılır,
  ücretsizdir; model ~1,6 GB'tır ve `out/whisper/` altına bir kez iner. Whisper'ın yazımı senaryodan farklı olsa da
  ("20.000" / "yirmi bin") kelimeler senaryoya hizalanır ve altyazıda senaryo görünür.
- **Efektler:** `src/kit/audio/sfx-catalog.json` (istem, süre, miks seviyesi) → `npm run sfx`. Ham çıktılar
  `out/sfx-raw/` içinde saklanır; seviye ayarı kredi harcamaz.
- **Müzik:** lisanslı yerel kütüphane, `public/kit/music/`. Her parçanın yanına aynı adlı bir JSON konur:

  ```json
  { "title": "…", "author": "…", "license": "…", "url": "https://…", "downloaded": "2026-11-18", "moods": ["gerilim", "ambient"] }
  ```

  `npm run music -- list` kütüphaneyi doğrular ve parça başına başlangıç `gain`'i önerir. Kütüphane boşken
  `space` drone yatağı kullanılır. ElevenLabs Music API ücretsiz planda kapalıdır.

## GPS pilotu ve regresyon

`videos/gps-pilot` eski tek-video kodunun tarife çevrilmiş halidir. Dönüşüm doğrulandı: 90 karenin (her 10
karede bir) hepsi eskisiyle SSIM 1,000; ses bit düzeyinde aynı. Pilot STYLE.md'den önce yapıldı; sapmaları
`styleExceptions` alanında listeli. Eski kaynak kod `out/legacy/` altında (git dışında) duruyor.

## Lisans notları

- **ElevenLabs ücretsiz plan** çıktıları (pilotun sesi ve efektleri) **ticari kullanılamaz**. Ticari yayın için
  ücretli plan ya da insan seslendirmesi gerekir.
- **Remotion:** 3 kişiden büyük şirketlerde şirket lisansı gerekir (remotion.dev/license).
- **Doku:** NASA Black Marble 2016, kamu malı (NASA Goddard'a kredi verilir).
- **Yazı tipleri:** Inter ve JetBrains Mono (SIL OFL 1.1). **three.js:** MIT.
- **Şehir haritası** gerçek veri içermez; tamamen prosedürel ve soyuttur. Yörüngeler ölçekli değildir.
