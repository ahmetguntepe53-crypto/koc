// Öğrenci özeti kalıp bankası — "sen" diliyle, sıcak ve dürüst; her kalıp TEK cümle (bkz. ./catalog.js, ../text.js > h).
// Özet 2–3 cümledir: açılış + (deneme / güçlü ders / yükseliş / seyir / ritim) + ileriye bakan odak cümlesi. Olumsuz
// hüküm yok: düşüş ve azalma, "yeniden yükselmek senin elinde" gibi bir sonraki adımla birlikte, yumuşak söylenir.

// ------------------------------------------------------------------ Açılış yardımcıları
const odevVar = (f) => f.V > 0;
const hepsi = (f) => f.V > 0 && f.teslim >= f.V;
const hicbiri = (f) => f.V > 0 && !(f.teslim > 0);
// "vadesi gelen 18 ödevinin 16 tanesini teslim ettin" / "... hepsini teslim ettin" / "... sonuçları henüz girilmemiş".
const teslimSen = (f, h) => (hepsi(f) ? (f.V === 1 ? "vadesi gelen tek ödevini teslim ettin" : `vadesi gelen ${h.n(f.V, "ödevinin")} hepsini teslim ettin`)
  : hicbiri(f) ? (f.V === 1 ? "vadesi gelen tek ödevinin sonucu henüz girilmemiş" : `vadesi gelen ${h.n(f.V, "ödevinin")} sonuçları henüz girilmemiş`)
  : `vadesi gelen ${h.n(f.V, "ödevinin")} ${h.int(f.teslim)} tanesini teslim ettin`);
// Rakam dizisi için kısa biçim: "18 ödevden 16 teslim".
const teslimKisa = (f, h) => (hepsi(f) ? `${h.n(f.V, "ödevin")} tamamı teslim`
  : hicbiri(f) ? `${h.n(f.V, "ödev")} sonuç bekliyor`
  : `${h.n(f.V, "ödevden")} ${h.int(f.teslim)} teslim`);
// Az veri: "2 kayıt ve 45 soru" (soru yoksa yalnızca kayıt), kayıt yoksa null.
const azVeri = (f, h) => (f.kayit > 0 ? (f.Q > 0 ? `${h.n(f.kayit, "kayıt")} ve ${h.int(f.Q)} soru` : h.n(f.kayit, "kayıt")) : null);

// ------------------------------------------------------------------ Güçlü ders: yalnızca olumlu okul konumu (≥ 50)
const okulKonum = (p) => (p == null ? null : p >= 75 ? "üst çeyrektesin" : p >= 50 ? "ortancanın üzerindesin" : null);

// ------------------------------------------------------------------ Ay içi hareket (yuvarlanmış yüzdelerden; metinle tutarlı)
const fark = (f) => Math.abs(Math.round(f.b) - Math.round(f.a));

// ------------------------------------------------------------------ Soru hacmi
const artti = (f) => (f.degisimPct ?? 0) > 0;
const hacimPct = (f, h) => h.pct(Math.abs(f.degisimPct ?? 0));

// ------------------------------------------------------------------ Çok aylık seyir
const seyirFark = (f) => Math.abs(Math.round(f.son.NO) - Math.round(f.ilk.NO));

// ------------------------------------------------------------------ Ritim
const ritimTip = (f) => (f.haftaSonuPay >= 40 ? "yuksek" : f.haftaSonuPay <= 15 ? "dusuk" : "denge");
const gunList = (f) => (f.gunler || []).filter(Boolean);
const gunAd = (f, h) => { const g = gunList(f); return g.length > 1 ? `${h.list(g)} günleri` : `${g[0]} günü`; };
const gunDe = (f, h) => { const g = gunList(f); return g.length > 1 ? `${h.list(g)} günlerinde` : `${g[0]} gününde`; };
const gunlerin = (f) => (gunList(f).length > 1 ? "en verimli günlerin" : "en verimli günün");

// ------------------------------------------------------------------ Deneme (gerçek net)
const R2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const yon = (f) => (f.fark == null ? "ilk" : R2(f.fark) === 0 ? "ayni" : f.fark > 0 ? "artis" : "azalis");
const netFark = (f, h) => h.net(Math.abs(R2(f.fark)));
const degisim = (f, h) => ({
  artis: `bir önceki denemene göre ${netFark(f, h)} net artış var`,
  azalis: `bir önceki denemenden ${netFark(f, h)} net az, ama bu tek denemelik bir dalgalanma olabilir`,
  ayni: "bir önceki denemenle aynı düzeydesin",
  ilk: `bu, kayıtlı ilk ${f.sinav} denemen`,
})[yon(f)];

