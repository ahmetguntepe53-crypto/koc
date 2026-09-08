import { Router } from "express";
import { prisma } from "../db.js";
import { handleErr } from "../handleErr.js";

// server/src/app.js'de requireAuth (rol şartı YOK) ile mount edilir — herhangi bir kimliği
// doğrulanmış kullanıcı (öğrenci/öğretmen/admin) okuyabilir. Yazma admin paneline özel
// (bkz. routes/admin.js > PUT /settings).
export const settingsRouter = Router();

settingsRouter.get("/", async (req, res) => {
  try {
    const settings = await prisma.schoolSettings.findUnique({ where: { id: "singleton" } });
    res.json({ yksExamDate: settings?.yksExamDate ?? null, lgsExamDate: settings?.lgsExamDate ?? null });
  } catch (e) {
    handleErr(res, e);
  }
});
