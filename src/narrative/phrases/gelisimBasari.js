// Gelişim alanları (başarı/performans) kalıp bankası — bkz. ../catalog.js (olgu alanları) ve ../text.js (yardımcılar h).

// Küçük yardımcılar: tekil/çoğul konu eki, ay dizisinin başı/sonu, öğretmen ifadesi, sınav geneli mi ders mi.
const ilkAy = (aylar) => aylar[0];
const sonAy = (aylar) => aylar[aylar.length - 1];
const ekli = (arr, tek, cok) => ((arr || []).length > 1 ? cok : tek);
const konuAdlari = (f) => (f.konular || []).map((k) => k.ad);
const ilkKonu = (f) => (f.konular && f.konular.length ? f.konular[0] : null);
const konuOranli = (f, h) => h.list((f.konular || []).map((k) => `${h.q(k.ad)} (${h.pct(k.oran)})`));
// Öğretmen adı varsa "branş öğretmeni Kerem Yalın ile", yoksa "branş öğretmeniyle" (koc.js ile aynı üslup).
const ogIle = (f) => (f.ogretmen ? `branş öğretmeni ${f.ogretmen} ile` : "branş öğretmeniyle");
const ogKisa = (f) => (f.ogretmen ? `${f.ogretmen} ile` : "branş öğretmeniyle");
const ogAd = (f) => f.ogretmen || "branş öğretmeni";
const sinavMi = (k) => k === "TYT" || k === "AYT";
const yerde = (f) => (sinavMi(f.konu) ? `${f.konu} genelinde` : `${f.konu} dersinde`);
const altKac = (f, h) => (f.n === 1 ? "tek okul ödevinde"
  : f.k === f.n ? `${h.n(f.n, "okul ödevinin")} tamamında` : `${h.n(f.n, "okul ödevinin")} ${h.int(f.k)} tanesinde`);
const altHepsi = (f, h) => (f.n === 1 ? "bu ödevde" : f.k === f.n ? "hepsinde" : `${h.int(f.k)} tanesinde`);

