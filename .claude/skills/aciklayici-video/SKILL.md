---
name: aciklayici-video
description: Bu projede verilen bir konu için STYLE.md tarzında 9:16 açıklayıcı video üretir — açı seçimi, kaynak doğrulama, metin, sahne planı, spec.json, still kontrolü, Whisper hizalama, müzik ve render. Kullanıcı "/aciklayici-video <konu>" yazdığında ya da bu projede yeni bir açıklayıcı video istediğinde kullan.
argument-hint: <konu>
---

# Açıklayıcı video: $ARGUMENTS

Başlamadan önce oku:

- `STYLE.md`: kurallar ve sondaki kontrol listesi
- `README.md`: komutlar, spec alanları, sahne türleri tablosu
- `videos/gps-pilot/spec.json`: eksiksiz örnek (değerlerini değil kalıplarını örnek al)
- `videos/sablon/spec.json`: yeni videonun başlangıcı

Ortam: Node 22 (`nvm use 22`), her komut proje kökünden. ElevenLabs anahtarı `.env` içinde; içeriğini asla yazdırma,
komut satırına koyma.

**★ = dur ve açık onay iste.** Onay gelmeden sonraki adıma geçme; kullanıcı değişiklik isterse aynı adımı tekrarla.

## a) Açılar ★

Konu için 2–3 farklı açı öner, tek tablo halinde:

| | Açı 1 | Açı 2 | Açı 3 |
|---|---|---|---|
| Gündelik kanca | izleyicinin elindeki şey, tek cümle | | |
| Görünmez sistem | perde arkasında çalışan şey | | |
| Somut yolculuk | kameranın baştan sona izleyeceği tek şey | | |
| Doruk anı | gerilimin en yüksek anı | | |
| Doruğun gerçek sayacı ya da eşiği | gerçek bir süre/mesafe/eşik varsa o; yoksa alternatif doruk (kritik an, karşılaştırma, "aha") | | |
| Duygusal eğri | en güçlü an son üçte birde (`marks.peak`); ondan sonra 8 sn'den uzun yeni bölüm yok | | |
| Kancadaki soru → finaldeki cevap | kancanın sorusu ve finalde tek cümlelik cevabı | | |
| Kavram adı | en son verilecek terim | | |
| İzleyici kavram adını biliyor mu? | biliyorsa finaldeki şaşırtma (köken, beklenmedik bağlantı) ya da başka bir kavram | | |
| Sahne türleri | kütüphaneden hangileri; yeni tür gerekir mi | | |

Birini gerekçesiyle öner. **Dur.**

## b) Doğrulama

- Seçilen açıdaki her rakam ve iddia için WebSearch yap. Birincil kaynağı tercih et (resmî kurum, standart, hakemli
  yayın); ansiklopedi ya da blog ancak birincil kaynak yoksa.
- Her birini `sources[]`'a yaz: `claim`, `value`, `url`, `accessed` (bugün, YYYY-AA-GG), `status`
  (`verified` | `simplified` | `disputed`), `note` (sadeleştirmenin ne olduğu).
- Ekranda kalacak her `simplified` / `disputed` iddia için bir `notes` girdisi öner ("YAKLAŞIK", "SADELEŞTİRİLDİ",
  "ÖLÇEKLİ DEĞİL").
- Doğrulanamayan rakam metne girmez.
- Sayaç, animasyon ve `trace` bir zaman çizelgesinden besleniyorsa her anahtar değeri `timeline.keys` içinde bir
  `sources[].id`'ye bağla (`"#ad"`). Ara değerler de kaynaklı olmalı; `npm run check` kaynaksız sayaç değerini
  reddeder.
- Kullanıcıya kaynak listesini kısaca göster ve c'ye geç.

## c) Metin ★

- Süreyi kullanıcıdan al (varsayılan 30 sn). Bölümler:
  - kanca: 0–5 sn
  - 2–3 gövde bölümü
  - doruk ve final: son ~8 sn
- Kelime bütçesi: (bölüm penceresi − duraklamalar) × 2,8. Duraklamalar ≈ 0,7 (bölüm geçişi) + 0,6 × "Peki…?"
  sorusu + 0,4 × cümle sonu + 0,2 × virgül/iki nokta (`src/spec/pauses.ts`).
