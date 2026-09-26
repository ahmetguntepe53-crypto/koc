// Öğrenciye özel aylık değerlendirme — "Ayın değerlendirmesi" (buildNarrative(raw, { month, audience: "student" })).
// Koç sürümüyle AYNI olgulardan (index.js > extractFacts) kurulur; yalnızca seçim ve dil farklıdır:
//  • Bölümler: ozet (2–3 cümle) · gucluYonler · gelisimAlanlari ({ alan, kanit, oneri } — ekranda "Sonraki adım") ·
//    sonrakiAdimlar (bu hafta yapılabilecek 2–4 somut eylem). Koça öneriler, görüşme metni ve dikkat bölümü YOK.
//  • Koça özel olgular hiç seçilmez (genel durum çipi, veri notları, "alt çeyrek"); özet olumsuz bir cümleyle açılmaz,
//    düşüş/azalma özette anılmaz (gelişim alanlarında bir sonraki adımla birlikte, nazikçe anlatılır).
//  • Kalıplar ayrı bankadan (./phrases-student, "sen" dili); her cümle ek olarak STUDENT_FORBIDDEN süzgecinden geçer.
// Seçim, koç sürümü gibi öğrenci + ay tohumludur (tohum ayrı: iki metin aynı kalıp sırasına bağlı kalmasın).
import { PHRASES_STUDENT, STUDENT_FORBIDDEN } from "./phrases-student/index.js";
import { STUDENT_EXCLUDED } from "./phrases-student/catalog.js";
import { h, rng, tidy, FORBIDDEN } from "./text.js";

const GUCLU_MAX = 3;
const GELISIM_MAX = 3;
const ADIM_MAX = 4;

