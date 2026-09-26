import { Router } from "express";
import crypto from "crypto";
import path from "node:path";
import { unlink } from "node:fs/promises";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { safeUser } from "../serialize.js";
import { sendPasswordResetEmail } from "../mailer.js";
import { handleErr } from "../handleErr.js";
import { loginLimiter, loginIpLimiter, forgotPasswordLimiter, forgotPasswordIpLimiter, resetPasswordLimiter, setPasswordLimiter, deleteAccountLimiter } from "../middleware/rateLimiters.js";
import { assert, passwordProblem } from "../validators.js";
import { recipientPhotosDir } from "../uploads.js";

// İstemciye dönen kullanıcı — öğrenciye koçunun adı eklenir (ana ekran başlığı "Koçun: …").
async function meResponse(user) {
  if (user.role !== "STUDENT" || !user.teacherId) return safeUser(user);
  const coach = await prisma.user.findUnique({ where: { id: user.teacherId }, select: { id: true, name: true } });
  return { ...safeUser(user), coach };
}

export const authRouter = Router();

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
// 1.1 (26 Eylül 2026): kanıt fotoğrafları, pas geçme sebepleri, koç notları ve son kullanım zamanı eklendi.
const TERMS_VERSION = "1.1";

// tokenVersion token'ın içine gömülür — requireAuth bunu User.tokenVersion ile karşılaştırır. Şifre
// sıfırlanınca/eski şifre geçersiz kılınınca tokenVersion artırılır, bu da o ana kadar üretilmiş
// TÜM eski token'ları (30 günlük süreleri dolmamış olsa bile) anında geçersiz kılar.
function signToken(userId, tokenVersion) {
  return jwt.sign({ userId, tokenVersion }, process.env.JWT_SECRET, { expiresIn: "30d" });
}

// Hesap yokken bcrypt.compare hiç çağrılmazsa, "hesap var" ve "hesap yok" yanıtları arasındaki süre
// farkı (bcrypt ~100ms, DB lookup ~1ms) bir saldırganın kayıtlı e-postaları (öğrenci/veli listesini)
// zamanlama ölçerek çıkarmasına izin verir — bu sahte hash'e karşı yapılan bir compare, süreyi eşitler.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("timing-safety-dummy", 10);

// "Hesap yok", "hesap var ama şifresi henüz belirlenmemiş" ve "şifre yanlış" durumlarının üçü de
// AYNI mesajı döner — farklı mesajlar kayıtlı e-postaların (ve kimin hesabını etkinleştirmediğinin)
// dışarıdan listelenmesine izin verirdi. Mesajın ikinci cümlesi, etkinleştirmemiş öğrenciyi yine de
// doğru yöne yönlendirir.
const LOGIN_FAILED_MESSAGE = "Kullanıcı adı / e-posta veya şifre hatalı. Hesabını henüz etkinleştirmediysen e-postana gelen kurulum bağlantısını kullan.";

// loginLimiter (IP+e-posta) önce çalışır: kendi hesabında kilitlenmiş biri tekrar denedikçe ortak IP
// kotasını (loginIpLimiter) tüketmesin diye.
authRouter.post("/login", loginLimiter, loginIpLimiter, async (req, res) => {
  try {
    // Alan adı geriye dönük uyum için "email" kalır ama değer e-posta YA DA kullanıcı adı (öğrencide
    // okul numarası) olabilir — ikisi de tekil, hangisi eşleşirse (bkz. schema.prisma > User).
    const { email: identifier, password } = req.body || {};
    if (!identifier || !password) return res.status(400).json({ error: "Kullanıcı adı / e-posta ve şifre gerekli" });
    // bcrypt string olmayan bir değerde fırlatır (500) — ör. {"password": 123} doğrudan 400 alsın.
    if (typeof identifier !== "string" || typeof password !== "string") return res.status(400).json({ error: "Kullanıcı adı / e-posta ve şifre gerekli" });
    const cleanId = identifier.trim().toLowerCase();
    const user = await prisma.user.findFirst({ where: { OR: [{ email: cleanId }, { username: cleanId }] } });
    // Hesap yoksa ya da şifresi henüz yoksa da sahte hash'e karşı compare yapılır — süre eşit kalsın.
    const ok = await bcrypt.compare(password, user?.passwordHash || DUMMY_PASSWORD_HASH);
    if (!user || !user.passwordHash || !ok) return res.status(401).json({ error: LOGIN_FAILED_MESSAGE });
    // Askıya alınma bilgisi yalnızca şifre doğrulandıktan SONRA söylenir — aksi halde yanıt, şifreyi
    // bilmeyen birine hesabın var olduğunu (ve banlı olduğunu) sızdırırdı.
    if (user.banned) return res.status(403).json({ error: "Hesabın askıya alınmış — okul yöneticinle iletişime geç." });
    const token = signToken(user.id, user.tokenVersion);
    res.json({ token, user: await meResponse(user) });
  } catch (e) {
    handleErr(res, e);
  }
});

