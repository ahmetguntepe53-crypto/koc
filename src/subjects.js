import turkceIcon from "./assets/subject-icons/Turkce.svg";
import edebiyatIcon from "./assets/subject-icons/Edebiyat.svg";
import matematikIcon from "./assets/subject-icons/Matematik.svg";
import fenBilimleriIcon from "./assets/subject-icons/Fen_Bilimleri.svg";
import fizikIcon from "./assets/subject-icons/Fizik.svg";
import kimyaIcon from "./assets/subject-icons/Kimya.svg";
import biyolojiIcon from "./assets/subject-icons/Biyoloji.svg";
import tarihIcon from "./assets/subject-icons/Tarih.svg";
import inkilapTarihiIcon from "./assets/subject-icons/Inkilap_Tarihi.svg";
import cografyaIcon from "./assets/subject-icons/Cografya.svg";
import felsefeIcon from "./assets/subject-icons/Felsefe.svg";
import dinKulturuIcon from "./assets/subject-icons/Din_Kulturu.svg";
import ingilizceIcon from "./assets/subject-icons/Ingilizce.svg";

// SUBJECTS_BY_EXAM/trackForGrade/GRADE_LEVELS server/src/subjects.js ile İÇERİK olarak aynı
// tutulmalı — sunucu bu listeye karşı doğruluyor, burada yalnızca dropdown'ı doldurmak için kopyası
// var (iki ayrı npm paketi, paylaşılan bir modül yok). Dosyanın geri kalanı (label sözlükleri,
// GRADE_OPTIONS gibi) yalnızca arayüz için, sunucuda karşılığı olması gerekmez.
// Okul yalnızca 11-12. sınıf YKS (TYT/AYT) hazırlığı yapıyor — LGS kaldırıldı (veritabanındaki eski
// LGS kayıtları görüntülenmeye devam eder ama yeni LGS ödevi/kaydı oluşturulamaz). Ders listeleri
// okulun TYT/AYT konu PDF'leriyle aynı (bkz. topics.js): Geometri ayrı ders, AYT'de "Felsefe Grubu"
// yerine Felsefe/Mantık/Psikoloji/Sosyoloji ayrı ayrı.
export const SUBJECTS_BY_EXAM = {
  TYT: ["Türkçe", "Matematik", "Geometri", "Fizik", "Kimya", "Biyoloji", "Tarih", "Coğrafya", "Felsefe", "Din Kültürü ve Ahlak Bilgisi"],
  AYT: ["Matematik", "Geometri", "Fizik", "Kimya", "Biyoloji", "Edebiyat", "Tarih-1", "Tarih-2", "Coğrafya-1", "Coğrafya-2", "Felsefe", "Mantık", "Psikoloji", "Sosyoloji", "Din Kültürü ve Ahlak Bilgisi"],
};

export const PERIOD_LABELS = { WEEKLY: "Haftalık", MONTHLY: "Aylık", YEARLY: "Yıllık" };
export const SEND_MODE_LABELS = {
  AUTO_ON_DATE: "Otomatik — tarihi gelince gönder",
  AUTO_DAY_BEFORE: "Otomatik — bir gün önceden gönder",
  MANUAL_NOW: "Elle — şimdi gönder",
};
export const STATUS_LABELS = { DRAFT: "Bekliyor", SENT: "Gönderildi" };

// Seçilebilen sınıf düzeyleri yalnızca 11 ve 12. 9-10. sınıf eski kayıtlar da YKS sayılır (verileri
// kaybolmasın, ödev almaya devam etsin); 7-8. sınıf (eski LGS) kayıtlar null döner — admin
// Kullanıcılar ekranından 11/12'ye çekmelidir. gradeLevel yoksa da null ("belirsiz").
export function trackForGrade(gradeLevel) {
  if (gradeLevel >= 9 && gradeLevel <= 12) return "YKS";
  return null;
}

export const EXAM_TYPES_BY_TRACK = { YKS: ["TYT", "AYT"] };
export const TRACK_LABELS = { YKS: "YKS — TYT/AYT (11-12. sınıf)" };

export const GRADE_LEVELS = [11, 12];
export const GRADE_OPTIONS = GRADE_LEVELS.map((g) => ({ value: g, label: `${g}. Sınıf` }));

// Sınıf düzeyi rozeti metni — "11. Sınıf", sınıf düzeyi seçilemeyen eski kayıtlarda uyarıyla.
export function gradeLabel(gradeLevel) {
  if (!gradeLevel) return "Sınıf düzeyi girilmedi";
  return GRADE_LEVELS.includes(gradeLevel) ? `${gradeLevel}. Sınıf` : `${gradeLevel}. Sınıf (güncellenmeli)`;
}

// Ödev listelerindeki "Ders" filtresi için — tüm sınav türlerindeki dersler tek, alfabetik ve
// tekrarsız bir listede. Filtre dropdown'ı basit kalsın diye tüm listede seçilebilir; o dersten hiç
// ödev yoksa sonuç boş gelir, bu bir hata değildir.
export const ALL_SUBJECTS = [...new Set([...SUBJECTS_BY_EXAM.TYT, ...SUBJECTS_BY_EXAM.AYT])].sort((a, b) => a.localeCompare(b, "tr"));

// Ödev satırlarında ders adının yanında gösterilen renkli rozet ikonu (bkz. StudentHomeScreen >
// AssignmentRow) — salt görsel, hiçbir iş kuralı buna dayanmaz. Kendi köşeleri yuvarlatılmış,
// zemin rengi ders başına sabit (assets/subject-icons/*.svg) — ayrıca bir arka plan kutusuna gerek yok.
const SUBJECT_ICON_URLS = {
  "Türkçe": turkceIcon,
  "Edebiyat": edebiyatIcon,
  "Matematik": matematikIcon,
  "Geometri": matematikIcon,
  "Fen Bilimleri": fenBilimleriIcon,
  "Fizik": fizikIcon,
  "Kimya": kimyaIcon,
  "Biyoloji": biyolojiIcon,
  "Tarih": tarihIcon,
  "Tarih-1": tarihIcon,
  "Tarih-2": tarihIcon,
  "T.C. İnkılap Tarihi ve Atatürkçülük": inkilapTarihiIcon,
  "Coğrafya": cografyaIcon,
  "Coğrafya-1": cografyaIcon,
  "Coğrafya-2": cografyaIcon,
  "Felsefe": felsefeIcon,
  "Felsefe Grubu": felsefeIcon,
  "Mantık": felsefeIcon,
  "Psikoloji": felsefeIcon,
  "Sosyoloji": felsefeIcon,
  "Din Kültürü ve Ahlak Bilgisi": dinKulturuIcon,
  "İngilizce": ingilizceIcon,
  "Yabancı Dil": ingilizceIcon,
};

export function subjectIconUrl(subject) {
  return SUBJECT_ICON_URLS[subject] || turkceIcon;
}
