import jwt from "jsonwebtoken";
import { prisma } from "../db.js";

// Her istekte banned/tokenVersion DB'den yeniden doğrulanır — banlanan bir kullanıcının hâlâ geçerli
// (süresi dolmamış) bir JWT'si olsa bile bir sonraki istekte anında reddedilir. tokenVersion da aynı
// şekilde karşılaştırılır: şifre sıfırlanınca artırılır, böylece o andan önce üretilmiş TÜM eski
// token'lar (30 günlük süreleri dolmamış olsa bile) anında geçersiz kılınır.
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Yetkilendirme gerekli" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { banned: true, tokenVersion: true, role: true },
    });
    if (!user) return res.status(401).json({ error: "Geçersiz veya süresi dolmuş oturum" });
    if (user.banned) return res.status(403).json({ error: "Hesabın askıya alınmış — daha fazla bilgi için okul yöneticinle iletişime geç." });
    if ((payload.tokenVersion || 0) !== user.tokenVersion) {
      return res.status(401).json({ error: "Oturumun geçersiz kılınmış, lütfen tekrar giriş yap" });
    }
    req.userId = payload.userId;
    req.userRole = user.role;
    next();
  } catch {
    return res.status(401).json({ error: "Geçersiz veya süresi dolmuş oturum" });
  }
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
