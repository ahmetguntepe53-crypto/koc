import { C, monoFont } from "../../theme.js";
import { fmtNet, fmtDay } from "../../reportModel.js";
import { useElementWidth } from "./TrendChart.jsx";

// Deneme toplam neti grafiği — TrendChart'ın kardeşi, ama yüzde değil NET ölçeği: dikey eksen 0 … kitapçık toplamı
// (TYT 120; AYT'de girilen derslerin toplamı). Her deneme bir nokta; yatay eksende deneme sırası (tarihler düzensiz
// olduğu için eşit aralık), altında tarih. Tek renk çizgi; negatif net kırmızı halka; son denemenin neti yazılı.
export default function DenemeChart({ exams, scaleMax }) {
  const [ref, W] = useElementWidth();
  return (
    <div ref={ref} style={{ width: "100%" }}>
      {W > 0 && <ChartSvg exams={exams} scaleMax={scaleMax} W={W} />}
    </div>
  );
}

function niceTop(v) {
  if (v <= 10) return 10;
  const step = v > 60 ? 20 : 10;
  return Math.ceil(v / step) * step;
}

function ChartSvg({ exams, scaleMax, W }) {
  const H = 170, padL = 34, padR = 14, padT = 20, padB = 24;
  const iw = W - padL - padR, ih = H - padT - padB;
  const n = exams.length;
  const hi = niceTop(Math.max(scaleMax || 0, ...exams.map((e) => e.net)));
  const lo = Math.min(0, ...exams.map((e) => Math.floor(e.net)));
  const x = (i) => padL + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v) => padT + ih - ((v - lo) / (hi - lo)) * ih;
  const ticks = [0, hi / 2, hi];
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 48))));
  const summary = exams.map((e) => `${fmtDay(e.day)} ${fmtNet(e.net)} net`).join(", ");
  const last = exams[n - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`Deneme netleri: ${summary || "veri yok"}`} style={{ display: "block" }}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={C.divider} strokeWidth="1" />
          <text x={padL - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10.5" fill={C.mutedLight} fontFamily={monoFont}>{fmtNet(t)}</text>
        </g>
      ))}
      {lo < 0 && <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} stroke={C.borderStrong} strokeDasharray="3,3" />}
      {n > 1 && (
        <polyline fill="none" stroke={C.text} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round"
          points={exams.map((e, i) => `${x(i)},${y(e.net)}`).join(" ")} />
      )}
      {exams.map((e, i) => (
        <g key={e.id || i}>
          <circle cx={x(i)} cy={y(e.net)} r="3.8" fill={C.surface} stroke={e.net < 0 ? C.red : C.text} strokeWidth="2" />
          {i % labelEvery === 0 && <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="10.5" fill={C.mutedLight} fontFamily={monoFont}>{fmtDay(e.day)}</text>}
        </g>
      ))}
      {last && (
        <text x={Math.min(x(n - 1), W - padR - 2)} y={y(last.net) - 9} textAnchor={n > 1 ? "end" : "middle"} fontSize="12" fontWeight="700" fill={C.text} fontFamily={monoFont}>
          {fmtNet(last.net)}
        </text>
      )}
    </svg>
  );
}
