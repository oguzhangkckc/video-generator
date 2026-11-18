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

## Anlatım

- İzleyiciye **"sen"** diye hitap edilir.
- Soyut sistem **tek bir somut yolculuk** üzerinden anlatılır: bir sinyalin, bir paketin, bir elektronun
  yolculuğu… Kamera o yolculuğu izler.
- **Her bölüm "Peki…?" sorusuyla açılır.** Soru bir önceki bölümün bıraktığı boşluğu adlandırır.
- Konuşma hızı **~2,5 kelime/sn**: 30 sn ≈ 70 kelime, 45 sn ≈ 110, 60 sn ≈ 145. Bölüm bütçesi =
  pencere süresi × 2,5 − ~1 kelime pay.
- Cümleler kısa tutulur. Bir cümle bir altyazı sayfasıdır ve tek satıra sığmalıdır (≈ 32 karakter).

## Final

Sıra her zaman aynıdır:

1. **Geri sayımlı doruk** (`countdown`): gerilimin en yüksek anı; 3–2–1 ya da gerçek bir sayaç.
2. **Tek cümlelik özet.**
3. **Kavramın adı en son** (`concept`). İsim videonun içinde önceden söylenmez; izleyici önce ne olduğunu anlar,
   sonra adını öğrenir.

## Ritim

- **2–3 saniyede bir** yeni rakam ya da etiket (`labels`) görünür. Etiket, söylendiği kelimeye bağlanır
  (`{ "cue": "…" }`) ve sesi (`sound`) onunla birlikte çalar.
- Ekranda aynı anda en fazla 4 veri satırı bulunur.

## Kamera ve geçişler

- **Kamera hiç durmaz.** Sabit görünen planlarda bile yavaş bir dönüş, yaklaşma ya da kayma vardır.
- **Düz kesme yoktur.** Sahneler kamera hareketiyle birbirine bağlanır:
  - **nesnenin içinden geçme:** atmosfer pusu (`haze`), halkanın içinden geçiş (`signalPass`)
  - **şekil eşleştirme:** bir sahnedeki biçim diğerindekine oturur (`ringShrink`: halka → işaretçi)
- **Kararma** (`darken`) yalnızca finalde kullanılır.
- Sayaç, harita zoom'u ve 3D kamera aynı eğriden (`curves`) beslenir. Ekranda gördüğün yükseklik ile sayaçtaki
  değer her zaman tutarlıdır.

## Yerleşim

- **Sayaç** sağ üstte, sabit (`counter`).
- **Altyazı** yüksekliğin **%77'sinde**, tek satır karaoke: söylenen kelime beyaz, sıradakiler gri.
- Veri satırları üst yarıda (`top` ≈ 450–850). Notlar sağ altta (`top` ≈ 1330).
- **Güvenli alanlar:** alt %15 (≈ 1630 px altı) ve sağ kenarın son 120 px'i platform arayüzü için boş kalır.
  Okunması gereken hiçbir şey oraya konmaz.

## Ses

- Seslendirme −14 LUFS'e normalize edilir. Efekt dosyaları −16 LUFS'tedir; görece seviyeleri
  `src/kit/audio/sfx-catalog.json` içindeki `level` belirler.
- Ambiyans yatakları ve müzik konuşma sırasında **~6 dB kısılır** (`duck: 0.5`).
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

- [ ] İlk 5 sn: 3 başlık, her biri ~2 sn, birlikte bir soru; ilk kare okunuyor.
- [ ] Her bölüm "Peki…?" ile açılıyor; izleyiciye "sen" deniyor.
- [ ] Kelime sayısı bütçenin içinde (süre × 2,5); hiçbir altyazı satırı taşmıyor.
- [ ] 2–3 sn'de bir yeni rakam/etiket var; aynı anda en fazla 4 veri satırı.
- [ ] Renkler anlamına uygun: turuncu = senin verin, kırmızı = tehlike, camgöbeği = ikincil.
- [ ] Hiçbir yazı güvenli alanlara (alt %15, sağ 120 px) ya da altyazının üstüne binmiyor; işaretçiyi örtmüyor.
- [ ] Hiçbir karede kamera donmuyor; sahne değişimleri geçişle bağlı, düz kesme yok.
- [ ] Ölçeksiz ya da sadeleştirilmiş her görselde not var; her rakamın kaynağı `sources`'ta.
- [ ] Final sırası: geri sayım → tek cümle özet → kavram adı en son.
- [ ] `credits` eksiksiz: ses, efekt, müzik, doku, yazı tipi, kod.
