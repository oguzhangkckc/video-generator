# Stil rehberi

Bu projedeki her açıklayıcı video bu kurallara uyar. Bilinçli olarak uyulmayan kural, o videonun `spec.json`
dosyasında `styleExceptions` alanına gerekçesiyle yazılır. Metin denetiminin bir kuralı bilerek çiğneniyorsa madde
`{ "rule": "acik-final", "why": "…" }` biçiminde yazılır; denetim o kuralı "muaf" diye listeler, hata saymaz.

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
  okunur durumdadır (kapak görseli). Başlık varsayılan olarak y 560'tadır; sahnenin öznesi (örneğin bir veri
  çizgisi) başlık ile altyazı arasına %35'iyle sığmıyorsa başlık yukarı alınır (`titles[].y`).
- **İlk 3 saniye kapaktır ve kare kare temiz olur:** hiçbir yazı (belirirken bile) başka bir yazıya, altyazı bandına
  ya da güvenli alana girmez; önemli öğe örtülmez, özne ≥ %35, kare ≤ %40 boş, ve bunlar tek bir karede bile bozulmaz.
  qa bu aralığı her 2 karede bir payısız ölçer ("Kapak" satırı) ve kare 0'ı `out/<slug>/cover.png` olarak kaydeder.
  Kare 0'da kanca başlığı şartı yalnız başlığı olan videolara uygulanır (tür demolarında başlık yoktur).
