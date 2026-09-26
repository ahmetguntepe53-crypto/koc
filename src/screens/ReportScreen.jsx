import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Download, BarChart3 } from "lucide-react";
import { C, displayFont, bodyFont } from "../theme.js";
import { Card, Button, Pill, EmptyState, StatCard, StatGrid, LoadingState } from "../components/common.jsx";
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

// Satır düzeni her ekran genişliğinde aynı: solda başlık, sağda büyük net değeri; altında D/Y/B
// (ve başarı) etiketleri tek sırada — önceden etiketler başlığın yanına sığmayınca düzensiz kırılıyordu.
function ReportRow({ title, subtitle, correctCount, wrongCount, blankCount, net, maxNet, showRate }) {
  const rate = showRate ? successRate(correctCount, wrongCount, blankCount) : null;
  return (
    <Card style={{ padding: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: bodyFont, fontSize: 14, fontWeight: 700, color: C.text }}>{title}</div>
          {subtitle && <div style={{ fontFamily: bodyFont, fontSize: 11.5, color: C.muted, marginTop: 2 }}>{subtitle}</div>}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontFamily: displayFont, fontSize: 18, fontWeight: 800, color: net < 0 ? C.red : C.accent, lineHeight: 1.1 }}>{net}</div>
          <div style={{ fontFamily: bodyFont, fontSize: 10.5, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.3 }}>net</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        <Pill tone="green">D {correctCount}</Pill>
        <Pill tone="red">Y {wrongCount}</Pill>
        <Pill>B {blankCount}</Pill>
        {showRate && <Pill tone={rateTone(rate)}>Başarı {rate != null ? `%${rate}` : "—"}</Pill>}
      </div>
      <NetBar net={net} maxNet={maxNet} />
    </Card>
  );
}

