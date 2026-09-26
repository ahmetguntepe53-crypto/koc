import { Component, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, LogOut, ChevronLeft, ChevronRight } from "lucide-react";
import { C, displayFont, bodyFont, monoFont } from "../theme.js";

// Herhangi bir ekranın render sırasında beklenmedik bir hata fırlatması (ör. eksik/tutarsız bir
// alan üzerinden yapılan güvencesiz bir erişim) React'i tüm uygulamayı bembeyaz bir sayfaya
// düşürmeye zorlar — bu sınır, hatayı yalnızca bulunduğu ekranla sınırlı tutup kullanıcıya "sayfayı
// yenile" gibi bir çıkış yolu bırakır. main.jsx'te <App/>'i sarmalar.
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: C.bg, fontFamily: bodyFont, textAlign: "center" }}>
          <div>
            <div style={{ fontFamily: displayFont, fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 8 }}>Bir şeyler ters gitti</div>
            <div style={{ fontSize: 13.5, color: C.muted, marginBottom: 18 }}>Sayfayı yenilemeyi dene — sorun devam ederse okul yöneticine haber ver.</div>
            <button
              onClick={() => window.location.reload()}
              className="k-btn"
              style={{ background: C.accent, color: C.onAccent, border: "none", borderRadius: C.radiusSm, padding: "11px 20px", fontSize: 14, fontWeight: 700, fontFamily: bodyFont, cursor: "pointer" }}
            >
              Sayfayı Yenile
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Okulun gerçek amblemi (public/logo.png — yalnızca kanatlı/hilalli işaret, kare 512x512, arka
// planı SAYDAM) — hem açık hem koyu temada arkasına bir kutu gerekmeden doğal görünür. HİÇBİR
// yerde kırpılmaz (object-fit: contain) — görsel her zaman TAMAMEN görünür.
const LOGO_ASPECT = 1; // yükseklik/genişlik — kare görsel

export function LogoMark({ width = 34, radius, style }) {
  const height = Math.round(width * LOGO_ASPECT);
  return (
    <img
      src="/logo.png" alt="Okul logosu"
      style={{ width, height, objectFit: "contain", display: "block", flexShrink: 0, ...style }}
    />
  );
}

// Kart: beyaz zemin, 1px kenarlık, yumuşak gölge. Eskiden HER kartın tepesinde mor bir şerit vardı —
// her yerde olan vurgu hiçbir yeri vurgulamıyordu. Artık yalnızca DURUMU olan satırlarda sol kenarda
// 3px durum şeridi var (status: "red" geciken, "amber" bekleyen, "green" tamamlanan); durumu olmayan
// kartta (form, özet, başlık) şerit yok. `stripe` eski çağrılarla uyumluluk için kabul edilip yok sayılır.
// eslint-disable-next-line no-unused-vars
export function Card({ children, style, hover, onClick, status, stripe }) {
  const statusColor = status ? { red: C.red, amber: C.amber, green: C.green, accent: C.accent }[status] : null;
  // Tıklanabilir kart klavyeyle de kullanılabilsin (Tab ile odak, Enter/Boşluk ile aç).
  const interactive = onClick ? {
    role: "button", tabIndex: 0,
    onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(e); } },
  } : {};
  return (
    <div
      onClick={onClick}
      {...interactive}
      className={hover ? "k-card-hover" : undefined}
      style={{
        position: "relative", overflow: statusColor ? "hidden" : undefined,
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: C.radiusMd, padding: 18,
        boxShadow: C.shadowMd,
        ...style,
      }}
    >
      {statusColor && <span aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: statusColor }} />}
      {children}
    </div>
  );
}

export function Button({ children, onClick, variant = "primary", full, disabled, icon: Icon, small, type = "button", style }) {
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    fontFamily: bodyFont, fontWeight: 700, borderRadius: small ? 10 : 14, cursor: disabled ? "not-allowed" : "pointer",
    border: "none", padding: small ? "0 13px" : "0 20px", height: small ? 34 : full ? 50 : 44, fontSize: small ? 12.5 : 15,
    width: full ? "100%" : "auto", opacity: disabled ? 0.45 : 1, whiteSpace: "nowrap",
  };
  const variants = {
    primary: { background: C.accent, color: C.onAccent },
    secondary: { background: C.surface, color: C.text2, border: `1px solid ${C.border}` },
    ghost: { background: "transparent", color: C.accent },
    danger: { background: C.redSoft, color: C.red },
    // Geri alınamaz işlemin onay düğmesi (bkz. DialogHost) — yumuşak "danger"dan daha belirgin.
    dangerSolid: { background: C.red, color: C.onRed },
  };
  return (
    <button type={type} disabled={disabled} className="k-btn" onClick={disabled ? undefined : onClick} style={{ ...base, ...variants[variant], ...style }}>
      {Icon ? <Icon size={small ? 14 : 17} /> : null}
      {children}
    </button>
  );
}

