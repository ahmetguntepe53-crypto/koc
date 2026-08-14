import { Router } from "express";
import { prisma } from "../db.js";
import { handleErr } from "../handleErr.js";

// server/src/app.js'de requireAuth ile mount edilir.
export const pushRouter = Router();

// Cihaz FCM'den bir kayıt token'ı alınca buraya kaydedilir. Aynı token (aynı cihaz+uygulama
// kurulumu) farklı bir hesapla tekrar kaydolursa satır o hesaba güncellenir — aksi halde paylaşılan
// bir cihazda önceki kullanıcıya da bildirim gitmeye devam ederdi.
pushRouter.post("/subscribe", async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: "token gerekli" });
    await prisma.pushSubscription.upsert({
      where: { token },
      update: { userId: req.userId },
      create: { userId: req.userId, token },
    });
    res.status(201).json({ ok: true });
  } catch (e) {
    handleErr(res, e);
  }
});

pushRouter.post("/unsubscribe", async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: "token gerekli" });
    await prisma.pushSubscription.deleteMany({ where: { token, userId: req.userId } });
    res.json({ ok: true });
  } catch (e) {
    handleErr(res, e);
  }
});
