// Mor/lime temalı ekranların ("Gönderdiğim ödevler" listesi ve "Ödev detayı") ortak parçaları.
// Renklerin hepsi theme.js'teki brand/lime/ink token'larından.
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { C, bodyFont, displayFont } from "../theme.js";
import { HeaderIconButton, Pill } from "./common.jsx";
import { topicsFor } from "../topics.js";

// Bu ekranlarda sayılar da Outfit — hizalı dursunlar diye eşit genişlikli rakamlar.
export const NUM = { fontFamily: bodyFont, fontVariantNumeric: "tabular-nums" };

// Mor üst alan. Altındaki OverlapCard üstüne binsin diye alt dolgusu geniş (compact: yalnızca başlık).
export function HeroHeader({ children, compact, padBottom }) {
  return (
    <div style={{ position: "relative", overflow: "hidden", background: C.brand, borderRadius: "0 0 32px 32px", padding: `20px 16px ${padBottom ?? (compact ? 24 : 68)}px` }}>
      <span aria-hidden="true" style={{ position: "absolute", width: 220, height: 220, borderRadius: 999, background: C.decorWhite, top: -80, right: -70 }} />
      <span aria-hidden="true" style={{ position: "absolute", width: 120, height: 120, borderRadius: 999, background: C.decorLime, bottom: -40, left: -36 }} />
      <div style={{ position: "relative", maxWidth: 728, margin: "0 auto" }}>{children}</div>
    </div>
  );
}

export function HeroBell({ unreadCount = 0, onClick }) {
  if (!onClick) return null;
  return (
    <HeaderIconButton onBrand icon={Bell} label={unreadCount > 0 ? `Bildirimler, ${unreadCount} okunmamış` : "Bildirimler"} onClick={onClick}>
      {unreadCount > 0 && (
        <span aria-hidden="true" style={{
          ...NUM, position: "absolute", top: -5, right: -5, background: C.lime, color: C.ink, fontSize: 10, fontWeight: 800,
          borderRadius: 999, minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px",
          boxShadow: `0 0 0 2px ${C.brand}`,
        }}>{unreadCount > 9 ? "9+" : unreadCount}</span>
      )}
    </HeaderIconButton>
  );
}

// HeroHeader'ın alt kenarına binen beyaz kart.
export function OverlapCard({ children, overlap = 48, style }) {
  return (
    <div style={{ position: "relative", marginTop: -overlap, background: C.surface, borderRadius: 24, padding: 16, boxShadow: C.shadowCard, ...style }}>
      {children}
    </div>
  );
}