// Form etiketi — cümle düzeninde (VERSAL değil): iki satıra taşan büyük harfli etiketler okunmuyordu.
function FieldLabel({ children }) {
  if (!children) return null;
  return (
    <div style={{ fontFamily: bodyFont, fontSize: 12.5, fontWeight: 600, color: C.muted, marginBottom: 7 }}>
      {children}
    </div>
  );
}

// Fonksiyon olarak tanımlanır (sabit bir nesne DEĞİL) — C.* tema değişince YERİNDE güncellendiği
// için (bkz. theme.js), modül yüklenirken BİR KEZ hesaplanan bir nesne o anki temayı donmuş halde
// tutardı; koyu temaya geçilince giriş alanları hâlâ açık temanın renklerinde kalırdı.
function fieldBaseStyle() {
  return {
    // width:100 + boxSizing tek başına yetmiyor: iOS'ta <input type="date"> kendi iç metin/takvim
    // simgesi için bir asgari genişlik dayatıyor ve bunu CSS width'i yok sayarak taşırabiliyor —
    // minWidth:0 + maxWidth:100% bu asgari genişliği geçersiz kılıp kabına sıkıştırıyor.
    width: "100%", minWidth: 0, maxWidth: "100%", boxSizing: "border-box", background: C.fieldBg,
    border: `1px solid ${C.border}`, borderRadius: 12, minHeight: 48,
    padding: "11px 14px", fontSize: 15, fontWeight: 500, fontFamily: bodyFont, color: C.text, outline: "none",
  };
}

export function Input({ label, error, style, ...props }) {
  return (
    <label style={{ display: "block", marginBottom: 16 }}>
      <FieldLabel>{label}</FieldLabel>
      <input
        {...props}
        className="k-field"
        style={{ ...fieldBaseStyle(), borderColor: error ? C.red : C.border, ...style }}
      />
      {error && <div style={{ fontSize: 12, color: C.red, marginTop: 5, fontWeight: 600 }}>{error}</div>}
    </label>
  );
}

export function Select({ label, children, style, ...props }) {
  return (
    <label style={{ display: "block", marginBottom: 16 }}>
      <FieldLabel>{label}</FieldLabel>
      <select {...props} className="k-field" style={{ ...fieldBaseStyle(), cursor: "pointer", ...style }}>
        {children}
      </select>
    </label>
  );
}

export function Textarea({ label, style, ...props }) {
  return (
    <label style={{ display: "block", marginBottom: 16 }}>
      <FieldLabel>{label}</FieldLabel>
      <textarea {...props} className="k-field" style={{ ...fieldBaseStyle(), resize: "vertical", ...style }} />
    </label>
  );
}

// Metin içindeki sayı (ör. rozetteki "3" gün) JetBrains Mono ile — Outfit'in rakamları eşit genişlikte değil.
export function Num({ children, size = 11 }) {
  return <span style={{ fontFamily: monoFont, fontSize: size }}>{children}</span>;
}