export function composeStudent(F, seedStr, { month, keys }) {
  const rand = rng(`${seedStr}|ogrenci`);
  const used = new Map(); // key(+part) → kullanılan varyant indeksleri
  const shuffled = (n) => {
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const opener = (s) => s.split(/\s+/).slice(0, 2).join(" ").toLocaleLowerCase("tr-TR");
  // Koç sürümündeki say() ile aynı kural (aynı bölümde aynı iki kelimeyle başlayan cümle ve aynı kalıp tekrar etmez) +
  // öğrenci süzgeci.
  function say(key, f, section, part) {
    const bank = part ? PHRASES_STUDENT[key]?.[part] : PHRASES_STUDENT[key];
    if (!bank?.length) return null;
    const uk = part ? `${key}.${part}` : key;
    const u = used.get(uk) || new Set();
    const openers = section ? section.openers : null;
    let fallback = null;
    for (const i of shuffled(bank.length)) {
      let s;
      try { s = tidy(bank[i](f, h)); } catch { continue; }
      if (!s || /undefined|NaN|null/.test(s) || FORBIDDEN.test(s) || STUDENT_FORBIDDEN.test(s)) continue;
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
  const jitter = () => (rand() - 0.5) * 8;
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

  // --- ÖZET: açılış + olumlu/nötr bir cümle + ileriye bakan odak cümlesi (2–3 cümle)
  const O = F.ozet;
  const az = F.veriYeterliligi === "yetersiz";
  // Öğrenci özetine yalnızca olumlu ya da nötr olgular girer: soru hacmi yalnız arttıysa, çok aylık seyir düşmüyorsa.
  const has = {
    guclu: !!O.guclu, odak: !!O.odak, yukselis: !!O.yukselis, ritim: !!O.ritim, deneme: !!O.deneme,
    hacim: !!O.hacim && O.hacim.degisimPct > 0, seyir: !!O.seyir && O.seyir.yon !== "down",
  };
  const oz = { openers: new Set() };
  const sentence = {
    acilis: () => (az ? say("ozet.acilisAz", O.acilisAz, oz) : say("ozet.acilis", O.acilis, oz)),
    guclu: () => say("ozet.guclu", O.guclu, oz),
    odak: () => say("ozet.odak", O.odak, oz),
    yukselis: () => say("ozet.yukselis", O.yukselis, oz),
    hacim: () => say("ozet.hacim", O.hacim, oz),
    seyir: () => say("ozet.seyir", O.seyir, oz),
    ritim: () => say("ozet.ritim", O.ritim, oz),
    deneme: () => say("ozet.deneme", O.deneme, oz),
    tesvik: () => say("ozet.tesvik", {}, oz),
  };
  const PLANS = [
    ["acilis", "guclu", "odak"],
    ["acilis", "yukselis", "odak"],
    ["seyir", "acilis", "odak"],
    ["acilis", "hacim", "odak"],
    ["acilis", "ritim", "odak"],
    ["acilis", "guclu", "yukselis"],
    ["acilis", "seyir", "guclu"],
  ];
  const avail = (k) => k === "acilis" || k === "tesvik" || has[k];
  const plans = az ? [["acilis", "tesvik"]] : PLANS.filter((p) => avail(p[0]) && p.every(avail));
  const plan = [...(plans[Math.floor(rand() * plans.length)] || ["acilis", "odak"])].filter(avail);
  // Ayın denemesi varsa (YKS'nin en gerçek ölçüsü) ilk cümlenin hemen ardından gelir; özet yine en fazla 3 cümle.
  if (!az && has.deneme) plan.splice(1, 0, "deneme");
  let ozetList = plan.slice(0, 3).map((k) => sentence[k]()).filter(Boolean);
  if (ozetList.length < 2) ozetList = [...ozetList, sentence.tesvik()].filter(Boolean);
  const ozet = ozetList.join(" ");

  // --- GÜÇLÜ YÖNLER (hepsi olumlu olgular; koçla aynı önem puanları)
  const gSec = { openers: new Set() };
  const gucluYonler = pickTop(F.guclu, GUCLU_MAX).map((g) => say(g.key, g.f, gSec)).filter(Boolean);

  // --- GELİŞİM ALANLARI (öğrenciye gösterilmeyen olgular hariç)
  const ge = pickTop(F.gelisim.filter((g) => !STUDENT_EXCLUDED.has(g.key)), GELISIM_MAX);
  const kSec = { openers: new Set() }, oSec = { openers: new Set() };
  const gelisimAlanlari = ge.map((g) => ({
    alan: say(g.key, g.f, null, "alan"),
    kanit: say(g.key, g.f, kSec, "kanit"),
    oneri: say(g.key, g.f, oSec, "oneri"),
  })).filter((x) => x.alan && x.kanit && x.oneri);

  // --- BU HAFTA YAPABİLECEKLERİN: seçilen gelişim alanlarından somut eylemler + haftalık gün hedefi (+ yedek)
  const A = [];
  const AX = (key, f, score, ders = null) => { if (PHRASES_STUDENT[key]) A.push({ key, f, score, ders }); };
  for (const g of ge) {
    const f = g.f;
    switch (g.key) {
      case "gelisim.odakDers":
        if (f.konular?.length) AX("adim.konu", { ders: f.ders, konu: f.konular[0].ad, soru: 15 }, 90, f.ders);
        else AX("adim.hedef", { ders: f.ders, hedefQ: f.hedefQ }, 85, f.ders);
        break;
      case "gelisim.surekliOdak":
        if (f.konular?.length) AX("adim.konu", { ders: f.ders, konu: f.konular[0], soru: 15 }, 88, f.ders);
        else AX("adim.brans", { ders: f.ders, ogretmen: f.ogretmen, konu: null }, 80, f.ders);
        break;
      case "gelisim.konuPasi": AX("adim.brans", { ders: f.ders, ogretmen: f.ogretmen, konu: f.konular[0] }, 86, f.ders); break;
      case "gelisim.kaynak": AX("adim.kaynak", { kitap: f.kitap, ders: f.ders }, 84, f.ders); break;
      case "gelisim.sessiz": AX("adim.sonuc", { sayi: f.sayi }, 95); break;
      case "gelisim.duzen":
        if (f.sessiz > 0) AX("adim.sonuc", { sayi: f.sessiz }, 94);
        else AX("adim.bolme", {}, 70);
        break;
      case "gelisim.zaman": case "gelisim.sonGun": AX("adim.bolme", {}, 70); break;
      case "gelisim.numara": AX("adim.numara", {}, 60); break;
      case "gelisim.tekrar": AX("adim.tekrar", { ders: f.ders, konu: f.konu }, 75, f.ders); break;
      case "gelisim.denge": AX("adim.denge", { kucuk: f.kucuk, hedef: f.hedef }, 72); break;
      case "gelisim.serbestYok": AX("adim.serbest", { ders: f.odakDers || null }, 58); break;
      case "gelisim.serbestDagilim": AX("adim.serbest", { ders: f.odakDers || null }, 62); break;
      case "gelisim.dusus": case "gelisim.bos":
        if (f.konu) AX("adim.konu", { ders: f.ders, konu: f.konu, soru: 15 }, g.key === "gelisim.bos" ? 80 : 78, f.ders);
        break;
      case "gelisim.kapsam": if (f.konular?.length) AX("adim.konu", { ders: f.ders, konu: f.konular[0], soru: 10 }, 68, f.ders); break;
      case "gelisim.ihmal": AX("adim.hedef", { ders: f.ders, hedefQ: 20 }, 50, f.ders); break;
      case "gelisim.denemeDers": AX("adim.denemeAnaliz", { ders: f.ders }, 82, f.ders); break;
      default: break;
    }
  }
  // Seçilmemiş ama en önemli odak ders (özetteki) de somut bir adım olabilir.
  if (O.odak?.konu) AX("adim.konu", { ders: O.odak.ders, konu: O.odak.konu, soru: 15 }, 64, O.odak.ders);
  AX("adim.gun", { gun: F.hedefGun }, 55);
  AX("adim.genel", {}, 10);
  const aSel = [], aKey = new Map(), aDers = new Set();
  for (const a of A.map((x) => ({ ...x, s: x.score + jitter() })).sort((x, y) => y.s - x.s)) {
    if (aSel.length >= ADIM_MAX) break;
    if ((aKey.get(a.key) || 0) >= (a.key === "adim.konu" ? 2 : 1)) continue;
    if (a.ders && aDers.has(a.ders)) continue; // ders başına tek eylem
    if (a.key === "adim.genel" && aSel.length >= 2) continue; // yedek yalnızca 2'ye tamamlamak için
    aKey.set(a.key, (aKey.get(a.key) || 0) + 1);
    if (a.ders) aDers.add(a.ders);
    aSel.push(a);
  }
  const aSec = { openers: new Set() };
  const sonrakiAdimlar = aSel.map((a) => say(a.key, a.f, aSec)).filter(Boolean);

  return {
    kaynak: "otomatik", audience: "student", month, ay: F.ay.ad, aylar: keys.length,
    ozet, veriYeterliligi: F.veriYeterliligi, gucluYonler, gelisimAlanlari, sonrakiAdimlar,
  };
}
