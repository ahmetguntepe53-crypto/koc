import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, BarChart3 } from "lucide-react";
import { C, bodyFont, monoFont, formatNet } from "../theme.js";
import {
  Card, Pill, Chip, EmptyState, StatCard, StatGrid, LoadingState, SectionHeader, ProgressBar, SubjectIcon,
  HeaderTextButton, HEADER_SLOT_ID,
} from "../components/common.jsx";
import { api } from "../api.js";
import { formatDate } from "../dates.js";
import { subjectIconUrl } from "../subjects.js";
import { downloadReportPdf } from "../reportPdf.js";

const GROUP_OPTIONS = [
  { value: "day", label: "Günlük" },
  { value: "week", label: "Haftalık" },
  { value: "month", label: "Aylık" },
];

// Özet kartında son dönemin netinin yanına yazılan ifade — yalnızca son dönem gerçekten içinde
// bulunulan dönemse gösterilir (bkz. SummaryCard).
const CURRENT_PERIOD_LABELS = { day: "bugün", week: "bu hafta", month: "bu ay" };

// Sunucudaki server/src/routes/stats.js > periodLabel ile AYNI anahtar üretimi: Türkiye saati (sabit
// UTC+3, DST yok), gün "YYYY-MM-DD", ay "YYYY-MM", hafta ISO 8601 "YYYY-Hww". byPeriod'un son elemanının
// "şu anki dönem" olup olmadığını bu anahtarla karşılaştırırız — cihazın kendi saat dilimi farklı olsa da
// (yurt dışındaki bir cihaz) sunucuyla aynı sonucu versin diye yerel Date alanları kullanılmaz.
const TR_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;
function currentPeriodKey(groupBy, now = Date.now()) {
  const d = new Date(now + TR_UTC_OFFSET_MS);
  if (groupBy === "day") return d.toISOString().slice(0, 10);
  if (groupBy === "month") return d.toISOString().slice(0, 7);
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((day - yearStart) / 86400000 + 1) / 7);
  return `${day.getUTCFullYear()}-H${String(weekNo).padStart(2, "0")}`;
}

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

// Başarı oranı = doğru sayısının toplam soru sayısına (doğru+yanlış+boş) oranı.
function successRate(correctCount, wrongCount, blankCount) {
  const total = correctCount + wrongCount + blankCount;
  return total ? Math.round((correctCount / total) * 100) : null;
}

// Ders kartındaki ilerleme çubuğu dersin kendi renginde — fonksiyon (sabit nesne değil), çünkü C.*
// tema değişince yerinde güncelleniyor (bkz. theme.js). "-1/-2" ekli AYT dersleri ana dersin rengini alır.
function subjectColor(subject) {
  const base = String(subject || "").replace(/-\d+$/, "");
  const colors = {
    "Matematik": C.accent, "Geometri": C.accent,
    "Türkçe": C.red, "Edebiyat": C.red,
    "Fizik": C.blue, "Coğrafya": C.blue,
    "Kimya": C.amber, "Tarih": C.amber, "T.C. İnkılap Tarihi ve Atatürkçülük": C.amber,
    "Biyoloji": C.green, "Din Kültürü ve Ahlak Bilgisi": C.green,
    "Felsefe": C.muted, "Felsefe Grubu": C.muted, "Mantık": C.muted, "Psikoloji": C.muted, "Sosyoloji": C.muted,
  };
  return colors[base] || C.accent;
}

// Kartların sağındaki net değeri — mono rakam, altında küçük "NET" etiketi. Negatif net kırmızı.
function NetValue({ net, size }) {
  return (
    <div style={{ textAlign: "right", flexShrink: 0 }}>
      <div style={{ fontFamily: monoFont, fontSize: size, fontWeight: 700, letterSpacing: -0.4, color: net < 0 ? C.red : C.text, lineHeight: 1.1 }}>
        {formatNet(net, 2)}
      </div>
      <div style={{ fontFamily: bodyFont, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.8, color: C.mutedLight, marginTop: 3 }}>NET</div>
    </div>
  );
}

function DybPills({ correctCount, wrongCount, blankCount }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", minWidth: 0 }}>
      <Pill tone="green" mono>D {correctCount}</Pill>
      <Pill tone="red" mono>Y {wrongCount}</Pill>
      <Pill mono>B {blankCount}</Pill>
    </div>
  );
}

