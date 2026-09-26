import { Prisma } from "@prisma/client";
import { alert } from "./alerts.js";

// Beklenmeyen 500'lerin kayan penceresi: son 10 dakikada 5 ya da daha fazlaysa yöneticiye uyarı (bkz. alerts.js — tür
// başına 30 dakikada bir e-posta; eşiğin üstünde kalındıkça gelen her yeni 500 bir sonraki e-postada "N uyarı daha"
// olarak sayılır). Tek tük 500 (ör. bir istemcinin garip isteği) e-posta yağdırmasın; ama DB'nin gitmesi, bozuk bir
// dağıtım ya da bir rotanın her çağrıda patlaması dakikalar içinde fark edilsin.
export const ERROR_WINDOW_MS = 10 * 60 * 1000;
export const ERROR_ALERT_THRESHOLD = 5;
let recent500 = []; // zaman damgaları (ms), eskiden yeniye
let samples = []; // son birkaç hatanın "rota → hata türü" satırı (e-postada hangi uçların patladığı görünsün)

export function _reset500WindowForTest() {
  recent500 = [];
  samples = [];
}

// Rota KALIBI (ör. "GET /api/assignments/:id"), gerçek URL değil: sorgu dizesinde arama metni vb. olabilir, e-postaya
// girmesin. res.req, Express'in yanıt nesnesine bağladığı istek; route yoksa (router dışı) yalnız baseUrl.
function routeOf(res) {
  const req = res?.req;
  if (!req) return "?";
  return `${req.method || "?"} ${req.baseUrl || ""}${req.route?.path || ""}`;
}

// Bir beklenmeyen 500'ü pencereye ekler, eşik aşıldıysa uyarır. Dönüş: pencere içindeki 500 sayısı (testler/teşhis).
export function recordUnexpected500(e, route = "?", now = Date.now()) {
  recent500.push(now);
  while (recent500.length && recent500[0] <= now - ERROR_WINDOW_MS) recent500.shift();
  // Fırtınada bellek büyümesin: eşik çoktan geçildi, fazlası sayıya bir şey katmaz.
  if (recent500.length > 1000) recent500.splice(0, recent500.length - 1000);
  samples.push(`${route} → ${e?.name || "Error"}${e?.code ? ` [${e.code}]` : ""}`);
  if (samples.length > 5) samples.shift();
  const count = recent500.length;
  if (count >= ERROR_ALERT_THRESHOLD) {
    // await edilmez: yanıt e-posta gönderimini beklemesin; alert() asla reddedilmez.
    void alert("http:500", `Son 10 dakikada ${count} beklenmeyen sunucu hatası (500) — kullanıcılar "Sunucu hatası" görüyor.`, {
      "son hatalar": samples.slice(),
      error: e,
    });
  }
  return count;
}

// GÜVENLİK: e.message yalnızca uygulama kodunun BİLEREK fırlattığı, kullanıcıya gösterilmek üzere
// yazılmış hatalarda istemciye döner — bunlar `Object.assign(new Error("..."), { status: XXX })`
// deseniyle .status alanını kendisi set ederek işaretlenir. .status set edilmemiş bir hata
// BEKLENMEYEN bir hatadır (Prisma iç hatası, programlama hatası vb.) — ham mesajı asla istemciye
// sızdırılmaz, sabit genel bir mesaj dönülür.
//
// İstisna: Prisma P2025 ("kayıt bulunamadı") — update/delete'e bilinmeyen bir id verilince fırlar
// (ör. admin'in var olmayan bir kullanıcıyı banlaması). Bu bir sunucu hatası değil, 404'tür.
export function handleErr(res, e) {
  console.error(e);
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
    return res.status(404).json({ error: "Bulunamadı" });
  }
  const status = e.status || 500;
  const message = e.status ? (e.message || "Sunucu hatası") : "Sunucu hatası";
  // Yalnız BEKLENMEYEN 500'ler sayılır: .status'u kodun kendisi koyduysa (403, 503 "yapılandırılmamış" …) bilinçli bir yanıttır.
  if (!e.status) recordUnexpected500(e, routeOf(res));
  res.status(status).json({ error: message });
}
