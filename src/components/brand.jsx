// Mor/lime temalı ekranların ("Gönderdiğim ödevler" listesi ve "Ödev detayı") ortak parçaları.
// Renklerin hepsi theme.js'teki brand/lime/ink token'larından.
import { Bell } from "lucide-react";
import { C, bodyFont } from "../theme.js";
import { HeaderIconButton, Pill } from "./common.jsx";

// Bu ekranlarda sayılar da Outfit — hizalı dursunlar diye eşit genişlikli rakamlar.
export const NUM = { fontFamily: bodyFont, fontVariantNumeric: "tabular-nums" };

// Mor üst alan. Altındaki OverlapCard üstüne binsin diye alt dolgusu geniş (compact: yalnızca başlık).
export function HeroHeader({ children, compact }) {
  return (
    <div style={{ position: "relative", overflow: "hidden", background: C.brand, borderRadius: "0 0 32px 32px", padding: `20px 16px ${compact ? 24 : 68}px` }}>
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

// Eşit genişlikte parçalı filtre. Parçalar 44px (dokunma alanı alt sınırı).
export function SegmentFilter({ label, options, value, onChange, style }) {
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
              flex: 1, minWidth: 0, minHeight: 44, borderRadius: 12, border: "none", cursor: "pointer",
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
              background: on ? C.brand : "transparent", color: on ? C.onBrand : C.inkText,
              fontFamily: bodyFont, fontSize: 14, fontWeight: on ? 700 : 600,
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
