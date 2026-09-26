import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.MAIL_FROM || "Kocluk <no-reply@kocluk.local>";
// NODE_ENV bu projede hiçbir yerde "production" olarak set edilmiyor (yalnızca "test" kontrol
// ediliyor, bkz. middleware/rateLimiters.js) — o yüzden prod/dev ayrımı için daha güvenilir bir
// sinyal olan API_PUBLIC_URL kullanılır (.env.example: yerelde her zaman localhost, prod'da gerçek
// alan adı). RESEND_API_KEY yanlışlıkla prod'da tanımsız kalırsa, tek seferlik gizli token'ların
// (şifre kurulum/sıfırlama linki) düz metin olarak sunucu loglarına düşmesini engellemek için.
const isLocalDev = (process.env.API_PUBLIC_URL || "").includes("localhost");

// Tüm gönderimler tek bir seri kuyruktan geçer: aynı anda en fazla BİR istek, ardışık iki isteğin
// başlangıcı arasında en az MIN_SEND_INTERVAL_MS. Toplu içe aktarma (admin.js > /users/bulk-import,
// 500 satıra kadar) her satır için neredeyse aynı anda bir gönderim başlatıyordu — Resend'in
// varsayılan ~2 istek/sn sınırı yüzünden çoğu 429 alıp sessizce kayboluyordu.
const MIN_SEND_INTERVAL_MS = 600;
const RATE_LIMIT_RETRY_DELAYS_MS = [2000, 4000, 8000];
const NETWORK_RETRY_DELAY_MS = 2000;
let queueTail = Promise.resolve();
let lastSendStartedAt = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Günlük/aylık kota aşımı da 429 döner ama beklemekle düzelmez — yeniden denenirse kuyruktaki her
// e-posta ~14 sn bekletip tüm kuyruğu saatlerce tıkardı.
function isRateLimitError(error) {
  if (error?.name === "rate_limit_exceeded") return true;
  return error?.statusCode === 429 && !/quota/i.test(error?.name || "");
}

// Resend SDK ağ hatasında fırlatmaz, statusCode'u null olan bir { error } döner.
function isNetworkError(error) {
  return error?.statusCode == null && error?.name === "application_error";
}

// resend.emails.send() API hatalarında promise'i REDDETMEZ — { data: null, error: {...} } döner.
// Bunu kontrol etmezsek gönderim sessizce başarısız olur, çağıran tarafın .catch()'i hiç tetiklenmez.
// Yeniden deneme beklemeleri kuyruğu da bekletir — bilerek: Resend bizi sınırlıyorsa sıradaki
// e-postaların da hemen gönderilmesinin anlamı yok.
async function sendWithRetry(payload) {
  let rateLimitRetries = 0;
  let networkRetried = false;
  for (;;) {
    const wait = lastSendStartedAt + MIN_SEND_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastSendStartedAt = Date.now();
    let error;
    try {
      const result = await resend.emails.send(payload);
      if (!result?.error) return result;
      error = result.error;
    } catch (e) {
      error = { name: "application_error", statusCode: null, message: e.message };
    }
    if (isRateLimitError(error) && rateLimitRetries < RATE_LIMIT_RETRY_DELAYS_MS.length) {
      await sleep(RATE_LIMIT_RETRY_DELAYS_MS[rateLimitRetries++]);
      continue;
    }
    if (isNetworkError(error) && !networkRetried) {
      networkRetried = true;
      await sleep(NETWORK_RETRY_DELAY_MS);
      continue;
    }
    throw new Error(`[Resend] ${error.name || "error"}: ${error.message}`);
  }
}

// Dönen promise YALNIZCA bu e-posta gerçekten gönderilince çözülür / son denemede de başarısız olunca
// reddedilir — çağıranlar (await eden de, .catch() ile fire-and-forget yapan da) değişmeden kalır.
function send(payload) {
  const job = queueTail.then(() => sendWithRetry(payload));
  queueTail = job.catch(() => {}); // bir e-postanın hatası sıradakileri durdurmasın
  return job;
}

function resetUrlFor(token) {
  return `${process.env.API_PUBLIC_URL || "http://localhost:4100"}/api/auth/reset-password-page?token=${token}`;
}

// Admin yeni bir öğretmen/öğrenci hesabı oluşturduğunda gönderilir — passwordHash bilerek null
// bırakılır, kullanıcı bu linkle kendi şifresini kendisi belirler.
export async function sendAccountSetupEmail(to, token, name) {
  const url = resetUrlFor(token);
  if (!resend) {
    if (isLocalDev) console.log(`[mailer] RESEND_API_KEY tanımlı değil — e-posta gönderilmedi. ${name} için hesap kurulum linki:\n${url}`);
    else console.error(`[mailer] RESEND_API_KEY tanımlı değil — ${name} için hesap kurulum e-postası gönderilemedi.`);
    return;
  }
  await send({
    from: FROM,
    to,
    subject: "Kocluk — Hesabın oluşturuldu, şifreni belirle",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Merhaba ${name},</h2>
        <p>Kocluk sistemi üzerinde senin için bir hesap oluşturuldu. Giriş yapabilmek için önce bir şifre belirlemen gerekiyor:</p>
        <p style="text-align:center; margin: 24px 0;">
          <a href="${url}" style="background:#3B5BDB; color:#fff; padding:12px 24px; border-radius:10px; text-decoration:none; font-weight:bold;">Şifremi Belirle</a>
        </p>
        <p style="color:#888; font-size:12px;">Bu bağlantı 7 gün geçerlidir. Süresi dolarsa okul yöneticinden yeni bir bağlantı istemeni rica ederiz.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(to, token) {
  const url = resetUrlFor(token);
  if (!resend) {
    if (isLocalDev) console.log(`[mailer] RESEND_API_KEY tanımlı değil — e-posta gönderilmedi. Şifre sıfırlama linki:\n${url}`);
    else console.error(`[mailer] RESEND_API_KEY tanımlı değil — şifre sıfırlama e-postası gönderilemedi.`);
    return;
  }
  await send({
    from: FROM,
    to,
    subject: "Kocluk — Şifreni sıfırla",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Şifreni sıfırla</h2>
        <p>Hesabın için bir şifre sıfırlama isteği aldık. Yeni şifreni belirlemek için aşağıdaki butona tıkla:</p>
        <p style="text-align:center; margin: 24px 0;">
          <a href="${url}" style="background:#3B5BDB; color:#fff; padding:12px 24px; border-radius:10px; text-decoration:none; font-weight:bold;">Şifremi Sıfırla</a>
        </p>
        <p style="color:#888; font-size:12px;">Bu bağlantı 1 saat geçerlidir. Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.</p>
      </div>
    `,
  });
}
