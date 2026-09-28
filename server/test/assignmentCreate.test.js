// Ödev atama yetkisi ve hedef kitlesi (POST /api/assignments, GET /api/assignments/audience) —
// 2026-09-28'de okulun kararıyla değişti:
//  • ödevi YALNIZCA branş öğretmeni atar, koç atayamaz (koç ödevlerin takibini yapar),
//  • branş öğretmeni kendi koçluk ettikleriyle sınırlı değil, okuldaki HERKESİ hedefleyebilir,
//  • ama yalnızca KENDİ branşındaki dersten ödev verebilir,
//  • sınıf düzeyi girilmemiş / askıya alınmış öğrenci hedeflenemez.
import { describe, it, expect, beforeAll } from "vitest";
import { prisma, resetDatabase, seedSchool, createUser, loginAll, api } from "./helpers.js";

const BASE = {
  examType: "TYT", subject: "Matematik", topic: "Yetki testi konusu",
  period: "WEEKLY", scheduledDate: "2027-02-01", endDate: "2027-02-07", sendMode: "MANUAL_NOW",
};
let w, t, banned, gradeless;

beforeAll(async () => {
  await resetDatabase();
  w = await seedSchool();
  banned = await createUser({ role: "STUDENT", name: "Test Öğrenci Askıda", username: "ogr-askida", gradeLevel: 12, teacherId: w.coachA.id, banned: true });
  gradeless = await createUser({ role: "STUDENT", name: "Test Öğrenci Sınıfsız", username: "ogr-sinifsiz", gradeLevel: null, teacherId: w.coachA.id });
  t = await loginAll({ branch: w.branch, coachA: w.coachA, admin: w.admin, student: w.grade12[0] });
});

const create = (token, body = {}) => api(token).post("/api/assignments", { ...BASE, ...body });

describe("ödev atama yetkisi", () => {
  it("koç ödev atayamaz — kendi öğrencisine bile", async () => {
    const own = w.grade12.filter((s) => s.teacherId === w.coachA.id);
    expect(own.length).toBeGreaterThan(0);
    const r = await create(t.coachA, { studentIds: [own[0].id] });
    expect(r.status).toBe(403);
    expect(r.body.error).toMatch(/branş öğretmenlerinde/i);
  });

  it("öğrenci ve yönetici de atayamaz", async () => {
    for (const token of [t.student, t.admin]) {
      const r = await create(token, { studentIds: [w.grade12[0].id] });
      expect(r.status).toBe(403);
    }
  });

  it("branş öğretmeni koçluk etmediği öğrencilere atayabilir", async () => {
    const hedef = w.grade11.slice(0, 3);
    // Branş öğretmeninin koçluk ettiği öğrenci yok — eski kural bu isteği reddederdi.
    expect(hedef.every((s) => s.teacherId !== w.branch.id)).toBe(true);
    const r = await create(t.branch, { studentIds: hedef.map((s) => s.id) });
    expect(r.status).toBe(201);
    expect(r.body.assignment.recipients).toHaveLength(3);
    expect(r.body.assignment.status).toBe("SENT");
    expect(r.body.assignment.targetMode).toBe("SELECTED_STUDENTS");
  });

  it("okulun tamamı seçilirse targetMode SCHOOL_WIDE olur", async () => {
    const hepsi = [...w.grade11, ...w.grade12];
    const r = await create(t.branch, { studentIds: hepsi.map((s) => s.id), topic: "Okul çapı konusu" });
    expect(r.status).toBe(201);
    expect(r.body.assignment.targetMode).toBe("SCHOOL_WIDE");
    expect(r.body.assignment.recipients).toHaveLength(hepsi.length);
  });

  it("branşı dışındaki dersten ödev veremez", async () => {
    const r = await create(t.branch, { subject: "Coğrafya", studentIds: [w.grade12[0].id] });
    expect(r.status).toBe(403);
    expect(r.body.error).toMatch(/branşında değil/i);
  });

  it("askıya alınmış ya da sınıf düzeyi girilmemiş öğrenci hedeflenemez", async () => {
    for (const s of [banned, gradeless]) {
      const r = await create(t.branch, { studentIds: [s.id] });
      expect(r.status).toBe(400);
    }
  });

  it("AYT ödevi branşın AYT derslerinden verilebilir", async () => {
    const r = await create(t.branch, { examType: "AYT", subject: "Fizik", studentIds: [w.grade12[0].id], topic: "AYT Fizik konusu" });
    expect(r.status).toBe(201);
    expect(r.body.assignment.examType).toBe("AYT");
  });
});

