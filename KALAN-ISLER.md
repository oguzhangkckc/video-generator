# Kalan işler

Son güncelleme: 2026-11-24. Branch: `feat/genel-sahne-turleri` (push yok, PR yok).

## Yapılanlar (commit sırasıyla)

| Commit | İş |
|---|---|
| `c13d826` | Seslendirmede nefes payı: duraklama kuralları (`src/spec/pauses.ts`), konuşulan sürede hız ölçümü |
| `d078f12` | EKG: eski taslak sese `align --timing` ile sessizlik eklendi (58,8 sn) |
| `27cdfa3` | Seslendirme sistemi v2 (Aşama A, kredisiz). Ayrıntı: aşağıda "Seslendirme v2". |
| `269d65f` | Görsel altyapı: sahne raporları (`QA_LAYER`), kompozisyon qa'sı, kadraj çözücüsü (kapalı); gps-pilot birebir aynı kaldı |
| `a327b2a` | Görsel sistem v2. Ayrıntı: aşağıda "Görsel sistem v2". |
| `2918510` | Boş alan ölçümü (karar 1a): yalnız zemin boş sayılır. Ayrıntı: aşağıda. |
| `69e0f9d` | gps-pilot qa'dan temiz geçti, regresyon referansı yenilendi; önemli öğe kare dışı kontrolü. Ayrıntı: aşağıda "gps-pilot düzeltmeleri". |
| `9da5c71` | EKG qa'dan temiz geçti; etiketler kalp bölümlerinde yukarıda. Ayrıntı: aşağıda "EKG düzeltmeleri". |
| `a88b4b4` | demo-flow ve demo-model3d qa'dan temiz geçti; model3d `section.close`. Ayrıntı: aşağıda "Demo düzeltmeleri". |
| `52b6422` | Üst yazı etiketlerine `pointTo`: panelden sahne öğesine kılavuz çizgisi. Ayrıntı: aşağıda "pointTo". |
| (commit'lenmedi) | EKG: SA, AV ve HIS → PURKİNJE etiketlerinde kılavuz; alttan çıkan kılavuz yalnız en alt satırın. |

**Seslendirme v2 (`27cdfa3`):**
- bölüm bölüm üretim, duraklamalar sessizlikten açılır;
- Praat ile tonlama ölçümü, işaretli cümleye 3 alternatif;
- `review.html` + `npm run review`;
- telaffuz sözlüğü (`src/spec/lexicon.ts`), nicelik tutarlılığı (`src/spec/quantities.ts`);
- EKG metni yeni kurallara göre değişti, eski sesi kaldırıldı.

**Görsel sistem v2 (`a327b2a`):**
- tam ekran sahne, bant yok; EKG şeridi koyu panelli veri şeridi;
- kadraj çözücüsü açık; geçiş beyanları (`transitions`);
- veri çizgisi etiketleri: aralık köşeli parantezle altta, nokta kılavuzla üstte;
- beş spec güncellendi.

Kurallar `STYLE.md`'de, adımlar `.claude/skills/aciklayici-video/SKILL.md`'de, komutlar `README.md`'de.

**Boş alan ölçümü (`2918510`):** qa boş alan karesini `qa.ground` ile render eder; zemin (gradyan, uzay, pus)
`src/kit/ground.ts`'teki anahtar renge (magenta) boyanır. Hücre boş = yalnız zemin görünüyor (karartma, panel,
gölge altındaki zemin de boş). Dolgulu şekil içerik. Normal render piksel piksel aynı kaldı (8 karede doğrulandı).
Yeni sahne türleri zemini `useGround()` ile çizmeli (README, SKILL.md).

**gps-pilot düzeltmeleri (2026-11-24):**
- qa sistemi: globe uyduyu gerçek ekran boyutuyla raporlar, kameranın arkasındaysa gizli sayar (8,5 sn'deki "uydu
  sayacın altında" sahteydi), inişte flaş bitince önemsiz sayar. Yeni kontrol: önemli öğe kareden taşıyor (kenarda
  0,5 sn; belirirken / önemini yitirirken 1 sn). STYLE, README, SKILL güncel.
- spec: 2,4–3,2 sn'de 1 → 150 km hızlı yükseliş; harita kendi eğrisinde (`mapAltitude`) 0,8–0,9 km'de kalır, 3,0–3,5
  sn'de 150 km'deki net dünyaya eşleşerek erir (boşluk ve bulanık dünya yok). Geniş çekim `wideRadius` 4,5; kilit
  10,6 sn; takip çekimi `lift` 0,9, `back` 2,2, `aimBelow` 0,78 (uydu sayacın altında, sinyal anında kare içinde).
  `space` yatağı 2,6 sn'de başlar.
