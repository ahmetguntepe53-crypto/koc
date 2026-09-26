// Bildirim verisinden hedef ekranın girdisini çıkaran küçük saf yardımcılar — App.jsx > goToNotificationTarget kullanır
// (hem push'a dokununca hem Bildirimler listesindeki bir satıra dokununca).

// Tekrar hatırlatmasının (server/src/reviewReminders.js, screen "studyLog") prefill'i: { examType, subject, topic }.
// Uygulama içi listede nesne olarak gelir; push'ta ise JSON METNİ — FCM data alanları yalnız düz metin taşır (bkz.
// server/src/notify.js > stringifyData). Çözülemezse null → Çalışma Kaydı boş açılır. Sınav türü/ders listede yoksa
// StudyLogScreen kendi varsayılanına düşer; burada yalnız türler süzülür.
export function studyPrefillFromNotification(prefill) {
  let p = prefill;
  if (typeof p === "string") {
    try {
      p = JSON.parse(p);
    } catch {
      return null;
    }
  }
  if (!p || typeof p !== "object" || Array.isArray(p)) return null;
  const str = (v) => (typeof v === "string" ? v : undefined);
  return { examType: str(p.examType), subject: str(p.subject), topic: str(p.topic) || "" };
}
