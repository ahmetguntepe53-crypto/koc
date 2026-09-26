// Öğrenci kalıp bankası denetimi ("Ayın değerlendirmesi"): öğrenci sözleşmesindeki (src/narrative/phrases-student/
// catalog.js) HER olgu anahtarının kalıpları, HER örnek olguyla çalıştırılır. Koç bankasının kuralları (test/
// narrativePhrases.test.js) aynen geçerli; üstüne öğrenci kuralları:
//  • her anahtarda (gelişim alanlarında her parçada) en az 5 farklı varyant,
//  • koçun terimleri yok (sessiz ödev, müdahale, takip et, veri notu), "öğrenci" diye üçüncü şahıs yok, koça hitap eden
//    emir kipi yok ("verin", "isteyin"...),
//  • okulun alt yarısını ima eden karşılaştırma yok (medyan, yüzdelik, alt çeyrek),
//  • gelişim alanı başlıkları asla olumsuz değil.
import { describe, it, expect } from "vitest";
import { STUDENT_CATALOG, STUDENT_EXCLUDED } from "../src/narrative/phrases-student/catalog.js";
import { PHRASES_STUDENT, STUDENT_FORBIDDEN } from "../src/narrative/phrases-student/index.js";
import { CATALOG } from "../src/narrative/catalog.js";
import { h, tidy, FORBIDDEN } from "../src/narrative/text.js";

const MIN = 5;
const SUFFIX_ON_PLACEHOLDER = [
  /%[−-]?\d+(,\d+)?'/, // "%36'dan" — yüzdeye ek yapıştırılmaz ("%36 düzeyinden")
  /(TYT|AYT) [A-ZÇĞİÖŞÜ][A-Za-zçğıöşüÇĞİÖŞÜ0-9-]*'(de|da|te|ta|den|dan|ten|tan|e|a|ye|ya|i|ı|u|ü|yi|yı|in|ın|un|ün)\b/, // "TYT Matematik'te"
  /'[^']{2,60}'(de|da|te|ta|den|dan|e|a|ye|ya|i|ı|yi|yı|in|ın)\b/, // "'Problemler'de" — konuya ek
  /\d'(de|da|te|ta|den|dan|ten|tan|e|a|ye|ya|i|ı|u|ü|yi|yı|in|ın|er|ar)\b/, // "15'er", "3'te" — sayıya ek
];
// Koça hitap eden emir kipi (ikinci çoğul) — öğrenci metni "sen" diliyle yazılır.
// (JS'te \b yalnız ASCII harfleri tanır — Türkçe harfli kelimeler için sınırlar açıkça yazılır.)
const COACH_IMPERATIVE = /(?<![a-zçğıöşüâî])(verin|isteyin|planlayın|belirleyin|paylaşın|konuşun|bakın|yapın|ayarlayın|iletin|açtırın|hedefleyin|bölün|tutun|görüşün|koyun|takdir edin)(?![a-zçğıöşüâî])/i;
// Başlıkta (alan) olumsuz hüküm yok.
const NEGATIVE_HEADLINE = /(düşüş|düştü|düşük|kayıp|kaybı|kaçan|kaçır|eksik|sorun|yetersiz|gerile|ihmal|sessiz|zorlan)/i;

function check(out, where) {
  expect(typeof out, where).toBe("string");
  const s = tidy(out);
  expect(s.length, `${where}: boş`).toBeGreaterThan(3);
  expect(s, `${where}: tanımsız değer`).not.toMatch(/undefined|NaN|null|\[object|—%|%—/);
  expect(s, `${where}: yasak kelime`).not.toMatch(FORBIDDEN);
  expect(s, `${where}: öğrenciye uygun değil: ${s}`).not.toMatch(STUDENT_FORBIDDEN);
  expect(s, `${where}: koç terimi 'sessiz': ${s}`).not.toMatch(/sessiz/i);
  expect(s, `${where}: koça hitap: ${s}`).not.toMatch(COACH_IMPERATIVE);
  for (const re of SUFFIX_ON_PLACEHOLDER) expect(s, `${where}: yer tutucuya ek: ${s}`).not.toMatch(re);
  expect(s[0], `${where}: küçük harfle başlıyor: ${s}`).toBe(s[0].toLocaleUpperCase("tr-TR"));
  return s;
}

describe("öğrenci kalıp bankaları", () => {
  it("koçun her özet/güçlü/gelişim olgusu öğrenci sözleşmesinde (hariç tutulanlar dışında)", () => {
    for (const [key, spec] of Object.entries(CATALOG)) {
      if (!["ozet", "guclu", "gelisim"].includes(spec.section)) continue;
      expect(STUDENT_EXCLUDED.has(key) || key in STUDENT_CATALOG, `${key}: öğrenci sözleşmesinde yok`).toBe(true);
    }
    // Koça özel bölümler öğrenci sözleşmesinde hiç yok.
    for (const [key, spec] of Object.entries(STUDENT_CATALOG)) expect(["koc", "konusma", "dikkat"], key).not.toContain(spec.section);
    expect(Object.keys(STUDENT_CATALOG)).not.toContain("ozet.durumMudahale");
  });

  for (const [key, spec] of Object.entries(STUDENT_CATALOG)) {
    it(key, () => {
      const bank = PHRASES_STUDENT[key];
      expect(bank, `${key}: öğrenci kalıbı yok`).toBeTruthy();
      if (spec.section === "gelisim") {
        for (const part of ["alan", "kanit", "oneri"]) {
          expect(Array.isArray(bank[part]), `${key}.${part}`).toBe(true);
          expect(bank[part].length, `${key}.${part}: en az ${MIN} varyant`).toBeGreaterThanOrEqual(MIN);
          const seen = new Set();
          bank[part].forEach((fn, i) => spec.samples.forEach((f, j) => {
            const s = check(fn(f, h), `${key}.${part}[${i}] örnek ${j}`);
            if (part === "alan") expect(s, `${key}.alan[${i}]: olumsuz başlık: ${s}`).not.toMatch(NEGATIVE_HEADLINE);
            else expect(s, `${key}.${part}[${i}]: cümle noktalama ile bitmeli`).toMatch(/[.!?]$/);
            seen.add(s);
          }));
          expect(seen.size, `${key}.${part}: varyantlar birbirinden farklı olmalı`).toBeGreaterThanOrEqual(MIN);
        }
      } else {
        expect(Array.isArray(bank), `${key}: dizi olmalı`).toBe(true);
        expect(bank.length, `${key}: en az ${MIN} varyant`).toBeGreaterThanOrEqual(MIN);
        const seen = new Set();
        bank.forEach((fn, i) => spec.samples.forEach((f, j) => {
          const s = check(fn(f, h), `${key}[${i}] örnek ${j}`);
          expect(s, `${key}[${i}]: cümle noktalama ile bitmeli`).toMatch(/[.!?]$/);
          seen.add(s);
        }));
        expect(seen.size, `${key}: varyantlar birbirinden farklı olmalı`).toBeGreaterThanOrEqual(MIN);
      }
    });
  }

  it("odak dersin okul yüzdeliği (50'nin altında olabilir) hiçbir öğrenci cümlesinde geçmez", () => {
    const f = { ...CATALOG["gelisim.odakDers"].samples[0], pTilde: 14 };
    const bank = PHRASES_STUDENT["gelisim.odakDers"];
    for (const part of ["alan", "kanit", "oneri"]) {
      for (const fn of bank[part]) expect(tidy(fn(f, h))).not.toMatch(/\b14\b|okul/);
    }
  });
});