- Kanca, izleyicinin elindeki gündelik bir şeyle başlar ("Cebinde bir uydu alıcısı var.").
- **Kancadaki soru finalde açıkça cevaplanır.** Tek cümlelik özet, kancanın sorusunun cevabıdır (aşağıda "Söz ve
  karşılık").

## Anlatım

- İzleyiciye **"sen"** diye hitap edilir.
- Soyut sistem **tek bir somut yolculuk** üzerinden anlatılır: bir sinyalin, bir paketin, bir elektronun
  yolculuğu… Kamera o yolculuğu izler.
- **Geçişler çeşitlidir: bir videoda en fazla 2 bölüm "Peki…?" ile açılır.** "Peki…?" bir önceki bölümün bıraktığı
  boşluğu adlandırır. Diğer bölümler başka bir geçişle açılır: doğrudan bir iddia ("Kalbin kendi pili var."),
  beklenmedik bir rakam ("Saniyenin onda biri.") ya da "ama" ile ters köşe ("Ama dalga burada duruyor."). **Art arda
  iki "Peki…?" cümlesi olmaz.** `npm run check` ikisini de hata sayar (`peki-siniri`, art arda "Peki").
- **Kanca başlıkları seslendirmeyle aynı kelimeleri kullanır** (başlık ekrandayken söylenen kelimeler).
- **Metin kalitesi.** Her metin bu altı testten geçer; denetleyen yanında yazılıdır. Skill c) adımında metni yazarın
  bağlamını görmeyen bir editör ajanı (`.claude/agents/metin-editoru.md`) bu kurallara göre satır satır eleştirir.
  1. **Söz ve karşılık:** kancadaki soru finalde tam olarak, o soruya verilen bir cevapla karşılanır. Video açık bir
     soruyla (fragman gibi) bitmez; finalde yeni bir merak açılmaz. Son cümle soru olamaz
     (`npm run check` hatası, `acik-final`); sorunun gerçekten cevaplandığını editör denetler.
  2. **Her cümle yerini hak eder:** bir cümle çıkarıldığında kancadan cevaba giden zincir bozulmuyorsa o cümle silinir
     (silme testi; editör).
  3. **Somutluk:** her soyut kavrama somut bir görüntü ya da benzetme eşlik eder ("gerilim" tek başına değil: "kalem
     pilin binde birinden az"). Görüntü ekranda da olabilir, sözde de (editör).
  4. **Doğal Türkçe:** çeviri kokan ifadeler ("ateşleniyor") ve günlük anlamı farklı olan teknik terimler ("uyarılıyor")
     kullanılmaz. Liste `src/spec/avoid.ts`'te, telaffuz sözlüğünün yanında; `npm run check` listedekiler için uyarı
     verir (`kacinilacak`). Editör listede olmayanları da yakalar; tekrar edenler listeye eklenir.
  5. **Özet doğru, özne doğru:** "Yani her…", "hepsi…" gibi bir özet ya da genelleme önceki her cümleyle uyuşur,
     istisnası olmaz; bir parça anlatılırken özne o parçadır, bütün değil ("alt odalar kasılıyor", "kalp kasılıyor"
     değil). Editör denetler.
  6. **Anlatma testi:** izleyicinin videodan sonra bir arkadaşına tek cümleyle anlatabileceği şaşırtıcı bilgi metinle
     birlikte yazılır. Böyle bir cümle yoksa metin hazır değildir. Editör bu cümleyi metinden kendisi çıkarır; ikisi
     farklıysa metin söylediğini sandığı şeyi söylemiyordur.
- **Konuşma hızı** yalnızca konuşulan sürede ölçülür: **2,6–3,0 kelime/sn** (hedef 2,8). Duraklamalar bunun üstüne
  eklenir. Pencereye sığdırmak için hızlandırma yok: zaman germe en fazla ×1,05; sığmıyorsa pencere genişler ya da
  metin kısalır.
- **Duraklamalar (nefes payı):**

  | Sonra | Duraklama |
  |---|---|
  | virgül, iki nokta, noktalı virgül | ~0,2 sn |
  | cümle sonu | ~0,4 sn |
  | soru | ~0,6 sn |
  | bölüm geçişi | ≥ 0,7 sn |

  Kaynak: `src/spec/pauses.ts`. Duraklama, konuşmanın sustuğu süredir; arada duyulan nefes de duraklamaya dahildir.
  Ses yalnızca mevcut sessizliğin ortasından kesilip açılır, konuşmanın kenarından asla: son kelimeden sonra en az
  150 ms doğal sönüm kalır, kesimin iki yanına 15 ms fade. Duraklamada ses yatağı ve kamera sürer; altyazı bir sonraki
  cümleye kadar kalır, ekran boş kalmaz ve donmaz. qa: cümle sonu arası 0,25 sn'den kısaysa uyarı, cümle sonu
  aralarının ortalaması 0,35 sn'nin altındaysa hata.
- **Tonlama:** nokta ile biten cümleler ve soru kelimesiyle (ne, nasıl, neden, nereden, kim, hangi…) kurulan sorular
  sonda düşer. Son 0,4 sn'de **+2 yarım tondan fazla yükselme** ya da son hecede **60 ms'den kısa sönüm** cümleyi
  işaretler (`scripts/prosody.py`). Virgül, iki nokta, noktalı virgülle biten parçalar ve evet/hayır soruları ("mi")
  yükselebilir. Taslak seste işaretli cümleye 3 alternatif çekim üretilir, en iyisi otomatik seçilir;
  `out/<slug>/review.html` ile dinlenip değiştirilebilir. İnsan kaydında işaretli cümle yeniden kaydedilir.
- **Cümle tek harf, kısaltma ya da sembolle bitmez:** "…dalgası: T." değil, "Sonra T dalgası geliyor: toparlanma."
- **Vurguyu yanlış kelimeye düşüren soru kalıbı kullanılmaz:** soru, soru kelimesiyle bitmez. "Peki o sivri tepe ne?"
  değil, "Peki ya o sivri tepe?"
- **Telaffuz sözlüğü** (`src/spec/lexicon.ts`) projede tektir: kısaltma, birim ve sembolün nasıl okunacağı orada
  yazılır (QRS → "kü re se"). Seslendirmeye okunuş, altyazıya yazılış gider. Sözlükte olmayan kısaltma, rakam ya da
  sembol seslendirmeye giremez (`npm run check` hatası): sözlüğe eklenir ya da yazıyla yazılır.
- **Seslendirmedeki büyüklük, ekrandaki etiketle aynı fiziksel niceliktir.** Etiket "≈ 1 mV" (gerilim) gösterirken
  seslendirme "akım" demez; gerilim, akım, süre, hız birbirine karışmaz (`src/spec/quantities.ts`, qa uyarısı).
- **Kelime bütçesi** = (pencere − duraklamalar) × 2,8. 30 sn ≈ 65 kelime, 45 sn ≈ 95, 60 sn ≈ 125.
- Cümleler kısa tutulur. Bir cümle bir altyazı sayfasıdır ve tek satıra sığmalıdır (≈ 32 karakter); sığmayan cümle
  kelime sınırında 2–6 kelimelik iki sayfaya bölünür, iki sayfaya da sığmıyorsa `npm run check` hatası (cümleyi kısalt).
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
   sonra adını öğrenir. **Kavramın adı izleyicinin muhtemelen zaten bildiği bir şeyse** (EKG, GPS…) seslendirme adı
   yalnızca söylemez ("Bunun adı: elektrokardiyogram." yetmez); ad üzerinden bir şaşırtma verir: kelimenin kökeni ya da
   anlamı izleyicinin az önce gördüğü şeyi yeniden adlandırır ("elektro, kardiyo, gram: kalbin elektrikle yazdığı
   yazı"). Bu mümkün değilse başka bir kavram seçilir.
   **Kartın bütün yazıları koyu zemindedir:** kart ve onunla birlikte gösterilen ortalı veri satırları tek bir koyu
   panelin üstünde durur (etiket paneli kartı da içine alır). Panel kapalıysa (`layout.labelBackdrop: false`) sahne kart
   belirene kadar en az 0,6 karartılır (`darken`), değilse `npm run check` hatası. qa: kartla birlikte gösterilip
   panelin dışında kalan yazı hata ("Kavram kartı").

## Ritim

- **2–3 saniyede bir** yeni rakam ya da etiket (`labels`) görünür. Etiket, söylendiği kelimeye bağlanır
  (`{ "cue": "…" }`) ve sesi (`sound`) onunla birlikte çalar.
- **Etiket söyleneni gösterir.** Etiketin (ve vurgulanan veri çizgisi etiketinin) kelimelerinin en az yarısı
  göründüğü andan 1 sn önce ile 1,5 sn sonrası arasında söylenir (ek alabilir: "BEKLEME" ~ "bekliyor"); etikette rakam
  varsa o arada bir sayı da söylenir. Metin değişince geride kalan etiket ya da metnin sade kelimeyle anlattığı
  şeyin teknik adı ("SA DÜĞÜMÜ" ↔ "hücre kümesi") `npm run check` hatasıdır (`src/spec/label-speech.ts`). Ya söyle,
  ya etiketi söylenen kelimeyle yaz, ya da kaldır.
- Ekranda aynı anda en fazla 4 veri satırı bulunur.

## Kamera ve geçişler

- **Kamera hiç durmaz.** Sabit görünen planlarda bile yavaş bir dönüş, yaklaşma ya da kayma vardır.
- **Önce bağlam, sonra detay:** ilk yakın plandan önce nesnenin nerede olduğunu gösteren en az 1 sn'lik bir geniş
  plan gelir (kalpten önce göğüs, uydudan önce gezegen). Ölçek değiştiren her geçişte önce geniş, sonra yakın plan.
  Çekim türü (`kind`: wide / medium / close) yazılmazsa zoom'dan okunur (< 0,8 geniş, ≥ 2 yakın); `npm run check`
  geniş plansız yakın planı reddeder (bir `match`/`through` geçişinin indiği açılış hariç).
- **Tanınabilir bağlam planı:** ölçek değişen her bölümde öznenin **tanınabilir silueti** en az 1 sn tamamen
  kadrajdadır. Siluet, nesneyi tanıtan dış hattır: gövde için omuz ve boyun çizgisi, kalp için iki kulakçık ve
  karıncıkların tepesi. Kırpılmış bir gövde bloğu ya da tek başına bir kalp kesiti bağlam değildir. qa: bir bölüm
  boyunca ana sahnenin öznesi 1 sn kesintisiz tamamen kadraja girmiyorsa uyarı ("Bağlam planı"); siluetin
  tanınabilirliğini kare kontrolünde göz yakalar.
- **Düz kesme yoktur.** İki sahnenin ekranda örtüştüğü her an `transitions` altında yazılır (`npm run check`):
  1. **İçinden geçme** (`through`): kamera nesneye girer, kare onunla dolar, sonraki sahne eşleşen öğeden açılır.
     Aynı sahne içinde dıştan içe iniş de böyledir (göğüsten kalbe): kesintisiz yaklaşma, dış katman söner.
  2. **Şekil eşleştirme** (`match`): bir sahnedeki öğe diğerindekiyle aynı yerde, aynı boyda (qa ±%5 ölçer).
  3. **Renk parlaması** (`flash`, `haze`): yalnızca son çare, `why` gerekçesiyle.
  Neredeyse boş bir kareye eriyerek geçilmez: geçişin ±0,6 sn'sinde kare %60'tan fazla boş olamaz (qa).
- **Kararma** (`darken`) yalnızca finalde kullanılır ve altındaki sahneyi tamamen kapatmaz.
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
- **Altyazı** yüksekliğin **%77'sinde**, tek satır karaoke: söylenen kelime beyaz, sıradakiler gri. **Yazı boyutu
  video boyunca sabittir** (`captions.size`, varsayılan 60); sığdırmak için asla küçültülmez. qa: boyut değişirse ya da
  bir sayfa satıra sığmazsa hata.
- **Sahne her zaman tüm kareyi kullanır;** sabit bir bant ya da pencere yoktur. Koyu zeminli etiket panelleri
  (`layout.labelBackdrop`), veri şeritleri (`trace` + `panel`) ve altyazı sahnenin üstüne bindirilir.
- Veri satırları üst yarıda (`top` ≈ 380–850). Ekranda kanca başlığı yokken ve sahnenin önemli öğeleri bu bandı
  kullanıyorsa (büyük bir diyagram), satırlar sayacın soluna, `top` ≈ 150–330'a çıkabilir. **Önemli öğe panele girmez:** her sahne o anki önemli öğelerini
  bildirir (yanan düğüm, ilerleyen sinyal ve **yolu** — ucun 0,25 sn gerisinden 0,5 sn ilerisine kadar —, vurgulanan
  bölge, kalem, veri çizgisinin sivri uçları, adı söylenen öğe) ve kamera onları panel, şerit
  ve altyazı bölgelerinin dışında tutar (`src/kit/framing.ts`; panel belirmeden 0,6 sn önce yumuşakça yer açar).
  Noktasal öğe üst yazıya hiç değmez, alan öğesinin en fazla %25'i örtülebilir; panelin arkasında kalan arka plan
  çizgileri sorun değildir. `npm run qa` ihlali hata sayar. Notlar sağ altta.
- Veri satırı sahnedeki bir öğeyi adlandırıyor ve öğe kendiliğinden seçilmiyorsa (birkaç düğümden biri, küçük bir
  parça) satır panelden öğeye ince bir **kılavuz çizgiyle** bağlanır (`pointTo: "katman.öğe"`). Gösterilen öğe satır
  boyunca önemli sayılır, panelin dışında tutulur. Kılavuz panelin öğeye bakan kenarından çıkar; alttan (üstten)
  çıkan kılavuz yalnız en alttaki (üstteki) satıra aittir, altına yeni satır gelince söner. Kılavuz öğenin **çizilen**
  bir noktasında biter (içi boş bir şeklin ortasında değil; orada başka bir öğe durabilir). Hiçbir şey çizmeyen bir
  vekil öğeye (dolgusuz, kenarsız bölge) ne kılavuz ne `say` bağlanır: onu çizen öğeye bağlanır. qa: öğe ekranda
  değilse, hiçbir şey çizmiyorsa, kılavuz ucu öğenin çizilen bir noktasında değilse ya da kılavuz başka bir yazının
  (etiket, not, sayaç, altyazı) üstünden geçerse hata.
- **Güvenli alanlar:** alt %15 (≈ 1630 px altı) ve sağ kenarın son 120 px'i platform arayüzü için boş kalır.
  Okunması gereken hiçbir şey oraya konmaz. Varsayılan `layout` (sağ boşluk 132 px, ortalanmış genişlik 840 px) bunu
  sağlar; `npm run qa` taşan ya da çakışan her yazıyı hata olarak bildirir.
- **Yazı yazıya, altyazıya değmez — sahnenin kendi yazıları da.** Üst yazılar (etiket, not, başlık, sayaç, kart) ve
  sahnelerin çizdiği yazılar (veri çizgisi etiketleri, ölçek notu) birbirine değmez; hiçbir yazı altyazı bandına
  (altyazının her sayfada kaplayabileceği şerit, o anki sayfa değil) girmez. Veri şeridinin yazıları panelinin
  içinde kalır. Ölçek notu çizginin en alçak noktasının hemen altına konur.
- **Veri çizgisi başlığa ve altyazıya girmez.** Sahne olarak çizilen çizginin sivri uçları önemli öğedir; kamera onları
  başlık, panel ve altyazıdan uzak tutar, gerekirse uzaklaşarak çizgiyi küçültür. Veri şeridinde ölçek (`pxPerY`)
  kendiliğinden küçülür: çizgi, tepe etiketleri ve parantezleriyle kameranın en yakın çekiminde bile panele sığar; ölçek
  katman boyunca sabittir.

## Kompozisyon

`npm run qa` her 0,25 sn'de ölçer:

- **Özne** (çekimin konusu: `subject`, yoksa kameranın baktığı bölge) karenin yüksekliğinin **%35'inden** küçük
  kalırsa ve bu **2 sn'den** uzun sürerse hata.
- Karenin **%40'ından fazlası 1 sn'den uzun süre boş** kalırsa hata. Boş: 40 px'lik hücrede yalnızca zemin görünür
  (sahnenin gradyanı, çıplak uzay, pus; üstünde karartma, panel ya da gölge olsa da). Dolgulu şekil ve silik ızgara
  içeriktir.
- **Önemli öğe kareden taşmaz:** noktasal öğe tamamen, alan öğesi en az %75'iyle karede kalır. Kenarda kesik durmak
  0,5 sn'den uzun sürerse hata; öğe belirirken (dışarıdan girerken) ya da önemini yitirirken çıkması 1 sn'ye kadar
  serbest. Kameranın arkasında kalan öğe görünmüyor sayılır.
- Görüntü **0,3 sn'den uzun donmaz** (render üzerinde ölçülür).
- Kasıtlı bir yakın plan (`kind: "close"`) değilse özne kare kenarında kırpılmaz (uyarı).
- **Bağlam:** seslendirmede bir yer ya da öğe adı geçiyorsa (`say` takma adları) o öğe cümlenin en az yarısı boyunca
  karede ve üst yazıların dışında görünür (hata). Konum sözü ("köşe", "üst", "yörünge"…) geçip hiçbir öğeye bağlı
  değilse uyarı. **Görsele gönderen isimler** ("çizgi", "yazı", "tepe", "düzlük", "eğri", "grafik", "şema", "şerit",
  "harita"; `src/spec/visual-words.ts`) de öğe adıdır: söylendiğinde o görseli çizen öğeye `say` ile bağlanır ve aynı
  ölçüme girer; bağlı değilse `npm run check` uyarı verir (`gorsel-soz`). Veri çizgisinin bütünü (`trace.say`) ve
  harita (`cityMap.say`) da bağlanabilir.

## Veri çizgisi etiketleri

- Etiketler birbirine değmez ve veri çizgisinin üstünden geçmez.
- Bir **aralığı** anlatan etiket (süre, bölüm: PR) taban çizgisinin altında **köşeli parantezle** gösterilir
  (`marker: "bracket"`).
- Tek bir **noktayı** ya da dalgayı anlatan etiket (P, QRS, T) çizginin üstüne konur ve kısa bir **kılavuz çizgiyle**
  tepesine bağlanır (`marker: "leader"`). Çakışan etiketler yana kayar ya da bir sıra yukarı çıkar.
- Veri şeridinde etiketler panelin içinde kalır (panel kırpar); yer yoksa qa bildirir.
- **Yan yana iki etiket tek ifade gibi okunmaz:** aynı satırdaki iki etiketin arasında en az bir etiket yüksekliği
  boşluk olur ("ÜST ALT" bir ifade gibi okunur; "ÜST" ile "ALT" iki ayrı ad).
- **Parça anlamını çizer:** genliğin değiştiğini anlatan bir parça (kararma: taşıyıcı kısa süre sıfıra iner; yük
  çukuru: belirgin bir düşüş) bunu spec'te `drop` ile bildirir (kararma ≈ 0,05, çukur ≈ 0,35) ve çizgi en az iki
  döngü o düzeyde kalır. Fark yalnız renkle verilmez; abartılı çizilen değişiklik için not konur.
- qa: etiket teması, yan yana okunma, çizgiyi kesme, kılavuzun başka etikete değmesi, panelden taşma ve çizilen
  genliğin bildirilen `drop`'a inmemesi hatadır.

## Ses

- Seslendirme −14 LUFS'e tek bir kazançla normalize edilir (dinamik sıkıştırma duraklamaları kısaltır). Efekt
  dosyaları −16 LUFS'tedir; görece seviyeleri
  `src/kit/audio/sfx-catalog.json` içindeki `level` belirler.
- Ambiyans yatakları ve müzik konuşma sırasında **~6 dB kısılır** (`duck: 0.5`).
- Yatak ya da müzik **videonun tamamı boyunca kesintisiz** çalar. Kısa bir yatak `loop: true` ile döner; müzik
  kullanılmıyorsa varsayılan yatak `space`, `loop: true`, 0'dan sona.
- Konuşma hızı, duraklamalar ve tonlama seslendirme dosyasında ölçülür (`npm run qa`); ölçüler "Anlatım"da.
- **Geçici ses (macOS `say`, Yelda) yalnız zamanlama ve altyazı denemesidir:** tonlama ve konuşma hızı ona
  uygulanmaz, final render onunla yapılmaz (`npm run render` durur; deneme için `--draft`).
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
- [ ] Sahne tüm kareyi kullanıyor; önemli öğe panele, şeride ya da altyazıya girmiyor; bir bölüm içinde sayacın hız
      etiketi değişmiyor.
- [ ] Özne ≥ %35, kare ≤ %40 boş, donma yok; söylenen yer o anda ekranda.
- [ ] Veri etiketleri değmiyor, yan yana tek ifade gibi okunmuyor, çizgiyi kesmiyor; aralıklar köşeli parantezle
      altta, noktalar kılavuzla üstte; kılavuz gösterdiği şeyin çizilen kenarında bitiyor.
- [ ] Anlatılan her eylem (kasılma, kayma, kararma, yayılma) görüntüde bir hareketle karşılanıyor mu? Bir parça
      genlik değişikliği anlatıyorsa çizgi gerçekten iniyor; fark yalnız renkle verilmiyor. Kasılma flow `squeeze`
      ile çizilir ve qa çizilen küçülmeyi ölçer ("Eylem" satırı); söz ile hareket aynı anda, önce sebep (elektrik)
      sonra sonuç (hareket).
- [ ] Kancadaki soru finalde açıkça cevaplanıyor; video soruyla bitmiyor.
- [ ] En fazla 2 bölüm "Peki…?" ile açılıyor, diğerleri iddia, rakam ya da "ama" ile; izleyiciye "sen" deniyor.
- [ ] Anlatma cümlesi var ve editörün çıkardığıyla aynı; editör listesindeki her bulgu düzeltildi ya da gerekçeli.
- [ ] `npm run text` uyarıları (kaçınılacak ifadeler) düzeltildi ya da gerekçeli.
- [ ] Kelime sayısı bütçenin içinde ((pencere − duraklamalar) × 2,8); hiçbir altyazı satırı taşmıyor.
- [ ] Cümle harf/kısaltma/sembolle bitmiyor; soru, soru kelimesiyle bitmiyor; her kısaltma sözlükte.
- [ ] Seslendirmedeki her büyüklük, o an ekrandaki etiketle aynı nicelik (gerilim/akım/süre/hız).
- [ ] 2–3 sn'de bir yeni rakam/etiket var; aynı anda en fazla 4 veri satırı; her etiket o an söyleneni gösteriyor.
- [ ] Renkler anlamına uygun: turuncu = senin verin, kırmızı = tehlike, camgöbeği = ikincil.
- [ ] Hiçbir yazı güvenli alanlara (alt %15, sağ 120 px) ya da altyazının üstüne binmiyor; işaretçiyi örtmüyor.
- [ ] Hiçbir karede kamera donmuyor; her sahne değişimi `transitions`'ta (içinden geçme > şekil eşleştirme >
      gerekçeli parlama), boş kareye erime yok.
- [ ] İlk yakın plandan önce nesnenin yerini gösteren geniş plan var; sağ/sol söylenen yerde yön ipucu var.
- [ ] Sayaç kaynaklı çizelgeden besleniyor, 3 sn'den uzun donmuyor, yavaş/hızlı akışta etiket var.
- [ ] Ölçeksiz ya da sadeleştirilmiş her görselde not var; her rakamın kaynağı `sources`'ta.
- [ ] Final sırası: doruk → tek cümle özet → kavram adı en son. Geri sayım yalnızca gerçek bir süre/eşik için;
      tanıdık kavramda ad üzerinden şaşırtma var (kökeni ya da anlamı), ad yalnızca söylenmiyor.
- [ ] `npm run qa` temiz (e adımında yerleşim, f adımında ses); sonuç tablosu kullanıcıya gösterildi.
- [ ] `credits` eksiksiz: ses, efekt, müzik, doku, yazı tipi, kod.
