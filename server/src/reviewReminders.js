// Aralıklı tekrar hatırlatması ("Tekrar zamanı") — zamanlayıcının bir adımı (bkz. scheduler.js > runSchedulerTick).
//
// Neden: raporun "Tekrar gerekli" konuları (src/reportModel.js > R19) yalnızca rapor açılınca görünüyor; unutma ise
// beklemiyor. Net oranı düşük kalan bir konuya 7. ve 21. günde yapılan kısa bir dönüş en çok o günlerde işe yarar — bu
// adım öğrenciye tam o günlerde, konuyu ve o günkü oranını söyleyen tek bir bildirim gönderir. Bildirime dokununca
// Çalışma Kaydı ders ve konu dolu açılır (App.jsx > goToNotificationTarget, screen "studyLog").
//
// Kurallar:
//  • Taban kayıt: teslim edilmiş ödev sonucu (gönderilmiş ödev, teslim günü) ya da serbest çalışma (çalışma günü), TYT/AYT,
//    Q = D + Y + B ≥ 10 ve net oranı r = (D − Y/4) / Q < %55. Az soruluk kayıt (Q < 10) tek başına hüküm taşımaz.
//  • Konu anahtarı: sınav türü | ders | konu metni (tr-TR küçük harf, baş/son boşluk yok, iç boşluklar tek) — "Mutlak
//    Değer" ile "mutlak  değer" aynı konudur. Kaynak kitap/sayfa anahtara girmez.
//  • Aynı anahtarda SONRAKİ her kayıt (sonucu ne olursa olsun) hatırlatmayı iptal eder: öğrenci konuya zaten dönmüş.
//    Sonraki kayıt da düşükse yeni döngünün tabanı olur (7/21 gün onun gününden sayılır). "Sonra" = daha geç TR günü, aynı
//    günse daha geç girilen kayıt (serbest çalışmanın saati yok, yalnız günü var — bkz. StudyLogScreen). Ödev sonucunun
//    serbest çalışma olarak da girilmiş kopyası (aynı gün/ders/D-Y-B; eski istemciler, reportModel.js ile aynı imza) konuya
//    dönüş sayılmaz. Bugünden ileri tarihli kayıt henüz yok sayılır.
//  • Aşamalar: taban kaydın TR gününden 7 ve 21 gün sonra. Sunucu kapalı kaldıysa ya da günlük sınır yüzünden bekleyenler
//    6 gün daha yetişir (7. aşama 7–13., 21. aşama 21–27. gün); metindeki gün sayısı gerçek fark ("9 gün önce").
//  • Öğrenci başına günde en fazla BİR bildirim, içinde en çok 3 konu — en uzun bekleyen önce (süresi dolmasın), sonra en
//    düşük net oranı. Kalanlar ertesi gün. Bildirime dokununca ilk konu açılır.
//  • Yalnız öğrenciler (STUDENT, askıda değil, 11/12. sınıf). Saat: 17:00'den (TR) sonra — okuldan sonra, sessiz saatlerden
//    (23:00) önce; zamanlayıcı sessiz saatlerde zaten çalışmaz, notifyUser da onlara uyar.
//
// Tekrar ve yarıda kalma: ReviewReminderLog (öğrenci × anahtar × aşama, tekil) bildirimden ÖNCE bir işlemde sahiplenilir —
// iki tur aynı hatırlatmayı gönderemez; süreç tam arada çökerse hatırlatma bir kez kaybolur, iki kez gitmez (push de
// best-effort, bkz. notify.js > flushPendingPushes). Aynı anahtarda yeni döngü eski döngünün satırını baseDate'i ileri
// alarak devralır. "Bugün bildirim aldı mı" da bu tablodan (sentAt bugün) okunur — süreç yeniden başlasa da ikinci
// bildirim gitmez.
import { prisma } from "./db.js";
import { notifyUser } from "./notify.js";
import { trHour, trStartOfToday, TR_UTC_OFFSET_MS } from "./quietHours.js";

