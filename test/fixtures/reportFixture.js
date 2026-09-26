// Rapor modeli testleri için KURGUSAL öğrenci verisi — /api/stats/full-report yanıtı biçiminde. Gerçek öğrenci
// verisi kullanılmaz. Deterministik: aynı tohumla her çalıştırmada aynı veri.
const DAY = 864e5;
const iso = (ms) => new Date(ms).toISOString();
const dateOnly = (ms) => new Date(Math.floor((ms + 3 * 3600e3) / DAY) * DAY).toISOString();

export const FIXTURE_NOW = new Date("2026-11-20T12:00:00Z"); // Cuma, TR 15:00

function rng(seed) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
}

// Ders başına öğrencinin "gerçek" net oranı (0–1) ve haftalık eğilimi.
const PROFILE = {
  "TYT|Türkçe": { p: 0.78, trend: 0.0, blank: 0.08 },
  "TYT|Matematik": { p: 0.34, trend: 0.02, blank: 0.28 },
  "TYT|Geometri": { p: 0.52, trend: 0.0, blank: 0.12 },
  "TYT|Fizik": { p: 0.42, trend: -0.015, blank: 0.1 },
  "TYT|Kimya": { p: 0.55, trend: 0.0, blank: 0.1 },
  "TYT|Biyoloji": { p: 0.7, trend: 0.0, blank: 0.06 },
  "TYT|Tarih": { p: 0.6, trend: 0.0, blank: 0.1 },
  "AYT|Matematik": { p: 0.3, trend: 0.0, blank: 0.3 },
};
const TOPICS = {
  "TYT|Türkçe": ["Paragrafta Anlam", "Sözcükte Anlam", "Cümlede Anlam", "Yazım Kuralları", "Noktalama İşaretleri", "Ses Bilgisi", "Fiilimsi", "Cümlenin Öğeleri", "Anlatım Bozuklukları", "Sözcük Türleri"],
  "TYT|Matematik": ["1. Bölüm: Gerçek Sayılar - 1 (Temel Kavramlar)", "2. Bölüm: Mutlak Değer", "3. Bölüm: Üslü Sayılar", "4. Bölüm: Köklü Sayılar", "5. Bölüm: Çarpanlara Ayırma", "6. Bölüm: Oran Orantı", "7. Bölüm: Yaş Problemleri", "8. Bölüm: Kümeler", "9. Bölüm: Fonksiyonlar - 1", "10. Bölüm: Polinomlar"],
  "TYT|Geometri": ["Doğruda ve Üçgende Açılar", "Dik Üçgen", "İkizkenar Üçgen", "Üçgende Alan", "Çokgenler", "Dörtgenler", "Çemberde Açı", "Katı Cisimler", "Kare", "Deltoid"],
  "TYT|Fizik": ["Fizik Bilimine Giriş", "Madde ve Özellikleri", "Basınç", "Isı, Sıcaklık ve Genleşme", "Hareket ve Kuvvet", "Dinamik", "İş, Güç ve Enerji", "Elektrostatik", "Elektrik", "Optik"],
  "TYT|Kimya": ["Kimya Bilimi", "Atom ve Yapısı", "Periyodik Sistem", "Kimyasal Türler Arası Etkileşimler", "Maddenin Halleri", "Karışımlar", "Asitler, Bazlar ve Tuzlar", "Kimyasal Tepkimeler", "Kimyanın Temel Yasaları", "Doğa ve Kimya"],
  "TYT|Biyoloji": ["Canlıların Ortak Özellikleri", "Canlıların Temel Bileşenleri", "Hücre ve Organelleri", "Hücre Zarından Madde Geçişi", "Canlıların Sınıflandırılması", "Mitoz ve Eşeysiz Üreme", "Mayoz ve Eşeyli Üreme", "Kalıtım", "Ekosistem Ekolojisi", "Güncel Çevre Sorunları"],
  "TYT|Tarih": ["Tarih Bilimine Giriş", "İlk Türk Devletleri", "İslam Tarihi ve Uygarlığı", "Türk-İslam Devletleri", "Türkiye Tarihi", "Beylikten Devlete (1300-1453)", "Dünya Gücü: Osmanlı Devleti", "Arayış Yılları (17. Yüzyıl)", "En Uzun Yüzyıl (1800-1922)", "Türk İnkılabı"],
  "AYT|Matematik": ["Trigonometri: Birim Çember", "Logaritma", "Diziler", "Limit", "Türev: Tanım", "Türevin Uygulamaları", "İntegral", "Polinomlar: Bölme", "Parabol", "Karmaşık Sayılar"],
};
const TEACHER = { "TYT|Türkçe": "Deniz Aksoy", "TYT|Matematik": "Kerem Yalın", "TYT|Geometri": "Kerem Yalın", "TYT|Fizik": "Selin Ova", "TYT|Kimya": "Umut Tan", "TYT|Biyoloji": "Ece Sarp", "TYT|Tarih": "Oya Er", "AYT|Matematik": "Kerem Yalın" };

