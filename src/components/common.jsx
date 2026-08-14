import { useRef } from "react";
import { X, LogOut } from "lucide-react";
import { C, displayFont, bodyFont } from "../theme.js";

// Okulun gerçek amblemi (public/logo.png — amblem+"MAİ"+okul adı yazılarıyla birlikte tek bir görsel,
// arka planı opak beyaz, dikey/portre oranlı 985x1400). HİÇBİR yerde kırpılmaz (object-fit: contain) —
// görsel her zaman TAMAMEN görünür; kompakt alanlarda (kenar çubuğu) küçük ama eksiksiz, LoginScreen'de
// büyük ve okunaklı gösterilir. Kutunun kendisi her zaman beyaz zemin (logonun kendi beyaz arka planıyla
// kaynaşsın, koyu panellerde kenarlık/gölgeyle ayrışsın diye).
const LOGO_ASPECT = 1400 / 985; // yükseklik/genişlik — kutu oranı buna göre ayarlanır, metin de dahil hep tam görünsün

export function LogoMark({ width = 34, radius = 10 }) {
  const height = Math.round(width * LOGO_ASPECT);
  return (
    <div style={{
      width, height, borderRadius: radius, flexShrink: 0, padding: Math.max(2, Math.round(width * 0.06)),
      background: "#fff", overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,0.18)", boxSizing: "border-box",
    }}>
      <img src="/logo.png" alt="Okul logosu" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
    </div>
  );
}

export function Card({ children, style, hover, onClick }) {
  return (
    <div
      onClick={onClick}
      className={hover ? "k-card-hover" : undefined}
      style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: C.radiusMd, padding: 20,
        boxShadow: C.shadowMd,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Button({ children, onClick, variant = "primary", full, disabled, icon: Icon, small, type = "button" }) {
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    fontFamily: bodyFont, fontWeight: 700, borderRadius: C.radiusSm, cursor: disabled ? "not-allowed" : "pointer",
    border: "none", padding: small ? "8px 13px" : "11px 20px", fontSize: small ? 12.5 : 14,
    width: full ? "100%" : "auto", opacity: disabled ? 0.5 : 1, letterSpacing: 0.1,
  };
  const variants = {
    primary: { background: C.accent, color: C.onAccent, boxShadow: "0 1px 2px rgba(67,56,202,0.15), 0 4px 10px rgba(67,56,202,0.20)" },
    secondary: { background: C.surface, color: C.text, border: `1px solid ${C.borderStrong}` },
    ghost: { background: "transparent", color: C.muted },
    danger: { background: C.redSoft, color: C.red },
  };
  return (
    <button type={type} className="k-btn" onClick={disabled ? undefined : onClick} style={{ ...base, ...variants[variant] }}>
      {Icon ? <Icon size={small ? 14 : 16} /> : null}
      {children}
    </button>
  );
}

function FieldLabel({ children }) {
  if (!children) return null;
  return (
    <div style={{ fontFamily: bodyFont, fontSize: 11, fontWeight: 700, color: C.mutedLight, marginBottom: 7, textTransform: "uppercase", letterSpacing: 0.5 }}>
      {children}
    </div>
  );
}

const fieldBaseStyle = {
  width: "100%", boxSizing: "border-box", background: C.surface2,
  border: `1px solid ${C.border}`, borderRadius: C.radiusSm,
  padding: "10px 13px", fontSize: 14, fontFamily: bodyFont, color: C.text, outline: "none",
};

export function Input({ label, error, style, ...props }) {
  return (
    <label style={{ display: "block", marginBottom: 16 }}>
      <FieldLabel>{label}</FieldLabel>
      <input
        {...props}
        className="k-field"
        style={{ ...fieldBaseStyle, borderColor: error ? C.red : C.border, ...style }}
      />
      {error && <div style={{ fontSize: 12, color: C.red, marginTop: 5, fontWeight: 600 }}>{error}</div>}
    </label>
  );
}

export function Select({ label, children, style, ...props }) {
  return (
    <label style={{ display: "block", marginBottom: 16 }}>
      <FieldLabel>{label}</FieldLabel>
      <select {...props} className="k-field" style={{ ...fieldBaseStyle, cursor: "pointer", ...style }}>
        {children}
      </select>
    </label>
  );
}

export function Textarea({ label, style, ...props }) {
  return (
    <label style={{ display: "block", marginBottom: 16 }}>
      <FieldLabel>{label}</FieldLabel>
      <textarea {...props} className="k-field" style={{ ...fieldBaseStyle, resize: "vertical", ...style }} />
    </label>
  );
}

export function Pill({ children, tone = "muted" }) {
  const tones = {
    muted: { bg: C.surface2, color: C.muted },
    accent: { bg: C.accentSoft, color: C.accent },
    green: { bg: C.greenSoft, color: C.green },
    amber: { bg: C.amberSoft, color: C.amber },
    red: { bg: C.redSoft, color: C.red },
  };
  const t = tones[tone];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: t.bg, color: t.color, fontFamily: bodyFont, fontSize: 11, fontWeight: 800,
      padding: "3.5px 9px", borderRadius: 999, whiteSpace: "nowrap", letterSpacing: 0.2,
    }}>
      {children}
    </span>
  );
}