- `hero.say: ["yukarı"]` kaldırıldı: "Yirmi bin kilometre yukarıda" söylenirken uydu kameranın arkasında; "yukarı"
  yüksekliği anlatıyor (sayaç). qa bunu uyarı olarak bildirir.
- Sonuç: render + tam qa 0 hata, 6 uyarı (kenar kırpması, bağlam, eski sesten 3 duraklama + 1 tonlama).
  Önce/sonra: `out/gps-pilot-once-sonra.png` (üst satır referans, alt satır yeni; 2,7 / 4 / 11 / 13,3 / 15 sn).
- Regresyon referansı kullanıcı onayıyla yenilendi (2026-11-24): `out/baseline/frames` (90 kare) ve
  `out/baseline/gps-pilot.mp4`. Eski referans `out/baseline-2026-11-18/`.

**EKG düzeltmeleri (2026-11-24):** render + tam qa 0 hata (önce 10), 2 uyarı (kalp kenarda kırpılıyor; ses yok).
Önce/sonra: `out/ekg-once-sonra.png` (9 / 18,9 / 22 / 26 / 34 / 45 / 54 sn).
- Kullanıcı onayıyla: kalp bölümlerinde (18,9–49,4 sn) veri etiketleri `top` 150 / 220 / 290 (sayacın solu);
  STYLE'a istisna eklendi. Sebep: etiket paneli 382–616'da kalınca SA, AV ve sol duvar sinyali panelden kaçsın diye
  kalp en fazla ~1,2× olabiliyordu, kare %50–60 boş kalıyordu.
- Kamera: geçişte gövde kamerası monitör kaybolana kadar `e2`'de bekler (6,06 sn kayması kameranın erken
  kalkmasıydı, dalga değil); gövde 0,66 / 0,72; dalışta deri 0,4 sn geç kaybolur; SA 2,0–2,05× (SA y≈470), kulakçık
  2,0×, AV 1,85–1,9× (AV y≈410, karıncıkların şerit altında kalanı %25'ten az), QRS ve final 1,6–1,72× (karıncıklar
  şeridin üstünde, finalde yavaş yaklaşma → donma yok).
- Ders: önemli bir alan (kulakçık) kareden %20'den fazla taşarsa kadraj çözücüsü uzaklaşır ve kare boşalır;
  yaklaşmayı bölgenin genişliğine göre sınırla (kalp için ≈ 2,05×).
