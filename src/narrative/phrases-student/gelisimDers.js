// Öğrencinin gelişim alanları (ders ve konu başarısı) — alan / kanit / oneri ayrı bankalar (bkz. ./catalog.js,
// ../catalog.js olgu alanları, ../text.js > h).
//   alan : kısa, ASLA olumsuz olmayan başlık ("fırsat", "güçlendirmek", "yeniden yükselişe geçmek").
//   kanit: sayılarla tek cümle, "sen" diliyle ve nazik; okul karşılaştırması yok (odakDers'in pTilde'si kullanılmaz).
//   oneri: ekranda "Sonraki adım" — öğrencinin bu hafta kendi başına yapabileceği küçük, somut bir eylem.

const ekli = (arr, tek, cok) => ((arr || []).length > 1 ? cok : tek);
const konuAdlari = (f) => (f.konular || []).map((k) => k.ad);
const ilkKonu = (f) => (f.konular && f.konular.length ? f.konular[0] : null);
const konuOranli = (f, h) => h.list((f.konular || []).map((k) => `${h.q(k.ad)} (${h.pct(k.oran)})`));
const sinavMi = (k) => k === "TYT" || k === "AYT";
const yerde = (f) => (sinavMi(f.konu) ? `${f.konu} genelinde` : `${f.konu} dersinde`);
const fark = (a, b) => Math.abs(Math.round(b) - Math.round(a));
const hocana = (f) => (f.ogretmen ? `${f.ogretmen} hocana` : "branş öğretmenine");
const hocanla = (f) => (f.ogretmen ? `${f.ogretmen} hocanla` : "branş öğretmeninle");
const yanlisAgirlik = (f) => (f.yanlisPay ?? 0) >= 50;
const diger = (k) => (k === "AYT" ? "TYT" : "AYT");

