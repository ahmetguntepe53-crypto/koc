// Kalıp bankası: öğrenciyle konuşma rehberi (konusma.*) ve nötr dikkat notları (dikkat.*) — bkz. ../catalog.js ve ../text.js (h).

// Tekil/çoğul seçimi (ör. "Bu ödevde" / "Bu ödevlerde").
const coklu = (n, tek, cok) => (n > 1 ? cok : tek);
// "bir ödev" / "3 ödev" — 1 için rakam yerine "bir" daha doğal okunur.
const adet = (n, h, word) => (n === 1 ? `bir ${word}` : h.n(n, word));
// Cümle başında rakam kullanmamak için küçük sayılar yazıyla.
const YAZIYLA = ["Hiç", "Bir", "İki", "Üç"];

// konusma.acilis: "olumlu" alanı motorda öğrenciye hitaben (2. tekil kişi) gelir: "ödevlerini zamanında teslim etmeni",
// "TYT Türkçe dersindeki istikrarını". Bu yüzden her kalıp onu koçun öğrenciye söyleyeceği doğrudan söz içinde kullanır.

// konusma.hedef: haftalık soru hedefi (ders varsa dersle birlikte), yoksa null.
const hedefSoru = (f, h) =>
  f.hedefQ == null ? null : f.ders ? `${f.ders} dersinde ${h.n(f.hedefQ, "soru")}` : `toplam ${h.n(f.hedefQ, "soru")}`;
// Aynı hedef, öğrencinin ağzından ("… çözeceğim"); ders var ama soru hedefi yoksa önceliği söyler.
const hedefSoruBen = (f, h) =>
  f.hedefQ == null
    ? f.ders ? ` ve önceliği ${f.ders} dersine vereceğim` : ""
    : ` ve ${f.ders ? `${f.ders} dersinde` : "toplam"} ${h.n(f.hedefQ, "soru")} çözeceğim`;
// Aktif gün hedefi; ders var ama soru hedefi yoksa yanına öncelik notu.
const gunHedef = (f, h, word) => `${h.n(f.gun, word)}${f.ders && f.hedefQ == null ? ` (öncelik ${f.ders})` : ""}`;

// dikkat.veri: alanların varlığı ve serbest çalışma farkının yönü.
const varK = (f) => f.kismiOran != null;
const varS = (f) => f.serbestFark != null;
const yon = (f) => (f.serbestFark >= 0 ? "yüksek" : "düşük");

// dikkat.takipDisi: tek ders mi, birden çok mu.
const tekDers = (f) => (f.dersler || []).length <= 1;

