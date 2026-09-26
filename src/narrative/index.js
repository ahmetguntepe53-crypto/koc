// Otomatik aylık değerlendirme ("yorum botu") — ücretsiz, cihazda çalışır, veri hiçbir yere gitmez.
// buildNarrative(sunucu yanıtı, { month }) → { ozet, gucluYonler, gelisimAlanlari, kocaOneriler, ogrenciyleKonusma, dikkat,
// seyir, ... } — yapay zekâ incelemesiyle AYNI biçim (ekran ve PDF ikisini de aynı bileşenle gösterir).
// buildNarrative(raw, { month, audience: "student" }) → öğrencinin kendi "Ayın değerlendirmesi" (./student.js): aynı olgular,
// "sen" diliyle ayrı kalıp bankası (./phrases-student); koça özel bölümler (koça öneriler, görüşme, dikkat) yok.
//
// Nasıl çalışır:
//  1. Seçilen ay ve önceki 5 aya kadar her ay, raporun kendi modeliyle (src/reportModel.js) ayrı hesaplanır.
//  2. Olgular çıkarılır (güçlü yönler, gelişim alanları, riskler, aydan aya seyir); her olguya önem puanı verilir.
//  3. Her bölüm için en önemli olgular seçilir (ders başına sınır, tür çeşitliliği).
//  4. Her olgu, kalıp bankasından (src/narrative/phrases) seçilen bir kalıpla cümleye dönüşür. Seçim öğrenci + ay
//     tohumlu rastgeleliktir: aynı rapor her açılışta aynıdır, farklı öğrencilerde ve aylarda farklı cümleler çıkar.
import { buildReport, monthWindowKey, trDay, fmtDay } from "../reportModel.js";
import { MONTH_FORMS } from "./catalog.js";
import { PHRASES } from "./phrases/index.js";
import { h, rng, tidy, FORBIDDEN } from "./text.js";
import { composeStudent } from "./student.js";

const DAY = 864e5;
const WEEKDAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r2 = (v) => Math.round(v * 100) / 100; // deneme netleri (0,25'in katları; farkları da)

// ---------------------------------------------------------------- aylar
const monthKeyOf = (y, m) => `${y}-${String(m + 1).padStart(2, "0")}`;
function shiftMonth(key, d) {
  const [y, m] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + d, 1));
  return monthKeyOf(t.getUTCFullYear(), t.getUTCMonth());
}
const monthForms = (key) => MONTH_FORMS[Number(key.split("-")[1]) - 1];
const monthStartDay = (key) => { const [y, m] = key.split("-").map(Number); return Math.floor(Date.UTC(y, m - 1, 1) / DAY); };
const monthEndDay = (key) => { const [y, m] = key.split("-").map(Number); return Math.floor(Date.UTC(y, m, 0) / DAY); };
// Ayın ilk haftasında geçen ayın değerlendirmesi okunur; sonra içinde bulunulan ay (TR takvimi).
export function defaultNarrativeMonth(now = new Date()) {
  const t = new Date(now.getTime() + 3 * 3600e3);
  const cur = monthKeyOf(t.getUTCFullYear(), t.getUTCMonth());
  return t.getUTCDate() <= 7 ? shiftMonth(cur, -1) : cur;
}
function firstDataDay(raw) {
  const days = [];
  for (const it of raw.items || []) { days.push(trDay(it.endDate)); if (it.completedAt) days.push(trDay(it.completedAt)); }
  for (const s of raw.sessions || []) days.push(trDay(s.date));
  for (const e of raw.practiceExams || []) days.push(trDay(e.date)); // yalnızca denemesi olan aylar da analize girer
  return days.length ? Math.min(...days) : null;
}

// ---------------------------------------------------------------- ana fonksiyon
export function buildNarrative(raw, { month, now, audience } = {}) {
  const nowD = now ? new Date(now) : new Date();
  const m0 = month || defaultNarrativeMonth(nowD);
  const first = firstDataDay(raw);
  const keys = [m0];
  for (let i = 1; i <= 5; i++) {
    const k = shiftMonth(m0, -i);
    if (first == null || monthEndDay(k) < first) break;
    keys.push(k);
  }
  const models = keys.map((k) => buildReport(raw, { window: monthWindowKey(k), now: nowD }));
  const facts = extractFacts(models, keys);
  const seed = `${raw.student?.id || "?"}|${m0}`;
  if (audience === "student") return composeStudent(facts, seed, { month: m0, keys });
  return compose(facts, seed, { month: m0, keys });
}

// ---------------------------------------------------------------- olgular
const reliableNO = (agg) => (agg && agg.n >= 3 && agg.Q >= 60 ? agg.NO : null);
function direction(vals) {
  const v = vals.filter((x) => x != null);
  if (v.length < 2) return null;
  const diffs = v.slice(1).map((x, i) => x - v[i]);
  const total = v[v.length - 1] - v[0];
  if (total >= 4 && diffs.every((d) => d >= -1.5)) return "up";
  if (total <= -4 && diffs.every((d) => d <= 1.5)) return "down";
  if (Math.abs(total) < 4 && Math.max(...v) - Math.min(...v) < 6) return "flat";
  return "zigzag";
}

