// Türkiye saatiyle ilgili ortak yardımcılar — scheduler.js ve notify.js aynı kuralı kullanır.
// Türkiye yaz saati uygulamıyor: her zaman UTC+3.
export const TR_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;

export function trHour(now) {
  return (now.getUTCHours() + 3) % 24;
}

// Sessiz saatler (23:00-07:00): bu aralıkta öğrencilerin telefonu çalmaz — scheduler hiçbir şey
// yayınlamaz/hatırlatmaz, elle yayınlanan ödevlerin push'u da sabaha bekletilir (bkz. notify.js).
export function isQuietHours(now) {
  const h = trHour(now);
  return h >= 23 || h < 7;
}

// Bugünün Türkiye'deki başlangıcı (00:00 TR = önceki UTC günün 21:00'ı), Date olarak.
export function trStartOfToday(now) {
  const tr = new Date(now.getTime() + TR_UTC_OFFSET_MS);
  return new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate()) - TR_UTC_OFFSET_MS);
}

// Bugünün Türkiye takvim günü, tarihlerin saklandığı biçimde (UTC gece yarısı) — ör. endDate karşılaştırması.
export function trTodayAsDateOnly(now) {
  return new Date(trStartOfToday(now).getTime() + TR_UTC_OFFSET_MS);
}