// Özet kartı: net asıl ölçü, doğru/yanlış/boş onun bileşeni — dört eşit kutucuk hiyerarşiyi siliyordu.
// Büyük sayı tüm zamanların TOPLAM neti (overall.net); sağındaki "+X bu hafta" yalnızca byPeriod'un son
// elemanı gerçekten içinde bulunulan dönemse gösterilir — aksi halde "bu hafta" yanlış bir iddia olurdu.
function SummaryCard({ overall, lastPeriod, groupBy }) {
  const isCurrent = !!lastPeriod && lastPeriod.period === currentPeriodKey(groupBy);
  const delta = isCurrent ? lastPeriod.net : null;
  const deltaColor = delta > 0 ? C.green : delta < 0 ? C.red : C.muted;
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ fontFamily: bodyFont, fontSize: 10.5, fontWeight: 800, letterSpacing: 1.2, color: C.mutedLight, whiteSpace: "nowrap" }}>TOPLAM NET</div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginTop: 4 }}>
        <div style={{ fontFamily: monoFont, fontSize: 36, fontWeight: 700, letterSpacing: -1.6, color: overall.net < 0 ? C.red : C.accent, lineHeight: 1.1, minWidth: 0 }}>
          {formatNet(overall.net)}
        </div>
        {delta != null && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 5, paddingBottom: 5, flexShrink: 0, whiteSpace: "nowrap" }}>
            <span style={{ fontFamily: monoFont, fontSize: 12, fontWeight: 700, color: deltaColor }}>{delta >= 0 ? `+${formatNet(delta)}` : formatNet(delta)}</span>
            <span style={{ fontFamily: bodyFont, fontSize: 11.5, fontWeight: 500, color: C.mutedLight }}>{CURRENT_PERIOD_LABELS[groupBy]}</span>
          </div>
        )}
      </div>
      <div style={{ height: 1, background: C.divider, margin: "14px 0" }} />
      <StatGrid style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", marginBottom: 0 }}>
        <StatCard label="Doğru" value={overall.correctCount} tone="green" />
        <StatCard label="Yanlış" value={overall.wrongCount} tone="red" />
        <StatCard label="Boş" value={overall.blankCount} tone="muted" />
      </StatGrid>
    </Card>
  );
}

// Ders kartı: "N kayıt" görünür — 4 kayıtlık bir dersle 1 kayıtlık bir dersin yüzdesini yan yana
// koymak yanıltıcı olurdu. Çubuk = başarı oranı, dersin kendi renginde.
function SubjectCard({ subject, count, correctCount, wrongCount, blankCount, net }) {
  const rate = successRate(correctCount, wrongCount, blankCount);
  return (
    <Card style={{ padding: "14px 16px 16px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <SubjectIcon src={subjectIconUrl(subject)} size={34} radius={11} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: bodyFont, fontSize: 14, fontWeight: 700, color: C.text, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{subject}</div>
          <div style={{ fontFamily: bodyFont, fontSize: 11.5, fontWeight: 500, color: C.mutedLight, marginTop: 2 }}>{count} kayıt</div>
        </div>
        <NetValue net={net} size={19} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 12 }}>
        <DybPills correctCount={correctCount} wrongCount={wrongCount} blankCount={blankCount} />
        <div style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
          <span style={{ fontFamily: monoFont, fontSize: 12, fontWeight: 700, color: C.text2 }}>{rate != null ? `%${rate}` : "—"}</span>
          <span style={{ fontFamily: bodyFont, fontSize: 11, fontWeight: 500, color: C.mutedLight, marginLeft: 5 }}>başarı</span>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <ProgressBar value={rate} color={subjectColor(subject)} height={6} />
      </div>
    </Card>
  );
}

// Dönem satırı (grafiğin altındaki döküm) — çubuk o dönemin netinin en yüksek döneme oranı.
function PeriodCard({ title, count, correctCount, wrongCount, blankCount, net, maxNet }) {
  const pct = maxNet > 0 ? Math.max(4, Math.min(100, (Math.max(0, net) / maxNet) * 100)) : 0;
  return (
    <Card style={{ padding: "12px 16px 14px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: bodyFont, fontSize: 14, fontWeight: 700, color: C.text, lineHeight: 1.3 }}>{title}</div>
          <div style={{ fontFamily: bodyFont, fontSize: 11.5, fontWeight: 500, color: C.mutedLight, marginTop: 2 }}>{count} kayıt</div>
        </div>
        <NetValue net={net} size={17} />
      </div>
      <div style={{ marginTop: 10 }}>
        <DybPills correctCount={correctCount} wrongCount={wrongCount} blankCount={blankCount} />
      </div>
      <div style={{ marginTop: 10 }}>
        <ProgressBar value={pct} color={net < 0 ? C.red : C.accent} height={5} />
      </div>
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
            <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="10.5" fill={C.mutedLight} fontFamily={monoFont}>
              {shortPeriodLabel(p.period, groupBy)}
            </text>
          )}
        </g>
      ))}
      <text x={x(points.length - 1)} y={y(last.net) - 10} textAnchor={points.length === 1 ? "middle" : "end"} fontSize="12" fontWeight="700" fill={C.accent} fontFamily={monoFont}>{formatNet(last.net)}</text>
      <text x={2} y={padT + 4} fontSize="10.5" fill={C.mutedLight} fontFamily={monoFont}>{Math.round(max)}</text>
      <text x={2} y={H - padB} fontSize="10.5" fill={C.mutedLight} fontFamily={monoFont}>{Math.round(min)}</text>
    </svg>
  );
}

