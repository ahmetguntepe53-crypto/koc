// Öğrencinin gelişim alanları (ödev düzeni, zaman, kayıt alışkanlıkları) — alan / kanit / oneri (bkz. ./gelisimDers.js
// başındaki kurallar). "Sessiz ödev" koçun terimidir: öğrenciye "sonucu girilmemiş ödev" denir; pas geçmek dürüst bir
// ele alma olarak anılır, hiçbir cümle suçlamaz.

const hocana = (f) => (f.ogretmen ? `${f.ogretmen} hocana` : "branş öğretmenine");
const ornekler = (f) => (f.ornekler || []).filter((o) => o && o.ders && o.konu);
const ornekList = (f, h) => h.list(ornekler(f).map((o) => `${o.ders} (${h.q(o.konu)})`));
// Hiç numara girilmemişse "%0 kadarında" yerine düz cümle.
const numaraYok = (f) => Math.round(f.oran ?? 0) === 0;

export default {
  // ---------------------------------------------------------------- kaynak kitap eksik
  "gelisim.kaynak": {
    alan: [
      (f) => `${f.ders}: kaynağa ulaşmak`,
      (f, h) => `Kaynak desteği: ${h.q(f.kitap)}`,
      (f) => `${f.ders} ödevleri için kaynak`,
      (f) => `${f.ders} kaynağını tamamlamak`,
      (f) => `${f.ders} dersinde kaynakla ilerlemek`,
    ],
    kanit: [
      (f, h) => `Kaynağın elinde olmadığı için ${f.ders} dersinde ${h.n(f.sayi, "ödevi")} pas geçtin (${h.q(f.kitap)}).`,
      (f, h) => `${f.ders} dersindeki ${h.n(f.sayi, "pasın")} nedeni kaynak: ${h.q(f.kitap)}.`,
      (f, h) => `Pas nedenini doğru bildirdin: ${h.q(f.kitap)} kaynağına henüz ulaşamadın.`,
      (f, h) => `${h.cap(h.n(f.sayi, "ödev"))} kaynak yüzünden bekliyor (${f.ders}).`,
      (f, h) => `${f.ders} ödevlerinde kullanılan ${h.q(f.kitap)} sende yok; bu, okulun çözebileceği bir durum.`,
    ],
    oneri: [
      () => "Kaynak eksiğini koçuna söyle; okul yönetimi bir çözüm bulabilir.",
      (f) => `Kaynak gelene kadar ${f.ders} dersinde elindeki kitaptan aynı konuya 15 soru çöz.`,
      (f, h) => `${h.cap(hocana(f))} kaynağın olmadığını söyle; ödevi başka bir kaynaktan da çözebilirsin.`,
      () => "Kaynağa ulaşınca pas geçtiğin ödeve geri dön; pastan dönüş teslim sayılır.",
      (f, h) => `Okul kütüphanesinde ${h.q(f.kitap)} olup olmadığını sor.`,
    ],
  },

  // ---------------------------------------------------------------- süresi geçmiş, ne teslim ne pas
  "gelisim.sessiz": {
    alan: [
      () => "Sonucu girilmemiş ödevleri kapatmak",
      () => "Ödevlerini tamamlama fırsatı",
      () => "Açık kalan ödevler",
      () => "Ödev listesini temize çekmek",
      () => "Her ödeve bir sonuç",
    ],
    kanit: [
      (f, h) => `Süresi geçmiş ${h.n(f.sayi, "ödevinin")} sonucu henüz girilmemiş.`,
      (f, h) => (!ornekler(f).length ? `Sonucu girilmemiş ${h.n(f.sayi, "ödevin")} var.`
        : f.sayi > 1 ? `Sonucu girilmemiş ödevlerin arasında ${ornekList(f, h)} var.`
        : `Sonucu girilmemiş ödevin: ${ornekList(f, h)}.`),
      (f, h) => `En eski açık ödevinin süresi ${h.n(f.enEski, "gün")} önce doldu.`,
      (f, h) => `${h.cap(h.n(f.sayi, "ödev"))} ne teslim edildi ne pas geçildi; raporun ${f.sayi > 1 ? "onları" : "onu"} henüz göremiyor.`,
      (f, h) => {
        const o = ornekler(f)[0];
        if (!o) return `Açık kalan ${h.n(f.sayi, "ödevinin")} sonucu bekleniyor.`;
        return f.sayi > 1
          ? `${o.ders} dersindeki ${h.q(o.konu)} ödevi dahil ${h.n(f.sayi, "ödevinin")} sonucu bekleniyor.`
          : `${o.ders} dersindeki ${h.q(o.konu)} ödevinin sonucu bekleniyor.`;
      },
    ],
    oneri: [
      () => "Çözdüğün ödevlerin sonucunu gir; çözemediklerini nedenini seçerek pas geç — ikisi de düzenin sayılır.",
      () => "Bugün en eski açık ödevinden başla: ya sonucunu gir ya da pas geç.",
      (f, h) => {
        const o = ornekler(f)[0];
        return o
          ? `${o.ders} dersindeki ${h.q(o.konu)} ödevini bu hafta tamamlamayı hedefle.`
          : "Açık ödevlerinden en kısasını seç ve bu hafta tamamla.";
      },
      () => "Bir ödevi çözemeyeceğini fark edersen pas geç ve nedenini yaz; koçun planı sana göre ayarlar.",
      () => "Ödevlerim ekranında açık kalanları tek tek kapat; her biri birkaç dakikanı alır.",
    ],
  },

  // ---------------------------------------------------------------- ödev düzeni (ele alınan < %70)
  "gelisim.duzen": {
    alan: [
      () => "Ödev düzenini güçlendirmek",
      () => "Ödevleri zamanında ele almak",
      () => "Haftalık ödev ritmi",
      () => "Düzenli teslim alışkanlığı",
      () => "Ödevlerde istikrar",
    ],
    kanit: [
      (f, h) => `Vadesi gelen ${h.n(f.V, "ödevinin")} ${h.pct(f.eleAlinan)} kadarını ele aldın (teslim ya da pas); ${h.n(f.sessiz, "ödevin")} sonucu henüz girilmemiş.`,
      (f, h) => `Teslim oranın ${h.pct(f.teslim)}; pas geçtiklerinle birlikte ele aldığın ödevlerin oranı ${h.pct(f.eleAlinan)}.`,
      (f, h) => (f.okulTeslim != null && f.kisiselTeslim != null
        ? `Okul ödevlerinde teslim oranın ${h.pct(f.okulTeslim)}, kişisel ödevlerde ${h.pct(f.kisiselTeslim)}.`
        : `${h.n(f.V, "ödevinin")} ${h.int(f.sessiz)} tanesinin sonucu bekleniyor.`),
      (f, h) => `${h.cap(h.n(f.sessiz, "ödev"))} ne teslim edildi ne pas geçildi; bunlar kapanınca düzen oranın hızla yükselir.`,
      (f, h) => `Ödevlerinin ${h.pct(f.eleAlinan)} kadarı kapandı; geri kalanlar sonucunu bekliyor.`,
    ],
    oneri: [
      () => "Her ödev için bir karar ver: çözdüysen sonucunu gir, çözemediysen nedenini seçerek pas geç.",
      () => "Haftanın başında ödevlerini gün gün planla; her gün en az birini kapat.",
      () => "Ödev yükün fazla geliyorsa bunu koçuna söyle; birlikte daha gerçekçi bir plan yapabilirsiniz.",
      () => "Bu hafta açık kalan ödevlerinden en kısasıyla başla; küçük bir kazanım devamını getirir.",
      () => "Sonuç girmeyi günün sonuna bırakma: ödevi bitirdiğin anda kaydet.",
    ],
  },

  // ---------------------------------------------------------------- zaman sıkıntısı
  "gelisim.zaman": {
    alan: [
      () => "Zamanı ödevlere yaymak",
      () => "Çok günlük ödevleri bölmek",
      () => "Haftalık zaman planı",
      () => "Ödevleri zamanında bitirmek",
      () => "Ödev yükünü güne yaymak",
    ],
    kanit: [
      (f, h) => (f.zamanPasi > 0
        ? `Son iki haftada ${h.n(f.zamanPasi, "ödevi")} 'zaman yetmedi' diyerek pas geçtin.`
        : `Teslimlerinin ${h.pct(f.gecOrani)} kadarı süresinden sonra geldi.`),
      (f, h) => `Son tarihten sonra gelen teslimlerinin oranı ${h.pct(f.gecOrani)}.`,
      (f, h) => `${h.n(f.soru, "soruluk")} bir ödev üç güne bölününce günde yalnızca ${h.n(f.gunluk, "soru")} ediyor.`,
      (f, h) => (f.zamanPasi > 0
        ? `Zaman nedeniyle pas geçtiğin ${h.n(f.zamanPasi, "ödev")} var; bu, haftalık yükün sıkıştığını gösteriyor.`
        : `Geç teslimlerin (${h.pct(f.gecOrani)}) zamanın sıkıştığı haftalardan geliyor olabilir.`),
      (f, h) => `Ödevlerinin bir kısmı zamana sığmadı: geç teslim oranın ${h.pct(f.gecOrani)}.`,
    ],
    oneri: [
      (f, h) => `${h.n(f.soru, "soruluk")} bir ödevi üç güne böl: günde ${h.n(f.gunluk, "soru")} hem kolay hem sürdürülebilir.`,
      () => "Haftanın başında hangi ödevi hangi gün çözeceğini kısa bir listeye yaz.",
      () => "Ödev yükün gerçekten fazla geliyorsa koçuna söyle; birlikte daha gerçekçi bir hafta planlayabilirsiniz.",
      () => "Her gün aynı saatte 30 dakikalık bir ödev oturumu ayır.",
      () => "Çok günlük ödevin ilk gününde en az üçte birini bitir; son güne yalnızca kontrol kalsın.",
    ],
  },

  // ---------------------------------------------------------------- son güne bırakma
  "gelisim.sonGun": {
    alan: [
      () => "Çok günlük ödevleri erken başlatmak",
      () => "Son güne sıkışmadan çalışmak",
      () => "Ödevi güne yaymak",
      () => "Erken başlama alışkanlığı",
      () => "Ödevlerde ara durak",
    ],
    kanit: [
      (f, h) => `Çok günlük ödevlerinin ${h.pct(f.oran)} kadarını son gün teslim ettin.`,
      (f, h) => `${h.n(f.toplam, "çok günlük ödevinin")} ${h.int(f.sayi)} tanesi son güne kaldı.`,
      (f, h) => `Son gün teslim oranın ${h.pct(f.oran)}; ödevin tamamını tek güne sığdırmak yorucu olabilir.`,
      (f, h) => `${h.cap(h.n(f.sayi, "ödev"))} son gün tamamlandı (toplam ${h.n(f.toplam, "çok günlük ödev")}).`,
      (f, h) => `Çok günlük ödevlerde çalışmanın çoğu son güne toplanıyor (${h.pct(f.oran)}).`,
    ],
    oneri: [
      () => "Çok günlük ödevin ilk gününde en az üçte birini bitir.",
      () => "Ödevin ortasına bir ara durak koy: yarısı o güne kadar bitmiş olsun.",
      () => "Ödev gelir gelmez 10 dakikalık bir başlangıç yap; başlamak en zor kısmıdır.",
      () => "Bu hafta çok günlük ödevlerini gün gün böl ve her günün sonunda kısa bir not düş.",
      () => "Son günü yalnızca kontrol ve tamamlama için ayır.",
    ],
  },

  // ---------------------------------------------------------------- kısmi giriş (beklenenden az soru)
  "gelisim.kismi": {
    alan: [
      () => "Ödevin tamamını kaydetmek",
      () => "Beklenen soru sayısına ulaşmak",
      () => "Ödevleri tam kapatmak",
      () => "Tüm soruları kayda geçirmek",
      () => "Ödevde son soruya kadar",
    ],
    kanit: [
      (f, h) => `${h.n(f.toplam, "ödevinin")} ${h.int(f.sayi)} tanesinde beklenenden az soru girdin.`,
      (f, h) => `Örneğin ${f.ornek.ders} ödevinde ${h.int(f.ornek.beklenen)} sorunun ${h.int(f.ornek.Q)} tanesini girdin.`,
      (f, h) => `Bazı ödevlerde girdiğin soru sayısı beklenenin altında kaldı (${h.int(f.sayi)}/${h.int(f.toplam)}).`,
      (f, h) => `${f.ornek.ders} ödevinde ${h.n(f.ornek.beklenen, "sorudan")} ${h.int(f.ornek.Q)} tanesi kayda geçti.`,
      (f, h) => `Yarım girilen ödevler raporunu olduğundan farklı gösterebilir: ${h.n(f.sayi, "ödev")} bu durumda.`,
    ],
    oneri: [
      () => "Ödevin tamamını çözemediysen çözebildiğin kadarını gir ve notuna kısaca nedenini yaz.",
      () => "Sonuç girerken doğru, yanlış ve boşun toplamının ödevdeki soru sayısını tuttuğunu kontrol et.",
      () => "Çözmediğin soruları boş olarak gir; böylece raporun gerçeği gösterir.",
      () => "Bu hafta her ödevi son soruya kadar tamamlamayı hedefle.",
      () => "Ödev fazla uzun geliyorsa koçuna söyle; soru sayısı birlikte ayarlanabilir.",
    ],
  },

  // ---------------------------------------------------------------- yanlış/boş soru numaraları
  "gelisim.numara": {
    alan: [
      () => "Yanlış ve boş numaralarını girmek",
      () => "Kendi tekrar listeni oluşturmak",
      () => "Yanlışlardan öğrenmek",
      () => "Soru numarası alışkanlığı",
      () => "Tekrar listesini beslemek",
    ],
    kanit: [
      (f, h) => (numaraYok(f)
        ? `Yanlış ya da boşu olan ${h.n(f.sayi, "kaydında")} henüz soru numarası yok.`
        : `Yanlış ya da boşu olan ${h.n(f.sayi, "kaydının")} ${h.pct(f.oran)} kadarında soru numarası var.`),
      (f, h) => `Soru numaraları girilmediği için tekrar listen oluşamıyor (${h.n(f.sayi, "kayıt")}).`,
      (f, h) => `${h.cap(h.n(f.sayi, "kayıtta"))} yanlış ya da boş var ama numaraları çoğunlukla girilmemiş.`,
      (f, h) => (numaraYok(f)
        ? "Yanlış ve boş numaraları, en değerli tekrar kaynağın olabilir; şu an hiçbir kayıtta yok."
        : `Numara girilen kayıtların oranı ${h.pct(f.oran)}; bu listeler en değerli tekrar kaynağın olabilir.`),
      (f, h) => `Yanlış ve boşların numarası olmadan hangi soruya döneceğini bulmak zorlaşıyor (${numaraYok(f) ? "henüz numara girilmemiş" : `${h.pct(f.oran)} kayıtta numara var`}).`,
    ],
    oneri: [
      () => "Sonuç girerken yanlış ve boş soruların numaralarını da işaretle; tekrar listen kendiliğinden oluşur.",
      () => "Bu hafta her kayıtta yanlış ve boş numaralarını gir, hafta sonunda o sorulara geri dön.",
      () => "Numaralarını girdiğin sorulardan her hafta 10 tanesini yeniden çöz.",
      () => "Yanlış numaralarını girmek birkaç saniye sürer ama hangi soruya döneceğini hep bilirsin.",
      () => "Kitabında yanlışlarını işaretle ve aynı numaraları sonuç ekranına da gir.",
    ],
  },

  // ---------------------------------------------------------------- ödev dışı çalışma yok
  "gelisim.serbestYok": {
    alan: [
      () => "Ödev dışında kendi çalışman",
      () => "Serbest çalışmaya yer açmak",
      () => "Kendi hedefini koymak",
      () => "Ödevlerin ötesine geçmek",
      () => "Haftada bir serbest oturum",
    ],
    kanit: [
      (f, h) => `Ödevlerinde teslim oranın ${h.pct(f.teslim)}; son üç haftada ödev dışı kaydın ise yok.`,
      (f, h) => `Ödev düzenin çok iyi (${h.pct(f.teslim)}); son üç haftada serbest çalışma kaydın bulunmuyor.`,
      (f, h) => `Son üç haftadaki tüm kayıtların ödevlerden geliyor; teslim oranın ${h.pct(f.teslim)}.`,
      (f, h) => `Ödevleri aksatmıyorsun (${h.pct(f.teslim)}); kendi seçtiğin bir konuyla bu düzeni bir adım öteye taşıyabilirsin.`,
      (f, h) => `Teslim oranın ${h.pct(f.teslim)} ile ödev tarafı sağlam; serbest çalışma tarafında son üç haftada kayıt yok.`,
    ],
    oneri: [
      (f) => (f.odakDers
        ? `Haftada bir gün ${f.odakDers} dersinden 20 soruluk bir serbest set ekle.`
        : "Haftada bir gün kendi seçtiğin bir dersten 20 soruluk bir serbest set ekle."),
      () => "Serbest çalışmanı Çalışma ekle ekranından kaydet; raporun onu da hesaba katar.",
      (f) => (f.odakDers
        ? `Serbest çalışmayı ${f.odakDers} dersine ayırırsan net kazancın en hızlı orada olur.`
        : "Serbest çalışmayı en çok gelişebileceğin derse ayırırsan kazancın en hızlı orada olur."),
      () => "Hafta sonuna 30 dakikalık bir serbest çalışma oturumu koy.",
      () => "Ödevlerini bitirdiğin günlerde 10 soruluk kısa bir ek set dene.",
    ],
  },

  // ---------------------------------------------------------------- serbest çalışma güçlü derslere yığılıyor
  "gelisim.serbestDagilim": {
    alan: [
      () => "Serbest çalışmayı odak derse yöneltmek",
      (f) => `${f.odakDers} dersine serbest zaman`,
      () => "Serbest çalışmada denge",
      () => "Çalışma zamanını fırsat alanına ayırmak",
      (f) => `${f.odakDers}: serbest setlerle ilerlemek`,
    ],
    kanit: [
      (f, h) => `Serbest çalışmanın ${h.pct(f.gucluPay)} kadarı güçlü derslerine gidiyor, ${f.odakDers} dersine ise ${h.pct(f.odakPay)}.`,
      (f, h) => `${h.n(f.serbestSoru, "serbest sorunun")} çoğu ${f.gucluDers} dersinde; ${f.odakDers} dersinin payı ${h.pct(f.odakPay)}.`,
      (f) => `Serbest çalışmada ${f.gucluDers} dersini tercih ediyorsun; ${f.odakDers} dersi ise daha çok zaman bekliyor.`,
      (f, h) => `${f.odakDers} dersine giden serbest çalışma payı ${h.pct(f.odakPay)}.`,
      (f, h) => `Güçlü derslerin serbest çalışmanın ${h.pct(f.gucluPay)} kadarını alıyor.`,
    ],
    oneri: [
      (f) => `Serbest setlerinin yarısını ${f.odakDers} dersine ayır.`,
      (f) => `Bu hafta serbest çalışmaya ${f.odakDers} dersinden başla, ${f.gucluDers} dersini sona bırak.`,
      (f) => `${f.gucluDers} dersini korumak için haftada bir set yeter; gerisini ${f.odakDers} dersine ver.`,
      (f) => `Her serbest oturumu ${f.odakDers} dersinden 10 soruyla aç.`,
      (f) => `${f.odakDers} dersinde en çok gelişebileceğin konuyu seç ve serbest setlerini ona ayır.`,
    ],
  },
};
