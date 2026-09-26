// İki tema: "light" (varsayılan) ve "dark" (okul amblemindeki koyu petrol yeşili + altın renklerinden
// esinlenilmiş). Açık temanın değerleri "Koçluk — 8 ekran tasarım güncellemesi" dokümanının jeton
// tablosundan (0 — JETONLAR). radiusSm/Md/Lg ve font'lar YAPISAL — temaya göre değişmez, bu yüzden
// THEMES'in dışında, C üzerinde her zaman sabit tutulur (bkz. altta).
export const THEMES = {
  light: {
    bg: "#F4F5FA",
    surface: "#FFFFFF",
    surface2: "#F1F3F8",        // nötr açık ton (ör. "Boş" kutucuğu, %0 tamamlama)
    surfaceHover: "#E9EBF4",
    fieldBg: "#F7F8FC",         // form alanı zemini
    border: "#E7E9F2",
    borderStrong: "rgba(20,26,46,0.16)",
    divider: "#EFF1F7",
    text: "#141A2E",            // başlık
    text2: "#3D465F",           // gövde, bölüm başlığı
    // Metin tonları dokümandakilerden bir kademe koyu (#6B7590 → #525B73, #98A0B8 → #666E88): doküman
    // değerleriyle ikincil/soluk metinler açık zeminlerde WCAG AA'nın (4.5:1) altında kalıyordu (tarama
    // 363 kontrast sorunu buldu). Soluk yine ikincilden açık — hiyerarşi korunuyor.
    muted: "#525B73",           // ikincil
    mutedLight: "#666E88",      // soluk (meta metni, pasif alt menü)
    faintest: "#BAC1D4",        // en soluk (ok ikonları, diğer ayın günleri)

    accent: "#4F36D6",
    accentHover: "#4329C4",
    accentSoft: "#EDEAFD",
    accent2: "#6D5AE6",
    onAccent: "#FFFFFF",

    // Durum renkleri aynı anlamda (kırmızı geciken, amber bekleyen, yeşil tamamlanan), açık zeminleri
    // dokümandaki gibi; yalnızca koyu tonları kendi açık zemininde 4.5:1'i geçecek kadar koyulaştırıldı
    // (doküman: #16A34A / #D97706 / #DC2626 — yeşil ve amber ~2.9:1'di).
    green: "#11803A",
    greenSoft: "#E7F6ED",
    amber: "#B45309",
    amberSoft: "#FEF3E2",
    red: "#D22424",
    redSoft: "#FDECEC",
    onRed: "#FFFFFF",
    blue: "#2563EB",
    blueSoft: "#E8F0FE",

    // YKS sayacı kartı (bkz. StudentHomeScreen > ExamCountdownCard).
    countdownBg: "linear-gradient(130deg,#5B41E0 0%,#4F36D6 48%,#3A25AE 100%)",
    countdownShadow: "0 8px 20px rgba(79,54,214,0.28)",
    onCountdown: "#FFFFFF",

    // Kenar çubuğu (masaüstü) koyu paleti — içerik alanının aksine ayrı, sabit bir renk seti.
    sidebarBg: "#12142B",
    sidebarBgAlt: "#181A36",
    sidebarText: "#AEB3D6",
    sidebarTextActive: "#FFFFFF",
    sidebarActiveBg: "rgba(255,255,255,0.08)",
    sidebarAccent: "#8B7FF6",
    sidebarBorder: "rgba(255,255,255,0.08)",

    shadowSm: "0 1px 2px rgba(20,26,46,0.04)",
    shadowMd: "0 1px 2px rgba(20,26,46,0.04), 0 6px 16px rgba(20,26,46,0.05)",
    shadowLg: "0 4px 10px rgba(20,26,46,0.06), 0 16px 40px rgba(20,26,46,0.12)",
  },
  // Okul amblemindeki koyu petrol yeşili (kanatlar) + altın (minare/hilal) paleti — vurgu rengi açık
  // temadaki mor yerine altın, zemin amblemin petrol yeşiline çekiliyor. Doküman yalnızca açık temayı
  // tanımlıyor; buradaki yeni jetonlar (text2, faintest, fieldBg, blue...) aynı rolleri koyu zeminde taşır.
  dark: {
    bg: "#0A1A1E",
    surface: "#102428",
    surface2: "#173237",
    surfaceHover: "#1E3B41",
    fieldBg: "#132B30",
    border: "rgba(255,255,255,0.09)",
    borderStrong: "rgba(255,255,255,0.18)",
    divider: "rgba(255,255,255,0.06)",
    text: "#F2F6F5",
    text2: "#D3E0E1",
    muted: "#9CB3B6",
    mutedLight: "#86A0A3",
    faintest: "#5E7477",

    accent: "#D4A72C",
    accentHover: "#E4BC4C",
    accentSoft: "rgba(212,167,44,0.16)",
    accent2: "#8FD9C4",
    onAccent: "#12201A",

    green: "#4ADE80",
    greenSoft: "rgba(74,222,128,0.14)",
    amber: "#FBBF24",
    amberSoft: "rgba(251,191,36,0.14)",
    red: "#F87171",
    redSoft: "rgba(248,113,113,0.14)",
    onRed: "#2A0B0B", // açık kırmızı üzerinde beyaz metin okunmuyor
    blue: "#60A5FA",
    blueSoft: "rgba(96,165,250,0.14)",

    countdownBg: "linear-gradient(130deg,#E4BC4C 0%,#D4A72C 48%,#B8891C 100%)",
    countdownShadow: "0 8px 20px rgba(0,0,0,0.35)",
    onCountdown: "#12201A",

    sidebarBg: "#071316",
    sidebarBgAlt: "#0D2024",
    sidebarText: "#9CB3B6",
    sidebarTextActive: "#FFFFFF",
    sidebarActiveBg: "rgba(212,167,44,0.14)",
    sidebarAccent: "#D4A72C",
    sidebarBorder: "rgba(255,255,255,0.08)",

    // Siyah gölge koyu zeminde neredeyse görünmez — derinlik burada ÇOĞUNLUKLA border'dan gelir.
    shadowSm: "0 1px 2px rgba(0,0,0,0.25)",
    shadowMd: "0 1px 2px rgba(0,0,0,0.2), 0 6px 16px rgba(0,0,0,0.3)",
    shadowLg: "0 4px 10px rgba(0,0,0,0.3), 0 16px 40px rgba(0,0,0,0.45)",
  },
};

