import { useEffect, useMemo, useState } from "react";
import { C, bodyFont, monoFont, formatNet, SKIP_REASONS, STATUS_LABEL } from "../../theme.js";
import { EmptyState, Avatar, LoadingState, StatCard, StatGrid, SectionHeader, StatusSquare, Legend, Pill } from "../../components/common.jsx";
import { api } from "../../api.js";
import { BOARD_BRANCHES, boardBranchOf, GRADE_LEVELS, gradeLabel } from "../../subjects.js";
import { weekBounds, shortDate, lastSeenInfo } from "../../work.js";
import PushPermissionBanner from "../../components/PushPermissionBanner.jsx";

// Koç — Öğrencilerim (şartname Z3). Her satırda 7 kare: 7 branş dersinin bu haftaki ödevi, sıra her
// öğrencide aynı. Sıralama alfabetik değil, EN GERİDEN — koç ekranı açıp ilk iki satıra bakıp kapatabilmeli.

// Bir branşın bu haftaki ödev(ler)inin toplam durumu (TYT ve AYT ayrı ödev olabilir): biri yapılmadıysa
// kırmızı, pas varsa sarı, açık varsa nötr, hepsi çözüldüyse yeşil. O hafta ödevi yoksa null (soluk kare).
function branchStatus(items) {
  if (!items.length) return null;
  if (items.some((i) => i.status === "missed")) return "missed";
  if (items.some((i) => i.status === "skipped")) return "skipped";
  if (items.some((i) => i.status === "open")) return "open";
  return "done";
}

// Uygulamayı açmadığı gün sayısı (giriş yoksa sıralamada öne çıkar); aktifse 0.
function inactiveDays(s) {
  const info = lastSeenInfo(s.lastSeenAt, s.createdAt);
  return info.inactive ? info.days : 0;
}

function compareBehind(a, b) {
  const skippedA = a.week.filter((w) => w.status === "skipped").length;
  const skippedB = b.week.filter((w) => w.status === "skipped").length;
  const netA = a.weekNet == null ? -Infinity : a.weekNet;
  const netB = b.weekNet == null ? -Infinity : b.weekNet;
  return (b.overdueCount || 0) - (a.overdueCount || 0) || inactiveDays(b) - inactiveDays(a) || skippedB - skippedA || netA - netB || (a.name || "").localeCompare(b.name || "", "tr");
}

// Sorunluysa kırmızı tek satır: "4 gündür giriş yok · 3 ödev gecikti · 4 ödevi pas geçti · hepsi “zaman yetmedi”".
function problemLine(s) {
  const parts = [];
  const seen = lastSeenInfo(s.lastSeenAt, s.createdAt);
  if (seen.inactive) parts.push(seen.never ? "hiç giriş yapmadı" : `${seen.days} gündür giriş yok`);
  if (s.overdueCount) parts.push(`${s.overdueCount} ödev gecikti`);
  const skipped = s.week.filter((w) => w.status === "skipped");
  if (skipped.length) {
    const reasons = [...new Set(skipped.map((w) => w.skipReason))];
    const same = skipped.length > 1 && reasons.length === 1 && SKIP_REASONS[reasons[0]];
    parts.push(`${skipped.length} ödevi pas geçti${same ? ` · hepsi “${SKIP_REASONS[reasons[0]].toLocaleLowerCase("tr-TR")}”` : ""}`);
  }
  if (!GRADE_LEVELS.includes(s.gradeLevel)) parts.push(`${gradeLabel(s.gradeLevel)} — yöneticiye bildir`);
  return parts.join(" · ");
}

