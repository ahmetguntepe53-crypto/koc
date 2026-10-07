import { Component, useEffect, useId, useRef, useState } from "react";
import { avatarSrc } from "../avatars.js";
import { createPortal } from "react-dom";
import { X, LogOut, ChevronLeft, ChevronRight, Minus, Plus, AlertTriangle } from "lucide-react";
import { C, displayFont, bodyFont, monoFont, statusTone, STATUS_LABEL } from "../theme.js";
import { subjectGlyphUrl } from "../subjects.js";

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

// Kart: --k1 zemin, 1px --bd kenarlık, gölge yok (derinlik kenarlıktan). Tepesinde ya da yanında renkli
// şerit YOK — her yerde olan vurgu hiçbir yeri vurgulamaz; durum, satırdaki durum karesiyle anlatılır.
// `status`/`stripe` eski çağrılarla uyumluluk için kabul edilip yok sayılır.
// eslint-disable-next-line no-unused-vars
export function Card({ children, style, hover, onClick, status, stripe }) {
  // Tıklanabilir kart klavyeyle de kullanılabilsin (Tab ile odak, Enter/Boşluk ile aç).
  const interactive = onClick ? {
    role: "button", tabIndex: 0,
    // Yalnızca kartın kendisi odaktayken — içindeki bir düğmede Enter'a basmak kartı da açmasın.
    onKeyDown: (e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onClick(e); } },
  } : {};
  return (
    <div
      onClick={onClick}
      {...interactive}
      className={hover ? "k-card-hover" : undefined}
      style={{
        position: "relative", background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 16, padding: 18,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Birincil düğme fildişi zemin + koyu yazı (vurgu rengi yok); ikincil kenarlıklı; yıkıcı işlem kırmızı.
export function Button({ children, onClick, variant = "primary", full, disabled, icon: Icon, small, type = "button", style }) {
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    fontFamily: bodyFont, fontWeight: 700, letterSpacing: -0.2, borderRadius: small ? 11 : 14, cursor: disabled ? "not-allowed" : "pointer",
    border: "1px solid transparent", padding: small ? "0 14px" : "0 20px", minHeight: small ? 36 : full ? 52 : 46, fontSize: small ? 13 : 15.5,
    width: full ? "100%" : "auto", opacity: disabled ? 0.45 : 1, whiteSpace: "nowrap",
  };
  const variants = {
    primary: { background: C.accent, color: C.onAccent },
    secondary: { background: "transparent", color: C.text, borderColor: C.borderStrong },
    ghost: { background: "transparent", color: C.text2 },
    danger: { background: C.redSoft, color: C.red, borderColor: `${C.red}55` },
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
    <div style={{ fontFamily: bodyFont, fontSize: 13.5, fontWeight: 600, color: C.muted, marginBottom: 8 }}>
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
    border: `1px solid ${C.border}`, borderRadius: 14, minHeight: 52,
    padding: "12px 16px", fontSize: 15.5, fontWeight: 500, fontFamily: bodyFont, color: C.text, outline: "none",
  };
}

export function Input({ label, error, style, ...props }) {
  // type="date"/"time" gibi yerli seçici açan alanlarda tarayıcı yalnızca küçük takvim ikonuna
  // tıklanınca seçiciyi açar; metin kısmına (ör. "gg.aa.yyyy") dokunmak çoğu WebView'de hiçbir şey
  // yapmaz — kullanıcı "tarihe de dokununca açılsın" dedi. showPicker() alanın HERHANGİ bir yerine
  // dokununca seçiciyi açar; desteklemeyen eski bir tarayıcıda sessizce yok sayılır, ikon yine çalışır.
  const opensPicker = props.type === "date" || props.type === "time" || props.type === "datetime-local";
  const onClick = opensPicker
    ? (e) => { props.onClick?.(e); try { e.currentTarget.showPicker?.(); } catch (_) { /* desteklenmiyorsa ikon yine çalışır */ } }
    : props.onClick;
  return (
    <label style={{ display: "block", marginBottom: 16 }}>
      <FieldLabel>{label}</FieldLabel>
      <input
        {...props}
        onClick={onClick}
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
// round: 24px, tam yuvarlak, 12/700 (bkz. brand.jsx > StatusChip).
export function Pill({ children, tone = "muted", mono = false, round = false }) {
  const tones = {
    muted: { bg: C.surface2, color: C.mutedLight },
    accent: { bg: C.surface2, color: C.text },
    koc: { bg: C.kocSoft, color: C.koc },
    green: { bg: C.greenSoft, color: C.green },
    amber: { bg: C.amberSoft, color: C.amber },
    red: { bg: C.redSoft, color: C.red },
    blue: { bg: C.blueSoft, color: C.blue },
    success: { bg: C.successTint, color: C.successText },
    warning: { bg: C.warningTint, color: C.warningText },
    danger: { bg: C.danger, color: C.onBrand },
    lime: { bg: C.lime, color: C.ink },
    onBrand: { bg: C.onBrandSoft, color: C.onBrand },
    brand: { bg: C.brandTint, color: C.brandText },
    track: { bg: C.track, color: C.inkText },
  };
  const t = tones[tone] || tones.muted;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4, height: round ? 24 : 22, boxSizing: "border-box",
      background: t.bg, color: t.color, fontFamily: mono ? monoFont : bodyFont, fontSize: round ? 12 : mono ? 11 : 11.5, fontWeight: 700,
      padding: round ? "0 10px" : "0 8px", borderRadius: round ? 999 : 7, whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}

// Baş harfli yuvarlak avatar — nötr (--k3 zemin, --t2 harf): renkli avatarlar marka rengi gibi
// davranıp durum renkleriyle yarışıyordu. Fotoğraf yükleme desteklenmiyor (MVP kapsamı dışı).
function initialsOf(name) {
  return (name || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toLocaleUpperCase("tr-TR") || "").join("") || "?";
}
// tint: kare-yuvarlak, isme göre sabit DOLU renk (aynı öğrenci hep aynı renk) + beyaz ad/soyad baş
// harfleri — aynı listedeki öğrencileri ayırt etmek için. Paletin dördü de beyazla en az 4.5:1.
function tintOf(name) {
  const palette = [C.avatar1, C.avatar2, C.avatar3, C.avatar4];
  let h = 0;
  for (const ch of name || "") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}
function firstLastInitials(name) {
  const parts = (name || "?").trim().split(/\s+/);
  const pick = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : [parts[0]];
  return pick.map((p) => p[0]?.toLocaleUpperCase("tr-TR") || "").join("") || "?";
}
// eslint-disable-next-line no-unused-vars
// lime: lime zemin + ink baş harfler (öğretmenin kendi avatarı, mor üst alanda).
// avatar: öğrencinin seçtiği hazır profil resmi kimliği (bkz. src/avatars.js); varsa baş harfler yerine o çizilir.
export function Avatar({ name, size = 36, dark, tint, lime, avatar }) {
  const src = avatarSrc(avatar);
  if (src) {
    return <img src={src} alt="" aria-hidden="true" width={size} height={size} style={{ width: size, height: size, borderRadius: 999, flexShrink: 0, display: "block" }} />;
  }
  const [bg, fg] = lime ? [C.lime, C.ink] : tint ? [tintOf(name), C.onBrand] : [C.surfaceHover, C.text2];
  tint = tint || lime;
  return (
    <div aria-hidden="true" style={{
      width: size, height: size, borderRadius: tint ? Math.round(size * 0.32) : 999, flexShrink: 0,
      background: bg, color: fg, border: tint ? "none" : `1px solid ${C.borderStrong}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: bodyFont, fontWeight: tint ? 800 : 600, fontSize: Math.round(size * 0.36), letterSpacing: 0.3,
    }}>
      {tint ? firstLastInitials(name) : initialsOf(name)}
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
    <div className="k-modal-backdrop" role="presentation" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.62)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 55, padding: "max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))" }} onClick={handleBackdropClick}>
      <div className="k-modal-panel" role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined} onClick={(e) => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: C.radiusLg, padding: 24, width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto", boxShadow: C.shadowLg }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <span style={{ fontFamily: displayFont, fontSize: 19, fontWeight: 700, letterSpacing: -0.5, color: C.text, minWidth: 0 }}>{title}</span>
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
  return { ADMIN: "Yönetici", TEACHER: "Koç / Öğretmen", STUDENT: "Öğrenci", PRINCIPAL: "Müdür" }[role] || role;
}

// Sol kenar çubuğu — koyu, sabit genişlikli, dar ekranlarda simge-yalnız moda düşer (bkz.
// index.html > .k-sidebar media query). Üstte marka, ortada rol'e göre gezinme sekmeleri, altta
// kullanıcı kartı + çıkış.
export function Sidebar({ user, tabs, activeId, onSelect, onLogout }) {
  return (
    <div className="k-sidebar" style={{
      width: 240, flexShrink: 0, background: C.sidebarBg, borderRight: `1px solid ${C.sidebarBorder}`, display: "flex", flexDirection: "column",
      height: "100vh", position: "sticky", top: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "22px 20px 18px" }}>
        <LogoMark width={38} />
        <div className="k-sidebar-brand-text" style={{ minWidth: 0 }}>
          <div style={{ fontFamily: displayFont, fontSize: 12.5, fontWeight: 700, color: C.sidebarTextActive, lineHeight: 1.3 }}>Mehmet Akif İnan Hafız</div>
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
                  marginLeft: "auto", background: C.red, color: C.onRed, fontSize: 10.5, fontWeight: 800,
                  borderRadius: 999, minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px",
                }}>{t.badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="k-sidebar-user" style={{ borderTop: `1px solid ${C.sidebarBorder}`, padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar name={user.name} size={34} dark avatar={user.avatar} />
        <div className="k-sidebar-user-text" style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: bodyFont, fontSize: 12.5, fontWeight: 700, color: C.sidebarTextActive, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</div>
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
// menü — 66px, --k1 zemin, üstte --ciz çizgisi. Simge (sidebar'la aynı t.icon) üstte, yazı altında;
// aktif sekme --t1 ve kalın, pasif --t3. Simgenin köşesindeki kırmızı nokta okunmamış sayısı (sidebar'daki
// rozetle aynı anlam, dar alana sığsın diye 9'dan büyükse "9+"). Görünürlüğü CSS medya sorgusu belirler;
// burada her zaman render edilir.
export function BottomNav({ tabs, activeId, onSelect }) {
  // 6 sekmede (müdür) yazılar sığsın: daha dar boşluk ve 10px yazı — yoksa "Öğrenciler" kesiliyordu.
  const dense = tabs.length >= 6;
  return (
    <nav className="k-bottom-nav" aria-label="Ana menü" style={{
      display: "none", background: C.ink, borderRadius: 26, padding: dense ? 6 : 8, gap: dense ? 2 : 4,
      boxSizing: "border-box", boxShadow: C.shadowNav,
    }}>
      {tabs.map((t) => {
        const active = t.id === activeId;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            aria-current={active ? "page" : undefined}
            style={{
              flex: 1, height: 52, borderRadius: 18, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
              border: "none", cursor: "pointer", padding: "0 2px", minWidth: 0,
              background: active ? C.lime : "transparent", color: active ? C.ink : C.navInactive,
            }}
          >
            <span style={{ position: "relative", display: "flex" }}>
              {Icon && <Icon size={20} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />}
              {t.badge > 0 && (
                <span aria-hidden="true" style={{
                  position: "absolute", top: -4, right: -8, background: C.danger, color: C.onBrand,
                  fontSize: 9.5, fontWeight: 800, lineHeight: 1, borderRadius: 999, minWidth: 15, height: 15,
                  display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px",
                  border: `1.5px solid ${C.ink}`, fontFamily: bodyFont,
                }}>{t.badge > 9 ? "9+" : t.badge}</span>
              )}
            </span>
            <span style={{ fontFamily: bodyFont, fontSize: dense ? 10 : 11, fontWeight: active ? 700 : 500, letterSpacing: dense ? -0.3 : -0.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
              {t.label}
            </span>
            {t.badge > 0 && <span className="k-sr-only">, {t.badge} okunmamış</span>}
          </button>
        );
      })}
    </nav>
  );
}

// Başlıktaki kare ikon düğmesi (geri, bildirim zili) — 44×44, köşe 14, beyaz zemin, ince kenarlık.
// onBrand: mor (brand) zemin üstünde — yarı saydam beyaz zemin, kenarlıksız, beyaz ikon.
export function HeaderIconButton({ icon: Icon, label, onClick, children, onBrand }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="k-icon-btn"
      style={{
        position: "relative", width: 44, height: 44, borderRadius: onBrand ? 14 : 13, flexShrink: 0,
        background: onBrand ? C.onBrandSoft : C.surface, border: onBrand ? "none" : `1px solid ${C.border}`,
        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: onBrand ? C.onBrand : C.text2,
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
        height: 44, padding: "0 12px", borderRadius: 13, flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 7,
        background: C.surface, border: `1px solid ${C.border}`, cursor: disabled ? "default" : "pointer",
        fontFamily: bodyFont, fontSize: 13.5, fontWeight: 700, color: C.text2, opacity: disabled ? 0.5 : 1,
      }}
    >
      {Icon && <Icon size={16} strokeWidth={2.2} />}
      {label}
    </button>
  );
}

// Başlığın sağındaki, ekranların kendi düğmelerini createPortal ile koyduğu yuvanın id'si (bkz. App.jsx).
export const HEADER_SLOT_ID = "k-header-slot";

// İçerik sütununun üst şeridi — sayfa zemininde. Üstte bağlam satırı (ör. "Zeynep Kaya · 12-A · Koçun:
// Ali Hoca", 13/--t3), altında sayfa başlığı 25/700/−0.9px. onBack verilirse solda geri düğmesi. Sol
// taraf flex:1+minWidth:0 ile küçülür — sağdaki düğmeler (zil, Rapor/Notlar, PDF) sağ üstte sabit.
// Mor üst alan (yeniden tasarlanan ekranlardaki HeroHeader'ın kompakt hali) — kendi başlığını çizmeyen
// her ekranda. Sağdaki düğmeler (zil, Rapor, PDF...) index.html > .k-brand-header kuralıyla mor zemine uyar.
export function PageHeader({ title, subtitle, right, onBack }) {
  return (
    <div className="k-page-header k-brand-header" style={{
      position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      padding: "20px 28px 24px", background: C.brand, borderRadius: "0 0 32px 32px", marginBottom: 8,
    }}>
      <span aria-hidden="true" style={{ position: "absolute", width: 220, height: 220, borderRadius: 999, background: C.decorWhite, top: -110, right: -70 }} />
      <div style={{ position: "relative", flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12 }}>
        {onBack && <HeaderIconButton onBrand icon={ChevronLeft} label="Geri" onClick={onBack} />}
        <div style={{ minWidth: 0 }}>
          {subtitle && <div className="k-page-subtitle" style={{ fontFamily: bodyFont, fontSize: 13, fontWeight: 500, color: C.onBrandMuted, marginBottom: 3, lineHeight: 1.35 }}>{subtitle}</div>}
          <h1 className="k-page-title" style={{ margin: 0, fontFamily: displayFont, fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.15, color: C.onBrand, overflowWrap: "anywhere" }}>{title}</h1>
        </div>
      </div>
      {right && <div style={{ position: "relative", flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>{right}</div>}
    </div>
  );
}

// Sayaç kutusu: --k1 kart, büyük mono sayı (renk yalnızca veri anlamı taşıyorsa: kırmızı geride,
// sarı pas, yeşil iyi; nötr --t1), altında --t3 etiket. onClick verilirse <button> (listeyi filtreler);
// active = seçili filtre. Bir ekranda en fazla 3-4 sayaç.
export function StatCard({ label, value, tone = "muted", onClick, active }) {
  const strong = { muted: C.text, accent: C.text, green: C.green, amber: C.amber, red: C.red, blue: C.text };
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-pressed={onClick ? !!active : undefined}
      style={{
        background: C.surface, border: `1px solid ${active ? C.borderStrong : C.border}`, boxShadow: active ? `inset 0 0 0 1px ${C.borderStrong}` : "none",
        borderRadius: 16, padding: "14px 15px 13px", minWidth: 0,
        textAlign: "left", cursor: onClick ? "pointer" : "default", fontFamily: "inherit",
      }}
    >
      <div style={{ fontFamily: monoFont, fontSize: 27, fontWeight: 700, letterSpacing: -1.1, color: strong[tone] || C.text, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontFamily: bodyFont, fontSize: 12.5, fontWeight: 500, color: C.mutedLight, marginTop: 5, lineHeight: 1.3 }}>{label}</div>
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

// Bölüm etiketi: 10.5/700/1.4px VERSAL --t3, yanında ince çizgi, sağda adet (mono) ya da kısa bilgi
// (right) ya da bir bağlantı (action: { label, onClick }). Etiket tek satır ve kısa tutulur.
// eslint-disable-next-line no-unused-vars
export function SectionHeader({ title, count, tone, action, right, style }) {
  const label = typeof title === "string" ? title.toLocaleUpperCase("tr-TR") : title;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 22, margin: "26px 0 10px", ...style }}>
      <h2 style={{ margin: 0, fontFamily: bodyFont, fontSize: 10.5, fontWeight: 700, letterSpacing: 1.4, color: C.mutedLight, whiteSpace: "nowrap" }}>{label}</h2>
      <span aria-hidden="true" style={{ flex: 1, height: 1, background: C.divider, minWidth: 12 }} />
      {action ? (
        <button type="button" onClick={action.onClick} className="k-link-btn" style={{ background: "none", border: "none", padding: "6px 0", cursor: "pointer", fontFamily: bodyFont, fontSize: 12.5, fontWeight: 600, color: C.text2 }}>{action.label}</button>
      ) : right != null ? (
        <span style={{ fontFamily: bodyFont, fontSize: 12, fontWeight: 500, color: C.mutedLight, whiteSpace: "nowrap" }}>{right}</span>
      ) : count != null ? (
        <span style={{ fontFamily: monoFont, fontSize: 12.5, fontWeight: 600, color: C.mutedLight }}>{count}</span>
      ) : null}
    </div>
  );
}

// Filtre çipi: 44px (dokunma alanı), köşe 12 — aktif fildişi dolu + koyu yazı, pasif --k1 + kenarlık.
// tone="amber": seçili pas sebebi gibi durum anlamı taşıyan seçim (sarı zemin).
export function Chip({ active, onClick, children, tone }) {
  const activeStyle = tone === "amber"
    ? { background: C.amberSoft, color: C.amber, border: `1px solid ${C.amber}55` }
    : { background: C.accent, color: C.onAccent, border: `1px solid ${C.accent}` };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={!!active}
      className="k-btn"
      style={{
        minHeight: 44, padding: "0 16px", borderRadius: 12, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
        fontFamily: bodyFont, fontSize: 14, fontWeight: active ? 700 : 500, letterSpacing: -0.1,
        ...(active ? activeStyle : { background: C.surface, color: C.text2, border: `1px solid ${C.border}` }),
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
      <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: color || C.text2 }} />
    </div>
  );
}

// Ders ikonu — mevcut sistemdeki ders ikonları (assets/subject-icons/*.svg, kendi renkli zeminli).
// Ölçüler: satırlarda 40/12, rapor kartlarında 34/11, ödev başlığında 44/13.
export function SubjectIcon({ src, size = 40, radius = 12 }) {
  return <img src={src} alt="" width={size} height={size} style={{ width: size, height: size, borderRadius: radius, flexShrink: 0, display: "block" }} />;
}

// Durum karesi: ders sembolü durum rengine boyanır — çözüldü yeşil, pas sarı, yapılmadı kırmızı,
// süresi dolmadı nötr. Renkli ders ikonları "her renk bir veri anlamı taşır" kuralını bozuyordu; sembol
// (assets/subject-glyphs) SVG maskesi olarak kullanılır, katmanları ve ince çizgileri korunur.
// plain: durumdan bağımsız beyaz kare, ders simgesi ana metin renginde.
export function StatusSquare({ subject, status = "open", size = 34, title, plain }) {
  const maskId = `sq${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const tone = plain ? { bg: C.surface, fg: C.inkText } : statusTone(status);
  const glyph = Math.round(size * 0.66);
  return (
    <span
      role="img"
      aria-label={title || `${subject}: ${STATUS_LABEL[status] || ""}`}
      style={{
        width: size, height: size, borderRadius: Math.round(size * 0.3), flexShrink: 0, boxSizing: "border-box",
        background: tone.bg, border: `1px solid ${tone.fg}44`,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <svg width={glyph} height={glyph} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
            <rect width="100" height="100" fill="black" />
            <image href={subjectGlyphUrl(subject)} width="100" height="100" />
          </mask>
        </defs>
        <rect width="100" height="100" fill={!plain && status === "open" ? C.mutedLight : tone.fg} mask={`url(#${maskId})`} />
      </svg>
    </span>
  );
}

// Tam genişlik liste satırı (ödev listesi, branş ödevleri, koç yükü...) — üstünde --ciz çizgisi, kart
// değil. left: durum karesi/avatar; right: sağ sütun (soru sayısı, net); onClick varsa sağda ok.
export function ListRow({ left, title, titleExtra, subtitle, right, onClick, strong }) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className="k-list-row"
      style={{
        display: "flex", alignItems: "center", gap: 14, width: "100%", minHeight: 64, boxSizing: "border-box",
        padding: "12px 0", background: "none", border: "none", borderTop: `1px solid ${C.divider}`,
        textAlign: "left", cursor: onClick ? "pointer" : "default", fontFamily: bodyFont, color: C.text,
      }}
    >
      {left}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 14.5, fontWeight: strong ? 700 : 600, letterSpacing: -0.2, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{title}</span>
          {titleExtra}
        </span>
        {subtitle && <span style={{ display: "block", fontSize: 12, fontWeight: 500, color: C.mutedLight, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{subtitle}</span>}
      </span>
      {right}
      {onClick && <ChevronRight size={17} color={C.faintest} style={{ flexShrink: 0 }} />}
    </Comp>
  );
}

// Liste satırlarının kabı — telefonda ekranın iki ucuna uzanır (index.html > .k-bleed), altta çizgi.
export function ListGroup({ children, style }) {
  return <div className="k-bleed" style={{ borderBottom: `1px solid ${C.divider}`, ...style }}>{children}</div>;
}

// Eski ödev satırı çağrıları için — yeni liste satırına bağlanır.
// eslint-disable-next-line no-unused-vars
export function AssignmentRow({ subject, iconSrc, title, status, badge, meta, onClick }) {
  const sq = { overdue: "missed", pending: "open", done: "done", skipped: "skipped" }[status] || "open";
  return (
    <ListRow
      left={<StatusSquare subject={subject} status={sq} />}
      title={title}
      subtitle={meta}
      right={badge}
      onClick={onClick}
    />
  );
}

// Çok parçalı ilerleme şeridi — 9px, parçalar arası 2px. parts: [{ value, color, label }], sıra
// çağıranın (şartname: çözüldü → gecikti → pas → kalan).
export function SegmentBar({ parts, height = 9, gap = 2, radius = 4 }) {
  const total = parts.reduce((sum, p) => sum + (p.value || 0), 0);
  const label = parts.map((p) => `${p.label} ${p.value}`).join(", ");
  if (!total) return <div role="img" aria-label={label} style={{ height, borderRadius: radius, background: C.surface2 }} />;
  return (
    <div role="img" aria-label={label} style={{ display: "flex", gap, height }}>
      {parts.filter((p) => p.value > 0).map((p) => (
        <span key={p.label} style={{ flex: p.value, background: p.color, borderRadius: radius, minWidth: 4 }} />
      ))}
    </div>
  );
}

// Lejant: 7px nokta (square: kare) + sayı (mono, isteğe bağlı) + 12px etiket, yatay, sarılabilir.
export function Legend({ items, square, style, numFont = monoFont, labelColor, valueColor, fontSize = 12.5 }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", columnGap: 16, rowGap: 6, ...style }}>
      {items.map((it) => (
        <span key={it.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: bodyFont, fontSize, color: labelColor || C.mutedLight }}>
          <span aria-hidden="true" style={{ width: square ? 9 : 7, height: square ? 9 : 7, borderRadius: square ? 2 : 999, background: it.color, flexShrink: 0 }} />
          {it.value != null && <span style={{ fontFamily: numFont, fontSize: fontSize + 0.5, fontWeight: 700, color: valueColor || C.text }}>{it.value}</span>}
          {it.label}
        </span>
      ))}
    </div>
  );
}

// Adımlayıcı: 44×44 eksi, ortada 22px mono sayı, 44×44 artı. Artı/eksi klavye AÇMAZ (şartname);
// basılı tutunca hızlanarak sayar. Haftalık ödevler 100+ soru olabildiği için ortadaki sayıya dokunup
// yazmak da mümkün — şartnamedeki "klavye yok" kuralı 150 kez artıya basmayı gerektirirdi.
export function Stepper({ label, value, onChange, dotColor, max = 9999 }) {
  const valueRef = useRef(value);
  valueRef.current = value;
  const timer = useRef(null);
  const stop = () => { clearTimeout(timer.current); timer.current = null; };
  useEffect(() => stop, []);
  const current = () => (valueRef.current === "" ? 0 : Number(valueRef.current) || 0);
  const bump = (delta) => {
    const next = Math.max(0, Math.min(max, current() + delta));
    onChange(String(next));
    valueRef.current = String(next);
  };
  const startHold = (delta) => {
    stop();
    bump(delta);
    let ticks = 0;
    const tick = () => {
      ticks += 1;
      bump(ticks > 20 ? delta * 5 : delta);
      timer.current = setTimeout(tick, ticks > 8 ? 55 : 110);
    };
    timer.current = setTimeout(tick, 420);
  };
  const n = current();
  const btn = (delta, Icon, aria, disabled) => (
    <button
      type="button" aria-label={aria} disabled={disabled}
      onPointerDown={(e) => { if (e.button === 0 || e.pointerType !== "mouse") { e.preventDefault(); startHold(delta); } }}
      onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); bump(delta); } }}
      className="k-icon-btn"
      style={{
        width: 44, height: 44, borderRadius: 12, flexShrink: 0, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1,
        background: C.surface, border: `1px solid ${C.borderStrong}`, color: C.text,
        display: "flex", alignItems: "center", justifyContent: "center", touchAction: "manipulation",
      }}
    >
      <Icon size={18} strokeWidth={2.2} />
    </button>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "12px 12px 12px 18px" }}>
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: dotColor, flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0, fontFamily: bodyFont, fontSize: 15.5, fontWeight: 600, color: C.text }}>{label}</span>
      {btn(-1, Minus, `${label} bir azalt`, n <= 0)}
      <input
        aria-label={label}
        inputMode="numeric" pattern="[0-9]*" enterKeyHint="done"
        value={value}
        placeholder="0"
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, String(max).length))}
        onFocus={(e) => e.target.select()}
        style={{ width: 64, minWidth: 0, textAlign: "center", background: "transparent", border: "none", outline: "none", fontFamily: monoFont, fontSize: 22, fontWeight: 700, color: C.text, padding: "6px 0" }}
      />
      {btn(1, Plus, `${label} bir artır`, n >= max)}
    </div>
  );
}

