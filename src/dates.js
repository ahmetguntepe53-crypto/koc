export function formatDate(iso) {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
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
