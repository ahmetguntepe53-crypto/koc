// Canlı hata uyarıları: beklenmeyen bir şey olduğunda (süreç düzeyinde yakalanmamış hata, kısa sürede üst üste 500'ler,
// patlayan ya da duran zamanlayıcı) yöneticiye e-posta. Daha önce bunların hepsi yalnızca pm2 loglarına düşüyordu —
// kimse loglara bakmadıkça sunucunun yarı çalıştığı (ör. ödevlerin otomatik yayınlanmadığı) günlerce fark edilmiyordu.
//
// Tasarım kuralları:
//  • ASLA fırlatmaz, dönen promise ASLA reddedilmez: çağıranların çoğu (unhandledRejection/uncaughtException
//    dinleyicileri, handleErr, zamanlayıcı) zaten bir hatanın ortasında — uyarının kendi hatası yeni bir
//    unhandledRejection'a dönüşüp kendini sonsuza dek tetiklememeli. Çağıranlar await etmeden (fire-and-forget) çağırır.
//  • Tür (kind) başına 30 dakikada en fazla BİR e-posta. Arada gelenler sayılır ve bir sonraki e-postada "N uyarı daha"
//    diye bildirilir — çöken bir DB dakikada yüzlerce hata üretir; posta kutusu da, Resend kotası da (şifre kurulum
//    e-postalarıyla AYNI seri kuyruk, bkz. mailer.js) boğulmasın.
//  • E-posta yapılandırılmamışsa (RESEND_API_KEY ya da alıcı yok) no-op: yalnız log. Yerel geliştirme ve testler böyle.
//  • KVKK: uyarı gövdesine öğrencinin (reşit olmayan) kişisel verisi GİRMEZ — kimlikler olur, ad/e-posta/telefon olmaz.
//    Hata mesajları bu yüzden describeError'dan geçer: Prisma'nın doğrulama/istek hataları sorgu argümanlarını (ör.
//    `data: { name: "…" }`) mesajın içine yazdığı için onların mesajı hiç alınmaz, yalnız kodu; diğer mesajlarda
//    e-posta adresi ve uzun rakam dizileri (telefon, T.C. kimlik no) maskelenir.
import os from "node:os";
import { sendAlertEmail } from "./mailer.js";

export const ALERT_RATE_WINDOW_MS = 30 * 60 * 1000;

// kind → { lastSentAt, suppressed }. Süreç belleğinde: yeniden başlatma sayacı sıfırlar — bilerek, yeniden başlama
// sonrası ilk hata yine haber verilsin. Tür sayısı kodda sabit (process:*, http:500, scheduler:<adım>), sınırsız büyümez.
const state = new Map();

