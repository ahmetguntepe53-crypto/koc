// Koça öneriler kalıp bankası — her kalıp koça hitap eden TEK eylem cümlesi (bkz. ../catalog.js, ../text.js).

// Konu listesi (0–3 öğe): tekil/çoğul ek seçimi; liste boşsa "bos" ifadesi döner (yer tutucuya ek yapıştırılmaz).
const konuVar = (f) => (f.konular || []).filter(Boolean).length > 0;
const K = (f, tekil, cogul) => ((f.konular || []).filter(Boolean).length > 1 ? cogul : tekil);
const kz = (f, h, tekil, cogul, bos = "") => (konuVar(f) ? `${h.qlist(f.konular)} ${K(f, tekil, cogul)}` : bos);
// Branş öğretmeni (ad null olabilir; ada ek yapıştırılmaz, yalnızca ayrı yazılan "ile" kullanılır).
const ogIle = (f) => (f.ogretmen ? `branş öğretmeni ${f.ogretmen} ile` : "branş öğretmeniyle");
const ogKisa = (f) => (f.ogretmen ? `${f.ogretmen} ile` : "branş öğretmeniyle");
// Serbest çalışmada odak ders (null olabilir).
const odakYon = (f) => (f.odakDers ? `${f.odakDers} dersine` : "odak derse");
const odakDen = (f) => (f.odakDers ? `${f.odakDers} dersinden` : "odak dersten");