export default {
  // ---------------------------------------------------------------- odak ders
  "gelisim.odakDers": {
    alan: [
      (f) => `${f.ders}: en büyük net kazanım fırsatın`,
      (f) => `Odak dersin: ${f.ders}`,
      (f) => `${f.ders} dersinde temeli güçlendirmek`,
      (f) => `Net artışının anahtarı: ${f.ders}`,
      (f, h) => (ilkKonu(f) ? `${f.ders}: önce ${h.q(ilkKonu(f).ad)} konusu` : `${f.ders}: adım adım yükseliş`),
    ],
    kanit: [
      (f, h) => `${f.ders} dersinde net oranın ${h.pct(f.NO)}; bu değer ${h.n(f.n, "kayıt")} ve ${h.n(f.Q, "soru")} üzerinden hesaplandı.`,
      (f, h) => `Derslerin arasında net artışı için en geniş alan ${f.ders}: çözdüğün ${h.n(f.Q, "soruda")} net oranın ${h.pct(f.NO)}.`,
      (f, h) => (f.konular.length
        ? `${f.ders} dersinde en çok gelişebileceğin ${ekli(f.konular, "konu", "konular")} ${konuOranli(f, h)}.`
        : `${f.ders} dersinde ${h.n(f.n, "kaydın")} var; konu konu ayrıntı için birkaç kayıt daha gerekiyor.`),
      (f, h) => `${f.ders} kayıtlarında her 100 sorudan ortalama ${h.int(f.NO)} net çıkıyor; ayın en büyük kazanım alanı bu ders.`,
      (f, h) => (ilkKonu(f)
        ? `Konu bazında en çok fırsat ${h.q(ilkKonu(f).ad)} konusunda (${h.pct(ilkKonu(f).oran)}).`
        : `Bu dönemde ${f.ders} dersine ${h.n(f.n, "kayıt")} girdin; net oranın ${h.pct(f.NO)}.`),
    ],
    oneri: [
      (f, h) => (f.konular.length
        ? `Bu hafta ${h.qlist(konuAdlari(f))} ${ekli(f.konular, "konusundan", "konularından")} kolaydan zora 15–20 soruluk setler çöz; haftalık hedefin ${h.n(f.hedefQ, "soru")}.`
        : `Bu hafta ${f.ders} dersine ${h.n(f.hedefQ, "soru")} ayırmayı hedefle; soruları 15–20 soruluk setlere böl.`),
      (f, h) => `Haftalık ${h.n(f.hedefQ, "soruluk")} hedefini üç oturuma yay; her oturumun sonunda yanlışlarını yanlış defterine yaz.`,
      (f, h) => (ilkKonu(f)
        ? `İşe ${h.q(ilkKonu(f).ad)} konusundan başla: kısa bir konu tekrarı, ardından 15 soruluk kolay bir set.`
        : `Son kayıtlarında en sık yanlış çıkan konuyu seç ve ona 15 soruluk kolay bir setle başla.`),
      (f, h) => `Kolay setlerde isabetin ${h.pct(80)} civarına çıkınca bir üst zorluğa geç.`,
      (f) => `${f.ders} için bir yanlış defteri tut: her yanlışı çözümüyle yaz, üç gün sonra aynı soruyu yeniden çöz.`,
      (f, h) => `Haftada 3 gün, aynı saatte kısa bir ${f.ders} oturumu ${h.n(f.hedefQ, "soruluk")} hedefine ulaşmanı kolaylaştırır.`,
    ],
  },

  // ---------------------------------------------------------------- yanlış ağırlıklı profil
  "gelisim.yanlis": {
    alan: [
      (f) => `${f.ders}: isabeti yükseltmek`,
      (f) => `${f.ders} dersinde daha seçici işaretleme`,
      (f) => `İşaretlemede isabet: ${f.ders}`,
      (f) => `${f.ders} yanlışlarını nete çevirmek`,
      (f) => `${f.ders}: emin olduğun soruya odaklanmak`,
    ],
    kanit: [
      (f, h) => `${f.ders} dersinde işaretlediğin her 10 sorudan yaklaşık ${h.int(f.onda)} tanesi yanlış çıkıyor; isabetin ${h.pct(f.isabet)}.`,
      (f, h) => `İsabetin ${h.pct(f.isabet)}, boş oranın ${h.pct(f.bos)}: soruları nadiren boş bırakıyorsun ama işaretlediklerinin bir kısmı yanlış çıkıyor.`,
      (f, h) => `Dört yanlış bir doğruyu götürdüğü için ${f.ders} dersindeki ${h.n(f.Y, "yanlış")} ${h.net(f.gotur)} net demek.`,
      (f, h) => `Yanlışlar ${f.ders} dersinde ${h.net(f.gotur)} net götürdü; isabetin yükseldikçe bu netler geri gelir.`,
      (f, h) => `Boş oranının ${h.pct(f.bos)} gibi düşük olması, ${f.ders} dersindeki net farkının çoğunun yanlışlardan geldiğini gösteriyor.`,
    ],
    oneri: [
      () => "Her yanlışını üç gruba ayır: bilgi eksiği, dikkat hatası, işlem hatası; en kalabalık gruba göre çalış.",
      () => "İki şıkka indiremediğin soruyu boş bırak; eleyebildiğinde işaretle.",
      (f) => `Bu hafta ${f.ders} dersinde 20 soruluk bir seti süre tutmadan, her soruyu kontrol ederek çöz.`,
      () => "Yanlış yaptığın soruları üç gün sonra yeniden çöz; ikinci denemede doğru yapıyorsan konu oturuyor demektir.",
      () => "Çözdüğün her setin sonunda yanlışlarının çözümünü oku ve hatanın nerede olduğunu bir cümleyle yaz.",
    ],
  },

  // ---------------------------------------------------------------- konu eksiği profili (boş ağırlıklı)
  "gelisim.bos": {
    alan: [
      (f) => `${f.ders}: boş kalan soruları nete çevirmek`,
      (f) => `${f.ders} dersinde konu tamamlama`,
      (f, h) => `${f.ders}: ${h.q(f.konu)} konusunu oturtmak`,
      (f) => `Boşları azaltma fırsatı: ${f.ders}`,
      (f) => `${f.ders} dersinde yeni konulara güven`,
    ],
    kanit: [
      (f, h) => `${f.ders} dersinde soruların ${h.pct(f.bos)} kadarını boş bırakıyorsun; en çok ${h.q(f.konu)} konusunda zorlanıyorsun.`,
      (f, h) => `Boş oranın ${h.pct(f.bos)}, isabetin ${h.pct(f.isabet)}; boşların çoğu henüz oturmamış konulardan geliyor olabilir.`,
      (f, h) => `${f.ders} dersinde en çok boş bıraktığın konu ${h.q(f.konu)}.`,
      (f, h) => `${f.ders} dersinde her 100 sorudan yaklaşık ${h.int(f.bos)} tanesi boş kalıyor.`,
      (f, h) => `İşaretlediğin soruların ${h.pct(f.isabet)} kadarı doğru; ${f.ders} dersinde asıl fırsat boş bıraktığın sorularda.`,
    ],
    oneri: [
      (f, h) => `Önce ${h.q(f.konu)} konusunun özetini tekrar et, ardından 15 soruluk kolay bir set çöz.`,
      (f, h) => `Konu anlatımını bir kez daha izle ya da oku; hemen ardından ${h.q(f.konu)} konusundan 10 kolay soru çöz.`,
      () => "Boş bıraktığın soruların çözümlerine bak ve hangi adımda takıldığını not et.",
      (f) => `Bu hafta ${f.ders} dersinde her gün 10 soru çöz: önce kolaylar, sonra orta zorluktakiler.`,
      () => "Takıldığın bir soruyu branş öğretmenine ya da koçuna göster; tek bir açıklama çoğu zaman konunun kilidini açar.",
    ],
  },

  // ---------------------------------------------------------------- temkinli profil (isabet yüksek, boş çok)
  "gelisim.temkinli": {
    alan: [
      (f) => `${f.ders}: bildiğini işaretleme cesareti`,
      (f) => `${f.ders} dersinde temkinden nete`,
      (f) => `Kendine daha çok güven: ${f.ders}`,
      (f) => `${f.ders}: bildiğin soruları nete çevirmek`,
      (f) => `${f.ders} dersinde işaretleme dengesi`,
    ],
    kanit: [
      (f, h) => `${f.ders} dersinde isabetin ${h.pct(f.isabet)} gibi yüksek, ama soruların ${h.pct(f.bos)} kadarını boş bırakıyorsun.`,
      (f, h) => `İşaretlediğin soruların çoğu doğru (${h.pct(f.isabet)}); bu, bazı boşları aslında bildiğini gösteriyor.`,
      (f, h) => `${f.ders} dersinde boş oranın ${h.pct(f.bos)}; yüksek isabetin, bu soruların bir kısmının nete dönebileceğini söylüyor.`,
      (f, h) => `Yüksek isabet (${h.pct(f.isabet)}) ve ${h.pct(f.bos)} boş: ${f.ders} dersinde temkinli bir çözüm tarzın var.`,
      (f, h) => `${f.ders} dersinde her 100 sorudan yaklaşık ${h.int(f.bos)} tanesini boş geçiyorsun; isabetin ise ${h.pct(f.isabet)}.`,
    ],
    oneri: [
      () => "İki şıkka indirebildiğin soruda işaretle: bu durumda işaretlemek ortalamada soru başına +0,375 net kazandırır.",
      (f) => `Bu hafta ${f.ders} setlerinde boş bırakmak üzere olduğun soruları işaretle ve sonra doğru mu çıktı diye kontrol et.`,
      () => "Süre tutarak 20 soruluk bir set çöz; boş bıraktıklarını sonra süresiz yeniden dene.",
      () => "Emin olmadığın soruda önce yanlış şıkları ele; ikiye indirdiysen işaretlemekten çekinme.",
      (f) => `Bir sonraki denemede ${f.ders} bölümünde boş sayını not et ve bir öncekiyle karşılaştır.`,
    ],
  },

  // ---------------------------------------------------------------- son 4 haftada düşüş (başlık hep ileriye bakar)
  "gelisim.dusus": {
    alan: [
      (f) => `${f.ders}: yeniden yükselişe geçmek`,
      (f) => `${f.ders} dersinde ritmi geri kazanmak`,
      (f, h) => `${f.ders}: ${h.q(f.konu)} konusuyla toparlanma`,
      (f) => `${f.ders} dersinde tazeleme zamanı`,
      (f) => `${f.ders} için kısa bir tekrar molası`,
    ],
    kanit: [
      (f, h) => `Son dört haftada ${f.ders} dersinde net oranın ${h.pct(f.a)} düzeyinden ${h.pct(f.b)} düzeyine indi.`,
      (f, h) => `${f.ders} dersinde son haftalarda ${h.n(fark(f.a, f.b), "puanlık")} bir dalgalanma var; yeni konular zorlayıcı olabilir.`,
      (f, h) => `${f.ders} dersinde son dört haftanın net oranı ${h.pct(f.b)}; önceki dört haftada ${h.pct(f.a)} idi.`,
      (f, h) => `${f.ders} dersinde son haftalardaki farkın çoğu ${h.q(f.konu)} konusundan geliyor olabilir.`,
      (f, h) => `Net oranın ${f.ders} dersinde ${h.n(fark(f.a, f.b), "puan")} değişti (${h.pct(f.a)} → ${h.pct(f.b)}).`,
    ],
    oneri: [
      (f, h) => `Önce ${h.q(f.konu)} konusuna 15 soruluk bir tekrar seti çöz; temel oturunca yeni konular da kolaylaşır.`,
      (f) => `Bu hafta ${f.ders} dersinde yeni konuya geçmeden önce son işlenen konulardan karışık 20 soru çöz.`,
      () => "Son setlerindeki yanlışlarına bak: aynı konu tekrar ediyorsa oradan başla.",
      (f) => `${f.ders} dersinde kısa ama sık oturumlar dene: haftada 3 gün, her oturumda 15 soru.`,
      () => "Zorlandığın bir soruyu branş öğretmenine sor; kısa bir açıklama ritmini geri getirir.",
    ],
  },

  // ---------------------------------------------------------------- "konuyu bilmiyorum" pasları
  "gelisim.konuPasi": {
    alan: [
      (f, h) => `${f.ders}: ${h.qlist(f.konular)} ${ekli(f.konular, "konusunu", "konularını")} tamamlamak`,
      (f) => `Konuyu öğrenme fırsatı: ${f.ders}`,
      (f) => `${f.ders} dersinde yeni konuya sağlam başlangıç`,
      (f, h) => `${f.ders}: ${h.q(f.konular[0])} konusunu öğrenmek`,
      (f) => `${f.ders} dersinde konu anlatımı desteği`,
    ],
    kanit: [
      (f, h) => `Son dört haftada ${f.ders} dersinde ${h.n(f.sayi, "ödevi")} 'konuyu bilmiyorum' diyerek pas geçtin.`,
      (f, h) => `Pas geçtiğin ödevlerin konusu ${h.qlist(f.konular)}; bu, konunun henüz oturmadığını gösteriyor olabilir.`,
      (f, h) => `${f.ders} dersinde ${h.qlist(f.konular)} ${ekli(f.konular, "konusunda", "konularında")} konu anlatımına ihtiyaç var.`,
      (f, h) => `Konuyu bilmediğini söyleyip pas geçmen doğru bir hamleydi; ${h.n(f.sayi, "ödev")} bu nedenle bekliyor.`,
      (f, h) => `${f.ders} dersindeki ${h.n(f.sayi, "pasın")} ortak nedeni: konu henüz yeni.`,
    ],
    oneri: [
      (f, h) => `${h.cap(hocana(f))} ${h.q(f.konular[0])} konusunu kısaca yeniden anlatmasını rica et.`,
      (f, h) => `Konu anlatımını izle ya da oku, ardından ${h.q(f.konular[0])} konusundan 10 kolay soruyla başla.`,
      () => "Konuyu öğrendikten sonra pas geçtiğin ödeve geri dön: pastan dönüş teslim sayılır, gecikme sayılmaz.",
      (f, h) => `${f.ders} için konu özet defterine ${h.q(f.konular[0])} konusunun kısa bir özetini yaz.`,
      (f, h) => `Koçunla birlikte bu hafta için ${h.q(f.konular[0])} konusuna kısa bir çalışma planı yap.`,
    ],
  },

  // ---------------------------------------------------------------- uzun süredir dönülmeyen konu
  "gelisim.tekrar": {
    alan: [
      (f, h) => `${f.ders}: ${h.q(f.konu)} konusunu tazelemek`,
      (f, h) => `Tekrar zamanı: ${h.q(f.konu)}`,
      (f) => `${f.ders} dersinde aralıklı tekrar`,
      (f, h) => `${f.ders}: ${h.q(f.konu)} konusuna dönüş`,
      (f) => `Unutmadan tekrar: ${f.ders}`,
    ],
    kanit: [
      (f, h) => `${f.ders} dersinde ${h.q(f.konu)} konusuna ${h.n(f.gun, "gündür")} dönmedin; net oranın orada ${h.pct(f.oran)}.`,
      (f, h) => `En son ${h.n(f.gun, "gün")} önce çalıştığın ${h.q(f.konu)} konusunda net oranın ${h.pct(f.oran)}.`,
      (f, h) => `${f.ders} dersinde ${h.q(f.konu)} konusunda ${h.n(f.soru, "soru")} çözdün; üzerinden ${h.n(f.gun, "gün")} geçti.`,
      (f, h) => `Aralık uzadıkça konu unutulmaya başlar: ${h.q(f.konu)} konusundaki son çalışman ${h.n(f.gun, "gün")} önceydi.`,
      (f, h) => `${f.ders} dersinde tekrar sırası ${h.q(f.konu)} konusunda (${h.n(f.gun, "gün")} önce, ${h.pct(f.oran)}).`,
    ],
    oneri: [
      (f, h) => `Bu hafta ${h.q(f.konu)} konusundan 15 soruluk kısa bir tekrar seti çöz.`,
      (f, h) => `${f.ders} dersinde ${h.q(f.konu)} konusunun özetini 10 dakikada gözden geçir, ardından 10 soru çöz.`,
      () => "Konuyu tekrar ettikten bir hafta sonra yeniden 10 soru çöz; aralıklı tekrar kalıcılığı artırır.",
      (f, h) => `Önce ${h.q(f.konu)} konusundaki eski yanlışlarını yeniden çöz.`,
      (f, h) => `Hafta sonuna ${h.q(f.konu)} konusundan karışık 15 soruluk bir tekrar ekle.`,
    ],
  },

  // ---------------------------------------------------------------- TYT/AYT dengesi
  "gelisim.denge": {
    alan: [
      (f) => `${f.kucuk} tarafını büyütmek`,
      () => "TYT–AYT dengesi",
      (f) => `${f.kucuk} sorularına daha çok yer`,
      (f) => `Dengeli hazırlık: ${f.kucuk}`,
      (f) => (f.alan ? `${f.alan} hazırlığında ${f.kucuk} payı` : `Hazırlıkta ${f.kucuk} payı`),
    ],
    kanit: [
      (f, h) => `Son dört haftada çözdüğün ${h.int(f.toplam)} sorunun yalnızca ${h.int(f.kucukSoru)} tanesi ${f.kucuk} sorusu (${h.pct(f.oran)}).`,
      (f, h) => `${f.kucuk} payın ${h.pct(f.oran)}; YKS puanını iki oturum birlikte belirliyor.`,
      (f, h) => `Çözdüğün ${h.int(f.toplam)} sorunun ${h.pct(f.oran)} kadarı ${f.kucuk} tarafında.`,
      (f, h) => (f.alan ? `${f.alan} puanın için ${f.kucuk} sorularının payı şu an ${h.pct(f.oran)}.` : `${f.kucuk} sorularının payı şu an ${h.pct(f.oran)}.`),
      (f, h) => `Çalışmanın büyük kısmı ${diger(f.kucuk)} tarafında; ${f.kucuk} tarafında ${h.n(f.kucukSoru, "soru")} var.`,
    ],
    oneri: [
      (f, h) => `Bu hafta ${f.kucuk} tarafına ${h.n(f.hedef, "soru")} ekle.`,
      (f) => `Haftada iki gün ilk oturumunu ${f.kucuk} sorularına ayır.`,
      (f, h) => `${f.kucuk} için ${h.n(f.hedef, "soruluk")} haftalık bir hedef koy ve üç güne böl.`,
      (f) => `Serbest çalışmalarının bir kısmını ${f.kucuk} derslerine kaydır.`,
      (f, h) => `Koçunla birlikte ${f.kucuk} tarafına haftalık ${h.n(f.hedef, "soruluk")} bir plan yap.`,
    ],
  },

  // ---------------------------------------------------------------- okulda işlenmiş, kaydı olmayan konular
  "gelisim.kapsam": {
    alan: [
      (f) => `${f.ders}: okulda işlenen konulara yetişmek`,
      (f) => `${f.ders} dersinde konu kapsamı`,
      (f) => `Yeni konulara ilk adım: ${f.ders}`,
      (f, h) => `${f.ders}: ${h.q(f.konular[0])} ile başlamak`,
      (f) => `${f.ders} dersinde sıradaki konular`,
    ],
    kanit: [
      (f, h) => `${f.ders} dersinde okulda işlenen ${h.n(f.sayi, "konuda")} henüz kaydın yok${f.sayi > f.konular.length ? "; bunlardan bazıları" : ""}: ${h.qlist(f.konular)}.`,
      (f, h) => `Okulda işlenmiş ama henüz çalışma kaydın olmayan konular${f.sayi > f.konular.length ? "dan bazıları" : ""}: ${h.qlist(f.konular)}.`,
      (f, h) => `${h.cap(h.n(f.sayi, "konu"))} okulda işlendi, sende henüz kaydı yok (${f.ders}).`,
      (f, h) => `${f.ders} dersinde ${h.qlist(f.konular)} ${ekli(f.konular, "konusu", "konuları")} için henüz kayıt yok.`,
      (f, h) => `Kapsam listende ${f.ders} dersinden ${h.n(f.sayi, "konu")} seni bekliyor.`,
    ],
    oneri: [
      (f, h) => `Bu hafta ${h.q(f.konular[0])} konusundan ilk 10 soruyu çöz.`,
      (f, h) => `Bu hafta ${h.qlist(f.konular)} ${ekli(f.konular, "konusuna", "konularından her birine")} 10 soruyla göz at.`,
      (f, h) => `Konu anlatımını kısaca tekrar et, ardından ${h.q(f.konular[0])} konusundan kolay bir setle başla.`,
      () => "Bu konulara çalıştığında serbest çalışma olarak ekle; kapsam listen hemen güncellenir.",
      (f, h) => `Koçundan ${h.q(f.konular[0])} konusu için kısa bir kişisel ödev iste.`,
    ],
  },

  // ---------------------------------------------------------------- güçlü ders uzun süredir çalışılmıyor
  "gelisim.ihmal": {
    alan: [
      (f) => `${f.ders} dersini sıcak tutmak`,
      (f) => `Güçlü dersine bakım: ${f.ders}`,
      (f) => `${f.ders}: kısa bir tekrar`,
      (f) => `${f.ders} birikimini korumak`,
      (f) => `${f.ders} dersine geri dönüş`,
    ],
    kanit: [
      (f, h) => `${f.ders} dersinde ${h.n(f.gun, "gündür")} kaydın yok; net oranın ${h.pct(f.NO)} ile güçlü.`,
      (f, h) => `Son ${f.ders} kaydın ${h.n(f.gun, "gün")} önceydi.`,
      (f, h) => `Net oranın ${h.pct(f.NO)} olan ${f.ders} dersinde ${h.n(f.gun, "gündür")} kayıt yok.`,
      (f, h) => `${f.ders} dersi bir süredir çalışma listende görünmüyor (${h.n(f.gun, "gün")}).`,
      (f, h) => `Güçlü dersler de bakım ister: ${f.ders} dersindeki son kaydın ${h.n(f.gun, "gün")} önce.`,
    ],
    oneri: [
      (f) => `Haftada bir kez ${f.ders} dersinden 20 soruluk karışık bir set çöz.`,
      (f) => `${f.ders} dersinde kısa bir tekrar seti bu birikimi korur.`,
      (f) => `Bu hafta ${f.ders} dersinden bir deneme bölümü çöz.`,
      (f) => `${f.ders} dersini haftalık planına küçük bir blok olarak ekle.`,
      (f) => `${f.ders} dersinde zor sorulara geçerek hem tekrar yap hem seviyeni yükselt.`,
    ],
  },

  // ---------------------------------------------------------------- birkaç aydır odak kalan ders
  "gelisim.surekliOdak": {
    alan: [
      (f) => `${f.ders}: yeni bir yaklaşım denemek`,
      (f) => `${f.ders} dersinde yöntem değiştirme zamanı`,
      (f) => `${f.ders}: temelden sağlam adımlar`,
      (f) => `Birkaç aydır odak dersin: ${f.ders}`,
      (f) => `${f.ders} dersinde destekle ilerlemek`,
    ],
    kanit: [
      (f, h) => `${f.ders} ${h.n(f.aySayisi, "aydır")} odak derslerin arasında; bu ay net oranın ${h.pct(f.NO)}.`,
      (f, h) => `${f.aylar[0].den} bu yana ${f.ders} dersi odak listende (${h.n(f.aySayisi, "ay")}).`,
      (f, h) => (f.konular.length
        ? `${f.ders} dersinde en çok fırsat ${h.qlist(f.konular)} ${ekli(f.konular, "konusunda", "konularında")}.`
        : `${f.ders} dersinde net oranın ${h.pct(f.NO)}; birkaç aydır bu düzeyde.`),
      (f, h) => `Son ${h.n(f.aySayisi, "ayda")} ${f.ders} dersi odak olarak kaldı; aynı yöntemle devam etmek yerine yeni bir yol denemek işe yarar.`,
      (f, h) => `${f.ders} dersinde net oranın ${h.pct(f.NO)} ve bu ders ${h.n(f.aySayisi, "aydır")} odak listende.`,
    ],
    oneri: [
      (f, h) => `${h.cap(hocanla(f))} kısa bir görüşme yapıp ${f.ders} dersinde nereden başlaman gerektiğini sor.`,
      (f, h) => (f.konular.length
        ? `Bu ay yalnızca ${h.q(f.konular[0])} konusuna odaklan; bitirmeden bir sonrakine geçme.`
        : "Bu ay tek bir konu seç ve bitirmeden bir sonrakine geçme."),
      () => "Kaynak değiştirmeyi dene: daha kolay bir kitapla başlayıp güven kazan.",
      (f) => `Koçunla ${f.ders} için küçük ve ulaşılabilir hedeflerle yeni bir haftalık plan yap.`,
      (f) => `Her gün 10 soru, her soru dikkatle: ${f.ders} dersinde sıklık, hacimden önemli.`,
    ],
  },

  // ---------------------------------------------------------------- aydan aya düşen net oranı (sınav ya da ders)
  "gelisim.seyirDusus": {
    alan: [
      (f) => `${f.konu}: yeniden yükselişe geçmek`,
      (f) => `${f.konu} tarafında ritmi yakalamak`,
      (f) => `${f.konu} için taze bir başlangıç`,
      (f) => `${f.konu}: temeli yeniden güçlendirmek`,
      (f) => `${f.konu} hedefini yeniden kurmak`,
    ],
    kanit: [
      (f, h) => `${h.cap(yerde(f))} net oranın ${f.ilk.ay.den} bu yana ${h.pct(f.ilk.NO)} düzeyinden ${h.pct(f.son.NO)} düzeyine indi.`,
      (f, h) => `${h.cap(h.n(f.aySayisi, "aylık"))} tabloda ${yerde(f)} net oranın ${h.pct(f.son.NO)}; ${f.ilk.ay.ayinda} ${h.pct(f.ilk.NO)} idi.`,
      (f, h) => `${f.ilk.ay.ayinda} ${h.pct(f.ilk.NO)} olan ${f.konu} net oranın ${f.son.ay.ayinda} ${h.pct(f.son.NO)}.`,
      (f, h) => `${h.cap(yerde(f))} son aylarda bir dalgalanma var (${h.pct(f.ilk.NO)} → ${h.pct(f.son.NO)}).`,
      (f, h) => `Yeni konuların zorluğu ${yerde(f)} net oranına yansımış olabilir: ${h.pct(f.son.NO)}.`,
    ],
    oneri: [
      () => "Son aylarda en çok zorlandığın konuyu seç ve ona 15 soruluk bir tekrar seti çöz.",
      (f) => `Bu hafta ${f.konu} için yeni konu yerine karışık tekrar setleri çöz.`,
      (f) => `Koçunla ${f.konu} tarafı için kısa bir plan yap: haftada üç gün, her gün 15 soru.`,
      () => "Yanlış defterindeki eski sorulara dön; kalıcı öğrenme çoğu zaman oradan gelir.",
      (f, h) => `Bir sonraki ay için ${f.konu} tarafında ulaşılabilir bir hedef koy: yeniden ${h.pct(f.ilk.NO)} düzeyine çıkmak.`,
    ],
  },

  // ---------------------------------------------------------------- denemede en çok net kaçan ders (gerçek net)
  "gelisim.denemeDers": {
    alan: [
      (f) => `${f.ders}: denemede en çok net kazanabileceğin bölüm`,
      (f) => `Deneme fırsatı: ${f.ders}`,
      (f) => `${f.ders} denemelerinde net artırmak`,
      (f, h) => `${f.ders}: ${h.int(f.soru)} sorudan daha çok net`,
      (f) => `Denemede kazanım alanı: ${f.ders}`,
    ],
    kanit: [
      (f, h) => `Son ${h.n(f.deneme, "denemende")} ${f.ders} ortalaman ${h.int(f.soru)} soruda ${h.net(f.ortNet)} net; deneme başına ortalama ${h.net(f.kayip)} net daha kazanılabilir.`,
      (f, h) => `${f.ders} bölümünde ${h.int(f.soru)} sorudan ortalama ${h.net(f.ortNet)} net çıkarıyorsun.`,
      (f, h) => `${f.ders} bölümündeki fırsatın ${h.pct(f.yanlisPay)} kadarı yanlışlardan, geri kalanı boş bıraktığın sorulardan geliyor.`,
      (f, h) => `Son denemende ${f.ders} netin ${h.net(f.sonNet)}; bu bölümde ortalama ${h.net(f.kayip)} net daha kazanılabilir.`,
      (f, h) => `Denemelerde ${f.ders} bölümünde ortalama ${h.net(f.yanlisKaybi)} net yanlışlarda, ${h.net(f.bosKaybi)} net boş sorularda bekliyor.`,
    ],
    oneri: [
      (f) => (yanlisAgirlik(f)
        ? `Deneme sonrası ${f.ders} yanlışlarını bilgi, dikkat ve işlem hatası diye ayır; en kalabalık gruba 15 soruluk bir set çöz.`
        : `Son denemede ${f.ders} bölümünde boş kalan soruların konularını çıkar; en sık tekrar edene 15 soruluk bir set çöz.`),
      (f) => `Her denemeden sonra ${f.ders} bölümüne 20 dakikalık bir analiz ayır: çözemediğin soruların konusunu listele.`,
      (f, h) => `Bir sonraki denemeye kadar ${f.ders} için haftada iki kısa oturum yap; hedefin ${h.net(f.ortNet)} netin üzerine çıkmak.`,
      (f) => `Denemede ${f.ders} bölümüne ne kadar süre ayırdığını not et; süre yetmiyorsa bölüm sırasını değiştirmeyi dene.`,
      (f) => `Deneme analizini çalışmana bağla: ${f.ders} denemesinde yanlış ya da boş kalan konulardan birini bu haftanın serbest çalışması yap.`,
    ],
  },
};