// Aktif paleti taşıyan TEK, paylaşılan, MUTABLE nesne — bileşenler her zaman C.* okur. Tema değişince
// (bkz. App.jsx > Object.assign(C, THEMES[theme])) bu nesnenin içeriği YERİNDE güncellenir, referans
// hiç değişmez; App'in bir üst render'ı sırasında yapıldığı için tüm alt bileşenler bir sonraki
// render'da otomatik güncel değerleri görür (ayrı bir Context/prop-drilling gerekmez).
export const C = {
  ...THEMES.light,
  radiusSm: 11,   // çip, küçük düğme
  radiusMd: 14,   // kart, satır, kutucuk
  radiusLg: 18,   // sayaç kartı, pencere
};

// Metin: Outfit. Rakamlar: JetBrains Mono — Outfit'in rakamları eşit genişlikte değil, kutucuk ve
// tablolarda sayılar kayıyordu; net, D/Y/B, yüzde, gün sayısı, sayaç her yerde monoFont ile yazılır.
export const displayFont = "'Outfit', -apple-system, 'Segoe UI', sans-serif";
export const bodyFont = "'Outfit', -apple-system, 'Segoe UI', sans-serif";
export const monoFont = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

// Tamamlama yüzdesi rengi (dokümandaki 1b eşikleri) — 0 ayrı bir NÖTR renk: "hiç ödevi yapmadı / henüz
// ödevi yok" ile "düşük başarı" aynı şey değil. null = ödevi hiç yok.
export function completionTone(rate) {
  if (rate == null || rate === 0) return { fg: C.muted, bg: C.surface2 };
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
