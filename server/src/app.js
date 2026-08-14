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
import { requireAuth, requireRole } from "./middleware/auth.js";

export const app = express();

// contentSecurityPolicy KAPALI: auth.js > /reset-password-page statik (kullanıcı girdisi içermeyen)
// inline <style>/<script> üretir — helmet'in varsayılan CSP'si bunu bloklayıp şifre belirleme
// formunu kırar (PP'deki server/src/app.js ile aynı gerekçe/çözüm).
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

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

// Bilinmeyen /api/* rotaları için genel 404 — istemci tarafında "sunucudan boş HTML döndü" gibi
// anlaşılması güç hatalar yerine net bir JSON hata mesajı görülsün diye.
app.use("/api", (req, res) => res.status(404).json({ error: "Bulunamadı" }));
