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
| `npm run voiceover -- build <slug> <voiceId> [--widen] [--speed 1.0]` | ElevenLabs taslak seslendirme, cümle cümle, kurallı duraklamalarla → `timing.json`, `vo.wav`; sığmazsa tablo basar, `--widen` pencereleri genişletir |
| `npm run render -- <slug>` | render + mastering (−14 LUFS, ≈ −1,5 dBTP) → `out/<slug>.mp4` |
| `npm run sfx [id…]` | ElevenLabs efektlerini katalogdan üretir → `public/kit/sfx/` |
| `npm run music -- list` | lisanslı müzik kütüphanesini listeler ve doğrular |
| `npm run compare -- <dirA> <dirB>` | kare kare SSIM (ya da iki ses dosyasında null test); regresyon kontrolü |
| `npm run qa -- <slug> [--layout] [--audio] [--every 0.25]` | otomatik kalite kontrolü (aşağıda); `out/<slug>/qa.json`, hata varsa çıkış kodu 1 |
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
| `labels[]`, `notes[]`, `titles[]` | monospace veri satırları (sesiyle), dürüstlük notları, kanca başlıkları |
| `counter`, `countdown`, `concept`, `darken` | sağ üst sayaç, doruk geri sayımı, kavram kartı, final kararması |
| `captions` | karaoke altyazı ayarları (varsayılanlar STYLE'a uygun) |
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
| `model3d` | GLB model (`public/kit/models`, lisansı `<id>.json`'da): kamera anahtar kareleri (yörünge açısı, yükseklik, uzaklık, hedef parça), parça vurgulama (renk anlamıyla), kesit düzlemi, patlatma. Parça adları ve `credits` kaydı `npm run check`'te doğrulanır | `window`, `file`, `camera[]`, `orbitDegPerSec`, `highlight[]`, `dimOthers`, `section`, `explode` |
| `flow` | 2D şema: bölgeler (dolgu, kaynaktan yayılan renk), yollar, düğümler (`glow`/`dot`/`ring`/`pad`), yollar boyunca ilerleyen sinyaller, alan halkaları | `regions[]`, `paths[]`, `nodes[]`, `signals[]`, `fields[]`, `highlight[]`, `camera[]`, `drift`, `anchorY` |
| `trace` | monitör/grafik çizgisi; kalem bir saat eğrisini izler (gerçek zaman ya da ağır çekim). Dalga biçimi parametre: `ecg` ön ayarı, `sine`, `square`, `saw`, `samples`. `parts` çizilirken adlandırılır (P, QRS, T…) | `clock`, `waveform`, `grid`, `parts[]`, `penX`, `baselineY`, `anchorY`, `camera[]`, `beep` |
| ↳ `camera[]` (2D) | flow ve trace'in ortak düz kamerası (`camera2d`): `{ at, focus, zoom, rotate, easing }` + `drift` (asla donmaz). **Şekil eşleştirme:** iki katman aynı `anchorY` ve zoom'da odak noktasını gösterince turuncu nokta (`MATCH_DOT_R`) birebir örtüşür | `focus`: düğüm adı, `"pen"` / `"frame"` ya da `[x, y]` |
| `haze` | **nesnenin içinden geçme:** atmosfer pusu | `envelopes[]` |
| `speedLines` | ışık hızı çizgileri | `envelope` |
| `signalPass` | **halkanın içinden geçme:** bir küredeki 3D noktadan çıkıp kameradan geçen halkalar | `anchor` {`layer`, `point`}, `emits[]` |
| `ringShrink` | **şekil eşleştirme:** ekranı dolduran halka işaretçinin halesine oturur | `range`, `toRadius` |

Örnekler: `videos/demo-model3d`, `videos/demo-flow`, `videos/demo-trace`.

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
   `out/baseline/frames`'e alınır. Ses değiştiyse ayrıca render alıp null testi:
   `npm run compare -- out/baseline/gps-pilot.mp4 out/gps-pilot.mp4`.

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

  `npm run music -- list` kütüphaneyi doğrular ve parça başına başlangıç `gain`'i önerir. Kütüphanede dört CC0
  ambiyans parçası var (OpenGameArt). Müzik kullanılmayan videoda `space` drone yatağı `loop: true` ile baştan
  sona kesintisiz çalar (eşit güçlü çapraz geçişli döngü). ElevenLabs Music API ücretsiz planda kapalıdır.
- **3D modeller:** `public/kit/models/<id>.glb` + `<id>.json` (`title`, `author`, `license`, `url`,
  `downloaded`). CC0 tercih edilir; modeli kullanan spec'in `credits`'inde `kind: "model"` ve aynı `url` zorunludur.

## Kalite kontrolü (`npm run qa`)

- **Yerleşim** (render gerekmez): her 0,25 sn'de bir kare tarayıcıda açılır, üst yazıların kutuları
  `@remotion/layout-utils` ile ölçülür. Yazılar birbirine ya da altyazıya biniyorsa, sağdaki 120 px'e ya da alttaki
  %15'e taşıyorsa hata. Üst yazılar kapatılmış karede bir etiket kutusunun içinden parlak çizgi geçiyorsa uyarı.
- **Ses** (render sonrası): konuşma hızı genel 2,2–2,8 kelime/sn dışındaysa hata, bölüm hedeften %20 saparsa uyarı;
  son 0,7 sn dışında 0,3 sn'den uzun dijital sessizlik hata; bir yatak ya da müzik hâlâ duyulması gerekirken dosya
  biterse hata.

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