const DAY_MS = 24 * 60 * 60 * 1000;
// Okul ve etüt çıkışı — öğrenci akşam çalışmasını planlarken.
export const REVIEW_REMINDER_TR_HOUR = 17;
export const REVIEW_STAGES = [7, 21];
// Vaktinde gönderilemeyen aşama bu kadar gün daha yetişir; sonra düşer (üç hafta sonra "7 gün önce" hatırlatması anlamsız).
export const REVIEW_CATCH_UP_DAYS = 6;
export const REVIEW_MAX_TOPICS = 3;
// Q eşiği ve net oranı sınırı (%55 = 11/20) — sınır tam sayılarla karşılaştırılır, kayan nokta %55'i yanlış tarafa atmasın.
export const REVIEW_MIN_QUESTIONS = 10;
const EXAMS = ["TYT", "AYT"];
const GRADES = [11, 12];
// Sorgular öğrenci kümeleriyle (tek tek değil) yapılır.
const CHUNK = 100;
// Geriye bakış: en geç aşama + telafi günleri. Daha eski bir kayıt ne taban olabilir ne de bir tabanı iptal edebilir
// (iptal eden kayıt tabandan SONRADIR).
const LOOKBACK_DAYS = Math.max(...REVIEW_STAGES) + REVIEW_CATCH_UP_DAYS;
// Konu serbest metin ve sınırsız — anahtar (tekil indeks) ile bildirimdeki gösterim kısaltılır.
const KEY_TOPIC_MAX = 200;
const TEXT_TOPIC_MAX = 60;

// ------------------------------------------------------------------------------------------------ saf yardımcılar
// Türkiye takvim günü (1970-01-01'den gün sayısı) — istemcideki trDay ile aynı; tarih-yalnız alanlar (UTC gece yarısı)
// da doğru güne düşer.
const trDay = (d) => Math.floor((new Date(d).getTime() + TR_UTC_OFFSET_MS) / DAY_MS);
const chunks = (list, n) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));
const oneLine = (s) => String(s ?? "").trim().replace(/\s+/g, " ");

export function normalizeTopic(topic) {
  return oneLine(topic).toLocaleLowerCase("tr-TR");
}
export function reviewKey(examType, subject, topic) {
  return `${examType}|${subject}|${normalizeTopic(topic).slice(0, KEY_TOPIC_MAX)}`;
}
// r < %55 ⇔ (D − Y/4) / Q < 11/20 ⇔ 20D − 5Y < 11Q.
export function isReviewCandidate({ D, Y, B }) {
  const Q = D + Y + B;
  return Q >= REVIEW_MIN_QUESTIONS && 20 * D - 5 * Y < 11 * Q;
}
// İstemcideki fmtPct (src/reportModel.js) ile aynı: yüzde işareti önde, tam sayıya yuvarlı, eksi işareti "−".
export function fmtPct(v) {
  const r = Math.round(v);
  return r < 0 ? `−%${Math.abs(r)}` : `%${r}`;
}

// Vakti gelmiş hatırlatmalar (saf; testlerde doğrudan da sınanır). records: tek öğrencinin kayıtları
// [{ examType, subject, topic, day (TR günü), at (giriş anı, ms), D, Y, B, free }]. Dönüş, öncelik sırasıyla:
// [{ key, stage, baseDay, dueDay, daysAgo, rate (0–1), examType, subject, topic }]. Gönderilmiş olanları çağıran ayıklar.
export function dueReviewTopics(records, today) {
  const hwSig = new Set(records.filter((r) => !r.free).map((r) => `${r.day}|${r.examType}|${r.subject}|${r.D}|${r.Y}|${r.B}`));
  const latest = new Map();
  for (const r of records) {
    if (r.day > today) continue;
    if (r.free && hwSig.has(`${r.day}|${r.examType}|${r.subject}|${r.D}|${r.Y}|${r.B}`)) continue;
    const key = reviewKey(r.examType, r.subject, r.topic);
    const cur = latest.get(key);
    if (!cur || r.day > cur.day || (r.day === cur.day && r.at > cur.at)) latest.set(key, { ...r, key });
  }
  const out = [];
  for (const b of latest.values()) {
    if (!isReviewCandidate(b)) continue;
    for (const stage of REVIEW_STAGES) {
      const dueDay = b.day + stage;
      if (today < dueDay || today > dueDay + REVIEW_CATCH_UP_DAYS) continue;
      out.push({
        key: b.key, stage, baseDay: b.day, dueDay, daysAgo: today - b.day, rate: (b.D - b.Y / 4) / (b.D + b.Y + b.B),
        examType: b.examType, subject: b.subject, topic: oneLine(b.topic),
      });
    }
  }
  return out.sort((a, b) => a.dueDay - b.dueDay || a.rate - b.rate || a.key.localeCompare(b.key));
}

