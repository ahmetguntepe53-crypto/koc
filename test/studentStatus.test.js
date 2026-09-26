import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { makeFixture, FIXTURE_NOW } from "./fixtures/reportFixture.js";

// Öğrencilerim listesindeki durum çipinin yükleyicisi (src/studentStatus.js). Rapor modeli burada sahte: her
// "rapor" yanıtı doğrudan döndürmek istediğimiz koç durumunu taşır — yükleyicinin davranışı (önbellek, eşzamanlılık,
// hata toleransı) modelden bağımsız sınanır. Son test gerçek modelle raporun durumuyla birebir aynılığı doğrular.
vi.mock("../src/api.js", async () => {
  const actual = await vi.importActual("../src/api.js");
  return { ...actual, api: { ...actual.api, getFullReport: vi.fn() } };
});
vi.mock("../src/reportModel.js", async () => {
  const actual = await vi.importActual("../src/reportModel.js");
  return { ...actual, buildReport: vi.fn() };
});
import { api } from "../src/api.js";
import { buildReport } from "../src/reportModel.js";
import {
  loadStudentStatuses, getCachedStatus, clearStudentStatusCache, statusRank, STATUS_TTL_MS, STATUS_CONCURRENCY, STATUS_WINDOW,
} from "../src/studentStatus.js";

const coachOf = (status, reasons = []) => ({
  status, statusLabel: { intervene: "Müdahale", watch: "Takip et", ok: "Yolunda" }[status], reasons,
});
// Sahte ham rapor: yalnızca beklenen koç durumunu taşır; sahte model onu aynen döndürür.
const rawFor = (status, reasons) => ({ viewer: "coach", fake: coachOf(status, reasons) });

function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  clearStudentStatusCache();
  api.getFullReport.mockReset();
  buildReport.mockReset();
  buildReport.mockImplementation((raw) => ({ coach: raw.fake }));
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(FIXTURE_NOW);
});
afterEach(() => vi.useRealTimers());

