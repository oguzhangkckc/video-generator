---
name: aciklayici-video
description: Bu projede verilen bir konu için STYLE.md tarzında 9:16 açıklayıcı video üretir — açı seçimi, kaynak doğrulama, metin, sahne planı, spec.json, still kontrolü, seslendirme, müzik ve render. Varsayılan otomatik mod iki durakta durur (metin, bitmiş video); "adım adım" dört duraklı akış. Kullanıcı "/aciklayici-video <konu>" yazdığında ya da bu projede yeni bir açıklayıcı video istediğinde kullan.
argument-hint: [adım adım | gerçek ses <slug>] <konu>
---

# Açıklayıcı video: $ARGUMENTS

Başlamadan önce oku:

- `STYLE.md`: kurallar ve sondaki kontrol listesi
- `README.md`: komutlar, spec alanları, sahne türleri tablosu
- `videos/gps-pilot/spec.json`: eksiksiz örnek (değerlerini değil kalıplarını örnek al)
- `videos/sablon/spec.json`: yeni videonun başlangıcı

Ortam: `.nvmrc`'deki Node (`nvm use`), her komut proje kökünden. ElevenLabs anahtarı `.env` içinde; içeriğini asla yazdırma,
komut satırına koyma.

## Mod

`$ARGUMENTS`'a bak:

- **"adım adım" ile başlıyor** (ya da kullanıcı adım adım istedi): dört duraklı akış. **★ = dur ve açık onay iste.**
  Onay gelmeden sonraki adıma geçme; kullanıcı değişiklik isterse aynı adımı tekrarla. Adımlardaki "Otomatik:"
  notlarını atla.
- **"gerçek ses <slug>" ile başlıyor:** taslak sesli bir videoya gerçek sesi koy (aşağıda "Gerçek ses").
- **Diğer her durumda otomatik mod** (aşağıda). ★ işaretleri durak değildir; adımlardaki "Otomatik:" notları
  geçerlidir.

**Sorun bildirildiğinde önce sistemi düzelt.** Kullanıcı bir videoda sorun bildirdiğinde o videoyu elle düzeltmeden
önce:

1. Sorunu hangi STYLE kuralının ya da `npm run check` / `npm run qa` kontrolünün yakalaması gerektiğini belirle.
2. Böyle bir kural ya da kontrol yoksa ekle; varsa neden yakalamadığını bul ve düzelt (eşik, ölçüm, kapsam).
3. Kontrolün sorunu artık yakaladığını o videoda göster.
4. Ancak bundan sonra videoyu yeniden üret.

Bu kural iki modda da geçerli: kullanıcı bir sorun bildirdiğinde (Durak 2 dahil) sistem değişikliği yapılabilir.
Otomatik moddaki yasaklar ("Düzeltme döngüsü") yalnız kendi başına yaptığın düzeltmeler için.

## Otomatik mod

Kullanıcı video başına iki kez devreye girer: Durak 1 (konu ve metin) ve Durak 2 (bitmiş video). Bunlar ve zorunlu
durma noktaları dışında sorma.

### Kayıt

Her şeyi `npm run log` ile kaydet: `out/<slug>/run-log.jsonl` olayları tutar, `out/<slug>/run-log.md` her komutta
yeniden yazılır.

| Ne zaman | Komut (`npm run log -- <slug> …`) |
|---|---|
| bir adıma başlarken / bitirince | `start <adım>` / `end <adım> ["not"]` |
| bir durak mesajını gönderirken / yanıt gelince | `start durak-1` / `end durak-1`, sonra `user durak-1 "<ne istedi>"` |
| her kapı turundan sonra | `round <check\|qa-layout\|qa> …` (aşağıda "Düzeltme döngüsü") |
| her düzeltmeden sonra (döngüde, kontrol listesinde ya da Durak 1 sonrası editörün ifade önerisinde) | `fix <check\|qa-layout\|qa\|kontrol-listesi\|editor> "<hata>" --change "<ne değiştirildi>" --why "<neden>"` |
| zorunlu durma noktası | `end <adım> "durdu"`, `stop "<sebep>"`; yanıt gelince `user <adım> "<ne istedi>"`, `start <adım>` |
| kullanıcı akış sırasında bir şey isterse | `user <adım> "<ne istedi>"` |
| kontrol listesi sonucu, kısmi qa denemesi, ses kararı | `note "<metin>"` |

Adım adları: `a`, `b`, `c`, `durak-1`, `d`, `e`, `f`, `durak-2`, `gercek-ses`. Slug'ı a'nın başında seç (küçük harf,
rakam ve tire); kayıt oradan başlar. Kullanıcının isteğini kendi kelimelerine yakın, kısa yaz. Durak süreleri
"kullanıcı bekleme" olarak ayrı toplanır.

### Durak 1 ★ konu ve metin

a, b ve c'yi arada durmadan yap, sonra tek mesajda göster:

