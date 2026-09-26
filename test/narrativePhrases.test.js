// Kalıp bankası denetimi: katalogdaki HER olgu anahtarının kalıpları, katalogdaki HER örnek olguyla çalıştırılır.
import { describe, it, expect } from "vitest";
import { CATALOG } from "../src/narrative/catalog.js";
import { PHRASES } from "../src/narrative/phrases/index.js";
import { h, tidy, FORBIDDEN } from "../src/narrative/text.js";

const MIN = { sentence: 5, alan: 3, kanit: 4, oneri: 5 };
const SUFFIX_ON_PLACEHOLDER = [
  /%[−-]?\d+(,\d+)?'/, // "%36'dan" — yüzdeye ek yapıştırılmaz ("%36 düzeyinden")
  /(TYT|AYT) [A-ZÇĞİÖŞÜ][A-Za-zçğıöşüÇĞİÖŞÜ0-9-]*'(de|da|te|ta|den|dan|ten|tan|e|a|ye|ya|i|ı|u|ü|yi|yı|in|ın|un|ün)\b/, // "TYT Matematik'te"
  /'[^']{2,60}'(de|da|te|ta|den|dan|e|a|ye|ya|i|ı|yi|yı|in|ın)\b/, // "'Problemler'de" — konuya ek
];

function check(out, where) {
  expect(typeof out, where).toBe("string");
  const s = tidy(out);
  expect(s.length, `${where}: boş`).toBeGreaterThan(3);
  expect(s, `${where}: tanımsız değer`).not.toMatch(/undefined|NaN|null|\[object|—%|%—/);
  expect(s, `${where}: yasak kelime`).not.toMatch(FORBIDDEN);
  for (const re of SUFFIX_ON_PLACEHOLDER) expect(s, `${where}: yer tutucuya ek`).not.toMatch(re);
  expect(s[0], `${where}: küçük harfle başlıyor: ${s}`).toBe(s[0].toLocaleUpperCase("tr-TR"));
  return s;
}

describe("kalıp bankaları", () => {
  for (const [key, spec] of Object.entries(CATALOG)) {
    it(key, () => {
      const bank = PHRASES[key];
      expect(bank, `${key}: kalıp yok`).toBeTruthy();
      if (spec.section === "gelisim") {
        for (const part of ["alan", "kanit", "oneri"]) {
          expect(Array.isArray(bank[part]), `${key}.${part}`).toBe(true);
          expect(bank[part].length, `${key}.${part}: en az ${MIN[part]} varyant`).toBeGreaterThanOrEqual(MIN[part]);
          const seen = new Set();
          bank[part].forEach((fn, i) => spec.samples.forEach((f, j) => {
            const s = check(fn(f, h), `${key}.${part}[${i}] örnek ${j}`);
            if (part !== "alan") expect(s, `${key}.${part}[${i}]: cümle noktalama ile bitmeli`).toMatch(/[.!?]$/);
            seen.add(s);
          }));
          expect(seen.size, `${key}.${part}: varyantlar birbirinden farklı olmalı`).toBeGreaterThanOrEqual(Math.min(bank[part].length, MIN[part]));
        }
      } else {
        expect(Array.isArray(bank), `${key}: dizi olmalı`).toBe(true);
        expect(bank.length, `${key}: en az ${MIN.sentence} varyant`).toBeGreaterThanOrEqual(MIN.sentence);
        const seen = new Set();
        bank.forEach((fn, i) => spec.samples.forEach((f, j) => {
          const s = check(fn(f, h), `${key}[${i}] örnek ${j}`);
          expect(s, `${key}[${i}]: cümle noktalama ile bitmeli`).toMatch(/[.!?]$/);
          seen.add(s);
        }));
        expect(seen.size, `${key}: varyantlar birbirinden farklı olmalı`).toBeGreaterThanOrEqual(MIN.sentence);
      }
    });
  }
});