// Ad-soyaddan baş harfleri + tutarlı bir vurgu rengi türeten yuvarlak avatar — fotoğraf yükleme
// desteklenmiyor (MVP kapsamı dışı), bu yüzden her yerde aynı biçimde kullanılan tek görsel kimlik.
const AVATAR_PALETTE = ["#4338CA", "#0F766E", "#B45309", "#BE185D", "#1D4ED8", "#15803D"];
function colorForName(name) {
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}
function initialsOf(name) {
  return (name || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("") || "?";
}
export function Avatar({ name, size = 36, dark }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 999, flexShrink: 0,
      background: colorForName(name), color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: displayFont, fontWeight: 700, fontSize: size * 0.4,
      boxShadow: dark ? "0 0 0 2px rgba(255,255,255,0.12)" : "0 0 0 2px rgba(255,255,255,0.7)",
    }}>
      {initialsOf(name)}
    </div>
  );
}

export function Modal({ children, onClose, title }) {
  const openedAt = useRef(Date.now());
  const handleBackdropClick = () => {
    if (Date.now() - openedAt.current < 300) return;
    onClose();
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,12,28,0.55)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }} onClick={handleBackdropClick}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.surface, borderRadius: C.radiusLg, padding: 24, width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto", boxShadow: C.shadowLg }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <span style={{ fontFamily: displayFont, fontSize: 18, fontWeight: 800, color: C.text }}>{title}</span>
          <button className="k-icon-btn" onClick={onClose} style={{ background: C.surface2, border: "none", borderRadius: 999, width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={16} color={C.text} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function roleLabel(role) {
  return { ADMIN: "Yönetici", TEACHER: "Koç / Öğretmen", STUDENT: "Öğrenci" }[role] || role;
}

// Sol kenar çubuğu — koyu, sabit genişlikli, dar ekranlarda simge-yalnız moda düşer (bkz.
// index.html > .k-sidebar media query). Üstte marka, ortada rol'e göre gezinme sekmeleri, altta
// kullanıcı kartı + çıkış.
export function Sidebar({ user, tabs, activeId, onSelect, onLogout }) {
  return (
    <div className="k-sidebar" style={{
      width: 240, flexShrink: 0, background: C.sidebarBg, display: "flex", flexDirection: "column",
      height: "100vh", position: "sticky", top: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "22px 20px 18px" }}>
        <LogoMark width={38} />
        <div className="k-sidebar-brand-text" style={{ minWidth: 0 }}>
          <div style={{ fontFamily: displayFont, fontSize: 12.5, fontWeight: 800, color: "#fff", lineHeight: 1.3 }}>Mehmet Akif İnan Hafız</div>
          <div style={{ fontFamily: bodyFont, fontSize: 10.5, color: C.sidebarText, lineHeight: 1.3 }}>Anadolu İmam Hatip Lisesi</div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 3, overflowY: "auto" }}>
        {tabs.map((t) => {
          const active = t.id === activeId;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              className="k-sidebar-item"
              onClick={() => onSelect(t.id)}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                borderRadius: C.radiusSm, border: "none", cursor: "pointer", textAlign: "left",
                background: active ? C.sidebarActiveBg : "transparent",
                color: active ? C.sidebarTextActive : C.sidebarText,
                borderLeft: `3px solid ${active ? C.sidebarAccent : "transparent"}`,
                position: "relative",
              }}
            >
              {Icon && <Icon size={17} strokeWidth={2.1} style={{ flexShrink: 0 }} />}
              <span className="k-sidebar-label" style={{ fontFamily: bodyFont, fontSize: 13.5, fontWeight: active ? 700 : 600, whiteSpace: "nowrap" }}>{t.label}</span>
              {t.badge > 0 && (
                <span className="k-sidebar-label" style={{
                  marginLeft: "auto", background: C.sidebarAccent, color: "#fff", fontSize: 10.5, fontWeight: 800,
                  borderRadius: 999, minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px",
                }}>{t.badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div style={{ borderTop: `1px solid ${C.sidebarBorder}`, padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar name={user.name} size={34} dark />
        <div className="k-sidebar-user-text" style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: bodyFont, fontSize: 12.5, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</div>
          <div style={{ fontFamily: bodyFont, fontSize: 10.5, color: C.sidebarText }}>{roleLabel(user.role)}</div>
        </div>
        <button
          onClick={onLogout}
          title="Çıkış yap"
          style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
        >
          <LogOut size={14} color={C.sidebarText} />
        </button>
      </div>
    </div>
  );
}

// İçerik sütununun üst şeridi — sayfa başlığı burada, kenar çubuğundaki marka satırından ayrı.
export function PageHeader({ title, subtitle, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "18px 28px", background: C.surface, borderBottom: `1px solid ${C.border}`, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontFamily: displayFont, fontSize: 19, fontWeight: 800, color: C.text }}>{title}</div>
        {subtitle && <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.muted, marginTop: 2 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

// Küçük özet sayı kartı (ör. "Bekleyen Ödevler: 3") — ilgili listenin üstünde bağlamıyla gösterilir.
export function StatCard({ label, value, tone = "muted" }) {
  const tones = { muted: C.text, accent: C.accent, green: C.green, amber: C.amber, red: C.red };
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: C.radiusMd, padding: "14px 16px", minWidth: 120, flex: 1, boxShadow: C.shadowSm }}>
      <div style={{ fontFamily: displayFont, fontSize: 24, fontWeight: 800, color: tones[tone] }}>{value}</div>
      <div style={{ fontFamily: bodyFont, fontSize: 11, fontWeight: 700, color: C.mutedLight, marginTop: 3, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
    </div>
  );
}

export function EmptyState({ text, icon: Icon }) {
  return (
    <div style={{ padding: "48px 16px", textAlign: "center", color: C.mutedLight, fontFamily: bodyFont, fontSize: 13.5 }}>
      {Icon && <Icon size={30} style={{ marginBottom: 10, opacity: 0.6 }} />}
      <div>{text}</div>
    </div>
  );
}