1. Seçilen açı ve gerekçesi; diğer açılar birer satır (kullanıcı değiştirebilsin).
2. Kaynak listesi, işaretli iddialar (`simplified` / `disputed` ve önerilen `notes`), nicelik tablosu.
3. Editör bulguları: cümle | kural | sorun | öneri | **çözüm** (düzeltildi / gerekçe).
4. 3 kanca ve 2 final; önerdiğin birleşim işaretli.
5. Kancadaki soru → finaldeki cevap; anlatma cümlesi (seninki ve editörünki).
6. `npm run voiceover -- listen` ile okunmuş metin: ses dosyalarının yolları (`open out/<slug>/metin/ses`), bölüm
   tablosu (pencere, duraklama, bütçe, kelime, konuşulan süre), cümle cümle metin, `npm run text` sonucu (altyazı
   sığması, okunuş, kaçınılacaklar, planlanan etiketlerin söz ve nicelik kontrolü dahil; metin bunlardan temiz
   geçmeden onaya sunulmaz).
7. Sahne türleri: hepsi kütüphanede mi? Yeni tür ya da varlık gerekiyorsa öneri, tahmini iş miktarı ve lisans.
8. Ses planı. `videos/sablon/spec.json`'da `voiceover.tts` (sağlayıcı ve ses) varsa tahmini karakter (seçilen
   metnin okunuşlarıyla karakter sayısı) ve önerilen bütçe: tahmin × 1,5 (işaretli cümle alternatifleri ve yeniden
   üretim payı). Onay bütçeyi de onaylar. `tts` yoksa: "taslak ses (say), çıktı `out/<slug>.draft.mp4`, yayına
   uygun değil".
9. Sözlüğe eklediğin okunuşlar; `src/spec/avoid.ts`'e eklenmesini önerdiğin ifadeler (yalnız öneri: otomatik modda
   metin denetimi değişmez).

a–c sırasında çıkan zorunlu durma nedenleri (yeni sahne türü ya da varlık, doğrulanamayan iddia, kural istisnası)
ayrı durak açmaz: bu mesajın başında "Karar gerekiyor" başlığıyla gelir.

Kullanıcı kanca ve finali seçer ya da değişiklik ister:

- Açı, kaynak ya da yapı değişikliğinde ilgili adımı yeniden yap ve Durak 1'i yeniden göster.
- Kullanıcı cümleleri değiştirdiyse (kendi yazdığı ya da seçtiği ifadeyle) **değişen cümleleri** `npm run text`'ten
  ve `metin-editoru`'ndan geçir. Ajana metin.json yolunu ve değişen cümlelerin listesini ver; yalnız onları
  değerlendirir ve her bulguyu "ifade" ya da "anlam" diye işaretler.
  - **İfade düzeyi** (anlam ve iddia aynı: kelime seçimi, ek, tekrar, ses akışı; örnek "bastıkça" → "basınca",
    "fazladan" → "daha çok"): onay beklemeden uygula, her birini `npm run log -- <slug> fix editor "<bulgu>"
    --change "<yeni ifade>" --why "<kural>"` ile düzeltmeler listesine yaz, `npm run text`'i yeniden çalıştır.
  - **Anlam ya da doğruluk** (bir iddiayı, cümlenin zincirdeki işini ya da bir benzetmenin söylediğini değiştiren;
    cümle silen ya da ekleyen; `claims` dışı bilgi isteyen; örnek "durmadan" → "Mors gibi"): uygulama, dur
    (zorunlu durma noktası). Ayrım belirsizse anlam sayılır.
- Ardından metin onaylıdır: `videos/<slug>/metin.json`'u yaz (c sonu) ve d, e, f'yi durmadan yürüt.

### Düzeltme döngüsü

Üç kapı var:

- `check`: e.4, `npm run check`
- `qa-layout`: e.6, `npm run qa -- <slug> --layout`
- `qa`: f.6, render sonrası tam `npm run qa -- <slug>`

Kapı hata verirse düzelt ve yeniden çalıştır. Her düzeltmeyi ve her tam çalıştırmayı kaydet:

```bash
npm run log -- <slug> round check --errors 1 "ne değişti"           # check ilk spec hatasında durur
npm run log -- <slug> fix check "<hata>" --change "<ne değiştirildi>" --why "<neden>"
npm run log -- <slug> round check --errors 1 --fixed "ne değişti"   # önceki turun hatası gitti, yenisi çıktı
npm run log -- <slug> round qa-layout "ne değişti"                  # sayılar out/<slug>/qa.json'dan
```

- **Her düzeltme kaydedilir:** hangi hata, ne değiştirildi, neden. Bir hatada birden fazla değişiklik varsa her biri
  ayrı `fix`. Hatalı bir turdan sonra o kapının `fix` kaydı yoksa `round` yeni turu reddeder. Liste run-log'da
  "Düzeltmeler" tablosundadır.