// Rozet: 22px yükseklik, köşe 7, zemin durumun açık tonu, yazı koyu tonu. mono: sayı içeren rozetler
// (ör. "Net 16,25", "D 92") rakamları eşit genişlikte yazsın diye.
export function Pill({ children, tone = "muted", mono = false }) {
  const tones = {
    muted: { bg: C.surface2, color: C.muted },
    accent: { bg: C.accentSoft, color: C.accent },
    green: { bg: C.greenSoft, color: C.green },
    amber: { bg: C.amberSoft, color: C.amber },
    red: { bg: C.redSoft, color: C.red },
    blue: { bg: C.blueSoft, color: C.blue },
  };
  const t = tones[tone] || tones.muted;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4, height: 22, boxSizing: "border-box",
      background: t.bg, color: t.color, fontFamily: mono ? monoFont : bodyFont, fontSize: mono ? 11 : 11.5, fontWeight: 700,
      padding: "0 8px", borderRadius: 7, whiteSpace: "nowrap",
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

// Android geri tuşu önce açık bir pencereyi kapatsın diye (bkz. App.jsx > onBackButton) — aksi halde
// "Öğrenci Ekle" formu açıkken geri tuşu alttaki ekranda gezinip ya da uygulamadan çıkıp formu
// kaybettiriyordu. Açık modalların onClose'ları açılış sırasıyla tutulur, geri tuşu en üsttekini kapatır.
const openModalStack = [];
export function closeTopModal() {
  const top = openModalStack[openModalStack.length - 1];
  if (!top) return false;
  top.current();
  return true;
}

export function Modal({ children, onClose, title }) {
  const openedAt = useRef(Date.now());
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    openModalStack.push(onCloseRef);
    return () => {
      const i = openModalStack.lastIndexOf(onCloseRef);
      if (i >= 0) openModalStack.splice(i, 1);
    };
  }, []);
  const handleBackdropClick = () => {
    if (Date.now() - openedAt.current < 300) return;
    onClose();
  };
  // zIndex 55: alt gezinme çubuğunun (index.html > .k-bottom-nav, 50) ÜSTÜNDE, durum çubuğu şeridinin
  // (60) altında — önceden ikisi de 50'ydi, DOM'da sonra gelen alt çubuk uzun modalların alt kısmını
  // (kaydet düğmesinin yarısını) örtüyordu. Dolgu güvenli alanları da kapsar (çentik / home indicator).
  // Telefonda alttan açılan sayfa düzeni index.html > .k-modal-backdrop/.k-modal-panel'de.
  // createPortal(document.body): pencere, onu açan ekranın DOM'unun içinde değil gövdenin en üstünde
  // render edilir — bir üst öğe kendi yığın bağlamını (stacking context) oluşturduğunda (animasyon,
  // transform, opacity) z-index'i o bağlamla sınırlı kalıp alt menünün ALTINDA kalmasın diye.
  return createPortal(
    <div className="k-modal-backdrop" role="presentation" style={{ position: "fixed", inset: 0, background: "rgba(10,12,28,0.55)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 55, padding: "max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))" }} onClick={handleBackdropClick}>
      <div className="k-modal-panel" role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined} onClick={(e) => e.stopPropagation()} style={{ background: C.surface, borderRadius: C.radiusLg, padding: 24, width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto", boxShadow: C.shadowLg }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <span style={{ fontFamily: displayFont, fontSize: 18, fontWeight: 800, color: C.text, minWidth: 0 }}>{title}</span>
          <button className="k-icon-btn" onClick={onClose} aria-label="Kapat" style={{ background: C.surface2, border: "none", borderRadius: 999, width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <X size={17} color={C.text} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
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
                <span className="k-sidebar-badge" style={{
                  marginLeft: "auto", background: C.sidebarAccent, color: "#fff", fontSize: 10.5, fontWeight: 800,
                  borderRadius: 999, minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px",
                }}>{t.badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="k-sidebar-user" style={{ borderTop: `1px solid ${C.sidebarBorder}`, padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
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

// Telefon genişliğinde (bkz. index.html > @media max-width:640px) kenar çubuğunun yerini alan alt
// menü — 68px, beyaz, üstte 1px kenarlık. Aktif sekmenin ikonu arkasında 46×26 mor hap. Görünürlüğü
// CSS medya sorgusu belirler; burada her zaman render edilir.
export function BottomNav({ tabs, activeId, onSelect }) {
  return (
    <nav className="k-bottom-nav" aria-label="Ana menü" style={{
      display: "none", background: C.surface, borderTop: `1px solid ${C.border}`,
      minHeight: 68, boxSizing: "border-box", padding: "7px 4px calc(env(safe-area-inset-bottom, 0px) + 7px)",
    }}>
      {tabs.map((t) => {
        const active = t.id === activeId;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            aria-label={t.label}
            aria-current={active ? "page" : undefined}
            style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
              background: "none", border: "none", cursor: "pointer", padding: "2px", position: "relative",
              color: active ? C.accent : C.mutedLight, minWidth: 0,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 46, height: 26, borderRadius: 9, background: active ? C.accentSoft : "transparent", position: "relative" }}>
              {Icon && <Icon size={18} strokeWidth={2} />}
              {t.badge > 0 && (
                <span style={{
                  position: "absolute", top: -3, right: 4, background: C.red, color: "#fff", fontSize: 9.5, fontWeight: 800,
                  borderRadius: 999, minWidth: 15, height: 15, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px",
                }}>{t.badge}</span>
              )}
            </span>
            <span style={{ fontFamily: bodyFont, fontSize: 9.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// Başlıktaki kare ikon düğmesi (geri, bildirim zili) — 44×44, köşe 14, beyaz zemin, ince kenarlık.
export function HeaderIconButton({ icon: Icon, label, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="k-icon-btn"
      style={{
        position: "relative", width: 44, height: 44, borderRadius: 14, flexShrink: 0,
        background: C.surface, border: `1px solid ${C.border}`, boxShadow: C.shadowSm,
        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.text2,
      }}
    >
      <Icon size={19} strokeWidth={2} />
      {children}
    </button>
  );
}

// Başlıktaki metinli düğme (ör. "Rapor", "Notlar", "PDF") — ikon düğmeleriyle aynı yükseklik.
export function HeaderTextButton({ icon: Icon, label, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className="k-icon-btn"
      style={{
        height: 44, padding: "0 16px", borderRadius: 14, flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 7,
        background: C.surface, border: `1px solid ${C.border}`, boxShadow: C.shadowSm, cursor: disabled ? "default" : "pointer",
        fontFamily: bodyFont, fontSize: 14, fontWeight: 700, color: C.text2, opacity: disabled ? 0.5 : 1,
      }}
    >
      {Icon && <Icon size={16} strokeWidth={2.2} />}
      {label}
    </button>
  );
}

// Başlığın sağındaki, ekranların kendi düğmelerini createPortal ile koyduğu yuvanın id'si (bkz. App.jsx).
export const HEADER_SLOT_ID = "k-header-slot";

// İçerik sütununun üst şeridi — sayfa zemininde (ayrı beyaz bir çubuk değil), ekran başlığı 22/700.
// onBack verilirse başlığın solunda geri düğmesi. Sol taraf flex:1+minWidth:0 ile küçülür — sağdaki
// düğmeler (zil, Rapor/Notlar, PDF) her zaman sağ üstte sabit kalır.
export function PageHeader({ title, subtitle, right, onBack }) {
  return (
    <div className="k-page-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "20px 28px 12px", background: C.bg }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12 }}>
        {onBack && <HeaderIconButton icon={ChevronLeft} label="Geri" onClick={onBack} />}
        <div style={{ minWidth: 0 }}>
          <h1 className="k-page-title" style={{ margin: 0, fontFamily: displayFont, fontSize: 22, fontWeight: 700, letterSpacing: -0.5, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</h1>
          {subtitle && <div className="k-page-subtitle" style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.muted, marginTop: 2 }}>{subtitle}</div>}
        </div>
      </div>
      {right && <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>{right}</div>}
    </div>
  );
}

// Kutucuk (sayı + etiket): zemin durumun açık tonu, sayı mono 21/700 durumun koyu tonunda, etiket
// 10.5/600 aynı renkte. onClick verilirse <button> (altındaki listeyi filtreler); active = seçili filtre,
// kenarlık tonun güçlü rengine döner. Bir ekranda en fazla 4 kutucuk (doküman: "YAPMA").
export function StatCard({ label, value, tone = "muted", onClick, active }) {
  const strong = { muted: C.muted, accent: C.accent, green: C.green, amber: C.amber, red: C.red, blue: C.blue };
  const soft = { muted: C.surface2, accent: C.accentSoft, green: C.greenSoft, amber: C.amberSoft, red: C.redSoft, blue: C.blueSoft };
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-pressed={onClick ? !!active : undefined}
      style={{
        background: soft[tone], border: `1.5px solid ${active ? strong[tone] : "transparent"}`,
        borderRadius: C.radiusMd, padding: "11px 12px", minWidth: 0,
        textAlign: "left", cursor: onClick ? "pointer" : "default", fontFamily: "inherit",
      }}
    >
      <div style={{ fontFamily: monoFont, fontSize: 21, fontWeight: 700, letterSpacing: -0.6, color: strong[tone], lineHeight: 1.15 }}>{value}</div>
      <div style={{ fontFamily: bodyFont, fontSize: 10.5, fontWeight: 600, color: strong[tone], marginTop: 3, lineHeight: 1.25 }}>{label}</div>
    </Comp>
  );
}

// Kutucuk ızgarası — min: bir kutucuğun asgari genişliği (telefonda ~90 → 3 sütun).
export function StatGrid({ children, min = 90, style }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 10, marginBottom: 6, ...style }}>
      {children}
    </div>
  );
}

// Bölüm başlığı: 14.5/700, sağda adet rozeti (tone) ya da bir bağlantı (action: { label, onClick }).
export function SectionHeader({ title, count, tone = "muted", action, style }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 22, margin: "22px 0 10px", ...style }}>
      <h2 style={{ margin: 0, fontFamily: displayFont, fontSize: 14.5, fontWeight: 700, letterSpacing: -0.1, color: C.text2 }}>{title}</h2>
      {action ? (
        <button type="button" onClick={action.onClick} className="k-link-btn" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: bodyFont, fontSize: 12, fontWeight: 700, color: C.accent }}>{action.label}</button>
      ) : count != null ? (
        <Pill tone={tone} mono>{count}</Pill>
      ) : null}
    </div>
  );
}

// Filtre çipi: 34px, köşe 11 — aktif mor dolu, pasif beyaz + kenarlık.
export function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={!!active}
      className="k-btn"
      style={{
        height: 34, padding: "0 14px", borderRadius: 11, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
        fontFamily: bodyFont, fontSize: 12.5, fontWeight: active ? 700 : 600,
        background: active ? C.accent : C.surface, color: active ? C.onAccent : C.text2,
        border: active ? `1px solid ${C.accent}` : `1px solid ${C.border}`,
      }}
    >
      {children}
    </button>
  );
}

// İnce ilerleme çubuğu (tamamlama yüzdesi, ders başarısı) — value 0-100, null ise boş.
export function ProgressBar({ value, color, width = "100%", height = 5 }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div style={{ width, height, borderRadius: 3, background: C.surface2, overflow: "hidden", flexShrink: 0 }}>
      <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: color || C.accent }} />
    </div>
  );
}

