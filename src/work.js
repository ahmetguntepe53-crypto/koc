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
