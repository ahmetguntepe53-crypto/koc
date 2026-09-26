// Özet bölümü kalıp bankası — her kalıp TEK cümle döner (bkz. ../catalog.js olgu alanları, ../text.js yardımcılar h).

// ------------------------------------------------------------------ Açılış yardımcıları
// Teslim dışında pas geçilen ödev var mı (ele alınan oran teslimden belirgin yüksek mi)?
const pasVar = (f) => f.eleAlinanPct != null && f.teslimPct != null && Math.round(f.eleAlinanPct) > Math.round(f.teslimPct);
// Vadesi gelen ödev yoksa teslim oranı anlamsızdır (motor bu durumda teslimPct = 0 gönderir); o cümlecik atlanır.
const odevVar = (f) => f.V > 0;
const hepsi = (f) => f.V > 0 && f.teslim >= f.V;
const hicbiri = (f) => f.V > 0 && !(f.teslim > 0);
// Edilgen: "vadesi gelen 18 ödevden 16 tanesi teslim edildi" / "... 10 ödevin tamamı ..." / "... hiçbirinde teslim kaydı yok".
const teslimEdilgen = (f, h) => (!odevVar(f) ? "vadesi gelen ödev bulunmuyordu"
  : hepsi(f) ? (f.V === 1 ? "vadesi gelen tek ödev teslim edildi" : `vadesi gelen ${h.n(f.V, "ödevin")} tamamı teslim edildi`)
  : hicbiri(f) ? (f.V === 1 ? "vadesi gelen tek ödevde teslim kaydı yok" : `vadesi gelen ${h.n(f.V, "ödevin")} hiçbirinde teslim kaydı yok`)
  : `vadesi gelen ${h.n(f.V, "ödevden")} ${h.int(f.teslim)} tanesi teslim edildi`);
// Etken (öznesi öğrenci): "vadesi gelen 18 ödevin 16 tanesini teslim etti".
const teslimEtken = (f, h) => (hepsi(f) ? (f.V === 1 ? "vadesi gelen tek ödevi teslim etti" : `vadesi gelen ${h.n(f.V, "ödevin")} tamamını teslim etti`)
  : hicbiri(f) ? (f.V === 1 ? "vadesi gelen tek ödev için ise teslim kaydı görünmüyor" : `vadesi gelen ${h.n(f.V, "ödev")} için ise teslim kaydı görünmüyor`)
  : `vadesi gelen ${h.n(f.V, "ödevin")} ${h.int(f.teslim)} tanesini teslim etti`);
// Rakam dizisi için kısa biçim: "18 ödevden 16 teslim".
const teslimKisa = (f, h) => (hepsi(f) ? (f.V === 1 ? "1 ödevden 1 teslim" : `${h.n(f.V, "ödevin")} tamamı teslim`)
  : hicbiri(f) ? `${h.n(f.V, "ödevde")} teslim kaydı yok`
  : `${h.n(f.V, "ödevden")} ${h.int(f.teslim)} teslim`);
// Az veri: "2 kayıt ve 45 soru" (soru yoksa yalnızca kayıt), kayıt yoksa null.
const azVeri = (f, h) => (f.kayit > 0 ? (f.Q > 0 ? `${h.n(f.kayit, "kayıt")} ve ${h.int(f.Q)} soru` : h.n(f.kayit, "kayıt")) : null);

// ------------------------------------------------------------------ Güçlü ders
// Okul ödevlerindeki medyan yüzdeliğe göre kısa konum ifadesi (null ya da 50 altıysa yok).
const okulKonum = (p) => (p == null ? null : p >= 75 ? "üst çeyrekte" : p >= 50 ? "ortancanın üzerinde" : null);

// ------------------------------------------------------------------ Ay içi hareket
// Puan farkı ekranda görünen yuvarlanmış yüzdelerden hesaplanır (%53 → %61 ise "8 puan"), metinle sayılar hep tutarlı kalır.
const fark = (f) => Math.abs(Math.round(f.b) - Math.round(f.a));

// ------------------------------------------------------------------ Soru hacmi
// Soru hacmi değişiminin yönü (±2 puan içi "flat").
const hacimYon = (f) => {
  const r = Math.round(f.degisimPct ?? 0);
  return r > 2 ? "up" : r < -2 ? "down" : "flat";
};
const hacimPct = (f, h) => h.pct(Math.abs(f.degisimPct ?? 0));

// ------------------------------------------------------------------ Genel durum (neden listeleri)
// Nedenler "TYT Biyoloji: konu pası" ya da "3 sessiz ödev (14 gün)" gibi iki nokta/parantez içerebilir:
// iki nokta varsa liste tire ile, parantez varsa parantezsiz bağlanır. Boş dizi için her kalıbın kendi yedeği var.
const liste = (f) => (Array.isArray(f.nedenler) ? f.nedenler : []).filter(Boolean);
const SAYI_AD = ["Hiç", "Tek bir", "İki", "Üç", "Dört", "Beş", "Altı"];
const sayiAd = (n, h) => SAYI_AD[n] || h.int(n);
const ayrac = (metin) => (metin.includes(":") ? " — " : ": ");
const sar = (metin) => (/[()]/.test(metin) || metin.includes(":") ? ` — ${metin}` : ` (${metin})`);
const araya = (metin) => (/[()]/.test(metin) ? ` — ${metin} —` : ` (${metin})`);
const sonList = (f, h) => { const m = h.list(liste(f)); return `${ayrac(m)}${m}`; };

