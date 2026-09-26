import jwt from "jsonwebtoken";
import { prisma } from "../db.js";

// Her istekte banned/tokenVersion DB'den yeniden doğrulanır — banlanan bir kullanıcının hâlâ geçerli
// (süresi dolmamış) bir JWT'si olsa bile bir sonraki istekte anında reddedilir. tokenVersion da aynı
// şekilde karşılaştırılır: şifre sıfırlanınca artırılır, böylece o andan önce üretilmiş TÜM eski
// token'lar (30 günlük süreleri dolmamış olsa bile) anında geçersiz kılınır.
//
// `code` alanı istemci için makine-okunur sinyaldir: SESSION_INVALID gelince mobil istemci oturumu
// kapatır, BANNED gelince askıya alındı ekranını gösterir. Bunların DIŞINDAKİ her hata (ör. DB'ye
// geçici olarak ulaşılamaması) 500 döner — eskiden her istisna 401 sayıldığı için kısa bir DB
// kesintisi herkesi uygulamadan attırıyordu.
const PASSWORD_CHANGE_ALLOWED = new Set([
  "GET /api/auth/me",
  "POST /api/auth/set-password",
  "DELETE /api/auth/me",
  "POST /api/push/subscribe",
  "POST /api/push/unsubscribe",
]);

const LAST_SEEN_THROTTLE_MS = 10 * 60 * 1000;

function sessionInvalid(res, error) {
  return res.status(401).json({ error, code: "SESSION_INVALID" });
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return sessionInvalid(res, "Yetkilendirme gerekli");
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
  } catch (e) {
    // TokenExpiredError ve NotBeforeError da JsonWebTokenError'dan türer.
    if (e instanceof jwt.JsonWebTokenError) return sessionInvalid(res, "Geçersiz veya süresi dolmuş oturum");
    console.error("[auth] token doğrulanamadı:", e);
    return res.status(500).json({ error: "Sunucu hatası" });
  }
  if (typeof payload?.userId !== "string") return sessionInvalid(res, "Geçersiz veya süresi dolmuş oturum");
  let user;
  try {
    user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { banned: true, tokenVersion: true, role: true, mustChangePassword: true, lastSeenAt: true },
    });
  } catch (e) {
    console.error("[auth] kullanıcı doğrulanamadı:", e);
    return res.status(500).json({ error: "Sunucu hatası" });
  }
  if (!user) return sessionInvalid(res, "Geçersiz veya süresi dolmuş oturum");
  if (user.banned) return res.status(403).json({ error: "Hesabın askıya alınmış — daha fazla bilgi için okul yöneticinle iletişime geç.", code: "BANNED" });
  if ((payload.tokenVersion || 0) !== user.tokenVersion) {
    return sessionInvalid(res, "Oturumun geçersiz kılınmış, lütfen tekrar giriş yap");
  }
  // İlk şifresi tahmin edilebilir hesap (okul no / admin geçici şifresi) kendi şifresini belirleyene kadar
  // yalnızca oturum bilgisini alabilir ve şifresini değiştirebilir — istemci bu kodu görünce şifre
  // belirleme ekranını gösterir. Sunucuda da zorlanır: aksi halde istemci atlatılarak veriye erişilebilirdi.
  if (user.mustChangePassword && !PASSWORD_CHANGE_ALLOWED.has(`${req.method} ${req.baseUrl}${req.path}`)) {
    return res.status(403).json({ error: "Devam etmeden önce kendi şifreni belirlemelisin.", code: "PASSWORD_CHANGE_REQUIRED" });
  }
  req.userId = payload.userId;
  req.userRole = user.role;
  // Son kullanım zamanı (koç panosundaki "4 gündür giriş yok") — her istekte değil, en fazla 10 dakikada
  // bir yazılır; isteği bekletmez, yazılamazsa isteği bozmaz.
  const now = Date.now();
  if (!user.lastSeenAt || now - user.lastSeenAt.getTime() > LAST_SEEN_THROTTLE_MS) {
    prisma.user.update({ where: { id: payload.userId }, data: { lastSeenAt: new Date(now) } }).catch(() => {});
  }
  next();
}

// requireAuth'tan SONRA kullanılır. Tek bir isAdmin bayrağı yerine üç rol (ADMIN/TEACHER/STUDENT)
// olduğu için genel bir fabrika — mount ederken izin verilen rolleri sıralamak yeterli, ayrı ayrı
// requireAdmin/requireTeacher/requireStudent middleware'leri çoğaltmaya gerek yok.
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({ error: "Bu işlem için yetkin yok" });
    }
    next();
  };
}