export default {
  "koc.kisiselOdev": [
    (f, h) => `${f.ders} dersinde ${kz(f, h, "konusunda", "konularında", "öncelikli konularda")} ${f.soru} soruluk kişisel bir ödev tanımlayın.`,
    (f, h) => `${f.soru} soruluk, kolaydan zora dizilmiş bir setle ${f.ders} dersindeki ${kz(f, h, "konusunu", "konularını", "öncelikli konuları")} hedefleyen kişisel bir ödev açın.`,
    (f, h) => `Genel tekrar yerine doğrudan ${kz(f, h, "konusuna", "konularına", "öncelikli konulara")} odaklanan, ${f.soru} soruluk kişisel bir ${f.ders} ödevi verin.`,
    (f, h) => `Bu hafta ${f.ders} için ${kz(f, h, "konusundan", "konularından", "öncelikli konulardan")} ${f.soru} soru içeren kişisel bir ödev atayın; hatalı soruları yanlış defterine aktarmasını da isteyin.`,
    (f, h) => `Kişisel ödevi iki oturuma bölün: ${f.ders} dersinde ${kz(f, h, "konusundan", "konularından", "öncelikli konulardan")} toplam ${f.soru} soru, her oturumun sonunda da kısa bir yanlış analizi.`,
    (f, h) => `Hedefli pratik için ${f.ders} dersinden ${kz(f, h, "konusunu", "konularını", "öncelikli konuları")} kapsayan ${f.soru} soruluk bir set hazırlayıp kişisel ödev olarak gönderin.`,
    (f, h) => `Öğrencinin ${f.ders} planına ${kz(f, h, "konusu", "konuları", "öncelikli konular")} üzerine ${f.soru} soruluk bir ödev ekleyin; teslimden sonra yanlışları bilgi, dikkat ya da işlem hatası olarak birlikte ayırın.`,
    (f, h) => `İlerlemenin konu bazında görünür olması için ${f.ders} dersinde ${kz(f, h, "konusuna", "konularına", "öncelikli konulara")} yönelik ${f.soru} soruluk kişisel bir set önerilir.`,
  ],

  "koc.brans": [
    (f, h) => `${f.ders} için ${ogIle(f)} kısa bir görüşme ayarlayın${konuVar(f) ? `; ${kz(f, h, "konusunu", "konularını")} gündemin başına koyun` : ""}.`,
    (f, h) => `Bu ay ${ogIle(f)} ${f.ders} için bir etüt saati planlayın${konuVar(f) ? ` ve etüdü ${kz(f, h, "konusuyla", "konularıyla")} açın` : ""}.`,
    (f, h) => `Konu anlatımı desteği için ${ogIle(f)} iletişime geçip ${f.ders} dersinde${konuVar(f) ? ` ${kz(f, h, "konusu", "konuları")} için` : ""} bir etüt talep edin.`,
    (f, h) => `Sınıfta öğrencinin nerede zorlandığını anlamak için ${ogKisa(f)} ${f.ders} üzerine konuşun${konuVar(f) ? `; özellikle ${kz(f, h, "konusunu", "konularını")} sorun` : ""}.`,
    (f) => `Tek seferlik değil düzenli bir destek için ${ogIle(f)} ${f.ders} dersinde haftalık sabit bir etüt saati belirleyin.`,
    (f, h) => `Etüt talebini somut tutun: ${ogIle(f)} görüşürken ${f.ders} dersinde${konuVar(f) ? ` ${kz(f, h, "konusu", "konuları")} için` : ""} en az bir ek ders saati isteyin.`,
    (f) => `Koçluk ödevleriyle sınıftaki anlatım aynı sırada ilerlesin diye ${ogKisa(f)} ${f.ders} konu takvimlerinizi karşılaştırın.`,
    (f, h) => `Okuldaki desteği güçlendirmek için ${f.ders} dersinde ${ogIle(f)} bir etüt görüşmesi önerilir${konuVar(f) ? `; ${kz(f, h, "konusu", "konuları")} ilk sırada olsun` : ""}.`,
  ],

  "koc.yonetim": [
    (f, h) => `${f.ders} dersinde kullanılan ${h.q(f.kitap)} kaynağının öğrencide eksik olduğunu okul yönetimine iletin.`,
    (f, h) => `Okul yönetimine başvurup öğrencinin ${h.q(f.kitap)} kaynağını temin edebilmesi için destek isteyin.`,
    (f, h) => `Kaynak eksiği ${f.ders} ödevlerinin takibini zorlaştırır; ${h.q(f.kitap)} için bu hafta okul yönetimiyle iletişime geçin.`,
    (f, h) => `Öğrencinin elinde ${h.q(f.kitap)} bulunmuyor; ${f.ders} ödevleri aksamadan ilerlesin diye durumu okul yönetimine bildirin.`,
    (f, h) => `Yönetime kısa bir yazılı not düşerek ${f.ders} için gereken ${h.q(f.kitap)} kaynağının sağlanmasını talep edin.`,
    (f, h) => `Kitap eksiği giderilmeden ${f.ders} dersinde düzenli ilerlemek güçleşir; ${h.q(f.kitap)} için okul yönetimine başvurun.`,
    (f, h) => `${f.ders} ödevlerinin aksamaması için ${h.q(f.kitap)} kaynağının okul kütüphanesi ya da yönetim aracılığıyla sağlanması önerilir.`,
    (f, h) => `Geçici çözüm olarak ${f.ders} ödevlerini eldeki kaynaklardan verin; kalıcı çözüm için ${h.q(f.kitap)} eksiğini okul yönetimine iletin.`,
  ],

  "koc.yuk": [
    () => `Haftalık ödev yükünü öğrenciyle birlikte gözden geçirin ve her güne düşen işi netleştirin.`,
    () => `Önümüzdeki haftayı gün gün planlayın; hangi ödevin hangi akşam yapılacağı yazılı olsun.`,
    () => `Ödevleri teslim tarihine göre sıralayıp haftaya dengeli dağıtan basit bir çizelgeyi görüşmede birlikte hazırlayın.`,
    () => `Kısa bir yük kontrolü yapın: haftanın en yoğun gününü bulun ve oradan bir ödevi daha sakin bir güne taşıyın.`,
    () => `Hangi güne kaç ödev ve kaç soru düştüğünü öğrenciyle tek tek sayın; gerçekçi görünmeyen günleri hafifletin.`,
    () => `Okul ödevleri, kişisel ödevler ve serbest çalışma aynı yerde görünsün diye haftalık yükü tek sayfalık bir tabloda toplayın.`,
    () => `Yeni ödev eklemeden önce mevcut ödevleri haftanın günlerine birlikte yerleştirin.`,
    () => `Ödevlerin teslim gününe yığılmasını önlemenin en kısa yolu gün gün bir plan; bu haftanınkini öğrenciyle birlikte kurun.`,
  ],

  "koc.araKontrol": [
    () => `Birden fazla güne yayılan ödevlerde sürenin ortasına kısa bir ara kontrol noktası koyun.`,
    () => `Uzun süreli ödevlerin yarı yolunda öğrenciden o ana kadar çözdüğü soru sayısını girmesini isteyin.`,
    () => `Teslim gününü beklemeden, çok günlük ödevlerin ortasında kısa bir mesajla ilerlemeyi yoklayın.`,
    () => `Takıldığı yerler teslim gününden önce görünsün diye çok günlük her ödeve bir ara kontrol ekleyin.`,
    () => `Beş günlük bir ödevde üçüncü gün, üç günlük bir ödevde ikinci gün küçük bir ilerleme kaydı isteyin.`,
    () => `Çok günlük ödevleri tek teslim yerine iki parçaya bölün ve ilk parçayı ara kontrol olarak ayrıca işaretleyin.`,
    () => `Ara kontrolde yalnızca soru sayısına değil, takılınan soru türüne de bakın; gerekirse planı erkenden düzeltin.`,
    () => `Ödev son güne sıkışmasın diye birkaç güne yayılan her ödevin ortasına bir kontrol tarihi yazın.`,
  ],

  "koc.hedef": [
    (f, h) => `${f.ders} için haftalık ${h.n(f.hedefQ, "soruluk")} açık bir hedef belirleyin.`,
    (f, h) => `Haftalık hedefi ${f.ders} dersinde ${h.n(f.hedefQ, "soru")} olarak koyun ve hafta sonunda birlikte kontrol edin.`,
    (f, h) => `${h.n(f.hedefQ, "soru")}, ${f.ders} için bu haftanın somut hedefi olsun.`,
    (f, h) => `${f.ders} dersindeki ${h.n(f.hedefQ, "soru")} hedefi dört güne bölünürse her güne yaklaşık ${h.n(f.hedefQ / 4, "soru")} düşer; dağılımı öğrenciyle birlikte yapın.`,
    (f, h) => `Belirsiz bir "daha çok çalış" yerine ${f.ders} dersinde haftada ${h.n(f.hedefQ, "soru")} çözme hedefi koyun.`,
    (f, h) => `İlerlemeyi uygulamadaki kayıtlardan izleyebilmek için ${f.ders} dersinde haftalık ${h.n(f.hedefQ, "soru")} hedefini sabitleyin.`,
    (f, h) => `Öğrenciyle ${f.ders} dersinde haftada ${h.n(f.hedefQ, "soru")} üzerinde anlaşın ve bu sayıyı çalışma takvimine yazmasını isteyin.`,
    (f, h) => `Hedef net ve ölçülebilir olsun: bu hafta ${f.ders} dersinde ${h.n(f.hedefQ, "soru")}, hafta sonunda da kayıtlarla kısa bir karşılaştırma.`,
  ],

  "koc.numara": [
    () => `Ödev kayıtlarında yanlış ve boş soru numaralarını da girmesini isteyin; bunu bir kez birlikte yaparak gösterin.`,
    () => `Bir sonraki görüşmede tek bir ödev üzerinden, yanlış ve boş soru numaralarının uygulamaya nasıl girildiğini gösterin.`,
    () => `Soru numaraları girildiğinde hangi soru tipinde takıldığı görünür hale gelir; bir ödev üzerinden bu alanı birlikte doldurun.`,
    () => `Yalnızca doğru-yanlış sayıları değil, hangi soruların yanlış ya da boş kaldığı da kaydedilsin; ilk seferde yanında olun.`,
    () => `Konu bazlı analiz için yanlış ve boş soru numaraları gerekiyor; öğrenciden bunları da girmesini rica edin.`,
    () => `Kayıt ekranındaki yanlış/boş numara alanını birlikte doldurarak iki dakikalık bir gösterim yapın.`,
    () => `Numara girişinin alışkanlığa dönüşmesi için ilk hafta her ödevden sonra kısa bir hatırlatma gönderin.`,
    () => `Numaralar olmadan hangi konunun tekrar istediği görülmüyor; ilk ödevde bu alanı öğrenciyle yan yana doldurun.`,
  ],

  "koc.tekrar": [
    (f, h) => `${f.ders} dersinde ${h.q(f.konu)} konusuna 10–15 soruluk kısa bir tekrar ödevi verin.`,
    (f, h) => `Üzerinden bir süre geçen ${h.q(f.konu)} konusu için bu hafta kısa bir tekrar seti planlayın.`,
    (f, h) => `Aralıklı tekrar mantığıyla ${f.ders} dersinden ${h.q(f.konu)} konusunu küçük bir setle yeniden gündeme alın.`,
    (f, h) => `Unutmanın önüne geçmek için ${h.q(f.konu)} konusunda 15 dakikalık bir tekrar ödevi tanımlayın.`,
    (f, h) => `Tekrar ödevini iki adımda kurun: ${h.q(f.konu)} konusunun özetine kısa bir göz atış, ardından 10–15 soruluk karışık bir set.`,
    (f, h) => `Yeni konular ilerlerken ${h.q(f.konu)} konusunu canlı tutmak için ${f.ders} planına haftada bir, 10 soruluk kısa bir set ekleyin.`,
    (f, h) => `Baştan anlatmaya gerek yok, kısa bir hatırlatma çoğu zaman yeter: ${h.q(f.konu)} konusundan 10–15 soruluk bir set verin.`,
    (f, h) => `Konuyu taze tutmak için iki kısa set yeterli: ${f.ders} dersinde ${h.q(f.konu)} konusundan biri bu hafta, diğeri bir hafta sonra.`,
  ],

  "koc.takdir": [
    (f) => `Görüşmede ${f.neyi} somut olarak takdir edin.`,
    (f, h) => `${h.cap(f.neyi)} görüşmenin ilk dakikalarında açıkça takdir edin.`,
    (f) => `Genel bir "aferin" yerine doğrudan ${f.neyi} takdir edin; neyin iyi gittiğini bilmek öğrenciye yön verir.`,
    (f) => `Emeğin görüldüğünü hissettirmek için ${f.neyi} açıkça vurgulayın.`,
    (f) => `Kısa bir mesajla bile olsa ${f.neyi} fark ettiğinizi öğrenciye söyleyin.`,
    (f) => `Bu ayın öne çıkan noktası olarak ${f.neyi} görüşmede ilk sırada anın.`,
    (f) => `Takdiri kişiliğe değil emeğe bağlayın: "çok zekisin" demek yerine ${f.neyi} ve arkasındaki çabayı konuşun.`,
    (f) => `Somut takdirin etkisi daha kalıcıdır; ${f.neyi} görüşmede ele alın ve bunu nasıl başardığını öğrencinin kendi ağzından dinleyin.`,
  ],

  "koc.zorluk": [
    (f) => `${f.ders} dersinde bir üst zorluk seviyesine geçin ve ödevlere yeni nesil sorular ekleyin.`,
    (f) => `Mevcut seviye rahatça aşıldığından ${f.ders} ödevlerinde daha zor bir kaynağa geçmeyi değerlendirin.`,
    (f) => `Rutin setlerin yerine ${f.ders} için yeni nesil soru blokları koyun; birbirini tekrar eden soru tiplerini azaltın.`,
    (f) => `Öğrencinin güçlü olduğu ${f.ders} dersinde ivmeyi korumak için setlerin üçte birini zor sorulardan oluşturun.`,
    (f) => `Kolay soruları azaltın: ${f.ders} dersinde orta–zor ağırlıklı, yorum gerektiren setlere geçin.`,
    (f) => `Sıradaki adım zorluğu artırmak: ${f.ders} için haftada bir, üst seviye bir kaynaktan süre tutarak set çözdürün.`,
    (f) => `Tavan etkisine takılmamak adına ${f.ders} ödevlerinde uzun köklü, çok adımlı yeni nesil sorulara ağırlık verilmesi önerilir.`,
    (f) => `Rahatça çözülen setler artık pek bir şey katmıyor olabilir; ${f.ders} ödevlerine her hafta deneme ayarında, zor sorulardan oluşan bir blok ekleyin.`,
  ],

  "koc.denge": [
    (f, h) => `Kişisel ödevlerin bir kısmını ${f.kucuk} tarafına kaydırın ve bu hafta o tarafta ${h.n(f.hedef, "soru")} hedefleyin.`,
    (f, h) => `${f.kucuk} tarafı toplam çalışmanın küçük bir parçası; bu hafta kişisel ödevlerle bu tarafa ${h.n(f.hedef, "soru")} ekleyin.`,
    (f, h) => `Bu haftanın kişisel ödev planında ${f.kucuk} derslerine en az ${h.n(f.hedef, "soru")} ayırın.`,
    (f, h) => `Dengeyi kurmak için yeni kişisel ödevlerin ağırlığını ${f.kucuk} derslerine verin; haftalık hedef ${h.n(f.hedef, "soru")} olsun.`,
    (f, h) => `TYT ile AYT arasındaki açığı daraltmak için bu hafta ödevleri ${f.kucuk} tarafında ${h.n(f.hedef, "soru")} çözülecek şekilde yeniden dağıtın.`,
    (f, h) => `Toplam yükü artırmadan ödevlerin bir kısmını ${f.kucuk} derslerine aktarın; bu hafta için ${h.n(f.hedef, "soru")} makul bir başlangıç.`,
    (f, h) => `Sınav iki oturumlu olduğundan ${f.kucuk} tarafı da düzenli pratik ister; ${h.n(f.hedef, "soru")} hedefiyle birkaç kişisel ödevi bu tarafa taşıyın.`,
    (f, h) => `${h.n(f.hedef, "soru")}, bu hafta ${f.kucuk} tarafı için gerçekçi bir hedef; kişisel ödevleri bu sayıya göre yeniden düzenleyin.`,
  ],

  "koc.serbest": [
    (f) => `Serbest çalışma saatlerinin bir kısmını ${odakYon(f)} yönlendirin.`,
    (f) => `Seçim tamamen öğrenciye kaldığında serbest çalışma rahat edilen derslere kayabilir; oturumların yarısını ${odakYon(f)} ayırmasını önerin.`,
    (f) => `Basit bir kural koyun: her iki serbest oturumdan biri ${odakYon(f)} ait olsun.`,
    (f) => `${f.odakDers ? `${f.odakDers} dersindeki` : "Odak dersteki"} ilerlemeyi desteklemek için serbest çalışma zamanından da bu derse pay ayırın.`,
    (f) => `Serbest çalışmanın ders dağılımını birlikte inceleyin ve ağırlığı ${odakYon(f)} kaydırın.`,
    (f) => `Ödev dışı çalışmasına ${odakDen(f)} haftada iki kez 20–30 soruluk bir set eklemesini isteyin.`,
    (f) => `Haftalık planda ${odakYon(f)} ayrılmış en az iki serbest oturum olsun; hangi günler olacağını öğrenciyle birlikte seçin.`,
    (f) => `Kendi seçtiği çalışmalar da hedefe hizmet etsin: serbest zamanın en az üçte biri ${odakYon(f)} gitsin.`,
  ],

  "koc.birebir": [
    (f, h) => `${h.n(f.gun, "gündür")} kayıt yok; bu hafta öğrenciye birebir ulaşın.`,
    (f, h) => `Bu hafta içinde öğrenciyle birebir konuşun; son kayıt ${h.n(f.gun, "gün")} önce girilmiş.`,
    (f, h) => `Son ${h.n(f.gun, "gün")} boyunca kayıt görünmüyor; kısa bir telefon görüşmesi ya da yüz yüze bir sohbetle durumu öğrenin.`,
    (f, h) => `Uzayan sessizliği yazılı hatırlatmalar yerine birebir bir görüşmeyle ele alın; ${h.n(f.gun, "gündür")} kayıt bulunmuyor.`,
    (f, h) => `${h.n(f.gun, "günlük")} kayıt boşluğu için suçlayıcı olmayan, "nasıl gidiyor?" sorusuyla başlayan birebir bir sohbet açın.`,
    (f, h) => `Önceliği bu hafta birebir temasa verin: ${h.n(f.gun, "gündür")} uygulamada kayıt yok, ilk adım kısa ve baskısız bir görüşme olsun.`,
    (f, h) => `Sessizlik ${h.n(f.gun, "günü")} buldu; öğrenciye doğrudan ulaşıp yeniden başlamak için küçük bir ilk adımı birlikte belirleyin.`,
    (f, h) => `Kayıtlar ${h.n(f.gun, "gündür")} durmuş durumda; birebir görüşmede önce öğrencinin nasıl olduğunu sorun, planı sonra konuşun.`,
  ],

  "koc.eskalasyon": [
    (f, h) => `${f.ders} dersi ${h.n(f.aySayisi, "aydır")} odak alanı olarak kalıyor; mevcut planı bırakıp ${ogIle(f)} ortak yeni bir plan kurun.`,
    (f, h) => `Son ${h.n(f.aySayisi, "ayın")} her birinde ${f.ders} odak ders olarak çıktı; ${ogIle(f)} konu sırasını ve kaynakları yeniden belirleyin.`,
    (f, h) => `${h.n(f.aySayisi, "ay")} üst üste odakta kalan ${f.ders} için planı ${ogIle(f)} yeniden kurun; gerekirse veliyi de sürece katın.`,
    (f, h) => `Bu durum ${h.n(f.aySayisi, "aydır")} sürdüğünden ${f.ders} için ${ogIle(f)} bir planlama görüşmesi yapın; gerekirse veliyi de davet edin.`,
    (f, h) => `Plan değişikliğinin zamanı geldi: ${f.ders} dersi ${h.n(f.aySayisi, "aydır")} odak listesinde, bu yüzden ${ogIle(f)} yeni bir çalışma düzeni hazırlayın.`,
    (f, h) => `Yalnızca koçluk ödevleriyle ilerlemek ${h.n(f.aySayisi, "aydır")} süren bir odak alanında yetmeyebilir; ${f.ders} için ${ogIle(f)}, gerekirse veliyi de katarak ortak bir plan yapın.`,
    (f, h) => `Odak durumu ${h.n(f.aySayisi, "aydır")} sürdüğü için ${f.ders} dersinde ${ogIle(f)} ortak bir plan yapılması ve velinin de bilgilendirilmesi önerilir.`,
    (f) => `Gerekirse veliyle de paylaşmak üzere ${ogIle(f)} ${f.ders} için yeni bir plan çıkarın: hedef konular, haftalık etüt saati ve dört hafta sonra bir ara kontrol.`,
  ],
};
