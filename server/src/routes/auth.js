import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { safeUser } from "../serialize.js";
import { sendPasswordResetEmail } from "../mailer.js";
import { handleErr } from "../handleErr.js";
import { authLimiter, strictLimiter } from "../middleware/rateLimiters.js";

export const authRouter = Router();

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

// tokenVersion token'ın içine gömülür — requireAuth bunu User.tokenVersion ile karşılaştırır. Şifre
// sıfırlanınca/eski şifre geçersiz kılınınca tokenVersion artırılır, bu da o ana kadar üretilmiş
// TÜM eski token'ları (30 günlük süreleri dolmamış olsa bile) anında geçersiz kılar.
function signToken(userId, tokenVersion) {
  return jwt.sign({ userId, tokenVersion }, process.env.JWT_SECRET, { expiresIn: "30d" });
}

authRouter.post("/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "E-posta ve şifre gerekli" });
    const cleanEmail = String(email).trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (!user) return res.status(401).json({ error: "E-posta veya şifre hatalı" });
    if (user.banned) return res.status(403).json({ error: "Hesabın askıya alınmış — okul yöneticinle iletişime geç." });
    if (!user.passwordHash) {
      return res.status(400).json({ error: "Bu hesap için henüz şifre belirlenmemiş — e-postana gelen kurulum bağlantısını kullan." });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "E-posta veya şifre hatalı" });
    const token = signToken(user.id, user.tokenVersion);
    res.json({ token, user: safeUser(user) });
  } catch (e) {
    handleErr(res, e);
  }
});

authRouter.post("/forgot-password", strictLimiter, async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: "E-posta gerekli" });
    const cleanEmail = String(email).trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    // Hesap yoksa bile aynı genel mesajı döneriz — e-posta adresi kayıtlı mı diye dışarıdan anlaşılmasın.
    if (user && !user.banned) {
      const resetToken = crypto.randomBytes(32).toString("hex");
      await prisma.user.update({ where: { id: user.id }, data: { resetToken, resetTokenExpires: new Date(Date.now() + RESET_TOKEN_TTL_MS) } });
      sendPasswordResetEmail(cleanEmail, resetToken).catch((e) => console.error("[mailer] gönderilemedi:", e.message));
    }
    res.json({ ok: true });
  } catch (e) {
    handleErr(res, e);
  }
});

authRouter.post("/reset-password", strictLimiter, async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) return res.status(400).json({ error: "token ve password gerekli" });
    if (password.length < 8) return res.status(400).json({ error: "Şifre en az 8 karakter olmalı" });
    const user = await prisma.user.findUnique({ where: { resetToken: String(token) } });
    if (!user || !user.resetTokenExpires || user.resetTokenExpires < new Date()) {
      return res.status(400).json({ error: "Bağlantının süresi dolmuş — okul yöneticinden yeni bir bağlantı iste." });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetToken: null, resetTokenExpires: null, tokenVersion: { increment: 1 } },
    });
    res.json({ ok: true });
  } catch (e) {
    handleErr(res, e);
  }
});

// E-postadaki linke tıklanınca açılır (tarayıcıda doğrudan, SPA fetch ile değil) — hem "ilk şifre
// belirleme" (admin hesap oluşturunca) hem "şifremi unuttum" akışı aynı sayfayı/uç noktayı paylaşır.
authRouter.get("/reset-password-page", async (req, res) => {
  const page = (body) => res.send(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Şifre Belirle</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>body{font-family:Arial,sans-serif;background:#0F1420;color:#EDEFF4;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:24px;box-sizing:border-box}
    div.card{max-width:360px;width:100%}h1{font-size:20px}p{color:#8A93A8;font-size:14px}
    input{width:100%;box-sizing:border-box;background:#181F30;border:1px solid #2A3348;border-radius:10px;padding:12px 14px;color:#EDEFF4;font-size:14px;margin-bottom:10px;outline:none}
    button{width:100%;background:#3B5BDB;color:#fff;border:none;border-radius:10px;padding:12px 14px;font-size:14px;font-weight:bold;cursor:pointer}
    #msg{font-size:13px;margin-top:12px;min-height:18px}</style></head>
    <body><div class="card">${body}</div></body></html>`);
  const { token } = req.query || {};
  const cleanToken = token ? String(token) : "";
  const user = cleanToken ? await prisma.user.findUnique({ where: { resetToken: cleanToken } }) : null;
  if (!user || !user.resetTokenExpires || user.resetTokenExpires < new Date()) {
    return page(`<h1>Bağlantının süresi dolmuş</h1><p>Okul yöneticinden yeni bir bağlantı istemeni rica ederiz.</p>`);
  }
  page(`
    <h1>Şifre Belirle</h1>
    <p>Hesabın için bir şifre gir.</p>
    <input id="p1" type="password" placeholder="Şifre (en az 8 karakter)" autocomplete="new-password" />
    <input id="p2" type="password" placeholder="Şifre (tekrar)" autocomplete="new-password" />
    <button id="btn" onclick="submitReset()">Şifreyi Kaydet</button>
    <div id="msg"></div>
    <script>
      async function submitReset() {
        var p1 = document.getElementById('p1').value;
        var p2 = document.getElementById('p2').value;
        var msg = document.getElementById('msg');
        var btn = document.getElementById('btn');
        if (p1.length < 8) { msg.textContent = 'Şifre en az 8 karakter olmalı'; msg.style.color = '#FF6B6B'; return; }
        if (p1 !== p2) { msg.textContent = 'Şifreler eşleşmiyor'; msg.style.color = '#FF6B6B'; return; }
        btn.disabled = true; btn.textContent = '...';
        try {
          var r = await fetch('/api/auth/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: ${JSON.stringify(cleanToken)}, password: p1 }) });
          var data = await r.json();
          if (!r.ok) { msg.textContent = data.error || 'Bir şeyler ters gitti'; msg.style.color = '#FF6B6B'; btn.disabled = false; btn.textContent = 'Şifreyi Kaydet'; return; }
          document.querySelector('.card').innerHTML = '<h1>Şifren kaydedildi!</h1><p>Artık uygulamaya dönüp yeni şifrenle giriş yapabilirsin.</p>';
        } catch (e) {
          msg.textContent = 'Bağlantı hatası, tekrar dene'; msg.style.color = '#FF6B6B'; btn.disabled = false; btn.textContent = 'Şifreyi Kaydet';
        }
      }
    </script>
  `);
});

authRouter.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı" });
    res.json({ user: safeUser(user) });
  } catch (e) {
    handleErr(res, e);
  }
});

// Oturum açıkken kendi şifresini değiştirmek için (mevcut şifreyi bilenler dışında admin'in acil
// "şifreyi doğrudan belirle" uç noktası da var — bkz. routes/admin.js).
authRouter.post("/set-password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: "Yeni şifre en az 8 karakter olmalı" });
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (user.passwordHash) {
      if (!currentPassword) return res.status(400).json({ error: "Mevcut şifre gerekli" });
      const ok = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!ok) return res.status(401).json({ error: "Mevcut şifre hatalı" });
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    });
    const token = signToken(user.id, user.tokenVersion + 1);
    res.json({ ok: true, token });
  } catch (e) {
    handleErr(res, e);
  }
});
