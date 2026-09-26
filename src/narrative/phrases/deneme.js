// Deneme sınavları kalıp bankası — ozet.deneme, guclu.deneme, gelisim.denemeDers (bkz. ../catalog.js olgu alanları,
// ../text.js yardımcılar h). Deneme neti GERÇEK sınav netidir: cümleler "TYT 78,5 net" gibi net yazar, ödevlerin net
// oranıyla karıştırmaz; puan ya da sıralama tahmini hiçbir kalıpta yok. Sayılar ve adlar eksiz yazılır: ek, arkasındaki
// sabit kelimeye gelir ("78,5 netten", "'X Yayınları' denemesinde", "TYT Matematik bölümünde").

const R2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

// ------------------------------------------------------------------ ozet.deneme
// Bir önceki denemeye göre yön: ilk (bu türün ilk denemesi) · ayni · artis · azalis. Fark 0,01 altı "aynı".
const yon = (f) => (f.fark == null ? "ilk" : R2(f.fark) === 0 ? "ayni" : f.fark > 0 ? "artis" : "azalis");
const fark = (f, h) => h.net(Math.abs(R2(f.fark)));
const degisim = (f, h) => ({
  artis: `bir önceki denemeye göre ${fark(f, h)} net artış var`,
  azalis: `bir önceki denemeye göre ${fark(f, h)} net daha düşük`,
  ayni: "bir önceki denemeyle aynı düzeyde",
  ilk: `bu, kayıtlı ilk ${f.sinav} denemesi`,
})[yon(f)];

// ------------------------------------------------------------------ guclu.deneme
const yukselis = (f) => f.tip === "yukselis";
const seri = (f, h) => (Array.isArray(f.degerler) && f.degerler.length ? f.degerler : [f.ilkNet, f.net]).map((v) => h.net(v)).join(" → ");

// ------------------------------------------------------------------ gelisim.denemeDers
const yanlisAgirlik = (f) => (f.yanlisPay ?? 0) >= 50;

