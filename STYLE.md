# Stil rehberi

Bu projedeki her açıklayıcı video bu kurallara uyar. Bilinçli olarak uyulmayan kural, o videonun `spec.json`
dosyasında `styleExceptions` alanına gerekçesiyle yazılır.

## Format

- Dikey 9:16, **1080×1920**, **30 fps**. Kütüphane bu değerlere göre yazıldı; spec'te değiştirilemez.
- Süre çoğunlukla 30–60 sn. Kelime bütçesi süreden hesaplanır (aşağıda).
- Ses: bütün miks **−14 LUFS**, tepe **≤ −1,5 dBTP**. `npm run render` bunu kendisi yapar ve ölçüp raporlar.

## Renk anlamları

Renkler süs için değil, anlam için kullanılır. Hex değerleri yalnızca `src/kit/theme.ts` içinde durur; spec'te
anlamsal adlar yazılır.

| Spec adı | Renk | Ne için |
|---|---|---|
| — | gece laciverti (`#050B1A` → `#0A1630`, uzayda `#02050D`) | zemin |
| `you` | turuncu `#FFB547` | **"senin" verilerin**: izleyicinin konumu, telefonu, ölçtüğü değer; sayaç |
| `danger` | kırmızı `#FF4D4D` | **tehlike**, hata, sapma |
| `secondary` | camgöbeği `#3FD8E6` | yörüngeler, sinyaller, **ikincil bilgi**, notlar |
| `marker` | mavi `#4DA3FF` | konum işaretçisi |
| `text` | beyaz | nötr veri ve altyazı |
| `muted` | yarı saydam beyaz | önemsiz yardımcı yazı |

Bir ekranda en fazla bir turuncu ve bir kırmızı vurgu bulunur. Kırmızı yalnızca gerçekten bir şey ters gittiğinde
kullanılır.

## Tipografi

- Başlıklar ve altyazı: **Inter** (600 / 800).
- Rakamlar, birimler, etiketler, sayaç: **JetBrains Mono**. Her veri monospace yazılır.
- Türkçe harfler (İ, ı, Ş, ğ…) `latin-ext` alt kümesinden gelir; büyük harfli metinde "İ" doğru yazılır.

## Kanca (ilk 5 saniye)

- İlk 5 saniyede **2'şer saniyelik 3 başlık** (`titles`), birlikte tek bir **soru** kurar. İlk başlık 0. karede
  okunur durumdadır (kapak görseli).
- Kanca, izleyicinin elindeki gündelik bir şeyle başlar ("Cebinde bir uydu alıcısı var.").
- **Kancadaki soru finalde açıkça cevaplanır.** Tek cümlelik özet, kancanın sorusunun cevabıdır.

## Anlatım

- İzleyiciye **"sen"** diye hitap edilir.
- Soyut sistem **tek bir somut yolculuk** üzerinden anlatılır: bir sinyalin, bir paketin, bir elektronun
  yolculuğu… Kamera o yolculuğu izler.
- **Her gövde bölümü "Peki…?" sorusuyla açılır.** Soru bir önceki bölümün bıraktığı boşluğu adlandırır. **Art arda
  iki "Peki…?" cümlesi olmaz;** kancanın sorusu bu yüzden "Peki" ile başlamaz.
- **Kanca başlıkları seslendirmeyle aynı kelimeleri kullanır** (başlık ekrandayken söylenen kelimeler).
- **Konuşma hızı** yalnızca konuşulan sürede ölçülür: **2,6–3,0 kelime/sn** (hedef 2,8). Duraklamalar bunun üstüne eklenir.
- **Duraklamalar (nefes payı):** virgül ve iki nokta ~0,2 sn · cümle sonu ~0,4 sn · "Peki…?" sorusundan sonra ~0,6 sn ·
  bölüm geçişi ~0,7 sn (`src/spec/pauses.ts`). Duraklamada ses yatağı ve kamera sürer; altyazı bir sonraki cümleye
  kadar kalır, ekran boş kalmaz ve donmaz. qa: cümle aralarının ortalaması 0,35 sn'nin altındaysa hata.
- **Kelime bütçesi** = (pencere − duraklamalar) × 2,8. 30 sn ≈ 65 kelime, 45 sn ≈ 95, 60 sn ≈ 125.
- Cümleler kısa tutulur. Bir cümle bir altyazı sayfasıdır ve tek satıra sığmalıdır (≈ 32 karakter).
- **Sağ ya da sol söylenen her yerde ekranda yön ipucu olur.** Anatomik görünümde izleyicinin sağı ekranın solunda
  kalır; "SENİN SAĞIN" gibi bir etiket ya da ok bunu gösterir.

