// Kalıp yardımcıları (h) ve deterministik rastgelelik. Kalıplar sayıları HER ZAMAN bu yardımcılarla biçimler:
// ondalık virgül, binlik nokta, yüzde işareti önde (%36), eksi işareti "−".
import { fmtPct, fmtInt, fmtDec, fmtNet, fmtSigned } from "../reportModel.js";

const trLower = (s) => s.toLocaleLowerCase("tr-TR");
const trUpper = (s) => s.toLocaleUpperCase("tr-TR");

export const h = {
  pct: (v) => fmtPct(v), // 36.2 → "%36"
  int: (v) => fmtInt(v), // 1250 → "1.250"
  dec: (v, d = 1) => fmtDec(v, d), // 6.25 → "6,3" (d=1) / "6,25" (d=2)
  net: (v) => fmtNet(v), // 36.5 → "36,5"
  signed: (v) => fmtSigned(v), // 6.2 → "+6", -4 → "−4" (puan)
  abs: (v) => fmtInt(Math.abs(v ?? 0)), // −12.4 → "12"
  q: (s) => `'${s}'`, // konu adı tırnakla
  list: (arr) => {
    const a = (arr || []).filter(Boolean);
    if (a.length <= 1) return a[0] || "";
    return `${a.slice(0, -1).join(", ")} ve ${a[a.length - 1]}`;
  },
  qlist: (arr) => h.list((arr || []).filter(Boolean).map((x) => `'${x}'`)),
  cap: (s) => (s ? trUpper(s[0]) + s.slice(1) : s),
  lower: (s) => (s ? trLower(s[0]) + s.slice(1) : s),
  // "3 ödev", "1 gün" — Türkçede sayıdan sonra isim tekil kalır.
  n: (v, word) => `${fmtInt(v)} ${word}`,
};

// Dize → 32 bit tohum (FNV-1a) ve mulberry32 üreteci: aynı öğrenci + aynı ay → her açılışta aynı metin;
// farklı öğrenci ya da ay → farklı kalıplar.
export function hashSeed(str) {
  let x = 2166136261;
  for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619); }
  return x >>> 0;
}
export function rng(seedStr) {
  let a = hashSeed(seedStr);
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Son temizlik: çift boşluk, noktalama öncesi boşluk, çift nokta.
export function tidy(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?)])/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/\.{2,}/g, ".")
    .replace(/,\./g, ".")
    .trim();
}

export const FORBIDDEN = /\b(zayıf|zayif|kötü|başarısız|geride|tembel|hile)/i;