// Eşit genişlikte parçalı filtre. Parçalar 44px (dokunma alanı alt sınırı). small: 12/700 yazı, dar parçalar (5 seçenek).
export function SegmentFilter({ label, options, value, onChange, style, small }) {
  return (
    <div role="group" aria-label={label} style={{ display: "flex", gap: 4, background: C.surface, borderRadius: 16, padding: 4, ...style }}>
      {options.map((o) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.id)}
            style={{
              flex: 1, minWidth: 0, minHeight: 44, borderRadius: 12, border: "none", cursor: "pointer", padding: small ? "0 2px" : "0 6px",
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, whiteSpace: "nowrap",
              background: on ? C.brand : "transparent", color: on ? C.onBrand : C.inkText,
              fontFamily: bodyFont, fontSize: small ? 12 : 14, fontWeight: small || on ? 700 : 600,
            }}
          >
            {o.label}
            {o.count != null && (
              <span style={{
                ...NUM, minWidth: 20, height: 20, padding: "0 6px", boxSizing: "border-box", borderRadius: 999,
                display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 700,
                background: on ? C.onBrandBadge : C.brandTint, color: on ? C.onBrand : C.brandText,
              }}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// 24px, tam yuvarlak durum çipi — Pill'in "round" hali. tone: brand, success, warning, danger, track, lime, onBrand.
export function StatusChip({ tone = "brand", children }) {
  return <Pill round tone={tone}>{children}</Pill>;
}

// Halka grafik, saat 12'den başlar, yuvarlak uçlu. value 0-1 (null: dolgu yok). showZero: 0'da da uç noktası görünsün.
export function ProgressRing({ size, stroke, value, color, track, label, showZero, children }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const v = value == null ? null : Math.max(0, Math.min(1, value));
  return (
    <div role="img" aria-label={label} style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)", display: "block" }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        {v != null && (v > 0 || showZero) && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${circ * v} ${circ}`} />
        )}
      </svg>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        {children}
      </div>
    </div>
  );
}

// Üst alandaki özet kutusu (beyaz %12 zemin; lime: öne çıkan kutu, ink yazı).
export function HeroStat({ label, value, lime }) {
  return (
    <div style={{ minWidth: 0, borderRadius: 16, padding: "12px 12px 10px", background: lime ? C.lime : C.onBrandBox, color: lime ? C.ink : C.onBrand }}>
      <div style={{ ...NUM, fontSize: 22, fontWeight: 800, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontFamily: bodyFont, fontSize: 12, fontWeight: lime ? 700 : 500, marginTop: 4 }}>{label}</div>
    </div>
  );
}

// Üst alandaki metinli düğme (ör. "Aylık rapor") — ikon düğmeleriyle aynı zemin ve yükseklik.
export function HeroTextButton({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="k-icon-btn"
      style={{
        height: 44, padding: "0 14px", borderRadius: 14, border: "none", flexShrink: 0, cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 7, background: C.onBrandSoft, color: C.onBrand,
        fontFamily: bodyFont, fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap",
      }}
    >
      {Icon && <Icon size={16} strokeWidth={2.2} aria-hidden="true" />}
      {label}
    </button>
  );
}

// Bölüm kartı: 32px renkli ikon karesi, başlık, sağda açıklama ve sayı rozeti (ya da serbest "right").
export function SectionCard({ icon: Icon, iconBg, iconFg, title, note, count, countTone = "track", right, children, style }) {
  const badge = countTone === "brand" ? { background: C.brand, color: C.onBrand } : { background: C.track, color: C.inkText };
  return (
    <section style={{ background: C.surface, borderRadius: 20, padding: 14, ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {Icon && (
          <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 10, background: iconBg, color: iconFg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon size={16} strokeWidth={2.3} />
          </span>
        )}
        <h2 style={{ flex: 1, minWidth: 0, margin: 0, fontFamily: displayFont, fontSize: 15, fontWeight: 800, color: C.inkText }}>{title}</h2>
        {note && <span style={{ fontFamily: bodyFont, fontSize: 12, color: C.inkMuted, whiteSpace: "nowrap" }}>{note}</span>}
        {count != null && (
          <span style={{ ...NUM, ...badge, minWidth: 24, height: 24, padding: "0 7px", boxSizing: "border-box", borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{count}</span>
        )}
        {right}
      </div>
      {children}
    </section>
  );
}

// Form alanları: 52px, radius 14, bg zemin, 1px çerçeve, 15/600; üstünde 12/700 etiket (görünür label).
export const fieldBox = (disabled) => ({
  width: "100%", minWidth: 0, boxSizing: "border-box", minHeight: 52, borderRadius: 14, padding: "0 14px",
  background: disabled ? C.track : C.pageTint, border: `1px solid ${C.brandOutline}`, color: C.inkText,
  fontFamily: bodyFont, fontSize: 15, fontWeight: 600, outline: "none", cursor: disabled ? "default" : "pointer",
});
export function FieldLabel({ htmlFor, children, required }) {
  return (
    <label htmlFor={htmlFor} style={{ display: "block", fontFamily: bodyFont, fontSize: 12, fontWeight: 700, color: C.inkMuted, marginBottom: 6 }}>
      {children}{required && <span aria-hidden="true" style={{ color: C.danger }}> *</span>}
    </label>
  );
}

const CUSTOM_TOPIC = "__custom__";
// Konu seçici: seçili sınav türü + dersin müfredat konuları, "listede yok" seçilirse serbest metin.
// Ders/sınav türü değişince listede olmayan seçim temizlenir (elle yazılmış metne dokunulmaz).
export function TopicSelect({ id, examType, subject, value, onChange }) {
  const topics = topicsFor(examType, subject);
  const [custom, setCustom] = useState(() => !!value && !topics.includes(value));
  useEffect(() => {
    if (!custom && value && !topics.includes(value)) onChange("");
  }, [examType, subject]); // eslint-disable-line react-hooks/exhaustive-deps
  if (topics.length === 0 || custom) {
    return <input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Konuyu yaz" autoFocus={custom} style={{ ...fieldBox(false), cursor: "text" }} />;
  }
  return (
    <select
      id={id} value={value} style={fieldBox(false)}
      onChange={(e) => { if (e.target.value === CUSTOM_TOPIC) { setCustom(true); onChange(""); } else onChange(e.target.value); }}
    >
      <option value="" disabled>Konu seç ({topics.length})</option>
      {topics.map((t, i) => <option key={t} value={t}>{i + 1}. {t}</option>)}
      <option value={CUSTOM_TOPIC}>Listede yok — kendim yazacağım</option>
    </select>
  );
}

// Ana eylem düğmesi: 56px, radius 18, mor zemin, beyaz 16/800. disabled değil aria-disabled — pasifken de
// dokunulabilir kalır (eksik alanı söyleyen metin altında), görünürlüğü 0.4.
export function PrimaryButton({ children, icon: Icon, inactive, type = "button", onClick, style }) {
  return (
    <button
      type={type}
      onClick={inactive ? (e) => e.preventDefault() : onClick}
      aria-disabled={inactive || undefined}
      style={{
        width: "100%", minHeight: 56, borderRadius: 18, border: "none", cursor: inactive ? "default" : "pointer",
        background: C.brand, color: C.onBrand, opacity: inactive ? 0.4 : 1,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: bodyFont, fontSize: 16, fontWeight: 800, ...style,
      }}
    >
      {children}
      {Icon && <Icon size={18} strokeWidth={2.4} aria-hidden="true" />}
    </button>
  );
}
