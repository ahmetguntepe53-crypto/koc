// "Bu hafta yapabileceklerin" — öğrencinin bu hafta kendi başına yapabileceği 2–4 somut eylem (bkz. ./catalog.js adim.*).
// Her kalıp TEK kısa eylem cümlesi, "sen" diliyle ve emir kipinde ("çöz", "gir", "ayır"); ders adı başta durursa iki
// nokta ile ayrılır ("TYT Matematik: 'Problemler' konusundan 15 soru çöz."). Sayı ve adlara ek yapıştırılmaz.

const hocana = (f) => (f.ogretmen ? `${f.ogretmen} hocana` : "branş öğretmenine");

export default {
  "adim.konu": [
    (f, h) => `${f.ders}: ${h.q(f.konu)} konusundan ${h.n(f.soru, "soru")} çöz.`,
    (f, h) => `Bu hafta ${f.ders} dersinde ${h.q(f.konu)} konusuna ${h.n(f.soru, "soruluk")} bir set ayır.`,
    (f, h) => `${f.ders} dersinde ${h.q(f.konu)} konusundan kolaydan zora ${h.n(f.soru, "soru")} çöz.`,
    (f, h) => `${f.ders} için hafta ortasına ${h.q(f.konu)} konusundan ${h.n(f.soru, "soruluk")} bir oturum koy.`,
    (f, h) => `İlk adım ${f.ders}: ${h.q(f.konu)} konusundan ${h.n(f.soru, "soru")}.`,
  ],

  "adim.hedef": [
    (f, h) => `${f.ders}: bu hafta ${h.n(f.hedefQ, "soru")} çöz.`,
    (f, h) => `${f.ders} dersinde haftalık hedefin ${h.n(f.hedefQ, "soru")}; üç güne bölersen kolayca yetişir.`,
    (f, h) => `Bu hafta ${f.ders} dersine ${h.n(f.hedefQ, "soru")} ayır.`,
    (f, h) => `${f.ders} için ${h.n(f.hedefQ, "soruluk")} haftalık hedefini üç oturuma böl.`,
    (f, h) => `${f.ders}: ${h.n(f.hedefQ, "soruluk")} hedefe ulaşmak için her gün küçük bir set çöz.`,
  ],

  "adim.tekrar": [
    (f, h) => `${f.ders}: ${h.q(f.konu)} konusuna 15 soruluk bir tekrar yap.`,
    (f, h) => `Bu hafta ${h.q(f.konu)} konusunu tazele: 10 dakikalık özet, ardından 15 soru.`,
    (f, h) => `${f.ders} dersinde ${h.q(f.konu)} konusundaki eski yanlışlarını yeniden çöz.`,
    (f, h) => `Hafta sonuna ${f.ders} dersinden ${h.q(f.konu)} konusuna kısa bir tekrar ekle.`,
    (f, h) => `${f.ders}: ${h.q(f.konu)} konusunda 15 soruluk bir dönüş seti çöz.`,
  ],

  "adim.sonuc": [
    (f, h) => `Sonucu girilmemiş ${h.n(f.sayi, "ödevini")} kapat: çözdüysen sonucu gir, çözemediysen nedenini seçerek pas geç.`,
    (f, h) => (f.sayi > 1 ? `Bugün açık kalan ${h.n(f.sayi, "ödevinden")} birini kapatarak başla.` : "Bugün açık kalan ödevini kapatarak başla."),
    (f, h) => (f.sayi > 1
      ? `Ödevlerim ekranında açık kalan ${h.n(f.sayi, "ödeve")} göz at ve her biri için bir karar ver.`
      : "Ödevlerim ekranında açık kalan ödevine göz at ve bir karar ver."),
    (f, h) => `Açık ödevlerini bu hafta kapat (${h.n(f.sayi, "ödev")}).`,
    (f, h) => `Sonucu girilmemiş ödevlerin için 10 dakika ayır; ${h.n(f.sayi, "ödev")} kapanınca raporun tamamlanır.`,
  ],

  "adim.numara": [
    () => "Her kayıtta yanlış ve boş soru numaralarını da gir.",
    () => "Bu hafta sonuç girerken yanlış ve boş numaralarını işaretlemeyi alışkanlık yap.",
    () => "Yanlış ve boş numaralarını gir, hafta sonunda o sorulara geri dön.",
    () => "Yanlış numaralarını girerek kendi tekrar listeni oluştur.",
    () => "Sonuç ekranında yanlış ve boş numaralarını atlama; tekrar listen onlardan oluşur.",
  ],

  "adim.gun": [
    (f, h) => `Bu hafta ${h.n(f.gun, "gün")} çalışmayı hedefle.`,
    (f, h) => `Haftada ${h.n(f.gun, "gün")} kısa da olsa bir kayıt gir.`,
    (f, h) => `Bu haftanın ritim hedefi: ${h.n(f.gun, "farklı günde")} çalışma kaydı.`,
    (f, h) => `Bu hafta ${h.n(f.gun, "güne")} yayılan kısa oturumlar planla.`,
    (f, h) => `Haftalık ritim hedefin: ${h.n(f.gun, "aktif gün")}.`,
  ],

  "adim.denemeAnaliz": [
    (f) => `Bir sonraki denemeden sonra ${f.ders} bölümüne 20 dakikalık bir analiz ayır.`,
    (f) => `Son denemendeki ${f.ders} yanlışlarını konu konu listele.`,
    (f) => `${f.ders} bölümünde boş bıraktığın soruların konularını çıkar ve en sık olana 15 soru çöz.`,
    (f) => `Deneme sonrası ${f.ders} yanlışlarını bilgi, dikkat ve işlem hatası diye ayır.`,
    (f) => `${f.ders} deneme sorularından çözemediklerini bir hafta sonra yeniden dene.`,
  ],

  "adim.denge": [
    (f, h) => `Bu hafta ${f.kucuk} tarafına ${h.n(f.hedef, "soru")} ekle.`,
    (f) => `Haftada iki gün ilk oturumunu ${f.kucuk} sorularına ayır.`,
    (f, h) => `${f.kucuk} için ${h.n(f.hedef, "soruluk")} bir hafta hedefi koy.`,
    (f, h) => `Serbest setlerinden birkaçını ${f.kucuk} derslerine kaydır (${h.n(f.hedef, "soru")}).`,
    (f, h) => `${f.kucuk} tarafında bu hafta ${h.n(f.hedef, "soru")} çöz.`,
  ],

  "adim.serbest": [
    (f) => (f.ders ? `Haftada bir gün ${f.ders} dersinden 20 soruluk bir serbest set çöz.` : "Haftada bir gün kendi seçtiğin bir dersten 20 soruluk bir serbest set çöz."),
    () => "Ödevlerini bitirdiğin bir gün 10 soruluk ek bir set dene.",
    (f) => (f.ders ? `Serbest çalışmanı ${f.ders} dersine ayır.` : "Serbest çalışmanı en çok gelişebileceğin derse ayır."),
    () => "Hafta sonuna 30 dakikalık bir serbest çalışma oturumu koy.",
    () => "Serbest çalışmanı Çalışma ekle ekranından kaydetmeyi unutma.",
  ],

  "adim.bolme": [
    () => "Çok günlük ödevin ilk gününde en az üçte birini bitir.",
    () => "Haftanın başında hangi ödevi hangi gün çözeceğini yaz.",
    () => "Uzun ödevleri güne böl: her gün küçük bir parça.",
    () => "Ödev gelir gelmez 10 dakikalık bir başlangıç yap.",
    () => "Her gün aynı saatte 30 dakikalık bir ödev oturumu ayır.",
  ],

  "adim.brans": [
    (f, h) => `${h.cap(hocana(f))} ${f.konu ? `${h.q(f.konu)} konusunu` : `${f.ders} dersinde takıldığın yeri`} sor.`,
    (f) => `${f.ders} dersinde takıldığın bir soruyu ${hocana(f)} göster.`,
    (f, h) => (f.konu
      ? `Önce ${h.q(f.konu)} konusunun anlatımını izle ya da oku, ardından 10 kolay soru çöz.`
      : `${f.ders} dersinde zorlandığın konunun anlatımını tekrar izle, ardından 10 kolay soru çöz.`),
    (f) => `Koçunla ${f.ders} için kısa bir konu planı yap.`,
    (f) => `${f.ders} dersinde anlamadığın noktayı bir cümleyle yaz ve bir sonraki derste sor.`,
  ],

  "adim.kaynak": [
    (f, h) => `Kaynak eksiğini (${h.q(f.kitap)}) koçuna söyle.`,
    (f) => `Kaynak gelene kadar ${f.ders} dersinde elindeki kitaptan aynı konuya 15 soru çöz.`,
    (f, h) => `Okul kütüphanesinde ${h.q(f.kitap)} olup olmadığını sor.`,
    (f) => `Kaynağa ulaşınca pas geçtiğin ${f.ders} ödevine geri dön.`,
    (f) => `${f.ders} için elindeki kaynaklarla haftalık bir set planla.`,
  ],

  "adim.genel": [
    () => "Her gün 20 soruluk bir setle başla.",
    () => "Bu hafta her çalışmanı aynı gün kaydet.",
    () => "Haftanın sonunda yanlışlarından 10 tanesini yeniden çöz.",
    () => "Günlük kısa bir tekrar yap: dünkü yanlışlarından 5 soru.",
    () => "Bu hafta bir ödevi süresinden bir gün önce bitirmeyi dene.",
  ],
};