export default {
  // ---------------------------------------------------------------- odak ders
  "gelisim.odakDers": {
    alan: [
      (f, h) => `${f.ders}: en büyük net kazanım fırsatı`,
      (f, h) => `Öncelikli odak: ${f.ders}`,
      (f, h) => `${f.ders} dersinde temeli sağlamlaştırma`,
      (f, h) => `Net artışının anahtarı: ${f.ders}`,
      (f, h) => (ilkKonu(f) ? `${f.ders}: önce ${h.q(ilkKonu(f).ad)} konusu` : `${f.ders}: adım adım yükseliş planı`),
      (f, h) => `Bu ayın öncelikli dersi ${f.ders}`,
    ],
    kanit: [
      (f, h) => `${f.ders} dersinde net oranı ${h.pct(f.NO)} düzeyinde; bu değer ${h.n(f.n, "kayıt")} ve ${h.n(f.Q, "soru")} üzerinden hesaplandı.`,
      (f, h) => `İzlenen dersler arasında net artışı için en geniş alan ${f.ders} dersinde: çözülen ${h.n(f.Q, "soruda")} net oranı ${h.pct(f.NO)}.`,
      (f, h) => (f.konular.length
        ? `Net oranı ${h.pct(f.NO)} olan ${f.ders} dersinde en düşük sonuçlar ${konuOranli(f, h)} ${ekli(f.konular, "konusunda", "konularında")} görülüyor.`
        : `Net oranı ${h.pct(f.NO)} olan ${f.ders} dersinde tablo ${h.n(f.n, "kayda")} dayanıyor; konu düzeyinde ayrıştırma için kayıtlar henüz yeterli değil.`),
      (f, h) => (f.pTilde == null
        ? `${h.cap(h.n(f.n, "kayıtta"))} toplam ${h.n(f.Q, "soru")} çözülen ${f.ders} dersinde net oranı ${h.pct(f.NO)} düzeyinde kaldı.`
        : f.pTilde < 50
          ? `Okul ödevleri de aynı yönü gösteriyor: ${f.ders} dersinde net oranı ${h.pct(f.NO)} ve aynı ödevleri çözenlerle kıyaslandığında sonuçlar okul medyanının altında kalıyor.`
          : `${f.ders} dersinde net oranı ${h.pct(f.NO)}; okul ödevlerindeki medyan yüzdeliği ise ${h.int(f.pTilde)}.`),
      (f, h) => `${f.ders} kayıtlarında her 100 sorudan ortalama ${h.int(f.NO)} net çıkıyor; ayın en büyük kazanım alanı bu ders.`,
      (f, h) => `Çözülen ${h.n(f.Q, "soru")} üzerinden bakıldığında ${f.ders} dersinde net oranı ${h.pct(f.NO)} düzeyinde kalıyor.`,
      (f, h) => (ilkKonu(f)
        ? `Ders genelinde net oranı ${h.pct(f.NO)}; konu bazında en düşük sonuç ${h.q(ilkKonu(f).ad)} konusunda (${h.pct(ilkKonu(f).oran)}), bu yüzden ilk kazanım adresi orası.`
        : `Ay boyunca ${f.ders} dersine ${h.n(f.n, "kayıt")} girildi ve net oranı ${h.pct(f.NO)} düzeyinde kaldı.`),
    ],
    oneri: [
      (f, h) => (f.konular.length
        ? `Bu hafta ${h.qlist(konuAdlari(f))} ${ekli(f.konular, "konusuna", "konularına")} kolaydan zora 20–30 soruluk setlerle kişisel ödev verin; haftalık hedef ${h.n(f.hedefQ, "soru")} olsun.`
        : `Bu hafta ${f.ders} dersine ${h.n(f.hedefQ, "soru")} ayrılmasını hedefleyin; soruları kolaydan zora 20–30 soruluk setlere bölün.`),
      (f, h) => `Haftalık ${h.n(f.hedefQ, "soruluk")} hedefi üç oturuma yayın; her oturumun sonunda yanlışlar yanlış defterine işlensin.`,
      (f, h) => (ilkKonu(f)
        ? `İşe ${h.q(ilkKonu(f).ad)} konusundan başlayın: kısa bir konu tekrarı, ardından 20 soruluk kolay bir set; yanlışları bilgi, dikkat ve işlem hatası diye ayırmasını isteyin.`
        : `Son kayıtlarda en sık yanlış çıkan konuyu öğrenciyle birlikte belirleyin ve o konuya 20 soruluk kolay bir set verin.`),
      (f, h) => `Hafta ortasına bir ara kontrol koyun: ${h.n(f.hedefQ, "soruluk")} hedefin yaklaşık yarısı o güne kadar girilmiş olsun.`,
      (f, h) => `Kolay, orta ve zor olmak üzere üç kademeli set hazırlayın; kolay sette isabet ${h.pct(80)} civarına çıkmadan bir üst kademeye geçilmesin.`,
      (f, h) => `Her hafta sonunda kısa bir kontrol yapın: ${h.n(f.hedefQ, "soruluk")} hedef tutuldu mu, ${ilkKonu(f) ? `${h.q(ilkKonu(f).ad)} konusunda` : "derste"} net oranı yükseliyor mu?`,
      (f, h) => `${f.ders} için yanlış defteri açtırın: her yanlış çözümüyle birlikte deftere geçsin ve üç gün sonra aynı soru yeniden çözülsün.`,
      (f, h) => `Çalışmayı haftanın sabit günlerine bağlayın; haftada 3 gün aynı saatte kısa bir ${f.ders} oturumu, ${h.n(f.hedefQ, "soruluk")} hedefe ulaşmayı kolaylaştırır.`,
    ],
  },

  // ---------------------------------------------------------------- yanlış ağırlıklı profil
  "gelisim.yanlis": {
    alan: [
      (f, h) => `${f.ders}: yanlışlar net götürüyor`,
      (f, h) => `${f.ders} dersinde isabeti yükseltme`,
      (f, h) => `İşaretlemede isabet: ${f.ders}`,
      (f, h) => `${f.ders} yanlışlarını sınıflandırma`,
      (f, h) => `Yanlış kaynaklı net kaybı: ${f.ders}`,
      (f, h) => `${f.ders}: daha seçici işaretleme`,
    ],
    kanit: [
      (f, h) => `${f.ders} dersinde işaretlenen her 10 sorudan yaklaşık ${h.int(f.onda)} tanesi yanlış çıkıyor; isabet ${h.pct(f.isabet)} düzeyinde.`,
      (f, h) => `İsabet ${h.pct(f.isabet)}, boş oranı ise yalnızca ${h.pct(f.bos)}: öğrenci soruları nadiren boş bırakıyor, ancak işaretlediklerinin önemli bir kısmı yanlış çıkıyor.`,
      (f, h) => `Dört yanlışın bir doğruyu götürdüğü düşünüldüğünde, ${f.ders} dersindeki ${h.n(f.Y, "yanlış")} tek başına ${h.net(f.gotur)} net kaybı demek.`,
      (f, h) => `Yanlışlar ${f.ders} dersinde ${h.net(f.gotur)} net götürdü; isabet yükseldikçe bu pay doğrudan geri kazanılabilir.`,
      (f, h) => `Boş oranının ${h.pct(f.bos)} gibi düşük bir düzeyde kalması, ${f.ders} dersindeki net kaybının büyük ölçüde yanlışlardan geldiğini gösteriyor.`,
      (f, h) => `Boş az, yanlış fazla: ${f.ders} dersinde boş oranı ${h.pct(f.bos)}, isabet ${h.pct(f.isabet)} ve toplam ${h.n(f.Y, "yanlış")} var.`,
      (f, h) => `${h.cap(h.n(f.Y, "yanlış"))} ve ${h.pct(f.bos)} boş oranı, öğrencinin emin olmadığı sorularda da işaretlemeyi seçtiğini düşündürüyor.`,
    ],
    oneri: [
      (f, h) => `Son iki ödevin yanlış soru numaralarını birlikte açın ve her yanlışı bilgi, dikkat ya da işlem hatası olarak etiketletin; en sık çıkan türden başlayın.`,
      (f, h) => `Aynı hata tekrarlıyorsa ilgili konuya kısa bir konu tekrarı verin; hatalar dağınıksa her işaretten önce kısa bir kontrolle çözülecek 20 soruluk setler daha uygun olur.`,
      (f, h) => `Bir hafta boyunca ${f.ders} setlerinde "iki şıkka inemediğim soruyu işaretlemem" kuralını deneyin; hafta sonunda isabetin ${h.pct(f.isabet)} düzeyinden yukarı çıkıp çıkmadığına bakın.`,
      (f, h) => `Yanlış defteri başlatın: her ${f.ders} yanlışı çözümüyle birlikte deftere yazılsın, üç gün ve bir hafta sonra yeniden çözülsün.`,
      (f, h) => `Setleri 20 soruyla sınırlayın ve işaretlemeden önce şıkları bir kez daha okumasını isteyin; ${h.n(f.Y, "yanlışın")} ${h.net(f.gotur)} neti götürdüğünü birlikte hesaplamak farkındalık yaratır.`,
      (f, h) => `Çözüme bakmadan önce yanlış soruları bir kez daha denemesini isteyin; ikinci denemede doğru çıkanlar büyük olasılıkla dikkat ya da acele kaynaklıdır.`,
      (f, h) => `Yanlışların götürdüğü ${h.net(f.gotur)} neti izlenebilir bir ölçüte çevirin: gelecek ay benzer soru sayısında bu kaybın küçülüp küçülmediğine birlikte bakın.`,
      (f, h) => `Hız yerine doğruluğa odaklanan bir hafta planlayın: ${f.ders} setleri süre tutmadan çözülsün ve her 10 işaretten kaçının yanlış çıktığı not edilsin.`,
    ],
  },

  // ---------------------------------------------------------------- konu eksiği (boş ağırlıklı) profil
  "gelisim.bos": {
    alan: [
      (f, h) => `${f.ders}: konu eksiğini kapatma`,
      (f, h) => `Konu eksiği: ${f.ders}`,
      (f, h) => `${f.ders} dersinde boş kalan sorular`,
      (f, h) => `${f.ders} dersinde ${h.q(f.konu)} öncelikli`,
      (f, h) => `Boşları azaltma: ${f.ders}`,
    ],
    kanit: [
      (f, h) => `${f.ders} dersinde soruların ${h.pct(f.bos)} kadarı boş kalıyor; işaretlenenlerde isabet ${h.pct(f.isabet)}.`,
      (f, h) => `Boş oranı ${h.pct(f.bos)}, isabet ${h.pct(f.isabet)}: bu tablo dikkat hatasından çok konu eksiğine işaret ediyor.`,
      (f, h) => `En çok zorlanılan konu ${h.q(f.konu)}; ${f.ders} dersinde genel boş oranı ${h.pct(f.bos)} düzeyinde.`,
      (f, h) => `Her 100 sorudan yaklaşık ${h.int(f.bos)} tanesi boş bırakılıyor; ${h.pct(f.isabet)} düzeyindeki isabetle birlikte bu, eksiğin daha çok konu bilgisinde olduğunu akla getiriyor.`,
      (f, h) => `İşaretlenen sorularda isabet ${h.pct(f.isabet)} olsa da boş oranının ${h.pct(f.bos)} düzeyinde kalması, bazı soru tiplerinin hiç denenmediğini düşündürüyor.`,
      (f, h) => `Soruların ${h.pct(f.bos)} kadarının boş kalması tek bir konuyla sınırlı olmayabilir, ancak ${f.ders} dersinde ilk adres ${h.q(f.konu)} konusu.`,
    ],
    oneri: [
      (f, h) => `Önce ${h.q(f.konu)} konusunun anlatımını kısa bir video ya da ders notuyla tekrar ettirin, ardından kolaydan zora 20–30 soruluk bir kişisel ödev verin.`,
      (f, h) => `Boş bırakılan soruları birlikte sınıflandırın: konu mu eksik, süre mi yetmedi? Konu kaynaklı olanlara kısa bir tekrar ödevi verin.`,
      (f, h) => `Kolay ve orta düzeyle sınırlı kalın: bu hafta ${h.q(f.konu)} konusundan her biri 20 soruluk iki set verin; zorluk, boşlar azaldıktan sonra artırılabilir.`,
      (f, h) => `Konu tamamlanırken eleme stratejisini de konuşun: iki şıkka inilen soruda işaretlemek soru başına ortalama +0,375 net kazandırır; ilk deneme ${f.ders} setlerinde yapılsın.`,
      (f, h) => `Branş öğretmeninden ${h.q(f.konu)} konusu için kısa bir etüt isteyin; ardından öğrenci konuyu 20 soruluk bir setle pekiştirsin.`,
      (f, h) => `Konu anlatımından sonraki üç gün içinde ${h.q(f.konu)} konusundan kısa bir tekrar seti ekleyin; aralıklı tekrar boşların kalıcı olarak azalmasına yardım eder.`,
      (f, h) => `Hafta sonu ${f.ders} dersinden süre tutmadan çözülecek karışık bir set verin ve boş kalan her sorunun konusunu not ettirin; bu liste bir sonraki haftanın ödevini belirlesin.`,
    ],
  },

  // ---------------------------------------------------------------- temkinli profil (isabet yüksek, boş çok)
  "gelisim.temkinli": {
    alan: [
      (f, h) => `${f.ders}: isabetli ama temkinli`,
      (f, h) => `Boş sorularda saklı net: ${f.ders}`,
      (f, h) => `${f.ders} dersinde eleme stratejisi`,
      (f, h) => `Temkinli çözüm tarzı: ${f.ders}`,
      (f, h) => `${f.ders}: boşları nete çevirme fırsatı`,
    ],
    kanit: [
      (f, h) => `${f.ders} dersinde işaretlenen soruların isabeti ${h.pct(f.isabet)}, buna karşın soruların ${h.pct(f.bos)} kadarı boş kalıyor.`,
      (f, h) => `İsabet ${h.pct(f.isabet)} gibi yüksek bir düzeydeyken boş oranı ${h.pct(f.bos)}; öğrenci emin olmadığı soruyu işaretlemek yerine boş bırakmayı seçiyor gibi görünüyor.`,
      (f, h) => `Boş oranı ${h.pct(f.bos)} düzeyinde; oysa işaretlenen sorulardaki ${h.pct(f.isabet)} isabet, bilginin çoğu zaman yerinde olduğunu gösteriyor.`,
      (f, h) => `Yüksek isabet (${h.pct(f.isabet)}) ile yüksek boş oranının (${h.pct(f.bos)}) bir arada görülmesi temkinli bir çözüm tarzına işaret ediyor.`,
      (f, h) => `${h.cap(h.pct(f.isabet))} isabetle çözen öğrenci, ${f.ders} dersinde soruların ${h.pct(f.bos)} kadarını hiç işaretlemiyor.`,
      (f, h) => `Doğruluk tarafında sorun yok: ${f.ders} dersinde isabet ${h.pct(f.isabet)}; net kaybının ana kaynağı ${h.pct(f.bos)} düzeyindeki boş oranı.`,
    ],
    oneri: [
      (f, h) => `Eleme stratejisini birlikte konuşun: iki şıkka indiği soruda işaretlemek soru başına ortalama +0,375 net kazandırır.`,
      (f, h) => `Boş kalan sorular bir konuda toplanıyorsa o konuya kısa bir tekrar ödevi verin; dağınıksa süre tutarak çözülen 20 soruluk setlerle hız çalışması yapın.`,
      (f, h) => `Bir sonraki ${f.ders} setinde boş bıraktığı her sorunun yanına "iki şıkka indim mi?" notunu düşmesini isteyin; bu liste eleme stratejisinin nerede işe yarayacağını gösterir.`,
      (f, h) => `Set bittikten sonra boş bırakılan sorulara süre tutmadan ikinci bir tur yaptırın; ikinci turda doğru çıkanlar, bilgisi olduğu hâlde işaretlenmeyen sorulardır.`,
      (f, h) => `Haftada bir kez ${f.ders} dersinden süreli bir mini deneme ekleyin; her denemede bir öncekinden daha az boş bırakmak yeterli bir başlangıç hedefi.`,
      (f, h) => `Öğrenciye kendi verisini gösterin: ${h.pct(f.isabet)} isabetle çözen biri için iki şıkka inilen soruyu boş bırakmak çoğu zaman net kaçırmak demektir.`,
      (f, h) => `Boş bırakılan sorulardan 10 tanesini birlikte açın; konu eksiği, süre ya da emin olamama kaynaklı olanları ayırıp ödevi buna göre verin.`,
    ],
  },

  // ---------------------------------------------------------------- son 4 haftada düşüş
  "gelisim.dusus": {
    alan: [
      (f, h) => `${f.ders}: son haftalardaki düşüş`,
      (f, h) => `${f.ders} dersinde düşüş sinyali`,
      (f, h) => `${f.ders}: temele dönüş zamanı`,
      (f, h) => `${f.ders}: ${h.q(f.konu)} konusuyla toparlanma`,
      (f, h) => `Son dört haftada ${f.ders} düşüşte`,
    ],
    kanit: [
      (f, h) => `${f.ders} dersinde net oranı, önceki dört haftadaki ${h.pct(f.a)} düzeyinden son dört haftada ${h.pct(f.b)} düzeyine indi.`,
      (f, h) => `Önceki dört haftaya göre ${f.ders} dersindeki net oranı ${h.abs(f.delta)} puan düştü (${h.pct(f.a)} → ${h.pct(f.b)})${f.okulVerisi ? "; okul genelinde benzer bir düşüş görülmüyor" : ""}.`,
      (f, h) => (f.okulVerisi
        ? `Aynı dönemde okul genelinde benzer bir düşüş yok; ${f.ders} dersindeki ${h.signed(f.delta)} puanlık değişim öğrenciye özgü görünüyor.`
        : `${f.ders} dersinde son dört haftadaki değişim ${h.signed(f.delta)} puan; okul karşılaştırması olmadığından düşüşün genel mi bireysel mi olduğu henüz ayrışmıyor.`),
      (f, h) => `Bir önceki dört haftalık dönemde ${h.pct(f.a)} olan ${f.ders} net oranı, son dört haftada ${h.pct(f.b)} düzeyine geriledi.`,
      (f, h) => `Son dört hafta önceki dört haftayla karşılaştırıldığında ${f.ders} dersinde ${h.abs(f.delta)} puanlık bir düşüş var; ilk bakılacak konu ${h.q(f.konu)}.`,
      (f, h) => `Düşüş belirgin: ${f.ders} dersinde net oranı ${h.pct(f.b)} düzeyine indi, önceki dört haftada ${h.pct(f.a)} düzeyindeydi.`,
    ],
    oneri: [
      (f, h) => `Son 2–3 ödevin yanlış soru numaralarına ve teslim notlarına birlikte bakın; nedenin yeni konu mu, kaynak mı, yük mü olduğunu netleştirin.`,
      (f, h) => `Önce ${h.q(f.konu)} konusunda temele inin: 15–20 soruluk kolay bir set, ardından aynı konudan orta düzey bir set verin.`,
      (f, h) => `Düşüşü öğrenciye suçlayıcı olmadan gösterin ve "bu dört haftada ne değişti?" diye sorun; yanıt yeni konuysa kısa bir konu tekrarı, yük ise haftalık planda düzenleme yeterli olabilir.`,
      (f, h) => (f.okulVerisi
        ? `Düşüş okul genelinde görülmediği için branş öğretmeninden son ödevlerdeki hatalara kısa bir bakış isteyin; ${h.q(f.konu)} konusunda ek set gerekip gerekmediğine birlikte karar verin.`
        : `Kısa bir tanı seti verin: ${h.q(f.konu)} konusundan 20 soru; yanlışların hangi soru tiplerinde toplandığı düşüşün kaynağını gösterir.`),
      (f, h) => `İki hafta sonra bir ara kontrol koyun: ${f.ders} dersinde net oranı yeniden ${h.pct(f.a)} düzeyine yaklaşıyor mu, birlikte bakın.`,
      (f, h) => `Yeni konulara geçişi bir hafta yavaşlatın ve bu haftayı ${h.q(f.konu)} konusunu sağlamlaştırmaya ayırın; zor sorulara ondan sonra geçilebilir.`,
      (f, h) => `Yanlış defterinde ${f.ders} için ayrı bir bölüm açtırın ve son dört haftanın yanlışlarını oraya taşıtın; tekrar eden hata türü planın ilk adımı olsun.`,
    ],
  },

  // ---------------------------------------------------------------- okul ödevlerinde alt çeyrek
  "gelisim.okulAlt": {
    alan: [
      (f, h) => `${f.ders}: okul medyanıyla arayı kapatma`,
      (f, h) => `Okul ödevlerinde alt çeyrek: ${f.ders}`,
      (f, h) => `${f.ders} dersinde sınıf temposunu yakalama`,
      (f, h) => `${f.ders}: branş öğretmeniyle ortak plan`,
      (f, h) => `${f.ders} okul ödevlerinde destek ihtiyacı`,
    ],
    kanit: [
      (f, h) => `${f.ders} dersinde karşılaştırılan ${altKac(f, h)} öğrenci okulun alt çeyreğinde kaldı.`,
      (f, h) => `Aynı ödevi çözenlerin medyanıyla kıyaslandığında ${f.ders} sonuçları ortalama ${h.int(f.fark)} puan aşağıda.`,
      (f, h) => `Karşılaştırma aynı ödev üzerinden yapıldığı için fark ödevin zorluğuyla açıklanamıyor; ${f.ders} dersinde okul medyanına uzaklık ortalama ${h.int(f.fark)} puan.`,
      (f, h) => `${h.cap(h.n(f.n, "okul ödevi"))} karşılaştırıldı ve ${altHepsi(f, h)} öğrenci alt çeyrekte; öncelikli konu ${h.q(f.konu)}.`,
      (f, h) => `Okul medyanının ortalama ${h.int(f.fark)} puan altında kalan sonuçlar, ${f.ders} dersinde sınıfın temposuyla arada bir mesafe olduğunu gösteriyor.`,
      (f, h) => (f.k >= 2
        ? `Alt çeyrek tablosu tek bir ödevle sınırlı değil: ${f.k === f.n ? `karşılaştırılan ${h.n(f.n, "ödevin")} hepsinde` : `${h.n(f.n, "ödevden")} ${h.int(f.k)} tanesinde`} durum aynı, fark ortalama ${h.int(f.fark)} puan.`
        : `${f.ders} dersinde okul medyanına uzaklık ortalama ${h.int(f.fark)} puan; alt çeyrek sonucu karşılaştırılan ${altKac(f, h)} görüldü.`),
    ],
    oneri: [
      (f, h) => `${h.cap(ogIle(f))} görüşüp ${h.q(f.konu)} konusu için bir etüt planlayın; buna ek olarak bu hafta 20–30 soruluk bir kişisel ödev verin.`,
      (f, h) => `Önceliği ${h.q(f.konu)} konusuna verin: haftada bir ek set ve her okul ödevinden önce kısa bir konu tekrarı iyi bir başlangıç olur.`,
      (f, h) => `Bir sonraki okul ödevinin konusundan 15–20 soruluk bir hazırlık seti verin; ödev sonrasında sonucu okul medyanıyla birlikte karşılaştırın.`,
      (f, h) => `Üç haftalık ortak bir plan için ${ogKisa(f)} anlaşın: her hafta bir etüt ya da soru saati, arada sizin vereceğiniz kısa bir kişisel set.`,
      (f, h) => `Okul ödevlerindeki yanlışları yanlış defterine işletin ve iki gün sonra yeniden çözdürün; böylece sınıfta işlenen konu sıcakken pekişir.`,
      (f, h) => `Ortalama ${h.int(f.fark)} puanlık farkı izlenebilir bir hedefe çevirin: önümüzdeki iki okul ödevinde bu farkın küçülüp küçülmediğine birlikte bakın.`,
      (f, h) => `Okul ödevine verildiği gün küçük bir bölümle başlamasını isteyin; takıldığı soruları ${ogKisa(f)} paylaşmak üzere bir listede toplasın.`,
    ],
  },

  // ---------------------------------------------------------------- tekrar zamanı gelen konu
  "gelisim.tekrar": {
    alan: [
      (f, h) => `Tekrar zamanı: ${h.q(f.konu)}`,
      (f, h) => `${f.ders}: unutma riski taşıyan konu`,
      (f, h) => `Aralıklı tekrar: ${h.q(f.konu)} konusu`,
      (f, h) => `${f.ders} dersinde bekleyen konu tekrarı`,
      (f, h) => `Uzun süredir dönülmeyen konu: ${h.q(f.konu)}`,
    ],
    kanit: [
      (f, h) => `${f.ders} dersindeki ${h.q(f.konu)} konusuna ${h.n(f.gun, "gündür")} dönülmedi; son durumda net oranı ${h.pct(f.oran)} düzeyindeydi.`,
      (f, h) => `${h.q(f.konu)} konusundaki son çalışmanın üzerinden ${h.n(f.gun, "gün")} geçti; net oranı o sırada ${h.pct(f.oran)} düzeyindeydi.`,
      (f, h) => `${h.cap(h.n(f.soru, "soru"))} çözülen ${h.q(f.konu)} konusunda net oranı ${h.pct(f.oran)}; ${h.n(f.gun, "gündür")} bu konuda kayıt yok.`,
      (f, h) => `${f.ders} dersinde ${h.q(f.konu)} konusu ${h.n(f.gun, "gündür")} beklemede; bu konudaki ${h.n(f.soru, "soru")} üzerinden net oranı ${h.pct(f.oran)}.`,
      (f, h) => `${h.cap(h.n(f.gun, "gün"))} önce son kez çalışılan ${h.q(f.konu)} konusunda net oranı ${h.pct(f.oran)} düzeyindeydi; bu süre unutma riskini artırıyor.`,
      (f, h) => `Net oranı ${h.pct(f.oran)} düzeyinde kalmış olan ${h.q(f.konu)} konusu, ${h.n(f.gun, "gündür")} kayıtlarda görünmüyor.`,
    ],
    oneri: [
      (f, h) => `Bu hafta ${h.q(f.konu)} konusundan 15–20 soruluk kısa bir tekrar ödevi verin; yanlış çıkanlar yanlış defterine işlensin.`,
      (f, h) => `Tekrarı tek seferlik bırakmayın: ilk gün, 3 gün sonra ve 1 hafta sonra olmak üzere ${h.q(f.konu)} konusuna üç kısa set planlayın.`,
      (f, h) => `${f.ders} dersinin haftalık ödevine ${h.q(f.konu)} konusundan 10 soruluk bir bölüm ekleyin; böylece konu ayrı bir yük olmadan döngüye girer.`,
      (f, h) => `Önce 10 dakikalık bir özet tekrarı (formül ya da kural listesi), ardından 15 kolay soru verin; net oranı ${h.pct(f.oran)} düzeyinden belirgin biçimde yukarı çıkınca zorluk artırılabilir.`,
      (f, h) => `Konuyu öğrenciye anlattırın: ${h.q(f.konu)} konusunun ana fikrini 5 dakikada anlatabiliyorsa soru setine geçin, takılırsa önce kısa bir konu tekrarı verin.`,
      (f, h) => `Tekrar listesine ${h.q(f.konu)} konusunu ekleyip iki hafta sonra aynı konudan kısa bir kontrol seti planlayın.`,
      (f, h) => `${h.q(f.konu)} konusunda daha önce çözülen ${h.n(f.soru, "sorunun")} yanlışlarını yeniden açtırın; yeni soruya geçmeden önce onları çözmek eksik noktayı hızla hatırlatır.`,
    ],
  },

  // ---------------------------------------------------------------- güçlü dersin bakımı
  "gelisim.ihmal": {
    alan: [
      (f, h) => `${f.ders}: güçlü dersin bakımı`,
      (f, h) => `Güçlü dersi sıcak tutma: ${f.ders}`,
      (f, h) => `${f.ders} seviyesini koruma`,
      (f, h) => `${f.ders}: düzenli bakım seti`,
      (f, h) => `${f.ders} dersine uzun ara`,
    ],
    kanit: [
      (f, h) => `Net oranı ${h.pct(f.NO)} olan ${f.ders} güçlü derslerden biri; ancak ${h.n(f.gun, "gündür")} bu derste kayıt yok.`,
      (f, h) => `Son ${h.n(f.gun, "günde")} ${f.ders} dersinde hiç kayıt görünmüyor; ${h.pct(f.NO)} düzeyindeki net oranının korunup korunmadığı bu yüzden izlenemiyor.`,
      (f, h) => `${h.cap(h.pct(f.NO))} net oranıyla güçlü olan ${f.ders} dersine ${h.n(f.gun, "gündür")} dönülmedi.`,
      (f, h) => `Güçlü dersler arasında yer alan ${f.ders} için son kayıt ${h.n(f.gun, "gün")} önce girildi.`,
      (f, h) => `Kazanılmış bir seviye (${h.pct(f.NO)}) var, ama ${f.ders} dersi ${h.n(f.gun, "gündür")} çalışma kayıtlarında yer almıyor.`,
      (f, h) => `${h.cap(h.n(f.gun, "gündür"))} kayıt girilmeyen ${f.ders} dersinde son net oranı ${h.pct(f.NO)} düzeyinde.`,
    ],
    oneri: [
      (f, h) => `Haftada bir, ${f.ders} dersinden karışık 20 soruluk bir bakım seti ekleyin; seviyeyi korumak için bu kadarı yeterli.`,
      (f, h) => `${f.ders} bakım setini hafta sonuna koyun ve süre tutarak çözdürün; böylece seviyeyle birlikte hız da korunur.`,
      (f, h) => `${f.ders} için ayrı bir gün açmaya gerek yok: odak dersin oturumlarından birinin sonuna 10–15 soruluk kısa bir blok eklemek yeterli.`,
      (f, h) => `İki haftada bir ${f.ders} dersinden süreli bir mini deneme planlayın; net oranı ${h.pct(f.NO)} düzeyinin altına inerse sıklığı artırın.`,
      (f, h) => `Tekrar setlerini yeni nesil ya da bir kademe daha zor bir kaynaktan seçin; böylece seviye korunurken bir adım da yukarı taşınır.`,
      (f, h) => `Haftalık planda ${f.ders} için sabit bir gün belirleyin ve güçlü derslerin de takvimde yeri olduğunu öğrenciyle konuşun.`,
      (f, h) => `Tekrarı karışık konulardan yapın: ${f.ders} dersinin farklı ünitelerinden seçilmiş 20 soru, unutulmaya başlayan noktayı hızla gösterir.`,
    ],
  },

  // ---------------------------------------------------------------- aylardır süren odak (kalıcı sorun)
  "gelisim.surekliOdak": {
    alan: [
      (f, h) => `${f.ders}: ${h.n(f.aySayisi, "aydır")} odakta`,
      (f, h) => `Kalıcı odak: ${f.ders}`,
      (f, h) => `${f.ders} için yöntem değişikliği`,
      (f, h) => `${f.ders} dersinde planı yenileme zamanı`,
      (f, h) => `Üst üste ${h.n(f.aySayisi, "ay")} odak: ${f.ders}`,
      (f, h) => `${f.ders}: etiket ${h.n(f.aySayisi, "aydır")} değişmiyor`,
    ],
    kanit: [
      (f, h) => `${f.ders} dersi ${h.list(f.aylar.map((a) => a.ad))} aylarında üst üste odak ders olarak kaldı; bu ay net oranı ${h.pct(f.NO)}.`,
      (f, h) => `${h.cap(ilkAy(f.aylar).den)} bu yana ${f.ders} dersi odak etiketinde; ${sonAy(f.aylar).ayinda} net oranı ${h.pct(f.NO)} oldu.`,
      (f, h) => `${h.cap(h.n(f.aySayisi, "aydır"))} üst üste odakta olan ${f.ders} dersinde bu ayki net oranı ${h.pct(f.NO)}${f.konular.length ? `; en çok zorlanılan ${ekli(f.konular, "konu", "konular")} ${h.qlist(f.konular)}` : ""}.`,
      (f, h) => `${ilkAy(f.aylar).ad}–${sonAy(f.aylar).ad} döneminin her ayında ${f.ders} odak ders çıktı; ${sonAy(f.aylar).ayinda} net oranı ${h.pct(f.NO)} düzeyinde.`,
      (f, h) => `Tablo tek aylık bir dalgalanma değil: ${f.ders} ${h.n(f.aySayisi, "aydır")} odak ders ve net oranı şu an ${h.pct(f.NO)}.`,
      (f, h) => (f.konular.length
        ? `Bu ay net oranı ${h.pct(f.NO)} olan ${f.ders} dersinde zorlanma ${h.qlist(f.konular)} ${ekli(f.konular, "konusunda", "konularında")} toplanıyor; etiket ${h.n(f.aySayisi, "aydır")} değişmedi.`
        : `${h.cap(h.n(f.aySayisi, "ay"))} boyunca ${f.ders} dersinin etiketi değişmedi; ${h.list(f.aylar.map((a) => a.ad))} aylarının her birinde odak olarak işaretlendi.`),
    ],
    oneri: [
      (f, h) => `${h.cap(ogIle(f))} görüşüp yaklaşımı birlikte değiştirin: farklı bir kaynak, haftalık bir etüt ve iki haftada bir ortak ara kontrol.`,
      (f, h) => `Aynı etiket ${h.n(f.aySayisi, "aydır")} sürdüğüne göre kaynak değişikliği deneyin: konu anlatımı daha sade, soruları kolaydan zora dizilmiş bir kitap ya da video serisi seçin.`,
      (f, h) => `Haftalık kontrol noktası koyun: her hafta aynı gün ${f.ders} için önceki haftanın soru sayısı ve net oranı birlikte gözden geçirilsin, gerekiyorsa plan o gün güncellensin.`,
      (f, h) => (f.konular.length
        ? `Hedefi daraltın: bir sonraki ay yalnızca ${h.qlist(f.konular)} ${ekli(f.konular, "konusuna", "konularına")} odaklanın ve ${ekli(f.konular, "konuyu", "her konuyu")} kısa bir tarama testiyle kapatın.`
        : `Hedefi daraltın: ${f.ders} dersinde en çok yanlış çıkan iki konuyu birlikte seçin ve bir sonraki ay yalnızca onlara odaklanın.`),
      (f, h) => `Öğrenciyle son ${h.n(f.aySayisi, "ayın")} tablosunu birlikte açın ve neyin işe yaramadığını ondan dinleyin; yeni planı bu konuşmaya göre kurun.`,
      (f, h) => `Gerekirse veliyle kısa bir görüşme yapıp ortak bir plan kurun; ${f.ders} için haftada üç sabit çalışma saati belirlemek iyi bir başlangıç olur.`,
      (f, h) => `Yöntemi değiştirin: soru hacmini artırmak yerine her oturumu kısa bir konu özeti, 10 kolay ve 10 orta düzey soru olarak kurgulayın; sonucu iki haftada bir karşılaştırın.`,
      (f, h) => `${h.cap(ilkAy(f.aylar).den)} bu yana süren tabloyu değiştirmek için ${ogAd(f)} ve öğrenciyle üçlü kısa bir görüşme yapın; tek ve ölçülebilir bir aylık hedefte anlaşın.`,
    ],
  },

  // ---------------------------------------------------------------- aydan aya düşen net oranı
  "gelisim.seyirDusus": {
    alan: [
      (f, h) => `${f.konu}: aydan aya düşüş`,
      (f, h) => `${f.konu} net oranında düşüş eğilimi`,
      (f, h) => `Aylık seyirde düşüş: ${f.konu}`,
      (f, h) => `${f.konu}: ${h.n(f.aySayisi, "aylık")} düşüşü durdurma`,
      (f, h) => `${f.konu} için gidişi toparlama`,
    ],
    kanit: [
      (f, h) => `${h.cap(yerde(f))} net oranı ${f.ilk.ay.ayinda} ${h.pct(f.ilk.NO)} iken ${f.son.ay.ayinda} ${h.pct(f.son.NO)} oldu.`,
      (f, h) => `${h.cap(h.n(f.aySayisi, "aylık"))} izlemede ${f.konu} net oranı ${h.abs(f.delta)} puan azaldı (${h.pct(f.ilk.NO)} → ${h.pct(f.son.NO)}).`,
      (f, h) => `${h.cap(f.ilk.ay.den)} bu yana ${f.konu} net oranında ${h.signed(f.delta)} puanlık bir değişim var; bu ay ${h.pct(f.son.NO)} düzeyinde.`,
      (f, h) => `${h.cap(h.pct(f.ilk.NO))} düzeyinden ${h.pct(f.son.NO)} düzeyine inen ${f.konu} net oranında toplam kayıp ${h.abs(f.delta)} puan.`,
      (f, h) => `Aylık tabloda ${f.konu} net oranı, ${f.ilk.ay.ad} ile ${f.son.ay.ad} arasında ${h.abs(f.delta)} puan geriledi.`,
      (f, h) => `Önceki aylarla kıyaslandığında ${yerde(f)} gidiş aşağı yönlü: ${f.son.ay.ayinda} net oranı ${h.pct(f.son.NO)}, ${f.ilk.ay.ayinda} ise ${h.pct(f.ilk.NO)} idi.`,
    ],
    oneri: [
      (f, h) => `Son ${h.n(f.aySayisi, "ayın")} kayıtlarını birlikte açıp düşüşün hangi ${sinavMi(f.konu) ? "ders ve konularda" : "konularda"} yoğunlaştığını belirleyin; ilk iki konuya bu hafta kısa bir tekrar ödevi verin.`,
      (f, h) => (sinavMi(f.konu)
        ? `${f.konu} genelindeki düşüşte hangi derslerin payı olduğunu ayırın; en çok düşen derse haftalık küçük bir soru hedefi koyun.`
        : `${f.konu} dersinde yeni konulara geçişi kısa bir süre yavaşlatıp temel konuları tekrar ettirin; iki haftada bir ara kontrol koyun.`),
      (f, h) => `Haftalık bir kontrol noktası belirleyin: her hafta sonunda ${f.konu} net oranının ${h.pct(f.son.NO)} düzeyinin üstüne çıkıp çıkmadığına birlikte bakın.`,
      (f, h) => `Düşüşün nedenini öğrenciyle konuşun: yeni ve zor konular mı, azalan çalışma süresi mi, yoksa kaynak mı? Nedene göre konu tekrarı, plan düzenlemesi ya da kaynak değişikliği yapın.`,
      (f, h) => `Kısa vadeli bir hedef koyun: önümüzdeki dört haftada ${f.konu} net oranını ${f.ilk.ay.ayinda} görülen ${h.pct(f.ilk.NO)} düzeyine yaklaştırmak.`,
      (f, h) => `Süre tutarak çözülen haftalık bir deneme bloğu ekleyin; ${f.konu} yanlışlarını her hafta yanlış defterine işletip tekrar eden hata türlerine kısa setler verin.`,
      (f, h) => `${sinavMi(f.konu) ? "İlgili branş öğretmenlerinden" : "Branş öğretmeninden"} son ödevlere dair gözlemlerini isteyin ve birlikte tek, ölçülebilir bir aylık hedef belirleyin.`,
    ],
  },
};
