import { useEffect, useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { C, displayFont, bodyFont } from "../theme.js";
import { Card, Button, Pill, EmptyState, StatCard } from "../components/common.jsx";
import { api } from "../api.js";
import { formatDate } from "../dates.js";
import { downloadReportPdf } from "../reportPdf.js";

const GROUP_OPTIONS = [
  { value: "day", label: "Günlük" },
  { value: "week", label: "Haftalık" },
  { value: "month", label: "Aylık" },
];

function formatPeriodLabel(period, groupBy) {
  if (groupBy === "day") return formatDate(period);
  if (groupBy === "month") {
    const [year, month] = period.split("-");
    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
  }
  const [year, week] = period.split("-H");
  return `${Number(week)}. Hafta, ${year}`;
}

// Kısa eksen etiketi — tam formatPeriodLabel grafikte yer kaplar diye (ör. "14 Ağustos 2026" yerine "14 Ağu").
function shortPeriodLabel(period, groupBy) {
  if (groupBy === "day") {
    const [, month, day] = period.split("-");
    const months = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
    return `${Number(day)} ${months[Number(month) - 1]}`;
  }
  if (groupBy === "month") {
    const [year, month] = period.split("-");
    const months = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
    return `${months[Number(month) - 1]} '${year.slice(2)}`;
  }
  const [year, week] = period.split("-H");
  return `H${Number(week)}'${year.slice(2)}`;
}

// Ders/dönem satırlarında net değerini görsel olarak karşılaştırmak için basit bir çubuk —
// ayrı bir grafik kütüphanesi eklemeye gerek kalmasın diye düz div ile (genişlik = oran).
function NetBar({ net, maxNet }) {
  const pct = maxNet > 0 ? Math.max(4, Math.min(100, (Math.max(0, net) / maxNet) * 100)) : 0;
  return (
    <div style={{ height: 6, background: C.border, borderRadius: 999, overflow: "hidden", marginTop: 6 }}>
      <div style={{ height: "100%", width: `${pct}%`, background: net < 0 ? C.red : C.accent, borderRadius: 999 }} />
    </div>
  );
}

// Başarı oranı = doğru sayısının toplam soru sayısına (doğru+yanlış+boş) oranı.
function successRate(correctCount, wrongCount, blankCount) {
  const total = correctCount + wrongCount + blankCount;
  return total ? Math.round((correctCount / total) * 100) : null;
}

function rateTone(rate) {
  if (rate == null) return "muted";
  if (rate >= 70) return "green";
  if (rate >= 40) return "amber";
  return "red";
}

function ReportRow({ title, subtitle, correctCount, wrongCount, blankCount, net, maxNet, showRate }) {
  const rate = showRate ? successRate(correctCount, wrongCount, blankCount) : null;
  return (
    <Card style={{ padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: bodyFont, fontSize: 13.5, fontWeight: 700, color: C.text }}>{title}</div>
          {subtitle && <div style={{ fontFamily: bodyFont, fontSize: 11.5, color: C.muted, marginTop: 2 }}>{subtitle}</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Pill tone="green">D:{correctCount}</Pill>
          <Pill tone="red">Y:{wrongCount}</Pill>
          <Pill>B:{blankCount}</Pill>
          <Pill tone={net < 0 ? "red" : "accent"}>Net: {net}</Pill>
          {showRate && <Pill tone={rateTone(rate)}>Başarı: {rate != null ? `%${rate}` : "—"}</Pill>}
        </div>
      </div>
      <NetBar net={net} maxNet={maxNet} />
    </Card>
  );
}

// Zamana göre net trendini gösteren gerçek bir çizgi grafiği — ayrı bir grafik kütüphanesi
// eklemeden düz SVG ile (bu tek grafik ihtiyacı için ~100KB+'lık bir bağımlılık haklı değil).
function NetTrendChart({ points, groupBy }) {
  if (points.length === 0) return null;
  const W = 680, H = 200, padL = 34, padR = 16, padT = 16, padB = 30;
  const innerW = W - padL - padR, innerH = H - padT - padB;

  const nets = points.map((p) => p.net);
  let min = Math.min(0, ...nets), max = Math.max(0, ...nets);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.1;
  min -= pad; max += pad;

  const x = (i) => padL + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v) => padT + innerH - ((v - min) / (max - min)) * innerH;
  const zeroY = y(0);

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.net).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${x(points.length - 1).toFixed(1)} ${zeroY.toFixed(1)} L ${x(0).toFixed(1)} ${zeroY.toFixed(1)} Z`;

  // Çok fazla nokta varsa (uzun aralık) her etiketi değil, aralıklı olanları göster — üst üste binmesin.
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));

  return (
    <Card style={{ padding: "18px 14px 10px" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", overflow: "visible" }}>
        <line x1={padL} y1={zeroY} x2={W - padR} y2={zeroY} stroke={C.border} strokeWidth="1" strokeDasharray="3,3" />
        <path d={areaPath} fill={C.accent} opacity="0.08" />
        <path d={linePath} fill="none" stroke={C.accent} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={p.period}>
            <circle cx={x(i)} cy={y(p.net)} r="3.5" fill={C.surface} stroke={C.accent} strokeWidth="2.5" />
            {i % labelEvery === 0 && (
              <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill={C.mutedLight} fontFamily={bodyFont}>
                {shortPeriodLabel(p.period, groupBy)}
              </text>
            )}
          </g>
        ))}
        <text x={padL} y={12} fontSize="10" fill={C.mutedLight} fontFamily={bodyFont}>{Math.round(max)}</text>
        <text x={padL} y={H - padB + 4} fontSize="10" fill={C.mutedLight} fontFamily={bodyFont}>{Math.round(min)}</text>
      </svg>
    </Card>
  );
}

// Hem öğretmenin bir öğrencisinin özetinden hem de öğrencinin kendi profilinden açılan tek ekran —
// TEACHER'da studentId/studentName SABİT olarak dışarıdan verilir (o öğrencinin özetinden açıldığı
// için burada ayrıca bir öğrenci seçiciye gerek yok), STUDENT doğrudan kendi raporunu görür.
export default function ReportScreen({ user, studentId: fixedStudentId, studentName: fixedStudentName, onBack, backLabel = "Geri dön" }) {
  const isTeacher = user.role === "TEACHER";
  const studentId = isTeacher ? fixedStudentId : undefined;
  const studentName = isTeacher ? fixedStudentName : user.name;
  const [groupBy, setGroupBy] = useState("week");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const exportPdf = async () => {
    setExporting(true);
    try {
      await downloadReportPdf({ data, studentName: studentName || "Rapor", groupBy });
    } catch (e) {
      console.error("[pdf] oluşturulamadı:", e);
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    if (isTeacher && !studentId) return;
    setLoading(true);
    setError("");
    api.getReport({ studentId: studentId || undefined, groupBy })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [studentId, groupBy, isTeacher]);

  return (
    <div style={{ padding: 28, maxWidth: 760, margin: "0 auto" }}>
      {onBack && (
        <button onClick={onBack} className="k-link-btn" style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: C.muted, cursor: "pointer", fontFamily: bodyFont, fontSize: 13, fontWeight: 600, marginBottom: 18 }}>
          <ArrowLeft size={16} /> {backLabel}
        </button>
      )}
      {isTeacher && (
        <div style={{ fontFamily: displayFont, fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 16 }}>{studentName} — Rapor</div>
      )}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {GROUP_OPTIONS.map((g) => (
            <button
              key={g.value}
              type="button"
              className="k-btn"
              onClick={() => setGroupBy(g.value)}
              style={{
                padding: "8px 14px", borderRadius: C.radiusSm, cursor: "pointer",
                border: `1.5px solid ${groupBy === g.value ? C.accent : C.border}`,
                background: groupBy === g.value ? C.accentSoft : C.surface,
                color: groupBy === g.value ? C.accent : C.text, fontFamily: bodyFont, fontWeight: 700, fontSize: 13,
              }}
            >{g.label}</button>
          ))}
        </div>
        <Button small variant="secondary" icon={Download} onClick={exportPdf} disabled={exporting || !data || data.overall.count === 0}>
          {exporting ? "Hazırlanıyor..." : "PDF İndir"}
        </Button>
      </div>

      {loading ? (
        <EmptyState text="Yükleniyor..." />
      ) : error ? (
        <EmptyState text={error} />
      ) : !data || data.overall.count === 0 ? (
        <EmptyState text="Henüz raporlanacak bir sonuç yok — ödev sonuçları ve serbest çalışma kayıtları girildikçe burada görünecek." />
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
            <StatCard label="Doğru" value={data.overall.correctCount} tone="green" />
            <StatCard label="Yanlış" value={data.overall.wrongCount} tone="red" />
            <StatCard label="Boş" value={data.overall.blankCount} tone="muted" />
            <StatCard label="Net" value={data.overall.net} tone="accent" />
          </div>

          <div style={{ fontFamily: displayFont, fontSize: 14, fontWeight: 800, marginBottom: 12, color: C.mutedLight, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Derse Göre
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
            {data.bySubject.map((s) => (
              <ReportRow key={s.subject} title={s.subject} subtitle={`${s.count} kayıt`} maxNet={data.bySubject[0]?.net || 1} showRate {...s} />
            ))}
          </div>

          <div style={{ fontFamily: displayFont, fontSize: 14, fontWeight: 800, marginBottom: 12, color: C.mutedLight, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Zamana Göre — Net Trendi
          </div>
          <div style={{ marginBottom: 16 }}>
            <NetTrendChart points={data.byPeriod} groupBy={groupBy} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...data.byPeriod].reverse().map((p) => (
              <ReportRow key={p.period} title={formatPeriodLabel(p.period, groupBy)} subtitle={`${p.count} kayıt`} maxNet={Math.max(...data.byPeriod.map((x) => x.net), 1)} {...p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
