// Ödev/hafta yardımcıları — öğrenci ana ekranı, sonuç girişi, koç ekranları aynı kuralları kullanır.
// Tarihler sunucuda UTC gece yarısı saklanır: ISO dizesinin ilk 10 karakteri doğrudan takvim günüdür.

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dayKey(iso) {
  return String(iso).slice(0, 10);
}

// Pazartesi–Pazar haftasının gün anahtarları (offset: 0 bu hafta, -1 geçen hafta...).
export function weekBounds(offsetWeeks = 0, now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const mon = new Date(d);
  mon.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offsetWeeks * 7);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { mon: ymd(mon), sun: ymd(sun) };
}

export function inWeek(iso, bounds) {
  const k = dayKey(iso);
  return k >= bounds.mon && k <= bounds.sun;
}

// Takvim günü farkı (bugün 0, yarın 1, dün -1).
export function dayDiff(iso, now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = dayKey(iso).split("-").map(Number);
  return Math.round((new Date(y, m - 1, d) - today) / 86400000);
}

// "Pazar 23:59", "bugün 23:59", "yarın 23:59"; bir haftadan uzaksa "12 Eki".
export function deadlineLabel(endIso, now = new Date()) {
  const diff = dayDiff(endIso, now);
  if (diff === 0) return "bugün 23:59";
  if (diff === 1) return "yarın 23:59";
  const [y, m, d] = dayKey(endIso).split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (diff > 1 && diff < 7) return `${date.toLocaleDateString("tr-TR", { weekday: "long" })} 23:59`;
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

// Süresi geçmiş ödev için: "dün bitti", "3 gün önce bitti".
export function endedLabel(endIso, now = new Date()) {
  const diff = -dayDiff(endIso, now);
  if (diff <= 0) return "bugün bitti";
  if (diff === 1) return "dün bitti";
  return `${diff} gün önce bitti`;
}

export function shortDate(iso) {
  const [y, m, d] = dayKey(iso).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

// Ödevin soru sayısı ayrı bir alan değil — "Sayfa/Soru" alanındaki "30 soru" ifadesinden okunur
// (plan yayınları "N soru" yazar; bkz. server > planEntries.js > publishPlanEntry).
export function questionCountOf(pageRange) {
  const m = /(\d+)\s*soru/i.exec(pageRange || "");
  return m ? Number(m[1]) : null;
}

// Branş ödevi (okul çapında) mı, koç ödevi mi — kaynak etiketi ve bölümler buna göre.
export function isSchoolWide(assignment) {
  return assignment?.targetMode === "SCHOOL_WIDE";
}

// --- Son giriş (User.lastSeenAt — sunucu en fazla 10 dakikada bir günceller) ---
// Bu kadar gün uygulamayı açmayan öğrenci koç panosunda sorunlu sayılır ("4 gündür giriş yok").
export const INACTIVE_DAYS = 3;

// Gerçek zaman damgası (tarih-yalnız değil) — cihazın yerel takvim günüyle karşılaştırılır.
function localDaysAgo(iso, now) {
  const a = new Date(iso);
  a.setHours(0, 0, 0, 0);
  const b = new Date(now);
  b.setHours(0, 0, 0, 0);
  return Math.round((b - a) / 86400000);
}

// { label: "bugün" | "dün" | "4 gün önce" | "henüz giriş yapmadı" | "hiç giriş yapmadı", days, never, inactive }
// Hiç giriş yapmamışsa gün sayısı hesabın açılışından — roster yüklendiği gün herkes kırmızıya dönmesin.
export function lastSeenInfo(lastSeenAt, createdAt, now = new Date()) {
  if (lastSeenAt) {
    const days = localDaysAgo(lastSeenAt, now);
    return { days, never: false, inactive: days >= INACTIVE_DAYS, label: days <= 0 ? "bugün" : days === 1 ? "dün" : `${days} gün önce` };
  }
  const days = createdAt ? localDaysAgo(createdAt, now) : null;
  const inactive = days != null && days >= INACTIVE_DAYS;
  return { days, never: true, inactive, label: inactive ? "hiç giriş yapmadı" : "henüz giriş yapmadı" };
}

// Tarihli notun başlığı: "24 Eylül" (başka yıldansa yıl da).
export function noteDate(iso, now = new Date()) {
  const d = new Date(iso);
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) });
}