export default {
  // ============================================================== ÖĞRENCİYLE KONUŞMA
  "konusma.acilis": [
    (f, h) => `Genel bir “aferin” yerine somut konuşun ve görüşmeyi “${h.cap(f.olumlu)} fark ettim, emeğin görünüyor.” gibi bir cümleyle açın.`,
    (f, h) => `İlk dakikaları takdire ayırın; “${h.cap(f.olumlu)} çok beğendim, tebrikler.” demek, konuşmanın geri kalanını kolaylaştırır.`,
    (f, h) => `Gündeme geçmeden “İlk olarak ${f.olumlu} konuşalım, bunu nasıl sağladın?” diye sorun; neyin işe yaradığını öğrenci kendisi anlatsın.`,
    (f, h) => `Olumlu bir giriş, öğrencinin savunmaya geçmesini önler; bu yüzden söze “${h.cap(f.olumlu)} takdir ediyorum.” diyerek girin.`,
    (f, h) => `Takdiri somut bir gözleme bağlayın: “${h.cap(f.olumlu)} görünce çok sevindim.” cümlesi, emeğin fark edildiğini açıkça gösterir.`,
    (f, h) => `Açılış için kısa ve içten bir cümle yeter; örneğin “${h.cap(f.olumlu)} özellikle not ettim.” deyip öğrencinin tepkisini dinleyin.`,
    (f, h) => `Öğrenci emeğinin görüldüğünü hissetsin: görüşmenin ilk cümlesi “${h.cap(f.olumlu)} takip ettim, bununla gurur duyabilirsin.” olabilir.`,
    (f, h) => `Zorlanılan konulara geçmeden önce iyi gideni konuşun; “Sence ${f.olumlu} mümkün kılan ne oldu?” sorusu, işe yarayan alışkanlığı ortaya çıkarır.`,
  ],

  "konusma.soruSessiz": [
    (f, h) => `Ne teslim edilen ne de pas geçilen ${adet(f.sayi, h, "ödev")} için “${coklu(f.sayi, "Bu ödevde", "Bu ödevlerde")} işler nerede tıkandı?” diye sorun; amaç nedeni anlamak, hesap sormak değil.`,
    (f, h) => `Sessiz kalan ${adet(f.sayi, h, "ödev")} hakkında tahmin yürütmek yerine sözü öğrenciye bırakın ve “O günlerde neler oluyordu?” gibi açık bir soruyla başlayın.`,
    (f, h) => `Açık kalan ${adet(f.sayi, h, "ödev")} için “Neden yapmadın?” yerine “${coklu(f.sayi, "Bu ödevde", "Bu ödevlerde")} hangi noktada durdun?” diye sorun; ikinci soru suçlamadan bilgi toplar.`,
    (f, h) => `Engelin süre mi, konu mu yoksa başka bir şey mi olduğunu anlamak için öğrenciye yanıtsız kalan ${adet(f.sayi, h, "ödevin")} hikâyesini kendi sözleriyle anlatma fırsatı verin.`,
    (f, h) => `Kapalı sorular yerine “Başlamanı zorlaştıran ne oldu?” gibi açık bir soru seçin; sonuç girilmeyen ${adet(f.sayi, h, "ödev")} için asıl nedeni genellikle bu soru ortaya çıkarır.`,
    (f, h) => `Yargılamadan, merakla yaklaşın: süresi geçtiği hâlde sonuç girilmeyen ${adet(f.sayi, h, "ödev")} için “O hafta planın nasıl ilerledi?” diye sorun.`,
    (f, h) => `Pas seçeneğini de gündeme getirin: ${adet(f.sayi, h, "ödev")} sessiz kaldığına göre “Zorlandığında pas geçip nedenini yazmak sana nasıl gelir?” sorusu hem nedeni hem çözümü konuşturur.`,
  ],

  "konusma.soruOdak": [
    (f, h) => `${f.ders} dersinde${f.konu ? `, özellikle ${h.q(f.konu)} konusunda,` : ""} öğrenciye “Soruyu okuduğunda ilk nerede takılıyorsun?” diye sorun.`,
    (f, h) => `Zorlanmayı birlikte görmek için ${f.konu ? `${h.q(f.konu)} konusundan` : `${f.ders} dersinin son ödevinden`} bir soruyu açın ve öğrenciden düşünme adımlarını sesli anlatmasını isteyin.`,
    (f, h) => `Hata türünü birlikte ayırın: ${f.konu ? `${h.q(f.konu)} konusundaki` : `${f.ders} dersindeki`} son yanlışlar için “Bu yanlış bilgi eksiğinden mi, dikkatten mi, işlem hatasından mı geldi?” diye sorun.`,
    (f, h) => `Plan kurmadan önce öğrencinin kendi değerlendirmesini alın ve ${f.ders} dersi için “Sence en çok nerede zorlanıyorsun?” diye sorun${f.konu ? `; cevabın ${h.q(f.konu)} konusuyla örtüşüp örtüşmediğine bakın` : ""}.`,
    (f, h) => `Önce “Neler yerine oturmaya başladı?”, ardından “Hâlâ en çok ne zorluyor?” diye sorarak ${f.ders} konuşmasını iki adımda açın${f.konu ? `; ikinci soruda ${h.q(f.konu)} konusuna inin` : ""}.`,
    (f, h) => `Zorlanmanın bilgiden mi süre baskısından mı geldiğini ayırmak için “${f.ders} sorularını süre tutmadan çözdüğünde ne değişiyor?” diye sorun${f.konu ? ` ve örneği ${h.q(f.konu)} konusundan seçin` : ""}.`,
    (f, h) => `Takıldığı anlarda ne yaptığını öğrenin; “${f.ders} sorusunda tıkandığında kime ya da neye başvuruyorsun?” sorusunun cevabı, ${f.konu ? `${h.q(f.konu)} konusu için ` : ""}doğru desteği planlamayı kolaylaştırır.`,
  ],

  "konusma.soruZaman": [
    (f, h) => `Haftalık zaman dağılımını birlikte çıkarın: “Okul dışında hangi günler, kaçar saat sana kalıyor?” diye sorun.`,
    (f, h) => `Gerçekçi bir takvim için önce öğrencinin haftasını dinleyin ve “Ders çalışmaya en rahat ayırabildiğin saatler hangileri?” diye sorun.`,
    (f, h) => `Yükün dengesini görmek için okul ödevlerinin, varsa kursun ve kişisel çalışmanın haftaya nasıl yayıldığını öğrencinin kendisinden dinleyin.`,
    (f, h) => `Öğrenciye geçen haftayı gün gün anlattırın; çalışmanın hangi günlere yığıldığı ve hangi günlerin boş geçtiği kendiliğinden ortaya çıkar.`,
    (f, h) => `Zamanı yargısız bir dille konuşun: “Planlayıp da çalışamadığın günlerde araya ne girdi?” gibi bir soru, engeli somut hâle getirir.`,
    (f, h) => `Çalışma saatlerinin okul temposu ve dinlenmeyle nasıl dengelendiğini anlamak için “Kendini en verimli hissettiğin saat dilimi hangisi?” diye sorun.`,
    (f, h) => `Uzun oturumların tek bir güne mi toplandığını, yoksa kısa oturumların haftaya mı yayıldığını öğrenin; ikincisi genellikle daha sürdürülebilir bir ritim sağlar.`,
    (f, h) => `Soruyu somutlaştırın: “Bu hafta hangi günler, günde kaç soru sana gerçekçi geliyor?” diye sorup cevabı plana yazın.`,
  ],

  "konusma.soruKonuPasi": [
    (f, h) => `${f.ders} dersinde ${h.q(f.konu)} konusu “bilmiyorum” gerekçesiyle pas geçildi; “Bu konuyu en son nerede anlıyordun, nerede koptun?” diye sorun.`,
    (f, h) => `Öğrencinin ${h.q(f.konu)} konusunu nerede kaybettiğini bulmak için geriye doğru ilerleyin: derste anlatılanı izleyebildi mi, örnekleri anladı mı, yoksa soruya geçince mi takıldı?`,
    (f, h) => `Pas gerekçesi “konuyu bilmiyorum” olduğunda kopukluk çoğu zaman bir önceki başlıkta başlar; ${h.q(f.konu)} konusundan önceki başlıkları birlikte gözden geçirip “Hangisinde rahatsın?” diye sorun.`,
    (f, h) => `${f.ders} dersindeki ${h.q(f.konu)} konusu için “Bu konu okulda işlendi mi, işlendiyse hangi noktada oturmadı?” sorusu, kopuşun derste mi çalışmada mı olduğunu ayırır.`,
    (f, h) => `Öğrenciden ${h.q(f.konu)} konusunda hatırladığı son örneği anlatmasını isteyin; anlatımın koptuğu yer, konunun kaybedildiği yeri gösterir.`,
    (f, h) => `Bilmediğini açıkça söylemesi değerli bir bilgidir; bunu takdir edip “${h.q(f.konu)} konusunun hangi kısmını biraz biliyorsun, hangi kısmı sana tamamen yabancı?” diye sorun.`,
    (f, h) => `Kaynağı da konuşun: “Bu konu için elinde hangi kitap ya da video var?” sorusu, ${f.ders} dersinde ${h.q(f.konu)} konusunu yeni bir anlatımla ele almayı kolaylaştırır.`,
  ],

  "konusma.soruDusus": [
    (f, h) => `${f.ders} dersindeki düşüşü konuşurken önce nedeni öğrenin: “Bu derste son haftalarda yeni bir konuya mı geçtiniz, yoksa genel yük mü arttı?” diye sorun.`,
    (f, h) => `Düşüş her zaman kalıcı bir sorun anlamına gelmez; ${f.ders} dersinde yeni ve zor bir konuya geçilmiş olabilir, bunu öğrenciye sorarak netleştirin.`,
    (f, h) => `Sonuçlardaki değişim için “Son haftalarda ${f.ders} dersinde farklı olan ne oldu?” diye sorun ve cevabı dinlemeden yorum yapmayın.`,
    (f, h) => `Nedeni ayırmak için iki olasılığı açıkça sorun: ${f.ders} dersinde yeni bir konu mu zorladı, yoksa diğer derslerin yükü bu derse ayrılan zamanı mı azalttı?`,
    (f, h) => `Öğrenciye ${f.ders} ödevlerinin son dönemde nasıl geçtiğini sorun; süre yetmemesi ile konunun yeni olması farklı çözümler gerektirir.`,
    (f, h) => `Sayıları göstermeden önce öğrencinin kendi gözlemini alın: “${f.ders} dersinde bu ay kendini nasıl buldun?” sorusu, düşüşü onun gözünden görmenizi sağlar.`,
    (f, h) => `Önce “Son zamanlarda ${f.ders} dersinde seni en çok ne zorladı?” diye yargısız bir soru sorun, ardından yük ve yeni konu olasılıklarını birlikte eleyin.`,
  ],

  "konusma.soruGenel": [
    (f, h) => `Genel bir nabız yoklaması için “Bu ay en çok neye sevindin, seni en çok ne zorladı?” diye sorun.`,
    (f, h) => `Öğrencinin ayı kendi cümleleriyle özetlemesini isteyin; neyi anlattığı kadar neyi atladığı da size fikir verir.`,
    (f, h) => `Konuşmayı öğrencinin gündemine taşımak için “Bu ay iyi giden bir şeyi ve değiştirmek istediğin bir şeyi söyler misin?” diye sorun.`,
    (f, h) => `İleriye bakan açık bir soru ekleyin: “Önümüzdeki ay neyi farklı yapmak isterdin?” sorusu hem geçen ayı hem gelecek planı konuşturur.`,
    (f, h) => `Öğrenciye bu ayki çalışmalarından hangisinin ona en çok yaradığını sorun; cevabı bir sonraki planın dayanağı olarak kullanın.`,
    (f, h) => `Evet/hayır ile bitecek sorulardan kaçının; “Nasıl gidiyor?” yerine “Bu ay en çok hangi derste ilerlediğini hissettin?” gibi somut sorular sorun.`,
    (f, h) => `Zorlandığı noktaları konuşurken çözümü hemen vermeyin; önce “Sence bunun için neyi deneyebiliriz?” diye sorup öğrencinin önerisini dinleyin.`,
    (f, h) => `Ayın genel değerlendirmesini öğrenciye bırakın: 10 üzerinden kaç verirdi ve bunu bir basamak yükseltmek için ne gerekirdi?`,
  ],

  "konusma.hedef": [
    (f, h) => {
      const Q = hedefSoru(f, h);
      return `Görüşmeden ölçülebilir tek bir haftalık hedefle çıkın: ${gunHedef(f, h, "aktif gün")}${Q ? ` ve ${Q}` : ""}.`;
    },
    (f, h) =>
      `Hedefi öğrenciye kendi cümlesiyle söyletin; “Bu hafta ${h.n(f.gun, "gün")} çalışacağım${hedefSoruBen(f, h)}.” demesi, genel bir niyetten çok daha bağlayıcıdır.`,
    (f, h) => {
      const Q = hedefSoru(f, h);
      return `Küçük ama net bir hedef, büyük ve belirsiz bir niyetten daha çok işe yarar; bu hafta için ${gunHedef(f, h, "aktif gün")}${Q ? ` ve ${Q}` : ""} hedefini birlikte yazın.`;
    },
    (f, h) => {
      const Q = hedefSoru(f, h);
      return `Bu haftanın ölçüsü ${Q ? `${Q} ile ` : ""}${gunHedef(f, h, "aktif gün")} olsun; hedefi planın en üstüne, öğrencinin her gün göreceği bir yere yazın.`;
    },
    (f, h) => {
      const Q = hedefSoru(f, h);
      return `Hafta sonunda birlikte kontrol edebileceğiniz tek bir hedef koyun: haftada ${h.n(f.gun, "gün")} kayıt${Q ? ` ve ${Q}` : f.ders ? `, öncelik ${f.ders}` : ""}.`;
    },
    (f, h) => {
      const Q = hedefSoru(f, h);
      return `Hedef listesini uzatmak yerine tek bir çıtada anlaşın: haftada ${gunHedef(f, h, "aktif gün")}${Q ? ` ve bu günlerde ${Q}` : ""}.`;
    },
    (f, h) => {
      const Q = hedefSoru(f, h);
      return `Dikte etmek yerine birlikte kararlaştırın; başlangıç noktası olarak haftada ${gunHedef(f, h, "aktif gün")}${Q ? ` ve ${Q}` : ""} önerilebilir.`;
    },
    (f, h) => {
      const Q = hedefSoru(f, h);
      return `Ölçülemeyen bir hedef izlenemez; bu yüzden “daha çok çalışacağım” yerine ${Q ? `${Q} ve ` : ""}haftada ${gunHedef(f, h, "aktif gün")} gibi net bir sayıda anlaşın.`;
    },
  ],

  "konusma.kapanis": [
    (f, h) => `Görüşmeyi öğrencinin bu ayki emeğini bir kez daha anarak ve bir sonraki kısa kontrolün gününü birlikte belirleyerek kapatın.`,
    (f, h) => `Kapanışta sözü öğrenciye verin: “Bu görüşmeden aklında kalan tek şey ne?” diye sorun ve bir hafta sonrası için kısa bir kontrol planlayın.`,
    (f, h) => `Son cümle cesaret verici olsun; ilerlemenin düz bir çizgi olmadığını, küçük adımların birikerek fark yarattığını hatırlatın.`,
    (f, h) => `Bir sonraki kontrolün tarihini şimdi takvime yazın; belirsiz bir “sonra konuşuruz” yerine net bir gün, planın ciddiye alındığını gösterir.`,
    (f, h) => `Konuşmayı, öğrencinin hedefi gerçekleştirebileceğine inandığınızı açıkça söyleyerek bitirin ve hafta içinde kısa bir mesajla durumu soracağınızı belirtin.`,
    (f, h) => `Ayrılmadan önce kararlaştırılan hedefi öğrenciye bir kez daha özetletin; kendi ağzından duyduğu plan daha kolay sahiplenilir.`,
    (f, h) => `Son söz olarak “Bu planı birlikte izleyeceğiz, takıldığın an bana yazabilirsin.” gibi bir güven cümlesi kurun.`,
    (f, h) => `Zorlukları konuştuktan sonra son sözü iyi giden bir noktaya bırakın; öğrenci bir sonraki adımı bilerek ayrılsın.`,
  ],

  // ============================================================== DİKKAT (nötr notlar)
  "dikkat.giris": [
    (f, h) => `Öğrenci ${h.n(f.gun, "gündür")} uygulamaya giriş yapmadı; kısa bir mesajla durumu sormak çoğu zaman yeterlidir.`,
    (f, h) => `Son giriş ${h.n(f.gun, "gün")} önce görünüyor; ödev bildirimlerinin öğrenciye ulaşıp ulaşmadığını kontrol etmekte fayda var.`,
    (f, h) => `Yeni ödevlerin gözden kaçmaması için bu hafta içinde kısa bir temas kurun; öğrenci ${h.n(f.gun, "gündür")} uygulamaya girmedi.`,
    (f, h) => `Uygulamaya ${h.n(f.gun, "gündür")} girilmemiş olması çalışmanın durduğu anlamına gelmeyebilir; bunu varsaymak yerine öğrenciye sorun.`,
    (f, h) => `Girişler arasında ${h.n(f.gun, "günlük")} bir boşluk oluştu; bu tek başına alarm sayılmaz, ancak ödev takibini aksatabilir.`,
    (f, h) => `Öğrencinin uygulamayı en son ${h.n(f.gun, "gün")} önce açtığı görülüyor; teknik bir engel ya da yoğun bir dönem olup olmadığını öğrenin.`,
    (f, h) => `Nazik bir hatırlatma yerinde olur: son girişin üzerinden ${h.n(f.gun, "gün")} geçti ve bu sürede eklenen ödevler henüz görülmemiş olabilir.`,
  ],

  "dikkat.kayit": [
    (f, h) => `Arka arkaya ${h.n(f.gun, "gün")} kayıt girilmedi; çalışmanın mı durduğunu, yoksa yalnızca kayıt girişinin mi aksadığını ayırmak önemli.`,
    (f, h) => `Ritmin yeniden kurulması için erken ve kısa bir temas yerinde olur; son ${h.n(f.gun, "günde")} hiç kayıt girilmedi.`,
    (f, h) => `Kayıt akışı ${h.n(f.gun, "gün")} önce durmuş görünüyor; öğrenciye suçlamasız bir mesajla nasıl gittiğini sorun.`,
    (f, h) => `En son kayıt ${h.n(f.gun, "gün")} önce girilmiş; ara uzadıkça dönüş zorlaşabileceğinden bu hafta içinde ulaşın.`,
    (f, h) => `Uygulamada ${h.n(f.gun, "gündür")} yeni bir kayıt yok; öğrenci defterde çalışıp girişi erteliyor olabilir, sormadan yorum yapmayın.`,
    (f, h) => `Yeniden başlamak için büyük bir plan gerekmez: ${h.n(f.gun, "günlük")} aradan sonra yarın için tek bir küçük set belirlemek yeterli olabilir.`,
    (f, h) => `Veride ${h.n(f.gun, "günlük")} bir sessizlik var; bu ayın oranları bu boşluk nedeniyle eksik bir tablo çizebilir.`,
  ],

  "dikkat.sessizSeri": [
    (f, h) => `Son 14 günde ${h.n(f.sayi, "ödev")} ne teslim edildi ne de pas geçildi; bunları tek tek değil, bir örüntü olarak ele almak daha doğru olur.`,
    (f, h) => `Yükün ya da zamanlamanın gözden geçirilmesi gerekebilir: son iki haftada ${h.n(f.sayi, "ödev")} sessiz kaldı.`,
    (f, h) => `Sessiz ödev sayısı son 14 günde ${h.int(f.sayi)} oldu; teslim tarihlerinin öğrencinin haftalık temposuna uyup uymadığına bakın.`,
    (f, h) => `Hâlâ açık olan ${h.n(f.sayi, "ödev")} son iki haftaya ait: ne sonuç girildi ne de pas gerekçesi yazıldı.`,
    (f, h) => `Yeni ödev vermeden önce mevcut yükü birlikte düzenlemek iyi olur, çünkü son 14 günde ${h.n(f.sayi, "sessiz ödev")} birikti.`,
    (f, h) => `Tek bir sessiz ödev rastlantı olabilir; kısa sürede ${h.n(f.sayi, "tanesinin")} birikmesi ise süren bir engele işaret edebilir.`,
    (f, h) => `İki hafta içinde süresi dolan ${h.n(f.sayi, "ödev")} yanıtsız kaldı; pas geçip nedenini yazmanın da geçerli bir yol olduğunu öğrenciye hatırlatın.`,
  ],

  "dikkat.sertDusus": [
    (f, h) => `${f.ders} dersinde net oranı son haftalarda ${h.abs(f.delta)} puan geriledi; yeni bir konuya geçilip geçilmediğini kontrol etmek ilk adım olabilir.`,
    (f, h) => `Önümüzdeki iki hafta, ${f.ders} dersindeki ${h.abs(f.delta)} puanlık inişin tek seferlik bir dalgalanma mı yoksa süren bir eğilim mi olduğunu gösterecek.`,
    (f, h) => `Net oranında ${h.abs(f.delta)} puanlık kayıp görülen ${f.ders} dersinde, son ödevlerin yanlışlarına birlikte bakmak nedeni hızla ortaya çıkarabilir.`,
    (f, h) => `Tek dersteki sert değişimler sıklıkla yeni ve zorlayıcı bir konudan kaynaklanır; ${f.ders} dersindeki ${h.abs(f.delta)} puanlık düşüşü bu gözle değerlendirin.`,
    (f, h) => `Kaynak, konu ve süre koşullarından hangisinin değiştiğini netleştirmek yerinde olur, çünkü ${f.ders} dersinde net oranı ${h.abs(f.delta)} puan azaldı.`,
    (f, h) => `İzlenmesi gereken bir hareket: ${f.ders} dersinde net oranı kısa sürede ${h.abs(f.delta)} puan düştü, ancak bu tek başına kalıcı bir eğilim anlamına gelmez.`,
    (f, h) => `Bu derse ayrılan zamanın başka derslere kayıp kaymadığını sormak gerekebilir; ${f.ders} dersinin net oranında ${h.abs(f.delta)} puanlık bir gerileme görülüyor.`,
  ],

  "dikkat.aktivite": [
    (f, h) => `Ay boyunca ${h.n(f.gunSayisi, "günün")} yalnızca ${h.int(f.aktifGun)} tanesinde kayıt var; düzenli bir ritim için haftada en az 3 aktif gün hedeflenebilir.`,
    (f, h) => `Aktif gün sayısı ${h.int(f.aktifGun)}/${h.int(f.gunSayisi)} düzeyinde kaldı; çalışma uygulama dışında sürüyor olabilir, bunu öğrenciye sormakta fayda var.`,
    (f, h) => `Aralıklı tekrarın işe yaraması için daha kısa ama daha sık oturumlar önerilir; kayıtlı çalışma şu an ${h.n(f.aktifGun, "güne")} sığıyor.`,
    (f, h) => `Bu ay ${h.n(f.gunSayisi, "gün")} üzerinden ${h.n(f.aktifGun, "aktif gün")} görünüyor; bu seyrek ritim, konuların pekişmesini zorlaştırabilir.`,
    (f, h) => `Ayın aktif gün oranı ${h.pct(f.gunSayisi ? (f.aktifGun / f.gunSayisi) * 100 : 0)} düzeyinde; hedefi bir anda artırmak yerine haftaya bir gün eklemek daha sürdürülebilir olur.`,
    (f, h) => `Çalışma günleri seyrek kaldı (${h.n(f.gunSayisi, "gün")} içinde ${h.n(f.aktifGun, "aktif gün")}); sabit günlere bağlı küçük bir haftalık plan bu tabloyu değiştirmeye yardımcı olabilir.`,
    (f, h) => `Ayın ${h.n(Math.max(0, f.gunSayisi - f.aktifGun), "gününde")} kayıt yok; çalışma ${h.n(f.aktifGun, "güne")} toplanmış görünüyor, bu yüzden ilk hedef haftalık ritmi kurmak olabilir.`,
  ],

  "dikkat.veri": [
    (f, h) =>
      varK(f) || varS(f)
        ? `Bu ayın oranlarını yaklaşık okuyun: ${h.list([
            varK(f) && `ödev kayıtlarının ${h.pct(f.kismiOran)} kadarında girilen soru sayısı beklenenden belirgin biçimde farklı`,
            varS(f) && `serbest çalışmadaki net oranı ödevlerdekinden ${h.abs(f.serbestFark)} puan ${yon(f)}`,
          ])}.`
        : `Bu ayın oranlarını yaklaşık okuyun; girişlerin bir kısmı eksik ya da tahmini görünüyor.`,
    (f, h) => {
      const parca = [
        varK(f) && `kısmi ya da fazla girişlerin payı ${h.pct(f.kismiOran)}`,
        varS(f) && `serbest çalışma ile ödev net oranı arasındaki fark ${h.abs(f.serbestFark)} puan`,
      ].filter(Boolean).join(", ");
      return `Veri notu: ${parca || "girişlerin bir kısmı eksik"}; eğilimleri kesin değil, yön gösterici olarak okuyun.`;
    },
    (f, h) => {
      const bas = varK(f)
        ? `Ödev kayıtlarının ${h.pct(f.kismiOran)} kadarında soru sayısı eksik ya da fazla girildiği için`
        : varS(f)
          ? `Serbest çalışmadaki net oranı ödevlerdekinden ${h.abs(f.serbestFark)} puan ${yon(f)} olduğu için`
          : `Girişlerin bir kısmı eksik olduğu için`;
      return `${bas} bu raporun oranları yaklaşık değerlerdir${varK(f) && varS(f) ? `; serbest çalışma ile ödev arasındaki ${h.abs(f.serbestFark)} puanlık fark da bunu destekliyor` : ""}.`;
    },
    (f, h) => {
      const ana = varS(f)
        ? `serbest çalışmada net oranı ödevlere göre ${h.abs(f.serbestFark)} puan ${yon(f)} görünüyor`
        : varK(f)
          ? `ödev kayıtlarının ${h.pct(f.kismiOran)} kadarında girilen soru sayısı ödevdekiyle örtüşmüyor`
          : `girişlerin bir kısmı eksik`;
      return `Oranlar bir miktar temkinle okunmalı, çünkü ${ana}${varK(f) && varS(f) ? `; ayrıca ödev kayıtlarının ${h.pct(f.kismiOran)} kadarında girilen soru sayısı ödevdekiyle örtüşmüyor` : ""}.`;
    },
    (f, h) => {
      const parca = [
        varK(f) && `kısmi ya da fazla giriş oranı ${h.pct(f.kismiOran)}`,
        varS(f) && `serbest çalışma ile ödev arasındaki net oranı farkı ${h.signed(f.serbestFark)} puan`,
      ].filter(Boolean).join(", ");
      return `Oranlardaki küçük farkları yorumlamadan önce veri kalitesini hesaba katın${parca ? `; ${parca}` : ""}.`;
    },
    (f, h) => {
      const parca = h.list([
        varK(f) && `girilen soru sayısı ödev kayıtlarının ${h.pct(f.kismiOran)} kadarında beklenenle uyuşmuyor`,
        varS(f) && `serbest çalışma ile ödevler arasında ${h.abs(f.serbestFark)} puanlık bir net oranı farkı var`,
      ]);
      return parca
        ? `${h.cap(parca)}; aylık karşılaştırmaları bu nedenle temkinli yorumlayın.`
        : `Girişlerin bir kısmı eksik olduğundan aylık karşılaştırmaları temkinli yorumlayın.`;
    },
    (f, h) => {
      const iki = varK(f) && varS(f);
      const iste = h.list([
        (varK(f) || !varS(f)) && "ödev kayıtlarında soru sayısının doğru girilmesini",
        varS(f) && (iki ? "serbest çalışmada kaynağın not edilmesini" : "serbest çalışmada kaynağın ve zorluk düzeyinin not edilmesini"),
      ]);
      const kanit = [
        varK(f) && `kısmi ya da fazla giriş oranı ${h.pct(f.kismiOran)}`,
        varS(f) && `serbest çalışma ile ödev farkı ${h.signed(f.serbestFark)} puan`,
      ].filter(Boolean).join(", ");
      return `Verinin güvenilirliğini artırmak için ${iste} isteyin${kanit ? `; şu an ${kanit}` : ""}.`;
    },
  ],

  "dikkat.takipDisi": [
    (f, h) => `${h.list(f.dersler)} için okul ödevi geliyor ama hiç kayıt yok; ${tekDers(f) ? "bu ders" : "bu dersler"} öğrencinin alanında değilse bir işlem gerekmez, alandaysa takibe alınmalı.`,
    (f, h) => `Okuldan ödev gelen ${h.list(f.dersler)} ${tekDers(f) ? "dersinde" : "derslerinde"} uygulamada hiç kayıt bulunmuyor; ${tekDers(f) ? "dersin" : "derslerin"} öğrencinin tercih planındaki yerini netleştirin.`,
    (f, h) => `Bu raporun analizleri ${h.list(f.dersler)} ${tekDers(f) ? "dersini" : "derslerini"} kapsamıyor, çünkü okul ödevi gelmesine rağmen ${tekDers(f) ? "bu derste" : "bu derslerde"} hiç kayıt girilmedi.`,
    (f, h) => `${YAZIYLA[f.dersler.length] || "Birkaç"} AYT dersinde okul ödevi var ama kayıt yok (${h.list(f.dersler)}); öğrencinin hedeflediği alanla ilgisi varsa bu boşluğu konuşun.`,
    (f, h) => `Uygulamada takip dışında kalan ${tekDers(f) ? "ders" : "dersler"} ${h.list(f.dersler)}; okul ödevleri gelmeye devam ettiği için ${tekDers(f) ? "dersin" : "derslerin"} alanla ilgisini bir kez teyit etmek yeterli.`,
    (f, h) => `${tekDers(f) ? "Alan dışı bir dersse" : "Alan dışı derslerse"} bu bilinçli bir tercih olabilir: ${h.list(f.dersler)} ${tekDers(f) ? "dersine" : "derslerine"} okuldan ödev geldiği hâlde hiç kayıt girilmedi.`,
    (f, h) => `Kayıt görünmeyen ${tekDers(f) ? "ders" : "dersler"} (${h.list(f.dersler)}) için okul ödevleri gelmeye devam ediyor; ${tekDers(f) ? "bu dersin" : "bu derslerin"} sınav hedefindeki yerini öğrenciyle konuşun.`,
  ],

  "dikkat.hacimDusus": [
    (f, h) => `Çözülen soru sayısı ${f.onceki.ay.ayinda} ${h.int(f.onceki.Q)} iken ${f.simdi.ay.ayinda} ${h.int(f.simdi.Q)} oldu; bu, ${h.pct(Math.abs(f.degisimPct))} oranında bir azalmaya karşılık geliyor.`,
    (f, h) => `${f.simdi.ay.de} çözülen ${h.n(f.simdi.Q, "soru")}, ${f.onceki.ay.ad} ayındaki ${h.int(f.onceki.Q)} sorunun belirgin biçimde altında; okul sınavları ya da kayıt aksaması gibi olası nedenleri öğrenciyle konuşun.`,
    (f, h) => `${f.onceki.ay.ad} ayına göre soru hacmi ${h.pct(Math.abs(f.degisimPct))} azaldı (${h.int(f.onceki.Q)} → ${h.int(f.simdi.Q)}); nedenini bilmek bir sonraki ayın planını kolaylaştırır.`,
    (f, h) => `Hacim ${h.int(f.onceki.Q)} sorudan ${h.int(f.simdi.Q)} soruya indi; yükün mü yoksa yalnızca kaydın mı azaldığını ayırmak gerekiyor.`,
    (f, h) => `Bir önceki aya kıyasla soru sayısında ${h.pct(Math.abs(f.degisimPct))} düzeyinde bir düşüş var: ${f.onceki.ay.ad} ${h.int(f.onceki.Q)}, ${f.simdi.ay.ad} ${h.int(f.simdi.Q)}.`,
    (f, h) => `${f.simdi.ay.ayinda} ${h.n(f.simdi.Q, "soru")} çözüldü; ${f.onceki.ay.ayi} ile kıyaslandığında ${h.pct(Math.abs(f.degisimPct))} daha az olan bu hacim, dönemsel bir yoğunluğun izi olabilir.`,
    (f, h) => `Soru hacmindeki ${h.pct(Math.abs(f.degisimPct))} azalma geçici bir durum olabilir; aynı eğilim gelecek ay da sürerse haftalık hedefleri yeniden konuşun.`,
  ],
};