- STYLE kuralları:
  - izleyiciye "sen" diye hitap
  - her gövde bölümü "Peki…?" ile açılır; **art arda iki "Peki…?" cümlesi olmaz** (kancanın sorusu "Peki"siz)
  - kanca başlıkları seslendirmeyle aynı kelimeleri kullanır
  - qa konuşulan sürede 2,6–3,0 kelime/sn bekler; cümle aralarının ortalaması 0,35 sn'nin altındaysa hata verir
  - tek somut yolculuk
  - final sırası: doruk → tek cümlelik özet (kancadaki sorunun cevabı) → kavramın adı en son (ad daha önce
    söylenmez); geri sayım yalnızca gerçek bir süre/eşik için
  - sağ/sol söylenen her yerde ekranda yön ipucu planla
- Çıktı:
  - bölüm tablosu: pencere, duraklama, bütçe, gerçek kelime sayısı
  - cümle cümle metin: her cümle bir altyazı sayfası, en fazla ~32 karakter
  - her rakamın hangi kaynağa dayandığı

**Dur.**

## d) Sahne planı ★

- Planı yalnızca kütüphanedeki türlerle kur (README → Sahne türleri):
  - katmanlar: `model3d`, `flow`, `trace`, `globe`, `cityMap`, `haze`, `speedLines`, `signalPass`, `ringShrink`
    (genel türler önce: 3D nesne → `model3d`, şema/akış → `flow`, sinyal/grafik → `trace`; örnekler
    `videos/demo-*`)
  - üst yazılar: `titles`, `labels`, `notes`, `counter`, `countdown`, `concept`, `darken`, `captions`
  - ses: `beds` (`loop`), `hits`, `music`
- İlk yakın plandan önce nesnenin yerini gösteren geniş plan koy.
- Zaman çizelgesi tablosu ver: aralık | bölüm | katman / geçiş | kamera hareketi | ekran yazısı | efekt. Kamera hiç
  durmaz, sahneler kesmeyle değil geçişle bağlanır.
- **Yeni tür gerekiyorsa açıkça söyle:** mevcutlar neden yetmiyor, önerilen ad, parametreler. Onay gelirse:
  1. `src/kit/<kategori>/` altına bileşeni ve zod şemasını yeniden kullanılabilir biçimde ekle. Renk ve font yalnızca
     `src/kit/theme.ts`'ten gelir; hikâyeye özgü her sabit bir spec parametresi olur.
  2. `src/spec/schema.ts` içindeki layer birleşimine ve `src/kit/registry.tsx`'e ekle.
  3. README'deki tabloya satır ekle.
  4. Regresyonu kontrol et. Değişiklikten **önce** referans yoksa üret:
     `npm run stills -- gps-pilot --every 10 --out out/baseline/frames`. Değişiklikten sonra
     `npm run stills -- gps-pilot --every 10 --out out/regress/frames` ve
     `npm run compare -- out/baseline/frames out/regress/frames` çalıştır; sonuç temiz olmalı. Ses tarafına
     dokunduysan gps-pilot'u render edip `npm run compare -- out/baseline/gps-pilot.mp4 out/gps-pilot.mp4` ile null
     testi yap (referans render değişiklikten önce alınır).
- Yeni bir efekt gerekiyorsa `src/kit/audio/sfx-catalog.json`'a ekle ve `npm run sfx -- <id>` çalıştır. Bu ElevenLabs
  kredisi harcar; önce söyle.

**Dur.**

## e) spec.json ve kareler ★

