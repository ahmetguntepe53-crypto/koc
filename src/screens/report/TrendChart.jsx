import { useEffect, useRef, useState } from "react";
import { C, monoFont } from "../../theme.js";
import { fmtPct, fmtInt } from "../../reportModel.js";

// Kabın gerçek genişliği — viewBox buna eşitlenir, SVG ölçeklenmez ve yazılar her ekranda ~11px kalır.
// Deneme grafiği (DenemeChart.jsx) de aynı kancayı kullanır.
export function useElementWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

// Haftalık net oranı: arkada soluk haftalık soru çubukları, önde tek renk NO çizgisi. ΣQ < 20 olan hafta boş halka
// ve çizgide boşluk (sıfıra düşürülmez). Ders seçiliyse okul medyanı ince kesikli çizgi.
export default function TrendChart({ weeks }) {
  const [ref, W] = useElementWidth();
  return (
    <div ref={ref} style={{ width: "100%" }}>
      {W > 0 && <TrendSvg weeks={weeks} W={W} />}
    </div>
  );
}

function TrendSvg({ weeks, W }) {
  const H = 180, padL = 34, padR = 12, padT = 18, padB = 24;
  const iw = W - padL - padR, ih = H - padT - padB;
  const n = weeks.length;
  const x = (i) => padL + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const nums = weeks.map((w) => w.NO).filter((v) => v != null);
  const lo = Math.min(0, ...nums, ...weeks.map((w) => w.school).filter((v) => v != null));
  const hi = 100;
  const y = (v) => padT + ih - ((v - lo) / (hi - lo)) * ih;
  const maxQ = Math.max(1, ...weeks.map((w) => w.Q));
  const barW = Math.max(4, Math.min(18, iw / n - 6));
  const segs = [];
  let cur = [];
  weeks.forEach((w, i) => {
    if (w.NO == null) { if (cur.length) segs.push(cur); cur = []; } else cur.push(i);
  });
  if (cur.length) segs.push(cur);
  const school = weeks.map((w, i) => (w.school != null ? [x(i), y(w.school)] : null));
  const lastIdx = weeks.map((w) => w.NO != null).lastIndexOf(true);
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 44))));
  const ticks = [0, 50, 100].filter((t) => t >= lo);
  const summary = weeks.filter((w) => w.NO != null).map((w) => `${w.isoNo}. hafta ${fmtPct(w.NO)}`).join(", ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`Haftalık net oranı: ${summary || "veri yok"}`} style={{ display: "block" }}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={C.divider} strokeWidth="1" />
          <text x={padL - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10.5" fill={C.mutedLight} fontFamily={monoFont}>%{t}</text>
        </g>
      ))}
      {lo < 0 && <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} stroke={C.borderStrong} strokeDasharray="3,3" />}
      {weeks.map((w, i) => (
        <rect key={`b${w.week}`} x={x(i) - barW / 2} y={padT + ih - (w.Q / maxQ) * ih * 0.45} width={barW} height={(w.Q / maxQ) * ih * 0.45} rx="2" fill={C.surface2} />
      ))}
      {school.some(Boolean) && school.map((p, i) => {
        const next = school[i + 1];
        return p && next ? <line key={`s${i}`} x1={p[0]} y1={p[1]} x2={next[0]} y2={next[1]} stroke={C.mutedLight} strokeWidth="1.2" strokeDasharray="4,3" /> : null;
      })}
      {segs.map((s, k) => s.length > 1 && (
        <polyline key={`l${k}`} fill="none" stroke={C.text} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" points={s.map((i) => `${x(i)},${y(weeks[i].NO)}`).join(" ")} />
      ))}
      {weeks.map((w, i) => (
        <g key={`p${w.week}`}>
          {w.NO != null
            ? <circle cx={x(i)} cy={y(w.NO)} r="3.6" fill={C.surface} stroke={w.NO < 0 ? C.red : C.text} strokeWidth="2" />
            : w.Q > 0 ? <circle cx={x(i)} cy={padT + ih - 6} r="3" fill="none" stroke={C.faintest} strokeWidth="1.4" /> : null}
          {i % labelEvery === 0 && <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="10.5" fill={C.mutedLight} fontFamily={monoFont}>H{w.isoNo}</text>}
        </g>
      ))}
      {lastIdx >= 0 && (
        <text x={Math.min(x(lastIdx), W - padR - 2)} y={y(weeks[lastIdx].NO) - 9} textAnchor={lastIdx === n - 1 ? "end" : "middle"} fontSize="12" fontWeight="700" fill={C.text} fontFamily={monoFont}>
          {fmtPct(weeks[lastIdx].NO)}
        </text>
      )}
      <title>{`Arkadaki çubuklar haftalık soru sayısı (en çok ${fmtInt(maxQ)})`}</title>
    </svg>
  );
}
