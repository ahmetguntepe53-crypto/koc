// Güçlü yönler kalıp bankası — sıcak ama olgusal; her madde kanıtını (sayıyı) anar (bkz. ../catalog.js, ../text.js).

const R = (v) => Math.round(Number(v) || 0);
const oran = (a, b) => (b ? (a / b) * 100 : 0);
// İki yüzde yan yana yazıldığında fark, EKRANDAKİ yuvarlanmış değerlerden hesaplanır (%53 → %61 = 8 puan);
// yuvarlama farkı sıfıra düşürürse ham fark kullanılır.
const fark = (a, b, ham) => {
  const d = R(b) - R(a);
  return d > 0 ? d : Math.max(1, Math.abs(R(ham ?? b - a)));
};

// Okul ödevleri yüzdelik dilimi: 75+ üst çeyrek, 50+ üst yarı; 50 altı hiçbir zaman yazılmaz.
const dilim = (p) => (p == null ? null : p >= 75 ? "üst çeyrek" : p >= 50 ? "üst yarı" : null);
const dilimde = (p) => (p == null ? null : p >= 75 ? "üst çeyrekte" : p >= 50 ? "üst yarıda" : null);
const dilimin = (p) => (p == null ? null : p >= 75 ? "üst çeyreğinde" : p >= 50 ? "üst yarısında" : null);
// guclu.okul: yüzdelik 50 altındaysa (olmaması gerekir) sayı yazmadan nötr bir cümle döner.
const okul = (fn) => (f, h) =>
  dilim(f.pTilde)
    ? fn(f, h, dilim(f.pTilde), dilimde(f.pTilde), dilimin(f.pTilde))
    : `${f.ders} dersinde okul ödevleri düzenli olarak karşılaştırmaya giriyor (${h.n(f.n, "ödev")}).`;

// guclu.acikKapaniyor: önceki açık (en az 1 puan yazılır), şimdiki farkın yönü ve ekrandaki değerlerle tutarlı kapanan puan.
const acik0 = (f) => Math.max(1, Math.abs(R(f.f0)));
const f1Yon = (f) => Math.sign(R(f.f1));
const kap = (f) => R(f.f1) + acik0(f);

// guclu.zamaninda: tüm vadeler zamanında mı?
const tam = (f) => f.zamaninda >= f.V;

// guclu.seri: süren seri aynı zamanda en uzun seri mi; değilse rekora kaç hafta var?
const rekorSeri = (f) => f.seri >= f.enUzun;
const kalanSeri = (f) => Math.max(1, f.enUzun - f.seri);

// guclu.konular: tekil/çoğul ve oranlı liste ("'A' (%84) ve 'B' (%79)").
const K = (f, tekil, cogul) => ((f.konular || []).length > 1 ? cogul : tekil);
const konuOran = (f, h) =>
  h.list((f.konular || []).map((k, i) => (f.oranlar?.[i] != null ? `${h.q(k)} (${h.pct(f.oranlar[i])})` : h.q(k))));
// Oranlar yalnızca her konu için varsa sıralı listelenir ("sırasıyla %84 ve %79"); eksikse boş döner.
const oranList = (f, h) => {
  const k = f.konular || [];
  return k.length && k.every((_, i) => f.oranlar?.[i] != null) ? h.list(k.map((_, i) => h.pct(f.oranlar[i]))) : "";
};

// guclu.aktifGun: haftalık ortalama aktif gün (tek ondalık, gereksiz sıfır yok).
const haftalik = (f, h) => h.net(Math.round((f.aktifGun * 70) / (f.gunSayisi || 30)) / 10);

// guclu.seyirYukselis / guclu.seyirDuzen: ekrandaki yüzdelerle tutarlı artış.
const syArt = (f) => fark(f.ilk?.NO, f.son?.NO, f.delta);
const tFark = (f) => fark(f.once?.pct, f.simdi?.pct);

// NOT: Ay nesnelerinin kesme işaretli biçimleri (ay.de, ay.den, ay.e) bir cümlede EN FAZLA BİR KEZ kullanılır;
// ikinci ay için ay.ad / ay.ayinda ("Eylül ayında", "Ağustos ayından") tercih edilir.

