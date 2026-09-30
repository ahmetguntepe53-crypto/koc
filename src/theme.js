// Tek tema: açık (2026-09-30'da koyu tema kaldırıldı — kullanıcının kararı). Durum renkleri (doğru yeşili,
// yanlış kırmızısı, uyarı sarısı) veri anlamı taşır; mor/lime marka paleti yeniden tasarlanan ekranlarda.
export const THEMES = {
  light: {
    bg: "#F4F5F7",
    surface: "#FFFFFF",
    surface2: "#EEF0F3",
    surfaceHover: "#E6E9ED",
    fieldBg: "#F7F8FA",
    border: "#E3E6EB",
    borderStrong: "#CDD2D9",
    divider: "#ECEEF1",
    text: "#0D1014",
    text2: "#2C333C",
    muted: "#4A525E",
    mutedLight: "#5E6775",      // beyazda 5.7:1
    faintest: "#B5BBC5",

    accent: "#14181E",
    accentHover: "#000000",
    accentSoft: "#E6E9ED",
    accent2: "#2C333C",
    onAccent: "#F2F4F7",

    // Açık zeminde AA için koyulaştırılmış durum tonları (kendi açık zeminlerinde de 4.5:1).
    green: "#11803A",
    greenSoft: "#E7F6ED",
    amber: "#A34A07",           // üzerine gelinen satır zemininde (#E6E9ED) de 4.5:1
    amberSoft: "#FEF3E2",
    red: "#D22424",
    redSoft: "#FDECEC",
    onRed: "#FFFFFF",
    blue: "#2C333C",
    blueSoft: "#EEF0F3",
    koc: "#5B4FB0",
    kocSoft: "rgba(91,79,176,0.12)",
    blank: "#5E6775",
    blankSoft: "rgba(94,103,117,0.12)",

    sidebarBg: "#14181E",
    sidebarBgAlt: "#1A1F26",
    sidebarText: "#8C95A3",
    sidebarTextActive: "#F2F4F7",
    sidebarActiveBg: "rgba(255,255,255,0.07)",
    sidebarAccent: "#F2F4F7",
    sidebarBorder: "rgba(255,255,255,0.08)",

    shadowSm: "none",
    shadowMd: "none",
    shadowLg: "0 16px 40px rgba(13,16,20,0.18)",

    // "Ödev detayı" ve diğer yeniden tasarlanan ekranların mor/lime paleti (bilinçli marka rengi).
    brand: "#3A2FD0",
    brandText: "#3A2FD0",
    brandTint: "#EFEDFF",
    lime: "#D4F35B",
    ink: "#17163A",
    inkText: "#17163A",
    inkMuted: "#5D5C7A",
    pageTint: "#F4F3FB",
    cardDivider: "#EFEEF6",
    brandOutline: "#E4E3EE",
    success: "#127A5A",
    successTint: "#E3F6EF",
    successText: "#0E6049",
    danger: "#C93A2C",
    dangerTint: "#FFEEEA",
    dangerBorder: "#FFD2C8",
    dangerText: "#6E3A33",
    warningTint: "#FFF3DC",
    warningText: "#8A4A06",
    barWrong: "#FF8A78",
    barEmpty: "#D9D8E6",
    track: "#ECEBF5",
    navInactive: "#B9B8D6",
    onBrand: "#FFFFFF",
    onBrandMuted: "rgba(255,255,255,0.82)",
    onBrandSoft: "rgba(255,255,255,0.16)",
    onBrandTrack: "rgba(255,255,255,0.18)",
    onBrandBadge: "rgba(255,255,255,0.22)",
    onBrandBox: "rgba(255,255,255,0.12)",
    decorWhite: "rgba(255,255,255,0.07)",
    decorLime: "rgba(212,243,91,0.12)",
    avatar1: "#3A2FD0",
    avatar2: "#A8590A",
    avatar3: "#C93A2C",
    avatar4: "#127A5A",
    shadowCard: "0 12px 32px rgba(40,30,120,0.12)",
    shadowNav: "0 12px 28px rgba(23,22,58,0.28)",
  },
};