// ------------------------------------------------------------------ Çok aylık seyir
// Değerler, uçlar arası fark, en düşük/en yüksek ve bir önceki ay — farklar yuvarlanmış yüzdelerden (metinle tutarlı).
const seyir = (f) => {
  const ham = Array.isArray(f.degerler) ? f.degerler.filter((v) => v != null) : [];
  const vals = ham.length >= 2 ? ham : [f.ilk.NO, f.son.NO];
  const r = vals.map((v) => Math.round(v));
  return {
    vals, d: Math.round(f.son.NO) - Math.round(f.ilk.NO), min: Math.min(...r), max: Math.max(...r),
    onceki: vals[vals.length - 2],
  };
};
// Dalgalı seyirde ara aylardaki uç: iki uçtan da düşük bir dip ya da iki uçtan da yüksek bir tepe.
const araUc = (f) => {
  const ara = seyir(f).vals.slice(1, -1);
  if (!ara.length) return null;
  const lo = Math.min(...ara), hi = Math.max(...ara);
  if (Math.round(lo) < Math.min(Math.round(f.ilk.NO), Math.round(f.son.NO))) return { tip: "dip", deger: lo };
  if (Math.round(hi) > Math.max(Math.round(f.ilk.NO), Math.round(f.son.NO))) return { tip: "tepe", deger: hi };
  return null;
};

// ------------------------------------------------------------------ Çalışma ritmi
// Hafta sonu payı tipi (dengeli dağılımda hafta sonu ≈ %29) ve gün ifadeleri ("Salı ve Perşembe günleri" / "Pazar günü").
const ritimTip = (f) => (f.haftaSonuPay >= 40 ? "yuksek" : f.haftaSonuPay <= 15 ? "dusuk" : "denge");
const gunList = (f) => (f.gunler || []).filter(Boolean);
const gunAd = (f, h) => { const g = gunList(f); return g.length ? (g.length > 1 ? `${h.list(g)} günleri` : `${g[0]} günü`) : null; };
const gunDe = (f, h) => { const g = gunList(f); return g.length ? (g.length > 1 ? `${h.list(g)} günlerinde` : `${g[0]} gününde`) : null; };
const gunKelime = (f) => (gunList(f).length > 1 ? "günler" : "gün");