1. `npm run new -- <slug> "<başlık>"` (slug: küçük harf, rakam ve tire).
2. `videos/<slug>/spec.json`'u yaz:
   - `voiceover.sections`: c'deki metin, birebir
   - `marks`, `curves`, `layers`, üst yazılar, `sound`
   - `sources` (b'den), `credits` (aşağıdaki kurallara göre)
   - varsa `styleExceptions`
3. Konuşmaya bağlı her zamanı cümleye bağla (`{ "cue": "…", "offset": 0.1 }`); sabit saniye yalnızca sesten bağımsız
   kamera hareketleri için. Ses henüz yok; altyazı tahmini zamanlamayla (2,5 kelime/sn) çalışır.
4. `npm run check` temiz olmalı.
5. Kilit anları render et: her bölümün ilk saniyesi, her etiketin göründüğü an +0,3 sn, her geçişin ortası, geri
   sayım, kavram kartı, son kare. Komut: `npm run stills -- <slug> 0.5s 4s … --sheet`.
6. **`npm run qa -- <slug> --layout` zorunlu.** Çakışan, altyazıya binen ya da güvenli alana taşan yazı varsa
   düzelt ve tekrarla; parlak çizgi uyarılarını karelerde kontrol et.
7. Kareleri Read ile kendin incele ve STYLE.md kontrol listesini madde madde uygula. Uymayanları düzelt, yeniden
   render et.
8. Kullanıcıya `out/<slug>/stills/sheet.png` dosyasını ve gerekirse önemli tekil kareleri göster. **qa sonuç
   tablosunu**, kontrol listesinin sonucunu ve bilinen sapmaları yaz. **Dur.**

## f) Ses, müzik, render

Seslendirme dosyası verildiğinde:

1. `npm run align -- <slug> <dosya>` çalıştır. Hizalama whisper.cpp ile yerelde yapılır; ilk çalıştırmada ~1,6 GB
   model iner. Çıktıda üç şeye bak:
   - eşleşme oranı: %80'in altındaysa metin ve ses uyuşmuyor olabilir, kullanıcıya sor
   - bölüm başlangıç kaymaları
   - süre önerisi
2. Zamanlar artık `timing.json`'da; cümleye bağlı her şey kendiliğinden kayar. Sabit saniyeli işaretleri (`marks`)
   yeni bölüm başlangıçlarına göre güncelle. Konuşma süreyi aşıyorsa `durationSec`'i artır.
3. Senkronu kontrol et: e'deki kilit anları `--sheet` ile yeniden üret, etiketlerin söylendikleri kelimeyle
   çıktığına bak.
4. Müzik: `npm run music -- list`.
   - **Kütüphanede uygun parça varsa:** ruh haline (`moods`) göre seç ve `sound.music`'e yaz: `file`, listedeki
     önerilen `gain`, `duck: 0.5`, gerekirse `loop`, `fadeIn` / `fadeOut`. Parçanın JSON'undaki başlık, sahip, lisans
     ve url'yi `credits`'e kopyala.
   - **Uygun parça yoksa:** bunu söyle ve `space` drone yatağını `loop: true` ile 0'dan sona kullan
     (`sound.beds`); yatak hiçbir yerde kesilmemeli.
   - İnternetten kendiliğinden müzik indirme.
5. `npm run render -- <slug>` → `out/<slug>.mp4`. Son satır "OK" olmalı (−14 ± 0,5 LUFS, ≤ −1 dBTP); değilse
   nedenini bul.
6. **`npm run qa -- <slug> --audio` zorunlu:** konuşma hızı (genel 2,2–2,8 kelime/sn), dijital sessizlik, yatak
   sürekliliği. Hata varsa düzelt, yeniden render et.
7. Kullanıcıya bildir: dosya yolu, süre, loudness, **qa sonuç tablosu**, kontrol listesinin son durumu, kredilerin
   özeti.

Seslendirme dosyası yoksa ve kullanıcı taslak ses isterse: `npm run voiceover -- build <slug> <voiceId>`. Bu
ElevenLabs kredisi harcar ve ücretsiz planda çıkan ses ticari kullanılamaz; ikisini de önceden söyle. Ses cümle
cümle üretilir ve kurallı duraklamalarla birleştirilir (hızlandırma en fazla ×1,05; klipler `out/<slug>/vo-clips/`
altında önbelleğe alınır). Bir bölüm sığmazsa script durup tablo basar: `--widen` ile pencereleri genişlet ya da metni
kısaltmayı öner. İnsan kaydında `align` kurallardan kısa aralara sessizlik ekler.

## Kurallar

- Başka içerik üreticilerinin metnini, görüntüsünü veya müziğini kopyalama. Tarzdan ilham alınabilir, içerik özgün
  yazılır.
- Kullanılan her model, ses, efekt, doku, görsel, yazı tipi, müzik ve kodun lisansını ve kredisini `credits`'e yaz.
  Her videoda bulunanlar:
  - Inter ve JetBrains Mono (SIL OFL 1.1)
  - Remotion (Remotion License)
  - `globe` varsa three.js (MIT) ve kullanılan doku (ör. NASA Black Marble, kamu malı)
  - `model3d` varsa three.js (MIT) ve model: `public/kit/models/<id>.json`'daki başlık, sahip, lisans ve url
    (`kind: "model"`, url birebir; `npm run check` denetler). CC0 tercih edilir; yeni model indirmeden önce aday
    listesini kullanıcıya göster.
  - ElevenLabs sesi ya da efekti varsa ElevenLabs, planın lisans koşuluyla
  - Whisper ile hizalandıysa whisper.cpp (MIT) ve OpenAI Whisper modeli (MIT)

  Lisansı belirsiz öğeyi kullanma.
- ElevenLabs ücretsiz plan çıktıları ticari kullanılamaz. Video ticari bir yerde yayınlanacaksa kullanıcıyı uyar.
- Ekrandaki her rakamın `sources`'ta bir kaynağı olur.
- Kütüphaneye dokunduysan gps-pilot regresyonu temiz kalmalı (d adımı).
