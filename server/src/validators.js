// Kullanıcı adı: küçük harf/rakamla başlar; harf, rakam, nokta, tire, alt çizgi (2-40 karakter).
// Öğrencilerde okul numarası ("621"), öğretmenlerde ör. "ali.cihangir". Çağıran taraf önce
// trim + toLowerCase uygular.
export function isValidUsername(username) {
  return typeof username === "string" && /^[a-z0-9][a-z0-9._-]{1,39}$/.test(username);
}

export function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function assert(condition, message, status = 400) {
  if (!condition) throw Object.assign(new Error(message), { status });
}

// Yıllık plan kaydı başına soru sınırı — okul kuralı günde en fazla 30 soru; birden çok günü kapsayan
// kayıtta gün sayısıyla çarpılır (7 günlük haftalık kayıt: 210). date/endDate UTC gece yarısı Date'leri.
export const MAX_QUESTIONS_PER_DAY = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export function maxQuestionCount(date, endDate) {
  const days = date && endDate ? Math.round((endDate.getTime() - date.getTime()) / DAY_MS) + 1 : 1;
  return MAX_QUESTIONS_PER_DAY * Math.max(1, days);
}