// Kabın gerçek genişliği — grafik viewBox'ı buna eşitlenir ki SVG ölçeklenmesin ve eksen yazıları her
// ekranda gerçek piksel boyutunda (≈11px) kalsın. Önceden 680 birimlik sabit viewBox telefonda yarıya
// küçülüp etiketler ~5px'e iniyordu, okunmuyordu.
function useElementWidth() {
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

// Zamana göre net trendini gösteren gerçek bir çizgi grafiği — ayrı bir grafik kütüphanesi
// eklemeden düz SVG ile (bu tek grafik ihtiyacı için ~100KB+'lık bir bağımlılık haklı değil).
function NetTrendChart({ points, groupBy }) {
  const [boxRef, boxWidth] = useElementWidth();
  if (points.length === 0) return null;
  return (
    <Card style={{ padding: "16px 12px 10px" }}>
      <div ref={boxRef} style={{ width: "100%" }}>
        {boxWidth > 0 && <NetTrendSvg points={points} groupBy={groupBy} W={boxWidth} />}
      </div>
    </Card>
  );
}

function NetTrendSvg({ points, groupBy, W }) {
  const H = 190, padL = 30, padR = 14, padT = 14, padB = 26;
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

  // Etiket sayısı gerçek genişliğe göre — her etikete ~56px düşsün, üst üste binmesin.
  const maxLabels = Math.max(2, Math.floor(innerW / 56));
  const labelEvery = Math.max(1, Math.ceil(points.length / maxLabels));
  // Tek nokta ya da son noktanın değeri üzerinde yazılır — kullanıcı güncel neti grafikte de görsün.
  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Zamana göre net grafiği" style={{ display: "block", overflow: "visible" }}>
      <line x1={padL} y1={zeroY} x2={W - padR} y2={zeroY} stroke={C.borderStrong} strokeWidth="1" strokeDasharray="3,3" />
      <path d={areaPath} fill={C.accent} opacity="0.1" />
      <path d={linePath} fill="none" stroke={C.accent} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={p.period}>
          <circle cx={x(i)} cy={y(p.net)} r="4" fill={C.surface} stroke={C.accent} strokeWidth="2.5" />
          {i % labelEvery === 0 && (
            <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill={C.muted} fontFamily={bodyFont}>
              {shortPeriodLabel(p.period, groupBy)}
            </text>
          )}
        </g>
      ))}
      <text x={x(points.length - 1)} y={y(last.net) - 10} textAnchor={points.length === 1 ? "middle" : "end"} fontSize="12" fontWeight="800" fill={C.accent} fontFamily={bodyFont}>{last.net}</text>
      <text x={2} y={padT + 4} fontSize="11" fill={C.muted} fontFamily={bodyFont}>{Math.round(max)}</text>
      <text x={2} y={H - padB} fontSize="11" fill={C.muted} fontFamily={bodyFont}>{Math.round(min)}</text>
    </svg>
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
  const [exportError, setExportError] = useState("");

  // Veri, hangi gruplamayla istendiğini kendi üzerinde taşır (data.groupBy) — etiketler ve PDF her
  // zaman o değere göre üretilir. Önceden Günlük/Haftalık/Aylık arasında hızlı geçişte geç gelen eski
  // yanıt yeni gruplamanın etiketleriyle gösteriliyordu ("NaN. Hafta", "Invalid Date").
  const reportGroupBy = data?.groupBy || groupBy;

  const exportPdf = async () => {
    setExporting(true);
    setExportError("");
    try {
      await downloadReportPdf({ data, studentName: studentName || "Rapor", groupBy: reportGroupBy });
    } catch (e) {
      console.error("[pdf] oluşturulamadı:", e);
      setExportError("PDF oluşturulamadı — lütfen tekrar dene.");
    } finally {
      setExporting(false);
    }
  };

  const loadSeq = useRef(0);
  useEffect(() => {
    if (isTeacher && !studentId) return;
    const seq = ++loadSeq.current;
    const requestedGroupBy = groupBy;
    setLoading(true);
    setError("");
    api.getReport({ studentId: studentId || undefined, groupBy: requestedGroupBy })
      .then((res) => { if (seq === loadSeq.current) setData({ ...res, groupBy: requestedGroupBy }); })
      .catch((e) => { if (seq === loadSeq.current) setError(e.message); })
      .finally(() => { if (seq === loadSeq.current) setLoading(false); });
  }, [studentId, groupBy, isTeacher]);

  return (
    <div className="k-page" style={{ padding: 28, maxWidth: 760, margin: "0 auto" }}>
      {onBack && (
        <button onClick={onBack} className="k-link-btn" style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: C.muted, cursor: "pointer", fontFamily: bodyFont, fontSize: 13, fontWeight: 600, marginBottom: 18 }}>
          <ArrowLeft size={16} /> {backLabel}
        </button>
      )}
      {isTeacher && (
        <div style={{ fontFamily: displayFont, fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 16 }}>{studentName} — Rapor</div>
      )}
      {/* Gruplama tek parça bir segment kontrolü, PDF aynı satırın sağında — önceden iki satıra bölünüyordu. */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div role="tablist" aria-label="Gruplama" style={{ display: "inline-flex", padding: 3, borderRadius: 12, background: C.surface2, border: `1px solid ${C.border}` }}>
          {GROUP_OPTIONS.map((g) => {
            const active = groupBy === g.value;
            return (
              <button
                key={g.value}
                type="button"
                role="tab"
                aria-selected={active}
                className="k-btn"
                onClick={() => setGroupBy(g.value)}
                style={{
                  padding: "7px 14px", borderRadius: 9, cursor: "pointer", border: "none",
                  background: active ? C.surface : "transparent", boxShadow: active ? C.shadowSm : "none",
                  color: active ? C.accent : C.muted, fontFamily: bodyFont, fontWeight: 700, fontSize: 13,
                }}
              >{g.label}</button>
            );
          })}
        </div>
        <Button small variant="secondary" icon={Download} onClick={exportPdf} disabled={exporting || loading || !data || data.overall.count === 0}>
          {exporting ? "Hazırlanıyor..." : "PDF"}
        </Button>
      </div>
      {exportError && <div style={{ color: C.red, fontSize: 12.5, fontWeight: 600, marginTop: -10, marginBottom: 16, textAlign: "right" }}>{exportError}</div>}

      {loading ? (
        <LoadingState />
      ) : error ? (
        <EmptyState text={error} />
      ) : !data || data.overall.count === 0 ? (
        <EmptyState icon={BarChart3} text="Henüz raporlanacak bir sonuç yok — ödev sonuçları ve serbest çalışma kayıtları girildikçe burada görünecek." />
      ) : (
        <>
          <StatGrid style={{ marginBottom: 24 }}>
            <StatCard label="Doğru" value={data.overall.correctCount} tone="green" />
            <StatCard label="Yanlış" value={data.overall.wrongCount} tone="red" />
            <StatCard label="Boş" value={data.overall.blankCount} tone="muted" />
            <StatCard label="Net" value={data.overall.net} tone="accent" />
          </StatGrid>

          <div style={{ fontFamily: displayFont, fontSize: 14, fontWeight: 800, marginBottom: 12, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Derse Göre
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
            {data.bySubject.map((s) => (
              <ReportRow key={s.subject} title={s.subject} subtitle={`${s.count} kayıt`} maxNet={data.bySubject[0]?.net || 1} showRate {...s} />
            ))}
          </div>

          <div style={{ fontFamily: displayFont, fontSize: 14, fontWeight: 800, marginBottom: 12, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Zamana Göre — Net Trendi
          </div>
          <div style={{ marginBottom: 16 }}>
            <NetTrendChart points={data.byPeriod} groupBy={reportGroupBy} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...data.byPeriod].reverse().map((p) => (
              <ReportRow key={p.period} title={formatPeriodLabel(p.period, reportGroupBy)} subtitle={`${p.count} kayıt`} maxNet={Math.max(...data.byPeriod.map((x) => x.net), 1)} {...p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
