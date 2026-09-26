// Gelişim raporu ekranının küçük görsel parçaları — renk yalnızca veri anlamı taşır (yeşil iyi/doğru, kırmızı yanlış
// sayısı ve negatif net, amber odak/pas/uyarı, gerisi nötr) ve her renkli öğenin yanında metin ya da simge bulunur.
import { useState } from "react";
import { Info, ArrowUp, ArrowDown, ArrowRight } from "lucide-react";
import { C, bodyFont, monoFont } from "../../theme.js";
import { LABELS, TREND_LABEL, fmtPct, fmtSigned } from "../../reportModel.js";

export const mono = (size = 13, weight = 700, color) => ({ fontFamily: monoFont, fontSize: size, fontWeight: weight, color: color || C.text, fontVariantNumeric: "tabular-nums" });
export const text = (size = 13, weight = 500, color) => ({ fontFamily: bodyFont, fontSize: size, fontWeight: weight, color: color || C.text });

// Bölüm: başlık + (i) açıklaması (tek satır formül ve bir örnek). id, "Neden?" bağlantılarının kaydırma hedefi.
export function Section({ id, title, info, right, children, style }) {
  const [open, setOpen] = useState(false);
  return (
    <section id={id ? `rapor-${id}` : undefined} style={{ marginTop: 30, scrollMarginTop: 80, ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 28, marginBottom: 10 }}>
        <h2 style={{ margin: 0, ...text(10.5, 700, C.mutedLight), letterSpacing: 1.4, whiteSpace: "nowrap" }}>{title.toLocaleUpperCase("tr-TR")}</h2>
        {info && (
          <button type="button" aria-label={`${title}: nasıl hesaplanıyor?`} aria-expanded={open} onClick={() => setOpen((v) => !v)}
            style={{ background: "none", border: "none", padding: 8, margin: -6, cursor: "pointer", color: open ? C.text : C.mutedLight, display: "inline-flex" }}>
            <Info size={14} />
          </button>
        )}
        <span aria-hidden="true" style={{ flex: 1, height: 1, background: C.divider, minWidth: 12 }} />
        {right}
      </div>
      {open && info && (
        <div style={{ ...text(12.5, 500, C.text2), background: C.surface2, borderRadius: 12, padding: "10px 12px", marginBottom: 12, lineHeight: 1.5 }}>{info}</div>
      )}
      {children}
    </section>
  );
}

// Ders etiketi çipi — Güçlü yeşil, Yolunda nötr, Odak amber, Veri az kesikli gri. Asla kırmızı değil.
export function LabelChip({ label, from8w, small }) {
  const t = {
    strong: { fg: C.green, bg: C.greenSoft, bd: `${C.green}44` },
    ok: { fg: C.text2, bg: C.surface2, bd: C.border },
    focus: { fg: C.amber, bg: C.amberSoft, bd: `${C.amber}44` },
    few: { fg: C.mutedLight, bg: "transparent", bd: C.borderStrong },
  }[label] || { fg: C.mutedLight, bg: "transparent", bd: C.border };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", height: small ? 20 : 22, padding: "0 8px", borderRadius: 7, boxSizing: "border-box",
      background: t.bg, color: t.fg, border: `1px ${label === "few" ? "dashed" : "solid"} ${t.bd}`, ...text(small ? 11 : 11.5, 700, t.fg), whiteSpace: "nowrap", flexShrink: 0,
    }}>
      {LABELS[label]}{from8w ? " (8 hf)" : ""}
    </span>
  );
}

// Trend oku: Yükselişte yeşil ↑, Düşüşte amber ↓ (kırmızı değil), Sabit nötr →. student: öğrencide düşüş gösterilmez.
export function TrendMark({ trend, student, withLabel, size = 12 }) {
  if (!trend?.enough || !trend.dir) return null;
  if (student && trend.dir === "down") return null;
  const Icon = trend.dir === "up" ? ArrowUp : trend.dir === "down" ? ArrowDown : ArrowRight;
  const color = trend.dir === "up" ? C.green : trend.dir === "down" ? C.amber : C.mutedLight;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color, ...mono(size, 700, color), whiteSpace: "nowrap" }} title={TREND_LABEL[trend.dir]}>
      <Icon size={size + 1} strokeWidth={2.4} aria-hidden="true" />
      {withLabel ? `${TREND_LABEL[trend.dir]}${trend.dir !== "flat" ? ` · ${fmtSigned(trend.delta)} puan` : ""}` : trend.dir !== "flat" ? fmtSigned(trend.delta) : ""}
      <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{TREND_LABEL[trend.dir]}</span>
    </span>
  );
}