describe("studentStatus", () => {
  it("raporun modelini raporun varsayılan penceresiyle çalıştırır ve yalnızca durumu döndürür", async () => {
    api.getFullReport.mockImplementation(async (id) => rawFor(id === "a" ? "intervene" : "ok", id === "a" ? ["2 sessiz ödev (14 gün)"] : []));
    const onStatus = vi.fn();
    const res = await loadStudentStatuses(["a", "b"], { onStatus });

    expect(STATUS_WINDOW).toBe("4w");
    expect(buildReport).toHaveBeenCalledWith(expect.objectContaining({ viewer: "coach" }), { window: "4w" });
    expect(res.get("a")).toEqual({ status: "intervene", statusLabel: "Müdahale", reasons: ["2 sessiz ödev (14 gün)"] });
    expect(res.get("b")).toEqual({ status: "ok", statusLabel: "Yolunda", reasons: [] });
    expect(onStatus).toHaveBeenCalledTimes(2);
    expect(onStatus).toHaveBeenCalledWith("a", res.get("a"));
  });

  it("5 dakika önbellek: süre içinde yeniden istek yok, süre dolunca yeniden hesaplanır", async () => {
    api.getFullReport.mockResolvedValue(rawFor("watch", ["TYT Fizik: konu pası"]));
    await loadStudentStatuses(["a"]);
    expect(api.getFullReport).toHaveBeenCalledTimes(1);
    expect(getCachedStatus("a")).toMatchObject({ status: "watch", statusLabel: "Takip et" });

    vi.setSystemTime(FIXTURE_NOW.getTime() + STATUS_TTL_MS - 1000);
    const again = await loadStudentStatuses(["a"]);
    expect(api.getFullReport).toHaveBeenCalledTimes(1);
    expect(again.get("a").status).toBe("watch");

    vi.setSystemTime(FIXTURE_NOW.getTime() + STATUS_TTL_MS + 1000);
    expect(getCachedStatus("a")).toBeNull();
    api.getFullReport.mockResolvedValue(rawFor("ok"));
    const fresh = await loadStudentStatuses(["a"]);
    expect(api.getFullReport).toHaveBeenCalledTimes(2);
    expect(fresh.get("a").status).toBe("ok");
  });

  it("aynı anda en fazla 2 istek — listedeki sırayla, iki ayrı yükleme birlikte çalışsa da", async () => {
    expect(STATUS_CONCURRENCY).toBe(2);
    const pending = new Map();
    let active = 0;
    let peak = 0;
    const started = [];
    api.getFullReport.mockImplementation((id) => {
      started.push(id);
      active += 1;
      peak = Math.max(peak, active);
      const d = deferred();
      pending.set(id, d);
      return d.promise.finally(() => { active -= 1; });
    });
    const first = loadStudentStatuses(["a", "b", "c", "d"]);
    const second = loadStudentStatuses(["e", "f"]); // ortak sınır: bu yükleme de sıraya girer
    await vi.waitFor(() => expect(started).toEqual(["a", "b"]));
    // İstekleri başladıkları sırayla tek tek bitir; her adımda yeni bir istek başlayabilir.
    for (let i = 0; i < 6; i++) {
      await vi.waitFor(() => expect(started.length).toBeGreaterThan(i));
      pending.get(started[i]).resolve(rawFor("ok"));
    }
    const [r1, r2] = await Promise.all([first, second]);

    expect(peak).toBe(2);
    expect(started.slice(0, 2)).toEqual(["a", "b"]);
    expect(started.indexOf("c")).toBeLessThan(started.indexOf("d"));
    expect(started.indexOf("e")).toBeLessThan(started.indexOf("f"));
    expect(new Set(started).size).toBe(6);
    expect([...r1.keys()]).toEqual(expect.arrayContaining(["a", "b", "c", "d"]));
    expect(r2.get("f").status).toBe("ok");
  });

  it("aynı öğrenci için eşzamanlı ikinci istek atılmaz", async () => {
    const d = deferred();
    api.getFullReport.mockReturnValue(d.promise);
    const p1 = loadStudentStatuses(["a"]);
    const p2 = loadStudentStatuses(["a"]);
    await vi.waitFor(() => expect(api.getFullReport).toHaveBeenCalledTimes(1));
    d.resolve(rawFor("intervene", ["9 gündür kayıt yok"]));
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(api.getFullReport).toHaveBeenCalledTimes(1);
    expect(r1.get("a")).toBe(r2.get("a"));
  });

  it("hata toleransı: hatalı öğrenci çipsiz kalır, diğerleri gelir, hata önbelleğe girmez", async () => {
    api.getFullReport.mockImplementation(async (id) => {
      if (id === "b") throw Object.assign(new Error("Bu öğrenci sana atanmamış"), { status: 403 });
      return rawFor("ok");
    });
    const onStatus = vi.fn();
    const res = await loadStudentStatuses(["a", "b", "c"], { onStatus });
    expect(res.get("b")).toBeNull();
    expect(res.get("a").status).toBe("ok");
    expect(res.get("c").status).toBe("ok");
    expect(onStatus.mock.calls.map((c) => c[0])).toEqual(["a", "c"]);
    expect(getCachedStatus("b")).toBeNull();

    // Model hatası da aynı şekilde yutulur; bir sonraki açılış yeniden dener.
    buildReport.mockImplementationOnce(() => { throw new Error("model"); });
    api.getFullReport.mockResolvedValue(rawFor("watch"));
    const retry = await loadStudentStatuses(["b"]);
    expect(retry.get("b")).toBeNull();
    const retry2 = await loadStudentStatuses(["b"]);
    expect(retry2.get("b").status).toBe("watch");
  });

  it("iptal edilince sıradaki öğrenciler için istek başlatılmaz", async () => {
    const pending = new Map();
    api.getFullReport.mockImplementation((id) => {
      const d = deferred();
      pending.set(id, d);
      return d.promise;
    });
    const ctrl = new AbortController();
    const onStatus = vi.fn();
    const p = loadStudentStatuses(["a", "b", "c", "d"], { signal: ctrl.signal, onStatus });
    await vi.waitFor(() => expect(pending.size).toBe(2));
    ctrl.abort();
    pending.get("a").resolve(rawFor("ok"));
    pending.get("b").resolve(rawFor("ok"));
    await p;
    expect(api.getFullReport).toHaveBeenCalledTimes(2);
    expect(onStatus).not.toHaveBeenCalled();
    // Süren isteklerin sonucu boşa gitmez: önbellekte.
    expect(getCachedStatus("a")).toMatchObject({ status: "ok" });
  });

  it("önbellek temizlenince (çıkış) önceden başlamış isteğin geç sonucu önbelleğe yazılmaz; yeni istek eskisine bağlanmaz", async () => {
    const old = deferred();
    api.getFullReport.mockReturnValueOnce(old.promise);
    const before = loadStudentStatuses(["a"]);
    await vi.waitFor(() => expect(api.getFullReport).toHaveBeenCalledTimes(1));
    clearStudentStatusCache(); // ör. koç çıktı, başka hesap girdi

    api.getFullReport.mockResolvedValueOnce(rawFor("ok"));
    const after = loadStudentStatuses(["a"]);
    old.resolve(rawFor("intervene", ["eski oturum"]));
    const [r1, r2] = await Promise.all([before, after]);
    expect(api.getFullReport).toHaveBeenCalledTimes(2);
    expect(r1.get("a").status).toBe("intervene"); // eski çağıran kendi sonucunu alır
    expect(r2.get("a").status).toBe("ok");
    expect(getCachedStatus("a")).toMatchObject({ status: "ok" }); // önbellekte yalnızca yeni oturumunki
  });

  it("'Önce müdahale' sırası: müdahale < takip et < yolunda < durum yok", () => {
    expect(statusRank(coachOf("intervene"))).toBeLessThan(statusRank(coachOf("watch")));
    expect(statusRank(coachOf("watch"))).toBeLessThan(statusRank(coachOf("ok")));
    expect(statusRank(coachOf("ok"))).toBeLessThan(statusRank(null));
  });

  it("gerçek modelle: çip, raporun koç panelindeki durumun aynısı", async () => {
    const actual = await vi.importActual("../src/reportModel.js");
    buildReport.mockImplementation(actual.buildReport);
    const raws = { a: makeFixture({ seed: 42 }), b: makeFixture({ seed: 99 }), c: makeFixture({ sparse: true }) };
    api.getFullReport.mockImplementation(async (id) => raws[id]);
    const res = await loadStudentStatuses(["a", "b", "c"]);
    const seen = new Set();
    for (const id of ["a", "b", "c"]) {
      const { coach } = actual.buildReport(raws[id], { window: "4w" });
      expect(res.get(id)).toEqual({ status: coach.status, statusLabel: coach.statusLabel, reasons: coach.reasons });
      seen.add(coach.status);
    }
    expect(seen).toEqual(new Set(["intervene", "watch", "ok"]));
  });
});
