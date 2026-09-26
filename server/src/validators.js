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
