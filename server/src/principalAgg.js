import { prisma } from "./db.js";
import { assert } from "./validators.js";
import { trWeekRange, recipientStatus, netOf, questionCountOf } from "./weekStats.js";
import { trTodayAsDateOnly } from "./quietHours.js";

// Müdür panelinin ortak hesapları (routes/principal.js ve routes/principalStats.js). Tanımlar Öğrencilerim ekranıyla aynı:
//  • Tamamlama: sorumlu olunan (tamamlanmış ya da süresi dolmuş) ödevlerin yüzde kaçı tamamlandı.
//  • Başarı: teslim edilen ödevlerde toplam net / toplam soru.
//  • Gecikti: süresi dolmuş, sonucu girilmemiş ve pas geçilmemiş.
export const DAY = 24 * 60 * 60 * 1000;
export const PERIODS = ["week", "month", "all"];

export function periodRange(period, now = new Date()) {
  if (period === "all") return null;
  if (period === "week") {
    const { mon } = trWeekRange(now);
    return [mon, new Date(mon.getTime() + 7 * DAY)];
  }
  const today = trTodayAsDateOnly(now);
  return [new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)), new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1))];
}

export function parsePeriod(req) {
  const period = req.query.period || "month";
  assert(PERIODS.includes(period), "Geçersiz dönem (week, month ya da all)");
  return period;
}

// Toplayıcı: tamamlama, başarı, gecikme sayaçları.
export const emptyAgg = () => ({ due: 0, done: 0, overdue: 0, net: 0, q: 0, submissions: 0, total: 0 });
export function add(agg, r, now) {
  const status = recipientStatus(r, now);
  agg.total += 1;
  if (status !== "open") agg.due += 1;
  if (r.completed) agg.done += 1;
  if (status === "missed") agg.overdue += 1;
  if (r.submission) {
    const { correctCount: c, wrongCount: w, blankCount: b } = r.submission;
    const q = questionCountOf(r.assignment.pageRange) || c + w + b;
    if (q > 0) {
      agg.net += netOf(r.submission);
      agg.q += q;
      agg.submissions += 1;
    }
  }
}
export const finish = (a) => ({
  assigned: a.total,
  completionRate: a.due ? Math.round((a.done / a.due) * 100) : null,
  successPct: a.q ? Math.round((a.net / a.q) * 100) : null,
  overdue: a.overdue,
  submissions: a.submissions,
  questions: a.q,
});
export function bump(map, key, init) {
  if (!map.has(key)) map.set(key, { ...init, agg: emptyAgg() });
  return map.get(key);
}

export async function loadRecipients(period, now, where = {}) {
  return loadRecipientsInRange(periodRange(period, now), where);
}

// range: [başlangıç, bitiş) ödevin bitiş gününe göre; null = tüm zamanlar.
export async function loadRecipientsInRange(range, where = {}) {
  return prisma.assignmentRecipient.findMany({
    where: {
      ...where,
      student: { role: "STUDENT", banned: false, ...(where.student || {}) },
      assignment: { status: "SENT", ...(range ? { endDate: { gte: range[0], lt: range[1] } } : {}) },
    },
    select: {
      id: true, studentId: true, completed: true, completedAt: true, skippedAt: true, skipReason: true,
      submission: { select: { correctCount: true, wrongCount: true, blankCount: true } },
      student: { select: { className: true, gradeLevel: true } },
      assignment: { select: { id: true, subject: true, examType: true, topic: true, endDate: true, pageRange: true, teacherId: true } },
    },
  });
}