export function extractFacts(models, keys) {
  const cur = models[0];
  const prev = models[1] || null;
  const ay = monthForms(keys[0]);
  const F = { ay, ozet: {}, guclu: [], gelisim: [], dikkat: [], seyir: [] };
  const recs = cur.recs.all;
  const recOf = (id) => recs.filter((r) => r.id === id);
  const del = cur.kpi.delivery;
  const tracked = cur.subjects.filter((s) => s.tracked);

  // --- aylık seyir tablosu (eskiden yeniye) — veri olan aylar
  const hist = models.map((m, i) => ({ m, key: keys[i] })).reverse()
    .filter(({ m }) => m.totalRecords > 0 || m.kpi.delivery.V > 0);
  F.seyir = hist.map(({ m, key }) => ({
    ay: monthForms(key).ad, month: key,
    tyt: reliableNO(m.exams.TYT.agg), ayt: reliableNO(m.exams.AYT.agg),
    soru: m.kpi.questions.Q, kayit: m.totalRecords,
    teslim: m.kpi.delivery.V >= 5 ? m.kpi.delivery.deliveredPct : null, V: m.kpi.delivery.V,
    aktifGun: m.kpi.activeDays.n, gunSayisi: m.kpi.activeDays.of, suruyor: !m.window.monthEnded,
  }));
  // Süren (bitmemiş) ay önceki tam ayla hacim olarak karşılaştırılmaz — ayın en az 25 günü geçmiş olmalı.
  const comparableMonth = cur.window.monthEnded || cur.window.days >= 25;

  F.veriYeterliligi = cur.totalRecords < 3 ? "yetersiz" : tracked.some((s) => s.adjNO != null) ? "yeterli" : "sinirli";

  // --- ÖZET olguları
  F.ozet.acilis = { ay, V: del.V, teslim: del.delivered, teslimPct: del.deliveredPct ?? 0, eleAlinanPct: del.handledPct ?? 0, Q: cur.kpi.questions.Q, aktifGun: cur.kpi.activeDays.n, gunSayisi: cur.kpi.activeDays.of, kayit: cur.totalRecords };
  if (F.veriYeterliligi === "yetersiz") F.ozet.acilisAz = { ay, kayit: cur.totalRecords, Q: cur.kpi.questions.Q };
  const strong = cur.chips.strong.filter((s) => s.label === "strong")[0];
  if (strong) F.ozet.guclu = { ders: strong.name, NO: strong.agg.NO ?? strong.labelAgg.NO, pTilde: strong.compCount >= 2 && strong.pTilde >= 50 ? strong.pTilde : null };
  const focus = cur.chips.focusAll[0];
  if (focus) F.ozet.odak = { ders: focus.name, NO: focus.agg.NO ?? focus.labelAgg.NO, konu: focus.lists.first[0]?.name || null };
  const ups = tracked.filter((s) => s.trend.enough && s.trend.dir === "up").sort((a, b) => b.trend.delta - a.trend.delta);
  const downs = tracked.filter((s) => s.trend.enough && s.trend.dir === "down").sort((a, b) => a.trend.delta - b.trend.delta);
  if (ups[0]) F.ozet.yukselis = { ders: ups[0].name, a: ups[0].trend.a, b: ups[0].trend.b };
  if (downs[0]) F.ozet.dusus = { ders: downs[0].name, a: downs[0].trend.a, b: downs[0].trend.b };
  if (prev && prev.kpi.questions.Q > 0 && comparableMonth) {
    const d = ((cur.kpi.questions.Q - prev.kpi.questions.Q) / prev.kpi.questions.Q) * 100;
    if (Math.abs(d) >= 15) F.ozet.hacim = { Q: cur.kpi.questions.Q, oncekiQ: prev.kpi.questions.Q, degisimPct: d, onceki: monthForms(keys[1]) };
  }
  const st = cur.coach.status;
  F.ozet.durum = st === "ok" ? { key: "ozet.durumIyi", f: {} } : { key: st === "intervene" ? "ozet.durumMudahale" : "ozet.durumTakip", f: { nedenler: cur.coach.reasons.slice(0, 2) } };
  // Birkaç aylık gidiş: TYT (yoksa AYT) net oranı.
  for (const ex of ["TYT", "AYT"]) {
    const pts = F.seyir.map((r) => ({ ay: monthForms(r.month), NO: ex === "TYT" ? r.tyt : r.ayt })).filter((p) => p.NO != null);
    if (pts.length >= 2 && !F.ozet.seyir) {
      F.ozet.seyir = { sinav: ex, ilk: pts[0], son: pts[pts.length - 1], yon: direction(pts.map((p) => p.NO)), aySayisi: pts.length, degerler: pts.map((p) => p.NO) };
    }
  }
  // Deneme sınavları (GERÇEK net; bkz. src/practiceExams.js): ayın EN SON denemesi (tür fark etmez) ve aynı türün bir
  // önceki denemesine (önceki aydan da olabilir) göre değişim. Denemesiz ayda ya da eski sunucu yanıtında olgu yok.
  const DM = cur.denemeler;
  const denemeSon = DM ? ["TYT", "AYT"].map((e) => DM[e]).filter((s) => s.last).sort((a, b) => b.last.day - a.last.day)[0] : null;
  if (denemeSon) {
    const L = denemeSon.last;
    F.ozet.deneme = {
      sinav: denemeSon.examType, net: r2(L.net), tarih: fmtDay(L.day), ad: L.name || null,
      fark: denemeSon.deltaVsPrev == null ? null : r2(denemeSon.deltaVsPrev), oncekiNet: denemeSon.prev ? r2(denemeSon.prev.net) : null,
      sayi: denemeSon.n, soru: L.max,
    };
  }
  // Çalışma ritmi (hafta günlerine göre soru).
  const cells = cur.discipline.heatmap.filter((c) => c.inWindow && !c.future);
  const byDow = Array(7).fill(0);
  for (const c of cells) byDow[((c.day % 7) + 7 + 3) % 7] += c.Q; // day 0 = Perşembe → Pazartesi=0
  const totalQ = byDow.reduce((a, b) => a + b, 0);
  if (totalQ >= 100 && cur.kpi.activeDays.n >= 4) {
    const order = byDow.map((q, i) => ({ q, i })).filter((x) => x.q > 0).sort((a, b) => b.q - a.q);
    F.ozet.ritim = { gunler: order.slice(0, order[1] && order[1].q >= order[0].q * 0.7 ? 2 : 1).map((x) => WEEKDAYS[x.i]), haftaSonuPay: ((byDow[5] + byDow[6]) / totalQ) * 100, aktifGun: cur.kpi.activeDays.n };
  }

  // --- aydan aya ders serileri
  const subjSeries = new Map(); // key → [{ay, NO, label}]
  hist.forEach(({ m, key }) => {
    for (const s of m.subjects.filter((x) => x.tracked)) {
      const l = subjSeries.get(s.key) || [];
      l.push({ ay: monthForms(key), month: key, NO: reliableNO(s.agg), label: s.label, name: s.name });
      subjSeries.set(s.key, l);
    }
  });

  // --- GÜÇLÜ YÖNLER (aday + önem puanı)
  const G = (key, f, score, subject = null) => F.guclu.push({ key, f, score, subject });
  for (const r of recOf("K01")) G("guclu.yukselis", r.data, 90, r.subjectKey);
  for (const r of recOf("K02")) G("guclu.etiket", r.data, 85, r.subjectKey);
  for (const r of recOf("K03")) G("guclu.acikKapaniyor", r.data, 82, r.subjectKey);
  for (const r of recOf("K04")) G("guclu.okul", r.data, 80, r.subjectKey);
  for (const r of recOf("K05")) G("guclu.zamaninda", r.data, 70);
  for (const r of recOf("K06")) G("guclu.seri", { seri: r.data.seri, enUzun: cur.discipline.longest }, 64 + Math.min(10, r.data.seri));
  for (const r of recOf("K07")) G("guclu.rekor", r.data, 62, r.subjectKey);
  for (const r of recOf("K08")) G("guclu.serbest", r.data, 60);
  for (const s of tracked.filter((x) => x.label === "strong")) {
    G("guclu.ders", { ders: s.name, NO: s.labelAgg.NO, n: s.labelAgg.n, Q: s.labelAgg.Q, pTilde: s.compCount >= 2 && s.pTilde >= 50 ? s.pTilde : null }, 74 + (s.pTilde >= 75 ? 4 : 0), s.key);
  }
  const solidProfile = tracked.filter((s) => s.profile === "solid" && s.agg.accuracy >= 80).sort((a, b) => b.agg.Q - a.agg.Q)[0];
  if (solidProfile) G("guclu.isabet", { ders: solidProfile.name, isabet: solidProfile.agg.accuracy, Q: solidProfile.agg.Q }, 55, solidProfile.key);
  const solidTopics = tracked.filter((s) => s.lists.solid.length >= 2).sort((a, b) => b.lists.solid.length - a.lists.solid.length)[0];
  if (solidTopics) G("guclu.konular", { ders: solidTopics.name, konular: solidTopics.lists.solid.slice(0, 3).map((t) => t.name), oranlar: solidTopics.lists.solid.slice(0, 3).map((t) => t.rStar) }, 50, solidTopics.key);
  if (del.fixed >= 1) G("guclu.pastanDonus", { sayi: del.fixed, V: del.V }, 45);
  if (cur.kpi.activeDays.of >= 14 && cur.kpi.activeDays.n / cur.kpi.activeDays.of >= 0.6) G("guclu.aktifGun", { aktifGun: cur.kpi.activeDays.n, gunSayisi: cur.kpi.activeDays.of }, 42);
  // Aylar arası
  if (F.ozet.seyir && F.ozet.seyir.yon === "up") {
    const s = F.ozet.seyir;
    G("guclu.seyirYukselis", { konu: s.sinav, ilk: s.ilk, son: s.son, delta: s.son.NO - s.ilk.NO, aySayisi: s.aySayisi }, 88);
  }
  let bestSubjUp = null, worstSubjDown = null;
  for (const [key, l] of subjSeries) {
    const pts = l.filter((p) => p.NO != null);
    if (pts.length < 2) continue;
    const d = pts[pts.length - 1].NO - pts[0].NO;
    const item = { key, konu: pts[0].name, ilk: { ay: pts[0].ay, NO: pts[0].NO }, son: { ay: pts[pts.length - 1].ay, NO: pts[pts.length - 1].NO }, delta: d, aySayisi: pts.length };
    if (pts[pts.length - 1].month !== keys[0]) continue; // bu ay verisi olmalı
    if (d >= 8 && (!bestSubjUp || d > bestSubjUp.delta)) bestSubjUp = item;
    if (d <= -8 && (!worstSubjDown || d < worstSubjDown.delta)) worstSubjDown = item;
  }
  if (bestSubjUp) G("guclu.seyirYukselis", (({ key, ...f }) => f)(bestSubjUp), 86, bestSubjUp.key);
  if (prev && prev.kpi.delivery.V >= 5 && del.V >= 5 && del.deliveredPct - prev.kpi.delivery.deliveredPct >= 10) {
    G("guclu.seyirDuzen", { once: { ay: monthForms(keys[1]), pct: prev.kpi.delivery.deliveredPct }, simdi: { ay, pct: del.deliveredPct } }, 72);
  }
  for (const ex of ["TYT", "AYT"]) {
    const vals = F.seyir.map((r) => (ex === "TYT" ? r.tyt : r.ayt));
    const nums = vals.filter((v) => v != null);
    const last = vals[vals.length - 1];
    if (nums.length >= 3 && last != null && last >= Math.max(...nums) && F.seyir[F.seyir.length - 1].month === keys[0]) {
      G("guclu.enIyiAy", { sinav: ex, ay, NO: last, aySayisi: nums.length }, 78);
    }
  }
  // Denemeler: bu ayın son denemesiyle biten belirgin yükseliş (son üç deneme düşmeden, ≥ 4 net) ya da kişisel rekor.
  // Gerçek sınav neti olduğu için yükseliş, ödev temelli güçlü yönlerle aynı ağırlıkta öne çıkar.
  if (DM) {
    for (const ex of ["TYT", "AYT"]) {
      const s = DM[ex];
      if (s.rise) {
        G("guclu.deneme", {
          sinav: ex, tip: "yukselis", net: r2(s.rise.to.net), ilkNet: r2(s.rise.from.net), artis: r2(s.rise.delta), sayi: 3,
          oncekiEnIyi: null, degerler: s.rise.values.map(r2),
        }, 87);
      } else if (s.record) {
        G("guclu.deneme", {
          sinav: ex, tip: "rekor", net: r2(s.record.net), ilkNet: null, artis: r2(s.record.net - s.record.prevBest), sayi: s.record.count,
          oncekiEnIyi: r2(s.record.prevBest), degerler: null,
        }, 79);
      }
    }
  }

  // --- GELİŞİM ALANLARI
  const MAP = {
    R01: "gelisim.sessiz", R03: "gelisim.konuPasi", R04: "gelisim.kaynak", R05: "gelisim.duzen", R06: "gelisim.zaman", R07: "gelisim.odakDers",
    R08: "gelisim.kapsam", R09: "gelisim.dusus", R10: "gelisim.okulAlt", R11: "gelisim.yanlis", R12: "gelisim.temkinli", R13: "gelisim.bos",
    R14: "gelisim.serbestDagilim", R15: "gelisim.serbestYok", R16: "gelisim.sonGun", R17: "gelisim.kismi", R18: "gelisim.numara", R19: "gelisim.tekrar",
    R20: "gelisim.ihmal", R21: "gelisim.denge",
  };
  const hasR05 = recs.some((r) => r.id === "R05");
  for (const r of recs) {
    const key = MAP[r.id];
    if (!key || !r.data) continue;
    if (r.id === "R01" && hasR05) continue; // düzen düşükse sessiz ödevler onun içinde anlatılır
    const score = 100 - r.priority * 10 + Math.min(8, (r.weight || 0) / 4);
    F.gelisim.push({ key, f: r.data, score, subject: r.subjectKey, rec: r.id });
  }
  // Birkaç aydır Odak kalan ders → kalıcı sorun (odak dersin yerine geçer).
  for (const [key, l] of subjSeries) {
    const lastIdx = l.length - 1;
    if (l[lastIdx].month !== keys[0] || l[lastIdx].label !== "focus") continue;
    let n = 0;
    for (let i = lastIdx; i >= 0 && l[i].label === "focus"; i--) n++;
    if (n < 2) continue;
    const s = cur.subjectMap.get(key);
    const teacher = [...(cur.history[s.examType] || [])].reverse().find((it) => it.key === key && it.isSchool)?.teacher || null;
    F.gelisim = F.gelisim.filter((g) => !(g.subject === key && g.key === "gelisim.odakDers"));
    F.gelisim.push({
      key: "gelisim.surekliOdak", subject: key, score: 92,
      f: { ders: s.name, aySayisi: n, aylar: l.slice(lastIdx - n + 1).map((p) => p.ay), NO: s.agg.NO ?? s.labelAgg.NO, konular: s.lists.first.slice(0, 3).map((t) => t.name), ogretmen: teacher },
    });
  }
  if (F.ozet.seyir && F.ozet.seyir.yon === "down") {
    const s = F.ozet.seyir;
    F.gelisim.push({ key: "gelisim.seyirDusus", f: { konu: s.sinav, ilk: s.ilk, son: s.son, delta: s.son.NO - s.ilk.NO, aySayisi: s.aySayisi }, score: 80 });
  }
  if (worstSubjDown && !F.gelisim.some((g) => g.subject === worstSubjDown.key && g.key === "gelisim.dusus")) {
    F.gelisim.push({ key: "gelisim.seyirDusus", f: (({ key, ...f }) => f)(worstSubjDown), score: 78, subject: worstSubjDown.key });
  }
  // Denemede en çok net kaçan ders (son en fazla 3 denemede soru − net; en az 2 denemede girilmiş). subject anahtarı ödev
  // dersleriyle aynı ("TYT|Matematik") — aynı ders için odak ders olgusuyla birlikte seçilmez (ders başına 1).
  if (DM) {
    for (const ex of ["TYT", "AYT"]) {
      const lt = DM[ex].lossTop;
      if (!lt) continue;
      F.gelisim.push({
        key: "gelisim.denemeDers", subject: lt.key, score: 84 + Math.min(6, lt.avgLost / 4),
        f: {
          ders: `${ex} ${lt.label}`, soru: lt.max, deneme: lt.n, ortNet: r2(lt.avgNet), kayip: r2(lt.avgLost), sonNet: r2(lt.lastNet),
          yanlisPay: Math.round(lt.wrongShare), yanlisKaybi: r2(lt.wrongLost), bosKaybi: r2(lt.blankLost),
        },
      });
    }
  }

  // --- DİKKAT
  const D = (key, f, score) => F.dikkat.push({ key, f, score });
  const c = cur.coach;
  if (cur.window.rolling && c.lastSeenDays != null && c.lastSeenDays >= 5) D("dikkat.giris", { gun: c.lastSeenDays }, 90);
  if (c.lastRecordDays != null && c.lastRecordDays >= 7) D("dikkat.kayit", { gun: c.lastRecordDays }, 88);
  // Son 14 gün, değerlendirilen ayın sonuna göre (geçmiş ayda bugüne göre değil).
  const asOf = cur.window.asOf;
  const silent14 = cur.discipline.open.filter((it) => it.state === "silent" && it.endDay <= asOf && it.endDay >= asOf - 14).length;
  if (silent14 >= 2) D("dikkat.sessizSeri", { sayi: silent14 }, 85);
  const sharp = downs.find((s) => s.trend.delta <= -10);
  if (sharp) D("dikkat.sertDusus", { ders: sharp.name, delta: sharp.trend.delta }, 80);
  if (cur.kpi.activeDays.of >= 14 && cur.kpi.activeDays.n / cur.kpi.activeDays.of < 0.25) D("dikkat.aktivite", { aktifGun: cur.kpi.activeDays.n, gunSayisi: cur.kpi.activeDays.of }, 75);
  if (prev && prev.kpi.questions.Q >= 200 && comparableMonth) {
    const d = ((cur.kpi.questions.Q - prev.kpi.questions.Q) / prev.kpi.questions.Q) * 100;
    if (d <= -30) D("dikkat.hacimDusus", { onceki: { ay: monthForms(keys[1]), Q: prev.kpi.questions.Q }, simdi: { ay, Q: cur.kpi.questions.Q }, degisimPct: d }, 70);
  }
  const dn = c.dataNotes;
  if (dn.approx) {
    const kismi = dn.withE ? (dn.partialRate ?? 0) + (dn.overRate ?? 0) : null;
    D("dikkat.veri", { kismiOran: kismi != null && kismi >= 30 ? kismi : null, serbestFark: dn.freeGap != null && Math.abs(dn.freeGap) >= 15 ? dn.freeGap : null }, 55);
  }
  // Alan biliniyorsa takip dışı kalan AYT dersleri zaten alan dışıdır (alanın dersleri her zaman izlenir) — "alanda mı
  // değil mi, teyit edin" uyarısı yalnızca alan bilinmiyorken anlamlı.
  const untracked = dn.untracked.filter((u) => u.schoolItems > 0 && u.records === 0).map((u) => u.name).slice(0, 3);
  if (untracked.length && !cur.field) D("dikkat.takipDisi", { dersler: untracked }, 40);

  // Görüşme ve koç önerileri için yardımcı bilgiler.
  F.hedefGun = clamp(Math.round(cur.kpi.activeDays.n / Math.max(1, cur.kpi.activeDays.of / 7)) + 1, 3, 6);
  F.odakHedef = recOf("R07")[0]?.data || null;
  F.lastRecordDays = c.lastRecordDays;
  F.strongForHarder = tracked.filter((s) => s.label === "strong" && (s.pTilde >= 75 || s.trend.dir === "up")).sort((a, b) => (b.pTilde ?? 0) - (a.pTilde ?? 0))[0]?.name || null;
  return F;
}

