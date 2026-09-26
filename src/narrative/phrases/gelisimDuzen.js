// Gelişim alanları — düzen ve alışkanlık kalıpları: konu/kaynak pası, sessiz ödev, ödev düzeni, zaman, kapsam, serbest çalışma.

// ---------------------------------------------------------------- küçük yardımcılar (yalnızca bu dosyada)
const cok = (arr) => (arr || []).length > 1;
const ek = (arr, tekil, cogul) => (cok(arr) ? cogul : tekil);
const ilk = (arr) => (arr || [])[0];
// "bir ödev" / "3 ödev" — 1 için rakam yerine "bir" (cümle başında h.cap ile kullanılır).
const adet = (v, h, word) => (v === 1 ? `bir ${word}` : h.n(v, word));
// Sessiz ödev örneği: "TYT Matematik – Problemler (25 soru)"; konu ya da soru yoksa o kısım yazılmaz.
const ornek = (e, h) => (e ? `${e.ders}${e.konu ? ` – ${e.konu}` : ""}${e.soru != null ? ` (${h.n(e.soru, "soru")})` : ""}` : "");
const ornekler = (f, h) => h.list((f.ornekler || []).map((e) => ornek(e, h)));
const dahaFazla = (f) => f.sayi > (f.ornekler || []).length;
// Kaynak adı bilinmiyorsa model "ödevin kaynağı" yazar; o zaman "gereken kaynak kitap" denir.
// hal: "ı" (yalın), "ını" (belirtme), "ının" (ilgi), "ına" (yönelme) → "'Kimya Soru Bankası' kitabını" / "gereken kaynak kitabı".
const kitapBilinir = (f) => !!f.kitap && f.kitap !== "ödevin kaynağı";
const GENEL_KITAP = { ı: "kitap", ını: "kitabı", ının: "kitabın", ına: "kitaba" };
const kitap = (f, h, hal = "ı") => (kitapBilinir(f) ? `${h.q(f.kitap)} kitab${hal}` : `gereken kaynak ${GENEL_KITAP[hal]}`);
const ogretmenle = (f) => (f.ogretmen ? `${f.ogretmen} ile` : "branş öğretmeniyle");
// Ödev düzeni kırılımı: "okul ödevlerinde %55, kişisel ödevlerde %33" (null olan atlanır).
const kirilim = (f, h) => {
  const p = [];
  if (f.okulTeslim != null) p.push(`okul ödevlerinde ${h.pct(f.okulTeslim)}`);
  if (f.kisiselTeslim != null) p.push(`kişisel ödevlerde ${h.pct(f.kisiselTeslim)}`);
  return p.join(", ");
};
const buyuk = (f) => (f.kucuk === "TYT" ? "AYT" : "TYT");
const kucukYok = (f) => !(f.kucukSoru > 0);
const hepsi = (oran, h) => (oran >= 100 ? "tamamı" : oran >= 99.5 ? "neredeyse tamamı" : `${h.pct(oran)} kadarı`);
// Odak dersin payı %0,5'in altındaysa yüzde yazılmaz: tam sıfırsa "hiç", değilse "neredeyse hiç".
const odakSifir = (f) => !(f.odakPay >= 0.5);
const hic = (f) => (f.odakPay > 0 ? "neredeyse hiç" : "hiç");