## Duygusal eğri

- En güçlü an (doruk) videonun **son üçte birinde** olur ve spec'te `marks.peak` ile işaretlenir.
- Doruktan sonra **8 sn'den uzun yeni bir bölüm açılmaz**; doruktan sonra yalnızca kısa bir final gelir.

## Final

Sıra her zaman aynıdır:

1. **Doruk:** gerilimin en yüksek anı. **Geri sayım (`countdown`) yalnızca gerçek bir süre, mesafe ya da eşik
   varsa kullanılır** (kalan saniye, kalan metre, aşılacak bir sınır). Yoksa doruk başka bir biçimde kurulur: kritik
   an, karşılaştırma ya da "aha" anı.
2. **Tek cümlelik özet:** kancadaki sorunun cevabı.
3. **Kavramın adı en son** (`concept`). İsim videonun içinde önceden söylenmez; izleyici önce ne olduğunu anlar,
   sonra adını öğrenir. **Kavramın adı izleyicinin muhtemelen zaten bildiği bir şeyse** (EKG, GPS…) finale bir
   şaşırtma eklenir (kelimenin kökeni, beklenmedik bir bağlantı) ya da başka bir kavram seçilir.

## Ritim

- **2–3 saniyede bir** yeni rakam ya da etiket (`labels`) görünür. Etiket, söylendiği kelimeye bağlanır
  (`{ "cue": "…" }`) ve sesi (`sound`) onunla birlikte çalar.
- Ekranda aynı anda en fazla 4 veri satırı bulunur.

## Kamera ve geçişler

- **Kamera hiç durmaz.** Sabit görünen planlarda bile yavaş bir dönüş, yaklaşma ya da kayma vardır.
- **Önce bağlam, sonra detay:** ilk yakın plandan önce nesnenin nerede olduğunu gösteren bir geniş plan gelir
  (kalpten önce göğüs, uydudan önce gezegen).
- **Düz kesme yoktur.** Sahneler kamera hareketiyle birbirine bağlanır:
  - **nesnenin içinden geçme:** atmosfer pusu (`haze`), halkanın içinden geçiş (`signalPass`)
  - **şekil eşleştirme:** bir sahnedeki biçim diğerindekine oturur (`ringShrink`: halka → işaretçi)
- **Kararma** (`darken`) yalnızca finalde kullanılır.
- Sayaç, harita zoom'u ve 3D kamera aynı eğriden (`curves`) beslenir. Ekranda gördüğün yükseklik ile sayaçtaki
  değer her zaman tutarlıdır.

## Sayaç ve zaman çizelgesi

- Sayaç, animasyon (iletim, sinyal) ve `trace` **aynı zaman çizelgesinden** beslenir. Çizelgenin her anahtar değeri
  `timeline.keys` içinde bir `sources[].id`'ye bağlıdır (`"#ad"`); kaynaksız ara değer sayaca yazılmaz.
- Zaman gerçek hızdan farklı akıyorsa `counter.timeScale` verilir; sayaç "×100 YAVAŞ" gibi etiketi kendisi gösterir.
  Birim de kendiliğinden büyür (1000 ms üstü "1,69 sn").
- Bir bölüm içinde hız (×N YAVAŞ) değişmez: her bölüm sayacın eğrisinde tek bir segmenttir. Bölüm geçişinde
  değişen hız etiketi kısa bir vurguyla güncellenir; etiket harfleri en az ~30 px'tir.
- **Sayaç 3 sn'den uzun donmaz.** Bilinçli duraklama `counter.holds` ile yazılır. Kavram kartı sırasında sayaç gizlenir.

## Yerleşim

- **Sayaç** sağ üstte, sabit (`counter`).
- **Altyazı** yüksekliğin **%77'sinde**, tek satır karaoke: söylenen kelime beyaz, sıradakiler gri.
- Veri satırları üst yarıda (`top` ≈ 380–850), sütunun arkasında yarı saydam koyu bir zemin olur (`layout.labelBackdrop`).
  **Etiket kutusuna hiçbir çizim girmez:** sahne, etiket sütununu boş bırakacak şekilde kadrajlanır; `npm run qa` bunu
  hata olarak denetler. Notlar sağ altta (`top` ≈ 1330).
