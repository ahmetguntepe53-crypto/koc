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

// Branş öğretmeninin okuttuğu ana dersler (User.teachingSubjects) — TYT/AYT listelerindeki alt adlar
// branşına branchOfSubject ile bağlanır: AYT Tarih-1/2 → Tarih, Coğrafya-1/2 → Coğrafya, felsefe grubu
// (Mantık, Psikoloji, Sosyoloji) → Felsefe.
export const BRANCHES = ["Türkçe", "Edebiyat", "Matematik", "Geometri", "Fizik", "Kimya", "Biyoloji", "Tarih", "Coğrafya", "Felsefe", "Din Kültürü ve Ahlak Bilgisi"];
const SUBJECT_BRANCH = { "Tarih-1": "Tarih", "Tarih-2": "Tarih", "Coğrafya-1": "Coğrafya", "Coğrafya-2": "Coğrafya", Mantık: "Felsefe", Psikoloji: "Felsefe", Sosyoloji: "Felsefe" };

export function branchOfSubject(subject) {
  return SUBJECT_BRANCH[subject] || subject;
}

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

// Öğrencinin YKS alanı (User.field) — istemcide src/studentField.js ile İÇERİK olarak aynı. SAY/EA/SOZ AYT'ye,
// DIL ise AYT yerine YDT'ye girer (rapor bu yüzden DİL öğrencisinde TYT/AYT dengesi önermez).
export const STUDENT_FIELDS = ["SAY", "EA", "SOZ", "DIL"];
// Okul listelerinde/elle yazımda görülen biçimler: kod ("SÖZ", "DİL"), tam ad ("Eşit Ağırlık"), eski ad ("TM") ve
// "YDT". Karşılaştırma Türkçe harfler sadeleştirilip küçük harfle yapılır ("DIL" → "dıl" → "dil").
const FIELD_ALIASES = {
  say: "SAY", sayisal: "SAY",
  ea: "EA", esitagirlik: "EA", tm: "EA",
  soz: "SOZ", sozel: "SOZ",
  dil: "DIL", yabancidil: "DIL", ydt: "DIL",
};
const FIELD_FOLD = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };

// Boş (undefined/null/"") → null (alan bilinmiyor / silinsin); tanınan değer → kod; tanınmayan → undefined — çağıran
// taraf undefined'ı 400 ile reddeder. Sayı ya da nesne gibi metin olmayan değerler de tanınmaz.
export function normalizeField(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const key = value.toLocaleLowerCase("tr-TR").replace(/[çğıöşüâîû]/g, (c) => FIELD_FOLD[c] || c).replace(/[^a-z0-9]/g, "");
  if (!key) return null;
  return FIELD_ALIASES[key];
}