// Bildirim metni (saf). "Tekrar zamanı: TYT Matematik — 'Mutlak Değer' (7 gün önce net oranı %42). 15 soruluk kısa bir dönüş bilgini
// tazeler." Birden çok konu " · " ile. Adlara/sayılara ek yapıştırılmaz; hüküm yok, yalnız gün ve oran + bir sonraki adım.
export function reviewReminderText(topics) {
  const parts = topics.map((t) => {
    const topic = t.topic.length > TEXT_TOPIC_MAX ? `${t.topic.slice(0, TEXT_TOPIC_MAX - 1).trimEnd()}…` : t.topic;
    return `${t.examType} ${t.subject} — '${topic}' (${t.daysAgo} gün önce net oranı ${fmtPct(t.rate * 100)})`;
  });
  const next = topics.length === 1 ? "15 soruluk kısa bir dönüş bilgini tazeler." : "Her birine 15 soruluk kısa bir dönüş bilgini tazeler.";
  return `Tekrar zamanı: ${parts.join(" · ")}. ${next}`;
}

// ------------------------------------------------------------------------------------------------ veri
// Öğrenci kümesinin vakti gelmiş ve henüz gönderilmemiş hatırlatmaları: Map<studentId, topics[]> (öncelik sırasıyla).
// topics[i].prevBaseDate: aynı anahtar × aşamada eski bir döngünün satırı varsa onun baseDate'i (devralınacak).
async function dueByStudent(studentIds, now) {
  const today = trDay(now);
  const since = new Date((today - LOOKBACK_DAYS) * DAY_MS - TR_UTC_OFFSET_MS); // o TR gününün başlangıcı
  const [recipients, sessions] = await Promise.all([
    prisma.assignmentRecipient.findMany({
      where: {
        studentId: { in: studentIds }, completed: true, completedAt: { gte: since }, submission: { isNot: null },
        assignment: { status: "SENT", examType: { in: EXAMS } },
      },
      select: {
        studentId: true, completedAt: true,
        assignment: { select: { examType: true, subject: true, topic: true } },
        submission: { select: { correctCount: true, wrongCount: true, blankCount: true, createdAt: true } },
      },
    }),
    prisma.studySession.findMany({
      where: { studentId: { in: studentIds }, examType: { in: EXAMS }, studyDate: { gte: since } },
      select: { studentId: true, examType: true, subject: true, topic: true, correctCount: true, wrongCount: true, blankCount: true, studyDate: true, createdAt: true },
    }),
  ]);
  const per = new Map();
  const push = (id, rec) => { if (!per.has(id)) per.set(id, []); per.get(id).push(rec); };
  for (const r of recipients) {
    const s = r.submission;
    push(r.studentId, {
      examType: r.assignment.examType, subject: r.assignment.subject, topic: r.assignment.topic,
      day: trDay(r.completedAt), at: s.createdAt.getTime(), D: s.correctCount, Y: s.wrongCount, B: s.blankCount, free: false,
    });
  }
  for (const s of sessions) {
    push(s.studentId, {
      examType: s.examType, subject: s.subject, topic: s.topic,
      day: trDay(s.studyDate), at: s.createdAt.getTime(), D: s.correctCount, Y: s.wrongCount, B: s.blankCount, free: true,
    });
  }

  const due = new Map();
  for (const [id, records] of per) {
    const list = dueReviewTopics(records, today);
    if (list.length) due.set(id, list);
  }
  if (!due.size) return due;

  // Gönderilmiş olanlar: aynı anahtar × aşamada bu döngünün (ya da daha yeni bir döngünün — sonraki kayıt silinmişse)
  // satırı varsa atlanır; daha eski bir döngünün satırı varsa devralınır.
  const logs = await prisma.reviewReminderLog.findMany({
    where: { studentId: { in: [...due.keys()] }, key: { in: [...new Set([...due.values()].flat().map((t) => t.key))] } },
    select: { studentId: true, key: true, stage: true, baseDate: true },
  });
  const logOf = new Map(logs.map((l) => [`${l.studentId}|${l.key}|${l.stage}`, l]));
  for (const [id, list] of due) {
    const open = [];
    for (const t of list) {
      const log = logOf.get(`${id}|${t.key}|${t.stage}`);
      if (log && trDay(log.baseDate) >= t.baseDay) continue;
      open.push({ ...t, prevBaseDate: log ? log.baseDate : null });
    }
    if (open.length) due.set(id, open);
    else due.delete(id);
  }
  return due;
}

