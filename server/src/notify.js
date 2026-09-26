import { initializeApp, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import fs from "fs";
import { prisma } from "./db.js";
import { isQuietHours } from "./quietHours.js";

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

// FCM v1'in ham hata detayındaki errorCode (ör. "SENDER_ID_MISMATCH") — firebase-admin bunu kendi
// koduna eşlerken bilgi kaybediyor (bkz. aşağıdaki mismatched-credential notu).
function fcmErrorCode(e) {
  const details = e?.httpResponse?.data?.error?.details;
  if (!Array.isArray(details)) return null;
  return details.find((d) => d?.["@type"] === "type.googleapis.com/google.firebase.fcm.v1.FcmError")?.errorCode || null;
}

// Aboneliğin (token'ın) kalıcı olarak geçersiz olduğu durumlar — silinmezse her bildirimde boşuna
// denenmeye devam eder. firebase-admin 14'te kodlar "messaging/" önekiyle gelir.
function isDeadToken(e) {
  switch (e?.code) {
    case "messaging/registration-token-not-registered": // UNREGISTERED: uygulama silinmiş/token yenilenmiş
    case "messaging/invalid-registration-token":
      return true;
    // Token başka bir Firebase projesine ait (ör. eski/yanlış google-services.json ile kaydolmuş).
    // firebase-admin genel PERMISSION_DENIED'i de (servis hesabının yetkisi yoksa) bu koda eşliyor —
    // o durumda token'lar sağlam, silersek HERKESİN aboneliği giderdi. Bu yüzden yalnızca FCM
    // detayı açıkça SENDER_ID_MISMATCH diyorsa silinir.
    case "messaging/mismatched-credential":
      return fcmErrorCode(e) === "SENDER_ID_MISMATCH";
    // Bozuk formatlı token FCM v1'de INVALID_ARGUMENT döner ("The registration token is not a valid
    // FCM registration token") — aynı kod bozuk payload için de kullanıldığı için mesaja bakılır.
    case "messaging/invalid-argument":
      return /registration token/i.test(e.message || "");
    default:
      return false;
  }
}

const APP_TITLE = "Koçluk";
// Android bildirim kanalı — istemci (src/native/push.js) aynı kimlikle "Ödev bildirimleri" adıyla
// oluşturur; kanalı henüz oluşturmamış eski sürümlerde Android manifest'teki varsayılana düşer.
export const ANDROID_CHANNEL_ID = "odevler";

// Push başlığı bildirimin türünden türetilir (Notification tablosunda ayrıca saklanmaz) — sabah
// gönderilen bekletilmiş push'lar da aynı başlığı alsın diye.
export function pushTitle(type, data) {
  switch (type) {
    case "assignment": return data?.subject ? `Yeni ödev · ${data.subject}` : "Yeni ödev";
    case "assignment_due": return "Bugün son gün";
    case "assignment_overdue":
    case "assignment_overdue_summary": return "Süresi geçen ödev";
    case "monthly_report": return "Aylık raporlar hazır";
    default: return APP_TITLE;
  }
}

// FCM mesajı — badge: iOS'ta uygulama ikonundaki sayı (okunmamış bildirim sayısı; uygulama açılınca
// istemci kendisi günceller/sıfırlar, bkz. src/native/badge.js).
export function buildPushMessage(token, { title, body, data }, badge) {
  return {
    token,
    notification: { title, body },
    data: stringifyData(data),
    android: { priority: "high", notification: { channelId: ANDROID_CHANNEL_ID } },
    apns: {
      headers: { "apns-priority": "10", "apns-push-type": "alert" },
      payload: { aps: { alert: { title, body }, sound: "default", ...(badge != null ? { badge } : {}) } },
    },
  };
}

async function pushToUser(userId, payload) {
  if (!messaging) return;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (!subs.length) return;
  const badge = await prisma.notification.count({ where: { userId, read: false } });
  await Promise.all(subs.map(async (sub) => {
    try {
      await messaging.send(buildPushMessage(sub.token, payload, badge));
    } catch (e) {
      if (isDeadToken(e)) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      } else {
        console.error("[push] gönderilemedi:", e.code || "(code yok)", "-", e.message);
      }
    }
  }));
}

// Uygulamadaki HER bildirim bu iki fonksiyondan (notifyUser/notifyUsers) geçmeli — Notification
// tablosuna kalıcı satır yazmanın yanında, varsa gerçek push aboneliklerine de bildirim gönderir.
// Sessiz saatlerde (23:00-07:00, ör. öğretmen gece planı elle yayınladı) satır hemen yazılır ama
// push bekletilir; sabah flushPendingPushes kullanıcı başına tek push olarak gönderir.
export async function notifyUser(userId, text, { type = "info", data = null, now = new Date() } = {}) {
  const hold = isQuietHours(now);
  const notification = await prisma.notification.create({ data: { userId, text, type, data, pushPending: hold } });
  if (!hold) pushToUser(userId, { title: pushTitle(type, data), body: text, data }).catch((e) => console.error("[push] notifyUser:", e.message));
  return notification;
}

export async function notifyUsers(userIds, text, { type = "info", data = null, now = new Date() } = {}) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return;
  const hold = isQuietHours(now);
  await prisma.notification.createMany({ data: ids.map((userId) => ({ userId, text, type, data, pushPending: hold })) });
  if (hold) return;
  await Promise.all(ids.map((userId) =>
    pushToUser(userId, { title: pushTitle(type, data), body: text, data }).catch((e) => console.error("[push] notifyUsers:", e.message))
  ));
}

// Gece bekletilen bildirimlerin tek push'u: tek bildirimse kendisi, birden çoksa özet — yalnızca
// yeni ödevlerse dersleriyle birlikte ("3 yeni ödev: Matematik, Fizik, Tarih") ödev listesine,
// karışıksa Bildirimler ekranına gider.
export function pendingPushPayload(list) {
  if (list.length === 1) {
    const [n] = list;
    return { title: pushTitle(n.type, n.data), body: n.text, data: n.data };
  }
  if (list.every((n) => n.type === "assignment")) {
    const subjects = [...new Set(list.map((n) => n.data?.subject).filter(Boolean))];
    return { title: `${list.length} yeni ödev`, body: `Gece gelen ödevlerin${subjects.length ? `: ${subjects.join(", ")}` : ""}`, data: { screen: "home" } };
  }
  return { title: APP_TITLE, body: `Gece ${list.length} yeni bildirimin geldi — görmek için dokun.`, data: { screen: "notifications" } };
}

// scheduler.js sessiz saatler bitince (ilk tick'te) çağırır.
export async function flushPendingPushes() {
  const pending = await prisma.notification.findMany({
    where: { pushPending: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, userId: true, text: true, type: true, data: true },
  });
  if (!pending.length) return;
  const byUser = new Map();
  for (const n of pending) {
    if (!byUser.has(n.userId)) byUser.set(n.userId, []);
    byUser.get(n.userId).push(n);
  }
  for (const [userId, list] of byUser) {
    try {
      // Önce işaretlenir: push best-effort'tur, bir hata aynı özeti her dakika yeniden göndermesin.
      await prisma.notification.updateMany({ where: { id: { in: list.map((n) => n.id) } }, data: { pushPending: false } });
      await pushToUser(userId, pendingPushPayload(list));
    } catch (e) {
      console.error(`[push] bekletilen bildirimler gönderilemedi (user ${userId}):`, e.message);
    }
  }
}
