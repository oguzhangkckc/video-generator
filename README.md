# Açıklayıcı video sistemi (Remotion)

Her video tek bir tarif dosyasından üretilir: `videos/<slug>/spec.json`. Görseller bir sahne kütüphanesinden
(`src/kit/`) gelir, kurallar `STYLE.md`'de durur. İlk örnek, "Telefonun konumu nasıl buluyor?" pilotudur
(`videos/gps-pilot/`).

## Kurulum

```bash
nvm use             # .nvmrc'deki sürüm; Node ≥ 22.18 gerekir: script'ler şemayı doğrudan .ts olarak içe aktarır
npm install
npm run studio      # önizleme; videos/ altındaki her tarif "videolar" klasöründe ayrı kompozisyon
```

## Yeni video

Konuyu Claude Code'a verirseniz skill bütün akışı yürütür:

```
/aciklayici-video <konu>                 # otomatik: iki durak
/aciklayici-video adım adım <konu>       # dört durak: açı, metin, sahne planı, kareler
/aciklayici-video gerçek ses <slug>      # taslak sesli videoya gerçek ses; zamanlama, qa, render yeniden
```

**Otomatik mod** iki kez durur:

- **Durak 1, konu ve metin:** açı, kaynaklar, editör bulguları, kanca/final seçenekleri ve dinletilen metin.
- **Durak 2, bitmiş video:** render, qa tablosu ve müdahale kaydı.

Arada `check` ve `qa` hatalarını spec'te kendisi düzeltir. Bir döngü en fazla 5 tur sürer; hata sayısı iki tur üst
üste azalmazsa durur. STYLE.md, qa eşikleri, metin denetimi ve sahne kodu değişmez. Her düzeltme (hata, değişiklik,
neden) kaydedilir. Bir düzeltme o an söylenen nesneyi ekrandan kaldıramaz; hata ancak böyle çözülüyorsa durur.

Bunlar dışında yalnız zorunlu durma noktalarında sorar:

- yeni sahne türü ya da varlık;
- doğrulanamayan iddia;
- kural istisnası;
- TTS bütçesi aşımı;
- sonuçsuz döngü.

Her adımın süresi, turlar, duraklar ve müdahaleler `out/<slug>/run-log.md`'de. Gerçek TTS yoksa ses `say` ile
taslaktır: `out/<slug>.draft.mp4`, yayına uygun değil (`ekg` ve `gps` hariç: onlar gerçek sesi bekler). Ayrıntı:
`.claude/skills/aciklayici-video/SKILL.md`.

Elle yapmak isterseniz:

```bash
npm run new -- uydu-interneti "İnternet uzaydan nasıl geliyor?"   # şablondan videos/uydu-interneti/spec.json
# spec.json'u düzenle: metin, sahneler, ekran yazıları, kaynaklar, krediler
npm run check                                                     # tür kontrolü + tüm tariflerin doğrulaması
npm run stills -- uydu-interneti 0.5s 6s 12s 22s --sheet          # out/uydu-interneti/stills/sheet.png
npm run align -- uydu-interneti ~/Desktop/seslendirme.wav         # Whisper ile kelime zamanları + vo.wav
npm run render -- uydu-interneti                                  # out/uydu-interneti.mp4, −14 LUFS
```