- Çıktıdaki karara uy: `devam`, `temiz`, `İHLAL: …` ya da `DUR: …`. Döngü, hata sayısı iki tur üst üste azalmazsa
  (check'te `--fixed` ilerleme sayılır) ya da 5. turda sıfıra inmezse durur; betik durma kaydını kendisi ekler.
  Durunca kullanıcıya kalan hataları, denediklerini, önerini ve `run-log.md` özetini ver.
- **Söylenen nesne ekrandan çıkmaz.** Bir düzeltme, seslendirmede o an adı geçen nesneyi ekrandan kaldıramaz ya da
  kadraj dışına itemez. Bunu yapan yollar: görünürlük, `out`, kamera, zoom, katman penceresi, üstüne binen panel.
  - `round` bunu `say`'e bağlı öğeler için ölçer. Aynı cümle zamanlamasında, son kurala uyan tura göre bir öğenin
    cümlede görünme oranı düşerse karar `İHLAL` olur ve bu tur ilerleme sayılmaz.
  - İhlalde düzeltmeyi geri al (`fix <kapı> "…" --change "geri alındı" --why "…"`) ve başka yol dene.
  - `say`'e bağlı olmayan söylenen nesneleri ("yazı", "çizgi" gibi görsele gönderen kelimeler) karelerde kendin
    kontrol et.
  - Hata ancak böyle çözülebiliyorsa dur. İki ihlal üst üste gelirse betik kendisi durur.
- `--from/--to` ile kısmi qa denemeleri tur sayılmaz (`round` kısmi `qa.json`'u reddeder); `note` ile yaz.
- Her kapının döngüsü ayrıdır. Temiz biten ya da duran bir döngüden sonra kapının sonraki turu 1'den başlar.
- `npm run check` bütün videoları denetler. Hata başka bir videonun spec'indeyse kapsam dışıdır, dur.
- **Düzeltme yalnız `videos/<slug>/spec.json`'da:** kamera, zoom, `subject`, `say`, `transitions`, etiket ve not
  zamanı/yeri, `marks`, `curves`, katman parametreleri, `sound`; pencereler `--widen` ile.
- **Kendi başına değiştirme:**
  - STYLE.md;
  - qa eşikleri (`scripts/qa.mjs`, `scripts/lib/composition.mjs`);
  - metin denetimi (`src/spec/script-audit.ts`, `avoid.ts`, `label-speech.ts`);
  - sahne kodu (`src/kit/**`);
  - `styleExceptions`'a yeni istisna;
  - onaylı metin (`voiceover.sections[].phrases`);
  - başka videoların spec'leri;
  - `--over-budget`.

Kareleri STYLE.md kontrol listesine göre yine kendin incele (e.7). Bulduğun sorunu spec'te düzelt ve `qa-layout`
kapısından yeniden geç.

### Zorunlu durma noktaları

Yalnız bunlarda dur ve sor:

- Yeni bir sahne türü ya da yeni bir görsel/3D varlık gerekiyor (yeni efekt dahil, `npm run sfx` kredi harcar):
  öneri, tahmini iş miktarı ve lisans bilgisiyle.
- Doğrulanamayan ya da kaynakları çelişen bir iddia metinde ya da ekranda kalacak (d–f'de ekrana giren yeni rakam
  dahil).
- Bir kurala istisna gerekiyor (`styleExceptions`) ya da düzeltme onaylı metni değiştirmeyi gerektiriyor.
- Durak 1'de değişen cümlelerde editör anlam ya da doğruluk değişikliği öneriyor (ifade düzeyindekiler otomatik
  uygulanır, yukarıda "Durak 1").
- Bir hata ancak seslendirmede o an adı geçen nesneyi ekrandan kaldırarak ya da kadraj dışına iterek çözülebiliyor.
- TTS bütçesi aşılacak (`voiceover` çıkış 3, "bütçe aşılıyor").
- Düzeltme döngüsü `DUR` dedi ya da hata başka bir videonun spec'inde.
- `ekg` ya da `gps` gerçek ses olmadan f'ye geldi (bu videolar taslak ses almaz).
- Kullanıcının verdiği kayıt metinle uyuşmuyor (`align` eşleşmesi %80'in altında).

Durma mesajı: neden, seçenekler ve önerin, `run-log.md`'nin o anki özeti. Yanıttan sonra otomatik modda devam et.

### Durak 2 ★ bitmiş video

f bitince tek mesajda:

- Video: dosya yolu, süre, loudness. Taslak seste `out/<slug>.draft.mp4` ve açıkça "taslak ses, yayına uygun değil".
- `npm run qa -- <slug>` sonuç tablosu (taslak seste tonlama satırı "taslak ses, ölçülmedi"), STYLE kontrol
  listesinin sonucu, bilinen sapmalar.
- `out/<slug>/stills/sheet.png`; gerçek seste `npm run review -- <slug>` (işaretli cümlelerin alternatifleri).
- `credits` özeti; ElevenLabs ücretsiz planı kullanıldıysa ticari kullanım uyarısı.
- `npm run log -- <slug> show`: müdahale kaydının özet tablosu ve düzeltme listesi (her düzeltme: hangi hata, ne
  değiştirildi, neden; ihlaller ve geri almalar dahil).

Kullanıcı değişiklik isterse kaydet (`user durak-2 …`), "önce sistemi düzelt" kuralına göre ilerle, ilgili
kapılardan yeniden geç ve Durak 2'yi yeniden göster.

### Gerçek ses

`gerçek ses <slug>`: KALAN-ISLER'deki "Taslak sesli videolar" listesinden bir video gerçek sesini alır. Otomatik
modda f'den başla; kayıt aynı `run-log`'da `gercek-ses` adımıyla sürer.

1. Spec'teki `voiceover.tts`'in sağlayıcı, ses ve modelini `videos/sablon/spec.json`'dakiyle değiştir (taslakta
   `say` / Yelda yazılıdır; `budget` kalır). Şablonda `tts` yoksa dur: sağlayıcı seçilmemiş.
2. `npm run voiceover -- build <slug> --estimate`. Bütçe kuralı f'deki gibi.
3. `npm run voiceover -- build <slug>` (sığmazsa `--widen`): gerçek `timing.json` ve `vo.wav` yazılır, taslağın
   `timing.draft.json` ve `vo.draft.wav`'ı silinir; cümleye bağlı her şey kendiliğinden kayar. Bunları commit'le. Sabit saniyeli `marks`'ı yeni bölüm başlangıçlarına göre güncelle; konuşma süreyi aşıyorsa
   `durationSec`'i artır.
4. `qa-layout` kapısı, f.3 senkron kontrolü, `npm run render -- <slug>` (`out/<slug>.mp4`), `qa` kapısı.
5. Durak 2. Bitince slug'ı KALAN-ISLER'deki listeden çıkar.

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
| İzleyici kavram adını biliyor mu? | biliyorsa adı söylemek yerine ad üzerinden şaşırtma (kökeni ya da anlamı) ya da başka bir kavram | | |
| Sahne türleri | kütüphaneden hangileri; yeni tür gerekir mi | | |

Birini gerekçesiyle öner. **Dur.**

Otomatik: açıyı sen seç ve durma; seçim ve gerekçe Durak 1'e girer.

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
- **Nicelik tutarlılığı:** her rakamlı kaynağa `quantity` yaz (gerilim, akım, süre, hız, uzaklık, sıklık, diğer).
  Seslendirmede geçecek her büyüklük için tablo kur: seslendirmedeki büyüklük | etiket | nicelik | birim. Seslendirme
  "akım" derken etiket mV (gerilim) gösteremez; ikisi aynı niceliği adlandırmalı. Etiket sütunu c'de metin.json
  `labels`'ına girer ve `npm run text` onu metne karşı denetler; qa render sonrası yeniden uyarır.
- Kullanıcıya kaynak listesini ve nicelik tablosunu kısaca göster ve c'ye geç.

Otomatik: göstermeden c'ye geç; liste ve tablo Durak 1'e girer. Açının dayandığı bir iddia doğrulanamıyorsa ya da
kaynaklar çelişiyorsa Durak 1'de "Karar gerekiyor".

## c) Metin ★

1. **Süre ve bütçe.** Süreyi kullanıcıdan al (varsayılan 30 sn; otomatik: istekte yoksa 30 sn, sorma). Bölümler:
   - kanca: 0–5 sn
   - 2–3 gövde bölümü
   - doruk ve final: son ~8 sn

   Kelime bütçesi: (bölüm penceresi − duraklamalar) × 2,8. Duraklamalar ≈ 0,7 (bölüm geçişi) + 0,6 × soru
   + 0,4 × cümle sonu + 0,2 × virgül/iki nokta (`src/spec/pauses.ts`).
2. **Yaz.** Metnin yanında:
   - **3 kanca** ve **2 final** seçeneği (ilk ve son bölümün yerine geçen cümle listeleri); önerdiğin birleşim
     `sections`'ta durur
   - **söz → karşılık:** kancadaki soru (aynen) → finalde onu cevaplayan cümle (aynen)
   - **anlatma cümlesi:** izleyicinin videodan sonra bir arkadaşına tek cümleyle anlatabileceği şaşırtıcı bilgi.
     Yazamıyorsan metin hazır değil; açıyı ya da gövdeyi değiştir.

   Kurallar (STYLE "Anlatım", "Metin kalitesi", "Final"):
   - söz ve karşılık: kancadaki soru finalde tam olarak cevaplanır; video açık bir soruyla bitmez (`acik-final` hatası)
   - her cümle yerini hak eder: çıkarıldığında kancadan cevaba giden zincir bozulmuyorsa sil
   - somutluk: her soyut kavrama somut bir görüntü ya da benzetme
   - doğal Türkçe: çeviri kokan ifade ve günlük anlamı farklı teknik terim yok (`src/spec/avoid.ts`, uyarı); listede
     olmayan ama tekrar eden bir ifade bulursan listeye ekle (otomatik: Durak 1'de öner, ekleme)
   - geçişler: en fazla 2 bölüm "Peki…?" ile açılır (`peki-siniri` hatası); diğerleri doğrudan iddia, beklenmedik
     rakam ya da "ama" ile ters köşe; art arda iki "Peki…?" olmaz
   - kavram adı biliniyorsa (EKG, GPS…) adı söylemek yerine ad üzerinden şaşırt (kökeni ya da anlamı)
   - izleyiciye "sen" diye hitap; tek somut yolculuk; kanca başlıkları seslendirmeyle aynı kelimeler
   - cümle tek harf, kısaltma ya da sembolle bitmez ("…dalgası: T." → "Sonra T dalgası geliyor: toparlanma.")
   - soru, soru kelimesiyle bitmez; vurgu oraya düşer ("Peki o sivri tepe ne?" → "Peki ya o sivri tepe?")
   - her kısaltma, birim ve sembolün okunuşu telaffuz sözlüğünde (`src/spec/lexicon.ts`); yoksa ekle ya da yazıyla
     yaz. Seslendirmeye okunuş, altyazıya yazılış gider
   - seslendirmedeki her büyüklük, o an ekrandaki etiketle aynı nicelik (b'deki tablo)
   - qa konuşulan sürede 2,6–3,0 kelime/sn bekler; cümle aralarının ortalaması 0,35 sn'nin altındaysa hata verir
   - final sırası: doruk → tek cümlelik özet (kancadaki sorunun cevabı) → kavramın adı en son (ad daha önce
     söylenmez); geri sayım yalnızca gerçek bir süre/eşik için
   - sağ/sol söylenen her yerde ekranda yön ipucu planla
3. **Taslak dosyası ve denetim.** Metni `out/<slug>/metin/metin.json`'a yaz:
   ```json
   {
     "slug": "<slug>",
     "durationSec": 45,
     "sections": [{ "id": "kanca", "window": [0, 5], "phrases": ["…"] }],
     "options": { "kanca": [["…"], ["…"], ["…"]], "final": [["…"], ["…"]] },
     "claims": [{ "claim": "…", "value": "…", "status": "verified" }],
     "labels": [{ "text": "SANİYEDE 13,56 MİLYON KEZ", "cue": "alanın yönü", "offset": 0.8 }]
   }
   ```
   `labels`: planladığın veri satırları ve veri çizgisi parçaları (b'deki nicelik tablosunun etiket sütunu, ritim
   için 2–3 sn'de bir); `cue` göründüğü cümlenin başı, `offset` varsayılan 0,3 sn. e'de spec'e aynen geçer.
   Söz → karşılık ve anlatma cümlesi bu dosyaya **girmez** (editör kör okusun). `npm run text --
   out/<slug>/metin/metin.json` her seçenekle birlikte denetler: hata kalmaz; her uyarı düzeltilir ya da gerekçesi
   yazılır.

   **Metne bağlı her denetim Durak 1'den önce çalışır; onaydan sonra metin yüzünden durma olmaz.** `npm run text`
   taslakta spec'in sonra karşılaşacağı metin kontrollerinin hepsini yapar:
   - altyazı sığması (`altyazi`): tarayıcıda, `npm run check` ile aynı yazı tipi, boyut ve genişlikle; her cümle
     tek sayfaya ya da 2–6 kelimelik iki sayfaya sığmalı;
   - telaffuz sözlüğü (`okunus`, `kisaltma-sonu`);
   - kaçınılacak ifadeler (`kacinilacak`);
   - planlanan etiketler: söyleneni göstermesi (`etiket-sozu`) ve nicelik tutarlılığı (`nicelik`), tahmini
     zamanlamayla;
   - "Peki" sınırı, açık final, soru kelimesiyle biten soru.

   Onaydan sonra metin yüzünden bir durma olursa denetimde bir açık var demektir: önce sistemi düzelt (yukarıda
   "Sorun bildirildiğinde önce sistemi düzelt").
4. **Editör geçişi.** Agent aracıyla `metin-editoru` ajanını çalıştır (`.claude/agents/metin-editoru.md`; tür
   listede yoksa general-purpose ajana o dosyanın gövdesini ver). Ona **yalnız** metin.json'un yolunu ver: açı
   tablosunu, gerekçeni, taslak geçmişini, kendi anlatma cümleni verme. Dönen listede:
   - her bulgu için ya düzelt ya da gerekçeni yaz; "önemsiz" diye kapatma
   - editörün anlatma cümlesi ve söz → karşılık okuması seninkiyle aynı mı? Değilse metin, söylediğini sandığı şeyi
     söylemiyor; düzelt
   - metin değiştiyse 3. adımı tekrarla; büyük değişiklikte editörü yeniden çalıştır
5. **Dinletme.** `npm run voiceover -- listen out/<slug>/metin/metin.json --provider say`: ücretsiz geçici sesle
   (Yelda) `out/<slug>/metin/ses/` altına `tam`, `kanca-1..3`, `final-1..2` dosyaları ve bölüm başına konuşulan süre.
   `open out/<slug>/metin/ses` ile aç, yolları kullanıcıya ver. Bu yalnız metni duymak için bir taslak: spec,
   timing.json ve vo.wav değişmez, render alınmaz, tonlama ölçülmez.
6. **Çıktı:**
   - bölüm tablosu: pencere, duraklama, bütçe, gerçek kelime sayısı, geçici seste konuşulan süre
   - cümle cümle metin: her cümle bir altyazı sayfası, en fazla ~32 karakter
   - kanca ve final seçenekleri, önerdiğin (★ seçim kullanıcının)
   - söz → karşılık ve anlatma cümlesi (seninki ve editörünki)
   - editör bulguları: cümle | kural | sorun | öneri | **çözüm** (düzeltildi / gerekçe)
   - `npm run text` sonucu, ses dosyaları
   - her rakamın hangi kaynağa dayandığı

**Dur.** Kullanıcı kanca ve finali seçer. Onaylanan metni commit edilen yere kaydet: `videos/<slug>/metin.json`
(seçilen kanca ve final `sections`'ta; `out/` gitignore'da). e) adımında `voiceover.sections` buradan gelir;
`npm run new` bu klasörde yalnız `spec.json` yoksa çalışır.

Otomatik: bu çıktı Durak 1 mesajına girer; dur, onaydan sonra metni aynı yere kaydet.

## d) Sahne planı ★

- Planı yalnızca kütüphanedeki türlerle kur (README → Sahne türleri):
  - katmanlar: `model3d`, `flow`, `trace`, `globe`, `cityMap`, `haze`, `speedLines`, `signalPass`, `ringShrink`
    (genel türler önce: 3D nesne → `model3d`, şema/akış → `flow`, sinyal/grafik → `trace`; örnekler
    `videos/demo-*`)
  - üst yazılar: `titles`, `labels`, `notes`, `counter`, `countdown`, `concept`, `darken`, `captions`
  - ses: `beds` (`loop`), `hits`, `music`
- Sahne her zaman tüm kareyi kullanır; bant yok. Bir veri çizgisi başka bir sahnenin altında duracaksa `trace` +
  `panel` (koyu zeminli veri şeridi) olur.
- İlk yakın plandan önce nesnenin yerini gösteren en az 1 sn'lik geniş plan koy; ölçek değiştiren her geçişte önce
  geniş, sonra yakın plan.
- Zaman çizelgesi tablosu ver: aralık | bölüm | katman | **çekim türü** (geniş / orta / yakın) | **özne** (≥ %35
  yükseklik) | kamera hareketi | **önemli öğeler** | ekran yazısı | **geçiş türü ve gerekçe** | efekt. Kamera hiç
  durmaz.
- Seslendirmede geçen her yer ve öğe adını bir sahne öğesine bağla (`say`: "kalp", "sağ üst köşe"); o öğe cümlenin
  en az yarısı boyunca ekranda olmalı.
- Sahne değişimleri `transitions` ile: önce içinden geçme (`through`), sonra şekil eşleştirme (`match`), renk
  parlaması (`flash`, haze) yalnızca son çare ve gerekçeyle. Neredeyse boş kareye eriyerek geçme.
- Veri çizgisi parçaları: aralık anlatan `marker: "bracket"` (çizginin altında köşeli parantez), nokta ya da dalga
  anlatan `marker: "leader"` (üstte, kılavuz çizgiyle).
- Bir veri satırı sahnede kendiliğinden seçilmeyen bir öğeyi adlandırıyorsa (birkaç düğümden biri) `pointTo:
  "katman.öğe"` ile panelden öğeye kılavuz çiz (örnek: `videos/demo-flow`).
- **Yeni tür gerekiyorsa açıkça söyle:** mevcutlar neden yetmiyor, önerilen ad, parametreler. Onay gelirse:
  1. `src/kit/<kategori>/` altına bileşeni ve zod şemasını yeniden kullanılabilir biçimde ekle. Renk ve font yalnızca
     `src/kit/theme.ts`'ten gelir; hikâyeye özgü her sabit bir spec parametresi olur. Zemini (gradyan, uzay, pus)
     `useGround()` ile çiz; yoksa qa'nın boş alan ölçümü zemini içerik sayar.
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

Otomatik: durma. Zaman çizelgesi tablosunu `out/<slug>/sahne-plani.md`'ye yaz ve e'ye geç. Yeni tür ya da yeni efekt
gerekiyorsa zorunlu durma noktasıdır.

## e) spec.json ve kareler ★

1. `npm run new -- <slug> "<başlık>"` (slug: küçük harf, rakam ve tire).
2. `videos/<slug>/spec.json`'u yaz:
   - `voiceover.sections`: `videos/<slug>/metin.json`'daki onaylı metin, birebir
   - `marks`, `curves`, `layers`, üst yazılar, `sound`
   - `sources` (b'den), `credits` (aşağıdaki kurallara göre)
   - varsa `styleExceptions`
   - otomatik: Durak 1'de onaylanan TTS bütçesi `voiceover.tts.budget`'a (şablondan `tts` geldiyse)
3. Her etiket o an söylenen kelimeyi gösterir (STYLE "Ritim"; `npm run check` hatası): metin değiştiyse silinen
   cümlelerin etiketlerini kaldır, teknik adı metindeki kelimeyle değiştir (veri çizgisi etiketleri dahil).
   Konuşmaya bağlı her zamanı cümleye bağla (`{ "cue": "…", "offset": 0.1 }`); sabit saniye yalnızca sesten bağımsız
   kamera hareketleri için. Ses henüz yok; altyazı tahmini zamanlamayla (2,8 kelime/sn + duraklamalar) çalışır.
4. `npm run check` temiz olmalı (metin denetimi dahil: hata yok, uyarılar c'de çözüldü ya da gerekçeli).
   Otomatik: `check` kapısı.
5. Kilit anları render et: her bölümün ilk saniyesi, her etiketin göründüğü an +0,3 sn, her geçişin ortası, geri
   sayım, kavram kartı, son kare. Komut: `npm run stills -- <slug> 0.5s 4s … --sheet`. Her bölümün geniş planında
   öznenin silueti tanınıyor mu (gövdede omuz ve boyun çizgisi)? Kare 0 kapaktır: `out/<slug>/cover.png`'e ayrıca bak.
6. **`npm run qa -- <slug> --layout` zorunlu.** Satırlar: yerleşim, önemli öğe (üst yazı altı, kare dışı), özne boyu, boş alan,
   kenar kırpması, bağlam, veri etiketleri, kılavuz, kapak (ilk 3 sn, kare kare), altyazı (sabit boyut), bağlam planı
   (özne bütün ≥ 1 sn), geçişler, kamera. Hatalar kesin: önce çekimi, özneyi ya da geçişi
   düzelt (kamera, zoom, `subject`, `say`, `transitions`), sonra tekrarla. Örnekler `out/<slug>/qa-samples.json`'da.
   Otomatik: `qa-layout` kapısı.
7. Kareleri Read ile kendin incele ve STYLE.md kontrol listesini madde madde uygula. Uymayanları düzelt, yeniden
   render et. Otomatik: her düzeltmeyi `fix kontrol-listesi "<madde>" --change "…" --why "…"` ile yaz, sonra
   `qa-layout` kapısından yeniden geç; sonucu `note "kontrol listesi: …"` ile yaz.
8. Kullanıcıya `out/<slug>/stills/sheet.png` dosyasını ve gerekirse önemli tekil kareleri göster. **qa sonuç
   tablosunu**, kontrol listesinin sonucunu ve bilinen sapmaları yaz. **Dur.**

   Otomatik: durma, f'ye geç; bunlar Durak 2'ye girer.

## f) Ses, müzik, render

**Otomatik: ses.** Kullanıcı bir kayıt dosyası verdiyse aşağıdaki align yolunu izle. Vermediyse:

1. Spec'te gerçek bir `voiceover.tts` (elevenlabs ya da azure) varsa önce `npm run voiceover -- build <slug> --estimate`:
   - hesap ödeyemiyor (üretilecek karakter hesapta kalandan fazla) ya da sağlayıcı hata veriyor (anahtar yok, yetki)
     → gerçek TTS yok, 2'ye geç
   - video bütçesi aşılıyor → zorunlu durma noktası; `--over-budget`'ı yalnız kullanıcının onayıyla ver
   - bütçe içinde → sormadan `npm run voiceover -- build <slug>` (sığmazsa `--widen`). İşaretli cümlelerin
     alternatiflerinden en iyisini betik seçer; `review.html` Durak 2'de verilir.
2. Gerçek TTS yoksa (spec'te `tts` yok ya da 1'de üretilemedi): `npm run voiceover -- build <slug> --provider say`
   (sığmazsa `--widen`) → `videos/<slug>/timing.draft.json` ve `public/videos/<slug>/vo.draft.wav` (gitignore'da,
   commit'lenmez), render `npm run render -- <slug> --draft` → `out/<slug>.draft.mp4`, yayına uygun değil. Spec'e
   mutlak saniye yazma: sesle ilgili her an (`emits`, `flashes`, efektler dahil) bir cümleye bağlı olsun, gerçek ses
   gelince kendiliğinden kaysın.
   `note "ses: taslak (say), sebep: …"` yaz ve slug'ı KALAN-ISLER'deki "Taslak sesli videolar" listesine ekle (slug,
   tarih, taslak dosyası, tahmini karakter). **`ekg` ve `gps` hiçbir zaman taslak ses almaz:** onlarda gerçek TTS
   yoksa zorunlu durma noktası; kareler ve `qa-layout` tablosuyla dur, render alma.
3. Sonra aşağıdaki 2–7'yi durmadan yürüt; 6 `qa` kapısıdır.

Seslendirme dosyası verildiğinde:

1. `npm run align -- <slug> <dosya>` çalıştır. Hizalama whisper.cpp ile yerelde yapılır; ilk çalıştırmada ~1,6 GB
   model iner. Kısa duraklamalar sessizliğin ortasından açılır. Çıktıda dört şeye bak:
   - eşleşme oranı: %80'in altındaysa metin ve ses uyuşmuyor olabilir, kullanıcıya sor
   - bölüm başlangıç kaymaları
   - süre önerisi
   - **"Record again" listesi:** sonda yükselen ya da kesik biten cümleler. Kayıt yeniden üretilemez; listeyi
     kullanıcıya ver (`out/<slug>/review.html` ile dinlenir), yeniden kaydedilen dosyayla align'ı tekrarla.
     Otomatik: liste Durak 2'ye girer.
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
   - Otomatik: parçayı sen seç, sorma; seçimi `note` ile yaz.
5. `npm run render -- <slug>` → `out/<slug>.mp4` (taslak seste `--draft` → `out/<slug>.draft.mp4`). Son satır "OK"
   olmalı (−14 ± 0,5 LUFS, ≤ −1 dBTP); değilse nedenini bul.
6. **`npm run qa -- <slug>` zorunlu:** yerleşim, konuşulan sürede 2,6–3,0 kelime/sn, cümle sonu araları (ortalama
   ≥ 0,35 sn), tonlama (işaretli cümleler), nicelik tutarlılığı, dijital sessizlik, yatak sürekliliği. Hata varsa
   düzelt, yeniden render et. Taslak seste qa `out/<slug>.draft.mp4`'i denetler; hız ve duraklamalar ölçülür,
   tonlama "taslak ses, ölçülmedi". Otomatik: `qa` kapısı.
7. Kullanıcıya bildir: dosya yolu, süre, loudness, **qa sonuç tablosu**, kontrol listesinin son durumu, kredilerin
   özeti. Otomatik: Durak 2.

Seslendirme dosyası yoksa (adım adım): gerçek ses için sağlayıcı `voiceover.tts.provider` (elevenlabs ya da azure).
`say` ile taslak ses ve `--draft` render yalnız otomatik modda, gerçek TTS yokken kullanılır; adım adımda kullanılmaz.
**Kredi harcamadan önce** `--estimate` ile tahmini al ve kullanıcıya söyle (üretilecek okuma, karakter, hesapta
kalan); ElevenLabs ücretsiz planında çıkan ses ticari kullanılamaz, bunu da söyle.

- **Bütçe aşılacaksa betik durur (çıkış 3, "bütçe aşılıyor").** O zaman kullanıcıya sor; onay gelmeden
  `--over-budget` ile yeniden çalıştırma. Bütçe `voiceover.tts.budget`, harcanan `out/<slug>/tts-ledger.json`.
- Her cümle ayrı üretilir (komşu cümleler bağlam); önbellek cümle başına ve bağlamdan bağımsız (`out/tts-cache/`):
  bir cümleyi değiştirmek yalnız o cümleyi yeniden ücretlendirir. Cümle aralarına STYLE duraklamaları konur; cümle
  içi duraklamalar mevcut sessizliklerden açılır (azure'da `<break>` ile gelir). Hızlandırma en fazla ×1,05. Ses
  kimliği spec'e (`voiceover.tts`) yazılır.
- Bir bölüm sığmazsa script durup tablo basar: `--widen` ile pencereleri genişlet ya da metni kısaltmayı öner.
- Tonlaması işaretlenen her cümle için `voiceover.tts.takes` (varsayılan 3) alternatif üretilir ve en iyisi otomatik seçilir. Kullanıcıya
  `npm run review -- <slug>` komutunu ver: sayfada (`out/<slug>/review.html`) dinler, seçer; seçim spec'e
  (`voiceover.picks`) yazılır, ses önbellekten kredisiz yeniden kurulur ve sonraki üretimlerde korunur.
- Kredi yoksa, eski bir taslak sesin aralarını `npm run align -- <slug> --timing` açar (Whisper'sız, mevcut kelime
  zamanlarıyla); sonra pencereleri ve `durationSec`'i yeni konuşmaya göre güncelle.

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
