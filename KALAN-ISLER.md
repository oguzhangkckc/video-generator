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
| `feat(gps-pilot)` | gps-pilot qa'dan temiz geçti, regresyon referansı yenilendi; önemli öğe kare dışı kontrolü. Ayrıntı: aşağıda "gps-pilot düzeltmeleri". |

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

## Bekleyen kararlar (kullanıcıya sor)

Şu an bekleyen karar yok.

## Görsel sistem v2: açık qa hataları

Kaynak: `npm run qa -- <slug> --layout` (2026-11-24, kare dışı kontrolü dahil; diğer dört videoda yeni hata
çıkmadı; donma kontrolü `a327b2a` render'ı üzerinde). Loglar `out/qa-<slug>.log`, örnekler
`out/<slug>/qa-samples.json`.

| Video | Hata | Ne kaldı | Yapılacak |
|---|---|---|---|
| gps-pilot | 0 | duraklama ve tonlama uyarıları | eski sesten geliyor; seslendirme Aşama B'de çözülür |
| EKG | 10 | 6,06 sn el değiştirme: kalem ile `e2` 64 px kayık. `focus: "pen"` taban çizgisini gösteriyor, kalem ucu dalganın değerinde | el değiştirmeyi dalganın düz anına al |
| EKG | | kulakçık 21,3–22,1 sn %36, karıncık 33,9–34,9 sn %32 panel altında; `av` 34,9 sn panel altında; `signal8` 40,8 sn şerit altında | kamera çekimleri ya da çözücü ayarı |
| EKG | | boş alan: 7,5–11,7 sn %59, 17,6–28,8 sn %75 (kalp karenin ~%22'si), 34,1–35,2 sn %42, 39,5–59,2 sn %62 (kalp + şerit; alt üçte bir ve sol üst boş). Gövdenin içi (5,9–7,4 sn) artık boş sayılmıyor | kalbi büyüt / kamerayı yaklaştır; şeritli bölümde boşluğu doldur |
| EKG | | 57,7–58,2 sn donma (final) | final çekimine hareket ya da `drift` |
| demo-flow | 2 | seyrek diyagram: özne %31, kare %90 boş | diyagramı büyüt, bölge ekle |
| demo-model3d | 2 | kare 0–1,6 sn %47, 5,9–10,5 sn %85 boş | kamera mesafesi, patlatma sonu |

demo-trace temiz.

**Planda olup yapılmayanlar:**
- Üst yazı etiketlerine `pointTo` (panelden sahne öğesine kılavuz çizgisi).
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
