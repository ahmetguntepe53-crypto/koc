import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// PP'deki Postgres-backed store'un aksine burada bellek-içi store yeterli — MVP tek PM2 process'i
// (cluster mode yok) hedefliyor, birden fazla kopyada limit senkronizasyonu gerekmiyor.
const skipInTest = () => process.env.NODE_ENV === "test";
const rateLimitMessage = { error: "Çok fazla deneme yaptın, lütfen biraz sonra tekrar dene." };

// Her çağrı KENDİ bağımsız sayaç deposunu oluşturur. Tek bir limiter örneğini birbiriyle ilgisiz
// birkaç uç noktada (ör. şifremi-unuttum + hesap-silme) paylaşmak, birinde yoğun kullanım olunca
// diğerini de kilitler — okulun paylaşılan NAT IP'si arkasında (aynı Wi-Fi'daki çok sayıda öğrenci
// aynı görünen IP'den istek atar) bu gerçek, kendiliğinden oluşan bir kilitlenme riskidir.
function makeLimiter(limit, options = {}) {
  return rateLimit({
    windowMs: 15 * 60 * 1000, limit, standardHeaders: true, legacyHeaders: false,
    skip: skipInTest, message: rateLimitMessage, ...options,
  });
}

// IP + normalize edilmiş e-posta: aynı NAT IP'sinin arkasındaki bir sınıf dolusu öğrenci birbirinin
// kotasını tüketmesin diye her hesap kendi sayacını alır. IP kısmı ipKeyGenerator'dan geçer (IPv6'da
// /56 alt ağına indirger — aksi halde tek bir IPv6 kullanıcısı adres değiştirerek limiti atlatabilirdi).
// E-posta string değilse boş anahtar kullanılır (handler zaten 400 döner); uzunluk sınırı, bellek-içi
// store'a devasa anahtarlar yazılmasın diye.
function ipAndEmailKey(req) {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase().slice(0, 254) : "";
  return `${ipKeyGenerator(req.ip)}|${email}`;
}

// Giriş: yalnızca BAŞARISIZ denemeler sayılır (skipSuccessfulRequests) — sabah aynı Wi-Fi'dan giriş
// yapan 30 öğrenci kimseyi kilitlemez. Hesap başına 20 hata; IP başına 200 hata ise çok sayıda farklı
// e-posta üzerinden yapılan kaba kuvvete karşı ikinci bir sigorta.
export const loginLimiter = makeLimiter(20, { keyGenerator: ipAndEmailKey, skipSuccessfulRequests: true });
export const loginIpLimiter = makeLimiter(200, { skipSuccessfulRequests: true });
// Şifremi unuttum her durumda genel bir 200 döner (hesap var mı sızdırılmasın diye) — bu yüzden
// skipSuccessfulRequests burada KULLANILMAZ, kullanılsaydı her istek "başarılı" sayılıp limit hiç
// dolmaz, bir adrese sınırsız e-posta yağdırılabilirdi.
export const forgotPasswordLimiter = makeLimiter(5, { keyGenerator: ipAndEmailKey });
export const forgotPasswordIpLimiter = makeLimiter(100);
export const resetPasswordLimiter = makeLimiter(20, { skipSuccessfulRequests: true });
export const setPasswordLimiter = makeLimiter(20, { skipSuccessfulRequests: true });
export const deleteAccountLimiter = makeLimiter(20, { skipSuccessfulRequests: true });