// ---------------------------------------------------------------- takdir / açılış ifadeleri (belirtme hâli)
function praise(g) {
  const f = g.f;
  switch (g.key) {
    case "guclu.yukselis": return { t: `${f.ders} dersindeki yükselişi`, k: `${f.ders} dersindeki yükselişini` };
    case "guclu.seyirYukselis": return { t: `${f.konu} net oranındaki aydan aya yükselişi`, k: `${f.konu} net oranındaki yükselişini` };
    case "guclu.etiket": return { t: `${f.ders} dersinin ${f.yeni} seviyesine çıkmasını`, k: `${f.ders} dersinde ${f.yeni} seviyesine çıkmanı` };
    case "guclu.okul": return { t: `${f.ders} okul ödevlerindeki üst çeyrek başarısını`, k: `${f.ders} okul ödevlerindeki başarını` };
    case "guclu.acikKapaniyor": return { t: `${f.ders} dersinde okul medyanıyla arasını kapatmasını`, k: `${f.ders} dersinde aradaki farkı kapatmanı` };
    case "guclu.zamaninda": return { t: `${h.n(f.V, "ödevin")} ${h.int(f.zamaninda)} tanesini zamanında teslim etmesini`, k: `ödevlerini zamanında teslim etmeni` };
    case "guclu.seri": return { t: `${h.n(f.seri, "haftalık")} düzen serisini`, k: `${h.n(f.seri, "haftadır")} süren düzenini` };
    case "guclu.serbest": return { t: `ödev dışında çözdüğü ${h.n(f.serbestSoru, "soruyu")}`, k: `ödev dışında çözdüğün ${h.n(f.serbestSoru, "soruyu")}` };
    case "guclu.rekor": return { t: `${f.ders} dersindeki kişisel rekorunu`, k: `${f.ders} dersindeki kişisel rekorunu` };
    case "guclu.ders": return { t: `${f.ders} dersindeki sağlam durumunu`, k: `${f.ders} dersindeki sağlam durumunu` };
    case "guclu.isabet": return { t: `${f.ders} dersindeki yüksek isabetini`, k: `${f.ders} dersindeki yüksek isabetini` };
    case "guclu.konular": return { t: `${f.ders} dersinde pekiştirdiği konuları`, k: `${f.ders} dersinde pekiştirdiğin konuları` };
    case "guclu.pastanDonus": return { t: "pas geçtiği ödevlere geri dönüp tamamlamasını", k: "pas geçtiğin ödevlere geri dönmeni" };
    case "guclu.aktifGun": return { t: `ayın ${h.n(f.aktifGun, "gününde")} çalışmasını`, k: `ayın ${h.n(f.aktifGun, "gününde")} çalışmanı` };
    case "guclu.seyirDuzen": return { t: `teslim oranını ${h.pct(f.simdi.pct)} düzeyine çıkarmasını`, k: "teslim oranındaki artışı" };
    case "guclu.enIyiAy": return { t: `${f.sinav} tarafında en iyi ayını geçirmesini`, k: `${f.sinav} tarafındaki en iyi ayını` };
    case "guclu.deneme": return f.tip === "yukselis"
      ? { t: `${f.sinav} denemelerindeki yükselişi`, k: `${f.sinav} denemelerindeki yükselişini` }
      : { t: `${f.sinav} denemesindeki kişisel rekorunu`, k: `${f.sinav} denemesindeki kişisel rekorunu` };
    default: return { t: "düzenli kayıt girmesini", k: "raporunu düzenli doldurmanı" };
  }
}