// Konuları sahiplenir (tek işlem: ya hepsi ya hiçbiri), sonra bildirimi yazar. false → başka bir tur az önce sahiplendi.
async function claimAndNotify(studentId, topics, now) {
  try {
    await prisma.$transaction(async (tx) => {
      for (const t of topics) {
        const baseDate = new Date(t.baseDay * DAY_MS); // TR günü, tarih-yalnız biçimde (UTC gece yarısı)
        if (t.prevBaseDate) {
          const taken = await tx.reviewReminderLog.updateMany({
            where: { studentId, key: t.key, stage: t.stage, baseDate: t.prevBaseDate }, data: { baseDate, sentAt: now },
          });
          if (taken.count !== 1) throw Object.assign(new Error("başka bir tur sahiplendi"), { code: "REVIEW_CLAIMED" });
        } else {
          await tx.reviewReminderLog.create({ data: { studentId, key: t.key, stage: t.stage, baseDate, sentAt: now } });
        }
      }
    });
  } catch (e) {
    if (e?.code === "P2002" || e?.code === "REVIEW_CLAIMED") return false;
    throw e;
  }
  const [first] = topics;
  // Konu serbest metin ve sunucuda uzunluk sınırı yok: prefill push'un data alanına JSON metni olarak girer, FCM ise
  // tüm yükü 4 KB ile sınırlar — çok uzun bir konu push'u sessizce düşürmesin diye anahtardaki sınırla kısaltılır.
  await notifyUser(studentId, reviewReminderText(topics), {
    type: "review_reminder",
    data: { screen: "studyLog", prefill: { examType: first.examType, subject: first.subject, topic: first.topic.slice(0, KEY_TOPIC_MAX) } },
    now,
  });
  return true;
}

// ------------------------------------------------------------------------------------------------ zamanlayıcı adımı
// Günün turu tamamlandıysa (hatasız) o günün sonraki turları hiçbir şey sorgulamaz: bugün vakti gelen her şey ilk turda
// gönderildi, günlük sınıra takılanlar zaten yarına kaldı; yeni girilen kayıtlar ancak gelecekteki günlerin tabanı olur.
// Yalnızca performans için (süreç belleği) — doğruluk tablodan: yeniden başlatmada tur bir kez daha koşar, kimseye ikinci
// bildirim gitmez. Geriye dönük tarihli bir kayıt (7 gün önceki bir çalışmayı bugün girmek) ertesi günün turunda yetişir.
let passDoneDay = null;
// Testler: süreç yeniden başlamış gibi (bellek sıfır) aynı günün turunu yeniden koşturmak için.
export function resetReviewReminderPass() {
  passDoneDay = null;
}

export async function notifyReviewReminders(now) {
  if (trHour(now) < REVIEW_REMINDER_TR_HOUR) return;
  const today = trDay(now);
  if (passDoneDay === today) return;
  const dayStart = trStartOfToday(now);
  const sentToday = await prisma.reviewReminderLog.findMany({
    where: { sentAt: { gte: dayStart, lt: new Date(dayStart.getTime() + DAY_MS) } }, select: { studentId: true }, distinct: ["studentId"],
  });
  const done = new Set(sentToday.map((r) => r.studentId));
  const students = await prisma.user.findMany({
    where: { role: "STUDENT", banned: false, gradeLevel: { in: GRADES } }, select: { id: true }, orderBy: { id: "asc" },
  });
  let failed = false;
  for (const ids of chunks(students.map((s) => s.id).filter((id) => !done.has(id)), CHUNK)) {
    const due = await dueByStudent(ids, now);
    for (const [studentId, topics] of due) {
      try {
        await claimAndNotify(studentId, topics.slice(0, REVIEW_MAX_TOPICS), now);
      } catch (e) {
        failed = true;
        console.error(`[scheduler] tekrar hatırlatması gönderilemedi (öğrenci ${studentId}):`, e.message);
      }
    }
  }
  if (!failed) passDoneDay = today;
}