// Ders ikonu — mevcut sistemdeki ders ikonları (assets/subject-icons/*.svg, kendi renkli zeminli).
// Ölçüler: satırlarda 40/12, rapor kartlarında 34/11, ödev başlığında 44/13.
export function SubjectIcon({ src, size = 40, radius = 12 }) {
  return <img src={src} alt="" width={size} height={size} style={{ width: size, height: size, borderRadius: radius, flexShrink: 0, display: "block" }} />;
}

// Ödev satırı (öğrenci Ödevlerim + koç Öğrenci özeti): 72px, solda 3px durum şeridi, ders ikonu,
// tek satırlık başlık, altında durum rozeti + soluk meta metni, sağda ok.
// status: "overdue" | "pending" | "done" | "draft"
export function AssignmentRow({ iconSrc, title, status, badge, meta, onClick }) {
  const stripe = { overdue: "red", pending: "amber", done: "green" }[status];
  return (
    <Card hover={!!onClick} status={stripe} onClick={onClick} style={{ padding: 0, cursor: onClick ? "pointer" : "default" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 72, padding: "0 13px 0 16px" }}>
        <SubjectIcon src={iconSrc} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: bodyFont, fontSize: 14, fontWeight: 700, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5, minWidth: 0 }}>
            {badge}
            {meta && <span style={{ fontFamily: bodyFont, fontSize: 11.5, fontWeight: 500, color: C.mutedLight, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meta}</span>}
          </div>
        </div>
        {onClick && <ChevronRight size={16} color={C.faintest} style={{ flexShrink: 0 }} />}
      </div>
    </Card>
  );
}

