// Sabit ders listeleri — Prisma enum DEĞİL, bilinçli olarak düz bir sabit: liste değişirse
// (yeni bir ders eklenir/adı düzelir) migration gerekmez, yalnızca bu dosya güncellenir.
// Assignment/StudySession oluşturulurken subject bu listeye karşı doğrulanır (bkz. validators.js).
// Okul yalnızca 11-12. sınıf YKS (TYT/AYT) hazırlığı yapıyor — LGS listeden kaldırıldı: yeni LGS
// ödevi/kaydı oluşturulamaz, ama Prisma'daki ExamType enum'unda LGS bilerek DURUYOR ki eski kayıtlar
// okunmaya devam etsin. Listeler okulun TYT/AYT konu PDF'leriyle aynı (istemci: src/topics.js).
export const SUBJECTS_BY_EXAM = {
  TYT: ["Türkçe", "Matematik", "Geometri", "Fizik", "Kimya", "Biyoloji", "Tarih", "Coğrafya", "Felsefe", "Din Kültürü ve Ahlak Bilgisi"],
  AYT: ["Matematik", "Geometri", "Fizik", "Kimya", "Biyoloji", "Edebiyat", "Tarih-1", "Tarih-2", "Coğrafya-1", "Coğrafya-2", "Felsefe", "Mantık", "Psikoloji", "Sosyoloji", "Din Kültürü ve Ahlak Bilgisi"],
};

// Yeni kayıt oluştururken kabul edilen sınav türleri (eski LGS kayıtları yalnızca okunur).
export const EXAM_TYPES = ["TYT", "AYT"];

export function isValidSubject(examType, subject) {
  const list = SUBJECTS_BY_EXAM[examType];
  return Array.isArray(list) && list.includes(subject);
}

// Öğrencinin sınıf düzeyinden (User.gradeLevel) sınav grubu — yeni kayıtlar yalnızca 11/12 olabilir
// (GRADE_LEVELS), ama eski 9-10. sınıf kayıtlar da YKS sayılır ki ödev almaya devam etsinler. Eski
// 7-8. sınıf (LGS) kayıtlar ve sınıf düzeyi girilmemişler null döner — çağıran taraf bunu
// "belirsiz" olarak ele alır (bkz. routes/assignments.js, routes/studySessions.js).
export function trackForGrade(gradeLevel) {
  if (gradeLevel >= 9 && gradeLevel <= 12) return "YKS";
  return null;
}

// Bir Assignment/StudySession.examType değerinin hangi sınav grubuna ait olduğu — yukarıdakinin
// tersi. TYT ve AYT ikisi de YKS'nin bileşeni olduğu için aynı gruba düşer.
export function trackForExamType(examType) {
  if (examType === "LGS") return "LGS"; // yalnızca eski kayıtlar
  if (examType === "TYT" || examType === "AYT") return "YKS";
  return null;
}

export const GRADE_LEVELS = [11, 12];