export default {
  "ozet.deneme": [
    (f, h) => `${f.sinav} denemelerinde son sonuç ${h.net(f.net)} net (${f.tarih}); ${degisim(f, h)}.`,
    (f, h) => `Öğrenci ${f.tarih} tarihli ${f.sinav} denemesinde ${h.net(f.net)} net yaptı; ${degisim(f, h)}.`,
    (f, h) => `Deneme tarafında ${f.sayi > 1 ? `ay içinde girilen ${h.n(f.sayi, "denemenin")} sonuncusunda` : "ayın tek denemesinde"} ${f.sinav} toplamı ${h.net(f.net)} net oldu${yon(f) === "ilk" ? "" : `; ${degisim(f, h)}`}.`,
    (f, h) => ({
      artis: `${f.sinav} netleri yukarı yönlü: son denemede ${h.net(f.oncekiNet)} netten ${h.net(f.net)} nete çıkıldı.`,
      azalis: `Son ${f.sinav} denemesinde net ${h.net(f.oncekiNet)} düzeyinden ${h.net(f.net)} düzeyine indi; tek denemelik bir dalgalanma olabilir.`,
      ayni: `Son iki ${f.sinav} denemesinde net ${h.net(f.net)} düzeyinde sabit kaldı.`,
      ilk: `Ay içinde ilk ${f.sinav} denemesi girildi: ${h.net(f.net)} net (${f.tarih}); sonraki denemeler bu değerle karşılaştırılacak.`,
    })[yon(f)],
    (f, h) => `Gerçek sınav koşullarına en yakın ölçü olan denemelerde son ${f.sinav} sonucu ${h.net(f.net)} net; ${degisim(f, h)}.`,
    (f, h) => `Son deneme (${f.ad ? `${h.q(f.ad)}, ${f.tarih}` : f.tarih}) ${f.sinav} genelinde ${h.net(f.net)} netle tamamlandı${
      yon(f) === "artis" ? `, önceki denemeden ${fark(f, h)} net fazla` : yon(f) === "azalis" ? `, önceki denemeden ${fark(f, h)} net az` : yon(f) === "ayni" ? ", önceki denemeyle aynı" : ""}.`,
    (f, h) => `${h.int(f.soru)} soruluk son ${f.sinav} denemesinde ${h.net(f.net)} net çıktı${yon(f) === "ilk" ? "; bu türde ilk kayıt" : `; ${degisim(f, h)}`}.`,
  ],

  "guclu.deneme": [
    (f, h) => (yukselis(f)
      ? `${f.sinav} denemelerinde son üç sonuç art arda yükseldi: ${seri(f, h)} (toplam +${h.net(f.artis)} net).`
      : `${f.sinav} denemelerinde kişisel rekor: ${h.net(f.net)} net; önceki en iyi sonuç ${h.net(f.oncekiEnIyi)} net idi.`),
    (f, h) => (yukselis(f)
      ? `Deneme netlerinde istikrarlı artış var: ${f.sinav} toplamı üç denemede ${h.net(f.ilkNet)} netten ${h.net(f.net)} nete çıktı.`
      : `Son ${f.sinav} denemesindeki ${h.net(f.net)} net, girilen ${h.n(f.sayi, "denemenin")} en yükseği.`),
    (f, h) => (yukselis(f)
      ? `${f.sinav} tarafında emek karşılık buluyor: son üç denemede net ${h.net(f.artis)} arttı ve ${h.net(f.net)} düzeyine ulaştı.`
      : `${f.sinav} denemelerinde yeni bir zirve var: ${h.net(f.net)} net, önceki en iyiden ${h.net(f.artis)} net fazla.`),
    (f, h) => (yukselis(f)
      ? `Art arda üç ${f.sinav} denemesinde yükseliş: son sonuç ${h.net(f.net)} net.`
      : `Öğrenci ${f.sinav} denemelerindeki en iyi sonucunu ${h.net(f.net)} netle elde etti (önceki en iyi ${h.net(f.oncekiEnIyi)} net).`),
    (f, h) => (yukselis(f)
      ? `Denemelerde yön yukarı: ${f.sinav} neti ${h.net(f.ilkNet)} → ${h.net(f.net)} (+${h.net(f.artis)} net).`
      : `Kişisel rekor ${f.sinav} denemesinden geldi: ${h.net(f.net)} net, bugüne kadarki ${h.n(f.sayi, "denemenin")} en yükseği.`),
    (f, h) => (yukselis(f)
      ? `Üç denemedir düşmeyen ${f.sinav} neti ${h.net(f.net)} düzeyine çıktı; düzenli deneme çözmenin karşılığı görülüyor.`
      : `${h.cap(h.n(f.sayi, "denemelik"))} geçmişin en yüksek ${f.sinav} neti bu dönemde geldi: ${h.net(f.net)} net.`),
  ],

  "gelisim.denemeDers": {
    alan: [
      (f) => `${f.ders}: denemede en çok net kaçan ders`,
      (f) => `Deneme fırsatı: ${f.ders}`,
      (f) => `${f.ders} denemelerinde net artırma`,
      (f, h) => `${f.ders}: ${h.int(f.soru)} sorudan daha çok net`,
      (f) => `Denemede kazanım alanı: ${f.ders}`,
      (f) => `${f.ders} bölümünde kaçan netleri toplama`,
    ],
    kanit: [
      (f, h) => `Son ${h.n(f.deneme, "denemede")} ${f.ders} ortalaması ${h.int(f.soru)} soruda ${h.net(f.ortNet)} net; deneme başına ortalama ${h.net(f.kayip)} net kaçıyor.`,
      (f, h) => `${f.ders} bölümünde ${h.int(f.soru)} sorudan ortalama ${h.net(f.ortNet)} net çıkıyor; kaçan ${h.net(f.kayip)} net, denemedeki dersler arasında en yüksek değer.`,
      (f, h) => `Kaçan netin ${h.pct(f.yanlisPay)} kadarı yanlışlardan, geri kalanı boş bırakılan ya da girilmeyen sorulardan geliyor (${f.ders}, son ${h.n(f.deneme, "deneme")}).`,
      (f, h) => `Son denemede ${f.ders} neti ${h.net(f.sonNet)}; ${h.int(f.soru)} soruluk bölümde ortalama ${h.net(f.kayip)} net fırsat bulunuyor.`,
      (f, h) => `Denemelerde ${f.ders} bölümünden ortalama ${h.net(f.yanlisKaybi)} net yanlışlar, ${h.net(f.bosKaybi)} net ise boş ya da girilmeyen sorular yüzünden kaçıyor.`,
      (f, h) => `${f.ders}, soru sayısına göre denemede en çok net kaçan ders: son ${h.n(f.deneme, "denemenin")} ortalaması ${h.net(f.ortNet)} net.`,
    ],
    oneri: [
      (f) => (yanlisAgirlik(f)
        ? `Deneme sonrası ${f.ders} yanlışlarını öğrenciyle birlikte sınıflandırın (bilgi, dikkat, işlem) ve her hata türünün konusuna 15 soruluk bir set verin.`
        : `${f.ders} bölümünde boş kalan soruların konularını son denemeden çıkarın; en sık tekrar eden konuya bu hafta 20 soruluk, kolaydan zora bir set verin.`),
      (f) => `Her denemeden sonra ${f.ders} bölümünü 20 dakikalık bir analizle kapatmasını isteyin: çözülemeyen soruların konusu bir listeye yazılsın.`,
      (f, h) => `Bir sonraki denemeye kadar ${f.ders} için haftada iki kısa oturum planlayın; hedef, ortalamayı ${h.net(f.ortNet)} netin üzerine taşımak olsun.`,
      (f) => `${f.ders} bölümünde süre yönetimine bakın: denemede bu bölüme ne kadar süre ayrıldığını ve hangi soruların sona bırakıldığını öğrenciyle konuşun.`,
      (f) => `Deneme analizini ödeve bağlayın: ${f.ders} denemesinde yanlış ya da boş kalan konulardan biri bu haftanın kişisel ödevi olsun.`,
      (f, h) => `Branş öğretmeniyle ${f.ders} deneme sonuçlarını paylaşın; kaçan ${h.net(f.kayip)} netin hangi konulardan geldiğini birlikte belirleyin.`,
    ],
  },
};
