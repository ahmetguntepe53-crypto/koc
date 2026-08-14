// Sabit ders listeleri — Prisma enum DEĞİL, bilinçli olarak düz bir sabit: liste değişirse
// (yeni bir ders eklenir/adı düzelir) migration gerekmez, yalnızca bu dosya güncellenir.
// Assignment/StudySession oluşturulurken subject bu listeye karşı doğrulanır (bkz. validators.js).
export const SUBJECTS_BY_EXAM = {
  LGS: ["Türkçe", "Matematik", "Fen Bilimleri", "T.C. İnkılap Tarihi ve Atatürkçülük", "Din Kültürü ve Ahlak Bilgisi", "İngilizce"],
  TYT: ["Türkçe", "Matematik", "Fizik", "Kimya", "Biyoloji", "Tarih", "Coğrafya", "Felsefe", "Din Kültürü ve Ahlak Bilgisi"],
  AYT: ["Matematik", "Fizik", "Kimya", "Biyoloji", "Edebiyat", "Tarih-1", "Tarih-2", "Coğrafya-1", "Coğrafya-2", "Felsefe Grubu", "Din Kültürü ve Ahlak Bilgisi", "Yabancı Dil"],
};

export function isValidSubject(examType, subject) {
  const list = SUBJECTS_BY_EXAM[examType];
  return Array.isArray(list) && list.includes(subject);
}

// Öğrencinin gerçek sınıf düzeyinden (User.gradeLevel) hangi sınav grubuna girdiğini türetir —
// 7-8: ortaokul, LGS'ye hazırlanır. 9-12: lise, YKS'ye (TYT + isteğe bağlı AYT) hazırlanır.
// gradeLevel henüz girilmemişse (null/eski kayıt) null döner — çağıran taraf bunu "belirsiz,
// YKS'ye düş" olarak ele alır (bkz. routes/assignments.js, routes/studySessions.js).
export function trackForGrade(gradeLevel) {
  if (gradeLevel === 7 || gradeLevel === 8) return "LGS";
  if (gradeLevel >= 9 && gradeLevel <= 12) return "YKS";
  return null;
}

// Bir Assignment/StudySession.examType değerinin hangi sınav grubuna ait olduğu — yukarıdakinin
// tersi. TYT ve AYT ikisi de YKS'nin bileşeni olduğu için aynı gruba düşer.
export function trackForExamType(examType) {
  if (examType === "LGS") return "LGS";
  if (examType === "TYT" || examType === "AYT") return "YKS";
  return null;
}

export const GRADE_LEVELS = [7, 8, 9, 10, 11, 12];
