import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.MAIL_FROM || "Kocluk <no-reply@kocluk.local>";

// resend.emails.send() API hatalarında promise'i REDDETMEZ — { data: null, error: {...} } döner.
// Bunu kontrol etmezsek gönderim sessizce başarısız olur, çağıran tarafın .catch()'i hiç tetiklenmez.
async function send(payload) {
  const result = await resend.emails.send(payload);
  if (result?.error) {
    throw new Error(`[Resend] ${result.error.name || "error"}: ${result.error.message}`);
  }
  return result;
}

function resetUrlFor(token) {
  return `${process.env.API_PUBLIC_URL || "http://localhost:4100"}/api/auth/reset-password-page?token=${token}`;
}

// Admin yeni bir öğretmen/öğrenci hesabı oluşturduğunda gönderilir — passwordHash bilerek null
// bırakılır, kullanıcı bu linkle kendi şifresini kendisi belirler.
export async function sendAccountSetupEmail(to, token, name) {
  const url = resetUrlFor(token);
  if (!resend) {
    console.log(`[mailer] RESEND_API_KEY tanımlı değil — e-posta gönderilmedi. ${name} için hesap kurulum linki:\n${url}`);
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
        <p style="color:#888; font-size:12px;">Bu bağlantı 1 saat geçerlidir. Süresi dolarsa okul yöneticinden yeni bir bağlantı istemeni rica ederiz.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(to, token) {
  const url = resetUrlFor(token);
  if (!resend) {
    console.log(`[mailer] RESEND_API_KEY tanımlı değil — e-posta gönderilmedi. Şifre sıfırlama linki:\n${url}`);
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
