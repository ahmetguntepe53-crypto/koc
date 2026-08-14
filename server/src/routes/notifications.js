import { Router } from "express";
import { prisma } from "../db.js";
import { handleErr } from "../handleErr.js";

// server/src/app.js'de requireAuth ile mount edilir.
export const notificationsRouter = Router();

notificationsRouter.get("/", async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const unreadCount = await prisma.notification.count({ where: { userId: req.userId, read: false } });
    res.json({ notifications, unreadCount });
  } catch (e) {
    handleErr(res, e);
  }
});

notificationsRouter.post("/:id/read", async (req, res) => {
  try {
    // updateMany + userId filtresi: başkasının bildirimini id tahmin ederek okunmuş işaretleyemesin diye.
    await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.userId }, data: { read: true } });
    res.json({ ok: true });
  } catch (e) {
    handleErr(res, e);
  }
});

notificationsRouter.post("/read-all", async (req, res) => {
  try {
    await prisma.notification.updateMany({ where: { userId: req.userId, read: false }, data: { read: true } });
    res.json({ ok: true });
  } catch (e) {
    handleErr(res, e);
  }
});
