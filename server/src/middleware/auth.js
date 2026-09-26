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
      select: { banned: true, tokenVersion: true, role: true },
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
  req.userId = payload.userId;
  req.userRole = user.role;
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