// Kaynak etiketi — koç ödevinde mor "koçundan"; variant="okul": branş ödevi (yalnızca ödev detayında,
// listede gösterilmez — varsayılan zaten okul).
export function SourceTag({ variant = "koc" }) {
  const koc = variant === "koc";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", height: 20, padding: "0 7px", borderRadius: 6, flexShrink: 0, boxSizing: "border-box",
      background: koc ? C.kocSoft : C.surface2, color: koc ? C.koc : C.mutedLight, border: `1px solid ${koc ? `${C.koc}44` : C.border}`,
      fontFamily: bodyFont, fontSize: 11, fontWeight: 700, letterSpacing: 0.2, whiteSpace: "nowrap",
    }}>
      {koc ? "koçundan" : "okul"}
    </span>
  );
}

// Uyarı kutusu — kırmızı (gecikme, düşüş, teşhis), sarı ya da nötr (açıklama). Tek satırlık bilgi.
export function AlertBox({ tone = "red", title, children, icon = true, style }) {
  const t = { red: { fg: C.red, bg: C.redSoft }, amber: { fg: C.amber, bg: C.amberSoft }, neutral: { fg: C.text2, bg: C.surface } }[tone];
  const border = tone === "neutral" ? C.border : `${t.fg}44`;
  return (
    <div role={tone === "neutral" ? undefined : "status"} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "14px 16px", borderRadius: 16, background: t.bg, border: `1px solid ${border}`, color: t.fg, fontFamily: bodyFont, fontSize: 13.5, lineHeight: 1.5, ...style }}>
      {icon && tone !== "neutral" && <AlertTriangle size={16} strokeWidth={2.2} style={{ flexShrink: 0, marginTop: 2 }} />}
      <div style={{ minWidth: 0 }}>
        {title && <div style={{ fontWeight: 700, marginBottom: children ? 4 : 0 }}>{title}</div>}
        {children && <div style={{ color: tone === "neutral" ? C.text2 : undefined }}>{children}</div>}
      </div>
    </div>
  );
}