export default {
  "guclu.ders": [
    (f, h) =>
      `${f.ders} dersinde ${h.n(f.n, "kayıt")} ve ${h.n(f.Q, "soru")} üzerinden net oranı ${h.pct(f.NO)} düzeyinde${
        dilimde(f.pTilde) ? `; öğrenci okul ödevlerinde de ${dilimde(f.pTilde)} yer alıyor` : ""
      }.`,
    (f, h) =>
      `Net oranı ${h.pct(f.NO)} olan ${f.ders}, bu dönemin güvenilir derslerinden biri; ${h.n(f.Q, "soru")} ve ${h.n(f.n, "kayıt")} bu tabloyu destekliyor.`,
    (f, h) =>
      f.n < 8
        ? `Kayıt sayısı henüz ${h.int(f.n)} olsa da ${f.ders} dersindeki ${h.pct(f.NO)} net oranı, konuların oturmaya başladığını gösteriyor.`
        : `${h.n(f.n, "kayıtlık")} birikimle ${f.ders} dersindeki ${h.pct(f.NO)} net oranı, tesadüf olmayan bir sağlamlığa işaret ediyor.`,
    (f, h) =>
      dilim(f.pTilde)
        ? `Hem kendi kayıtlarındaki ${h.pct(f.NO)} net oranı hem de okul ödevlerindeki ${dilim(f.pTilde)} konumu, ${f.ders} dersini güçlü alanlar arasına yerleştiriyor.`
        : `${f.ders} sağlam bir zemin sunuyor: ${h.n(f.Q, "soruluk")} hacimde net oranı ${h.pct(f.NO)} çizgisinde.`,
    (f, h) =>
      `${h.n(f.Q, "soruluk")} ${f.ders} çalışması ${h.pct(f.NO)} net oranıyla sonuçlandı; bu ders, programda güvenle dayanılabilecek bir alan.`,
    (f, h) =>
      `Veriler ${f.ders} dersinde tutarlı bir güç gösteriyor: ${h.pct(f.NO)} net oranı${
        dilim(f.pTilde) ? `, okul ödevlerinde ${dilim(f.pTilde)} konumu` : ""
      } ve ${h.n(f.Q, "soruluk")} bir hacim.`,
    (f, h) =>
      `Öğrenci ${f.ders} dersinde sağlam bir çizgide: ${h.n(f.n, "kaydın")} toplamında net oranı ${h.pct(f.NO)} düzeyinde${
        dilim(f.pTilde) ? `, okul ödevlerindeki konumu ise ${dilim(f.pTilde)}` : ""
      }.`,
    (f, h) =>
      `Güçlü alanlar arasında ${f.ders} öne çıkıyor; net oranı ${h.pct(f.NO)} olan bu dersi korumak için haftada bir karma tekrar seti yeterli olabilir.`,
  ],

  "guclu.yukselis": [
    (f, h) =>
      `${f.ders} dersinde net oranı son 4 haftada ${h.pct(f.a)} düzeyinden ${h.pct(f.b)} düzeyine çıktı (${h.signed(fark(f.a, f.b, f.delta))} puan).`,
    (f, h) =>
      `Son dört haftanın dikkat çeken sıçraması ${f.ders} dersinde: net oranı ${h.int(fark(f.a, f.b, f.delta))} puan artarak ${h.pct(f.b)} oldu.`,
    (f, h) => `Önceki 4 haftada ${h.pct(f.a)} olan ${f.ders} net oranı, son 4 haftada ${h.pct(f.b)} düzeyine yükseldi.`,
    (f, h) =>
      `${h.int(fark(f.a, f.b, f.delta))} puanlık artış dört haftalık bir süre için azımsanacak gibi değil: ${f.ders} dersinde net oranı ${h.pct(f.a)} düzeyinden ${h.pct(f.b)} düzeyine taşındı.`,
    (f, h) =>
      `${f.ders} dersinde son haftalardaki emek karşılığını buluyor; net oranı önceki döneme göre ${h.int(fark(f.a, f.b, f.delta))} puan artarak ${h.pct(f.b)} düzeyine ulaştı.`,
    (f, h) =>
      `Yükseliş ${f.ders} dersinde açıkça görülüyor: önceki dört haftada ${h.pct(f.a)}, son dört haftada ${h.pct(f.b)}, fark ${h.signed(fark(f.a, f.b, f.delta))} puan.`,
    (f, h) =>
      `Bu ay ${f.ders} dersinde ivme yukarı yönlü; son 4 haftanın net oranı (${h.pct(f.b)}) bir önceki 4 haftanınkini ${h.int(fark(f.a, f.b, f.delta))} puan aşıyor.`,
    (f, h) =>
      `Yakın dönemin olumlu haberlerinden biri ${f.ders}: net oranındaki ${h.int(fark(f.a, f.b, f.delta))} puanlık artışı öğrenciye rakamıyla göstermek, bu ivmeyi korumasına yardımcı olur.`,
  ],

  "guclu.etiket": [
    (f, h) => `${f.ders} dersinin etiketi ${h.q(f.eski)} düzeyinden ${h.q(f.yeni)} düzeyine yükseldi.`,
    (f, h) => `Bu ay ${f.ders} dersinin etiketi yukarı taşındı: ${h.q(f.eski)} yerine artık ${h.q(f.yeni)}.`,
    (f, h) => `Etiket değişimi olumlu yönde: önceki etiketi ${h.q(f.eski)} olan ${f.ders} artık ${h.q(f.yeni)} grubunda.`,
    (f, h) =>
      `${f.ders} dersinde ${h.q(f.eski)} etiketinden ${h.q(f.yeni)} etiketine geçiş, son dönemdeki çalışmanın somut bir karşılığı.`,
    (f, h) =>
      `Öğrenciyle birlikte kutlanacak bir gelişme: ${f.ders} dersinin etiketi ${h.q(f.eski)} düzeyinden ${h.q(f.yeni)} düzeyine çıktı.`,
    (f, h) =>
      `Yükselen etiket: ${f.ders} dersi ${h.q(f.eski)} düzeyinden çıkıp ${
        f.yeni === "Güçlü" ? "güçlü dersler arasına katıldı" : `${h.q(f.yeni)} düzeyine ulaştı`
      }.`,
    (f, h) =>
      `Bu dönemin sevindirici değişimlerinden biri ${f.ders} dersinde yaşandı; etiket ${h.q(f.eski)} yerine ${h.q(f.yeni)} olarak güncellendi.`,
    (f, h) =>
      f.eski === "Odak"
        ? `Odak listesinden bir ders çıktı: ${f.ders} dersinin etiketi artık ${h.q(f.yeni)}.`
        : `Bir basamak yukarı: ${h.q(f.eski)} olan ${f.ders} etiketi bu dönemde ${h.q(f.yeni)} oldu.`,
  ],

  "guclu.okul": [
    okul((f, h, d, dd) =>
      `${f.ders} okul ödevlerinde öğrenci ${dd} yer alıyor: karşılaştırılan ${h.n(f.n, "ödevde")} medyan yüzdelik ${h.int(f.pTilde)}.`),
    okul((f, h, d, dd) =>
      `Aynı ödevi çözen okul arkadaşlarıyla kıyaslandığında öğrenci ${f.ders} dersinde ${dd} (${h.n(f.n, "ödev")}, medyan yüzdelik ${h.int(f.pTilde)}).`),
    okul((f, h) =>
      `Karşılaştırılan ${h.n(f.n, "okul ödevinde")} öğrenci, ${f.ders} dersinde aynı ödevi çözenlerin tipik olarak ${h.pct(f.pTilde)} kadarından yüksek sonuç aldı.`),
    okul((f, h, d, dd) =>
      f.n < 5
        ? `Henüz ${h.n(f.n, "ödevlik")} bir karşılaştırma olsa da öğrencinin ${f.ders} okul ödevlerindeki yeri ${d}.`
        : `${h.n(f.n, "ödevlik")} karşılaştırma, ${f.ders} dersinde öğrenciyi okulda ${dd} gösteriyor.`),
    okul((f, h, d, dd, di) =>
      `Okul içi kıyasta ${f.ders} dersi dikkat çekiyor: öğrenci aynı ödevi çözenlerin ${di} yer alıyor (medyan yüzdelik ${h.int(f.pTilde)}).`),
    okul((f, h) =>
      `${f.ders}, öğrencinin okulda da öne çıktığı derslerden biri; aynı ödevi çözenler arasında medyan yüzdeliği ${h.int(f.pTilde)}.`),
    okul((f, h, d) =>
      `Okuldaki akranlarla kıyasta ${f.ders} dersinde tablo olumlu: ${h.n(f.n, "ödevin")} ortanca yüzdeliği ${h.int(f.pTilde)}, yani ${d} düzeyi.`),
  ],

  "guclu.acikKapaniyor": [
    (f, h) =>
      `${f.ders} dersinde okul medyanıyla arasındaki fark kapanıyor: önceki ${h.int(acik0(f))} puanlık açık ${
        f1Yon(f) < 0 ? `${h.abs(f.f1)} puana indi` : f1Yon(f) > 0 ? `yerini ${h.abs(f.f1)} puanlık bir üstünlüğe bıraktı` : "tamamen kapandı"
      }.`,
    (f, h) =>
      `Medyanla arasındaki fark, ${f.ders} okul ödevlerinde ${h.int(kap(f))} puan öğrencinin lehine değişti; ${
        f1Yon(f) < 0
          ? `medyanın altında kalan açık artık yalnızca ${h.abs(f.f1)} puan`
          : f1Yon(f) > 0
            ? `öğrenci artık medyanın ${h.abs(f.f1)} puan üstünde`
            : "öğrenci artık medyanla aynı düzeyde"
      }.`,
    (f, h) =>
      `${h.int(kap(f))} puanlık bir mesafe kapandı: ${f.ders} dersinde okul medyanına göre fark ${h.signed(-acik0(f))} puandan ${h.signed(f.f1)} puana geldi.`,
    (f, h) =>
      `Aynı ödevi çözenlerle kıyasta öğrenci ${f.ders} dersinde önceden medyanın ${h.int(acik0(f))} puan altındaydı; şimdi ${
        f1Yon(f) < 0 ? `yalnızca ${h.abs(f.f1)} puan altında` : f1Yon(f) > 0 ? `${h.abs(f.f1)} puan üstünde` : "tam medyan düzeyinde"
      }.`,
    (f, h) =>
      `Okul ödevlerindeki ${f.ders} tablosu olumlu yönde değişiyor; ${
        f1Yon(f) < 0
          ? `medyanla arasındaki açığın ${h.int(kap(f))} puanı kapandı`
          : f1Yon(f) > 0
            ? `önceki ${h.int(acik0(f))} puanlık açık kapanmakla kalmadı, öğrenci medyanın üstüne çıktı`
            : `önceki ${h.int(acik0(f))} puanlık açık kapandı ve öğrenci medyanı yakaladı`
      }.`,
    (f, h) =>
      `Yön doğru: ${f.ders} okul ödevlerinde medyana göre fark ${h.int(kap(f))} puan iyileşti${
        f1Yon(f) < 0 ? ` ve kalan açık ${h.abs(f.f1)} puana indi` : f1Yon(f) > 0 ? " ve öğrenci medyanın üstüne geçti" : " ve öğrenci medyan düzeyine geldi"
      }.`,
    (f, h) =>
      `Bu ilerlemeyi öğrenciye rakamıyla göstermek motivasyonu destekler: ${f.ders} dersinde okul medyanına göre fark ${h.int(kap(f))} puan iyileşti.`,
  ],

  "guclu.zamaninda": [
    (f, h) =>
      tam(f)
        ? `Son 28 günde vadesi gelen ${h.n(f.V, "ödevin")} tamamı zamanında teslim edildi.`
        : `Son 28 günde vadesi gelen ${h.n(f.V, "ödevden")} ${h.int(f.zamaninda)} tanesi zamanında teslim edildi.`,
    (f, h) =>
      `Teslim disiplini güçlü: son dört haftada ${h.n(f.V, "ödevin")} ${tam(f) ? "hepsi" : `${h.int(f.zamaninda)} tanesi`} vaktinde geldi.`,
    (f, h) =>
      `${h.pct(oran(f.zamaninda, f.V))} zamanında teslim oranı (${h.int(f.zamaninda)}/${h.int(f.V)}), öğrencinin ödev takvimine sahip çıktığını gösteriyor.`,
    (f, h) =>
      `Öğrenci ödevlerini ${tam(f) ? "eksiksiz biçimde" : "büyük ölçüde"} gününde bitiriyor; son 28 günde teslim tarihi gelen ${h.n(f.V, "ödevin")} ${
        tam(f) ? "tamamı" : `${h.int(f.zamaninda)} tanesi`
      } zamanında kapandı.`,
    (f, h) =>
      `Son dört haftaya bakıldığında ödev takibinde ${
        tam(f)
          ? "aksama görülmüyor; hiçbir ödev gecikmedi"
          : `aksama çok az; ${h.n(f.V, "ödevden")} yalnızca ${h.int(f.V - f.zamaninda)} tanesi zamanında gelmedi`
      }.`,
    (f, h) =>
      `Takvime uyum yüksek: son 28 günde ödevlerin ${tam(f) ? "tamamı" : `${h.pct(oran(f.zamaninda, f.V))} kadarı`} zamanında teslim edildi.`,
    (f, h) =>
      `Teslim takibi için şu an ek bir müdahaleye gerek görünmüyor; vadesi gelen ${
        tam(f) ? `${h.n(f.V, "ödevin")} hepsi` : `${h.n(f.V, "ödevden")} ${h.int(f.zamaninda)} tanesi`
      } gününde teslim edildi.`,
    (f, h) =>
      `Ödevleri gününde teslim etmek bu dönemin oturmuş alışkanlıklarından biri (${h.int(f.zamaninda)}/${h.int(f.V)}); bunu öğrenciye açıkça söylemek düzenin korunmasına yardımcı olur.`,
  ],

  "guclu.seri": [
    (f, h) => `Öğrenci ${h.n(f.seri, "haftadır")} kesintisiz düzende: sessiz kalan ödev yok ve her hafta en az 3 gün aktif.`,
    (f, h) =>
      `Düzen serisi ${h.n(f.seri, "haftaya")} ulaştı${
        rekorSeri(f)
          ? "; bu, şimdiye kadarki en uzun seri"
          : kalanSeri(f) <= 2
            ? ` ve ${h.n(f.enUzun, "haftalık")} en uzun seriye yaklaşıyor`
            : `; en uzun seri ${h.n(f.enUzun, "hafta")}`
      }.`,
    (f, h) =>
      rekorSeri(f)
        ? `Şu an ${h.n(f.seri, "haftalık")} bir düzen serisi sürüyor ve bu, kaydedilen en uzun seri.`
        : kalanSeri(f) <= 3
          ? `Şu an ${h.n(f.seri, "haftalık")} bir düzen serisi sürüyor; en uzun seriye (${h.n(f.enUzun, "hafta")}) ulaşmak için ${h.n(kalanSeri(f), "hafta")} daha gerekiyor.`
          : `Şu an ${h.n(f.seri, "haftalık")} bir düzen serisi sürüyor; en uzun seri ${h.n(f.enUzun, "hafta")}, yani öğrenci bu düzeni daha önce de uzun süre koruyabildi.`,
    (f, h) =>
      `Arka arkaya ${h.n(f.seri, "hafta")} boyunca her ödeve teslim ya da pas ile yanıt verildi ve haftada en az 3 gün çalışıldı.`,
    (f, h) =>
      `${h.n(f.seri, "haftadır")} ödev listesinde sessiz kalan iş yok; üstelik çalışma her hafta en az 3 güne yayılıyor.`,
    (f, h) =>
      `Bu serinin değeri süreklilikte: ${h.n(f.seri, "hafta")} üst üste, sessiz ödev bırakmadan ve haftada en az 3 aktif günle ilerlendi${
        rekorSeri(f) ? "; üstelik bu, bugüne kadarki en uzun seri" : ""
      }.`,
    (f, h) =>
      `Öğrenciye ${h.n(f.seri, "haftalık")} düzen serisinin fark edildiğini söylemek, ${rekorSeri(f) ? "rekor düzeydeki bu seriyi" : "bu seriyi"} korumasına yardımcı olur.`,
  ],

  "guclu.serbest": [
    (f, h) => `Öğrenci ödev dışında kendi isteğiyle ${h.n(f.serbestSoru, "soru")} çözdü; bu, toplam hacmin ${h.pct(f.pay)} kadarı.`,
    (f, h) =>
      `Toplam sorunun ${h.pct(f.pay)} kadarı serbest çalışmadan geliyor (${h.n(f.serbestSoru, "soru")}); öğrenci verilen ödevle yetinmiyor.`,
    (f, h) => `İnisiyatif belirgin: ${h.n(f.serbestSoru, "soru")} hiçbir ödeve bağlı olmadan, öğrencinin kendi seçimiyle çözüldü.`,
    (f, h) =>
      `${h.n(f.serbestSoru, "soruluk")} serbest çalışma, öğrencinin sürecini sahiplendiğini gösteriyor; toplam içindeki payı ${h.pct(f.pay)}.`,
    (f, h) =>
      `Verilen ödevlerin ötesine geçme isteği var: çözülen her 100 sorunun yaklaşık ${h.int(f.pay)} tanesi serbest çalışmadan.`,
    (f, h) =>
      `Serbest çalışma payının ${h.pct(f.pay)} olması, plan dışında da masaya oturulduğunu gösteriyor (${h.n(f.serbestSoru, "soru")}).`,
    (f, h) =>
      `Bu inisiyatifi planla buluşturmak için ödev dışı ${h.n(f.serbestSoru, "sorunun")} hangi derslere gittiğine öğrenciyle birlikte bakılabilir.`,
  ],

  "guclu.rekor": [
    (f, h) =>
      `${f.gun} tarihli ${h.n(f.Q, "soruluk")} ${f.ders} kaydında ${h.net(f.net)} net (${h.pct(f.oran)}) ile kişisel rekor kırıldı.`,
    (f, h) => `Kişisel rekor: ${f.ders} dersinde ${h.n(f.Q, "soruda")} ${h.net(f.net)} net, yani ${h.pct(f.oran)} net oranı (${f.gun}).`,
    (f, h) =>
      `Son 7 günün öne çıkan anı ${f.gun} tarihinde geldi: ${f.ders} dersinde ${h.pct(f.oran)} net oranıyla bugüne kadarki en iyi kayıt.`,
    (f, h) =>
      `Öğrenci ${f.ders} dersinde kendi çıtasını yükseltti: ${f.gun} tarihli ${h.n(f.Q, "soruluk")} sette ${h.net(f.net)} net yaptı.`,
    (f, h) =>
      `${h.pct(f.oran)} net oranı, ${f.ders} dersinde tek kayıtta ulaşılan en yüksek değer (${f.gun}, ${h.n(f.Q, "soru")}, ${h.net(f.net)} net).`,
    (f, h) =>
      `Son bir haftada ${f.ders} dersinde yeni bir zirve görüldü: ${h.net(f.net)} net ile net oranı ${h.pct(f.oran)} düzeyine çıktı.`,
    (f, h) =>
      `Bu rekor öğrenciyle paylaşılmaya değer: ${f.ders} dersinde ${h.n(f.Q, "soruluk")} bir sette ${h.net(f.net)} net, yani ${h.pct(f.oran)} net oranı.`,
    (f, h) =>
      `${h.n(f.Q, "sorudan")} ${h.net(f.net)} net: öğrenci ${f.gun} tarihli bu ${f.ders} kaydıyla dersteki en yüksek net oranına ulaştı (${h.pct(f.oran)}).`,
  ],

  "guclu.isabet": [
    (f, h) =>
      `${f.ders} dersinde işaretlenen soruların ${h.pct(f.isabet)} kadarı doğru; ${h.n(f.Q, "soru")} üzerinden bu oran, sağlam bir bilgi zeminini gösteriyor.`,
    (f, h) =>
      `Yüksek isabet dikkat çekiyor: ${f.ders} dersinde ${h.n(f.Q, "soruda")} işaretlenen cevapların ${h.pct(f.isabet)} kadarı doğru.`,
    (f, h) =>
      `Öğrencinin ${f.ders} dersinde cevap verdiği her 10 sorudan yaklaşık ${h.int(f.isabet / 10)} tanesi doğru çıkıyor; ${h.n(f.Q, "soruluk")} hacimde bu, güvenilir bir işaret.`,
    (f, h) =>
      `Dört yanlışın bir doğruyu götürdüğü sistemde ${f.ders} dersindeki ${h.pct(f.isabet)} isabet, yanlış kaynaklı net kaybını en aza indiriyor.`,
    (f, h) => `İşaretleme kararları ${f.ders} dersinde güvenilir: ${h.n(f.Q, "soruluk")} hacimde isabet ${h.pct(f.isabet)} düzeyinde.`,
    (f, h) => `Sağlam bir profil: ${f.ders} dersinde cevap verilen soruların büyük bölümü (${h.pct(f.isabet)}) doğru çıkıyor.`,
    (f, h) =>
      `${h.pct(f.isabet)} isabet oranı, ${f.ders} dersinde eleme stratejisine güvenilebileceğini düşündürüyor; iki şıkka inilen sorularda işaretleme cesaretlendirilebilir.`,
  ],

  "guclu.konular": [
    (f, h) => `${f.ders} dersinde ${konuOran(f, h)} ${K(f, "konusu", "konuları")} pekişmiş görünüyor.`,
    (f, h) => `Öğrencinin ${f.ders} dersindeki sağlam zeminini ${konuOran(f, h)} ${K(f, "konusu", "konuları")} oluşturuyor.`,
    (f, h) =>
      `Aralıklı tekrarla korunabilecek ${K(f, "bir konu", "konular")} var: ${f.ders} dersinde ${h.qlist(f.konular)} ${K(f, "konusunda", "konularında")} ${
        oranList(f, h) ? `net oranı ${K(f, "", "sırasıyla ")}${oranList(f, h)} düzeyinde` : "sonuçlar oturmuş durumda"
      }.`,
    (f, h) =>
      `Öğrenci ${f.ders} dersinde ${h.qlist(f.konular)} ${K(f, "konusunda", "konularında")} istikrarlı sonuç alıyor${
        oranList(f, h) ? ` (${oranList(f, h)})` : ""
      }.`,
    (f, h) => `Konu bazında bakıldığında ${f.ders} dersinde ${konuOran(f, h)} öne çıkıyor.`,
    (f, h) =>
      `Yeni konulara geçerken ${f.ders} dersinde ${h.qlist(f.konular)} ${K(f, "konusu", "konuları")} sağlam bir dayanak sağlıyor${
        oranList(f, h) ? ` (${oranList(f, h)})` : ""
      }.`,
    (f, h) =>
      `Pekişmiş konular arasında ${f.ders} dersinden ${konuOran(f, h)} var; ${K(f, "bu konuda", "bu konularda")} ayda bir kısa tekrar seti yeterli olabilir.`,
  ],

  "guclu.pastanDonus": [
    (f, h) =>
      `Pas geçilen ödevlerden ${h.int(f.sayi)} tanesi sonradan tamamlanıp teslim edildi; bu, hem dürüst kaydın hem de takibin işareti.`,
    (f, h) =>
      `Öğrenci pas geçtiği ${h.n(f.sayi, "ödeve")} sonradan geri döndü; ${
        f.sayi > 1 ? "işi yarım bırakmama alışkanlığı gelişiyor" : "yarım kalan işi sahiplenmesi önemli bir işaret"
      }.`,
    (f, h) =>
      `Vadesi gelen ${h.n(f.V, "ödevden")} ${h.int(f.sayi)} tanesi önce pas olarak işaretlenip ardından teslim edildi; öğrenci eksiğini kendisi kapatıyor.`,
    (f, h) =>
      `Dürüstlük ve takip bir arada: öğrenci pas işaretlediği ödevlerden ${h.int(f.sayi)} tanesini sonradan tamamladı.`,
    (f, h) =>
      `Dikkat çekici bir tutum: öğrenci pas geçtiği ${h.n(f.sayi, "ödevi")} sonradan teslim ederek listesinde açık iş bırakmıyor.`,
    (f, h) =>
      `Atlanan işe geri dönebilmek değerli bir beceri; pas geçilen ${h.n(f.sayi, "ödevin")} sonradan teslim edilmesini açıkça takdir etmek bu davranışı pekiştirir.`,
    (f, h) => `Ödev listesinde yarım kalan işlere geri dönüş görülüyor; pas geçilen ${h.n(f.sayi, "ödev")} sonradan teslim edildi.`,
  ],

  "guclu.aktifGun": [
    (f, h) => `Ayın ${h.int(f.gunSayisi)} gününün ${h.int(f.aktifGun)} tanesinde çalışma kaydı var.`,
    (f, h) =>
      `${h.n(f.aktifGun, "aktif gün")}, haftada ortalama ${haftalik(f, h)} çalışma gününe karşılık geliyor; çalışma birkaç güne sıkışmadan aya yayılmış.`,
    (f, h) =>
      `Ay boyunca ${h.int(f.aktifGun)} aktif güne karşılık ${h.int(f.gunSayisi - f.aktifGun)} günde kayıt yok; çalışma ayın büyük kısmını kapsıyor.`,
    (f, h) => `Aktif gün oranı ${h.pct(oran(f.aktifGun, f.gunSayisi))}: çalışma tek tük değil, rutine dönüşmüş görünüyor.`,
    (f, h) =>
      `Öğrenci haftada ortalama ${haftalik(f, h)} gün masaya oturdu (${h.int(f.aktifGun)}/${h.int(f.gunSayisi)} gün); bu, sınava uzanan süreç için sağlam bir ritim.`,
    (f, h) =>
      `Çalışma bu ay bir alışkanlığa dönüşüyor: her 10 günün yaklaşık ${h.int((f.aktifGun / (f.gunSayisi || 30)) * 10)} tanesinde kayıt var.`,
    (f, h) =>
      `Kayıt girilen ${h.n(f.aktifGun, "gün")}, ${h.n(f.gunSayisi, "günlük")} ayın ${h.pct(oran(f.aktifGun, f.gunSayisi))} kadarını kapsıyor; bu süreklilik öğrenciye açıkça söylenmeye değer.`,
  ],

  "guclu.seyirYukselis": [
    (f, h) =>
      `${f.ilk.ay.ad} ayından ${f.son.ay.ad} ayına ${f.konu} net oranı ${h.pct(f.ilk.NO)} düzeyinden ${h.pct(f.son.NO)} düzeyine çıktı (${h.signed(syArt(f))} puan).`,
    (f, h) =>
      `İzlenen ${h.n(f.aySayisi, "aylık")} seyir yukarı yönlü: ${f.konu} net oranı ${f.ilk.ay.ayinda} ${h.pct(f.ilk.NO)} iken ${f.son.ay.de} ${h.pct(f.son.NO)} oldu.`,
    (f, h) =>
      `${f.konu} tarafında ${h.n(f.aySayisi, "aylık")} takibin özeti olumlu: ilk aydan son aya net oranı ${h.int(syArt(f))} puan arttı.`,
    (f, h) =>
      `Önceki aylarla birlikte bakıldığında ${f.konu} net oranında belirgin bir tırmanış var: ${f.ilk.ay.ad}–${f.son.ay.ad} döneminde ${h.pct(f.ilk.NO)} → ${h.pct(f.son.NO)}.`,
    (f, h) =>
      `${f.ilk.ay.den} bu yana ${f.konu} net oranı ${h.int(syArt(f))} puan arttı ve ${f.son.ay.ayinda} ${h.pct(f.son.NO)} düzeyine ulaştı.`,
    (f, h) =>
      `Aylık tabloda ${f.konu} için genel yön yukarı; ${f.ilk.ay.ayinda} ${h.pct(f.ilk.NO)} olan net oranı, ${f.son.ay.ad} itibarıyla ${h.pct(f.son.NO)} oldu.`,
    (f, h) =>
      `${f.aySayisi >= 3 ? "Birkaç aylık seyirde" : "Aydan aya kıyasta"} anlamlı bir gelişim görülüyor: ${f.konu} net oranı ${h.n(f.aySayisi, "ayda")} ${h.pct(f.ilk.NO)} düzeyinden ${h.pct(f.son.NO)} düzeyine taşındı.`,
    (f, h) =>
      `${f.ilk.ay.ayinda} ${h.pct(f.ilk.NO)} olan ${f.konu} net oranını ${f.son.ay.ad} ayındaki ${h.pct(f.son.NO)} ile yan yana koymak, öğrenciye emeğinin karşılığını somut biçimde gösterir.`,
  ],

  "guclu.seyirDuzen": [
    (f, h) => `Teslim oranı ${f.once.ay.ayinda} ${h.pct(f.once.pct)} iken ${f.simdi.ay.de} ${h.pct(f.simdi.pct)} düzeyine çıktı.`,
    (f, h) =>
      `${f.once.ay.ad} ayından ${f.simdi.ay.ad} ayına ödev teslim oranı ${h.int(tFark(f))} puan arttı (${h.pct(f.once.pct)} → ${h.pct(f.simdi.pct)}).`,
    (f, h) => `Ödev düzeni bir önceki aya göre güçlendi: teslim oranı ${h.int(tFark(f))} puan artarak ${h.pct(f.simdi.pct)} oldu.`,
    (f, h) =>
      `Önceki ayla kıyaslandığında teslim tarafı güç kazandı: oran ${h.pct(f.once.pct)} düzeyinden ${h.pct(f.simdi.pct)} düzeyine yükseldi.`,
    (f, h) =>
      `${f.simdi.ay.ayinda} ödevlerin ${h.pct(f.simdi.pct)} kadarı teslim edildi; ${f.once.ay.ayinda} bu oran ${h.pct(f.once.pct)} düzeyindeydi.`,
    (f, h) =>
      `${f.simdi.ay.ad} ayı ödev takibi açısından güçlü geçti: teslim oranı, ${f.once.ay.ad} ayındaki ${h.pct(f.once.pct)} düzeyinden ${h.pct(f.simdi.pct)} düzeyine yükseldi.`,
    (f, h) =>
      `Aydan aya kıyasta teslim oranı ${h.int(tFark(f))} puan arttı; bu, öğrencinin ödev takibini daha çok sahiplendiğini gösteriyor.`,
    (f, h) =>
      `Teslim oranındaki ${h.int(tFark(f))} puanlık artışı (${h.pct(f.once.pct)} → ${h.pct(f.simdi.pct)}) öğrenciyle konuşup bu ay neyin işe yaradığını birlikte adlandırmak, düzeni kalıcı kılmaya yardımcı olur.`,
  ],

  "guclu.enIyiAy": [
    (f, h) => `${f.ay.ad}, izlenen ${h.n(f.aySayisi, "ay")} içinde ${f.sinav} net oranının en yüksek olduğu ay oldu (${h.pct(f.NO)}).`,
    (f, h) =>
      `${f.sinav} tarafında bu ay bir zirve var: ${h.pct(f.NO)} net oranı, izlenen ${h.n(f.aySayisi, "ayın")} en yüksek değeri.`,
    (f, h) =>
      `Önceki aylarla kıyaslandığında ${f.ay.ad} öne çıkıyor; ${f.sinav} net oranı ${h.pct(f.NO)} ile ${h.n(f.aySayisi, "aylık")} dönemin en iyisi.`,
    (f, h) => `${f.ay.de} ulaşılan ${h.pct(f.NO)} ${f.sinav} net oranı, izlenen aylar arasında şimdiye kadarki en yüksek düzey.`,
    (f, h) =>
      `Aylık karşılaştırmada ${f.sinav} için en güçlü ay ${f.ay.ad} oldu: ${h.n(f.aySayisi, "ay")} içinde ilk kez ${h.pct(f.NO)} düzeyine çıkıldı.`,
    (f, h) =>
      `Bu ay ${f.sinav} net oranı ${h.pct(f.NO)} ile izlenen dönemin en yüksek düzeyini gördü; ${
        f.aySayisi - 1 > 1 ? `önceki ${h.n(f.aySayisi - 1, "ayın")} hiçbiri` : "önceki ay"
      } bu düzeye ulaşmamıştı.`,
    (f, h) =>
      `${f.sinav} net oranında ${f.ay.ayinda} görülen ${h.pct(f.NO)}, ${h.n(f.aySayisi, "aylık")} takibin zirvesi; bu ayın çalışma düzeni önümüzdeki aylar için referans alınabilir.`,
    (f, h) =>
      `${h.n(f.aySayisi, "aylık")} karşılaştırmanın sonucu açık: ${f.sinav} net oranında en iyi ay ${f.ay.ad} (${h.pct(f.NO)}).`,
  ],
};