export default {
  // ---------------------------------------------------------------- KONU PASI ("konuyu bilmiyorum")
  "gelisim.konuPasi": {
    alan: [
      (f) => `${f.ders}: konu anlatımı ihtiyacı`,
      (f) => `Önce anlatım, sonra soru: ${f.ders}`,
      (f, h) => `${h.q(ilk(f.konular))} için konu desteği`,
      (f) => `${f.ders} dersinde "konuyu bilmiyorum" ${f.sayi > 1 ? "pasları" : "pası"}`,
      (f) => `Anlatım bekleyen ${ek(f.konular, "konu", "konular")} (${f.ders})`,
    ],
    kanit: [
      (f, h) =>
        `Son 28 günde ${f.ders} dersinde ${adet(f.sayi, h, "ödev")} "konuyu bilmiyorum" gerekçesiyle pas geçildi; ${ek(f.konular, "ilgili konu", "ilgili konular")} ${h.qlist(f.konular)}.`,
      (f, h) =>
        `Öğrenci ${h.qlist(f.konular)} ${ek(f.konular, "konusundaki", "konularındaki")} eksiğini açıkça belirterek pas seçeneğini kullandı; son dört haftada ${f.ders} dersindeki konu pası sayısı ${h.int(f.sayi)}.`,
      (f, h) =>
        f.okulOrani == null
          ? f.sayi > 1
            ? `${f.ders} dersinde son dört haftada ${h.int(f.sayi)} konu pası var ve gerekçe her seferinde aynı: konu henüz oturmamış.`
            : `${f.ders} dersinde son dört haftada bir konu pası var; gerekçe, konunun henüz oturmamış olması.`
          : f.okulOrani >= 30
            ? `İlgili ödevde okul genelindeki konu pası oranı ${h.pct(f.okulOrani)}; ${f.ders} dersindeki bu eksik yalnızca öğrenciye özgü değil, okulda da yaygın görünüyor.`
            : `İlgili ödevi okul genelinde "konuyu bilmiyorum" diyerek pas geçenlerin oranı ${h.pct(f.okulOrani)}; ${f.ders} dersindeki eksik daha çok bireysel görünüyor.`,
      (f, h) =>
        `Eksik saklanmamış, açıkça bildirilmiş: ${f.ders} dersinde ${h.qlist(f.konular)} ${ek(f.konular, "konusu", "konuları")} için ${adet(f.sayi, h, "konu pası")} kaydı var.`,
      (f, h) =>
        `Soru çözümünden önce anlatım gerekiyor: öğrenci ${h.qlist(f.konular)} ${ek(f.konular, "konusunu", "konularını")} henüz bilmediğini belirterek ${f.ders} dersinde ${adet(f.sayi, h, "ödevi")} pas geçti.`,
      (f, h) =>
        `Pas gerekçesi olan ${ek(f.konular, "konu", "konular")} ${h.qlist(f.konular)}${f.ogretmen ? ` (ödevi veren: ${f.ogretmen})` : ""}; ${f.ders} dersinde dört haftadaki konu pası sayısı ${h.int(f.sayi)}.`,
    ],
    oneri: [
      (f, h) =>
        `${f.ogretmen ? `Ödevi veren ${f.ogretmen} ile` : "Branş öğretmeniyle"} görüşüp ${h.qlist(f.konular)} için kısa bir konu anlatımı ya da etüt ayarlayın; soru ödevini anlatımdan sonraya bırakın.`,
      (f, h) =>
        `Dürüst bildirimi takdir edin ve ${h.q(ilk(f.konular))} konusunu önce anlatımla (video ya da ders notu) verin; ardından 10–15 soruluk kolay bir setle konunun oturup oturmadığına bakın.`,
      (f) =>
        `Anlatım tamamlanmadan ${ek(f.konular, "bu konuya", "bu konulara")} yeni soru ödevi vermeyin; sıra şöyle olsun: konu anlatımı, iki gün sonra kolaydan zora 15–20 soruluk set, bir hafta sonra kısa tekrar.`,
      (f, h) =>
        f.okulOrani == null
          ? `Branş öğretmeninden ${h.qlist(f.konular)} için bir etüt saati isteyin; öğrenci takıldığı noktaları önceden yazarak gelsin.`
          : f.okulOrani >= 30
            ? `Okul genelindeki ${h.pct(f.okulOrani)} konu pası oranını ${ogretmenle(f)} paylaşın; konu sınıf düzeyinde yeniden ele alınırsa öğrenci de bundan yararlanır.`
            : `Okul genelinde oran ${h.pct(f.okulOrani)} düzeyinde kaldığı için sınıf anlatımını beklemeyin; ${h.q(ilk(f.konular))} için birebir kısa bir anlatım ya da video önerin.`,
      (f, h) =>
        `Haftalık plana bir "anlatım günü" ekleyin: ${h.q(ilk(f.konular))} konusu o gün yalnızca öğrenilsin, soru çözümü ertesi güne kalsın.`,
      () =>
        `Öğrenciden konunun hangi noktada koptuğunu tek cümleyle yazmasını isteyin (tanım, formül ya da soru tipi); anlatımı tam o noktadan başlatmak zaman kazandırır.`,
      () =>
        `Anlatımın ardından pas geçilen ödevin kısa bir sürümünü (10–15 soru) yeniden verin; ilk hedef tamamını bitirmek değil, doğru yöntemle ilerlemek olsun.`,
    ],
  },

  // ---------------------------------------------------------------- KAYNAK PASI (kitap eksik)
  "gelisim.kaynak": {
    alan: [
      (f) => `${f.ders}: kaynak kitap eksiği`,
      (f) => `Kaynağa erişim (${f.ders})`,
      (f, h) => `${h.cap(kitap(f, h, "ının"))} temini`,
      (f) => `Kaynak eksiği nedeniyle bekleyen ${f.sayi > 1 ? "ödevler" : "ödev"}`,
      () => `Kitap sorununu okulla çözmek`,
    ],
    kanit: [
      (f, h) => `Öğrencide ${kitap(f, h)} bulunmadığı için ${f.ders} dersinde ${adet(f.sayi, h, "ödev")} pas geçildi.`,
      (f, h) =>
        `${f.ders} dersindeki ${f.sayi > 1 ? `${h.int(f.sayi)} pasın ortak nedeni` : "pasın nedeni"} kaynak: öğrencinin elinde ${kitap(f, h)} yok.`,
      (f, h) =>
        `Pas gerekçesi olarak "Kaynağım yok" seçildi; ${kitap(f, h)} olmadan ${f.ders} ödevlerinden ${f.sayi > 1 ? `${h.int(f.sayi)} tanesi` : "biri"} yapılamadı.`,
      (f, h) =>
        `Sorun çalışmada değil, erişimde: ${f.ders} ${f.sayi > 1 ? `dersindeki ${h.int(f.sayi)} ödev` : "ödevi"} ${kitap(f, h, "ına")} dayandığı için öğrenci pas geçmek zorunda kaldı.`,
      (f, h) =>
        `Kaynak eksiği yüzünden ${f.ders} dersinde ${adet(f.sayi, h, "ödev")} yapılamadan kaldı${f.ogretmen ? ` (branş öğretmeni: ${f.ogretmen})` : ""}.`,
      (f, h) =>
        `${f.sayi > 1 ? `Buradaki ${h.int(f.sayi)} pas` : "Buradaki pas"} bir erişim engelinden kaynaklanıyor; kitap gelmezse aynı kaynaktan verilecek ${f.ders} ödevleri de yapılamayacak.`,
    ],
    oneri: [
      (f, h) =>
        `Kitap eksiğini bu hafta okul yönetimine iletin; ${kitap(f, h)} gelene kadar ${ogretmenle(f)} konuşup eşdeğer soruları başka bir kaynaktan verin.`,
      (f) =>
        `Kaynağı olmadığını açıkça bildirmesini takdir edin; ardından ${f.ders} için eksik kitabı okul yönetiminden isteyin.`,
      (f, h) =>
        `Eksik kitap temin edilene kadar bu kaynağa bağlı yeni ödev vermeyin; ${f.ders} çalışmasını çıkmış sorularla ya da okul kütüphanesindeki bir soru bankasıyla sürdürün.`,
      (f, h) =>
        `Yönetimden kitap için bir teslim tarihi alın ve öğrenciyle paylaşın; kitap geldiğinde pas geçilen ${f.sayi > 1 ? `${h.int(f.sayi)} ödevi haftaya yayarak` : "ödevi"} yeniden açın.`,
      () =>
        `Bir sonraki görüşmede kitabın ulaşıp ulaşmadığını kontrol edin; ulaşmadıysa konuyu yeniden yönetime taşıyın, ulaştıysa ilk hafta 20–25 soruluk kısa setlerle başlayın.`,
      (f, h) =>
        kitapBilinir(f)
          ? `Okul yönetimine ders ve kitap bilgisini tek mesajla iletin (${f.ders}, ${h.q(f.kitap)}); bu süreçte ödevleri ortak ya da dijital kaynaklardan planlayın.`
          : `Eksik kitabın adını öğrenciden ya da ödevi verenden netleştirip yönetime tek mesajla iletin; bu süreçte ${f.ders} ödevlerini ortak kaynaklardan planlayın.`,
      (f) =>
        `Aynı eksik sınıftaki başka öğrencilerde de olabilir; ${ogretmenle(f)} bunu kontrol edip talebi yönetime toplu olarak iletin.`,
    ],
  },

  // ---------------------------------------------------------------- SESSİZ ÖDEV (ne teslim ne pas)
  "gelisim.sessiz": {
    alan: [
      (f) => `Sessiz kalan ${f.sayi > 1 ? "ödevler" : "ödev"}`,
      (f, h) => `${h.cap(adet(f.sayi, h, "ödev"))} yanıt bekliyor`,
      () => `Süresi geçen ödevlere dönüş`,
      () => `Ne teslim ne pas: sessiz ödevler`,
      () => `Her ödeve bir yanıt alışkanlığı`,
    ],
    kanit: [
      (f, h) =>
        `Süresi geçmiş ${adet(f.sayi, h, "ödev")} için ne teslim ne de pas kaydı var; ${f.sayi > 1 ? "en eskisinin süresi" : "süresi"} ${h.n(f.enEski, "gün")} önce doldu.`,
      (f, h) =>
        `${dahaFazla(f) ? "Sessiz kalan ödevlerden bazıları" : f.sayi > 1 ? "Sessiz kalan ödevler" : "Sessiz kalan ödev"}: ${ornekler(f, h)}.`,
      (f, h) =>
        f.sayi > 1
          ? `Vadesi dolan ${h.n(f.sayi, "ödev")} hâlâ yanıt bekliyor; en eskisi ${h.n(f.enEski, "gündür")} açıkta.`
          : `Vadesi ${h.n(f.enEski, "gün")} önce dolan bir ödev hâlâ yanıt bekliyor.`,
      (f, h) =>
        f.hatirlatma
          ? `Hatırlatma gönderilmiş olmasına karşın ${adet(f.sayi, h, "ödev")} hâlâ sessiz.`
          : `Henüz hatırlatma gönderilmemiş; ${adet(f.sayi, h, "ödev")} teslim ya da pas kaydı olmadan bekliyor.`,
      (f, h) =>
        `Kayıtlarda ${adet(f.sayi, h, "ödev")} ne teslim edilmiş ne de pas geçilmiş görünüyor${dahaFazla(f) ? `; aralarında ${ornekler(f, h)} var` : `: ${ornekler(f, h)}`}.`,
      (f, h) =>
        `Teslim ya da pas kaydı olmayan ödevler planı güncellemeyi zorlaştırıyor; şu an ${adet(f.sayi, h, "ödev")} bu durumda${f.sayi > 1 ? `, en eskisinin vadesi ${h.n(f.enEski, "gün")} önce doldu` : ""}.`,
    ],
    oneri: [
      (f) =>
        `${f.hatirlatma ? "Hatırlatma tek başına yetmediği için" : "Önce uygulamadan kısa bir hatırlatma gönderin; ardından"} öğrenciyle 5 dakikalık bir görüşmede ${f.sayi > 1 ? "her sessiz ödev" : "sessiz ödev"} için teslim, pas ya da yeni tarih kararını birlikte verin.`,
      () =>
        `Pas seçeneğinin de geçerli bir yanıt olduğunu hatırlatın: "zaman yetmedi" ya da "konuyu bilmiyorum" demek, ödevi sessiz bırakmaktan çok daha yararlı bir bilgi verir.`,
      (f) =>
        f.sayi > 1
          ? `En eskisinden başlayarak sessiz ödevleri tek tek kapatın: hâlâ anlamlı olanlara yeni bir teslim günü verin, güncelliğini yitirenleri pas olarak işaretletin.`
          : `Sessiz ödevi bu hafta kapatın: hâlâ anlamlıysa yeni bir teslim günü verin, güncelliğini yitirdiyse pas olarak işaretlenmesini isteyin.`,
      (f, h) =>
        f.sayi > 1
          ? `İlk adım olarak ${ornek(ilk(f.ornekler), h)} ödevini seçin ve yeni ödev eklemeden önce kapanmasını bekleyin; tek ödevlik küçük bir adım birikmeyi durdurur.`
          : `Yeni ödev eklemeden önce ${ornek(ilk(f.ornekler), h)} ödevinin teslim ya da pas olarak kapanmasını bekleyin.`,
      () =>
        `Bir hafta boyunca her akşam uygulamayı açıp vadesi gelen ödevleri teslim ya da pas olarak işaretlemesini isteyin; bu iki dakikalık rutin birikmeyi hızla durdurur.`,
      (f, h) =>
        f.sayi > 1
          ? `Birikmiş ${h.n(f.sayi, "ödev")} için tek seferde teslim istemeyin; günde en fazla bir eski ödev kapanacak şekilde haftaya yayın.`
          : `Tek bir sessiz ödev için kısa bir mesaj yeterli olabilir; nedenini sorun ve gerekirse teslim tarihini birlikte yeniden belirleyin.`,
      () =>
        `Sessizliğin nedenini yargılamadan sorun; yük, konu eksiği ya da kitap gibi somut bir engel çıkarsa planı doğrudan ona göre düzeltin.`,
    ],
  },

  // ---------------------------------------------------------------- ÖDEV DÜZENİ (ele alınan < %70)
  "gelisim.duzen": {
    alan: [
      () => `Ödev takibinde düzen`,
      () => `Ödevleri ele alma oranı`,
      () => `Teslim ya da pas: her ödeve yanıt`,
      () => `Vadesi gelen ödevlerde süreklilik`,
      () => `Ödev döngüsünü tamamlamak`,
    ],
    kanit: [
      (f, h) =>
        `Vadesi gelen ${h.n(f.V, "ödevin")} ${h.pct(f.eleAlinan)} kadarı teslim ya da pas olarak ele alındı; ${adet(f.sessiz, h, "ödev")} ise sessiz kaldı.`,
      (f, h) => {
        const k = kirilim(f, h);
        const pas = f.eleAlinan > f.teslim
          ? `, paslar dâhil ele alınan oran ${h.pct(f.eleAlinan)}`
          : "; pas kaydı olmadığı için ele alınan oran da aynı düzeyde";
        return `Teslim oranı ${h.pct(f.teslim)}${pas}${k ? ` (teslim: ${k})` : ""}.`;
      },
      (f, h) =>
        `Ele alınan oran ${h.pct(f.eleAlinan)} ile %70 eşiğinin altında kaldı; bunun başlıca nedeni sessiz kalan ${h.n(f.sessiz, "ödev")}.`,
      (f, h) =>
        `Bu dönemde ${h.n(f.V, "ödev")} vadesini doldurdu: teslim ${h.pct(f.teslim)}, ele alınan ${h.pct(f.eleAlinan)}, sessiz ${h.int(f.sessiz)}.`,
      (f, h) =>
        `Ödevlerin bir kısmı hiç yanıtlanmadan vadesini doldurdu: ${h.int(f.V)} ödevden ${h.int(f.sessiz)} tanesi sessiz, teslim oranı ise ${h.pct(f.teslim)}.`,
      (f, h) => {
        if (f.okulTeslim != null && f.kisiselTeslim != null) {
          const fark = Math.abs(f.okulTeslim - f.kisiselTeslim) >= 10;
          return fark
            ? `Teslimde ödev türleri arasında belirgin bir fark var: okul ödevlerinde ${h.pct(f.okulTeslim)}, kişisel ödevlerde ${h.pct(f.kisiselTeslim)}; ele alınan toplam oran ${h.pct(f.eleAlinan)}.`
            : `Okul ve kişisel ödevlerde tablo benzer (teslim ${h.pct(f.okulTeslim)} ve ${h.pct(f.kisiselTeslim)}); sorun tek bir ödev türünde değil, genel düzende.`;
        }
        return `Vadesi gelen ${h.int(f.V)} ödevden ${adet(f.sessiz, h, "tanesi")} için ne teslim ne pas kaydı var; bu da ele alınan oranı ${h.pct(f.eleAlinan)} düzeyinde bırakıyor.`;
      },
    ],
    oneri: [
      (f, h) =>
        `Önümüzdeki iki hafta için tek hedef koyun: vadesi gelen her ödevde teslim ya da pas kaydı olsun, şu an ${h.int(f.sessiz)} olan sessiz ödev sayısı sıfıra insin.`,
      (f, h) =>
        f.kisiselTeslim != null && (f.okulTeslim == null || f.kisiselTeslim < f.okulTeslim)
          ? `Kişisel ödevlerdeki ${h.pct(f.kisiselTeslim)} teslim oranını artırmak için bu ödevleri bir süre daha kısa (15–20 soru) ve teslim günü net olarak verin.`
          : f.okulTeslim != null && f.kisiselTeslim != null && f.okulTeslim < f.kisiselTeslim
            ? `Okul ödevlerindeki ${h.pct(f.okulTeslim)} teslim oranı daha düşük; bu ödevlerin teslim günlerini haftalık planda ilk sıraya yazdırın ve o hafta kişisel ödevi hafif tutun.`
            : `Ödevleri bir süre daha kısa (15–20 soru) ve teslim günü net olarak verin; küçük ama tamamlanan ödevler düzeni daha hızlı kurar.`,
      () =>
        `Haftada bir, pazar akşamı 10 dakikalık bir ödev kontrolü planlayın: vadesi yaklaşanlar, sessiz kalanlar ve pas geçilmesi gerekenler birlikte gözden geçirilsin.`,
      () =>
        `Pasın da düzenin bir parçası olduğunu anlatın: yapamayacağı bir ödevi gerekçesiyle pas geçmesi, sessiz bırakmasından her zaman daha iyidir.`,
      (f, h) =>
        `Ödev listesini birlikte açıp her ödeve bir "yapılacak gün" atayın; bir hafta sonra ele alınan oranın ${h.pct(f.eleAlinan)} düzeyinden yukarı çıkıp çıkmadığına bakın.`,
      () =>
        `Ödev sayısını geçici olarak azaltıp teslimi güvenceye alın; ele alınan oran %70 düzeyini geçtiğinde eski yüke kademeli olarak dönün.`,
      () =>
        `Okul ödevleriyle kişisel ödevleri tek bir haftalık listede görmesini sağlayın; hangi ödevin hangi gün yapılacağı belli olunca sessiz kalan ödev azalır.`,
    ],
  },

  // ---------------------------------------------------------------- ZAMAN SIKINTISI
  "gelisim.zaman": {
    alan: [
      () => `Zaman yönetimi ve haftalık plan`,
      () => `Ödevleri haftaya yaymak`,
      () => `Yükü günlere bölmek`,
      () => `Zaman sıkışması: plan desteği`,
      () => `Teslim zamanlaması`,
    ],
    kanit: [
      (f, h) => {
        const p = [];
        if (f.zamanPasi > 0) p.push(`son 14 günde ${adet(f.zamanPasi, h, "ödev")} "zaman yetmedi" gerekçesiyle pas geçildi`);
        if (f.gecOrani > 0) p.push(`teslimlerin ${h.pct(f.gecOrani)} kadarı süresinden sonra geldi`);
        return `${h.cap(p.join("; ayrıca ") || "ödevlerin süresine sığmasında bir sıkışma görünüyor")}.`;
      },
      (f, h) =>
        f.gecOrani > 0
          ? `Geç teslim oranı ${h.pct(f.gecOrani)}${f.zamanPasi > 0 ? ` ve son iki haftadaki zaman pası sayısı ${h.int(f.zamanPasi)}` : ""}; tablo, ödevlerin haftaya yerleştirilmesinde bir sıkışma olduğunu gösteriyor.`
          : `Son iki haftada ${adet(f.zamanPasi, h, "ödev")} zaman yetmediği için pas geçildi; tablo, ödevlerin haftaya yerleştirilmesinde bir sıkışma olduğunu gösteriyor.`,
      (f, h) =>
        `${f.zamanPasi > 0 ? `Öğrenci iki haftada ${adet(f.zamanPasi, h, "kez")} "zaman yetmedi" diyerek pas geçti` : `"Zaman yetmedi" pası görünmüyor`}${f.gecOrani > 0 ? `${f.zamanPasi > 0 ? "; buna ek olarak" : " ama"} teslimlerin ${h.pct(f.gecOrani)} kadarı geç geldi` : ""}.`,
      (f, h) => {
        const p = [];
        if (f.gecOrani > 0) p.push(`geç teslim oranı ${h.pct(f.gecOrani)}`);
        if (f.zamanPasi > 0) p.push(`iki haftadaki "zaman yetmedi" pası ${h.int(f.zamanPasi)}`);
        return `Zorlanma ödevin kendisinden çok zamanlamada görünüyor${p.length ? `: ${p.join(", ")}` : ""}.`;
      },
      (f, h) => {
        const p = [];
        if (f.zamanPasi > 0) p.push(`${adet(f.zamanPasi, h, "ödev")} süre yetmediği için pas geçildi`);
        if (f.gecOrani > 0) p.push(`teslim edilenlerin ${h.pct(f.gecOrani)} kadarı${p.length ? " ise" : ""} gecikti`);
        return `Zaman sıkışmasının izi kayıtlarda açık${p.length ? `; ${p.join(", ")}` : ""}.`;
      },
      (f, h) =>
        f.gecOrani > 0
          ? `Ödevler yapılıyor ama her zaman süresine sığmıyor: teslimlerin ${h.pct(f.gecOrani)} kadarı geç geldi${f.zamanPasi > 0 ? `, ${adet(f.zamanPasi, h, "ödev")} de süre yetmediği için hiç yapılamadı` : ""}.`
          : `İki haftada ${adet(f.zamanPasi, h, "ödev")} süreye sığmadığı için yapılamadı; teslim edilenlerde ise gecikme görünmüyor.`,
    ],
    oneri: [
      (f, h) =>
        `Büyük ödevleri üç güne bölün: ${h.int(f.soru)} soruluk bir ödev için her gün ${h.n(f.gunluk, "soru")} çözülsün, günün sonunda da yanlışlar işaretlensin.`,
      () =>
        `Pazar akşamı öğrenciyle 15 dakikalık bir haftalık plan yapın; okul ve kişisel ödevler aynı takvimde gün gün dağıtılsın.`,
      () =>
        `Öğrenciden bir hafta boyunca günlük çalışma süresini not etmesini isteyin; sıkışan günler ortaya çıkınca teslim günlerini onlara göre kaydırın.`,
      (f) =>
        f.zamanPasi > 0
          ? `"Zaman yetmedi" pasını dürüst bir bildirim olarak takdir edin; ardından haftalık yükü birlikte gözden geçirip gerekirse bir haftalığına kişisel ödev sayısını azaltın.`
          : `Geç teslimleri tek tek konuşmak yerine haftalık yükü birlikte gözden geçirin; gerekirse bir haftalığına kişisel ödev sayısını azaltın.`,
      (f, h) =>
        `Uzun ödevlere teslimden iki gün önce bir ara kontrol koyun: o gün, örneğin ${h.int(f.soru)} soruluk bir ödevin en az yarısı çözülmüş olsun.`,
      (f, h) =>
        `Ödevin ilk parçasını (${h.n(f.gunluk, "soru")}) verildiği gün bitirmesini isteyin; ${h.int(f.soru)} soruluk bir ödevde kalan kısım iki güne yayılır ve son güne yük kalmaz.`,
      () =>
        `Okul ve kişisel ödevlerin aynı güne yığılmaması için kişisel ödevlerin teslim gününü okul ödevlerinden bir gün sonraya ayarlayın.`,
    ],
  },

  // ---------------------------------------------------------------- SON GÜNE BIRAKMA
  "gelisim.sonGun": {
    alan: [
      () => `Çok günlük ödevleri günlere yaymak`,
      () => `Son güne yığılan ödevler`,
      () => `Ödevlere erken başlama alışkanlığı`,
      () => `Son gün yerine ara adımlar`,
      () => `Çok günlük ödevlerde tempo`,
    ],
    kanit: [
      (f, h) =>
        f.sayi >= f.toplam
          ? `Çok günlük ${h.n(f.toplam, "ödevin")} tamamı son gün teslim edildi.`
          : `Çok günlük ${h.n(f.toplam, "ödevin")} ${h.int(f.sayi)} tanesi son gün teslim edildi (${h.pct(f.oran)}).`,
      (f, h) =>
        `Son gün teslim oranı ${h.pct(f.oran)} düzeyinde: birkaç güne yayılması planlanan ${f.sayi >= f.toplam ? `${h.n(f.toplam, "ödevin")} tamamı` : `${h.n(f.toplam, "ödevden")} ${h.int(f.sayi)} tanesi`} son güne kaldı.`,
      (f, h) =>
        `Ödevler teslim ediliyor ama zamanlama tek güne sıkışıyor; çok günlük ödevlerin ${hepsi(f.oran, h)} son gün girildi.`,
      (f, h) =>
        f.toplam - f.sayi <= 0
          ? `${h.n(f.toplam, "çok günlük ödevin")} hiçbiri son günden önce tamamlanmadı.`
          : `${h.n(f.toplam, "çok günlük ödevden")} yalnızca ${h.int(f.toplam - f.sayi)} tanesi son günden önce tamamlandı.`,
      (f, h) =>
        `Son güne kalan ödev sayısı ${h.int(f.sayi)}; bu, çok günlük ${h.n(f.toplam, "ödevin")} ${hepsi(f.oran, h)} demek.`,
      (f, h) =>
        `Birkaç güne yayılması gereken iş tek güne toplanıyor: son gün teslim oranı ${h.pct(f.oran)} (${f.sayi >= f.toplam ? `${h.n(f.toplam, "ödevin")} tamamı` : `${h.n(f.toplam, "ödevden")} ${h.int(f.sayi)}`}).`,
    ],
    oneri: [
      () => `Çok günlük ödevlere bir ara kontrol ekleyin: ilk günün sonunda soruların en az üçte biri çözülmüş olsun.`,
      () =>
        `Ödev verirken gün gün hedef yazın (1. gün ilk üçte bir, 2. gün ikinci üçte bir, son gün kalan kısım ve yanlış analizi); böylece son güne yük birikmez.`,
      () =>
        `Son gün teslimi tek başına sorun değil; asıl kayıp yanlışların incelenmeden kalması. Soruları önceki günlere yayıp son günü yanlış analizine ayırmasını hedefleyin.`,
      () =>
        `Bir sonraki çok günlük ödevde ilk günün sonunda kaç soru çözdüğünü kısa bir mesajla bildirmesini isteyin; bunu iki hafta sürdürüp etkisine birlikte bakın.`,
      () => `Uzun bir ödevi iki ayrı ödev olarak verin: ilk yarısının teslim günü daha erken olsun, ikinci yarısı eski tarihte kalsın.`,
      (f, h) =>
        `Bir ay içinde son gün teslim oranını ${h.pct(f.oran)} düzeyinden bunun yarısına indirmeyi hedefleyin; her hafta sonunda oranı birlikte kontrol edin.`,
      () =>
        `Haftanın hangi günlerinin daha boş olduğunu öğrenciyle birlikte bulun ve çok günlük ödevlerin ilk parçasını o günlere yerleştirin.`,
    ],
  },

  // ---------------------------------------------------------------- KISMİ GİRİŞ
  "gelisim.kismi": {
    alan: [
      () => `Kısmi teslim edilen ödevler`,
      () => `Ödevin tamamını kayda geçirmek`,
      () => `Beklenen soru sayısına ulaşma`,
      () => `Eksik kalan soru girişleri`,
      () => `Eksiksiz ödev girişi`,
    ],
    kanit: [
      (f, h) =>
        `Beklenen soru sayısı bilinen ${h.n(f.toplam, "ödevden")} ${h.int(f.sayi)} tanesinde daha az soru girildi; örneğin ${h.int(f.ornek.beklenen)} soruluk ${f.ornek.ders} ödevinde yalnızca ${h.n(f.ornek.Q, "soru")} kayıtlı.`,
      (f, h) =>
        `${f.ornek.ders} ödevinde beklenen ${h.int(f.ornek.beklenen)} soruya karşılık ${h.n(f.ornek.Q, "soru")} girildi; soru sayısı bilinen ${h.n(f.toplam, "ödevin")} ${h.int(f.sayi)} tanesinde giriş bu şekilde eksik kaldı.`,
      (f, h) =>
        `Bir örnek: ${h.int(f.ornek.beklenen)} soruluk ${f.ornek.ders} ödevinin yalnızca ${h.int(f.ornek.Q)} sorusu kayda geçti; toplam kısmi giriş sayısı ${h.int(f.sayi)}.`,
      (f, h) =>
        `Girişlerin bir kısmı eksik kalıyor: ${h.n(f.toplam, "ödevden")} ${h.int(f.sayi)} tanesinde girilen soru sayısı beklenenin altında.`,
      (f, h) =>
        `${f.ornek.ders} ödevinde girilen soru sayısı beklenenin ${h.pct((f.ornek.Q / f.ornek.beklenen) * 100)} kadarında kaldı; kısmi girişli ödev sayısı ${h.int(f.sayi)}.`,
      (f, h) =>
        `Boş oranları bu dönem yaklaşık okunmalı: ${h.n(f.toplam, "ödevin")} ${h.int(f.sayi)} tanesinde beklenenden az soru girildi ve girilmeyen sorular hesaba katılamıyor.`,
    ],
    oneri: [
      () =>
        `Kısmi girişin nedenini netleştirin: ödev mi yarım kaldı, yoksa boş bırakılan sorular mı girilmedi? İki durum farklı bir plan gerektirir.`,
      (f, h) =>
        `${f.ornek.ders} ödevinde eksik kalan ${h.n(f.ornek.beklenen - f.ornek.Q, "soru")} boş bırakıldıysa "boş" olarak girilsin; hiç bakılmadıysa ertesi güne küçük bir ek görev olarak verin.`,
      (f, h) =>
        f.ornek.beklenen > 25
          ? `${h.int(f.ornek.beklenen)} soruluk ödevleri iki oturuma bölün ya da 20–25 soruluk setlere indirin; tamamlanma arttıkça boyutu yeniden büyütün.`
          : `Ödevi iki kısa oturuma bölün; her oturumun sonunda çözülen soruları not etmesini, girişi ise ödev bitince tek seferde yapmasını isteyin.`,
      () =>
        `Girişte doğru, yanlış ve boş toplamının ödevdeki soru sayısını tutması gerektiğini anlatın; bu küçük kontrol raporların doğruluğunu da artırır.`,
      () =>
        `Yarım kalan bir ödevin kalanını sonradan bitirirse bunu Serbest Çalışma olarak eklemesini söyleyin; böylece emeği kayda geçer.`,
      () =>
        `Kısmi de olsa giriş yapması değerli; bunu söyleyin ve bir sonraki ay kısmi giriş sayısını azaltmayı ortak hedef olarak koyun.`,
      () =>
        `İki hafta boyunca her teslimden sonra girilen soru sayısına kısaca göz atın; eksik görürseniz aynı gün sorun, alışkanlık erkenden düzelir.`,
    ],
  },

  // ---------------------------------------------------------------- SORU NUMARASI GİRİLMİYOR
  "gelisim.numara": {
    alan: [
      () => `Yanlış ve boş numaralarını kaydetmek`,
      () => `Tekrar listesini oluşturmak`,
      () => `Soru numarası girişi`,
      () => `Hataları geri dönülebilir kılmak`,
      () => `Yanlış defterinin dijital karşılığı`,
    ],
    kanit: [
      (f, h) =>
        `Yanlışı ya da boşu olan ${h.n(f.sayi, "kaydın")} ${f.oran > 0 ? `yalnızca ${h.pct(f.oran)} kadarında soru numarası girildi` : "hiçbirinde soru numarası girilmedi"}.`,
      (f, h) =>
        `Numara girilmeyen kayıtlardaki yanlış ve boşlar tekrar listesine düşmüyor; yanlış ya da boş içeren ${h.n(f.sayi, "kayıtta")} ${f.oran > 0 ? `numara girme oranı ${h.pct(f.oran)}` : "hiç numara girilmemiş"}.`,
      (f, h) =>
        `${f.oran > 0 ? `Numara girişi ${h.pct(f.oran)} düzeyinde kaldığı için` : "Hiçbir kayıtta numara girilmediği için"} yanlış ya da boş içeren ${h.n(f.sayi, "kaydın")} ${f.oran <= 0 ? "tamamı" : f.oran < 50 ? "büyük bölümü" : "bir bölümü"} tekrar listesine girmiyor.`,
      (f, h) =>
        `Yanlışı ya da boşu olan ${h.n(f.sayi, "kayıt")} var, ancak ${f.oran <= 0 ? "hiçbirinde" : f.oran < 50 ? "çoğunda" : "bir kısmında"} bu soruların numarası yazılmamış.`,
      (f, h) =>
        `Hatalar ortada ama izleri kayboluyor: numara girilen kayıt oranı ${f.oran > 0 ? h.pct(f.oran) : "sıfır"}, yanlış ya da boş içeren kayıt sayısı ${h.int(f.sayi)}.`,
      (f, h) =>
        `Tekrar listesi ancak soru numaralarıyla oluşuyor; ${h.n(f.sayi, "kayıtta")} numara girme oranı ${f.oran > 0 ? `${h.pct(f.oran)} olduğu için liste büyük ölçüde eksik` : "sıfır olduğu için liste boş"} kalıyor.`,
    ],
    oneri: [
      () =>
        `Bir sonraki görüşmede bir kaydı birlikte girin ve yanlış ve boş soru numaralarının nasıl eklendiğini gösterin; kayıt başına yalnızca birkaç saniyelik bir adım.`,
      () => `İki hafta boyunca tek bir hedef koyun: yanlışı ya da boşu olan her kayıtta soru numaraları da girilsin.`,
      () =>
        `Numaralarla oluşan tekrar listesinin PDF'te yazdırılabilir bir kontrol listesi olarak çıktığını gösterin ve hafta sonu 20–30 dakikalık bir tekrar oturumunda kullandırın.`,
      () =>
        `Kâğıt bir yanlış defteri tutuyorsa ikisini birleştirin: numarayı uygulamaya, hata türünü (bilgi, dikkat, işlem) deftere yazsın.`,
      () => `Numara girişini teslimin son adımı yapın: kayıt ve numaralar birlikte tamamlandığında ödev bitmiş sayılsın.`,
      () =>
        `Geriye dönük tüm kayıtları istemeyin; son haftanın kayıtlarına numara eklemesi ve bundan sonra her kayıtta devam etmesi yeterli.`,
      () => `İlk hafta yalnızca en çok yanlış çıkan derste numara girişi isteyin; alışkanlık oturunca diğer derslere genişletin.`,
    ],
  },

  // ---------------------------------------------------------------- TYT/AYT DENGESİ
  "gelisim.denge": {
    alan: [
      () => `TYT–AYT dengesi`,
      (f) => `${f.kucuk} tarafına ağırlık vermek`,
      (f) => `${f.kucuk} payını büyütmek`,
      (f) => `Çalışma dağılımında ${f.kucuk} açığı`,
      () => `İki oturum arasında denge`,
    ],
    kanit: [
      (f, h) =>
        kucukYok(f)
          ? `Çözülen ${h.n(f.toplam, "soru")} arasında hiç ${f.kucuk} sorusu yok.`
          : `Çözülen ${h.n(f.toplam, "sorunun")} yalnızca ${h.int(f.kucukSoru)} tanesi ${f.kucuk} sorusu; bu, toplamın ${h.pct(f.oran)} kadarı.`,
      (f, h) =>
        kucukYok(f)
          ? `${f.kucuk} tarafının toplam içindeki payı sıfır; ${h.n(f.toplam, "sorunun")} tamamı ${buyuk(f)} tarafında.`
          : `${f.kucuk} tarafının toplam içindeki payı ${h.pct(f.oran)} düzeyinde kaldı (${h.n(f.toplam, "sorudan")} ${h.n(f.kucukSoru, "soru")}).`,
      (f, h) =>
        kucukYok(f)
          ? `Soruların tamamı ${buyuk(f)} tarafına gidiyor; ${h.n(f.toplam, "sorunun")} hiçbiri ${f.kucuk} sorusu değil.`
          : `Soruların büyük çoğunluğu ${buyuk(f)} tarafına gidiyor: ${h.n(f.toplam, "sorunun")} ${h.int(f.toplam - f.kucukSoru)} tanesi ${buyuk(f)}, ${h.int(f.kucukSoru)} tanesi ${f.kucuk}.`,
      (f, h) =>
        f.kucuk === "TYT"
          ? `TYT payı ${kucukYok(f) ? "sıfır" : `${h.pct(f.oran)} ile %25 eşiğinin altında`}; TYT her puan türünde hesaba katıldığı için bu payın yükselmesi gerekiyor.`
          : `AYT payı ${kucukYok(f) ? "sıfır" : `${h.pct(f.oran)} ile %25 eşiğinin altında`}; lisans hedefleyen bir 12. sınıf öğrencisinde puanı iki oturum birlikte belirlediği için dağılım dengelenmeli.`,
      (f, h) =>
        kucukYok(f)
          ? `Tamamen ${buyuk(f)} ağırlıklı bir dönem: ${f.kucuk} tarafında hiç soru kaydı yok.`
          : `${buyuk(f)} ağırlıklı bir dönem: ${f.kucuk} tarafında ${h.n(f.kucukSoru, "soru")} var, bu da toplamın ${h.pct(f.oran)} kadarı.`,
      (f, h) =>
        kucukYok(f)
          ? `Dağılım tamamen tek tarafta: ${h.n(f.toplam, "sorunun")} hepsi ${buyuk(f)}.`
          : `Dağılım tek tarafa kaymış durumda: ${buyuk(f)} ${h.pct(100 - f.oran)}, ${f.kucuk} ${h.pct(f.oran)} pay aldı.`,
    ],
    oneri: [
      (f, h) =>
        `Bu hafta kişisel ödevlere ${h.int(f.hedef)} ${f.kucuk} sorusu ekleyin; toplam süre artmasın diye ${buyuk(f)} tarafındaki yükü aynı ölçüde hafifletin.`,
      (f, h) =>
        `Bu haftaki ${h.int(f.hedef)} soruluk ${f.kucuk} hedefini üç güne bölün (günde yaklaşık ${h.int(Math.ceil(f.hedef / 3))} soru) ve bu günleri haftalık planda sabitleyin.`,
      (f, h) =>
        `Dengeyi bir haftada kurmaya çalışmayın: bu hafta ${h.int(f.hedef)} ${f.kucuk} sorusuyla başlayın, sonraki haftalarda payın %25 düzeyini geçip geçmediğini izleyin.`,
      (f, h) =>
        `${f.kucuk === "TYT" ? "TYT temelini korumak için" : "AYT konularını zamanında yetiştirmek için"} kişisel ödevlerin bir kısmını ${f.kucuk} tarafına kaydırın; bu haftanın hedefi ${h.n(f.hedef, "soru")}.`,
      (f, h) =>
        `${f.kucuk} tarafında öğrencinin en rahat ettiği dersten başlayın; ilk ${h.n(f.hedef, "soru")} kolay ve orta düzey setlerden seçilirse geçiş kolaylaşır.`,
      (f, h) =>
        f.kucuk === "TYT"
          ? `Haftada bir, süre tutarak 40 soruluk bir TYT Türkçe ya da Matematik bloğu planlayın; bu blok haftanın ${h.int(f.hedef)} soruluk TYT hedefine sayılsın.`
          : `Haftada bir, süre tutarak bir AYT branş denemesi planlayın; bu deneme haftanın ${h.int(f.hedef)} soruluk AYT hedefine sayılsın.`,
      (f, h) =>
        f.kucuk === "TYT"
          ? `TYT her puan türünde hesaba katıldığı için bu açığı ertelemeyin; bu hafta ${h.int(f.hedef)} TYT sorusunu Türkçe ve Matematik arasında paylaştırın.`
          : `Sistemde alan bilgisi olmadığı için önce öğrencinin hedefini (lisans, puan türü) netleştirin; AYT gerekiyorsa bu hafta ${h.n(f.hedef, "soruyla")} başlayın.`,
    ],
  },

  // ---------------------------------------------------------------- KONU KAPSAMI (okulda işlenmiş, kaydı yok)
  "gelisim.kapsam": {
    alan: [
      (f) => `${f.ders}: kaydı olmayan konular`,
      () => `Okulda işlenen konulara yetişmek`,
      (f) => `${f.ders} dersinde konu kapsamı`,
      () => `Kayıtlara yansımayan konular`,
      () => `Konu kapsamını tamamlamak`,
    ],
    kanit: [
      (f, h) =>
        `Okulda işlenen ${h.int(f.sayi)} ${f.ders} konusunda öğrencinin hiç kaydı yok${f.sayi > (f.konular || []).length ? `; aralarında ${h.qlist(f.konular)} var` : `: ${h.qlist(f.konular)}`}.`,
      (f, h) =>
        `${f.ders} dersinde ${h.qlist(f.konular)} ${ek(f.konular, "konusunda", "konularında")} kayıt görünmüyor, oysa ${ek(f.konular, "bu konu", "bu konular")} okulda işlendi${f.sayi > (f.konular || []).length ? `; toplamda ${h.n(f.sayi, "konu")} bu durumda` : ""}.`,
      (f, h) =>
        `Sınıf ilerledi ama kayıtlar henüz yetişmedi: ${f.ders} dersinde okulda işlenen konulardan ${h.int(f.sayi)} tanesinde kayıt yok, ilk sırada ${h.q(ilk(f.konular))} var.`,
      (f, h) =>
        `Kayıtlara göre ${h.qlist(f.konular)} için henüz hiç soru girilmemiş; ${f.ders} dersinde bu durumdaki konu sayısı ${h.int(f.sayi)}.`,
      (f, h) =>
        `Konu kapsamında bir açık var: okulda işlenen ${h.int(f.sayi)} ${f.ders} konusu için öğrencinin henüz hiç çalışma kaydı bulunmuyor.`,
      (f, h) =>
        `Konu eşleştirmesi yaklaşık olduğundan teyit etmekte yarar var; yine de ${f.ders} dersinde ${h.qlist(f.konular)} ${ek(f.konular, "konusunda", "konularında")} hiç kayıt görünmüyor.`,
    ],
    oneri: [
      (f, h) =>
        f.sayi > 1
          ? `Her konu için 15–20 soruluk kısa bir giriş seti verin; ${h.q(ilk(f.konular))} ile başlayın.`
          : `${h.q(ilk(f.konular))} için 15–20 soruluk kısa bir giriş setiyle başlayın; ertesi hafta aynı konuya ikinci bir set ekleyin.`,
      (f) =>
        `Önce ${f.sayi > 1 ? "bu konular" : "bu konu"} için kayda geçmemiş bir çalışma olup olmadığını sorun; varsa girişi yapılsın, yoksa ${f.sayi > 1 ? "konular" : "konu"} haftalık plana eklensin.`,
      (f, h) =>
        f.sayi > 1
          ? `Kaydı olmayan ${h.n(f.sayi, "konuyu")} haftada bir tane olacak şekilde sıraya koyun; her biri için kısa bir konu tekrarı ve kolaydan zora 20 soruluk bir set yeterli bir başlangıç.`
          : `Konuyu bu haftanın planına ekleyin; kısa bir konu tekrarı ve kolaydan zora 20 soruluk bir set yeterli bir başlangıç.`,
      (f, h) =>
        `Okulun temposunu yakalamak için bu haftanın kişisel ödevini ${h.q(ilk(f.konular))} konusundan verin${f.sayi > 1 ? "; kalanları sonraki haftalara yayın" : ""}.`,
      (f, h) =>
        `Branş öğretmeninden ${h.qlist(f.konular)} için ders notu ya da özet isteyin; öğrenci önce notu okusun, ardından kısa bir set çözsün.`,
      (f) =>
        `${f.sayi > 1 ? "Bu konuları" : "Konuyu"} aralıklı tekrarla planlayın: ilk gün kısa anlatım ve 10 soru, üç gün sonra 15 soruluk ikinci set, bir hafta sonra karma tekrar.`,
      (f) =>
        `Ay sonunda ${f.ders} konu listesini öğrenciyle birlikte gözden geçirin; kaydı olmayan her konu bir sonraki ayın planına girsin.`,
    ],
  },

  // ---------------------------------------------------------------- SERBEST ÇALIŞMA YOK (ödevler düzenli)
  "gelisim.serbestYok": {
    alan: [
      () => `Ödev dışı çalışma alışkanlığı`,
      () => `Serbest çalışmaya küçük bir alan`,
      () => `Ödevlerin ötesine geçmek`,
      () => `Kendi seçtiği çalışmalar`,
      () => `Serbest çalışma kaydı`,
    ],
    kanit: [
      (f, h) => `Ödev teslimi ${h.pct(f.teslim)} düzeyinde ve düzenli, ancak son üç haftada ödev dışı hiçbir kayıt yok.`,
      (f, h) =>
        `Son üç haftadır tüm kayıtlar ödevlerden geliyor; teslim oranı ${h.pct(f.teslim)} ile yüksek olsa da serbest çalışma kaydı görünmüyor.`,
      (f, h) =>
        `${h.pct(f.teslim)} teslim oranı ödev disiplininin oturduğunu gösteriyor; buna karşın üç haftadır ödev dışı kayıt girilmemiş.`,
      (f, h) =>
        `Kayıtların tamamı üç haftadır ödevlerden oluşuyor (teslim ${h.pct(f.teslim)})${f.odakDers ? `; odak ders ${f.odakDers} için de ödev dışında ek soru yok` : ""}.`,
      (f, h) =>
        `Ödevlerin ${h.pct(f.teslim)} kadarı teslim edildi, fakat kendi seçimiyle çözülen ek sorular son üç haftada kayıtlara yansımadı.`,
      (f, h) =>
        `Serbest çalışma kaydının üç haftadır boş olması iki türlü okunabilir: ek çalışma yapılmıyor ya da yapılıp girilmiyor; ödev teslimi ise ${h.pct(f.teslim)} ile düzenli.`,
    ],
    oneri: [
      (f) =>
        `Haftada 2 gün, her biri 20 soruluk küçük bir serbest çalışma bloğu önerin${f.odakDers ? `; ilk tercih ${f.odakDers} olsun` : ""}.`,
      () =>
        `Önce kayıt dışı çalışıp çalışmadığını sorun; çalışıyorsa bunları da Serbest Çalışma olarak girmesini isteyin, böylece emeği görünür olur.`,
      (f) =>
        `Serbest çalışmayı ödev gibi değil, seçimi öğrenciye bırakılan bir alan olarak sunun: ${f.odakDers ? `${f.odakDers} dersinden` : "odak dersten"} kendi seçeceği bir konuda 15–20 soru.`,
      () =>
        `Yeni yük eklemek yerine mevcut bir çalışma saatinin son 20 dakikasını serbest çalışmaya ayırın ve bunu Serbest Çalışma olarak girmesini isteyin.`,
      (f, h) =>
        `${h.pct(f.teslim)} teslim düzeyini takdir ederek başlayın, ardından haftalık planda tek bir serbest çalışma saati belirleyin.`,
      () =>
        `Serbest çalışmaya kolay bir başlangıç olarak tekrar listesini önerin: haftada bir oturumda eski yanlışlarını yeniden çözmesi yeterli.`,
      (f) =>
        `${f.odakDers ? `${f.odakDers} dersinde` : "Odak derste"} ödev dışında çözülecek küçük bir haftalık hedef (20–30 soru) belirleyin ve bir sonraki görüşmede birlikte bakın.`,
    ],
  },

  // ---------------------------------------------------------------- SERBEST ÇALIŞMA DAĞILIMI (güçlü derslere yığılma)
  "gelisim.serbestDagilim": {
    alan: [
      () => `Serbest çalışmayı odak derse yönlendirmek`,
      () => `Serbest çalışmada ders dağılımı`,
      (f) => `${f.odakDers} için serbest zaman`,
      () => `Güçlü derslerden odak derse kaydırma`,
      () => `Serbest soruların yönü`,
    ],
    kanit: [
      (f, h) =>
        `Ödev dışı çözülen ${h.n(f.serbestSoru, "sorunun")} ${hepsi(f.gucluPay, h)} güçlü derslere (başta ${f.gucluDers}) gitti; odak ders ${f.odakDers} ise ${odakSifir(f) ? `${hic(f)} pay almadı` : `yalnızca ${h.pct(f.odakPay)} pay aldı`}.`,
      (f, h) =>
        `${f.odakDers} dersine serbest çalışmadan ${odakSifir(f) ? `${hic(f)} pay ayrılmadı` : `ayrılan pay ${h.pct(f.odakPay)}`}; buna karşın ${f.gucluDers} başta olmak üzere güçlü derslerin payı ${h.pct(f.gucluPay)}.`,
      (f, h) =>
        `İnisiyatif var ama yönü güçlü derslere dönük: ${h.n(f.serbestSoru, "serbest sorunun")} ${hepsi(f.gucluPay, h)} başta ${f.gucluDers} olmak üzere güçlü derslerde çözüldü.`,
      (f, h) =>
        `Serbest çalışmada ${f.gucluDers} ağırlıklı bir tablo var; güçlü dersler ${h.pct(f.gucluPay)} pay alırken ${f.odakDers} ${odakSifir(f) ? `${hic(f)} yer almıyor` : `${h.pct(f.odakPay)} düzeyinde kalıyor`}.`,
      (f, h) =>
        `${h.n(f.serbestSoru, "serbest soru")} ek çalışma isteğini gösteriyor; ancak bu sorulardan ${f.odakDers} dersine ${odakSifir(f) ? `${hic(f)} pay düşmedi` : `düşen pay yalnızca ${h.pct(f.odakPay)}`}.`,
      (f, h) =>
        `Serbest soruların dağılımı tek yöne kaymış: güçlü derslere ${h.pct(f.gucluPay)}, odak ders ${f.odakDers} için ${odakSifir(f) ? `${hic(f)} soru yok` : `yalnızca ${h.pct(f.odakPay)}`}.`,
    ],
    oneri: [
      (f) =>
        `Serbest çalışmayı tümden değiştirmeye çalışmayın; her üç serbest setten birini ${f.odakDers} dersine ayırması iyi bir başlangıç.`,
      (f) =>
        `${f.gucluDers} dersindeki çalışmayı takdir edin, ardından serbest soruların en az dörtte birini ${f.odakDers} dersine kaydırmayı birlikte hedefleyin.`,
      (f) =>
        `Serbest çalışmayı "önce odak, sonra güçlü ders" sırasına bağlayın: gün içindeki ilk 20 soru ${f.odakDers}, ardından ${f.gucluDers}.`,
      (f) =>
        `${f.odakDers} için kolay bir kaynaktan 15–20 soruluk setler önerin; başarı hissi veren kısa setler odak derse geçişi kolaylaştırır.`,
      (f) =>
        `Güçlü derslerdeki çalışmayı tamamen kesmeyin; ${f.gucluDers} için haftada bir bakım seti yeterli, kalan serbest zamanı ${f.odakDers} dersine yönlendirin.`,
      (f) =>
        `Bir sonraki görüşmede ${f.odakDers} dersinden öğrencinin kendi seçeceği bir konu belirleyin ve serbest çalışmada bu konuya haftada iki set ayırmasını isteyin.`,
      (f, h) =>
        `${f.odakDers} payını ${odakSifir(f) ? (f.odakPay > 0 ? "neredeyse sıfırdan" : "sıfırdan") : `${h.pct(f.odakPay)} düzeyinden`} yukarı taşımak için küçük bir haftalık hedef koyun ve her hafta sonunda serbest soruların dağılımına birlikte bakın.`,
    ],
  },
};