// ---------------------------------------------------------------- kurgu (seçim + cümle)
function compose(F, seedStr, { month, keys }) {
  const rand = rng(seedStr);
  const used = new Map(); // key(+part) → kullanılan varyant indeksleri
  const shuffled = (n) => {
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const opener = (s) => s.split(/\s+/).slice(0, 2).join(" ").toLocaleLowerCase("tr-TR");
  // Aynı bölümde aynı iki kelimeyle başlayan cümleler ve aynı kalıbın tekrarı engellenir.
  function say(key, f, section, part) {
    const bank = part ? PHRASES[key]?.[part] : PHRASES[key];
    if (!bank?.length) return null;
    const uk = part ? `${key}.${part}` : key;
    const u = used.get(uk) || new Set();
    const openers = section ? section.openers : null;
    let fallback = null;
    for (const i of shuffled(bank.length)) {
      let s;
      try { s = tidy(bank[i](f, h)); } catch { continue; }
      if (!s || /undefined|NaN|null/.test(s) || FORBIDDEN.test(s)) continue;
      if (fallback == null) fallback = { s, i };
      if (u.has(i)) continue;
      if (openers && openers.has(opener(s))) continue;
      u.add(i); used.set(uk, u);
      openers?.add(opener(s));
      return s;
    }
    if (fallback) { u.add(fallback.i); used.set(uk, u); openers?.add(opener(fallback.s)); return fallback.s; }
    return null;
  }
  const jitter = () => (rand() - 0.5) * 8; // eşit önemdeki olgular arasında çeşitlilik
  const pickTop = (list, max, perSubject = 1) => {
    const out = [], bySubj = new Map(), byKey = new Map();
    for (const x of [...list].map((x) => ({ ...x, s: x.score + jitter() })).sort((a, b) => b.s - a.s)) {
      if (out.length >= max) break;
      if (x.subject && (bySubj.get(x.subject) || 0) >= perSubject) continue;
      if ((byKey.get(x.key) || 0) >= 2) continue;
      out.push(x);
      if (x.subject) bySubj.set(x.subject, (bySubj.get(x.subject) || 0) + 1);
      byKey.set(x.key, (byKey.get(x.key) || 0) + 1);
    }
    return out;
  };

  // --- ÖZET: birkaç farklı kurgu planından biri
  const O = F.ozet;
  const oz = { openers: new Set() };
  const sentence = {
    acilis: () => (F.veriYeterliligi === "yetersiz" ? say("ozet.acilisAz", O.acilisAz, oz) : say("ozet.acilis", O.acilis, oz)),
    guclu: () => O.guclu && say("ozet.guclu", O.guclu, oz),
    odak: () => O.odak && say("ozet.odak", O.odak, oz),
    yukselis: () => O.yukselis && say("ozet.yukselis", O.yukselis, oz),
    dusus: () => O.dusus && say("ozet.dusus", O.dusus, oz),
    hacim: () => O.hacim && say("ozet.hacim", O.hacim, oz),
    seyir: () => O.seyir && say("ozet.seyir", O.seyir, oz),
    ritim: () => O.ritim && say("ozet.ritim", O.ritim, oz),
    durum: () => say(O.durum.key, O.durum.f, oz),
    deneme: () => O.deneme && say("ozet.deneme", O.deneme, oz),
  };
  const PLANS = [
    ["acilis", "guclu", "odak", "durum"],
    ["durum", "acilis", "odak"],
    ["acilis", "seyir", "odak"],
    ["acilis", "yukselis", "odak", "hacim"],
    ["seyir", "acilis", "guclu", "odak"],
    ["acilis", "ritim", "odak", "durum"],
    ["acilis", "hacim", "guclu", "dusus"],
    ["seyir", "acilis", "yukselis", "durum"],
  ];
  const avail = (k) => (k === "acilis" || k === "durum" ? true : !!O[k]);
  const plans = F.veriYeterliligi === "yetersiz"
    ? [["acilis", "durum"]]
    : PLANS.filter((p) => avail(p[0]) && p.filter(avail).length >= 3);
  const plan = plans[Math.floor(rand() * plans.length)] || ["acilis", "odak", "durum"];
  // Ayın denemesi varsa (YKS'nin en önemli ölçüsü) her planda ilk cümlenin hemen ardından gelir; planın kendi cümleleri
  // düşmesin diye özet o zaman en fazla 5 cümle.
  const planKeys = plan.filter(avail);
  if (O.deneme) planKeys.splice(1, 0, "deneme");
  const ozet = planKeys.slice(0, O.deneme ? 5 : 4).map((k) => sentence[k]()).filter(Boolean).join(" ");

  // --- GÜÇLÜ YÖNLER
  const gs = pickTop(F.guclu, F.guclu.length >= 4 && rand() < 0.5 ? 4 : 3);
  const gSec = { openers: new Set() };
  const gucluYonler = gs.map((g) => say(g.key, g.f, gSec)).filter(Boolean);

  // --- GELİŞİM ALANLARI
  const ge = pickTop(F.gelisim, F.gelisim.length >= 5 && rand() < 0.4 ? 5 : 4);
  const kSec = { openers: new Set() }, oSec = { openers: new Set() };
  const gelisimAlanlari = ge.map((g) => ({
    alan: say(g.key, g.f, null, "alan"),
    kanit: say(g.key, g.f, kSec, "kanit"),
    oneri: say(g.key, g.f, oSec, "oneri"),
  })).filter((x) => x.alan && x.kanit && x.oneri);

  // --- KOÇA ÖNERİLER: seçilen gelişim alanlarından eylemler + takdir + gerekirse birebir görüşme
  const K = [];
  const KX = (key, f, score) => { if (PHRASES[key]) K.push({ key, f, score }); };
  for (const g of ge) {
    const f = g.f;
    switch (g.key) {
      case "gelisim.odakDers":
        if (f.konular?.length) KX("koc.kisiselOdev", { ders: f.ders, konular: f.konular.map((t) => t.ad).slice(0, 2), soru: "20–30" }, 90);
        else KX("koc.hedef", { ders: f.ders, hedefQ: f.hedefQ }, 85);
        break;
      case "gelisim.surekliOdak": KX("koc.eskalasyon", { ders: f.ders, aySayisi: f.aySayisi, ogretmen: f.ogretmen }, 95); break;
      case "gelisim.konuPasi": KX("koc.brans", { ders: f.ders, ogretmen: f.ogretmen, konular: f.konular }, 92); break;
      case "gelisim.okulAlt": KX("koc.brans", { ders: f.ders, ogretmen: f.ogretmen, konular: f.konu ? [f.konu] : [] }, 84); break;
      case "gelisim.kaynak": KX("koc.yonetim", { kitap: f.kitap, ders: f.ders }, 90); break;
      case "gelisim.duzen": case "gelisim.zaman": case "gelisim.sessiz": KX("koc.yuk", {}, 80); break;
      case "gelisim.sonGun": KX("koc.araKontrol", {}, 70); break;
      case "gelisim.numara": KX("koc.numara", {}, 55); break;
      case "gelisim.tekrar": KX("koc.tekrar", { ders: f.ders, konu: f.konu }, 60); break;
      case "gelisim.denge": KX("koc.denge", { kucuk: f.kucuk, hedef: f.hedef }, 65); break;
      case "gelisim.serbestYok": KX("koc.serbest", { odakDers: f.odakDers }, 58); break;
      case "gelisim.serbestDagilim": KX("koc.serbest", { odakDers: f.odakDers }, 62); break;
      case "gelisim.dusus": KX("koc.kisiselOdev", { ders: f.ders, konular: [f.konu].filter(Boolean), soru: "15–20" }, 75); break;
      case "gelisim.bos": KX("koc.kisiselOdev", { ders: f.ders, konular: [f.konu].filter(Boolean), soru: "15–20" }, 72); break;
      case "gelisim.kapsam": KX("koc.kisiselOdev", { ders: f.ders, konular: f.konular.slice(0, 2), soru: "20–30" }, 68); break;
      case "gelisim.ihmal": KX("koc.hedef", { ders: f.ders, hedefQ: 20 }, 50); break;
      default: break;
    }
  }
  if (gs[0]) KX("koc.takdir", { neyi: praise(gs[0]).t }, 88);
  if (F.lastRecordDays != null && F.lastRecordDays >= 7) KX("koc.birebir", { gun: F.lastRecordDays }, 97);
  if (F.strongForHarder) KX("koc.zorluk", { ders: F.strongForHarder }, 52);
  const kSel = [];
  const kSeen = new Map();
  for (const k of K.map((x) => ({ ...x, s: x.score + jitter() })).sort((a, b) => b.s - a.s)) {
    if (kSel.length >= 5) break;
    if ((kSeen.get(k.key) || 0) >= (k.key === "koc.kisiselOdev" || k.key === "koc.brans" ? 2 : 1)) continue;
    kSeen.set(k.key, (kSeen.get(k.key) || 0) + 1);
    kSel.push(k);
  }
  const kcSec = { openers: new Set() };
  const kocaOneriler = kSel.map((k) => say(k.key, k.f, kcSec)).filter(Boolean);

  // --- ÖĞRENCİYLE KONUŞMA: olumlu açılış → açık uçlu soru → tek hedef → kapanış
  const cv = { openers: new Set() };
  const top = ge[0];
  const soru = !top ? ["konusma.soruGenel", {}]
    : ["gelisim.sessiz", "gelisim.duzen"].includes(top.key) ? ["konusma.soruSessiz", { sayi: top.f.sayi ?? top.f.sessiz ?? 1 }]
    : ["gelisim.zaman", "gelisim.sonGun"].includes(top.key) ? ["konusma.soruZaman", {}]
    : top.key === "gelisim.konuPasi" ? ["konusma.soruKonuPasi", { ders: top.f.ders, konu: top.f.konular[0] }]
    : ["gelisim.dusus", "gelisim.seyirDusus"].includes(top.key) && top.f.ders ? ["konusma.soruDusus", { ders: top.f.ders }]
    : top.f.ders ? ["konusma.soruOdak", { ders: top.f.ders, konu: top.f.konu || top.f.konular?.[0]?.ad || top.f.konular?.[0] || null }]
    : ["konusma.soruGenel", {}];
  const hedef = { ders: F.odakHedef?.ders || null, hedefQ: F.odakHedef?.hedefQ || null, gun: F.hedefGun };
  const ogrenciyleKonusma = [
    say("konusma.acilis", { olumlu: praise(gs[0] || {}).k }, cv),
    say(soru[0], soru[1], cv),
    say("konusma.hedef", hedef, cv),
    rand() < 0.6 ? say("konusma.kapanis", {}, cv) : null,
  ].filter(Boolean).join(" ");

  // --- DİKKAT
  const dSec = { openers: new Set() };
  const dikkat = [...F.dikkat].sort((a, b) => b.score - a.score).slice(0, 3).map((d) => say(d.key, d.f, dSec)).filter(Boolean);

  return {
    kaynak: "otomatik", month, ay: F.ay.ad, aylar: keys.length,
    ozet, veriYeterliligi: F.veriYeterliligi, gucluYonler, gelisimAlanlari, kocaOneriler, ogrenciyleKonusma, dikkat,
    seyir: F.seyir,
  };
}
