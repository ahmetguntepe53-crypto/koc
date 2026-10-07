// Öğrenci profil resmi (hazır avatar): yalnızca öğrenci seçer, geçersiz kimlik reddedilir; koçun listesi ve ödev
// alıcıları avatarı taşır (öğretmen/müdür/yönetici ekranlarında görünsün diye).
import { describe, it, expect, beforeAll } from "vitest";
import { resetDatabase, seedSchool, loginAll, api, createAssignment } from "./helpers.js";

let w, t, S;
beforeAll(async () => {
  await resetDatabase();
  w = await seedSchool({ perGrade: 1 });
  S = w.grade12[0];
  t = await loginAll({ student: S, coach: w.coachA, admin: w.admin });
});

describe("PATCH /api/auth/me/avatar", () => {
  it("öğrenci hazır avatarı seçer, null ile kaldırır; geçersiz kimlik 400, öğretmen 403", async () => {
    const r = await api(t.student).patch("/api/auth/me/avatar").send({ avatar: "baykus" });
    expect(r.status).toBe(200);
    expect(r.body.user.avatar).toBe("baykus");
    expect((await api(t.student).get("/api/auth/me")).body.user.avatar).toBe("baykus");
    expect((await api(t.student).patch("/api/auth/me/avatar").send({ avatar: "../etc/passwd" })).status).toBe(400);
    expect((await api(t.coach).patch("/api/auth/me/avatar").send({ avatar: "kedi" })).status).toBe(403);
    const cleared = await api(t.student).patch("/api/auth/me/avatar").send({ avatar: null });
    expect(cleared.body.user.avatar).toBeNull();
    await api(t.student).patch("/api/auth/me/avatar").send({ avatar: "kedi" });
  });

  it("koçun öğrenci listesi ve ödev alıcıları avatarı taşır", async () => {
    const list = await api(t.coach).get("/api/teacher/students");
    const row = (list.body.students || list.body).find((s) => s.id === S.id);
    expect(row.avatar).toBe("kedi");
    const a = await createAssignment({ teacher: w.branch, students: [S], subject: "Matematik", questionCount: 10 });
    const detail = await api(t.admin).get(`/api/assignments/${a.id}`);
    expect(detail.body.assignment.recipients.find((r) => r.studentId === S.id).student.avatar).toBe("kedi");
  });
});