// Küçük çubuk serisi (haftalık net, 6 hafta) — values: sayı ya da null (veri yok), colorFor(v, i).
export function MiniBars({ values, height = 34, barWidth = 7, gap = 4, colorFor }) {
  const nums = values.filter((v) => v != null);
  const max = Math.max(1e-9, ...nums.map((v) => Math.abs(v)));
  return (
    <div aria-hidden="true" style={{ display: "flex", alignItems: "flex-end", gap, height, flexShrink: 0 }}>
      {values.map((v, i) => (
        <span key={i} style={{
          width: barWidth, borderRadius: 2,
          height: v == null ? 3 : Math.max(4, Math.round((Math.abs(v) / max) * height)),
          background: v == null ? C.surface2 : colorFor ? colorFor(v, i) : C.text2,
        }} />
      ))}
    </div>
  );
}

// Alt sabit eylem çubuğu: birincil (ve ikincil) düğme + altında ne yapıldığını özetleyen 11.5px cümle.
// Telefonda alt menünün hemen üstünde sabit, masaüstünde sayfanın altına yapışık (index.html > .k-sticky-action).
export function BottomActionBar({ children, caption }) {
  return (
    <div className="k-sticky-action" style={{ background: C.surface, borderTop: `1px solid ${C.divider}`, padding: "13px 18px 19px", marginTop: 24 }}>
      <div style={{ display: "flex", gap: 10 }}>{children}</div>
      {caption && <div style={{ textAlign: "center", fontFamily: bodyFont, fontSize: 11.5, fontWeight: 500, color: C.mutedLight, marginTop: 9, lineHeight: 1.4 }}>{caption}</div>}
    </div>
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

// Sayfalanmış listelerin altındaki "N tane daha" düğmesi — 44px, çerçeveli; kalan yoksa render edilmez.

export function ShowMoreButton({ remaining, onClick }) {
  if (remaining <= 0) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="k-btn"
      style={{
        width: "100%", height: 44, marginTop: 10, borderRadius: 12, cursor: "pointer",
        background: C.surface, border: `1px solid ${C.border}`, color: C.text2,
        fontFamily: bodyFont, fontSize: 13.5, fontWeight: 700,
      }}
    >
      {remaining} tane daha
    </button>
  );
}
