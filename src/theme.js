// İki tema: açık (mor/lime marka) ve koyu (KULLANICI İSTEĞİ 2026-10-05: "siyah beyaz gri tadında"). Koyu temada
// marka rengi yok: mor üst alanlar koyu gri, lime vurgu kırık beyaz. Durum renkleri (doğru yeşili, yanlış kırmızısı,
// uyarı sarısı) veri anlamı taşıdığı için iki temada da var — koyuda zemine göre yumuşatılmış. Profil > Görünüm.
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
    // Rakam rengi: açık temada normal yazı; koyu temada yeşil (KULLANICI İSTEĞİ 2026-10-05: "tüm rakamlarda o rengi kullan").
    numText: "#17163A",
    numOnBrand: "#FFFFFF",
    // Düğme / seçili öğe zemini: açıkta marka moru, koyuda kullanıcının vurgu rengi (bkz. ACCENTS).
    cta: "#3A2FD0",
    onCta: "#FFFFFF",
    shadowCard: "0 12px 32px rgba(40,30,120,0.12)",
    shadowNav: "0 12px 28px rgba(23,22,58,0.28)",
  },
  dark: {
    bg: "#0B0B0C",
    surface: "#161617",
    surface2: "#1E1E20",
    surfaceHover: "#26262A",
    fieldBg: "#1E1E20",
    border: "#2A2A2E",
    borderStrong: "#3A3A3F",
    divider: "#222225",
    text: "#F2F2F3",
    text2: "#D0D0D4",
    muted: "#A8A8AE",
    mutedLight: "#929298",
    faintest: "#4A4A50",

    accent: "#F2F2F3",
    accentHover: "#FFFFFF",
    accentSoft: "#26262A",
    accent2: "#D0D0D4",
    onAccent: "#0B0B0C",

    green: "#4ADE80",
    greenSoft: "rgba(74,222,128,0.13)",
    amber: "#FBBF24",
    amberSoft: "rgba(251,191,36,0.13)",
    red: "#F87171",
    redSoft: "rgba(248,113,113,0.13)",
    onRed: "#1A0808",
    blue: "#D0D0D4",
    blueSoft: "#1E1E20",
    koc: "#C8C8CE",
    kocSoft: "rgba(200,200,206,0.12)",
    blank: "#929298",
    blankSoft: "rgba(146,146,152,0.14)",

    sidebarBg: "#000000",
    sidebarBgAlt: "#0E0E0F",
    sidebarText: "#929298",
    sidebarTextActive: "#F2F2F3",
    sidebarActiveBg: "rgba(255,255,255,0.07)",
    sidebarAccent: "#F2F2F3",
    sidebarBorder: "rgba(255,255,255,0.08)",

    shadowSm: "none",
    shadowMd: "none",
    shadowLg: "0 16px 40px rgba(0,0,0,0.6)",

    // Marka alanları griye döner: mor üst alan → koyu gri, lime → kırık beyaz (üstündeki yazı siyah).
    brand: "#1F1F22",
    brandText: "#E4E4E7",
    brandTint: "#26262A",
    lime: "#EDEDEF",
    ink: "#0B0B0C",
    inkText: "#F2F2F3",
    inkMuted: "#A8A8AE",
    pageTint: "#1E1E20",
    cardDivider: "#26262A",
    brandOutline: "#2E2E33",
    success: "#4ADE80",
    successTint: "rgba(74,222,128,0.12)",
    successText: "#86EFAC",
    danger: "#F87171",
    dangerTint: "rgba(248,113,113,0.12)",
    dangerBorder: "rgba(248,113,113,0.35)",
    dangerText: "#FCA5A5",
    warningTint: "rgba(251,191,36,0.12)",
    warningText: "#FCD34D",
    barWrong: "#F87171",
    barEmpty: "#3A3A3F",
    track: "#2A2A2E",
    navInactive: "#8E8E94",
    onBrand: "#F2F2F3",
    onBrandMuted: "rgba(242,242,243,0.72)",
    onBrandSoft: "rgba(255,255,255,0.10)",
    onBrandTrack: "rgba(255,255,255,0.14)",
    onBrandBadge: "rgba(255,255,255,0.16)",
    onBrandBox: "rgba(255,255,255,0.07)",
    decorWhite: "rgba(255,255,255,0.04)",
    decorLime: "rgba(255,255,255,0.05)",
    avatar1: "#3A3A3F",
    avatar2: "#4A4A50",
    avatar3: "#5A5A60",
    avatar4: "#2E2E33",
    numText: "#4ADE80",
    numOnBrand: "#4ADE80",
    cta: "#4ADE80",
    onCta: "#0B0B0C",
    shadowCard: "0 12px 32px rgba(0,0,0,0.5)",
    shadowNav: "0 12px 28px rgba(0,0,0,0.6)",
  },
};

export const DEFAULT_THEME = "light";

// Koyu temanın vurgu rengi (KULLANICI İSTEĞİ 2026-10-05): rakamlar, seçili sekme, düğmeler bu renkte; varsayılan yeşil,
// Profil > Görünüm'den değişir. Hepsi koyu zeminde açık ve üstlerine siyah yazı okunur.
export const ACCENTS = [
  { id: "yesil", label: "Yeşil", color: "#4ADE80" },
  { id: "mavi", label: "Mavi", color: "#60A5FA" },
  { id: "mor", label: "Mor", color: "#A78BFA" },
  { id: "pembe", label: "Pembe", color: "#F472B6" },
  { id: "turuncu", label: "Turuncu", color: "#FB923C" },
  { id: "sari", label: "Sarı", color: "#FACC15" },
  { id: "beyaz", label: "Beyaz", color: "#EDEDEF" },
];
export const DEFAULT_ACCENT = "yesil";
const HEX = /^#[0-9a-f]{6}$/i;
// Paletten seçilen serbest renk "#rrggbb" olarak saklanır; hazır renkler kimlikleriyle.
export const resolveColor = (value, list) => (HEX.test(value || "") ? value : (list.find((a) => a.id === value) || list[0]).color);
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function accentTokens(value) {
  const c = resolveColor(value, ACCENTS);
  // Koyu bir serbest renk seçilirse düğme yazısı beyaza döner (okunurluk).
  return { lime: c, numText: c, numOnBrand: c, cta: c, onCta: luminance(c) > 0.18 ? "#0B0B0C" : "#FFFFFF" };
}

// Koyu temanın yazı rengi (KULLANICI İSTEĞİ 2026-10-05): başlıklar ve ana metin; ikincil (soluk) yazılar griden kalır.
export const TEXT_COLORS = [
  { id: "beyaz", label: "Beyaz", color: "#F2F2F3" },
  { id: "krem", label: "Krem", color: "#F5EBD7" },
  { id: "gri", label: "Açık gri", color: "#C8C8CE" },
  { id: "mavi", label: "Buz mavisi", color: "#D6E6FF" },
  { id: "yesil", label: "Nane", color: "#D7F5E3" },
  { id: "pembe", label: "Pudra", color: "#FADDE6" },
];
export const DEFAULT_TEXT_COLOR = "beyaz";
export function textTokens(value) {
  const c = resolveColor(value, TEXT_COLORS);
  return { text: c, inkText: c, onBrand: c, accent: c };
}

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