export const DEFAULT_THEME = "light";

// Paleti taşıyan TEK, paylaşılan nesne — bileşenler her zaman C.* okur.
export const C = {
  ...THEMES[DEFAULT_THEME],
  radiusSm: 11,   // çip, küçük düğme, satır
  radiusMd: 14,   // kart, kutucuk
  radiusLg: 18,   // büyük kart, pencere
};

// Arayüz: Outfit (2026-09-27'de Space Grotesk'in yerine — daha okunur bulundu, geometrik harfleri
// daha az sıra dışı). BÜTÜN rakamlar JetBrains Mono (netler, yüzdeler, soru sayıları, tarihler,
// okul numarası) — hizalanmaları gerekiyor. index.html'deki Google Fonts adresi (500;600;700;800 —
// kullanılan her ağırlık) burayla birlikte değişmeli, yoksa 800 sentetik kalınlaştırılır.
export const displayFont = "'Outfit', -apple-system, 'Segoe UI', sans-serif";
export const bodyFont = "'Outfit', -apple-system, 'Segoe UI', sans-serif";
export const monoFont = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

// Tamamlama yüzdesi rengi (dokümandaki 1b eşikleri) — 0 ayrı bir NÖTR renk: "hiç ödevi yapmadı / henüz
// ödevi yok" ile "düşük başarı" aynı şey değil. null = ödevi hiç yok.
export function completionTone(rate) {
  if (rate == null || rate === 0) return { fg: C.mutedLight, bg: C.surface2 };
  if (rate >= 70) return { fg: C.green, bg: C.greenSoft };
  if (rate >= 40) return { fg: C.amber, bg: C.amberSoft };
  return { fg: C.red, bg: C.redSoft };
}

// Türkçe ondalık gösterim: 16.25 → "16,25" (net gibi değerler için). decimals verilirse sabit basamak
// (ör. rapor kartlarında 13 → "13,00", sütunlar hizalı dursun diye).
export function formatNet(value, decimals) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const opts = decimals == null ? { minimumFractionDigits: 0, maximumFractionDigits: 2 } : { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
  return Number(value).toLocaleString("tr-TR", opts);
}

// Bir ödevin öğrenci açısından durumu — şartnamedeki dört değer: çözüldü · pas geçildi · yapılmadı ·
// süresi dolmadı. endDate UTC gece yarısı saklanır; bitiş gününün Türkiye'deki sonu geçince "yapılmadı".
export function recipientStatus(r, now = Date.now()) {
  if (r.completed) return "done";
  if (r.skippedAt) return "skipped";
  const end = new Date(r.assignment?.endDate || r.endDate).getTime() + 21 * 60 * 60 * 1000;
  return end < now ? "missed" : "open";
}

export const STATUS_LABEL = { done: "çözüldü", skipped: "pas geçildi", missed: "yapılmadı", open: "süresi dolmadı" };

// Durumun rengi ve zemini — çözüldü yeşil, pas sarı, yapılmadı kırmızı, süresi dolmadı nötr.
export function statusTone(status) {
  switch (status) {
    case "done": return { fg: C.green, bg: C.greenSoft };
    case "skipped": return { fg: C.amber, bg: C.amberSoft };
    case "missed": return { fg: C.red, bg: C.redSoft };
    default: return { fg: C.mutedLight, bg: C.surface2 };
  }
}

export const SKIP_REASONS = {
  KONU: "Konuyu bilmiyorum",
  ZAMAN: "Zaman yetmedi",
  KAYNAK: "Kaynağım yok",
  DIGER: "Başka sebep",
};

// Net = D − Y/4 (her yerde aynı formül).
export function netOf(s) {
  return s ? s.correctCount - s.wrongCount / 4 : null;
}