describe("hedef kitle listesi", () => {
  it("branş öğretmeni okuldaki tüm uygun öğrencileri görür; askıda ve sınıfsız olanlar yok", async () => {
    const r = await api(t.branch).get("/api/assignments/audience");
    expect(r.status).toBe(200);
    const ids = r.body.students.map((s) => s.id);
    expect(ids).toHaveLength(w.grade11.length + w.grade12.length);
    expect(ids).not.toContain(banned.id);
    expect(ids).not.toContain(gradeless.id);
    expect(r.body.teachingSubjects).toEqual(["Matematik", "Fizik"]);
    // Şube bazlı gönderim için sınıf adı da gelmeli.
    expect(r.body.students.every((s) => s.className)).toBe(true);
  });

  it("koç bu listeyi göremez", async () => {
    const r = await api(t.coachA).get("/api/assignments/audience");
    expect(r.status).toBe(403);
  });
});

describe("kaynak kitap hatırlama", () => {
  it("en son kullanılan kaynak önerilerin başında gelir", async () => {
    await create(t.branch, { studentIds: [w.grade12[1].id], sourceBook: "Eski Yayınları", topic: "Kaynak 1" });
    await create(t.branch, { studentIds: [w.grade12[1].id], sourceBook: "Yeni Yayınları", topic: "Kaynak 2" });
    const r = await api(t.branch).get("/api/assignments/source-books?examType=TYT");
    expect(r.status).toBe(200);
    expect(r.body.sourceBooks[0]).toBe("Yeni Yayınları");
  });

  it("sayfa/soru alanı boş bırakılabilir", async () => {
    const r = await create(t.branch, { studentIds: [w.grade12[2].id], topic: "Sayfasız konu", pageRange: undefined });
    expect(r.status).toBe(201);
    expect(r.body.assignment.pageRange).toBeNull();
    const saved = await prisma.assignment.findUnique({ where: { id: r.body.assignment.id } });
    expect(saved.pageRange).toBeNull();
  });
});

// Toplu gönderimin asıl riski bildirimlerde: okulun tamamına tek istekte ödev çıkınca her öğrenciye
// KENDİ alıcı kaydının id'siyle bir bildirim yazılmalı — aksi halde bildirime dokunan öğrenci başka
// birinin sonuç ekranına düşer ya da hiç bildirim almaz.
describe("toplu gönderimde bildirimler", () => {
  it("okulun tamamına gönderimde herkes KENDİ ödev ekranına giden tek bildirim alır", async () => {
    const hepsi = [...w.grade11, ...w.grade12];
    const before = await prisma.notification.count({ where: { type: "assignment" } });
    const r = await create(t.branch, { studentIds: hepsi.map((s) => s.id), topic: "Bildirim testi konusu", subject: "Fizik" });
    expect(r.status).toBe(201);

    const after = await prisma.notification.count({ where: { type: "assignment" } });
    expect(after - before).toBe(hepsi.length); // öğrenci başına tam bir tane, eksik ya da fazla değil

    const recipients = r.body.assignment.recipients;
    const notifications = await prisma.notification.findMany({
      where: { type: "assignment", userId: { in: hepsi.map((s) => s.id) } },
      orderBy: { createdAt: "desc" },
      take: hepsi.length,
    });
    // Her öğrencinin bildirimi kendi AssignmentRecipient kaydına işaret etmeli.
    const recipientIdByStudent = new Map(recipients.map((x) => [x.studentId, x.id]));
    expect(notifications).toHaveLength(hepsi.length);
    for (const n of notifications) {
      expect(n.data.recipientId).toBe(recipientIdByStudent.get(n.userId));
      expect(n.data.screen).toBe("assignmentSubmit");
      expect(n.text).toContain("Bildirim testi konusu");
      expect(n.text).toContain(w.branch.name); // "<öğretmen> sana yeni bir ödev gönderdi"
    }
  });

  it("taslak (tarihi gelince gönder) seçilirse henüz bildirim gitmez", async () => {
    const before = await prisma.notification.count({ where: { type: "assignment" } });
    const r = await create(t.branch, {
      studentIds: w.grade11.map((s) => s.id), topic: "Taslak konusu", sendMode: "AUTO_ON_DATE",
    });
    expect(r.status).toBe(201);
    expect(r.body.assignment.status).toBe("DRAFT");
    expect(await prisma.notification.count({ where: { type: "assignment" } })).toBe(before);
  });
});
