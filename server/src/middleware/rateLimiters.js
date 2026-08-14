import rateLimit from "express-rate-limit";

// PP'deki Postgres-backed store'un aksine burada bellek-içi store yeterli — MVP tek PM2 process'i
// (cluster mode yok) hedefliyor, birden fazla kopyada limit senkronizasyonu gerekmiyor.
const skipInTest = () => process.env.NODE_ENV === "test";
const rateLimitMessage = { error: "Çok fazla deneme yaptın, lütfen biraz sonra tekrar dene." };

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false,
  skip: skipInTest, message: rateLimitMessage,
});

export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false,
  skip: skipInTest, message: rateLimitMessage,
});
