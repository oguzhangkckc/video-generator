# Kalan işler

Son güncelleme: 2026-11-23. Branch: `feat/genel-sahne-turleri` (push yok, PR yok).

## Yapılanlar (commit sırasıyla)

| Commit | İş |
|---|---|
| `c13d826` | Seslendirmede nefes payı: duraklama kuralları (`src/spec/pauses.ts`), konuşulan sürede hız ölçümü |
| `d078f12` | EKG: eski taslak sese `align --timing` ile sessizlik eklendi (58,8 sn) |
| `27cdfa3` | Seslendirme sistemi v2 (Aşama A, kredisiz). Ayrıntı: aşağıda "Seslendirme v2". |
| `269d65f` | Görsel altyapı: sahne raporları (`QA_LAYER`), kompozisyon qa'sı, kadraj çözücüsü (kapalı); gps-pilot birebir aynı kaldı |
| `a327b2a` | Görsel sistem v2. Ayrıntı: aşağıda "Görsel sistem v2". |

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

## Bekleyen kararlar (kullanıcıya sor)

1. **Boş alan ölçümü.** Şu an karede en çok tekrarlanan düz ton "zemin" sayılıyor. Bu yüzden büyük, düz dolgulu
   şekiller (EKG'de gövde ve kalp) "boş" çıkıyor: EKG'de %62–84.
   - (a) Önerilen: yalnızca sahnenin asıl zemin rengi (koyu gradyan, uzay) ve düz pus/parlama boş sayılsın;
     dolgulu şekiller içerik olsun. Kod: `scripts/qa.mjs` → `emptyShare`. Zemin tonları `src/kit/theme.ts`'teki
     `bgTop`, `bgBottom` ve `space` renklerinden alınır.
   - (b) Katı kalsın: o zaman gövdeye ve kalbe doku ya da ayrıntı çizmek gerekir.
2. **gps-pilot regresyon referansı.** Görüntü bilerek değişti. gps-pilot qa'dan temiz geçince önce/sonra karelerini
   göster, onay gelirse yenile:
   ```bash
   npm run stills -- gps-pilot --every 10 --out out/baseline/frames
   npm run render -- gps-pilot && cp out/gps-pilot.mp4 out/baseline/gps-pilot.mp4
   ```

## Görsel sistem v2: açık qa hataları

Kaynak: `a327b2a` render'ı ve `npm run qa`. Loglar `out/qa-<slug>.log`, örnekler `out/<slug>/qa-samples.json`.

| Video | Hata | Ne kaldı | Yapılacak |
|---|---|---|---|
| gps-pilot | 7 | 2,7–5,9 sn harita → dünya geçişi %88 boş: haze kalktı, harita siyah boşlukta küçülüyor | Dünya daha erken devralsın ya da haritanın küçülmesi sınırlansın; gerekirse gerekçeli `flash` |
| gps-pilot | | 15 sn civarı uydu karenin üst kenarından taşıyor | `follow.aimBelow` 2,2 fazla; ~1,6 dene. Ayrıca önemli öğenin kare dışına taşmasını qa'da hata yap: şu an yalnız üst yazı örtüşmesine bakıyor |
| gps-pilot | | uzay çekimleri %49–58 boş; 8,5 sn'de uydu sayacın altında | kadraj ve kamera ayarı |
| gps-pilot | | duraklama ve tonlama uyarıları | eski sesten geliyor; seslendirme Aşama B'de çözülür |
| EKG | 10 | 6,06 sn el değiştirme: kalem ile `e2` 64 px kayık. `focus: "pen"` taban çizgisini gösteriyor, kalem ucu dalganın değerinde | el değiştirmeyi dalganın düz anına al |
| EKG | | kulakçık 21,3–22,1 sn %36, karıncık 33,9–34,9 sn %32 panel altında; `av` 34,9 sn panel altında; `signal8` 40,8 sn şerit altında | kamera çekimleri ya da çözücü ayarı |
| EKG | | gövde ve kalp kareleri %62–84 boş | karar 1'e bağlı |
| EKG | | 57,7–58,2 sn donma (final) | final çekimine hareket ya da `drift` |
| demo-flow | 2 | seyrek diyagram: özne %31, kare %92 boş | diyagramı büyüt, bölge ekle |
| demo-model3d | 2 | kare başta %47, sonda %85 boş | kamera mesafesi, patlatma sonu |

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
4. gps-pilot'un sesi değişince regresyon referansı yenilenir (karar 2 ile birlikte, onayla).
5. EKG'nin yeni render'ını `~/Desktop/ekg.mp4`'e kopyala. Şu anki kopya eski v3.1; Kingston'daki yeni render
   sessiz.

## Notlar

- **Proje yeri:** `/Volumes/KINGSTON/Projects/video-generator`. `~/Desktop/video-generator` buna sembolik bağlantı.
- **EKG'nin eski sesi:** `out/ekg/v3.1-backup/`. Metin değiştiği için kullanılamaz.
- **whisper.cpp kurulumu bozuk** (eski bir yola bağlı). `align` için `out/whisper/whisper.cpp` silinip yeniden kurulmalı.
- **Spec'leri betikle düzenlerken JSON metnine regex uygulama.** Bir kez cümle sonlarını ve "1,5" gibi değerleri
  bozdu; JSON'u her zaman değerlerden yeniden üret.
- **Kullanıcı bir videoda sorun bildirirse önce sistemi düzelt** (kural ya da qa kontrolü), sonra videoyu
  üret (SKILL.md).