authRouter.post("/forgot-password", forgotPasswordLimiter, forgotPasswordIpLimiter, async (req, res) => {
  try {
    const { email } = req.body || {};
    // String zorunlu: ["x@y.com"] gibi bir dizi String() ile e-postaya dönüşüp IP+e-posta limitini
    // (anahtar yalnızca string e-postadan üretilir) atlatabilirdi.
    if (!email || typeof email !== "string") return res.status(400).json({ error: "E-posta gerekli" });
    const cleanEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    // Hesap yoksa bile aynı genel mesajı döneriz — e-posta adresi kayıtlı mı diye dışarıdan anlaşılmasın.
    // (Yalnızca kullanıcı adıyla giren hesapların e-postası yok — onların şifresini admin belirler.)
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

authRouter.post("/reset-password", resetPasswordLimiter, async (req, res) => {
  try {
    const { token, password, acceptedTerms } = req.body || {};
    if (!token || !password) return res.status(400).json({ error: "token ve password gerekli" });
    if (typeof password !== "string" || password.length < 8) return res.status(400).json({ error: "Şifre en az 8 karakter olmalı" });
    if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(password) || !/[0-9]/.test(password)) return res.status(400).json({ error: "Şifrede en az bir harf ve bir rakam olmalı" });
    const user = await prisma.user.findUnique({ where: { resetToken: String(token) } });
    if (!user || !user.resetTokenExpires || user.resetTokenExpires < new Date()) {
      return res.status(400).json({ error: "Bağlantının süresi dolmuş — okul yöneticinden yeni bir bağlantı iste." });
    }
    // "İlk şifre belirleme" (passwordHash henüz null) sırasında Gizlilik Politikası/KVKK/Kullanım
    // Şartları onayı zorunlu — "şifremi unuttum" akışında (passwordHash zaten var) tekrar sorulmaz,
    // termsAcceptedAt de bu durumda ellenmez (ilk kabul tarihi korunur).
    const isFirstSetup = !user.passwordHash;
    if (isFirstSetup && !acceptedTerms) {
      return res.status(400).json({ error: "Devam etmek için Gizlilik Politikası, KVKK Aydınlatma Metni ve Kullanım Şartları'nı kabul etmelisin." });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash, resetToken: null, resetTokenExpires: null, tokenVersion: { increment: 1 }, mustChangePassword: false,
        ...(isFirstSetup ? { termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION } : {}),
      },
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
    label.terms{display:flex;align-items:flex-start;gap:8px;text-align:left;font-size:12.5px;color:#8A93A8;margin-bottom:14px;cursor:pointer}
    label.terms input{width:auto;margin:2px 0 0;flex-shrink:0}
    label.terms a{color:#8AB4FF}
    button{width:100%;background:#3B5BDB;color:#fff;border:none;border-radius:10px;padding:12px 14px;font-size:14px;font-weight:bold;cursor:pointer}
    button:disabled{opacity:.5;cursor:not-allowed}
    #msg{font-size:13px;margin-top:12px;min-height:18px}</style></head>
    <body><div class="card">${body}</div></body></html>`);
  // Express 4 async handler'daki bir hatayı (ör. DB'ye ulaşılamaması) yakalamaz — yanıt hiç gönderilmez,
  // tarayıcı askıda kalırdı. Kullanıcı e-postadaki linkten geldiği için JSON değil basit bir sayfa döner.
  try {
    const { token } = req.query || {};
    const cleanToken = token ? String(token) : "";
    const user = cleanToken ? await prisma.user.findUnique({ where: { resetToken: cleanToken } }) : null;
    if (!user || !user.resetTokenExpires || user.resetTokenExpires < new Date()) {
      return page(`<h1>Bağlantının süresi dolmuş</h1><p>Okul yöneticinden yeni bir bağlantı istemeni rica ederiz.</p>`);
    }
    // İlk şifre belirleme (passwordHash henüz null) sırasında onay kutusu gösterilir — "şifremi
    // unuttum" akışında (kullanıcı zaten hesabı kurmuş, bir kez onay vermiş) tekrar sorulmaz.
    const isFirstSetup = !user.passwordHash;
    page(`
      <h1>Şifre Belirle</h1>
      <p>Hesabın için bir şifre gir.</p>
      <input id="p1" type="password" placeholder="Şifre (en az 8 karakter)" autocomplete="new-password" />
      <input id="p2" type="password" placeholder="Şifre (tekrar)" autocomplete="new-password" />
      ${isFirstSetup ? `
      <label class="terms">
        <input type="checkbox" id="terms" onchange="document.getElementById('btn').disabled = !this.checked">
        <span><a href="https://kocluk.maiakademi.com/terms.html" target="_blank" rel="noopener">Gizlilik Politikası, KVKK Aydınlatma Metni ve Kullanım Şartları</a>'nı okudum, kabul ediyorum.</span>
      </label>` : ""}
      <button id="btn" onclick="submitReset()" ${isFirstSetup ? "disabled" : ""}>Şifreyi Kaydet</button>
      <div id="msg"></div>
      <script>
        async function submitReset() {
          var p1 = document.getElementById('p1').value;
          var p2 = document.getElementById('p2').value;
          var msg = document.getElementById('msg');
          var btn = document.getElementById('btn');
          var termsEl = document.getElementById('terms');
          if (termsEl && !termsEl.checked) { msg.textContent = 'Devam etmek için metni kabul etmelisin'; msg.style.color = '#FF6B6B'; return; }
          if (p1.length < 8) { msg.textContent = 'Şifre en az 8 karakter olmalı'; msg.style.color = '#FF6B6B'; return; }
          if (p1 !== p2) { msg.textContent = 'Şifreler eşleşmiyor'; msg.style.color = '#FF6B6B'; return; }
          btn.disabled = true; btn.textContent = '...';
          try {
            var r = await fetch('/api/auth/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: ${JSON.stringify(cleanToken)}, password: p1, acceptedTerms: termsEl ? termsEl.checked : undefined }) });
            var data = await r.json();
            if (!r.ok) { msg.textContent = data.error || 'Bir şeyler ters gitti'; msg.style.color = '#FF6B6B'; btn.disabled = false; btn.textContent = 'Şifreyi Kaydet'; return; }
            document.querySelector('.card').innerHTML = '<h1>Şifren kaydedildi!</h1><p>Artık uygulamaya dönüp yeni şifrenle giriş yapabilirsin.</p>';
          } catch (e) {
            msg.textContent = 'Bağlantı hatası, tekrar dene'; msg.style.color = '#FF6B6B'; btn.disabled = false; btn.textContent = 'Şifreyi Kaydet';
          }
        }
      </script>
    `);
  } catch (e) {
    console.error("[reset-password-page]", e);
    if (res.headersSent) return;
    res.status(500);
    page(`<h1>Bir şeyler ters gitti</h1><p>Lütfen biraz sonra bağlantıyı tekrar aç.</p>`);
  }
});

authRouter.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı" });
    res.json({ user: await meResponse(user) });
  } catch (e) {
    handleErr(res, e);
  }
});

// Oturum açıkken kendi şifresini değiştirmek için (mevcut şifreyi bilenler dışında admin'in acil
// "şifreyi doğrudan belirle" uç noktası da var — bkz. routes/admin.js).
authRouter.post("/set-password", setPasswordLimiter, requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword, acceptedTerms } = req.body || {};
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    // Okul numarası herkesçe bilinebilir — kullanıcı adıyla aynı şifre, zorunlu değişikliği anlamsız kılar.
    const problem = passwordProblem(newPassword, user.username);
    if (problem) return res.status(400).json({ error: problem });
    if (user.passwordHash) {
      // İlk girişteki zorunlu değişiklikte kullanıcı az önce bu şifreyle giriş yaptı — tekrar sorulmaz
      // (ilk giriş ekranı yalnızca iki alan). Normal şifre değişikliğinde mevcut şifre gerekli.
      if (!user.mustChangePassword || currentPassword) {
        if (!currentPassword || typeof currentPassword !== "string") return res.status(400).json({ error: "Mevcut şifre gerekli" });
        const ok = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!ok) return res.status(401).json({ error: "Mevcut şifre hatalı" });
      }
      if (await bcrypt.compare(newPassword, user.passwordHash)) return res.status(400).json({ error: "Yeni şifre eskisiyle aynı olamaz" });
    }
    // E-posta kurulum bağlantısından geçmemiş (okul numarasıyla açılmış) hesaplar metinleri burada kabul eder.
    const needsTerms = !user.termsAcceptedAt;
    if (needsTerms && !acceptedTerms) {
      return res.status(400).json({ error: "Devam etmek için Gizlilik Politikası, KVKK Aydınlatma Metni ve Kullanım Şartları'nı kabul etmelisin." });
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash, tokenVersion: { increment: 1 }, mustChangePassword: false,
        ...(needsTerms ? { termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION } : {}),
      },
    });
    const token = signToken(user.id, updated.tokenVersion);
    res.json({ ok: true, token, user: await meResponse(updated) });
  } catch (e) {
    handleErr(res, e);
  }
});

// Kullanıcının kendi hesabını kalıcı olarak silmesi. Öğrenci için: kendi geçmiş verisini (ödevler/
// gönderimler/serbest çalışmalar) silmeyi kendisi istediği için sorun yok. Öğretmen için: naif bir
// cascade (Assignment -> AssignmentRecipient -> Submission/RecipientPhoto) ÖĞRENCİLERİN sonuçlarını/
// kanıt fotoğraflarını da silerdi — bu veri öğretmenin değil, öğrencinin verisidir, öğretmen kendi
// hesabını silerek başkasının verisini yok etme hakkına/rızasına sahip değildir. Bu yüzden bir
// öğretmenin gerçek öğrenci çalışması (Submission ya da RecipientPhoto) biriken bir ödevi varsa
// self-delete reddedilir — admin.js > DELETE /users/:id'deki aynı korumanın öğretmenin KENDİ
// isteğiyle de aşılamamasını sağlar (bkz. o uç noktadaki 409 gerekçesi).
authRouter.delete("/me", deleteAccountLimiter, requireAuth, async (req, res) => {
  try {
    const { password } = req.body || {};
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    assert(user, "Kullanıcı bulunamadı", 404);
    assert(user.passwordHash, "Bu hesap için henüz şifre belirlenmemiş, hesap silinemiyor", 400);
    assert(password && typeof password === "string", "Şifre gerekli", 400);
    const ok = await bcrypt.compare(password, user.passwordHash);
    assert(ok, "Şifre hatalı", 401);

    if (user.role === "TEACHER") {
      const studentWorkCount = await prisma.assignmentRecipient.count({
        where: { assignment: { teacherId: user.id }, OR: [{ submission: { isNot: null } }, { photos: { some: {} } }] },
      });
      assert(studentWorkCount === 0, "Öğrencilerinin girdiği ödev sonuçları/kanıt fotoğrafları var — hesabını silersen bunlar da kaybolur. Bunun yerine okul yöneticinden hesabını askıya almasını (ban) iste.", 409);
      // admin.js > DELETE /users/:id ile AYNI kontrol: henüz hiç ödev/sonuç olmasa bile, hâlâ
      // kendisine atanmış öğrencisi varsa silinemez — aksi halde onDelete:SetNull ile öğrenciler
      // sessizce koçsuz kalırdı.
      const coachedStudents = await prisma.user.count({ where: { teacherId: user.id } });
      assert(coachedStudents === 0, "Sana hâlâ atanmış öğrenciler var — hesabını silersen koçsuz kalırlar. Önce okul yöneticinden onları başka bir koça ata(t)man gerekiyor.", 409);
    }

    // Cascade (bkz. schema.prisma) DB satırlarını temizler ama diskteki kanıt fotoğrafı dosyalarına
    // dokunmaz — hangi dosyaların gideceği, kullanıcıyı silen SAME transaction içinde okunup silinir.
    // Tek transaction, "fotoğraf listesini oku" ile "kullanıcıyı sil" arasına başka bir isteğin
    // (ör. aynı token'la eşzamanlı bir fotoğraf yükleme) girip listeye girmemiş ama cascade'le DB'den
    // silinen bir dosyayı diskte öksüz bırakma penceresini pratikte anlamsız hale getirir.
    const orphanedPhotos = await prisma.$transaction(async (tx) => {
      const photos = await tx.recipientPhoto.findMany({
        where: user.role === "TEACHER" ? { recipient: { assignment: { teacherId: user.id } } } : { recipient: { studentId: user.id } },
        select: { recipientId: true, filename: true },
      });
      if (user.role === "TEACHER") {
        await tx.assignment.deleteMany({ where: { teacherId: user.id } });
      }
      await tx.user.delete({ where: { id: user.id } });
      return photos;
    });
    await Promise.all(orphanedPhotos.map((p) => unlink(path.join(recipientPhotosDir(p.recipientId), p.filename)).catch(() => {})));
    res.json({ ok: true });
  } catch (e) {
    handleErr(res, e);
  }
});