// Hem öğretmenin bir öğrencisinin özetinden hem de öğrencinin kendi profilinden açılan tek ekran —
// TEACHER'da studentId/studentName SABİT olarak dışarıdan verilir (o öğrencinin özetinden açıldığı
// için burada ayrıca bir öğrenci seçiciye gerek yok), STUDENT doğrudan kendi raporunu görür.
// Geri düğmesi ve ekran başlığı ("Ayşe Yılmaz — Rapor") App başlığında — onBack/backLabel artık
// sayfada kullanılmıyor (App.jsx > headerBack).
export default function ReportScreen({ user, studentId: fixedStudentId, studentName: fixedStudentName }) {
  const isTeacher = user.role === "TEACHER";
  const studentId = isTeacher ? fixedStudentId : undefined;
  const studentName = isTeacher ? fixedStudentName : user.name;
  const [groupBy, setGroupBy] = useState("week");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  // PDF düğmesi App başlığının sağındaki yuvaya (HEADER_SLOT_ID) portal ile konur — yuva App'in
  // başlığında, ilk render'da DOM'da henüz olmayabileceği için effect'te bulunup state'e alınır.
  const [headerSlot, setHeaderSlot] = useState(null);
  useEffect(() => setHeaderSlot(document.getElementById(HEADER_SLOT_ID)), []);

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

  const pdfDisabled = exporting || loading || !data || data.overall.count === 0;
  // Sunucu zaten nete göre sıralı gönderiyor; yine de "nete göre sıralı" etiketi bir sözleşme olduğu için
  // istemcide de garanti edilir.
  const subjects = data ? [...data.bySubject].sort((a, b) => b.net - a.net) : [];

  return (
    <div className="k-page" style={{ padding: 28, maxWidth: 760, margin: "0 auto" }}>
      {headerSlot && createPortal(
        <HeaderTextButton icon={Download} label={exporting ? "Hazırlanıyor..." : "PDF"} onClick={exportPdf} disabled={pdfDisabled} />,
        headerSlot
      )}

      <div className="k-chip-row" role="group" aria-label="Gruplama" style={{ marginBottom: 14 }}>
        {GROUP_OPTIONS.map((g) => (
          <Chip key={g.value} active={groupBy === g.value} onClick={() => setGroupBy(g.value)}>{g.label}</Chip>
        ))}
      </div>
      {exportError && <div role="alert" style={{ color: C.red, fontFamily: bodyFont, fontSize: 12.5, fontWeight: 600, marginBottom: 12 }}>{exportError}</div>}

      {loading ? (
        <LoadingState />
      ) : error ? (
        <EmptyState text={error} />
      ) : !data || data.overall.count === 0 ? (
        <EmptyState icon={BarChart3} text="Henüz raporlanacak bir sonuç yok — ödev sonuçları ve serbest çalışma kayıtları girildikçe burada görünecek." />
      ) : (
        <>
          <SummaryCard overall={data.overall} lastPeriod={data.byPeriod[data.byPeriod.length - 1]} groupBy={reportGroupBy} />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, margin: "22px 0 10px" }}>
            <SectionHeader title="Derse göre" style={{ margin: 0 }} />
            <span style={{ fontFamily: bodyFont, fontSize: 11.5, fontWeight: 500, color: C.mutedLight, whiteSpace: "nowrap" }}>nete göre sıralı</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {subjects.map((s) => <SubjectCard key={s.subject} {...s} />)}
          </div>

          <SectionHeader title="Zamana göre — net trendi" style={{ marginTop: 26 }} />
          <div style={{ marginBottom: 10 }}>
            <NetTrendChart points={data.byPeriod} groupBy={reportGroupBy} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...data.byPeriod].reverse().map((p) => (
              <PeriodCard key={p.period} title={formatPeriodLabel(p.period, reportGroupBy)} maxNet={Math.max(...data.byPeriod.map((x) => x.net), 1)} {...p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