Ses yokken altyazılar ve cümleye bağlı zamanlar tahmini zamanlamayla (2,8 kelime/sn + duraklamalar) çalışır, yani ses gelmeden
de kareler incelenebilir.

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run studio` | Remotion Studio |
| `npm run check` | `tsc` + metin denetimi (`npm run text`) + etiket ↔ seslendirme kontrolü (`src/spec/label-speech.ts`) + her `spec.json`'un doğrulanması ve çözülmesi (hatalar alan yoluyla) |
| `npm run text -- [slug\|metin.json]…` | metin denetimi (`src/spec/script-audit.ts`): "Peki" sınırı, açık final, okunuş, cümle sonu hataları; kaçınılacak ifade uyarıları (`src/spec/avoid.ts`). Argümansız bütün videolar; `out/<slug>/metin/metin.json` (skill c taslağı) her kanca ve final seçeneğiyle denetlenir ve spec'in sonra karşılaşacağı metin kontrollerini de geçer: altyazı sığması (tarayıcıda, `npm run check` ile aynı ölçü; gizli `metin-olcu` kompozisyonu), planlanan etiketlerin (`labels: [{ text, cue, offset? }]`) söyleneni göstermesi ve nicelik tutarlılığı (tahmini zamanlamayla). Bilinçli sapma: `styleExceptions: [{ "rule", "why" }]` → "muaf" |
| `npm run new -- <slug> "<başlık>"` | `videos/sablon`'dan yeni tarif |
| `npm run stills -- <slug> <kare\|12.5s>… [--every N] [--out dir] [--sheet] [--ground]` | still kareler (+ kare sayfası); `--ground`: zemin anahtar renkte, qa'nın boş alan ölçümünün gördüğü gibi |
| `npm run align -- <slug> <ses> [--dry]` | whisper.cpp (yerel) ile kelime zamanları → `timing.json`, `vo.wav` |
| `npm run align -- <slug> --timing [--dry]` | Whisper'sız: mevcut `timing.json`'un kelime zamanlarıyla `vo.wav`'daki kısa cümle aralarına sessizlik ekler |
| `npm run voiceover -- build <slug> [ses] [--provider elevenlabs\|azure\|say] [--estimate] [--over-budget] [--widen] [--offline]` | Seslendirme: her cümle ayrı (komşuları bağlam), cümle başına önbellek (`out/tts-cache/`, bağlam anahtara girmez: yalnız değişen cümle yeniden ücretlenir), cümle aralarına STYLE duraklamaları, tonlaması işaretli cümleye `voiceover.tts.takes` alternatif → `timing.json`, `vo.wav`, `out/<slug>/review.html`. Göndermeden önce üretilecek okumaları, karakterleri ve hesapta kalanı yazar; `voiceover.tts.budget` aşılacaksa durur (`--over-budget` ile onay). `--estimate`: yalnız tahmin. `azure`: SSML (`<break>` duraklamalar, bölümün `stress` kelimeleri vurgulu; `.env`'de `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`). `say`: macOS Yelda, ücretsiz geçici ses — skill'in otomatik modunda gerçek TTS yokken taslak ses (`ekg` ve `gps` hariç), 270 wpm (konuşulan sürede ≈ 2,7 kelime/sn; `scripts/lib/tts/say.mjs`), tonlama ölçülmez, render yalnız `--draft` ile. Sığmazsa tablo basar, `--widen` pencereleri genişletir |
| `npm run voiceover -- voices [--provider p]` / `sample <slug> <ses>…` | seçilebilir sesler / ilk bölümden ses örnekleri (aynı tahmin ve bütçe yolundan) |
| `npm run render -- <slug> [--draft]` | `out/<slug>.mp4`; geçici sesle yalnız `--draft` → `out/<slug>.draft.mp4` (yayına uygun değil) |
| `npm run review -- <slug>` | `review.html`'i yerelde (127.0.0.1) açar: alternatifleri dinle, seç; seçim `voiceover.picks`'e yazılır, ses kredisiz yeniden kurulur |
| `npm run voiceover -- pick <slug> <cümle#> <çekim>` | aynı seçim komut satırından |
| `npm run voiceover -- listen <metin.json> [--provider say] [--sections id,id]` | skill c) taslağını ücretsiz geçici sesle okur → `out/<slug>/metin/ses/` (`tam`, `kanca-1..3`, `final-1..2`, bölüm başına süre; `--sections` yalnız o bölümler → `tam-<id>-<id>`). Yalnız `say`; spec, `timing.json`, `vo.wav` değişmez |
| `npm test` | ses ölçümü, kesim kuralları, telaffuz sözlüğü, cümle türleri, metin denetimi ve nicelik birim testleri |
| `npm run render -- <slug>` | render + mastering (−14 LUFS, ≈ −1,5 dBTP) → `out/<slug>.mp4` |
| `npm run sfx [id…]` | ElevenLabs efektlerini katalogdan üretir → `public/kit/sfx/` |
| `npm run music -- list` | lisanslı müzik kütüphanesini listeler ve doğrular |
| `npm run compare -- <dirA> <dirB>` | kare kare SSIM (ya da iki ses dosyasında null test); regresyon kontrolü |
| `npm run qa -- <slug> [--layout] [--audio] [--every 0.25] [--from s] [--to s]` | otomatik kalite kontrolü (aşağıda); `out/<slug>/qa.json`, hata varsa çıkış kodu 1. `--from`/`--to`: bir bölüm üzerinde çalışırken yalnız o aralığın yerleşimi; son karar tam çalıştırmada. Geçici seste `out/<slug>.draft.mp4`'i denetler |
| `npm run log -- <slug> start\|end <adım> \| round <check\|qa-layout\|qa> [--errors N] [--fixed] \| fix <kapı\|kontrol-listesi> "<hata>" --change … --why … \| stop \| user <adım> \| note \| show` | skill otomatik modunun kaydı: `out/<slug>/run-log.jsonl` → `run-log.md` (adım süreleri, düzeltme turları, düzeltmeler, duraklar, müdahaleler). `round` qa sayılarını `qa.json`'dan okur (kısmi çalıştırmayı tur saymaz), hatalı bir turdan sonra `fix` kaydı ister ve döngünün kararını yazar: `devam`, `temiz`, `İHLAL` (düzeltme `say`'e bağlı, o an söylenen bir öğenin ekranda kalma oranını düşürdü; `qa.json` `said`, aynı cümle zamanlamasında son kurala uyan turla karşılaştırılır) ya da `DUR` (iki tur üst üste azalmadı / 5 turda sıfıra inmedi / hata ancak söylenen öğeyi kaldırarak çözülüyor) |
| `npm run models -- list` | 3D model kütüphanesini doğrular (lisans kaydı) ve parça adlarını listeler |
| `npm run models -- pack <file.gltf> <id> [--max 1024] [--jpeg]` | glTF'i dokuları küçültülmüş tek GLB'ye paketler → `public/kit/models/<id>.glb` |
| `npm run sfx -- --index` | efekt süre dizinini (`src/kit/audio/sfx-durations.json`) API'siz yeniden yazar |

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
| `labels[]`, `notes[]`, `titles[]` | monospace veri satırları (sesiyle; `pointTo: "katman.öğe"` ile panelden sahne öğesine kılavuz çizgisi, öğe adları geçişlerdeki `via` ile aynı), dürüstlük notları, kanca başlıkları |
| `counter`, `countdown`, `concept`, `darken` | sağ üst sayaç, doruk geri sayımı, kavram kartı, final kararması |
| `captions` | karaoke altyazı ayarları (varsayılanlar STYLE'a uygun). `size` sabit yazı boyutu: sayfa küçülmez, uzun cümle 2–6 kelimelik iki sayfaya bölünür |
| `sound` | `beds[]` (konuşmada kısılan ambiyans), `hits[]` (efektler), `music` (lisanslı parça) |
| `sources[]` | her iddia: değer, url, erişim tarihi, `verified` / `simplified` / `disputed` |
| `credits[]` | her model, ses, doku, yazı tipi, müzik ve kod: sahibi + lisansı |
| `styleExceptions[]` | STYLE.md'den bilinçli sapmalar ve gerekçeleri |
| `layout` | güvenli alan: `rightInset` (132), `contentWidth` (840); yazılar sağdaki 120 px'e girmez |
| `timeline` | kaynaklı değerler: `keys.<ad> = { value, source: "<sources[].id>" }`; spec'te `"#ad"` diye kullanılır |
| `template` | yalnız `videos/sablon`: `[yer tutucu]` metinlerine izin verir; `npm run new` bu bayrağı siler |

**Zaman yazımı.** Zaman alan her alan şunlardan birini kabul eder:

- sayı (saniye)
- işaret: `"@signal"`, `"@signal+0.35"`, aralığın ucu `"@lock.start"`, `"@slide.end-0.2"`. `"@end"` hazır gelir.
- cümleye bağlı: `{ "cue": "Peki ya", "offset": -0.3 }` → o cümlenin başladığı an

Cümleye bağlı zamanlar ses değişince kendiliğinden kayar. `@` ile başlayan metinler işaret sayılır.

**Kaynaklı değerler.** Eğri değerleri ve tür parametreleri (ör. `trace` dalga aralıkları, `flow` sinyal aralıkları)
`"#ad"` alabilir; değer `timeline.keys`'ten gelir, her anahtar bir `sources[].id`'ye bağlıdır. Spec'te `timeline`
varsa sayacın gösterdiği her değer ya `"#ad"` ya da `"realtime": true` bir segmentten gelmek zorundadır. Sayaç
3 sn'den uzun aynı değeri gösteremez (bilinçli duraklama: `counter.holds`). Hepsini `npm run check` denetler.

**Şablon yer tutucuları.** `videos/sablon` metinleri `[köşeli parantez]` içindedir. `template: true` olmayan bir
spec'te köşeli parantezli metin kalırsa `npm run check` alan yoluyla hata verir.

**Zamanlama dosyası.** `videos/<slug>/timing.json` elle düzenlenmez; `align` ya da `voiceover` yazar. Metin
değişirse eskir: Studio uyarı verip tahmini zamanlamaya düşer, render ise hata verir.

## Sahne türleri

**Katmanlar** (`layers[]`, `type` alanıyla):

| Tür | Ne işe yarar | Ana parametreler |
|---|---|---|
| `globe` | 3D gezegen (NASA gece dokusu), atmosfer, yıldızlar; isteğe bağlı yörüngeler, kahraman uydu, yayın parlaması | `window`, `texture`, `location`, `orbits`, `hero`, `flash`, `camera[]` |
| ↳ `camera[]` | ilkel çekimler: `pullback` (yüzeyden geniş plana, eğriyle), `follow` (uyduyu arkadan, dönerek), `descend` (önceki çekimden konuma iniş); `blendIn` ile yumuşak geçiş | `from`, çekime göre `progress` / `curve` / `blendIn` |
| `cityMap` | prosedürel, soyut gece şehri ve konum işaretçisi; zoom bir eğriyi izler; işaretçi kayabilir (hata) | `visible[]`, `zoom`, `rotation`, `marker`, `offset`, `seed` |
| `model3d` | GLB model (`public/kit/models`, lisansı `<id>.json`'da): kamera anahtar kareleri (yörünge açısı, yükseklik, uzaklık, hedef parça), parça vurgulama (renk anlamıyla), kesit düzlemi (`section.close` ile geri kapanır; patlatmadan önce kapat), patlatma. Vurgulanan ve hedeflenen parçalar panel/altyazıdan mercek kaydırmasıyla uzak tutulur (`layout.framing`). Parça adları ve `credits` kaydı `npm run check`'te doğrulanır | `window`, `file`, `camera[]`, `orbitDegPerSec`, `highlight[]`, `dimOthers`, `section`, `explode` |
| `flow` | 2D şema (tam ekran): bölgeler (dolgu, kaynaktan yayılan renk), yollar, düğümler (`glow`/`dot`/`ring`/`pad`), yollar boyunca ilerleyen sinyaller, alan halkaları. Öğelere `say` takma adları (seslendirme onları söylerken önemli ve ekranda) | `regions[]`, `paths[]`, `nodes[]`, `signals[]`, `fields[]`, `highlight[]`, `camera[]`, `drift`, `anchorY`, `say` |
| `trace` | monitör/grafik çizgisi; kalem bir saat eğrisini izler (gerçek zaman ya da ağır çekim). Dalga biçimi parametre: `ecg` ön ayarı, `sine`, `square`, `saw`, `samples`. `parts` çizilirken adlandırılır: `marker: "leader"` (üstte, kılavuzla) ya da `"bracket"` (altta, köşeli parantezle). `panel: { top, height }` ile sahne değil, koyu zeminli veri şeridi | `clock`, `waveform`, `grid`, `parts[]`, `penX`, `baselineY`, `anchorY`, `camera[]`, `beep`, `panel` |
| ↳ `camera[]` (2D) | flow ve trace'in ortak düz kamerası (`camera2d`): `{ at, focus, zoom, rotate, easing, kind, subject }` + `drift` (asla donmaz). `kind`: wide/medium/close (yoksa zoom'dan); `subject`: çekimin konusu (qa ≥ %35). Kamera önemli öğeleri panel/şerit/altyazıdan kendiliğinden uzak tutar (`layout.framing`, `src/kit/framing.ts`) | `focus`: düğüm adı, `"pen"` / `"frame"` ya da `[x, y]` |
| ↳ `transitions[]` | iki sahnenin örtüştüğü her an: `{ at, from, to, kind: "through" \| "match" \| "flash", via: { from, to }, why }`; `npm run check` beyansız geçişi ve gerekçesiz `flash`'ı reddeder. **Şekil eşleştirme:** `via` öğeleri o anda aynı yerde (qa ölçer) | katman adı: `id`, yoksa `tür#sıra` |
| `haze` | **nesnenin içinden geçme:** atmosfer pusu | `envelopes[]` |
| `speedLines` | ışık hızı çizgileri | `envelope` |
| `signalPass` | **halkanın içinden geçme:** bir küredeki 3D noktadan çıkıp kameradan geçen halkalar | `anchor` {`layer`, `point`}, `emits[]` |
| `ringShrink` | **şekil eşleştirme:** ekranı dolduran halka işaretçinin halesine oturur | `range`, `toRadius` |

Örnekler: `videos/demo-model3d`, `videos/demo-flow`, `videos/demo-trace`.

**Üst yazılar** (sabit sırayla en üstte): `labels` → `notes` → `titles` → `darken` → `countdown` → `concept` →
`counter` → `captions`. Renkler anlamsal adlarla yazılır: `text`, `you`, `danger`, `secondary`, `marker`, `muted`.

**Yeni tür eklemek:**

1. Bileşeni ve zod şemasını `src/kit/<kategori>/` altına koyun. Renk ve font yalnızca `src/kit/theme.ts`'ten gelir;
   hikâyeye özgü her sabit bir parametre olur. Zemin (gradyan, uzay, pus) `useGround()` ile çizilir: qa boş alanı
   ölçerken zemini anahtar renge boyar; sabit renkle çizilen zemin içerik sayılır.
2. Türü `src/spec/schema.ts`'teki layer birleşimine ve `src/kit/registry.tsx`'e ekleyin; TypeScript eksik kaydı
   yakalar.
3. Bu tabloya bir satır ekleyin.
4. GPS regresyonunu çalıştırın:
   `npm run stills -- gps-pilot --every 10 --out out/regress/frames` ve ardından
   `npm run compare -- out/baseline/frames out/regress/frames`. Referans kareler değişiklikten önce aynı komutla
   `out/baseline/frames`'e alınır. Ses değiştiyse ayrıca render alıp null testi:
   `npm run compare -- out/baseline/gps-pilot.mp4 out/gps-pilot.mp4`.

## Ses

- **Seslendirme:** İnsan kaydı ya da herhangi bir TTS → `npm run align`. Hizalama whisper.cpp ile yerelde yapılır,
  ücretsizdir; model ~1,6 GB'tır ve `out/whisper/` altına bir kez iner. Whisper'ın yazımı senaryodan farklı olsa da
  ("20.000" / "yirmi bin") kelimeler senaryoya hizalanır ve altyazıda senaryo görünür. Sonda yükselen ya da kesik
  biten cümleler "yeniden kaydet" listesine düşer.
- **Telaffuz sözlüğü:** `src/spec/lexicon.ts`. Kısaltma, birim ve sembollerin okunuşu (QRS → "kü re se"); TTS'e ve
  Whisper eşleştirmesine okunuş, altyazıya yazılış gider. Sözlükte olmayan kısaltma `npm run check`'te hata verir.
- **Ölçüm:** `scripts/lib/speech.mjs` (duraklama, sessizlik, kesim noktası, sessizlik ekleme) ve `scripts/prosody.py`
  (Praat/parselmouth ile cümle sonu perde yükselmesi ve sönüm). Python bağımlılıkları `uv run` ile kendiliğinden
  kurulur; `uv` gerekir.
- **Efektler:** `src/kit/audio/sfx-catalog.json` (istem, süre, miks seviyesi) → `npm run sfx`. Ham çıktılar
  `out/sfx-raw/` içinde saklanır; seviye ayarı kredi harcamaz.
- **Müzik:** lisanslı yerel kütüphane, `public/kit/music/`. Her parçanın yanına aynı adlı bir JSON konur:

  ```json
  { "title": "…", "author": "…", "license": "…", "url": "https://…", "downloaded": "2026-11-18", "moods": ["gerilim", "ambient"] }
  ```

  `npm run music -- list` kütüphaneyi doğrular ve parça başına başlangıç `gain`'i önerir. Kütüphanede dört CC0
  ambiyans parçası var (OpenGameArt). Müzik kullanılmayan videoda `space` drone yatağı `loop: true` ile baştan
  sona kesintisiz çalar (eşit güçlü çapraz geçişli döngü). ElevenLabs Music API ücretsiz planda kapalıdır.
- **3D modeller:** `public/kit/models/<id>.glb` + `<id>.json` (`title`, `author`, `license`, `url`,
  `downloaded`). CC0 tercih edilir; modeli kullanan spec'in `credits`'inde `kind: "model"` ve aynı `url` zorunludur.

## Kalite kontrolü (`npm run qa`)

- **Yerleşim** (render gerekmez): her 0,25 sn'de bir kare tarayıcıda açılır, üst yazıların kutuları
  `@remotion/layout-utils` ile ölçülür. Yazılar birbirine ya da altyazıya biniyorsa, sağdaki 120 px'e ya da alttaki
  %15'e taşıyorsa hata. Sahnelerin kendi yazıları da (`QA_LAYER` `texts`: veri çizgisi etiketleri, ölçek notu) bütün
  yazılara karşı denetlenir; altyazı bandına giren her yazı, panelinden taşan şerit yazısı ve başlığa ya da altyazı
  bandına giren veri çizgisi hata.
- **Kapak** (ilk 3 sn): her 2 karede bir, belirmekte olan yazılar dahil, süre payı olmadan: çakışma, güvenli alan,
  önemli öğe, özne, boş alan tek karede bile hata; kare 0'da kanca başlığı olmalı. Kare 0 → `out/<slug>/cover.png`.
- **Kompozisyon** (render gerekmez; sahneler her karede önemli öğelerini, öznelerini, veri etiketlerini raporlar,
  `QA_LAYER`): önemli öğe üst yazı / şerit / altyazı altında (nokta hiç, alan en fazla %25) hata; önemli öğe
  kareden taşıyor (nokta hiç, alan en fazla %25; 0,5 sn, giriş/çıkışta 1 sn) hata; özne < %35 yükseklik
  2 sn'den uzun hata; kare > %40 boş 1 sn'den uzun hata (tam boyutlu karede 40 px hücreler; zemin anahtar renge boyanıp ölçülür,
  dolgulu şekil içeriktir); özne kenarda kırpılıyor
  (yakın plan değilse) uyarı; söylenen öğe cümlenin yarısında ekranda değil hata; veri etiketleri değiyor ya da
  çizgiyi kesiyor hata; `pointTo` öğesi ekranda değil ya da kılavuzu başka bir yazının üstünden geçiyor hata;
  altyazı boyutu değişiyor ya da sayfa satıra sığmıyor hata; bir seslendirme bölümünde ana sahnenin öznesi 1 sn
  kesintisiz tamamen kadraja girmiyor uyarı (bağlam planı); şekil eşleştirme öğeleri aynı yerde değil, içinden geçişte kare dolmuyor, geçişte kare > %60
  boş hata. Render varsa 0,3 sn'den uzun donma hata. Örnekler: `out/<slug>/qa-samples.json`.
- **Seslendirme** (`vo.wav` üzerinde, dinleyicinin duyduğu gibi): konuşulan sürede 2,6–3,0 kelime/sn dışındaysa
  uyarı; cümle sonu arası 0,25 sn'den kısaysa uyarı, ortalaması 0,35 sn'nin altındaysa hata; sonda +2 yarım tondan
  fazla yükselen ya da 60 ms'den kısa sönen cümle uyarı (insan kaydında "yeniden kaydet"); birimli bir etiket
  ekrandayken seslendirme başka bir niceliği adlandırıyorsa uyarı. Geçici seste (`say`) hız ve duraklamalar
  ölçülür, tonlama ölçülmez ("taslak ses, ölçülmedi").
- **Ses** (render sonrası): son 0,7 sn dışında 0,3 sn'den uzun dijital sessizlik hata; bir yatak ya da müzik hâlâ
  duyulması gerekirken dosya biterse hata.

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
- **3D model:** Flight Helmet (Gary Hsu, Khronos glTF-Sample-Assets), CC0 1.0. **Müzik:** OpenGameArt, CC0 1.0.
- **Şehir haritası** gerçek veri içermez; tamamen prosedürel ve soyuttur. Yörüngeler ölçekli değildir.