// Boş durum: ikon (varsa) yumuşak bir daire içinde, altında açıklama ve isteğe bağlı bir eylem düğmesi —
// kullanıcı "burada ne yapabilirim?" sorusuna cevap bulsun diye.
// compact: bölüm içi kısa mesajlar (ör. "Geciken ödevi yok.") — büyük boşluk bırakmadan tek satır.
export function EmptyState({ text, icon: Icon, action, compact = false }) {
  if (compact) {
    return <div style={{ padding: "10px 2px", color: C.mutedLight, fontFamily: bodyFont, fontSize: 13, fontWeight: 500 }}>{text}</div>;
  }
  return (
    <div style={{ padding: "36px 16px", textAlign: "center", color: C.muted, fontFamily: bodyFont, fontSize: 13.5, lineHeight: 1.5 }}>
      {Icon && (
        <div style={{ width: 52, height: 52, borderRadius: 999, background: C.surface2, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
          <Icon size={24} color={C.mutedLight} />
        </div>
      )}
      <div style={{ maxWidth: 320, margin: "0 auto" }}>{text}</div>
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

// "Yükleniyor..." yazısı yerine içeriğin şeklini taşıyan iskelet kartlar — sayfa boş/donmuş gibi
// görünmesin, içerik gelince yerleşim zıplamasın diye.
function SkeletonBar({ width = "100%", height = 12, style }) {
  return (
    <div
      className="k-skeleton"
      style={{ width, height, borderRadius: 6, background: `linear-gradient(90deg, ${C.surface2} 25%, ${C.surfaceHover} 37%, ${C.surface2} 63%)`, ...style }}
    />
  );
}
export function LoadingState({ rows = 3 }) {
  return (
    <div aria-busy="true" aria-label="Yükleniyor" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {Array.from({ length: rows }, (_, i) => (
        <Card key={i} stripe={false} style={{ padding: 16 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <SkeletonBar width={36} height={36} style={{ borderRadius: 10, flexShrink: 0 }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              <SkeletonBar width={`${70 - i * 12}%`} height={13} />
              <SkeletonBar width="40%" height={10} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// --- Uygulama içi onay/uyarı penceresi ---
// window.confirm/alert WKWebView'da başlığında sayfa adresini ("localhost") gösteren gri sistem
// kutusu açıyordu — uygulamaya ait değilmiş gibi duruyordu. confirmDialog aynı kullanım kolaylığında
// (await ile true/false) uygulamanın kendi Modal'ını açar. DialogHost App.jsx'te bir kez render edilir;
// host yoksa (ör. testler) tarayıcının kendi confirm'üne düşülür.
let dialogListener = null;
export function confirmDialog({ title = "Emin misin?", message, confirmLabel = "Onayla", cancelLabel = "Vazgeç", danger = false } = {}) {
  return new Promise((resolve) => {
    if (!dialogListener) { resolve(window.confirm(message || title)); return; }
    dialogListener({ title, message, confirmLabel, cancelLabel, danger, resolve });
  });
}
export function alertDialog({ title = "Bilgi", message, confirmLabel = "Tamam" } = {}) {
  return new Promise((resolve) => {
    if (!dialogListener) { window.alert(message || title); resolve(true); return; }
    dialogListener({ title, message, confirmLabel, alertOnly: true, resolve });
  });
}
export function DialogHost() {
  const [dialog, setDialog] = useState(null);
  useEffect(() => {
    dialogListener = (next) => setDialog((prev) => { prev?.resolve(false); return next; });
    return () => { dialogListener = null; };
  }, []);
  if (!dialog) return null;
  const close = (value) => { dialog.resolve(value); setDialog(null); };
  return (
    <Modal title={dialog.title} onClose={() => close(false)}>
      {dialog.message && <div style={{ fontFamily: bodyFont, fontSize: 14, color: C.text, lineHeight: 1.55, marginBottom: 20, whiteSpace: "pre-wrap" }}>{dialog.message}</div>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap-reverse" }}>
        {!dialog.alertOnly && <Button variant="secondary" onClick={() => close(false)}>{dialog.cancelLabel}</Button>}
        <Button variant={dialog.danger ? "dangerSolid" : "primary"} onClick={() => close(true)}>{dialog.confirmLabel}</Button>
      </div>
    </Modal>
  );
}

// Sayfalanmış listelerin altındaki "N tane daha" düğmesi — 40px, çerçeveli, mor yazı; kalan yoksa render edilmez.

export function ShowMoreButton({ remaining, onClick }) {
  if (remaining <= 0) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="k-btn"
      style={{
        width: "100%", height: 40, marginTop: 10, borderRadius: 12, cursor: "pointer",
        background: C.surface, border: `1px solid ${C.border}`, color: C.accent,
        fontFamily: bodyFont, fontSize: 13.5, fontWeight: 700,
      }}
    >
      {remaining} tane daha
    </button>
  );
}