// Testler için: her dosya/senaryo temiz sayaçla başlasın.
export function _resetAlertsForTest() {
  state.clear();
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// 7+ haneli rakam dizileri: telefon (5xx xxx xx xx), T.C. kimlik no (11 hane), okul numarası uzun olabilir.
const LONG_DIGITS_RE = /\d[\d ]{5,}\d/g;
const MAX_TEXT = 300;

function mask(text) {
  return String(text).replace(EMAIL_RE, "<e-posta>").replace(LONG_DIGITS_RE, "<sayı>");
}

function clip(text, max = MAX_TEXT) {
  const s = String(text);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

// Prisma'nın sorgu argümanlarını mesajına gömebilen hata türleri — mesajları alınmaz. Başlatma hatası (P1001 "Can't
// reach database server") ve Rust paniği kişisel veri taşımaz, mesajları teşhis için gerekli: onlar alınır.
const PRISMA_OPAQUE = new Set(["PrismaClientValidationError", "PrismaClientKnownRequestError", "PrismaClientUnknownRequestError"]);

// Bir hatayı e-postaya güvenle konabilecek birkaç satıra indirger: tür, kod, (güvenliyse) maskelenmiş mesaj, yığının ilk
// satırları (dosya:satır — hangi rota/adım olduğunu gösterir, veri içermez).
export function describeError(err) {
  if (err == null) return "(boş hata)";
  if (!(err instanceof Error)) {
    // Error olmayan bir değerle reddedilmiş promise: nesne ise içeriği (belki bir sorgu sonucu) YAZILMAZ, yalnız türü.
    return typeof err === "string" ? `Error olmayan değer (string): ${clip(mask(err))}` : `Error olmayan değer (${typeof err})`;
  }
  const lines = [];
  const code = err.code || err.errorCode;
  lines.push(`${err.name || "Error"}${code ? ` [${code}]` : ""}`);
  if (PRISMA_OPAQUE.has(err.name)) {
    // meta.modelName / meta.target alan ADLARIDIR (ör. ["email"]), değer değil.
    if (err.meta?.modelName) lines.push(`model: ${err.meta.modelName}`);
    if (err.meta?.target) lines.push(`alan: ${[].concat(err.meta.target).join(", ")}`);
    lines.push("(Prisma mesajı sorgu verisi içerebileceği için e-postaya eklenmedi — ayrıntı sunucu loglarında)");
  } else if (err.message) {
    lines.push(clip(mask(err.message)));
  }
  const frames = String(err.stack || "").split("\n").filter((l) => /^\s+at /.test(l)).slice(0, 6).map((l) => `  ${mask(l.trim())}`);
  if (frames.length) lines.push(...frames);
  return lines.join("\n");
}

function detailLines(details) {
  if (!details || typeof details !== "object") return [];
  const out = [];
  for (const [key, value] of Object.entries(details)) {
    if (value === undefined) continue;
    if (key === "error") out.push(`hata:\n${describeError(value)}`);
    else if (Array.isArray(value)) out.push(`${key}:\n${value.map((v) => `  - ${clip(mask(v))}`).join("\n")}`);
    else out.push(`${key}: ${clip(mask(value))}`);
  }
  return out;
}

// Türkiye saatiyle okunur zaman damgası (UTC+3, yaz saati yok — bkz. quietHours.js).
function trStamp(ms) {
  return `${new Date(ms + 3 * 3600e3).toISOString().slice(0, 16).replace("T", " ")} (TR)`;
}

// Uyarı gönderir (ya da hız sınırına takılırsa sayar). Dönüş: e-posta gerçekten gönderildiyse true. Asla reddedilmez.
//   kind    — sabit bir tür adı ("process:uncaughtException", "http:500", "scheduler:publishDueAssignments"); hız sınırı
//             ve e-posta konusu buna göre.
//   message — koddan gelen, insan okuyacak tek cümle. Kişisel veri İÇERMEMELİ (ad yerine id).
//   details — { error?: Error, <etiket>: değer | [değerler] } — error describeError'dan, diğerleri maskelenerek geçer.
export async function alert(kind, message, details) {
  try {
    const now = Date.now();
    let s = state.get(kind);
    if (!s) state.set(kind, (s = { lastSentAt: -Infinity, suppressed: 0 }));
    if (now - s.lastSentAt < ALERT_RATE_WINDOW_MS) {
      s.suppressed += 1;
      console.error(`[alert] ${kind}: ${message} (hız sınırı — e-posta gönderilmedi, bekleyen ${s.suppressed})`);
      return false;
    }
    const suppressed = s.suppressed;
    // Pencere, gönderim DENENMEDEN önce kapanır: gönderim sürerken (Resend yeniden denemeleri ~14 sn) gelen aynı türden
    // uyarılar ikinci bir e-posta başlatmasın.
    s.lastSentAt = now;
    s.suppressed = 0;
    console.error(`[alert] ${kind}: ${message}`);

    const to = (process.env.ALERT_EMAIL || process.env.ADMIN_EMAIL || "").trim();
    if (!to) {
      console.error("[alert] ALERT_EMAIL/ADMIN_EMAIL tanımlı değil — uyarı yalnız loglandı.");
      return false;
    }
    const text = [
      "Koçluk sunucu uyarısı",
      `Tür: ${kind}`,
      `Zaman: ${trStamp(now)}`,
      `Sunucu: ${os.hostname()} (pid ${process.pid})`,
      ...(suppressed ? [`Bu türden son e-postadan beri ${suppressed} uyarı daha oldu (hız sınırı: 30 dakikada bir e-posta).`] : []),
      "",
      String(message),
      ...(details ? ["", ...detailLines(details)] : []),
    ].join("\n");
    const subject = `[Koçluk uyarı] ${kind}${suppressed ? ` (+${suppressed})` : ""}`;
    let sent;
    try {
      sent = await sendAlertEmail({ to, subject, text });
    } catch (e) {
      // Gönderilemeyen uyarı kaybolmasın: sayısı bir sonraki e-postaya eklenir. Pencere yine kapalı kalır — Resend
      // çöktüyse her hata yeni bir (yeniden denemeli) gönderim başlatıp kuyruğu tıkamasın.
      s.suppressed += suppressed + 1;
      console.error(`[alert] ${kind} e-postası gönderilemedi:`, e?.message);
      return false;
    }
    return sent === true;
  } catch (e) {
    try {
      console.error("[alert] beklenmeyen hata:", e?.message);
    } catch {
      // console bile yoksa yapılacak bir şey yok.
    }
    return false;
  }
}
