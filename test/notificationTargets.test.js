import { describe, it, expect } from "vitest";
import { studyPrefillFromNotification } from "../src/notificationTargets.js";

// Tekrar hatırlatmasının (server/src/reviewReminders.js) prefill'i iki yoldan gelir: Bildirimler listesinde nesne, push'a
// dokununca FCM data'sından JSON metni (server/src/notify.js > stringifyData). İkisi de aynı ön doldurmaya dönmeli.
describe("studyPrefillFromNotification", () => {
  const prefill = { examType: "TYT", subject: "Matematik", topic: "Mutlak Değer" };

  it("uygulama içi bildirim: nesne", () => {
    expect(studyPrefillFromNotification(prefill)).toEqual(prefill);
  });

  it("push: JSON metni", () => {
    expect(studyPrefillFromNotification(JSON.stringify(prefill))).toEqual(prefill);
  });

  it("bozuk ya da eksik veri: null veya güvenli varsayılanlar", () => {
    expect(studyPrefillFromNotification(undefined)).toBeNull();
    expect(studyPrefillFromNotification("[object Object]")).toBeNull();
    expect(studyPrefillFromNotification("[1,2]")).toBeNull();
    expect(studyPrefillFromNotification({ examType: 5, subject: null })).toEqual({ examType: undefined, subject: undefined, topic: "" });
  });
});