// Net oranı — büyük mono, negatifse kırmızı.
export function NoValue({ value, size = 20 }) {
  return <span style={{ ...mono(size, 700, value != null && value < 0 ? C.red : C.text), letterSpacing: -0.6, whiteSpace: "nowrap" }}>{fmtPct(value)}</span>;
}

// D/Y/B yığılmış ince çubuk (yeşil / kırmızı / gri).
export function DybBar({ D, Y, B, height = 6 }) {
  const tot = D + Y + B;
  if (!tot) return <div style={{ height, borderRadius: 3, background: C.surface2 }} />;
  const part = (v, color) => (v > 0 ? <span style={{ flex: v, background: color, minWidth: 2 }} /> : null);
  return (
    <div role="img" aria-label={`Doğru ${D}, yanlış ${Y}, boş ${B}`} style={{ display: "flex", gap: 1.5, height, borderRadius: 3, overflow: "hidden" }}>
      {part(D, C.green)}{part(Y, C.red)}{part(B, C.faintest)}
    </div>
  );
}

// 8 haftalık net oranı çizgisi — yalnız ΣQ ≥ 20 olan haftalar nokta; boş haftada çizgi kopar.
export function Sparkline({ points, width = 60, height = 22, color }) {
  const vals = points.map((p) => p.NO);
  const nums = vals.filter((v) => v != null);
  if (nums.length < 2) return <span aria-hidden="true" style={{ display: "inline-block", width, height }} />;
  const lo = Math.min(0, ...nums), hi = Math.max(100, ...nums);
  const x = (i) => (i / (vals.length - 1)) * (width - 4) + 2;
  const y = (v) => height - 2 - ((v - lo) / (hi - lo)) * (height - 4);
  const segs = [];
  let cur = [];
  vals.forEach((v, i) => {
    if (v == null) { if (cur.length) segs.push(cur); cur = []; } else cur.push([x(i), y(v)]);
  });
  if (cur.length) segs.push(cur);
  const stroke = color || C.text2;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" style={{ flexShrink: 0, display: "block" }}>
      {segs.map((s, i) => s.length > 1
        ? <polyline key={i} points={s.map((p) => p.join(",")).join(" ")} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
        : <circle key={i} cx={s[0][0]} cy={s[0][1]} r="1.6" fill={stroke} />)}
    </svg>
  );
}

// Tek satırlık mini değer (koçta İsabet, Boş, P̃ gibi).
export function Mini({ label, value, color }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4, whiteSpace: "nowrap" }}>
      <span style={text(11.5, 500, C.mutedLight)}>{label}</span>
      <span style={mono(12, 700, color || C.text2)}>{value}</span>
    </span>
  );
}

// Açılır/kapanır alt blok (varsayılan kapalı).
export function Collapsible({ title, count, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginTop: 12 }}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", minHeight: 44, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
        <span style={text(13.5, 700, C.text2)}>{title}</span>
        {count != null && <span style={mono(12, 600, C.mutedLight)}>{count}</span>}
        <span aria-hidden="true" style={{ marginLeft: "auto", ...text(13, 600, C.mutedLight) }}>{open ? "▾" : "▸"}</span>
      </button>
      {open && children}
    </div>
  );
}

// İnce ilerleme çubuğu; amber dilim (ör. pas) ayrı gösterilebilir.
export function GoalBar({ value, target, amber = 0, met }) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  const amberPct = target ? Math.min(pct, (amber / target) * 100) : 0;
  return (
    <div style={{ height: 5, borderRadius: 3, background: C.surface2, overflow: "hidden", display: "flex" }}>
      <span style={{ width: `${pct - amberPct}%`, background: met ? C.green : C.text2 }} />
      {amberPct > 0 && <span style={{ width: `${amberPct}%`, background: C.amber }} />}
    </div>
  );
}

export function SmallButton({ children, onClick, icon: Icon, tone }) {
  const color = tone === "amber" ? C.amber : C.text;
  return (
    <button type="button" onClick={onClick} className="k-btn"
      style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 36, padding: "0 12px", borderRadius: 11, cursor: "pointer",
        background: "transparent", border: `1px solid ${C.borderStrong}`, ...text(12.5, 700, color), whiteSpace: "nowrap", flexShrink: 0 }}>
      {Icon && <Icon size={14} />}
      {children}
    </button>
  );
}
