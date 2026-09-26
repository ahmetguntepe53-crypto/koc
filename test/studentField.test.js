// YKS alanı (User.field): istemci/sunucu doğrulamasının eşliği, alan ders listelerinin geçerliliği ve aylık
// değerlendirme botunun alanı kullanması. Veriler kurgusaldır (bkz. fixtures/reportFixture.js).
import { describe, it, expect } from "vitest";
import { normalizeField, STUDENT_FIELDS, FIELD_AYT, FIELD_LABELS, FIELD_SHORT, FIELD_OPTIONS } from "../src/studentField.js";
import * as server from "../server/src/subjects.js";
import { SUBJECTS_BY_EXAM } from "../src/subjects.js";
import { buildReport, monthWindowKey } from "../src/reportModel.js";
import { extractFacts, buildNarrative } from "../src/narrative/index.js";
import { makeFixture, FIXTURE_NOW } from "./fixtures/reportFixture.js";

describe("alan değerleri", () => {
  const inputs = [
    "SAY", "say", "Sayısal", "SAYISAL", "EA", "ea", "Eşit Ağırlık", "EŞİT AĞIRLIK", "esit agirlik", "TM", "SÖZ", "SOZ", "söz", "Sözel", "SÖZEL",
    "DİL", "DIL", "dil", "Dil", "YDT", "Yabancı Dil", " SAY ", "", "  ", null, undefined, "MF", "Sayısal-2", "X", 12, {}, [],
  ];

  it("kod, tam ad, eski ad ve Türkçe büyük harf biçimleri tanınır; tanınmayan undefined", () => {
    expect(normalizeField("Sayısal")).toBe("SAY");
    expect(normalizeField("EŞİT AĞIRLIK")).toBe("EA");
    expect(normalizeField("TM")).toBe("EA");
    expect(normalizeField("SÖZ")).toBe("SOZ");
    expect(normalizeField("DİL")).toBe("DIL");
    expect(normalizeField("DIL")).toBe("DIL"); // "DIL" tr-TR küçük harfte "dıl" olur
    expect(normalizeField("YDT")).toBe("DIL");
    expect(normalizeField("")).toBeNull();
    expect(normalizeField(null)).toBeNull();
    expect(normalizeField(undefined)).toBeNull();
    expect(normalizeField("MF")).toBeUndefined();
    expect(normalizeField(12)).toBeUndefined();
  });

  it("istemci ve sunucu aynı sonucu verir (iki ayrı paket, aynı kural)", () => {
    expect(server.STUDENT_FIELDS).toEqual(STUDENT_FIELDS);
    for (const v of inputs) expect(server.normalizeField(v), JSON.stringify(v)).toBe(normalizeField(v));
  });

  it("alan ders listeleri geçerli AYT dersleri; her alanın adı ve seçeneği var", () => {
    for (const f of STUDENT_FIELDS) {
      for (const s of FIELD_AYT[f]) expect(SUBJECTS_BY_EXAM.AYT, `${f}: ${s}`).toContain(s);
      expect(FIELD_LABELS[f]).toBeTruthy();
      expect(FIELD_SHORT[f]).toBeTruthy();
    }
    expect(FIELD_AYT.DIL).toEqual([]);
    expect(FIELD_OPTIONS.map((o) => o.value)).toEqual(STUDENT_FIELDS);
  });
});

describe("aylık değerlendirme botu ve alan", () => {
  // Zengin kurgusal veriye Ekim'de okuldan gelen ama hiç kaydı olmayan AYT Tarih-1 ödevleri eklenir.
  function fixtureWithSchoolTarih(field) {
    const raw = makeFixture({ weeks: 20 });
    const extra = ["2026-10-09", "2026-10-16", "2026-10-23"].map((end, i) => ({
      id: `t1-${i}`, assignmentId: `t1a-${i}`, examType: "AYT", subject: "Tarih-1", topic: "Tarih ve Zaman", sourceBook: "Okul Kaynağı",
      source: "branch", teacher: "Oya Er", expected: 20, scheduledDate: `${end.slice(0, 8)}${String(Number(end.slice(8)) - 4).padStart(2, "0")}T00:00:00.000Z`,
      endDate: `${end}T00:00:00.000Z`, completed: false, completedAt: null, skippedAt: null, skipReason: null, reminderAt: null,
      correct: null, wrong: null, blank: null, questionNumbers: [], school: null, konuSkipRate: null, note: null, skipNote: null, photos: 0,
    }));
    return { ...raw, items: [...raw.items, ...extra], student: { ...raw.student, field } };
  }
  const factsFor = (raw) => {
    const keys = ["2026-10", "2026-09"];
    return extractFacts(keys.map((k) => buildReport(raw, { window: monthWindowKey(k), now: FIXTURE_NOW })), keys);
  };

  it("alan bilinmiyorsa takip dışı AYT dersi için teyit uyarısı çıkar", () => {
    const F = factsFor(fixtureWithSchoolTarih(null));
    const d = F.dikkat.find((x) => x.key === "dikkat.takipDisi");
    expect(d?.f.dersler).toContain("AYT Tarih-1");
  });

  it("alan biliniyorsa (alan dışı ders) teyit uyarısı çıkmaz; alandaysa ders izlenir", () => {
    expect(factsFor(fixtureWithSchoolTarih("SAY")).dikkat.some((x) => x.key === "dikkat.takipDisi")).toBe(false);
    const ea = buildReport(fixtureWithSchoolTarih("EA"), { window: monthWindowKey("2026-10"), now: FIXTURE_NOW });
    expect(ea.subjectMap.get("AYT|Tarih-1").tracked).toBe(true);
    expect(ea.coach.dataNotes.untracked.map((u) => u.name)).not.toContain("AYT Tarih-1");
  });

  it("alanlı veride de metinler temiz", () => {
    for (const field of ["SAY", "EA", "SOZ", "DIL"]) {
      const n = buildNarrative(fixtureWithSchoolTarih(field), { month: "2026-10", now: FIXTURE_NOW });
      const texts = [n.ozet, ...n.gucluYonler, ...n.gelisimAlanlari.flatMap((g) => [g.alan, g.kanit, g.oneri]), ...n.kocaOneriler, n.ogrenciyleKonusma, ...n.dikkat].filter(Boolean);
      for (const s of texts) {
        expect(s).not.toMatch(/undefined|NaN|null|\[object/);
        expect(s).not.toMatch(/alan bilgisi/);
      }
    }
  });
});
