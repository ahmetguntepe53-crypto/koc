// Öğrencinin güçlü yönleri — "sen" diliyle, somut sayıyla takdir; her kalıp TEK madde cümlesi (bkz. ./catalog.js,
// ../catalog.js olgu alanları, ../text.js > h). Okul karşılaştırması yalnızca olumluysa (üst çeyrek / ortancanın üzeri).

const okulKonum = (p) => (p == null ? null : p >= 75 ? "üst çeyrektesin" : p >= 50 ? "ortancanın üzerindesin" : null);
// Puan farkları ekranda görünen yuvarlanmış yüzdelerden (metinle sayılar hep tutarlı).
const fark = (a, b) => Math.abs(Math.round(b) - Math.round(a));
const sinavMi = (k) => k === "TYT" || k === "AYT";
const yerde = (f) => (sinavMi(f.konu) ? `${f.konu} genelinde` : `${f.konu} dersinde`);
const ekli = (arr, tek, cok) => ((arr || []).length > 1 ? cok : tek);
const yukselis = (f) => f.tip === "yukselis";
const seri = (f, h) => (Array.isArray(f.degerler) && f.degerler.length ? f.degerler : [f.ilkNet, f.net]).map((v) => h.net(v)).join(" → ");

export default {
  "guclu.ders": [
    (f, h) => `${f.ders} dersinde güçlüsün: ${h.n(f.Q, "soruda")} net oranın ${h.pct(f.NO)}.`,
    (f, h) => `${f.ders} dersindeki ${h.pct(f.NO)} net oranın sağlam bir temel${okulKonum(f.pTilde) ? `; okul ödevlerinde de ${okulKonum(f.pTilde)}` : ""}.`,
    (f, h) => `${f.ders} dersinde ${h.n(f.n, "kayıt")} boyunca istikrarlı bir ${h.pct(f.NO)} net oranı yakaladın.`,
    (f, h) => `${f.ders} en rahat ilerlediğin derslerden: her 100 soruda ortalama ${h.int(f.NO)} net.`,
    (f, h) => `${f.ders} dersinde tablo güven veriyor (${h.pct(f.NO)} net oranı)${okulKonum(f.pTilde) ? ` ve okul ödevlerinde ${okulKonum(f.pTilde)}` : ""}.`,
  ],

  "guclu.yukselis": [
    (f, h) => `${f.ders} dersinde yükseliştesin: net oranın ${h.pct(f.a)} düzeyinden ${h.pct(f.b)} düzeyine çıktı.`,
    (f, h) => `Son dört haftada ${f.ders} dersinde ${h.n(fark(f.a, f.b), "puan")} kazandın.`,
    (f, h) => `${f.ders} dersindeki çaban meyvesini veriyor: ${h.pct(f.a)} → ${h.pct(f.b)}.`,
    (f, h) => `${f.ders} dersinde net oranını ${h.n(fark(f.a, f.b), "puan")} artırarak ${h.pct(f.b)} düzeyine taşıdın.`,
    (f, h) => `Önceki dört haftaya göre ${f.ders} dersinde belirgin bir yükseliş var (${h.pct(f.b)}).`,
  ],

  "guclu.etiket": [
    (f) => `${f.ders} dersinde seviyen ${f.eski} düzeyinden ${f.yeni} düzeyine çıktı.`,
    (f) => `${f.ders} artık ${f.yeni} derslerin arasında; önceki etiketi ${f.eski} idi.`,
    (f) => `Tebrikler: ${f.ders} dersi ${f.eski} etiketinden ${f.yeni} etiketine yükseldi.`,
    (f) => `${f.ders} dersinde bir kademe yukarı çıktın (${f.eski} → ${f.yeni}).`,
    (f) => `${f.ders} dersindeki emeğin etikete de yansıdı: artık ${f.yeni}.`,
  ],

  "guclu.okul": [
    (f) => `${f.ders} okul ödevlerinde aynı ödevi çözenler arasında üst çeyrektesin.`,
    (f, h) => `${h.n(f.n, "okul ödevinde")} ${f.ders} sonuçların üst çeyrekte.`,
    (f) => `Okul ödevlerinde ${f.ders} dersinde öne çıkıyorsun: sonuçların üst çeyrekte.`,
    (f, h) => `${f.ders} dersinde okul ödevlerindeki yerin çok iyi; karşılaştırılan ${h.n(f.n, "ödevde")} üst çeyrektesin.`,
    (f) => `Aynı okul ödevlerini çözenlerle kıyaslandığında ${f.ders} dersinde üst sıralardasın.`,
  ],

  "guclu.acikKapaniyor": [
    (f, h) => `${f.ders} okul ödevlerinde konumun ${h.n(f.kapanan, "puan")} iyileşti.`,
    (f, h) => `${f.ders} dersinde okul ödevlerindeki ilerlemen dikkat çekiyor: ${h.n(f.kapanan, "puanlık")} yol aldın.`,
    (f, h) => `Okul ödevlerinde ${f.ders} dersinde aynı ödevi çözenlere göre ${h.n(f.kapanan, "puan")} ilerledin${f.f1 >= 0 ? " ve ortancanın üzerine çıktın" : ""}.`,
    (f, h) => `${f.ders} dersinde okul ödevlerindeki gidişatın yukarı yönlü (${h.n(f.kapanan, "puan")}).`,
    (f, h) => `${f.ders} dersindeki çaban okul ödevlerine yansıyor: konumun ${h.n(f.kapanan, "puan")} yükseldi.`,
  ],

  "guclu.zamaninda": [
    (f, h) => `Son dört haftada ${h.n(f.V, "ödevinin")} ${h.int(f.zamaninda)} tanesini zamanında teslim ettin.`,
    (f, h) => `Zaman yönetimin güçlü: ödevlerinin büyük çoğunluğunu (${h.int(f.zamaninda)}/${h.int(f.V)}) süresi içinde bitirdin.`,
    (f, h) => `Ödevlerini zamanında teslim etme alışkanlığın çok değerli: ${h.int(f.zamaninda)}/${h.int(f.V)}.`,
    (f, h) => `${h.n(f.V, "ödevden")} ${h.int(f.zamaninda)} tanesini süresi dolmadan tamamladın.`,
    (f, h) => `Teslim tarihlerine sadık kalıyorsun; ${h.n(f.zamaninda, "ödev")} zamanında tamamlandı.`,
  ],

  "guclu.seri": [
    (f, h) => `${h.n(f.seri, "haftadır")} serin sürüyor: hiçbir ödevi sonuçsuz bırakmadın ve haftada en az 3 gün çalıştın.`,
    (f, h) => `${h.n(f.seri, "haftalık")} düzen serin var${f.enUzun > f.seri ? `; en uzun serin ${h.n(f.enUzun, "hafta")}` : " ve bu senin en uzun serin"}.`,
    (f, h) => `Düzenin ${h.n(f.seri, "haftadır")} bozulmadı; bu istikrar YKS yolunda fark yaratır.`,
    (f, h) => `Üst üste ${h.n(f.seri, "hafta")} boyunca hem ödevlerini ele aldın hem de haftada en az 3 gün çalıştın.`,
    (f, h) => `Serin ${h.n(f.seri, "haftaya")} ulaştı${f.seri >= f.enUzun ? "; bu şimdiye kadarki en uzun serin" : ""}.`,
  ],

  "guclu.serbest": [
    (f, h) => `Ödev dışında kendi isteğinle ${h.int(f.serbestSoru)} soru çözdün.`,
    (f, h) => `Çözdüğün soruların ${h.pct(f.pay)} kadarı serbest çalışmadan geliyor; bu inisiyatif çok değerli.`,
    (f, h) => `Serbest çalışman güçlü: ${h.int(f.serbestSoru)} soru, toplamın ${h.pct(f.pay)} kadarı.`,
    (f, h) => `Ödevlerinin yanında ${h.n(f.serbestSoru, "soruluk")} ek çalışma yaptın.`,
    (f, h) => `Kendi çalışmanı kendin planlayabiliyorsun: ${h.n(f.serbestSoru, "serbest soru")}.`,
  ],

  "guclu.rekor": [
    (f, h) => `${f.gun} tarihinde ${f.ders} dersinde kişisel rekorunu kırdın: ${h.int(f.Q)} soruda ${h.net(f.net)} net.`,
    (f, h) => `${f.ders} dersinde yeni rekor: ${h.pct(f.oran)} net oranı (${f.gun}).`,
    (f, h) => `${f.gun} günü ${f.ders} dersinde ${h.n(f.Q, "soruluk")} bir sette ${h.net(f.net)} net yaptın; bu senin en iyi sonucun.`,
    (f, h) => `Kişisel rekor ${f.ders} dersinden geldi: ${h.net(f.net)} net, ${h.pct(f.oran)} net oranı.`,
    (f, h) => `${f.ders} dersindeki en yüksek net oranını ${f.gun} tarihinde yakaladın (${h.pct(f.oran)}).`,
  ],

  "guclu.isabet": [
    (f, h) => `${f.ders} dersinde işaretlediğin soruların ${h.pct(f.isabet)} kadarı doğru.`,
    (f, h) => `${f.ders} dersinde isabetin çok yüksek: ${h.pct(f.isabet)}.`,
    (f, h) => `${f.ders} dersinde ${h.n(f.Q, "soruda")} isabetin ${h.pct(f.isabet)}; emin olduğun soruyu doğru işaretliyorsun.`,
    (f, h) => `${f.ders} dersinde işaretleme kararların isabetli (${h.pct(f.isabet)}).`,
    (f, h) => `${f.ders} dersinde her 10 işaretinden yaklaşık ${h.int(f.isabet / 10)} tanesi doğru çıkıyor.`,
  ],

  "guclu.konular": [
    (f, h) => `${f.ders} dersinde ${h.qlist(f.konular)} ${ekli(f.konular, "konusunu", "konularını")} pekiştirdin.`,
    (f, h) => `${f.ders} dersinde sağlamlaştırdığın ${ekli(f.konular, "konu", "konular")}: ${h.qlist(f.konular)}.`,
    (f, h) => `${f.ders} dersinde ${h.qlist(f.konular)} ${ekli(f.konular, "konusunda", "konularında")} net oranın ${h.list((f.oranlar || []).map((o) => h.pct(o)))}.`,
    (f, h) => `${f.ders} dersinde güçlü olduğun ${ekli(f.konular, "konu", "konular")} belli: ${h.qlist(f.konular)}.`,
    (f, h) => `${f.ders} dersinde ${h.qlist(f.konular)} artık senin güçlü ${ekli(f.konular, "konun", "konuların")}.`,
  ],

  "guclu.pastanDonus": [
    (f, h) => `Pas geçtiğin ${h.n(f.sayi, "ödeve")} sonradan geri dönüp tamamladın.`,
    (f, h) => `Pas geçip sonra tamamladığın ${h.n(f.sayi, "ödev")} var; bu, sorumluluk aldığını gösteriyor.`,
    (f, h) => `Yarım kalanı tamamlamayı biliyorsun: ${h.n(f.sayi, "ödevde")} pastan döndün.`,
    (f, h) => `Pas geçtiğin ödevleri unutmadın; ${h.n(f.sayi, "tanesini")} sonradan teslim ettin.`,
    (f, h) => `Zorlandığın ödevi dürüstçe pas geçip sonra tamamlaman çok değerli (${h.n(f.sayi, "ödev")}).`,
  ],

  "guclu.aktifGun": [
    (f, h) => `Ayın ${h.int(f.gunSayisi)} gününün ${h.int(f.aktifGun)} gününde çalıştın.`,
    (f, h) => `${h.n(f.aktifGun, "farklı günde")} çalışma kaydı girdin; düzenin çok iyi.`,
    (f, h) => `Çalışmayı güne yaymayı başarıyorsun: ${h.int(f.aktifGun)}/${h.int(f.gunSayisi)} aktif gün.`,
    (f, h) => `Günlerin çoğunda çalıştın: ${h.n(f.aktifGun, "aktif gün")}.`,
    (f, h) => `Düzenli çalışma alışkanlığın güçlü; ayın ${h.n(f.aktifGun, "günü")} aktif geçti.`,
  ],

  "guclu.seyirYukselis": [
    (f, h) => `${f.ilk.ay.ayinda} ${h.pct(f.ilk.NO)} olan ${f.konu} net oranın ${f.son.ay.ayinda} ${h.pct(f.son.NO)} düzeyine çıktı.`,
    (f, h) => `${h.n(f.aySayisi, "aydır")} ${yerde(f)} yükseliştesin: ${h.pct(f.ilk.NO)} → ${h.pct(f.son.NO)}.`,
    (f, h) => `${h.cap(yerde(f))} aydan aya ilerliyorsun; toplamda ${h.n(fark(f.ilk.NO, f.son.NO), "puan")} kazandın.`,
    (f, h) => `${f.ilk.ay.den} bu yana ${yerde(f)} net oranını ${h.n(fark(f.ilk.NO, f.son.NO), "puan")} artırdın.`,
    (f, h) => `Uzun soluklu bir yükseliş: ${yerde(f)} net oranın ${h.pct(f.son.NO)} düzeyine ulaştı.`,
  ],

  "guclu.seyirDuzen": [
    (f, h) => `${f.once.ay.ayinda} ${h.pct(f.once.pct)} olan teslim oranını ${f.simdi.ay.ayinda} ${h.pct(f.simdi.pct)} düzeyine çıkardın.`,
    (f, h) => `Ödev düzenin güçlendi: ${f.simdi.ay.ayinda} teslim oranın ${h.pct(f.simdi.pct)}.`,
    (f, h) => `${f.once.ay.e} göre ödevlerini daha düzenli teslim ettin (${h.pct(f.once.pct)} → ${h.pct(f.simdi.pct)}).`,
    (f, h) => `${f.simdi.ay.ayinda} teslim oranın ${h.n(fark(f.once.pct, f.simdi.pct), "puan")} arttı.`,
    (f, h) => `Teslim alışkanlığın ${f.simdi.ay.ayinda} belirgin biçimde iyileşti (${h.pct(f.simdi.pct)}).`,
  ],

  "guclu.enIyiAy": [
    (f, h) => `${f.ay.ad}, ${f.sinav} tarafında izlenen ${h.n(f.aySayisi, "ayın")} en iyisi: ${h.pct(f.NO)} net oranı.`,
    (f, h) => `${f.sinav} net oranında en iyi ayın ${f.ay.ad} (${h.pct(f.NO)}).`,
    (f, h) => `${f.ay.ayinda} ${f.sinav} net oranın ${h.pct(f.NO)} ile izlenen ${h.n(f.aySayisi, "ayın")} en yükseği.`,
    (f, h) => `${f.sinav} tarafında zirvedesin: ${h.pct(f.NO)}, izlenen aylar içinde en yüksek değer.`,
    (f, h) => `Kendi rekor ayın: ${f.ay.ayinda} ${f.sinav} net oranın ${h.pct(f.NO)}.`,
  ],

  "guclu.deneme": [
    (f, h) => (yukselis(f)
      ? `${f.sinav} denemelerinde son üç sonucun art arda yükseldi: ${seri(f, h)} (toplam +${h.net(f.artis)} net).`
      : `${f.sinav} denemelerinde kişisel rekorunu kırdın: ${h.net(f.net)} net (önceki en iyin ${h.net(f.oncekiEnIyi)} net).`),
    (f, h) => (yukselis(f)
      ? `${f.sinav} toplamını üç denemede ${h.net(f.ilkNet)} netten ${h.net(f.net)} nete çıkardın.`
      : `Son ${f.sinav} denemendeki ${h.net(f.net)} net, girdiğin ${h.n(f.sayi, "denemenin")} en yükseği.`),
    (f, h) => (yukselis(f)
      ? `${f.sinav} denemelerinde emeğin karşılık buluyor: son üç denemede ${h.net(f.artis)} net artış.`
      : `${f.sinav} denemelerinde yeni zirven ${h.net(f.net)} net; önceki en iyinden ${h.net(f.artis)} net fazla.`),
    (f, h) => (yukselis(f)
      ? `Art arda üç ${f.sinav} denemesinde yükseldin; son sonucun ${h.net(f.net)} net.`
      : `${f.sinav} denemelerindeki en iyi sonucunu ${h.net(f.net)} netle aldın.`),
    (f, h) => (yukselis(f)
      ? `Denemelerde yönün yukarı: ${f.sinav} netin ${h.net(f.ilkNet)} → ${h.net(f.net)} (+${h.net(f.artis)} net).`
      : `Bugüne kadarki ${h.n(f.sayi, "denemenin")} en yüksek ${f.sinav} neti senin son sonucun: ${h.net(f.net)} net.`),
  ],
};