export default {
  // ------------------------------------------------------------------ Açılış
  "ozet.acilis": [
    (f, h) => `${f.ay.ayinda} ${h.int(f.Q)} soru çözdün${odevVar(f) ? `; ${teslimSen(f, h)}` : ""}.`,
    (f, h) => `${f.ay.ad} ayının ${h.n(f.aktifGun, "gününde")} çalıştın ve toplam ${h.int(f.Q)} soru çözdün.`,
    (f, h) => `Rakamlarla ${f.ay.ad}: ${h.list([`${h.int(f.Q)} soru`, h.n(f.aktifGun, "aktif gün"), odevVar(f) ? teslimKisa(f, h) : null])}.`,
    (f, h) => (odevVar(f) && !hicbiri(f)
      ? `${f.ay.ayinda} ödevlerinin ${h.pct(f.teslimPct)} kadarını teslim ettin ve ${h.int(f.Q)} soru çözdün.`
      : `${f.ay.ayinda} ${h.n(f.aktifGun, "farklı günde")} toplam ${h.int(f.Q)} soru çözdün.`),
    (f, h) => `${f.ay.ad} boyunca ${h.n(f.kayit, "kayıt")} girdin ve ${h.int(f.Q)} soru çözdün${odevVar(f) ? `; ${teslimSen(f, h)}` : ""}.`,
    (f, h) => `${f.ay.ayinda} ${h.int(f.gunSayisi)} günün ${h.int(f.aktifGun)} gününde çalışma kaydın var; toplamda ${h.int(f.Q)} soru çözdün.`,
    (f, h) => (hepsi(f)
      ? `Güzel bir ${f.ay.ad} ayı: ${teslimSen(f, h)} ve ${h.int(f.Q)} soru çözdün.`
      : `${f.ay.ad} ayının özeti: ${h.int(f.Q)} soru, ${h.n(f.aktifGun, "aktif gün")}${odevVar(f) ? ` ve ${teslimKisa(f, h)}` : ""}.`),
  ],

  "ozet.acilisAz": [
    (f, h) => (azVeri(f, h)
      ? `${f.ay.ayinda} şimdilik ${azVeri(f, h)} var; kayıtların arttıkça değerlendirmen de netleşecek.`
      : `${f.ay.ayinda} henüz kayıt yok; ilk kayıtlarınla birlikte değerlendirmen burada oluşacak.`),
    (f, h) => `Değerlendirmen oluşma aşamasında: ${f.ay.ayinda} ${azVeri(f, h) ? `şimdiye dek ${azVeri(f, h)} girdin` : "henüz kayıt yok"}.`,
    (f, h) => `${f.ay.ad} için şu an ${azVeri(f, h) || "kayıt yok"}; birkaç haftalık kayıtla güçlü yönlerin ve odak alanların belirginleşecek.`,
    (f, h) => `Kayıtların biriktikçe bu sayfa sana daha çok şey söyleyecek: ${f.ay.ayinda} şu ana kadar ${azVeri(f, h) || "kayıt yok"}.`,
    (f, h) => `${f.ay.ad} değerlendirmen için biraz daha veriye ihtiyaç var (${azVeri(f, h) || "henüz kayıt yok"}).`,
    (f, h) => (azVeri(f, h)
      ? `${f.ay.ayinda} ilk adımları attın (${azVeri(f, h)}); birkaç kayıt daha ile tablo netleşecek.`
      : `${f.ay.ayinda} ilk kaydını girdiğin anda değerlendirmen şekillenmeye başlayacak.`),
  ],

  // ------------------------------------------------------------------ Güçlü ve odak ders
  "ozet.guclu": [
    (f, h) => `En güçlü dersin ${f.ders}: net oranın ${h.pct(f.NO)}${okulKonum(f.pTilde) ? `, okul ödevlerinde de aynı ödevi çözenler arasında ${okulKonum(f.pTilde)}` : ""}.`,
    (f, h) => `${f.ders} dersinde çok iyi gidiyorsun: her 100 soruda ortalama ${h.int(f.NO)} net.`,
    (f, h) => `Güçlü tarafın ${f.ders} (net oranı ${h.pct(f.NO)}); bu birikimi korumak için haftada bir kısa tekrar yeter.`,
    (f, h) => `Net oranı ${h.pct(f.NO)} olan ${f.ders}, bu ayki en güçlü dersin${okulKonum(f.pTilde) ? `; okul ödevlerinde de ${okulKonum(f.pTilde)}` : ""}.`,
    (f, h) => `${f.ders} senin güç alanın: ${h.pct(f.NO)} net oranıyla zorluğu biraz artırmaya hazırsın.`,
    (f, h) => `${f.ders} dersinde ${h.pct(f.NO)} net oranına ulaştın${okulKonum(f.pTilde) ? ` ve okul ödevlerinde ${okulKonum(f.pTilde)}` : ""}.`,
  ],

  "ozet.odak": [
    (f, h) => `En çok net kazanabileceğin ders ${f.ders}${f.konu ? `; işe ${h.q(f.konu)} konusundan başlayabilirsin` : ""}.`,
    (f, h) => `Bu ayın fırsat alanı ${f.ders}: net oranın ${h.pct(f.NO)} ve her düzenli set bu oranı yukarı taşır.`,
    (f, h) => `${f.ders} dersinde küçük ve düzenli adımlar büyük fark yaratır${f.konu ? `; ilk durak ${h.q(f.konu)} konusu` : ""}.`,
    (f, h) => `Odak dersin ${f.ders}${f.konu ? `, özellikle ${h.q(f.konu)} konusu` : ""}; burada kazanacağın her net toplamına doğrudan yansır.`,
    (f, h) => `${f.ders} dersinde net oranın şu an ${h.pct(f.NO)}; kolaydan zora giden setlerle bu oranı adım adım yükseltebilirsin.`,
    (f, h) => `Gelişim fırsatın en çok ${f.ders} dersinde${f.konu ? ` (${h.q(f.konu)} konusu)` : ""}.`,
  ],

  "ozet.yukselis": [
    (f, h) => `${f.ders} dersinde son dört haftada net oranın ${h.pct(f.a)} düzeyinden ${h.pct(f.b)} düzeyine çıktı.`,
    (f, h) => `Son haftalarda ${f.ders} dersinde yükseliştesin: ${h.pct(f.a)} → ${h.pct(f.b)}.`,
    (f, h) => `${f.ders} dersindeki emeğin karşılık buluyor; net oranın ${h.n(fark(f), "puan")} arttı.`,
    (f, h) => `${f.ders} dersinde yükseliş var: net oranın ${h.pct(f.b)} düzeyine ulaştı.`,
    (f, h) => `Son dört haftayı öncekiyle karşılaştırınca ${f.ders} dersinde ${h.n(fark(f), "puanlık")} bir artış görülüyor.`,
  ],

  // Motor bu olguyu öğrenci özetinde kullanmaz (düşüş, gelişim alanlarında bir sonraki adımla birlikte anlatılır); sözleşme
  // gereği kalıbı yine de var ve nazik.
  "ozet.dusus": [
    (f, h) => `${f.ders} dersinde son haftalarda küçük bir dalgalanma var (${h.pct(f.a)} → ${h.pct(f.b)}); yeni konular zorlayıcı olabilir.`,
    (f, h) => `${f.ders} dersinde temel konulara kısa bir dönüş, net oranını yeniden ${h.pct(f.a)} düzeyine taşıyabilir.`,
    (f, h) => `${f.ders} dersinde son dört haftanın net oranı ${h.pct(f.b)}; birkaç tekrar setiyle ritmini geri kazanabilirsin.`,
    (f, h) => `Yeni konuların etkisiyle ${f.ders} dersinde net oranın ${h.pct(f.b)} düzeyinde; bu çok normal ve toparlanabilir.`,
    (f, h) => `${f.ders} dersinde tazeleme zamanı: son haftalarda net oranın ${h.n(fark(f), "puan")} değişti.`,
  ],

  "ozet.hacim": [
    (f, h) => (artti(f)
      ? `${f.onceki.e} göre ${hacimPct(f, h)} daha fazla soru çözdün (${h.int(f.oncekiQ)} → ${h.int(f.Q)}).`
      : `Bu dönemde ${h.int(f.Q)} soru çözdün; ${f.onceki.ad} ayındaki ${h.int(f.oncekiQ)} soruya yeniden ulaşmak için haftalık küçük hedefler işe yarar.`),
    (f, h) => (artti(f)
      ? `Soru hacmin büyüdü: ${f.onceki.ayinda} ${h.int(f.oncekiQ)}, bu dönemde ${h.int(f.Q)} soru.`
      : `Soru sayın ${f.onceki.ayinda} ${h.int(f.oncekiQ)} idi, bu dönemde ${h.int(f.Q)}; ritmi yeniden yakalamak senin elinde.`),
    (f, h) => (artti(f)
      ? `${f.onceki.den} bu yana çalışma temponu artırdın: ${hacimPct(f, h)} daha fazla soru.`
      : `${f.onceki.den} bu yana soru sayın ${hacimPct(f, h)} azaldı; kısa ama düzenli oturumlarla tempoyu geri kazanabilirsin.`),
    (f, h) => (artti(f)
      ? `Önceki aya göre ${h.n(f.Q - f.oncekiQ, "soru")} fazla çözdün.`
      : `Önceki aya göre ${h.n(f.oncekiQ - f.Q, "soru")} daha az çözdün; haftana bir ek set eklemek farkı hızla kapatır.`),
    (f, h) => (artti(f)
      ? `Çözdüğün soru sayısı ${h.int(f.oncekiQ)} düzeyinden ${h.int(f.Q)} düzeyine çıktı.`
      : `Çözdüğün soru sayısı ${h.int(f.oncekiQ)} düzeyinden ${h.int(f.Q)} düzeyine indi; küçük bir hedefle yeniden hızlanabilirsin.`),
  ],

  "ozet.seyir": [
    (f, h) => ({
      up: `${f.sinav} net oranın ${f.ilk.ay.ayinda} ${h.pct(f.ilk.NO)} idi, ${f.son.ay.ayinda} ${h.pct(f.son.NO)} düzeyine çıktı.`,
      flat: `${f.sinav} net oranın son ${h.n(f.aySayisi, "aydır")} ${h.pct(f.son.NO)} civarında dengeli seyrediyor.`,
      down: `${f.sinav} net oranın son aylarda ${h.pct(f.son.NO)} düzeyinde; odak konulara dönmek yeniden yükselmeni sağlar.`,
      zigzag: `${f.sinav} net oranın aydan aya dalgalanıyor; ${f.son.ay.ayinda} ${h.pct(f.son.NO)} düzeyinde.`,
    })[f.yon],
    (f, h) => ({
      up: `${h.n(f.aySayisi, "aydır")} ${f.sinav} genelinde yükseliştesin: ${h.pct(f.ilk.NO)} → ${h.pct(f.son.NO)}.`,
      flat: `${f.sinav} genelinde istikrarlısın: ${h.n(f.aySayisi, "aydır")} net oranın ${h.pct(f.son.NO)} dolaylarında.`,
      down: `${f.sinav} genelinde yeni bir yükseliş için iyi bir zaman: ${f.son.ay.ayinda} net oranın ${h.pct(f.son.NO)}.`,
      zigzag: `${f.sinav} genelinde iniş çıkışlı birkaç ay geçti; ${f.son.ay.ayinda} ${h.pct(f.son.NO)} düzeyindesin.`,
    })[f.yon],
    (f, h) => ({
      up: `${f.ilk.ay.den} bu yana ${f.sinav} net oranını ${h.n(seyirFark(f), "puan")} artırdın.`,
      flat: `${f.sinav} tarafında sağlam bir zemin var: son aylarda net oranın ${h.pct(f.son.NO)} civarında.`,
      down: `${f.sinav} tarafında birkaç tekrar haftası, net oranını ${f.ilk.ay.ayinda} ulaştığın ${h.pct(f.ilk.NO)} düzeyine geri taşıyabilir.`,
      zigzag: `${f.sinav} net oranın dalgalı ama ${f.son.ay.ayinda} ${h.pct(f.son.NO)} düzeyine ulaştı.`,
    })[f.yon],
    (f, h) => ({
      up: `Uzun soluklu bir yükseliş: ${f.sinav} net oranın ${h.pct(f.son.NO)} düzeyine ulaştı.`,
      flat: `${f.sinav} net oranında ${h.n(f.aySayisi, "aylık")} istikrar var (${h.pct(f.son.NO)}).`,
      down: `${f.sinav} net oranın ${f.son.ay.ayinda} ${h.pct(f.son.NO)}; düzenli tekrarla yeniden yukarı dönebilirsin.`,
      zigzag: `${f.sinav} tarafında düzenli çalışma dalgalanmayı azaltır; ${f.son.ay.ayinda} net oranın ${h.pct(f.son.NO)}.`,
    })[f.yon],
    (f, h) => ({
      up: `${f.sinav} tarafında aydan aya ilerliyorsun; toplamda ${h.n(seyirFark(f), "puan")} kazandın.`,
      flat: `${f.sinav} genelinde net oranın aydan aya korunuyor: ${h.pct(f.son.NO)}.`,
      down: `${f.sinav} genelinde hedefin, net oranını yeniden ${h.pct(f.ilk.NO)} düzeyine taşımak olabilir.`,
      zigzag: `Son ${h.n(f.aySayisi, "ayda")} ${f.sinav} net oranın değişken; en son ${h.pct(f.son.NO)} oldu.`,
    })[f.yon],
  ],

  "ozet.ritim": [
    (f, h) => `${h.cap(gunlerin(f))} ${h.list(gunList(f))}; bu dönemde ${h.n(f.aktifGun, "gün")} çalıştın.`,
    (f, h) => `Soruların çoğunu ${gunDe(f, h)} çözüyorsun.`,
    (f, h) => ({
      yuksek: `Soruların ${h.pct(f.haftaSonuPay)} kadarı hafta sonuna düşüyor; hafta içine kısa bir oturum eklemek yükü dengeler.`,
      dusuk: `Hafta içi düzenin güçlü; hafta sonuna da kısa bir tekrar eklersen haftayı tam kullanırsın.`,
      denge: `Çalışmanı haftaya dengeli yaymışsın; ${gunlerin(f)} ${h.list(gunList(f))}.`,
    })[ritimTip(f)],
    (f, h) => `Bu dönemde ${h.n(f.aktifGun, "gün")} çalıştın; ritmin en güçlü olduğu zaman ${gunAd(f, h)}.`,
    (f, h) => `${h.cap(gunAd(f, h))} ${gunList(f).length > 1 ? "senin çalışma günlerin" : "senin çalışma günün"} gibi görünüyor; bu düzeni korumak alışkanlığını güçlendirir.`,
  ],

  "ozet.deneme": [
    (f, h) => `Son ${f.sinav} denemende ${h.net(f.net)} net yaptın (${f.tarih}); ${degisim(f, h)}.`,
    (f, h) => `${f.tarih} tarihli ${f.sinav} denemesinde ${h.net(f.net)} net çıkardın; ${degisim(f, h)}.`,
    (f, h) => ({
      artis: `${f.sinav} netlerin yükseliyor: son denemede ${h.net(f.oncekiNet)} netten ${h.net(f.net)} nete çıktın.`,
      azalis: `Son ${f.sinav} denemende ${h.net(f.net)} net yaptın; önceki denemedeki ${h.net(f.oncekiNet)} nete dönmek için deneme sonrası analiz çok işe yarar.`,
      ayni: `Son iki ${f.sinav} denemende ${h.net(f.net)} netle istikrarlısın.`,
      ilk: `İlk ${f.sinav} denemeni girdin: ${h.net(f.net)} net (${f.tarih}); sonraki denemelerin bu değerle karşılaştırılacak.`,
    })[yon(f)],
    (f, h) => `Gerçek sınava en yakın ölçü olan denemelerde son ${f.sinav} sonucun ${h.net(f.net)} net; ${degisim(f, h)}.`,
    (f, h) => `${h.int(f.soru)} soruluk son ${f.sinav} denemende ${h.net(f.net)} net yaptın${yon(f) === "ilk" ? "" : `; ${degisim(f, h)}`}.`,
    (f, h) => `Son denemen (${f.ad ? `${h.q(f.ad)}, ${f.tarih}` : f.tarih}) ${f.sinav} toplamında ${h.net(f.net)} netle bitti${
      yon(f) === "artis" ? `; önceki denemenden ${netFark(f, h)} net fazla` : yon(f) === "ayni" ? "; önceki denemenle aynı" : ""}.`,
  ],

  // ------------------------------------------------------------------ Kapanış / davet (öğrenciye özel)
  "ozet.tesvik": [
    () => "Her gün girdiğin küçük bir kayıt bile bu değerlendirmeyi daha isabetli yapar.",
    () => "Sonuçlarını düzenli girdikçe güçlü yönlerin ve odak alanların burada netleşecek.",
    () => "Bu hafta birkaç kısa oturumla başlaman yeterli; gerisi kendiliğinden gelir.",
    () => "Küçük ama düzenli adımlar, YKS yolunda en güvenilir ilerleme biçimidir.",
    () => "Aşağıdaki adımlardan birini seçip bugün başlayabilirsin.",
    () => "Emeğin burada sayılara dönüşüyor; devam et!",
  ],
};