- Araçlar: `npm run stills -- <slug> … --ground` (qa'nın boş alanı nasıl gördüğü), `npm run qa -- <slug> --layout
  --from s --to s` (bölüm üzerinde hızlı deneme).

**Demo düzeltmeleri (2026-11-24):** ikisi de render + tam qa 0 hata, 1 uyarı (kenar kırpması). Önce/sonra:
`out/demo-flow-once-sonra.png`, `out/demo-model3d-once-sonra.png` (üst satır eski render, alt satır yeni).
- demo-flow: ince çizgilerle kare %90 boştu (çizgi ancak geçtiği hücreleri doldurur). Şema üç dolgulu bölgeye
  (`surface`) çevrildi: altta ev, ortada sağlayıcı, üstte veri merkezi; paket aşağıdan yukarı çıkar, kamera izler, sonda
  bütün şema. En boş kare %22. Telefon ile router aynı yükseklikte: Wi-Fi halkası telefona ulaştıktan sonra telefon 1,5
  sn önemli kalır, kamera yukarı kayarken altyazının altına girmesin.
- demo-model3d: kesit hiç kapanmıyordu, patlatma yarısı kesik modelde oluyordu (kare %85 boş). Yeni şema alanı
  `section.close`: kesit o aralıkta geri kapanır (verilmezse eskisi gibi açık kalır). Kamera başta 2,6, kesitte 2,5;
  patlatma 0,3, son çekim hedefi yukarıda. Sınırda: kesitin en derin anı %45, son kare %41 boş (ikisi de 1 sn'den kısa).
- `faint` dolgu (%3,5 beyaz) zemin sayılmaya devam ediyor: neredeyse görünmeyen bir ton, pus gibi.

**pointTo (2026-11-24):** `labels[].pointTo: "katman.öğe"` → panel kenarından öğeye kılavuz çizgisi
(`src/kit/overlays/LabelPointers.tsx`, geometri `pointer.ts`, qa da aynı geometriyi kullanır).
- Sahneler o karede çizdiklerini `framing.board`'a raporlar (yalnız qa'da ya da spec'te `pointTo` varsa); kılavuz
  oradan okunur, sahnelerden sonra çizilir. Gösterilen öğe etiket boyunca önemli sayılır (`framing.pointed`).
- Check: katman ve öğe adı doğrulanır (model3d parçaları dosyadan). qa'da yeni satır "Kılavuz": öğe ekranda değil ya
  da kılavuz başka yazının üstünden geçiyor hata.
- demo-flow'un üç etiketi örnek olarak kullanıyor (qa temiz). gps-pilot regresyonu birebir aynı (SSIM 1,0).
- EKG: SA DÜĞÜMÜ → `body.sa`, AV DÜĞÜMÜ → `body.av`, HIS → PURKİNJE → `body.his`. Panelin altından çıkan kılavuz
  yalnız en alt satıra ait (`rowsInTheWay`): altına yeni satır gelince söner, yoksa alttaki satırdan çıkıyormuş gibi
  okunuyordu. Bu yüzden kılavuzlar ~1,3–1,6 sn görünür (düğüm tanıtılırken). SA etiket boyunca önemli sayılınca
  kulakçık çekiminde çözücü 0,8×'e uzaklaşıyordu (kare %46 boş): kulakçık çekiminin odağı y −45 → −62.

## Bekleyen kararlar (kullanıcıya sor)

Şu an bekleyen karar yok.

## Görsel sistem v2: qa durumu

Kaynak: `npm run qa -- <slug> --layout` (2026-11-24, kare dışı kontrolü dahil; diğer dört videoda yeni hata
çıkmadı; donma kontrolü `a327b2a` render'ı üzerinde). Loglar `out/qa-<slug>.log`, örnekler
`out/<slug>/qa-samples.json`.

| Video | Hata | Ne kaldı | Yapılacak |
|---|---|---|---|
| gps-pilot | 0 | duraklama ve tonlama uyarıları | eski sesten geliyor; seslendirme Aşama B'de çözülür |
| EKG | 0 | konuşma uyarısı: ses yok (timing.json yok) | seslendirme Aşama B |
| demo-flow | 0 | kenar kırpması uyarısı | — |
| demo-model3d | 0 | kenar kırpması uyarısı | — |

demo-trace temiz.

**Planda olup yapılmayanlar:**
- model3d için kadraj kaydırması: rapor var, kaydırma yok.
- Trace şemasındaki `labelAt` artık kullanılmıyor; temizlenmeli.

## Seslendirme v2 Aşama B (ElevenLabs kredisi bekliyor)

Hesapta kredi bitti (2026-11-19'da 4 kredi kalmıştı). Gereken ≈ 2.500–3.000 kredi. Ücretsiz plandaki ses ticari
kullanılamaz; kullanıcıya hatırlat.

1. Sesi yeniden üret:
   ```bash
   npm run voiceover -- build ekg Xb7hH8MSUJpSbSDYk0k2 --widen
   npm run voiceover -- build gps-pilot Xb7hH8MSUJpSbSDYk0k2 --widen
   ```
2. `npm run review -- <slug>`: işaretli cümlelerin alternatiflerini dinletip seçtir.
3. Kareler (`--sheet`), `npm run qa -- <slug>`, `npm run render -- <slug>`, her video için qa tablosu.
4. gps-pilot'un sesi değişince regresyon referansı yeniden yenilenir (önce/sonra göster, onayla):
   `npm run stills -- gps-pilot --every 10 --out out/baseline/frames` ve
   `npm run render -- gps-pilot && cp out/gps-pilot.mp4 out/baseline/gps-pilot.mp4`.
5. EKG'nin yeni render'ını `~/Desktop/ekg.mp4`'e kopyala. Şu anki kopya eski v3.1; Kingston'daki yeni render
   sessiz.

## Notlar

- **Proje yeri:** `/Volumes/KINGSTON/Projects/video-generator`. `~/Desktop/video-generator` buna sembolik bağlantı.
- **Node sürümü:** script'ler `.ts` import ettiği için Node ≥ 22.18 gerekir. Kabukta PATH'in başında nvm'in v20.10'u
  olabiliyor (`.ts` hatası verir); `nvm use 22` ya da
  `PATH=/Volumes/KINGSTON/DevTools/NodeJS/nvm/versions/node/v22.23.1/bin:$PATH`.
- **EKG'nin eski sesi:** `out/ekg/v3.1-backup/`. Metin değiştiği için kullanılamaz.
- **whisper.cpp kurulumu bozuk** (eski bir yola bağlı). `align` için `out/whisper/whisper.cpp` silinip yeniden kurulmalı.
- **Spec'leri betikle düzenlerken JSON metnine regex uygulama.** Bir kez cümle sonlarını ve "1,5" gibi değerleri
  bozdu; JSON'u her zaman değerlerden yeniden üret.
- **Kullanıcı bir videoda sorun bildirirse önce sistemi düzelt** (kural ya da qa kontrolü), sonra videoyu
  üret (SKILL.md).