export function makeFixture({ seed = 42, viewer = "coach", weeks = 10, now = FIXTURE_NOW, sparse = false } = {}) {
  const rand = rng(seed);
  const nowMs = now.getTime();
  const todayMs = Math.floor((nowMs + 3 * 3600e3) / DAY) * DAY; // TR günü UTC gece yarısı
  const dow = (new Date(todayMs).getUTCDay() + 6) % 7;
  const monday = todayMs - dow * DAY;
  const items = [];
  const sessions = [];
  let id = 0;
  const subjects = sparse ? ["TYT|Türkçe"] : Object.keys(PROFILE);
  for (let w = weeks - 1; w >= 0; w--) {
    const wStart = monday - w * 7 * DAY;
    for (const key of subjects) {
      const [examType, subject] = key.split("|");
      const prof = PROFILE[key];
      const weekIdx = weeks - 1 - w;
      const topic = TOPICS[key][weekIdx % TOPICS[key].length];
      const expected = [20, 30, 40][Math.floor(rand() * 3)];
      const sched = wStart; // Pazartesi
      const end = wStart + 4 * DAY; // Cuma
      const x = rand();
      const p = Math.max(0.05, Math.min(0.95, prof.p + prof.trend * weekIdx + (rand() - 0.5) * 0.12));
      let completed = false, completedAt = null, skippedAt = null, skipReason = null, sub = null;
      const future = end > todayMs;
      // Fizik'te son haftalarda "konuyu bilmiyorum" pasları; Matematik'te bir sessiz ödev.
      if (key === "TYT|Fizik" && w <= 2 && w >= 1) { skippedAt = iso(end - DAY); skipReason = "KONU"; }
      else if (key === "TYT|Matematik" && w === 1) { /* sessiz */ }
      else if (key === "TYT|Kimya" && w === 3) { skippedAt = iso(end); skipReason = "KAYNAK"; }
      else if (future && x < 0.6) { /* açık */ }
      else if (x < 0.9 || key === "TYT|Türkçe") {
        completed = true;
        const late = rand() < 0.12;
        completedAt = iso(end - Math.floor(rand() * 3) * DAY + (late ? 2 * DAY : 0) + 15 * 3600e3);
        if (Date.parse(completedAt) > nowMs) completedAt = iso(nowMs - 3600e3);
        const Q = Math.round(expected * (rand() < 0.1 ? 0.6 : 1));
        const blank = Math.round(Q * prof.blank * (0.6 + rand() * 0.8));
        const answered = Q - blank;
        const correct = Math.min(answered, Math.round(answered * Math.min(0.98, p + 0.12)));
        const wrong = answered - correct;
        sub = { correct, wrong, blank, questionNumbers: rand() < 0.3 && wrong + blank ? [3, 7, 12].slice(0, Math.min(3, wrong + blank)) : [] };
      }
      const school = examType === "TYT" || key === "AYT|Matematik";
      const median = Math.round((0.5 + (rand() - 0.5) * 0.2) * 1000) / 10;
      let pct = null;
      if (sub) {
        const Q = sub.correct + sub.wrong + sub.blank;
        const r = ((sub.correct - sub.wrong / 4) / Q) * 100;
        pct = Math.round(Math.max(0, Math.min(100, 50 + (r - median) * 1.6)));
      }
      items.push({
        id: `r${++id}`, assignmentId: `a${id}`, examType, subject, topic, sourceBook: key === "TYT|Kimya" ? "Kimya Soru Bankası" : "Okul Kaynağı",
        source: school ? "branch" : "coach", teacher: TEACHER[key], expected,
        scheduledDate: dateOnly(sched), endDate: dateOnly(end), completed, completedAt, skippedAt, skipReason,
        reminderAt: !completed && !skippedAt && end + DAY < nowMs ? iso(end + 21 * 3600e3 + 3600e3) : null,
        correct: sub?.correct ?? null, wrong: sub?.wrong ?? null, blank: sub?.blank ?? null, questionNumbers: sub?.questionNumbers || [],
        school: school && end < nowMs ? { n: 24, recipients: 30, participation: 80, median, q1: median - 12, q3: median + 11, pct, scope: "grade" } : null,
        konuSkipRate: school ? (skipReason === "KONU" ? 34 : 6) : null,
        ...(viewer === "coach" ? { note: sub && rand() < 0.15 ? "Son sorularda zorlandım." : null, skipNote: null, photos: sub ? (rand() < 0.5 ? 1 : 0) : 0 } : {}),
      });
    }
    // Koçun kişisel ödevi (Matematik) ve serbest çalışmalar.
    if (!sparse) {
      const end = wStart + 6 * DAY;
      const done = end < todayMs && rand() < 0.8;
      items.push({
        id: `r${++id}`, assignmentId: `a${id}`, examType: "TYT", subject: "Matematik", topic: "Problemler tekrar", sourceBook: "Kişisel set", source: "coach",
        teacher: "Koç Hoca", expected: 25, scheduledDate: dateOnly(wStart + 2 * DAY), endDate: dateOnly(end), completed: done,
        completedAt: done ? iso(end - DAY + 18 * 3600e3) : null, skippedAt: null, skipReason: null, reminderAt: null,
        correct: done ? 11 : null, wrong: done ? 7 : null, blank: done ? 7 : null, questionNumbers: [], school: null, konuSkipRate: null,
        ...(viewer === "coach" ? { note: null, skipNote: null, photos: 0 } : {}),
      });
      for (let d = 0; d < 3; d++) {
        const day = wStart + Math.floor(rand() * 7) * DAY;
        if (day > nowMs) continue;
        const Q = 20 + Math.floor(rand() * 20);
        const c = Math.round(Q * 0.8), wr = Math.round(Q * 0.12);
        sessions.push({ id: `s${sessions.length + 1}`, examType: "TYT", subject: "Türkçe", topic: "Paragrafta Anlam", sourceBook: "Paragraf 300", date: iso(day + 17 * 3600e3), correct: c, wrong: wr, blank: Q - c - wr, questionNumbers: [], ...(viewer === "coach" ? { note: null } : {}) });
      }
    }
  }
  return {
    viewer,
    student: {
      id: "stu-1", name: "Deniz Kurgu", className: "12-A", gradeLevel: 12, createdAt: iso(monday - weeks * 7 * DAY - 3 * DAY), coach: "Koç Hoca",
      ...(viewer === "coach" ? { lastSeenAt: iso(nowMs - 2 * DAY) } : {}),
    },
    generatedAt: iso(nowMs),
    yksExamDate: "2027-06-19T00:00:00.000Z",
    items,
    sessions,
  };
}
