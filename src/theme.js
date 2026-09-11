// İki tema: "light" (varsayılan, profesyonel SaaS/dashboard görünümü) ve "dark" (okul amblemindeki
// koyu petrol yeşili + altın renklerinden esinlenilmiş). radiusSm/Md/Lg ve font'lar YAPISAL —
// temaya göre değişmez, bu yüzden THEMES'in dışında, C üzerinde her zaman sabit tutulur (bkz. altta).
export const THEMES = {
  light: {
    bg: "#F5F6FB",
    surface: "#FFFFFF",
    surface2: "#F0F2F8",
    surfaceHover: "#E9EBF4",
    border: "rgba(15,23,42,0.09)",
    borderStrong: "rgba(15,23,42,0.16)",
    text: "#0F1729",
    muted: "#66708A",
    mutedLight: "#94A0BE",

    accent: "#4338CA",
    accentHover: "#372DAF",
    accentSoft: "#EEF0FE",
    accent2: "#6D62F0",
    onAccent: "#FFFFFF",

    green: "#15803D",
    greenSoft: "#EDFAF1",
    amber: "#B45309",
    amberSoft: "#FDF6E9",
    red: "#B91C1C",
    redSoft: "#FDECEC",

    // Kenar çubuğu koyu paleti — içerik alanının aksine ayrı, sabit bir renk seti.
    sidebarBg: "#12142B",
    sidebarBgAlt: "#181A36",
    sidebarText: "#AEB3D6",
    sidebarTextActive: "#FFFFFF",
    sidebarActiveBg: "rgba(255,255,255,0.08)",
    sidebarAccent: "#8B7FF6",
    sidebarBorder: "rgba(255,255,255,0.08)",

    shadowSm: "0 1px 2px rgba(15,23,42,0.06)",
    shadowMd: "0 1px 2px rgba(15,23,42,0.04), 0 8px 20px rgba(15,23,42,0.07)",
    shadowLg: "0 4px 10px rgba(15,23,42,0.06), 0 16px 40px rgba(15,23,42,0.12)",
  },
  // Okul amblemindeki koyu petrol yeşili (kanatlar) + altın (minare/hilal) paletinden esinlenilmiş —
  // vurgu rengi açık temadaki mor yerine altın (amblemle doğrudan uyumlu), zemin nötr siyaha değil
  // amblemin petrol yeşiline çekiliyor. Kartlardaki gradyan şerit (bkz. common.jsx > Card) bu yüzden
  // altın'dan yumuşak bir nane yeşiline geçer — amblemin iki rengini birlikte taşır.
  dark: {
    bg: "#0A1A1E",
    surface: "#102428",
    surface2: "#173237",
    surfaceHover: "#1E3B41",
    border: "rgba(255,255,255,0.09)",
    borderStrong: "rgba(255,255,255,0.18)",
    text: "#F2F6F5",
    muted: "#9CB3B6",
    mutedLight: "#6E888B",

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

    // Kenar çubuğu ana zeminle aynı ailede (biraz daha koyu) — açık temadaki gibi apayrı, sabit bir
    // lacivert değil, tek bütün bir koyu tema hissi versin diye.
    sidebarBg: "#071316",
    sidebarBgAlt: "#0D2024",
    sidebarText: "#9CB3B6",
    sidebarTextActive: "#FFFFFF",
    sidebarActiveBg: "rgba(212,167,44,0.14)",
    sidebarAccent: "#D4A72C",
    sidebarBorder: "rgba(255,255,255,0.08)",

    // Siyah gölge koyu zeminde neredeyse görünmez — derinlik burada ÇOĞUNLUKLA border'dan gelir,
    // gölge yalnızca hafif bir ayrım için var.
    shadowSm: "0 1px 2px rgba(0,0,0,0.25)",
    shadowMd: "0 1px 2px rgba(0,0,0,0.2), 0 8px 20px rgba(0,0,0,0.35)",
    shadowLg: "0 4px 10px rgba(0,0,0,0.3), 0 16px 40px rgba(0,0,0,0.45)",
  },
};

// Aktif paleti taşıyan TEK, paylaşılan, MUTABLE nesne — bileşenler her zaman C.* okur. Tema değişince
// (bkz. App.jsx > Object.assign(C, THEMES[theme])) bu nesnenin içeriği YERİNDE güncellenir, referans
// hiç değişmez; App'in bir üst render'ı sırasında yapıldığı için tüm alt bileşenler bir sonraki
// render'da otomatik güncel değerleri görür (ayrı bir Context/prop-drilling gerekmez).
export const C = {
  ...THEMES.light,
  radiusSm: 8,
  // 12 -> 16: Tailwind "rounded-xl" yerine "rounded-2xl" — kart/buton/giriş alanlarında istenen
  // daha belirgin oval köşe hissi (bkz. tasarım kılavuzu: "rounded-2xl veya rounded-xl").
  radiusMd: 16,
  radiusLg: 18,
};

export const displayFont = "'Manrope', -apple-system, 'Segoe UI', sans-serif";
export const bodyFont = "'Manrope', -apple-system, 'Segoe UI', sans-serif";
