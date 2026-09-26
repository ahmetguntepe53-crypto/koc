// Hafta ve ödev durumu yardımcıları — koç panosu, branş ekranı ve istemcideki aynı kurallarla (src/theme.js
// > recipientStatus) tutarlı. Tarihler UTC gece yarısı saklanır (bkz. planEntries.js > parseDateOnly).
import { trTodayAsDateOnly } from "./quietHours.js";

const DAY_MS = 24 * 60 * 60 * 1000;
// Bitiş gününün Türkiye'deki sonu = UTC gece yarısı + 21 saat (bkz. scheduler.js).
const TR_END_OF_DAY_GRACE_MS = 21 * 60 * 60 * 1000;

// Bu haftanın Pazartesi'si ve Pazar'ı (Türkiye takvimi), bir önceki haftanın Pazartesi'si.
export function trWeekRange(now = new Date()) {
  const today = trTodayAsDateOnly(now);
  const dow = (today.getUTCDay() + 6) % 7; // Pazartesi = 0
  const mon = new Date(today.getTime() - dow * DAY_MS);
  return { mon, sun: new Date(mon.getTime() + 6 * DAY_MS), prevMon: new Date(mon.getTime() - 7 * DAY_MS) };
}

// Şartnamedeki dört durum: done (çözüldü) · skipped (pas geçildi) · missed (yapılmadı) · open (süresi dolmadı).
export function recipientStatus(r, now = new Date()) {
  if (r.completed) return "done";
  if (r.skippedAt) return "skipped";
  return r.assignment.endDate.getTime() + TR_END_OF_DAY_GRACE_MS < now.getTime() ? "missed" : "open";
}

export function netOf(s) {
  return s ? s.correctCount - s.wrongCount / 4 : null;
}

// Ödevin soru sayısı ayrı bir alan değil — "Sayfa/Soru" alanındaki "30 soru" ifadesinden okunur
// (plan yayınları "N soru" yazar; bkz. planEntries.js > publishPlanEntry).
export function questionCountOf(pageRange) {
  const m = /(\d+)\s*soru/i.exec(pageRange || "");
  return m ? Number(m[1]) : null;
}
