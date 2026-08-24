// FCM push bildirimleri — yalnızca native kabukta çalışır.
//
// Sunucu (server/src/notify.js) firebase-admin ile `messaging.send({ token })` çağırıyor; bu ancak
// FCM kayıt token'ıyla çalışır. @capacitor/push-notifications iOS'ta HAM APNs token'ı döndürdüğü
// için burada Firebase iOS SDK'sını saran @capacitor-firebase/messaging kullanılıyor — döndürdüğü
// token doğrudan /api/push/subscribe'a yazılabilir.
//
// Çalışması için gerekenler (bkz. ios/README-ios.md):
//   1) Firebase Console > iOS uygulaması > GoogleService-Info.plist → ios/App/App/ içine
//   2) Apple Developer > Keys > APNs anahtarı → Firebase Console > Cloud Messaging'e yüklenir
//   3) Xcode > Signing & Capabilities > + > Push Notifications
// Bunlar yokken aşağıdaki çağrılar hata fırlatır; hepsi yutulup uygulama normal çalışmaya devam
// eder (uygulama içi bildirimler zaten Notification tablosundan geliyor).
import { FirebaseMessaging } from "@capacitor-firebase/messaging";
import { api } from "../api.js";
import { isNative } from "./index.js";

let currentToken = null;
let listenersBound = false;

// Aynı cihaz+kurulum başka bir hesapla giriş yaparsa sunucudaki satır o hesaba taşınır
// (push.js > upsert), bu yüzden her başarılı girişten sonra tekrar çağrılması güvenlidir.
export async function registerPush() {
  if (!isNative) return null;
  try {
    let { receive } = await FirebaseMessaging.checkPermissions();
    if (receive === "prompt" || receive === "prompt-with-rationale") {
      ({ receive } = await FirebaseMessaging.requestPermissions());
    }
    if (receive !== "granted") return null;

    bindListeners();
    const { token } = await FirebaseMessaging.getToken();
    if (!token) return null;
    currentToken = token;
    await api.pushSubscribe(token);
    return token;
  } catch (e) {
    // Tipik sebep: GoogleService-Info.plist yok ya da Push Notifications capability açılmamış.
    console.warn("[push] kayıt yapılamadı:", e?.message || e);
    return null;
  }
}

// Çıkışta çağrılır: token sunucudan silinmezse cihaz, ARTIK ÇIKIŞ YAPMIŞ kullanıcının
// bildirimlerini almaya devam ederdi (ortak kullanılan telefonlarda ciddi bir gizlilik sorunu).
export async function unregisterPush() {
  if (!isNative) return;
  const token = currentToken;
  currentToken = null;
  if (!token) return;
  try { await api.pushUnsubscribe(token); } catch (_) { /* çevrimdışıysa sunucu tarafı bir sonraki girişte upsert ile düzelir */ }
  try { await FirebaseMessaging.deleteToken(); } catch (_) { /* token zaten geçersiz olabilir */ }
}

function bindListeners() {
  if (listenersBound) return;
  listenersBound = true;

  // FCM token'ı süresi dolduğunda/yenilendiğinde sessizce değişir — yeni token sunucuya yazılmazsa
  // bildirimler sessizce kesilir.
  FirebaseMessaging.addListener("tokenReceived", ({ token }) => {
    if (!token || token === currentToken) return;
    currentToken = token;
    api.pushSubscribe(token).catch(() => {});
  });

  // Uygulama ÖN PLANDAYKEN gelen bildirim: iOS banner'ı capacitor.config.json >
  // presentationOptions ile zaten gösteriyor; burada yalnızca rozet/liste tazelenir.
  FirebaseMessaging.addListener("notificationReceived", () => {
    window.dispatchEvent(new CustomEvent("kocluk:push"));
  });

  // Kullanıcı bildirime DOKUNDUĞUNDA uygulama açılır — ilgili ekrana yönlendirme App.jsx'te
  // yapılır (data.type/data.id sunucudaki notifyUser çağrılarından gelir).
  FirebaseMessaging.addListener("notificationActionPerformed", (event) => {
    window.dispatchEvent(new CustomEvent("kocluk:push-open", { detail: event?.notification?.data || {} }));
  });
}
