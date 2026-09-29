// Zorunlu güncelleme — GET /api/app-version (bkz. routes/appVersion.js) GENEL erişimlidir (oturum
// gerekmez, açılışta giriş ekranından ÖNCE kontrol edilir); eşikler admin PUT /api/admin/settings
// üzerinden ayarlanır. Android ve iOS AYRI alanlar — biri diğerini etkilememeli.
import { describe, it, expect, beforeAll } from "vitest";
import { prisma, resetDatabase, seedSchool, loginAll, api } from "./helpers.js";

let w, t;
beforeAll(async () => {
  await resetDatabase();
  w = await seedSchool();
  t = await loginAll({ admin: w.admin, coachA: w.coachA });
});

describe("GET /api/app-version", () => {
  it("kimlik gerektirmez, hiçbir şey ayarlanmadıysa ikisi de null", async () => {
    const r = await api(null).get("/api/app-version");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ minAndroidBuild: null, minIosBuild: null });
  });

  it("admin bir platformu ayarlayınca yalnızca o platform değişir", async () => {
    const put = await api(t.admin).put("/api/admin/settings", { minAndroidBuild: 14 });
    expect(put.status).toBe(200);
    expect(put.body.minAndroidBuild).toBe(14);
    expect(put.body.minIosBuild).toBeNull(); // dokunulmadı

    const r = await api(null).get("/api/app-version");
    expect(r.body).toEqual({ minAndroidBuild: 14, minIosBuild: null });
  });

  it("boş/null gönderilirse o platformun zorlaması kalkar", async () => {
    await api(t.admin).put("/api/admin/settings", { minAndroidBuild: 14 });
    const put = await api(t.admin).put("/api/admin/settings", { minAndroidBuild: null });
    expect(put.body.minAndroidBuild).toBeNull();
  });
});

describe("PUT /api/admin/settings — doğrulama ve yetki", () => {
  it("geçersiz (negatif, tam sayı olmayan) değer reddedilir", async () => {
    for (const bad of [-1, 0, 1.5, "abc"]) {
      const r = await api(t.admin).put("/api/admin/settings", { minAndroidBuild: bad });
      expect(r.status).toBe(400);
    }
  });

  it("admin olmayan ayarlayamaz", async () => {
    const r = await api(t.coachA).put("/api/admin/settings", { minAndroidBuild: 14 });
    expect(r.status).toBe(403);
  });
});
