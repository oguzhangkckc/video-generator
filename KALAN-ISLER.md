# Kalan işler

Son güncelleme: 2026-11-27 (skill otomatik modu, `feat/otomatik-mod`; öncesinde metin kalitesi, `feat/metin-kalitesi`
merge).
`feat/genel-sahne-turleri` PR #1 (`55d38de`), `feat/sistem-kurallari` PR #2 (`40fe4f8`) ve `chore/nvmrc-ve-gitignore`
PR #3 (`fab72e3`, `.nvmrc` + gitignore) main'e birleştirildi; yeni iş yeni branch'te.

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
| `38716f9` | EKG: SA, AV ve HIS → PURKİNJE etiketlerinde kılavuz; alttan çıkan kılavuz yalnız en alt satırın. |
| `3d0e9a5` | Trace şemasından kullanılmayan `labelAt` ve ona bağlı ölü hesap kaldırıldı. |
| `13dd7cc` | model3d kadraj kaydırması: önemli parçalar panel/altyazıdan mercek kaydırmasıyla uzak tutulur. Ayrıntı: aşağıda. |
| `311aa68`…`57c31e0` | Son EKG render'ından sistem kuralları (branch `feat/sistem-kurallari`). Ayrıntı: aşağıda "Sistem kuralları". |
| `04120e7` | Metin kalitesi (branch `feat/metin-kalitesi`). Ayrıntı: aşağıda "Metin kalitesi". |
| `feat/otomatik-mod` | Skill otomatik modu: iki durak, düzeltme döngüsü, `npm run log`, taslak ses. Ayrıntı: aşağıda "Otomatik mod". |

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

**model3d kadraj kaydırması (2026-11-24):** sahne, önemli parçalarını (vurgulanan, kameranın hedefi, `pointTo` ile
gösterilen; patlatmadaki yer değişimi dahil) `adjustFor`'a verir; sonuç globe'daki gibi mercek kaydırması
(`src/kit/lens.ts`, ortak). qa raporu kaydırılmış konumları verir. Render'da ölçüldü: kayma raporla birebir (1,87 sn
9/4 px, 5,07 sn 2/−28 px). demo-model3d qa temiz; gps-pilot regresyonu birebir aynı.

**Sistem kuralları (2026-11-24, `feat/sistem-kurallari`):**
- `311aa68` qa: sahnelerin kendi yazıları (`SceneReport.texts`) bütün yazılara ve altyazı bandına karşı; veri çizgisi
  başlığa/altyazıya girmez (sivri uçlar önemli nokta); şerit ölçeği kendiliğinden küçülür; kapak (ilk 3 sn) kare kare
  payısız; sinyalin yolu (−0,25…+0,5 sn) önemli öğe.
- `06d3be7` altyazı sabit boyut (`captions.size`), uzun cümle 2–6 kelimelik iki sayfaya bölünür, sığmayan cümle check hatası.
- `bfcb7b7` bölüm başına tanınabilir bağlam planı (özne ≥ 1 sn tamamen kadrajda; uyarı).
- `b88bb86` kavram kartı ve birlikte gösterilen ortalı satırlar tek koyu panelde.
- `e241fa1` seslendirme sağlayıcısı (elevenlabs / azure SSML / say geçici ses), cümle başına önbellek (`out/tts-cache`),
  harcamadan önce tahmin ve hesapta kalan kredi, video bütçesi (`voiceover.tts.budget`, aşılırsa durur, `--over-budget`),
  geçici sesle render yalnız `--draft`; whisper.cpp statik derlendi.
- `514040a`, `ade176a` kapakta başlık şartı yalnız başlıklı videoda; `titles[].y`; parantez komşu çizginin altından.
- Videolar: `0f935ae` EKG (0 hata, önce 24; gövde silueti ve iki cümle kullanıcı onayıyla), `44f7ce5` gps-pilot
  (referans yenilendi, eskisi `out/baseline-2026-11-24b`), `57c31e0` demo-trace, demo-flow.
  Önce/sonra: `out/ekg-kurallar-once-sonra.png`, `out/gps-pilot-kurallar-once-sonra.png`,
  `out/demos-kurallar-once-sonra.png`.
