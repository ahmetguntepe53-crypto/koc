import { Router } from "express";
import { prisma } from "../db.js";
import { handleErr } from "../handleErr.js";

// GENEL erişimli (app.js'de requireAuth OLMADAN mount edilir) — zorunlu güncelleme kontrolü, açılışta
// oturum daha doğrulanmadan/giriş ekranından ÖNCE yapılır (bkz. src/App.jsx). Kimlik gerektirseydi
// eski bir sürümdeki kullanıcı, sunucu API'si uyuşmadığı için giriş isteğinin kendisi patlayabilirdi.
//
// Android ve iOS BAĞIMSIZ sayılır: Play Store ve App Store ayrı ayrı ve farklı hızda onaylanır/yayılır
// (bkz. schema.prisma > SchoolSettings.minAndroidBuild/minIosBuild yorumu) — biri için zorunlu kılınan
// bir sürüm diğer platformdaki kullanıcıyı ASLA etkilemez. Admin bu eşikleri Kurulum > Sistem'den
// yönetir (bkz. routes/admin.js > PUT /settings).
export const appVersionRouter = Router();

appVersionRouter.get("/", async (req, res) => {
  try {
    const settings = await prisma.schoolSettings.findUnique({ where: { id: "singleton" } });
    res.set("Cache-Control", "no-store");
    res.json({ minAndroidBuild: settings?.minAndroidBuild ?? null, minIosBuild: settings?.minIosBuild ?? null });
  } catch (e) {
    handleErr(res, e);
  }
});
