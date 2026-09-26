// Cihazın YEREL takvim günü (YYYY-MM-DD) — form varsayılanları için. toISOString() UTC'ye çevirdiği
// için Türkiye'de (UTC+3) 00:00-03:00 arasında bir ÖNCEKİ günü veriyordu: gece yarısından sonra
// oluşturulan ödev dünün tarihiyle kaydedilip anında "süresi geçti" bildirimi tetikliyor, gece girilen
// serbest çalışma da bir önceki güne yazılıyordu.
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
}

// Bugünden (gün başlangıcı) verilen tarihe kaç tam gün olduğunu döner — negatifse tarih geçmiş demektir.
// Saat farkını yok saymak için ikisi de günün başına yuvarlanır, yoksa ör. "bugün 23:59 son gün" saatin
// ilerlemesiyle "0 gün gecikti"ye dönüşürdü.
export function daysUntil(iso) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

// scheduledDate/endDate aynı güne denk geliyorsa tek tarih, değilse "14 - 20 Ağustos 2026" gibi bir aralık.
export function formatDateRange(startIso, endIso) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (start.toDateString() === end.toDateString()) return formatDate(startIso);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startLabel = sameMonth
    ? start.toLocaleDateString("tr-TR", { day: "2-digit" })
    : start.toLocaleDateString("tr-TR", { day: "2-digit", month: "long" });
  return `${startLabel} – ${formatDate(endIso)}`;
}