function StudentRow({ s, onOpen }) {
  const problem = problemLine(s);
  const delta = s.weekNet != null && s.prevWeekNet != null ? s.weekNet - s.prevWeekNet : null;
  return (
    <button
      type="button"
      onClick={() => onOpen(s.id, s.name)}
      className="k-list-row"
      style={{ display: "flex", alignItems: "flex-start", gap: 14, width: "100%", boxSizing: "border-box", padding: "16px 0", background: "none", border: "none", borderTop: `1px solid ${C.divider}`, textAlign: "left", cursor: "pointer", fontFamily: bodyFont }}
    >
      <Avatar name={s.name} size={40} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "baseline", columnGap: 10, rowGap: 2, flexWrap: "wrap" }}>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.3, color: C.text }}>{s.name}</span>
          {s.mine.total > 0 && <span style={{ fontSize: 12.5, color: C.mutedLight }}>benim ödevim <span style={{ fontFamily: monoFont }}>{s.mine.done}/{s.mine.total}</span></span>}
          {s.banned && <Pill tone="red">Askıda</Pill>}
        </span>
        <span style={{ display: "flex", gap: 4, marginTop: 10, flexWrap: "wrap" }}>
          {BOARD_BRANCHES.map((b) => {
            const status = branchStatus(s.week.filter((w) => w.schoolWide && boardBranchOf(w.subject) === b.key));
            return (
              <span key={b.key} style={{ opacity: status ? 1 : 0.35, display: "inline-flex" }}>
                <StatusSquare subject={b.icon} status={status || "open"} size={26} title={`${b.label}: ${status ? STATUS_LABEL[status] : "bu hafta ödev yok"}`} />
              </span>
            );
          })}
        </span>
        {problem && <span style={{ display: "block", fontSize: 13, fontWeight: 500, color: C.red, marginTop: 10, lineHeight: 1.4 }}>{problem}</span>}
      </span>
      <span style={{ textAlign: "right", flexShrink: 0, paddingTop: 2 }}>
        <span style={{ display: "block", fontFamily: monoFont, fontSize: 17, fontWeight: 700, color: s.weekNet != null ? C.text : C.faintest }}>{s.weekNet != null ? formatNet(s.weekNet, 2) : "—"}</span>
        {delta != null && <span style={{ display: "block", fontFamily: monoFont, fontSize: 12.5, fontWeight: 600, color: delta >= 0 ? C.green : C.red, marginTop: 2 }}>{delta >= 0 ? "+" : "−"}{formatNet(Math.abs(delta), 2)}</span>}
        <span style={{ display: "block", fontSize: 11.5, color: C.mutedLight, marginTop: 2 }}>net</span>
      </span>
    </button>
  );
}

export default function TeacherStudentsScreen({ user, onOpen, setHeader }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    api.teacherListStudents().then(({ students }) => setStudents(students)).catch((e) => setLoadError(e.message || "Öğrenci listesi yüklenemedi")).finally(() => setLoading(false));
  }, []);

  const week = weekBounds();
  useEffect(() => {
    if (loading) return;
    setHeader?.({ title: "Öğrencilerim", subtitle: [user?.name, `${students.length} öğrenci`, `${shortDate(week.mon)} – ${shortDate(week.sun)}`].filter(Boolean).join(" · ") });
  }, [loading, students.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = useMemo(() => [...students].sort(compareBehind), [students]);
  const behind = students.filter((s) => s.overdueCount > 0).length;
  const skippedWeek = students.reduce((n, s) => n + s.week.filter((w) => w.status === "skipped").length, 0);
  const nets = students.map((s) => s.weekNet).filter((n) => n != null);
  const avgNet = nets.length ? nets.reduce((a, b) => a + b, 0) / nets.length : null;

  return (
    <div className="k-page" style={{ padding: 28, maxWidth: 760, margin: "0 auto" }}>
      <PushPermissionBanner reason="Öğrencilerinin geciken ödev özetlerini kaçırmamak için." />
      {loading ? (
        <LoadingState />
      ) : loadError ? (
        <EmptyState text={loadError} />
      ) : students.length === 0 ? (
        <EmptyState text="Henüz sana atanmış bir öğrenci yok — okul yöneticinden öğrenci ataması istemen gerekebilir." />
      ) : (
        <>
          <StatGrid min={96}>
            <StatCard label="öğrenci geride" value={behind} tone={behind ? "red" : "muted"} />
            <StatCard label="ödev pas geçildi" value={skippedWeek} tone={skippedWeek ? "amber" : "muted"} />
            <StatCard label="ortalama net" value={avgNet != null ? formatNet(avgNet, 1) : "—"} />
          </StatGrid>

          <div style={{ marginTop: 12, padding: "14px 16px", borderRadius: 16, background: C.surface, border: `1px solid ${C.border}`, fontFamily: bodyFont }}>
            <div style={{ fontSize: 13.5, color: C.text2, lineHeight: 1.5 }}>Her satırdaki 7 kare, 7 branş dersinin bu haftaki ödevi. Sıra her öğrencide aynı.</div>
            <Legend square style={{ marginTop: 10 }} items={[
              { label: "çözüldü", color: C.green },
              { label: "pas geçti", color: C.amber },
              { label: "yapılmadı", color: C.red },
              { label: "süresi dolmadı", color: C.faintest },
            ]} />
          </div>

          <SectionHeader title="En geriden başlayarak" />
          <div className="k-bleed" style={{ borderBottom: `1px solid ${C.divider}` }}>
            {sorted.map((s) => <StudentRow key={s.id} s={s} onOpen={onOpen} />)}
          </div>
        </>
      )}
    </div>
  );
}