- **Güvenli alanlar:** alt %15 (≈ 1630 px altı) ve sağ kenarın son 120 px'i platform arayüzü için boş kalır.
  Okunması gereken hiçbir şey oraya konmaz. Varsayılan `layout` (sağ boşluk 132 px, ortalanmış genişlik 840 px) bunu
  sağlar; `npm run qa` taşan ya da çakışan her yazıyı hata olarak bildirir.

## Ses

- Seslendirme −14 LUFS'e normalize edilir. Efekt dosyaları −16 LUFS'tedir; görece seviyeleri
  `src/kit/audio/sfx-catalog.json` içindeki `level` belirler.
- Ambiyans yatakları ve müzik konuşma sırasında **~6 dB kısılır** (`duck: 0.5`).
- Yatak ya da müzik **videonun tamamı boyunca kesintisiz** çalar. Kısa bir yatak `loop: true` ile döner; müzik
  kullanılmıyorsa varsayılan yatak `space`, `loop: true`, 0'dan sona.
- Konuşma hızı render sonrası ölçülür (`npm run qa`): genel olarak 2,2–2,8 kelime/sn.
- Efekt görsel bir olaya bağlıdır: bir etiket, bir geçiş, bir çarpma. Olaysız efekt yoktur.

## Dürüstlük

- Ölçeksiz çizilen her şeyde not gösterilir (`notes`: "ÖLÇEKLİ DEĞİL").
- Sadeleştirilmiş bir rakam ya da tartışmalı bir iddia `sources` içinde `simplified` / `disputed` olarak
  işaretlenir. Ekranda kalıyorsa yanına not konur ("YAKLAŞIK", "SADELEŞTİRİLDİ").
- Her rakamın bir kaynağı vardır (`sources`); kaynaksız rakam ekrana çıkmaz.

## Özgünlük ve krediler

- Başka içerik üreticilerinin **metni, görüntüsü, müziği kopyalanmaz**; stilden ilham alınabilir, içerik özgün
  yazılır.
- Kullanılan her model, ses, doku, yazı tipi ve müzik parçası `credits` içine **lisansı ve sahibiyle** yazılır.
  Lisansı belirsiz bir öğe kullanılmaz.

## Kontrol listesi

Still kareler incelenirken (skill adım e) her madde tek tek kontrol edilir:

- [ ] İlk 5 sn: 3 başlık, her biri ~2 sn, birlikte bir soru; başlıklar seslendirmenin kelimeleri; ilk kare okunuyor.
- [ ] Art arda iki "Peki…?" yok; doruk son üçte birde, ardından 8 sn'den uzun bölüm yok.
- [ ] Etiket sütununa çizim girmiyor; bir bölüm içinde sayacın hız etiketi değişmiyor.
- [ ] Kancadaki soru finalde açıkça cevaplanıyor.
- [ ] Her bölüm "Peki…?" ile açılıyor; izleyiciye "sen" deniyor.
- [ ] Kelime sayısı bütçenin içinde (süre × 2,5); hiçbir altyazı satırı taşmıyor.
- [ ] 2–3 sn'de bir yeni rakam/etiket var; aynı anda en fazla 4 veri satırı.
- [ ] Renkler anlamına uygun: turuncu = senin verin, kırmızı = tehlike, camgöbeği = ikincil.
- [ ] Hiçbir yazı güvenli alanlara (alt %15, sağ 120 px) ya da altyazının üstüne binmiyor; işaretçiyi örtmüyor.
- [ ] Hiçbir karede kamera donmuyor; sahne değişimleri geçişle bağlı, düz kesme yok.
- [ ] İlk yakın plandan önce nesnenin yerini gösteren geniş plan var; sağ/sol söylenen yerde yön ipucu var.
- [ ] Sayaç kaynaklı çizelgeden besleniyor, 3 sn'den uzun donmuyor, yavaş/hızlı akışta etiket var.
- [ ] Ölçeksiz ya da sadeleştirilmiş her görselde not var; her rakamın kaynağı `sources`'ta.
- [ ] Final sırası: doruk → tek cümle özet → kavram adı en son. Geri sayım yalnızca gerçek bir süre/eşik için;
      tanıdık kavramda şaşırtma var.
- [ ] `npm run qa` temiz (e adımında yerleşim, f adımında ses); sonuç tablosu kullanıcıya gösterildi.
- [ ] `credits` eksiksiz: ses, efekt, müzik, doku, yazı tipi, kod.