- Planda değişen: vurgu `*kelime*` yerine bölüm başına `stress` listesi (altyazı, sözlük ve qa'ya dokunmamak için).
  Azure canlı denenmedi (anahtar yok); SSML ve kelime zamanı birim testli.

## Bekleyen kararlar (kullanıcıya sor)

- Seslendirme sağlayıcısı: aşağıda "Seslendirme v2 Aşama B".

## Anlam qa (2026-11-28, `feat/anlam-qa`)

Kullanıcı üç taslağı kare kare inceledi (PR #5 merge edildi). Bulunanlar otomatik modun değil, qa'nın anlamı
ölçmemesinin sonucuydu; önce kural, sonra video.

- **Kılavuz ve vekil öğeler:** sahneler her öğenin çizdiğini (`drawn`, ekran px'inde çizgiler) raporluyor; dolgusuz
  ve kenarsız bir bölge (vekil) `[]` raporlar. Kılavuz ucu öğenin çizilen en yakın noktasına gider (içi boş bir
  şeklin ortasına değil). qa: hiçbir şey çizmeyen öğeye kılavuz hata, uç çizilen bir noktada değilse hata; söylenen
  nesne ölçümü çizmeyen öğeyi görünür saymıyor. Temassız kartta yakaladı: BOBİN ve HALKALAR kılavuzları ve "Bobin…",
  "kenarı boyunca", "halkalardan" cümleleri (rings/coil bölgeleri görünmez vekil; halkaları ve bobini yollar çiziyor).
- **Şerit parçasının anlamı:** `parts[].drop` (kararma ≈ 0,05, yük çukuru ≈ 0,35); trace çizilen çizginin iki
  döngülük pencerelerdeki en düşük genliğini olağan genliğe oranlayıp raporluyor (`src/kit/scenes/trace/swing.ts`),
  qa bildirilenle karşılaştırıyor. Temassız kartta yakaladı: KARARMALAR %53 (≤ %5 olmalı), YÜK %70, CEVAP %85.
- **Editör ekran etiketlerini okuyor:** `metin-editoru` 5. bölüm (etiket ↔ cümle doğruluğu, aynı şey mi, tekrar);
  SKILL c.4'te metinle birlikte, e.7'de spec etiketleri plandan farklıysa "etiket turu". Temassız kartta kör okumada
  "SANİYEDE 13,56 MİLYON KEZ"i yakaladı (yön bir salınımda iki kez değişir).
- **Yan yana etiketler:** aynı satırdaki iki veri etiketi arasında en az bir etiket yüksekliği boşluk (yerleştirme ve
  qa). EKG'de yakaladı: "ÜST" ile "ALT" 9 px (en az 36).
- STYLE kontrol listesi: "Anlatılan her eylem (kasılma, kayma, kararma, yayılma) görüntüde bir hareketle
  karşılanıyor mu?"; SKILL e.7 bunu iki kareyle kontrol ediyor, kit çizemiyorsa zorunlu durma.
- Doğrulama: 61 test; gps-pilot regresyonu birebir (90 kare, SSIM 1,0).
- **Videolarda uygulama:**
  - temassız kart: BOBİN/HALKALAR kılavuzu ve `say` çizen yollara (rc3, cc1); şerit taşıyıcısı iki kararmada sıfır,
    yük ve dört cevap çukurunda %30, parçalarda `drop`; şerit kamerası kararma ve titremelerde yaklaşıyor; etiket
    "SANİYEDE MİLYONLARCA KEZ"; editör etiket turunun bulguları (4 ifade, "OKUYUCUYA YÜK" tekrarı kaldırıldı, not
    "ŞERİT AĞIR ÇEKİM · ÇUKURLAR ABARTILI", us7926719 notuna Mors benzetmesi).
  - gps: "≈ 300 M" kaldırıldı (300 METRE ile aynı anda), YAKLAŞIK notu kaldı.
  - EKG: özetteki her parçada kalpte karşılığı yanıyor (üst odalar, kapı, alt odalar, sonda kalp); "ÜST" ile "ALT"
    ayrı (sistemle).
- **DURDU, EKG madde 4 (kit desteklemiyor):** "Alt odalar ancak bundan sonra kasılıyor: önce emir, sonra vuruş"
  denirken alt odalar görünür biçimde sıkışmalı. flow kitinde bölgeler sabit çokgen; biçim ya da ölçek zamanla
  değişmiyor (`visible`, `sweep`, `highlight` var, hareket yok). Gereken: flow katmanına bir **sıkışma** (`squeeze`):
  `[{ range, center: [x, y], scale: 0.88, side: { below: y } }]` aralık boyunca (girip çıkan zarfla) bir yarı
  düzlemdeki bütün geometriyi (bölgeler, kırpma bölgeleri, yollar, düğümler) merkeze doğru ölçekler; kalbin AV
  düzleminin altı sıkışır, iletim yolları onunla birlikte hareket eder. Raporlanan öğe kutuları ve `drawn` dönüşmüş
  geometriden gelir (qa çizileni ölçer). Tahmini iş: kit (model + çizim + şema) ve test ~1–2 saat, gps-pilot ve
  demo-flow regresyonu. EKG'de "sonra vuruş"ta bir sıkışma, isteğe bağlı her atımda.

## Otomatik mod (2026-11-27, `feat/otomatik-mod`)

- `/aciklayici-video <konu>` artık otomatik. Kullanıcı iki kez devreye girer:
  - Durak 1 (a+b+c: açı, kaynaklar, editör, 3 kanca / 2 final, söz → karşılık, `listen`);
  - Durak 2 (render, qa tablosu, `run-log` özeti).
  `adım adım <konu>` eski dört duraklı akış; `gerçek ses <slug>` taslak sese gerçek sesi koyar.
- Düzeltme döngüsü: kapılar `check`, `qa-layout`, `qa`. Bir döngü en fazla 5 tur; iki tur üst üste azalmazsa durur.
  `check` ilk spec hatasında durduğu için `--fixed` (önceki hata gitti) ilerleme sayılır. Otomatik düzeltme yalnız
  spec'te; STYLE, qa eşikleri, metin denetimi, sahne kodu, `styleExceptions` ve onaylı metin değişmez.
- `npm run log` (`scripts/runlog.mjs`, `scripts/lib/runlog.mjs`): `out/<slug>/run-log.jsonl` → `run-log.md`. Adım
  süreleri, bekleme, turlar, duraklar ve müdahaleler kaydedilir. `round` sayıları `qa.json`'dan okur; kısmi
  (`--from/--to`) ya da eski `qa.json`'u tur saymaz. `qa.json`'a `range`, `render`, `draftVoice` eklendi.
- Taslak ses (kullanıcı kararı): `say` yalnız otomatik modda ve gerçek TTS yokken; `render --draft` →
  `out/<slug>.draft.mp4`, yayına uygun değil. `ekg` ve `gps` dahil (kullanıcı 2026-11-28: önceki "taslak ses yok"
  kuralı, gerçek seste zamanlamanın elle yeniden kurulması gerektiği içindi; `gerçek ses <slug>` artık bunu
  kendiliğinden yapıyor). qa
  geçici seste taslak dosyayı denetler; hız ve duraklamalar ölçülür, tonlama "taslak ses, ölçülmedi". Adım adım
  akıştan `say` taslağı kaldırıldı (c `listen` kalır).
- Doğrulama:
  - `npm test` 46/46;
  - `npm run check` temiz;
  - demo-trace kopyasında `say` + `--draft` + tam qa beklendiği gibi çalıştı (Yelda 2,33 kelime/sn → hız uyarısı);
    kopya ve önbellek dosyaları silindi;
  - demo-trace gerçek ses yolunda qa tablosu eski `qa.mjs` ile birebir aynı (yalnız yeni "Render" satırı).
- **İkinci tur (aynı branch, PR öncesi kullanıcı isteği):**
  - Söylenen nesne kuralı: bir düzeltme o an söylenen nesneyi ekrandan kaldıramaz.
    - qa her (cümle, `say` öğesi) için görünme oranını `qa.json` `said`'e yazar; `phraseTiming` cümle zamanlarının
      özetidir.
    - `round`, aynı zamanlamada son kurala uyan turla karşılaştırır; oran %5'ten fazla düşerse `İHLAL` (ilerleme
      sayılmaz, geri al). İki ihlal üst üste gelirse `DUR`.
    - demo-flow kopyasında denendi: kamera telefonu %100 → %83'e düşürdü. qa'nın %50 eşiği bunu geçiriyordu,
      döngü `İHLAL` dedi.
    - `say`'e bağlı olmayan görsel kelimeler ("yazı", "çizgi") hâlâ kapsam dışı: aşağıdaki sistem notu.
  - Düzeltme kaydı: `npm run log -- <slug> fix <kapı|kontrol-listesi> "<hata>" --change … --why …`.
    - Hatalı turdan sonra kayıt yoksa `round` reddeder.
    - run-log'da "Düzeltmeler" tablosu; Durak 2'de gösterilir.
  - `say` kalibrasyonu: `RATE` 170 → 270 wpm.
    - 93 kelimelik bir anlatım metninde qa ölçümüyle 1,92 → 2,74 kelime/sn. Yelda basamaklı: 270–275 → 2,74,
      280–290 → 2,89.
    - Önbellek anahtarı artık wpm'i içeriyor; eski `say` kayıtları (`out/tts-cache/say`, 150 dosya) kullanılmaz.
- **Kabul testinden sistem düzeltmeleri (2026-11-28, temassız kart):**
  - `avoid.ts`: "anlar için", "anahtar kapan" (`a232b9c`).
  - Metne bağlı her denetim Durak 1'den önce: `npm run text` taslakta altyazı sığmasını tarayıcıda, `check` ile aynı
    ölçüyle (gizli `metin-olcu` kompozisyonu, `src/spec/caption-fit.ts`) ve planlanan etiketleri (`labels`) söz ve
    nicelik açısından denetler. Sebep: "Okuyucunun alanını kullanıyor." onaydan sonra `check`'te altyazıya sığmadı
    ve video ikinci kez durdu. `check` de artık Inter'in yüklenmesini bekleyip ölçüyor (önceden yedek yazı tipiyle
    ölçmüş olabilirdi; bütün videolar yine temiz).
  - Taslak ses yayınlanabilir dosyanın adını almaz: `say` çıktıları `videos/<slug>/timing.draft.json` ve
    `public/videos/<slug>/vo.draft.wav` (gitignore'da). `loadTiming` ve Remotion kökü önce gerçek sese, yoksa taslağa
    bakar; gerçek ses (voiceover ya da insan kaydı ile align) taslağı siler. `out/` altına taşımak Remotion'ın paket
    bağlamını ve ses sunumunu (`public/`) bozacağı için seçilmedi.
  - run-log: aynı adım yeniden başlayınca açık kalan eski kayıt kapanır; arada bir durak başladıysa durağın başında
    ("durak-1 ile ara", bekleme çalışma sayılmaz), yoksa yeniden başlarken ("yeniden başladı").
- **Kabul testi videosu üretildi (2026-11-28, Durak 2 onayı bekliyor):** `videos/temassiz-kart` (72,1 sn, taslak ses
  `out/temassiz-kart.draft.mp4`). Kayıt `out/temassiz-kart/run-log.md`. Üç durma: c'de editör (kullanıcı "sorun
  çıkarsa dur" dedi), e'de altyazı sığması (onaylı metin değişti; sistem açığı `a325788` ile kapandı). Kapılar:
  `check` 2 tur, `qa-layout` 3 + 1 tur, `qa` 1 tur; son qa 0 hata, 1 uyarı (Yelda hızı 3,06 kelime/sn). Spec
  `out/`'taki değil, oturumdaki bir üreteçle değerlerden yazıldı.
- **İkinci kabul testi: `videos/gps` (2026-11-28, Durak 2'de onaylandı; kesik çizgiye ≈ 300 M etiketi eklendi):** 60 sn, taslak ses `out/gps.draft.mp4`.
  Kayıt `out/gps/run-log.md`. d'den başladı. Tek durma d'de oldu: onaylı metin yeni altyazı denetimine takıldı,
  kullanıcı "karşılaştır → kıyasla"yı seçti. Kapılar: `check` 1 tur, `qa-layout` 4 + 2 tur, `qa` 2 tur. Son qa
  0 hata, 3 uyarı (kenar ×2, "yukarı" bağlamı). 22 düzeltme; biri geri alındı (yukarıdaki globe notu). Spec,
  oturumdaki bir üreteçle yazıldı.

## Taslak sesli videolar

Otomatik modda gerçek TTS olmadan bitmiş videolar. Sağlayıcı seçilince (Aşama B) her biri için
`/aciklayici-video gerçek ses <slug>`:
1. ses değişir;
2. `timing.json` ve cümleye bağlı her şey kayar;
3. `marks` güncellenir;
4. `qa-layout`, render (`out/<slug>.mp4`), tam qa;
5. Durak 2.
Bitince satır silinir.

| Slug | Tarih | Taslak dosyası | Tahmini karakter |
|---|---|---|---|
| temassiz-kart | 2026-11-28 | `out/temassiz-kart.draft.mp4` | ≈ 1.160 (önerilen bütçe 1.700) |
| gps | 2026-11-28 | `out/gps.draft.mp4` | ≈ 850 (önerilen bütçe 1.300) |
| ekg | 2026-11-28 | `out/ekg.draft.mp4` | ≈ 895 (önerilen bütçe 1.350) |

## Metin kalitesi (2026-11-27, `feat/metin-kalitesi`)

- `src/spec/script-audit.ts`: metin kuralları tek yerde (resolver, `npm run text`, `npm run check`). Yeni:
  `peki-siniri` (en fazla 2 bölüm "Peki…?" ile açılır), `acik-final` (son cümle soru olamaz) hata;
  `kacinilacak` uyarı (`src/spec/avoid.ts`). `styleExceptions: [{ rule, why }]` muaf tutar (gps-pilot `acik-final`).
- Skill c): 3 kanca + 2 final, söz→karşılık, anlatma cümlesi, `out/<slug>/metin/metin.json`, editör ajanı
  (`.claude/agents/metin-editoru.md`), `npm run voiceover -- listen` (yalnız `say`; bu turda çalıştırılmadı).
- gps-pilot regresyonu birebir aynı (90 kare, SSIM 1,0; `out/regress-metin/frames`).
- **EKG spec'e yazılırken değişen `cue`'lar (yapıldı):** marks `dive` ("Peki bu elektrik", "Kalbinin sağ"), `fire`
  ("Bir hücre"), `peak` ("İşte QRS"), `summary` ("Küçük tepe"), `reveal` ("elektrokardiyogram"); titles ("Ama
  okumayı", "Peki cihaz"; yeni cue "Bu çizgi bir", çünkü "Bu çizgi" kancadakini bulur); labels "o kadar küçük"
  (cihaz akımı cümlesi silindi: HİSSETME EŞİĞİ ve CİHAZ AKIMI etiketleri kalkar ya da yeni cümleye bağlanır),
  "Kalbinin sağ", "Bir hücre", "dakikada", "Dalga tek", "Kan aşağı", "karıncıklar birden", "Kas bir an". Kanca
  başlıkları yeni kanca kelimeleriyle yeniden yazılır.
- **EKG metni spec'e yazıldı (2026-11-27, kullanıcı onaylı):** sinyal baştan sona "emir"; parça/bütün düzeltmeleri
  ("alt odalar kasılıyor", "alt odalar yeni emre hazırlanıyor", "Üst odalar kanı alt odalara itsin diye"); QRS
  sonunda kronolojik özet ("küçük tepe üst odalar, ilk düzlük kapıdaki bekleme, sivri tepe alt odalar, son tepe
  hazırlık"), şeritteki ÜST · BEKLEME · ALT · HAZIRLIK her parça söylenirken yanar; final "Artık okumaya başladın. EKG,
  yani elektro, kardiyo, gram: kalbin elektrikle yazdığı yazı." Editörden dört tur. Süre 58,8 → 64,4 sn (pencereler
  tahmini; seslendirmede `--widen`). Doruk (`marks.peak`) "önce emir, sonra vuruş"ta.
  - Etiketler: CİHAZ AKIMI, HİSSETME EŞİĞİ, DAKİKADA 60–100 silindi; GERİLİM ≈ 1 mV, KALBİN SAATİ, KAPI, ALT ODALAR
    (DOLUYOR), EMİR YAYILIYOR, ÖNCE EMİR, SONRA VURUŞ. Kaynaklardan aha, iec-leakage, osha artık ekranda değil.
  - Yerleşim: şerit kavram kartıyla birlikte söner, final kamerası kalbi kartın altına indirir (2,1×); "Üst odalar
    kanı…" cümlesinde tam kalp planı; bekleme etiketleri QRS'ten 0,9 sn önce kalkar.
  - qa `--layout`: 0 hata, 2 uyarı (kenar; final bölümünde tam siluet yok). gps-pilot regresyonu birebir, demo-trace
    temiz.
- **EKG final yerleşimi, seslendirmeden sonra yeniden kurulacak:** finalde "kalbin elektrikle yazdığı yazı" denirken
  veri şeridi kayboluyor ve kalbin tamamı görünmüyor (qa'yı temizlemek için yapılan değişiklik). Seslendirmeden sonra
  final, söylenen nesneler (şerit ve kalp) görünür kalacak şekilde yeniden kurulur.
  **Taslak seste kontrol edildi (2026-11-28, `out/ekg.draft.mp4`):** sorun sürüyor. "kalbin elektrikle yazdığı yazı"
  60,64 sn'de başlıyor; şerit tam o anda kavram kartıyla birlikte sönüyor, kalp kartın altına inerken soldan ve
  alttan kırpılıyor (kareler `out/ekg/final-taslak/sheet.png`). qa (taslak): 1 hata (33,87 sn kulakçık %26 üst yazı
  altında, sınır %25), 3 uyarı (kenar, finalde siluet yok, Yelda hızı 3,10 kelime/sn). Söylenen "yazı" `say`'e bağlı
  değil; qa bu yüzden yakalamıyor (aşağıda "Bağlam kuralı görsele gönderme yapan kelimeleri de kapsamalı").
  **Düzeltildi (2026-11-28, Durak 2 onayı bekliyor):** şerit sona kadar ekranda ve "çizgi / yazı / tepe"ye bağlı;
  finalde aynı çizimden bir `govde-final` katmanı kalbin üstünde eşleşip göğse çekiliyor (kalbin tamamı kart ile şerit
  arasında, omuz çizgisi görünür); "≈ 0,1 SN BEKLEME" kendi cümlesiyle bitiyor (33,87 sn çakışması). Taslak qa 0 hata.
- **Veri çizgisi etiket yerleşimi** (`src/kit/scenes/trace/labels.ts`): kılavuzu başka bir etiketten geçen yer
  seçilmez (qa'nın kuralı artık yerleştirmede de).
- **Etiket ↔ seslendirme kontrolü** (`src/spec/label-speech.ts`, `npm run check` hatası, muafiyet `etiket-sozu`):
  demo-flow, demo-model3d ve gps-pilot muaf (yer tutucu metin / donmuş pilot). Veri çizgisi etiketleri yalnız `lit`
  aralığı varsa denetlenir.
- Editörün önerip uygulanmayan: "telefon uydulara hiçbir şey göndermiyor" (resmî GPS kaynağıyla doğrulanamadı);
  "ila"yı avoid listesine ekleme (önek eşleşmesi "ilaç"ı da yakalar; metinde "ile" kullanıldı).

## Görsel sistem v2: qa durumu

Kaynak: render + `npm run qa -- <slug> --layout` (2026-11-24, sistem kuralları sonrası). Loglar `out/qa-<slug>.log`,
örnekler `out/<slug>/qa-samples.json`.

| Video | Hata | Ne kaldı | Yapılacak |
|---|---|---|---|
| gps-pilot | 0 | kenar; "yukarı" bağlam uyarısı | seslendirme Aşama B'de tonlama yeniden ölçülür |
| EKG | 0 | kenar uyarısı; ses yok | seslendirme Aşama B |
| demo-flow | 0 | kenar uyarısı | — |
| demo-model3d | 0 | kenar uyarısı (bu turda yeniden render edilmedi) | — |

demo-trace temiz.

**Planda olup yapılmayanlar:** yok.

## Sistem notları (henüz uygulanmadı)

- **Genel kural (kullanıcı 2026-11-28): qa, render'ın çizdiğini ölçmeli.** qa ile render'ın bir şeyi ayrı ayrı
  hesapladığı her durum bir açıktır; ölçüm, çizimin kullandığı aynı değerden (aynı fonksiyon, aynı zarf, aynı
  aralık) gelmeli. İlk örnek aşağıdaki globe açığı.
- **globe: model uydu `hero.visible.in`'den önce de çiziliyor (gps kabul testi, 2026-11-28).** `HeroSatellite`
  zarfı yalnız parıltıya uyguluyor; gövde ve paneller pencere boyunca görünüyor. qa ise uyduyu `in[0]`'dan önce
  ölçmüyor. Sonuç: `in`'i geciktirmek uyduyu qa'dan gizler ama ekrandan kaldırmaz (gps'te bu yol denendi ve geri
  alındı; çözüm yörünge hızıydı). Düzeltme: gövdeyi de zarfla soldur (ya da `in[0]`'dan önce çizme) ve qa'yı çizimle
  aynı aralıkta ölç; sonra gps-pilot regresyonu. **Plan (kullanıcı 2026-11-28):** PR #5 merge edildikten sonra ayrı
  bir dalda düzelt ve regresyonu çalıştır.

- **Bağlam kuralı görsele gönderme yapan kelimeleri de kapsamalı:** "Seslendirmede adı geçen nesne o anda karede
  görünür" kuralı (STYLE "Kompozisyon → Bağlam", `say` takma adları) "yazı", "çizgi" gibi doğrudan ekrandaki bir
  görsele gönderme yapan kelimeleri de kapsamalı (ör. veri şeridinin `say`'i: "çizgi", "yazı", "tepe"). Ayrıca qa'yı
  temizlemek için yapılan bir yerleşim değişikliği söylenen nesneyi ekrandan kaldırmamalı: kontrol, söylenen bir
  nesnenin o cümle sırasında gizlenmesini (görünürlük `out`'u, kadraj dışı) hata saymalı. Örnek vaka: EKG finali
  (yukarıda). **Kısmen yapıldı (2026-11-27):** otomatik moddaki düzeltme döngüsü `say`'e bağlı öğeler için bunu
  denetliyor (`İHLAL`, yukarıda "Otomatik mod"). **Yapıldı (2026-11-28):** görsele gönderen isimler
  (`src/spec/visual-words.ts`: çizgi, yazı, tepe, düzlük, eğri, grafik, şema, şerit, harita) hiçbir öğenin `say`'inde
  değilse `npm run check` uyarı verir (`gorsel-soz`, muaf tutulabilir); veri çizgisinin bütünü (`trace.say`) ve harita
  (`cityMap.say`) artık bağlanabiliyor, bağlananlar söylenen nesne ölçümüne (qa "Bağlam", döngüde `İHLAL`) giriyor.
  Ölçüm açığı da kapandı: bağlı bir öğenin katmanı cümle boyunca hiç çizilmiyorsa (gizli katman, henüz çizilmemiş
  parça) öğe artık ölçümden düşmüyor, görünme oranı 0 sayılıyor; aynı söz için başka bir katmanda çizilen kopya yeterli.
  İlk çalıştırma: ekg 13 uyarı (çizgi, tepe, düzlük, yazı), gps 1 (harita), temassız kart temiz; gps-pilot ve
  demo-trace muaf.
- **Durak 1 sonrası editör önerileri (kabul testi notu, kullanıcı 2026-11-28):** Durak 1 onayından sonra metinde
  değişiklik yapılır ve editörden geçerse, editörün yalnız ifade düzeyindeki önerileri (anlamı ve iddiayı
  değiştirmeyenler: kelime seçimi, ek, tekrar, ses akışı) otomatik uygulanıp run-log'a yazılsın; anlam ya da doğruluk
  değişikliği gerekiyorsa dur. Örnek: temassız kart testindeki ikinci durma (c, 2026-11-27). "bastıkça → basınca" ve
  "fazladan → daha çok" ifade düzeyiydi, otomatik uygulanabilirdi; "durmadan → Mors gibi" (cevabın bilgi taşıdığı) ve
  yön cümlesinin silinmesi ya da bağlanması anlam değişikliğiydi, orada durmak doğruydu. **Yapıldı (2026-11-28):**
  SKILL Durak 1 ve zorunlu durma noktaları; editör her bulguyu "ifade" / "anlam" diye işaretler ve değişen cümleler
  turunda yalnız onlara bakar; ifade düzeltmeleri `npm run log -- <slug> fix editor …` ile düzeltmeler listesine.

## Sıradaki videolar ve fikirler

- **`videos/gps` (tamamlanmış GPS, 60 sn):** metin onaylı (`videos/gps/metin.json`: kanca 1, Final 1). Kanca söylenirken ekranda haritadaki konum
  işareti (mavi nokta) görünür.
  Otomatik modda d)'den taslak sesle (say) Durak 2'ye kadar üretildi: otomatik modun ikinci kabul testi (kullanıcı
  2026-11-28; yukarıda "İkinci kabul testi"). Gerçek ses "Taslak sesli videolar" listesinden gelir.
- **Fikir: görelilik Short'u**, ayrı ve kendi içinde tamamlanmış: "Uydudaki saatler neden her gün ileri gidiyor?"
  (net ≈ 38 µs/gün: hız −7, kütleçekim +45; düzeltme fırlatmadan önce saat frekansına işlenir. Kaynaklar: Penn State
  GEOG 862 "The Satellite Clock", arXiv gr-qc/0507121).

## Seslendirme v2 Aşama B (ElevenLabs kredisi ya da Azure anahtarı bekliyor)

Hesapta kredi bitti (2026-11-19'da 4 kredi kalmıştı). Gereken ≈ 2.500–3.000 kredi. Ücretsiz plandaki ses ticari
kullanılamaz; kullanıcıya hatırlat.

- Seslendirme sağlayıcısı kararı bekliyor: ElevenLabs Starter (1 ay, ticari lisans) ya da Azure Speech F0 (gmail
  hesabıyla pay-as-you-go aboneliği).
- gps-pilot'taki 'yukarı' bağlam uyarısını, yeniden seslendirmeden önce senaryodan düzelt.
- Sağlayıcı seçilince sesi (sağlayıcı, ses kimliği, model) `videos/sablon/spec.json` `voiceover.tts`'e yaz: otomatik
  mod yeni videolarda gerçek sesi oradan alır. Sonra "Taslak sesli videolar" listesindeki her video için
  `/aciklayici-video gerçek ses <slug>`. EKG ve gps de taslak ses alır ve gerçek sesi aynı yoldan alır (kullanıcı
  2026-11-28); aşağıdaki plan gps-pilot için geçerli.

0. Sağlayıcı seçimi: ElevenLabs (kredi) ya da Azure Speech (SSML; `.env`'e `AZURE_SPEECH_KEY`,
   `AZURE_SPEECH_REGION` — hesabı kullanıcı açar, ücretsiz kotayı birlikte kontrol ederiz). Önce geçici sesle
   (`--provider say`) zamanlama ve altyazı denenebilir; render yalnız `--draft`.
1. Önce tahmin, kullanıcıya söyle, sonra üret (bütçe aşılırsa betik durur; kullanıcıya sor):
   ```bash
   npm run voiceover -- build ekg Xb7hH8MSUJpSbSDYk0k2 --widen --estimate
   npm run voiceover -- build ekg Xb7hH8MSUJpSbSDYk0k2 --widen
   npm run voiceover -- build gps-pilot Xb7hH8MSUJpSbSDYk0k2 --widen
   ```
2. `npm run review -- <slug>`: işaretli cümlelerin alternatiflerini dinletip seçtir.
3. Kareler (`--sheet`), `npm run qa -- <slug>`, `npm run render -- <slug>`, her video için qa tablosu.
4. gps-pilot'un sesi değişince regresyon referansı yeniden yenilenir (önce/sonra göster, onayla):
   `npm run stills -- gps-pilot --every 10 --out out/baseline/frames` ve
   `npm run render -- gps-pilot && cp out/gps-pilot.mp4 out/baseline/gps-pilot.mp4`.
5. EKG'nin sesli render'ını `~/Desktop/ekg.mp4`'e kopyala. Şu anki kopya sessiz render (2026-11-24, kılavuzlu
   son hâl).

## Geliştirme ortamı (2026-11-27)

- Claude Code'a eklendi: Context7 (MCP), claude-hud 0.15.5. RTK zaten kuruluydu; `rtk init` çalıştırılmadı (Read
  devri kapalı). Remotion skills: aşağıda "Notlar".
- claude-hud, Vibe Island'ın status line betiğine eklendi (`~/.vibe-island/bin/vibe-island-statusline`, "Add your
  status line output below" bölümü); `statusLine` ayarı değişmedi. `/hud` `install --replace` önerirse reddet, yoksa
  Vibe Island status line'dan çıkar.
- **Açık (kullanıcı):** VS Code'u yeniden başlatıp HUD'un panelde görünüp görünmediğine bak. Status line 2 Ekim'den
  beri hiç çağrılmamış (`~/.vibe-island/cache/rl.json` güncellenmiyordu); oturum sırasında bu dosya güncelleniyorsa
  status line çalışıyor demektir.

## Notlar

- **Proje yeri:** `/Volumes/KINGSTON/Projects/video-generator`. `~/Desktop/video-generator` buna sembolik bağlantı.
- **Remotion agent skills:** 2026-11-27'de `npx remotion skills add` ile eklendi (`.agents/skills/`, 14 skill;
  `.claude/skills/remotion-*` sembolik bağlantılar; `skills-lock.json`). Karar: gitignore'a eklendi, repoda yok. Yeni
  makinede aynı komutla kurulur.
- **Node sürümü:** script'ler `.ts` import ettiği için Node ≥ 22.18 gerekir. 2026-11-27'den beri nvm varsayılanı
  22.23.1 ve kabuk dizine girince `.nvmrc`'yi okuyor (`~/.zshrc`'deki `load-nvmrc` kancası). Projenin `.nvmrc`'si
  22.23.1 (2026-11-27). `.ts` hatası görülürse önce `node -v`; gerekirse `nvm use`.
- **EKG'nin eski sesi:** `out/ekg/v3.1-backup/`. Metin değiştiği için kullanılamaz.
- **whisper.cpp** 2026-11-24'te statik olarak yeniden derlendi (eski yola bağlıydı); `align` proje taşınırsa kendini yeniden
  derler. İnsan kaydı yolu (`npm run align`) çalışıyor (geçici sesle denendi, 8/8 kelime eşleşti).
- **Spec'leri betikle düzenlerken JSON metnine regex uygulama.** Bir kez cümle sonlarını ve "1,5" gibi değerleri
  bozdu; JSON'u her zaman değerlerden yeniden üret.
- **Kullanıcı bir videoda sorun bildirirse önce sistemi düzelt** (kural ya da qa kontrolü), sonra videoyu
  üret (SKILL.md).
