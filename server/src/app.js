import path from "node:path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { authRouter } from "./routes/auth.js";
import { adminRouter } from "./routes/admin.js";
import { assignmentsRouter } from "./routes/assignments.js";
import { teacherRouter } from "./routes/teacher.js";
import { notificationsRouter } from "./routes/notifications.js";
import { pushRouter } from "./routes/push.js";
import { assignmentRecipientsRouter } from "./routes/assignmentRecipients.js";
import { studySessionsRouter } from "./routes/studySessions.js";
import { statsRouter } from "./routes/stats.js";
import { planEntriesRouter } from "./routes/planEntries.js";
import { settingsRouter } from "./routes/settings.js";
import { requireAuth, requireRole } from "./middleware/auth.js";

export const app = express();

// Nginx arkasında çalışırken X-Forwarded-For header'ı Express tarafından güvenilir kabul edilmezse
// express-rate-limit ERR_ERL_UNEXPECTED_X_FORWARDED_FOR fırlatır (PP'deki server/src/app.js ile
// aynı gerekçe/çözüm — orada da gerçek reverse proxy'nin arkasına geçince ortaya çıkmıştı).
app.set("trust proxy", 1);

// contentSecurityPolicy KAPALI: auth.js > /reset-password-page statik (kullanıcı girdisi içermeyen)
// inline <style>/<script> üretir — helmet'in varsayılan CSP'si bunu bloklayıp şifre belirleme
// formunu kırar (PP'deki server/src/app.js ile aynı gerekçe/çözüm).
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

// Kanıt fotoğrafları requireAuth OLMADAN servis edilir: <img src> tarayıcıdan Authorization header'ı
// gönderemez, token'ı URL'e koymak (query param) log/tarayıcı geçmişinde sızdırır. Bunun yerine
// dosya adları crypto.randomUUID() (bkz. uploads.js) — 122 bitlik rastgele değer tahmin edilemez,
// klasör de recipientId (cuid) olduğu için link'i bilmeyen biri fotoğrafa ulaşamaz.
// crossOriginResourcePolicy "cross-origin" YALNIZCA bu route'a uygulanır: web (kocluk.maiakademi.com)
// ve API farklı origin'de (api.kocluk.maiakademi.com) olduğu için helmet'in varsayılan "same-origin"
// CORP'si <img> ile yüklenmeyi engeller — geri kalan /api/* yanıtları helmet'in varsayılan (daha
// sıkı) CORP'siyle korunmaya devam eder.
app.use("/uploads", helmet.crossOriginResourcePolicy({ policy: "cross-origin" }), express.static(path.join(process.cwd(), "uploads")));

app.use("/api/auth", authRouter);
app.use("/api/admin", requireAuth, requireRole("ADMIN"), adminRouter);
// assignmentsRouter rol karışık kullanır (TEACHER yazar, ADMIN yalnızca okur) — requireRole burada
// uygulanmaz, her handler req.userRole'e kendi içinde bakar.
app.use("/api/assignments", requireAuth, assignmentsRouter);
app.use("/api/teacher", requireAuth, requireRole("TEACHER"), teacherRouter);
app.use("/api/notifications", requireAuth, notificationsRouter);
app.use("/api/push", requireAuth, pushRouter);
// assignmentRecipientsRouter ve studySessionsRouter da rol karışık kullanır (STUDENT yazar,
// TEACHER/ADMIN yalnızca kendi öğrencileri için okur) — requireRole burada uygulanmaz.
app.use("/api/assignment-recipients", requireAuth, assignmentRecipientsRouter);
app.use("/api/study-sessions", requireAuth, studySessionsRouter);
app.use("/api/stats", requireAuth, statsRouter);
app.use("/api/plan-entries", requireAuth, requireRole("TEACHER"), planEntriesRouter);
app.use("/api/settings", requireAuth, settingsRouter);

// Bilinmeyen /api/* rotaları için genel 404 — istemci tarafında "sunucudan boş HTML döndü" gibi
// anlaşılması güç hatalar yerine net bir JSON hata mesajı görülsün diye.
app.use("/api", (req, res) => res.status(404).json({ error: "Bulunamadı" }));
