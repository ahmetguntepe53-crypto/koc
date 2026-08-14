import { initializeApp, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import fs from "fs";
import { prisma } from "./db.js";

// Firebase Admin SDK, servis hesabı anahtarıyla başlatılır (Firebase Console > Proje Ayarları >
// Servis Hesapları > Yeni özel anahtar oluştur). Bu proje kendi Firebase projesine bağlanmalı —
// PP'nin (yedisekiz) service account'uyla PAYLAŞILMAMALI. Anahtar yoksa push sessizce devre dışı
// kalır, yalnızca uygulama içi (Notification tablosu) bildirim yazılmaya devam eder — bu sayede
// Faz 3 push kurulmadan da (Firebase projesi açılana kadar) test edilebilir.
const SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
let messaging = null;
if (SERVICE_ACCOUNT_PATH && fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  try {
    const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8"));
    const app = initializeApp({ credential: cert(serviceAccount) });
    messaging = getMessaging(app);
  } catch (e) {
    console.error("[push] Firebase Admin başlatılamadı:", e.message);
  }
} else {
  console.log("[push] FIREBASE_SERVICE_ACCOUNT_PATH tanımlı değil/dosya yok — push bildirimi gönderilmeyecek (yalnızca uygulama içi bildirim yazılacak).");
}

function stringifyData(data) {
  if (!data) return undefined;
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]));
}

async function pushToUser(userId, payload) {
  if (!messaging) return;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (!subs.length) return;
  await Promise.all(subs.map(async (sub) => {
    try {
      await messaging.send({
        token: sub.token,
        notification: { title: payload.title, body: payload.body },
        data: stringifyData(payload.data),
        android: { priority: "high" },
        apns: {
          headers: { "apns-priority": "10", "apns-push-type": "alert" },
          payload: { aps: { alert: { title: payload.title, body: payload.body }, sound: "default" } },
        },
      });
    } catch (e) {
      if (e.code === "messaging/registration-token-not-registered" || e.code === "messaging/invalid-registration-token") {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      } else {
        console.error("[push] gönderilemedi:", e.code || "(code yok)", "-", e.message);
      }
    }
  }));
}

// Uygulamadaki HER bildirim bu iki fonksiyondan (notifyUser/notifyUsers) geçmeli — Notification
// tablosuna kalıcı satır yazmanın yanında, varsa gerçek push aboneliklerine de bildirim gönderir.
export async function notifyUser(userId, text, { type = "info", data = null } = {}) {
  const notification = await prisma.notification.create({ data: { userId, text, type, data } });
  pushToUser(userId, { title: "Kocluk", body: text, data }).catch((e) => console.error("[push] notifyUser:", e.message));
  return notification;
}

export async function notifyUsers(userIds, text, { type = "info", data = null } = {}) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return;
  await prisma.notification.createMany({ data: ids.map((userId) => ({ userId, text, type, data })) });
  await Promise.all(ids.map((userId) =>
    pushToUser(userId, { title: "Kocluk", body: text, data }).catch((e) => console.error("[push] notifyUsers:", e.message))
  ));
}