export default {
  // ------------------------------------------------------------------ Açılış
  "ozet.acilis": [
    (f, h) => `${f.ay.ayinda} ${teslimEdilgen(f, h)}; toplam ${h.int(f.Q)} soru ${f.aktifGun > 1 ? `${h.n(f.aktifGun, "farklı güne")} yayıldı` : "çözüldü"}.`,
    (f, h) => `Öğrenci ${f.ay.de} ${h.int(f.gunSayisi)} günün ${h.int(f.aktifGun)} gününde çalışma kaydı girdi ve ${h.int(f.Q)} soru çözdü${odevVar(f) ? `; ödev teslim oranı ${h.pct(f.teslimPct)} oldu` : ""}.`,
    (f, h) => (hicbiri(f)
      ? `${f.ay.ayinda} ${teslimEdilgen(f, h)}; ay boyunca çözülen soru sayısı ${h.int(f.Q)}.`
      : odevVar(f)
      ? `Ödevlerde teslim oranı ${f.ay.ayinda} ${h.pct(f.teslimPct)} olarak gerçekleşti${pasVar(f) ? `, pas geçilenlerle birlikte ele alınan oran ise ${h.pct(f.eleAlinanPct)}` : ""}; ay boyunca çözülen soru sayısı ${h.int(f.Q)}.`
      : `Vadesi gelen ödev olmadığından teslim oranı hesaplanmadı; ${f.ay.ayinda} çözülen soru sayısı ${h.int(f.Q)}.`),
    (f, h) => `Rakamlarla ${f.ay.ad}: ${h.list([`${h.int(f.Q)} soru`, h.n(f.kayit, "kayıt"), h.n(f.aktifGun, "aktif gün"), odevVar(f) ? teslimKisa(f, h) : null])}.`,
    (f, h) => `Bu değerlendirme ${f.ay.ayi} boyunca girilen ${h.n(f.kayit, "kayda")} dayanıyor: öğrenci ${h.int(f.Q)} soru çözdü${odevVar(f) ? `, ${teslimEtken(f, h)}` : ""}.`,
    (f, h) => `${h.int(f.gunSayisi)} günlük ${f.ay.ad} ayının ${h.n(f.aktifGun, "günü")} aktif geçti; bu sürede ${h.int(f.Q)} soru çözüldü${odevVar(f) ? ` ve teslim oranı ${h.pct(f.teslimPct)} oldu` : ""}.`,
    (f, h) => {
      if (!odevVar(f)) return `Vadesi dolan ödev olmadığından ${f.ay.ad} ayının resmini çalışma kayıtları çiziyor: ${h.int(f.Q)} soru ve ${h.n(f.aktifGun, "aktif gün")}.`;
      const t = f.teslimPct ?? 0;
      const giris = t >= 85 ? "Teslim disiplini güçlü" : t >= 65 ? "Teslimler büyük ölçüde düzenli" : "Teslim tarafında toparlanma fırsatı var";
      return `${giris}: ${f.ay.ayinda} ${teslimEdilgen(f, h)}, toplam ${h.int(f.Q)} soru çözüldü.`;
    },
    (f, h) => {
      const odev = !odevVar(f) ? "vadesi gelen ödev yoktu"
        : hepsi(f) ? (f.V === 1 ? "vadesi gelen tek ödev de teslim edildi" : `vadesi gelen ${h.n(f.V, "ödevin")} hepsi de teslim edildi`)
        : hicbiri(f) ? (f.V === 1 ? "vadesi gelen tek ödevde ise teslim kaydı görünmüyor" : `vadesi gelen ${h.n(f.V, "ödevde")} ise teslim kaydı görünmüyor`)
        : `teslim edilen ödevlerin oranı ${h.pct(f.teslimPct)}`;
      return `${f.ay.ad} boyunca ${h.n(f.kayit, "kayıt")} girildi ve ${h.int(f.Q)} soru çözüldü; ${odev}.`;
    },
  ],

  "ozet.acilisAz": [
    (f, h) => (azVeri(f, h)
      ? `${f.ay.ayinda} şimdilik ${azVeri(f, h)} bulunduğundan değerlendirme sınırlı bir veriye dayanıyor.`
      : `${f.ay.ayinda} henüz kayıt bulunmadığından değerlendirme veriler geldikçe şekillenecek.`),
    (f, h) => `Rapor henüz oluşma aşamasında: ${azVeri(f, h)
      ? `${f.ay.ayinda} şimdiye dek ${azVeri(f, h)} girildi; eğilimlerin belirmesi için birkaç haftalık veri gerekiyor`
      : `${f.ay.ayinda} henüz kayıt girilmedi; eğilimleri görmek için birkaç haftalık veri gerekiyor`}.`,
    (f, h) => `Veri henüz az olduğundan bu metin ${f.ay.ad} için bir ön değerlendirme niteliğinde (${azVeri(f, h) || "kayıt yok"}).`,
    (f, h) => (azVeri(f, h)
      ? `${h.cap(azVeri(f, h))}, ${f.ay.ad} için sağlam bir yorum yapmaya henüz yetmiyor; ilk eğilimler kayıtlar arttıkça belirginleşir.`
      : `Henüz kayıt olmadığı için ${f.ay.ad} hakkında yorum yapmak erken; ilk kayıtlar geldikçe tablo oluşacak.`),
    (f, h) => `Kayıtlar biriktikçe tablo netleşecek: ${f.ay.ayinda} şu ana kadar ${f.kayit > 0
      ? (f.Q > 0 ? `${h.n(f.kayit, "kayıtta")} ${h.int(f.Q)} soru var` : `${h.n(f.kayit, "kayıt")} var`)
      : "kayıt yok"}.`,
    (f, h) => (azVeri(f, h)
      ? `Öğrencinin ${f.ay.ad} ayındaki kayıtları henüz birikme aşamasında (${azVeri(f, h)}); bu nedenle aşağıdaki yorumları ön bulgu olarak okuyun.`
      : `Öğrencinin ${f.ay.ayinda} henüz kaydı bulunmuyor; bu hafta ilk kaydı birlikte girmek iyi bir başlangıç olabilir.`),
    (f, h) => `Anlamlı bir değerlendirme için daha fazla kayda ihtiyaç var; ${f.ay.ayinda} ${f.kayit > 0 ? `şimdilik ${h.n(f.kayit, "kayıt")} bulunuyor` : "henüz kayıt yok"}.`,
  ],

  // ------------------------------------------------------------------ Güçlü ve odak ders
  "ozet.guclu": [
    (f, h) => `En sağlam alan ${f.ders}: net oranı ${h.pct(f.NO)} düzeyinde${okulKonum(f.pTilde) ? `, okul ödevlerindeki medyan yüzdelik ise ${h.int(f.pTilde)}` : ""}.`,
    (f, h) => `Net oranı ${h.pct(f.NO)} olan ${f.ders}, öğrencinin bu ayki en güçlü dersi${okulKonum(f.pTilde) ? `; okul ödevlerinde de aynı ödevi çözenler arasında ${okulKonum(f.pTilde)}` : ""}.`,
    (f, h) => `Öğrencinin en rahat ilerlediği ders ${f.ders}: net oranı ${h.pct(f.NO)}${okulKonum(f.pTilde) ? `, okul ödevlerindeki medyan yüzdeliği ${h.int(f.pTilde)}` : ""}.`,
    (f, h) => `Güçlü tarafta ${f.ders} öne çıkıyor (net oranı ${h.pct(f.NO)})${okulKonum(f.pTilde) ? `; öğrenci aynı ödevi çözen okul arkadaşları arasında da ${okulKonum(f.pTilde)}` : ""}.`,
    (f, h) => `Bu ayın güç alanı ${f.ders}: ${h.pct(f.NO)} net oranı, zorluğu kademeli artırmak için sağlam bir zemin sunuyor.`,
    (f, h) => `${h.cap(f.ders)} dersinde tablo güven veriyor; ${h.pct(f.NO)} net oranı korunması gereken bir birikim${okulKonum(f.pTilde) ? `, okul ödevlerinde ${okulKonum(f.pTilde)} olması da bunu destekliyor` : ""}.`,
    (f, h) => `Görüşmeyi olumlu bir yerden açmak için ${f.ders} iyi bir örnek: net oranı ${h.pct(f.NO)}${okulKonum(f.pTilde) ? `, okul ödevlerinde de ${okulKonum(f.pTilde)}` : ""}.`,
  ],

  "ozet.odak": [
    (f, h) => `En çok net kazanım fırsatı ${f.ders} dersinde (net oranı ${h.pct(f.NO)})${f.konu ? `; ilk durak ${h.q(f.konu)} konusu olabilir` : ""}.`,
    (f, h) => `Odak ders ${f.ders}: net oranı ${h.pct(f.NO)} düzeyinde${f.konu ? `, en düşük sonuç ${h.q(f.konu)} konusunda` : ""}.`,
    (f, h) => `Önümüzdeki haftaların ana çalışma alanı ${f.ders} (net oranı ${h.pct(f.NO)})${f.konu ? `; başlangıç noktası olarak ${h.q(f.konu)} konusu öne çıkıyor` : ""}.`,
    (f, h) => `Emeğin en çok karşılık bulacağı yer ${f.ders}${f.konu ? `, özellikle ${h.q(f.konu)} konusu` : ""}; şu an net oranı ${h.pct(f.NO)}.`,
    (f, h) => `${h.cap(f.ders)} dersine ${f.konu ? `${h.q(f.konu)} konusundan başlayarak ` : ""}ağırlık vermek, önümüzdeki dönemin en verimli adımı görünüyor (net oranı ${h.pct(f.NO)}).`,
    (f, h) => `${h.pct(f.NO)} net oranıyla ${f.ders}, gelişim alanları arasında ilk sırada${f.konu ? `; en düşük sonuç veren konu ise ${h.q(f.konu)}` : ""}.`,
    (f, h) => `Önceliği ${f.ders} dersine vermek yerinde olur; net oranı ${h.pct(f.NO)} olduğundan kazanım payı en geniş bu derste${f.konu ? `, ilk hedef ise ${h.q(f.konu)} konusu` : ""}.`,
  ],

  // ------------------------------------------------------------------ Ay içi hareket (son 4 hafta / önceki 4 hafta)
  "ozet.yukselis": [
    (f, h) => `${h.cap(f.ders)} dersinde net oranı, önceki dört haftadaki ${h.pct(f.a)} düzeyinden son dört haftada ${h.pct(f.b)} düzeyine çıktı.`,
    (f, h) => `Ay içinde belirgin bir yükseliş ${f.ders} dersinde görülüyor: önceki dört haftaya göre ${h.int(fark(f))} puanlık artışla net oranı ${h.pct(f.b)} oldu.`,
    (f, h) => `Önceki dört haftada ${h.pct(f.a)} olan ${f.ders} net oranı, son dört haftada ${h.pct(f.b)} düzeyine yükseldi.`,
    (f, h) => `Olumlu bir hareket ${f.ders} tarafında: son dört haftada net oranı ${h.int(fark(f))} puan artarak ${h.pct(f.b)} düzeyine ulaştı.`,
    (f, h) => `${h.int(fark(f))} puanlık artış dikkat çekici: ${f.ders} dersinde net oranı son dört haftada ${h.pct(f.b)} oldu (önceki dört hafta ${h.pct(f.a)}).`,
    (f, h) => `Çalışmanın karşılığı ${f.ders} dersinde görünür hâle geldi; son dört haftalık dönemde net oranı ${h.int(fark(f))} puan yükselerek ${h.pct(f.b)} oldu.`,
    (f, h) => `Bu ivmeyi korumak öncelikli, çünkü ${f.ders} dersinde yukarı yönlü bir eğilim var (${h.pct(f.a)} → ${h.pct(f.b)}).`,
  ],

  "ozet.dusus": [
    (f, h) => `${h.cap(f.ders)} dersinde son dört haftada net oranı ${h.pct(f.a)} düzeyinden ${h.pct(f.b)} düzeyine indi; nedenini öğrenciyle birlikte anlamakta yarar var.`,
    (f, h) => `İzlenmesi gereken bir değişim ${f.ders} dersinde: net oranı önceki dört haftaya göre ${h.int(fark(f))} puan düşerek ${h.pct(f.b)} oldu.`,
    (f, h) => `Önceki dört haftada ${h.pct(f.a)} olan ${f.ders} net oranı son dört haftada ${h.pct(f.b)} düzeyinde; bu fark yeni bir konuya geçişten de kaynaklanıyor olabilir.`,
    (f, h) => `Son dört haftada ${f.ders} tarafında bir gerileme görülüyor; net oranı ${h.int(fark(f))} puan azalarak ${h.pct(f.b)} düzeyine indi.`,
    (f, h) => `Tek başına alarm sayılmaz ama ${f.ders} dersinde net oranı ${h.pct(f.b)} düzeyine indi (önceki dört hafta ${h.pct(f.a)}); önümüzdeki iki hafta yakından izlenmeli.`,
    (f, h) => `${h.int(fark(f))} puanlık bir düşüş, ${f.ders} dersini bu ayın dikkat başlıklarından biri yapıyor (${h.pct(f.a)} → ${h.pct(f.b)}).`,
    (f, h) => `Dönemsel bir dalgalanma olabilir: ${f.ders} dersinde net oranı ${h.pct(f.a)} düzeyinden ${h.pct(f.b)} düzeyine düştü; yük ya da konu değişimi görüşmede sorulabilir.`,
  ],

  // ------------------------------------------------------------------ Soru hacmi (önceki aya göre)
  "ozet.hacim": [
    (f, h) => {
      const y = hacimYon(f);
      return y === "flat"
        ? `Çözülen soru sayısı ${f.onceki.e} göre hemen hemen aynı kaldı (${h.int(f.oncekiQ)} → ${h.int(f.Q)}).`
        : `Çözülen soru sayısı ${f.onceki.e} göre ${hacimPct(f, h)} ${y === "up" ? "arttı" : "azaldı"} (${h.int(f.oncekiQ)} → ${h.int(f.Q)}).`;
    },
    (f, h) => {
      const y = hacimYon(f);
      return `${f.onceki.ayinda} ${h.int(f.oncekiQ)} olan aylık soru sayısı bu ay ${h.int(f.Q)} oldu; ${y === "flat" ? "yani tempo korunmuş" : `bu, ${hacimPct(f, h)} düzeyinde bir ${y === "up" ? "artış" : "azalma"}`}.`;
    },
    (f, h) => {
      const y = hacimYon(f);
      return `Soru hacmi ${y === "up" ? "yükselişte" : y === "down" ? "düşüşte" : "sabit"}: bu ay ${h.int(f.Q)} soru çözüldü, ${f.onceki.ayinda} bu sayı ${h.int(f.oncekiQ)} idi.`;
    },
    (f, h) => {
      const y = hacimYon(f);
      return y === "flat"
        ? `Önceki aya kıyasla soru sayısında belirgin bir değişim yok: ${h.int(f.oncekiQ)} yerine ${h.int(f.Q)}.`
        : `Önceki aya kıyasla ${hacimPct(f, h)} ${y === "up" ? "daha fazla" : "daha az"} soru çözüldü: ${h.int(f.oncekiQ)} yerine ${h.int(f.Q)}.`;
    },
    (f, h) => {
      const y = hacimYon(f);
      if (y === "flat") return `Bu ay ${h.int(f.Q)} soru çözüldü; ${f.onceki.e} kıyasla tempo korunmuş görünüyor.`;
      return `Bu ay ${h.int(f.Q)} soru çözüldü; ${f.onceki.e} kıyasla ${hacimPct(f, h)} düzeyindeki ${y === "up"
        ? "artış, çalışma temposunun yükseldiğini gösteriyor"
        : "azalma, haftalık yükün dağılımına birlikte bakmayı gerektiriyor"}.`;
    },
    (f, h) => {
      const y = hacimYon(f);
      return `${h.int(f.Q)} soruyla bu ayki hacim, ${f.onceki.ayi} (${h.int(f.oncekiQ)} soru) ile karşılaştırıldığında ${y === "flat"
        ? "neredeyse aynı düzeyde"
        : `${hacimPct(f, h)} ${y === "up" ? "yukarıda" : "aşağıda"}`}.`;
    },
    (f, h) => {
      const y = hacimYon(f);
      if (y === "flat") return `Tempo açısından istikrar var: aylık soru sayısı ${h.int(f.Q)} ile ${f.onceki.ayi} düzeyinde kaldı.`;
      return y === "up"
        ? `Tempo açısından olumlu bir işaret: aylık soru sayısı ${h.int(f.oncekiQ)} düzeyinden ${h.int(f.Q)} düzeyine çıktı.`
        : `Tempo açısından dikkat edilecek bir nokta: aylık soru sayısı ${h.int(f.oncekiQ)} düzeyinden ${h.int(f.Q)} düzeyine indi.`;
    },
  ],

  // ------------------------------------------------------------------ Genel durum
  "ozet.durumIyi": [
    () => "Genel tablo yolunda; oturmuş düzeni korumak ve küçük hedeflerle ilerlemek yeterli görünüyor.",
    () => "Şu an müdahale gerektiren bir durum yok; izleme olağan sıklıkta sürdürülebilir.",
    () => "Öğrencinin gidişatı dengeli, bu dönemde öncelik kazanılmış alışkanlıkları korumak.",
    () => "Belirgin bir risk sinyali görünmüyor; bu ay rutin takip yeterli.",
    () => "Genel durum iyi: planla devam edilmesi, gelişim alanlarına da adım adım dokunulması önerilir.",
    () => "Kaygı verici bir işaret yok; görüşmede kazanımları pekiştirip bir sonraki hedefi birlikte belirleyebilirsiniz.",
    () => "Her şey yolunda görünüyor; bu ayki görüşme kısa bir değerlendirme ve hedef güncellemesiyle sınırlı kalabilir.",
    () => "Tablo sakin ve olumlu; yeni bir müdahale yerine var olan ritmi desteklemek en doğru adım.",
  ],

  "ozet.durumTakip": [
    (f, h) => (liste(f).length
      ? `Genel durum yakın takip gerektiriyor${sar(h.list(liste(f)))}.`
      : "Genel durum yakın takip gerektiriyor; öne çıkan başlıklar görüşmede netleştirilebilir."),
    (f, h) => (liste(f).length
      ? `Acil bir tablo yok, ancak ${liste(f).length > 1 ? "şu başlıklar" : "şu başlık"} önümüzdeki iki hafta izlenmeli${sonList(f, h)}.`
      : "Acil bir tablo yok, ancak önümüzdeki iki hafta kısa kontrollerle izlenmesi önerilir."),
    (f, h) => {
      const n = liste(f).length;
      if (!n) return "Takip listesi şimdilik kısa; bir sonraki görüşmede genel seyre bakılması yeterli.";
      return `Takip listesinde ${n > 1 ? `${h.lower(sayiAd(n, h))} başlık` : "tek bir başlık"} var — ${h.list(liste(f))} — ve bir sonraki görüşmede ${n > 1 ? "bunların" : "bunun"} seyrine bakılması önerilir.`;
    },
    (f, h) => (liste(f).length
      ? `Müdahale düzeyinde bir sorun görünmüyor, fakat kısa aralıklarla kontrol önerilir; ${liste(f).length > 1 ? "gerekçeler" : "gerekçe"}${sonList(f, h)}.`
      : "Müdahale düzeyinde bir sorun görünmüyor, fakat kısa aralıklarla kontrol önerilir."),
    (f, h) => {
      const n = liste(f).length;
      if (!n) return "Bazı işaretler şimdilik yalnızca takip gerektiriyor; haftalık kısa bir kontrol yeterli.";
      return `${sayiAd(n, h)} işaret${araya(h.list(liste(f)))} şimdilik yalnızca takip gerektiriyor; haftalık kısa bir kontrolle ${n > 1 ? "bunların" : "bunun"} seyri izlenebilir.`;
    },
    (f, h) => (liste(f).length
      ? `Bu ayki tabloda yakından izlenmesi gereken ${liste(f).length > 1 ? "konular" : "bir konu"} var${sonList(f, h)}.`
      : "Bu ayki tablo, müdahale gerektirmese de yakından izlenmeyi hak ediyor."),
    (f, h) => (liste(f).length
      ? `Değerlendirme takip düzeyinde; bunu belirleyen ${liste(f).length > 1 ? "başlıklar şunlar" : "başlık şu"}${sonList(f, h)}.`
      : "Değerlendirme takip düzeyinde; önümüzdeki iki haftanın kayıtları yönü belirleyecek."),
  ],

  "ozet.durumMudahale": [
    (f, h) => (liste(f).length
      ? `Bu ay durum müdahale gerektiriyor${sonList(f, h)}.`
      : "Bu ay durum müdahale gerektiriyor; öğrenciyle kısa sürede görüşülmesi önerilir."),
    (f, h) => `Öğrenciyle bu hafta içinde birebir görüşülmesi önerilir${liste(f).length
      ? `; tabloyu belirleyen ${liste(f).length > 1 ? "işaretler şunlar" : "işaret şu"}${sonList(f, h)}`
      : ""}.`,
    (f, h) => {
      const n = liste(f).length;
      if (!n) return "Birden fazla işaret durumu müdahale düzeyine taşıyor; bu hafta öğrenciyle temas kurun.";
      return n > 1
        ? `${sayiAd(n, h)} işaret bir araya gelince durum müdahale düzeyine çıkıyor${sonList(f, h)}.`
        : `Durumu müdahale düzeyine taşıyan işaret${sonList(f, h)}.`;
    },
    (f, h) => `Rutin takibin ötesine geçme zamanı${liste(f).length ? ` — ${h.list(liste(f))}` : ""}; bu hafta öğrenciye doğrudan ulaşın.`,
    (f, h) => `Genel tablo kısa vadeli bir destek planı istiyor${liste(f).length ? sar(h.list(liste(f))) : ""}.`,
    (f, h) => `Öncelikli adım bu hafta öğrenciyle temas kurmak${liste(f).length
      ? `; dikkat çeken ${liste(f).length > 1 ? "noktalar" : "nokta"}${sonList(f, h)}`
      : ""}.`,
    (f, h) => (liste(f).length
      ? `Erken davranmak işi kolaylaştırır; bu hafta ele alınması gereken ${liste(f).length > 1 ? "başlıklar" : "başlık"}${sonList(f, h)}.`
      : "Erken davranmak işi kolaylaştırır; bu hafta kısa bir görüşme planlanması önerilir."),
  ],

  // ------------------------------------------------------------------ Çok aylık seyir
  // Not: test, iki kesme işaretli biçim arasında 60 karakterden kısa metin görürse "yer tutucuya ek" sayar; bu yüzden aynı
  // cümlede ikinci ay "Kasım ayında", "Kasım ayındaki" ya da "bu ay" olarak yazılır, iki kesmeli ay biçimi yan yana gelmez.
  "ozet.seyir": [
    (f, h) => {
      const { min, max } = seyir(f);
      if (f.yon === "up") return `${f.sinav} net oranı ${f.ilk.ay.den} bu yana yükselişte ve ${h.pct(f.ilk.NO)} düzeyinden ${f.son.ay.ayinda} ${h.pct(f.son.NO)} düzeyine çıktı.`;
      if (f.yon === "down") return `${f.sinav} net oranı ${f.ilk.ay.den} bu yana düşüşte ve ${h.pct(f.ilk.NO)} düzeyinden ${f.son.ay.ayinda} ${h.pct(f.son.NO)} düzeyine indi.`;
      if (f.yon === "flat") return `${f.sinav} net oranı ${f.ilk.ay.den} bu yana yatay seyrediyor ve ${f.son.ay.ayinda} ${h.pct(f.son.NO)} düzeyinde.`;
      return `${f.sinav} net oranı ${f.ilk.ay.den} bu yana inişli çıkışlı ilerledi (${h.pct(min)} ile ${h.pct(max)} arasında) ve ${f.son.ay.ayinda} ${h.pct(f.son.NO)} oldu.`;
    },
    (f, h) => {
      const { min, max } = seyir(f);
      const durum = { up: "yukarı yönlü bir eğilim", down: "aşağı yönlü bir eğilim", flat: "yatay bir seyir" }[f.yon] || "dalgalı bir seyir";
      const ek = f.yon === "zigzag" ? `en düşük ${h.pct(min)}, en yüksek ${h.pct(max)}` : `${h.pct(f.ilk.NO)} → ${h.pct(f.son.NO)}`;
      return `${f.ilk.ay.ad}–${f.son.ay.ad} arasındaki ${f.aySayisi} aylık tabloda ${f.sinav} tarafında ${durum} görülüyor (${ek}).`;
    },
    (f, h) => {
      const { d, min, max } = seyir(f);
      const birikimli = f.aySayisi > 2 ? "birikimli " : "";
      if (f.yon === "up") return `${h.abs(d)} puanlık ${birikimli}artış: ${f.sinav} net oranı ${f.ilk.ay.de} ${h.pct(f.ilk.NO)} iken bu ay ${h.pct(f.son.NO)} oldu.`;
      if (f.yon === "down") return `${h.abs(d)} puanlık ${birikimli}düşüş: ${f.sinav} net oranı ${f.ilk.ay.de} ${h.pct(f.ilk.NO)} iken bu ay ${h.pct(f.son.NO)} oldu.`;
      if (f.yon === "flat") {
        return max === min
          ? `Değişim yok denecek kadar az: ${f.sinav} net oranı ${h.n(f.aySayisi, "aydır")} ${h.pct(f.son.NO)} düzeyinde.`
          : `${h.abs(max - min)} puanlık dar bir bant: ${f.sinav} net oranı ${h.n(f.aySayisi, "aydır")} ${h.pct(min)} ile ${h.pct(max)} arasında.`;
      }
      return `${h.abs(max - min)} puanlık bir salınım var: son ${h.n(f.aySayisi, "ayda")} ${f.sinav} net oranı en düşük ${h.pct(min)}, en yüksek ${h.pct(max)} oldu.`;
    },
    (f, h) => {
      const { vals } = seyir(f);
      const kuyruk = {
        up: "gidişin yönü yukarı",
        down: "eğilim aşağı yönlü, nedenleri görüşmede konuşulmalı",
        flat: "tablo durağan, yeni bir hedef bu durağanlığı kırmaya yardımcı olabilir",
      }[f.yon] || "henüz tutarlı bir yön oluşmadı";
      return `Son ${h.n(f.aySayisi, "ayda")} ${f.sinav} net oranı sırasıyla ${h.list(vals.map(h.pct))} oldu; ${kuyruk}.`;
    },
    (f, h) => {
      const { d, min, max } = seyir(f);
      if (f.yon === "up") return `Aydan aya bakıldığında tablo olumlu: ${f.sinav} net oranı ${f.ilk.ay.den} bu yana ${h.abs(d)} puan artarak bu ay ${h.pct(f.son.NO)} düzeyine ulaştı.`;
      if (f.yon === "down") return `Aydan aya bakıldığında tablo dikkat istiyor: ${f.sinav} net oranı ${f.ilk.ay.den} bu yana ${h.abs(d)} puan düşerek bu ay ${h.pct(f.son.NO)} oldu.`;
      if (f.yon === "flat") return `Aydan aya bakıldığında tablo durağan: ${f.sinav} net oranı ${f.ilk.ay.den} bu yana ${h.pct(f.ilk.NO)} civarında seyrediyor, bu ayki değer ${h.pct(f.son.NO)}.`;
      const u = araUc(f);
      const araNot = u ? `ara aylarda ${h.pct(u.deger)} düzeyine kadar ${u.tip === "dip" ? "indi" : "çıktı"}` : `bu süreçte ${h.pct(min)} ile ${h.pct(max)} arasında gidip geldi`;
      return `Aydan aya bakıldığında tablo dalgalı: ${f.sinav} net oranı ${f.ilk.ay.ayinda} ${h.pct(f.ilk.NO)}, bu ay ${h.pct(f.son.NO)}; ${araNot}.`;
    },
    (f, h) => {
      const { d } = seyir(f);
      const cokAy = f.aySayisi > 2;
      const kuyruk = f.yon === "up" ? (cokAy ? "artış aylar boyunca sürdü" : `bir ayda ${h.abs(d)} puanlık artış var`)
        : f.yon === "down" ? (cokAy ? "düşüş aylar boyunca sürdü, nedenlerini görüşmede konuşmak önerilir" : `bir ayda ${h.abs(d)} puanlık düşüş var, nedenini görüşmede konuşmak önerilir`)
        : f.yon === "flat" ? (d ? `aradaki fark ${h.abs(d)} puanla sınırlı` : "iki uç arasında fark yok")
        : araUc(f) ? `arada ${h.pct(araUc(f).deger)} düzeyine ${araUc(f).tip === "dip" ? "inen" : "çıkan"} bir dalgalanma yaşandı`
        : "bu süreçte iniş çıkışlar yaşandı";
      return `${h.cap(f.ilk.ay.de)} ${h.pct(f.ilk.NO)} olan ${f.sinav} net oranı ${f.son.ay.ayinda} ${h.pct(f.son.NO)} düzeyinde; ${kuyruk}.`;
    },
    // Bir önceki ayla kıyas: son adımın yönü + başlangıçtan bu yana toplam değişim.
    (f, h) => {
      const { d, onceki } = seyir(f);
      const ld = Math.round(f.son.NO) - Math.round(onceki);
      const adim = ld > 1 ? `${h.pct(onceki)} düzeyinden ${h.pct(f.son.NO)} düzeyine çıktı`
        : ld < -1 ? `${h.pct(onceki)} düzeyinden ${h.pct(f.son.NO)} düzeyine indi`
        : `neredeyse değişmedi (${h.pct(onceki)} → ${h.pct(f.son.NO)})`;
      if (f.aySayisi <= 2) return `${f.ilk.ay.ad} ayıyla kıyaslandığında ${f.sinav} net oranı ${adim}.`;
      const toplam = d ? `${f.ilk.ay.den} bu yana toplam değişim ${h.signed(d)} puan` : `bu değer ${f.ilk.ay.ad} ayındaki başlangıç düzeyiyle aynı`;
      return `Bir önceki ayla kıyaslandığında ${f.sinav} net oranı ${adim}; ${toplam}.`;
    },
    // Bu ayın, incelenen aylar içindeki yeri (en yüksek / en düşük / aralığın içi); iki ayda yalnızca başlangıca göre konum.
    (f, h) => {
      const { d, min, max } = seyir(f);
      const son = Math.round(f.son.NO);
      const ayS = h.n(f.aySayisi, "ayın");
      if (f.aySayisi <= 2) {
        if (!d) return `${f.sinav} tarafında bu ayki ${h.pct(f.son.NO)}, ${f.ilk.ay.ad} ayındaki değerle aynı.`;
        return `${f.sinav} tarafında bu ayki ${h.pct(f.son.NO)}, ${f.ilk.ay.ad} ayındaki ${h.pct(f.ilk.NO)} düzeyinin ${h.abs(d)} puan ${d > 0 ? "üzerinde" : "altında"}.`;
      }
      if (min === max) return `${f.sinav} tarafında incelenen ${h.n(f.aySayisi, "ayın")} hepsinde net oranı ${h.pct(f.son.NO)} düzeyinde; belirgin bir kırılma yok.`;
      if (f.yon === "flat") {
        const bas = son === Math.round(f.ilk.NO) ? "başlangıçtaki düzeyle aynı" : `başlangıçtaki ${h.pct(f.ilk.NO)} düzeyine çok yakın`;
        return `${f.sinav} tarafında son ${ayS} değerleri ${h.pct(min)} ile ${h.pct(max)} arasında; bu ayki ${h.pct(f.son.NO)} de ${bas}.`;
      }
      if (son === max) {
        return f.yon === "up"
          ? `${f.sinav} tarafında bu ayki ${h.pct(f.son.NO)}, son ${ayS} en yüksek değeri; ${f.ilk.ay.ad} ayındaki ${h.pct(f.ilk.NO)} düzeyinden bu yana istikrarlı bir tırmanış var.`
          : `${f.sinav} tarafında bu ayki ${h.pct(f.son.NO)}, dalgalı geçen son ${ayS} en yüksek değeri; yükselişin kalıcı olup olmadığını önümüzdeki ay gösterecek.`;
      }
      if (son === min) {
        return f.yon === "down"
          ? `${f.sinav} tarafında bu ayki ${h.pct(f.son.NO)}, son ${ayS} en düşük değeri; ${f.ilk.ay.ad} ayındaki ${h.pct(f.ilk.NO)} düzeyinden bu yana düşüş sürüyor.`
          : `${f.sinav} tarafında bu ayki ${h.pct(f.son.NO)}, son ${ayS} en düşük değeri; ${h.pct(max)} düzeyine kadar çıkılmış olması toparlanma payı olduğunu gösteriyor.`;
      }
      return `${f.sinav} tarafında bu ayki ${h.pct(f.son.NO)}, son ${h.n(f.aySayisi, "ayda")} görülen ${h.pct(min)} ile ${h.pct(max)} arasındaki aralığın içinde kalıyor.`;
    },
  ],

  // ------------------------------------------------------------------ Çalışma ritmi
  "ozet.ritim": [
    (f, h) => {
      const tip = ritimTip(f);
      const bas = gunDe(f, h) ? `Çalışma en çok ${gunDe(f, h)} yoğunlaşıyor; hafta sonunun` : "Hafta sonunun";
      const son = tip === "yuksek" ? ", yani ağırlık belirgin biçimde hafta sonunda"
        : tip === "dusuk" ? ", yani soruların büyük kısmı hafta içinde çözülüyor"
        : ", bu da dengeli bir dağılım demek";
      return `${bas} toplam sorudaki payı ${h.pct(f.haftaSonuPay)}${son}.`;
    },
    (f, h) => {
      const tip = ritimTip(f);
      if (tip === "yuksek") return `Çalışmanın ağırlığı hafta sonunda (payı ${h.pct(f.haftaSonuPay)}); yükün bir kısmını hafta içine kaydırmak tekrarları aralıklı hâle getirir.`;
      if (tip === "dusuk") return `Öğrenci ağırlıklı olarak hafta içinde çalışıyor, hafta sonunun payı ${h.pct(f.haftaSonuPay)} ile sınırlı; hafta sonu, süre tutulan bir deneme bloğu için uygun bir boşluk.`;
      return `Hafta içi ile hafta sonu arasında dengeli bir dağılım var (hafta sonu payı ${h.pct(f.haftaSonuPay)}); bu ritmin korunması yeterli.`;
    },
    (f, h) => {
      const g = gunList(f);
      return g.length
        ? `Ay boyunca ${h.n(f.aktifGun, "aktif gün")} içinde en yoğun ${gunKelime(f)} ${h.list(g)} oldu; hafta sonu payı ${h.pct(f.haftaSonuPay)} düzeyinde.`
        : `Ay boyunca ${h.n(f.aktifGun, "aktif gün")} kayda geçti; hafta sonu payı ${h.pct(f.haftaSonuPay)} düzeyinde.`;
    },
    (f, h) => {
      const tip = ritimTip(f);
      const g = gunList(f);
      const ne = tip === "yuksek" ? "çalışma büyük ölçüde hafta sonuna toplanıyor"
        : tip === "dusuk" ? "çalışma çoğunlukla hafta içinde yapılıyor"
        : "hafta içi ile hafta sonu arasında makul bir denge var";
      return `Hafta sonu payı ${h.pct(f.haftaSonuPay)}: ${ne}${g.length ? `; en yoğun ${gunKelime(f)} ${h.list(g)}` : ""}.`;
    },
    (f, h) => {
      const tip = ritimTip(f);
      const g = gunList(f);
      if (tip === "yuksek") return `Ritim hafta sonuna dayalı: çözülen soruların ${h.pct(f.haftaSonuPay)} kadarı Cumartesi ve Pazar günlerine düşüyor.`;
      if (tip === "dusuk") return `Ritim hafta içine dayalı: ${g.length ? `${h.list(g)} öne çıkarken ` : ""}hafta sonu payı ${h.pct(f.haftaSonuPay)} düzeyinde kalıyor.`;
      return `Ritim dengeli: ${g.length ? `en yoğun ${gunKelime(f)} ${h.list(g)}, ` : ""}hafta sonu payı ${h.pct(f.haftaSonuPay)} ve ay boyunca ${h.n(f.aktifGun, "aktif gün")} var.`;
    },
    (f, h) => {
      const tip = ritimTip(f);
      if (tip === "yuksek") return `Hafta sonu payı ${h.pct(f.haftaSonuPay)} olduğundan, hafta içine 30–40 dakikalık iki kısa oturum eklemek hem yükü dengeler hem de unutmayı azaltır.`;
      if (tip === "dusuk") return `Hafta sonu çözülen sorular toplamın yalnızca ${h.pct(f.haftaSonuPay)} kadarı; bu boşluk, haftada bir süre tutulan deneme ya da yanlış defteri tekrarı için kullanılabilir.`;
      return `Çalışma haftaya dengeli dağılmış (hafta sonu payı ${h.pct(f.haftaSonuPay)}, ${h.n(f.aktifGun, "aktif gün")}); bu düzeni bozmadan hedefleri küçük adımlarla büyütmek yeterli.`;
    },
    (f, h) => {
      const tip = ritimTip(f);
      const ad = gunAd(f, h);
      const yorum = tip === "yuksek" ? `hafta sonunun ${h.pct(f.haftaSonuPay)} düzeyindeki payı, hafta içinin görece sakin geçtiğine işaret ediyor`
        : tip === "dusuk" ? `hafta sonu payının ${h.pct(f.haftaSonuPay)} olması, hafta sonlarının çoğunlukla çalışma dışında kaldığını gösteriyor`
        : `hafta sonu payı ${h.pct(f.haftaSonuPay)} ile makul bir düzeyde`;
      return ad ? `Haftalık düzende ${ad} öne çıkıyor; ${yorum}.` : `Haftalık düzen açısından ${yorum}.`;
    },
  ],
};
