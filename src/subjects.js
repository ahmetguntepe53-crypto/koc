import {
  BookOpenText, Sigma, Microscope, Landmark, Moon, Languages,
  Atom, FlaskConical, Dna, ScrollText, Globe, Brain, BookText,
} from "lucide-react";

// SUBJECTS_BY_EXAM/trackForGrade/GRADE_LEVELS server/src/subjects.js ile İÇERİK olarak aynı
// tutulmalı — sunucu bu listeye karşı doğruluyor, burada yalnızca dropdown'ı doldurmak için kopyası
// var (iki ayrı npm paketi, paylaşılan bir modül yok). Dosyanın geri kalanı (label sözlükleri,
// GRADE_OPTIONS gibi) yalnızca arayüz için, sunucuda karşılığı olması gerekmez.
export const SUBJECTS_BY_EXAM = {
  LGS: ["Türkçe", "Matematik", "Fen Bilimleri", "T.C. İnkılap Tarihi ve Atatürkçülük", "Din Kültürü ve Ahlak Bilgisi", "İngilizce"],
  TYT: ["Türkçe", "Matematik", "Fizik", "Kimya", "Biyoloji", "Tarih", "Coğrafya", "Felsefe", "Din Kültürü ve Ahlak Bilgisi"],
  AYT: ["Matematik", "Fizik", "Kimya", "Biyoloji", "Edebiyat", "Tarih-1", "Tarih-2", "Coğrafya-1", "Coğrafya-2", "Felsefe Grubu", "Din Kültürü ve Ahlak Bilgisi", "Yabancı Dil"],
};

export const PERIOD_LABELS = { WEEKLY: "Haftalık", MONTHLY: "Aylık", YEARLY: "Yıllık" };
export const SEND_MODE_LABELS = {
  AUTO_ON_DATE: "Otomatik — tarihi gelince gönder",
  AUTO_DAY_BEFORE: "Otomatik — bir gün önceden gönder",
  MANUAL_NOW: "Elle — şimdi gönder",
};
export const STATUS_LABELS = { DRAFT: "Bekliyor", SENT: "Gönderildi" };

// 7-8. sınıf → LGS (ortaokul, liselere geçiş sınavı). 9-12. sınıf → YKS'nin bileşenleri TYT/AYT.
// gradeLevel yoksa (eski kayıt) null döner — çağıran taraf bunu "belirsiz" sayar.
export function trackForGrade(gradeLevel) {
  if (gradeLevel === 7 || gradeLevel === 8) return "LGS";
  if (gradeLevel >= 9 && gradeLevel <= 12) return "YKS";
  return null;
}

export const EXAM_TYPES_BY_TRACK = { LGS: ["LGS"], YKS: ["TYT", "AYT"] };
export const TRACK_LABELS = { LGS: "LGS (7-8. sınıf)", YKS: "YKS — TYT/AYT (9-12. sınıf)" };

export const GRADE_LEVELS = [7, 8, 9, 10, 11, 12];
export const GRADE_OPTIONS = GRADE_LEVELS.map((g) => ({ value: g, label: `${g}. Sınıf (${trackForGrade(g)})` }));

// Ödev listelerindeki "Ders" filtresi için — tüm sınav türlerindeki dersler tek, alfabetik ve
// tekrarsız bir listede. Filtre dropdown'ı basit kalsın diye tüm listede seçilebilir; o dersten hiç
// ödev yoksa sonuç boş gelir, bu bir hata değildir.
export const ALL_SUBJECTS = [...new Set([...SUBJECTS_BY_EXAM.LGS, ...SUBJECTS_BY_EXAM.TYT, ...SUBJECTS_BY_EXAM.AYT])].sort((a, b) => a.localeCompare(b, "tr"));

// Ödev satırlarında ders adının yanında küçük bir ikon göstermek için (bkz. StudentHomeScreen >
// AssignmentRow) — salt görsel, hiçbir iş kuralı buna dayanmaz. Din Kültürü bilerek "Moon" (hilal) —
// okul amblemindeki hilal motifiyle örtüşsün diye.
const SUBJECT_ICONS = {
  "Türkçe": BookOpenText,
  "Edebiyat": BookText,
  "Matematik": Sigma,
  "Fen Bilimleri": Microscope,
  "Fizik": Atom,
  "Kimya": FlaskConical,
  "Biyoloji": Dna,
  "Tarih": ScrollText,
  "Tarih-1": ScrollText,
  "Tarih-2": ScrollText,
  "T.C. İnkılap Tarihi ve Atatürkçülük": Landmark,
  "Coğrafya": Globe,
  "Coğrafya-1": Globe,
  "Coğrafya-2": Globe,
  "Felsefe": Brain,
  "Felsefe Grubu": Brain,
  "Din Kültürü ve Ahlak Bilgisi": Moon,
  "İngilizce": Languages,
  "Yabancı Dil": Languages,
};

export function subjectIcon(subject) {
  return SUBJECT_ICONS[subject] || BookOpenText;
}
