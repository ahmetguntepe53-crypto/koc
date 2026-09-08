import rateLimit from "express-rate-limit";

// PP'deki Postgres-backed store'un aksine burada bellek-içi store yeterli — MVP tek PM2 process'i
// (cluster mode yok) hedefliyor, birden fazla kopyada limit senkronizasyonu gerekmiyor.
const skipInTest = () => process.env.NODE_ENV === "test";
const rateLimitMessage = { error: "Çok fazla deneme yaptın, lütfen biraz sonra tekrar dene." };

// Her çağrı KENDİ bağımsız sayaç deposunu oluşturur. Tek bir limiter örneğini birbiriyle ilgisiz
// birkaç uç noktada (ör. şifremi-unuttum + hesap-silme) paylaşmak, birinde yoğun kullanım olunca
// diğerini de kilitler — okulun paylaşılan NAT IP'si arkasında (aynı Wi-Fi'daki çok sayıda öğrenci
// aynı görünen IP'den istek atar) bu gerçek, kendiliğinden oluşan bir kilitlenme riskidir.
function makeLimiter(limit) {
  return rateLimit({
    windowMs: 15 * 60 * 1000, limit, standardHeaders: true, legacyHeaders: false,
    skip: skipInTest, message: rateLimitMessage,
  });
}

export const authLimiter = makeLimiter(20);
export const forgotPasswordLimiter = makeLimiter(8);
export const resetPasswordLimiter = makeLimiter(8);
export const setPasswordLimiter = makeLimiter(8);
export const deleteAccountLimiter = makeLimiter(8);
