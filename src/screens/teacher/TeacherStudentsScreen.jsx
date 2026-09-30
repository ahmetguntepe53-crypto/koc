import { useEffect, useMemo, useState } from "react";
import { BarChart3, Clock, ChevronRight } from "lucide-react";
import { C, displayFont, bodyFont, formatNet, SKIP_REASONS, STATUS_LABEL, statusTone } from "../../theme.js";
import { EmptyState, Avatar, LoadingState, StatusSquare, Card } from "../../components/common.jsx";
import { HeroHeader, HeroBell, HeroStat, HeroTextButton, StatusChip, NUM } from "../../components/brand.jsx";
import { api } from "../../api.js";
import { loadStudentStatuses, getCachedStatus } from "../../studentStatus.js";
import { BOARD_BRANCHES, boardBranchOf, GRADE_LEVELS, gradeLabel } from "../../subjects.js";
import { weekBounds, shortDate, lastSeenInfo } from "../../work.js";
import PushPermissionBanner from "../../components/PushPermissionBanner.jsx";

// Koç — Öğrencilerim (şartname Z3). Her kartta 7 kare: 7 branş dersinin bu haftaki ödevi, sıra her
// öğrencide aynı. Sıralama: önce ödevi geciken, sonra koçun kendi verdiği ödevlerde ("benim ödevim")
// tamamlama oranı düşük olan; eşitlikte en geriden (giriş yok, pas, düşük net).
// Kartın altındaki gerekçe çipi (ör. "2 sessiz ödev (14 gün)") raporun koç panelindeki gerekçelerin
// ilki — src/studentStatus.js raporun modelini öğrenci öğrenci çalıştırır; liste onu beklemeden çizilir.

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

const fmtNet = (v) => Number(v).toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });

// Benim ödevim oranı; koçun verdiği ödev yoksa 1 (bekleyen yok) sayılır.
const mineRatio = (s) => (s.mine?.total ? s.mine.done / s.mine.total : 1);

function compareStudents(a, b) {
  const lateA = a.overdueCount > 0 ? 1 : 0;
  const lateB = b.overdueCount > 0 ? 1 : 0;
  const skippedA = a.week.filter((w) => w.status === "skipped").length;
  const skippedB = b.week.filter((w) => w.status === "skipped").length;
  const netA = a.weekNet == null ? -Infinity : a.weekNet;
  const netB = b.weekNet == null ? -Infinity : b.weekNet;
  return lateB - lateA || (b.overdueCount || 0) - (a.overdueCount || 0) || mineRatio(a) - mineRatio(b)
    || inactiveDays(b) - inactiveDays(a) || skippedB - skippedA || netA - netB || (a.name || "").localeCompare(b.name || "", "tr");
}

// Kartın altındaki çipler: gecikme (kırmızı), giriş yok, pas, sınıf düzeyi sorunu; en sonda raporun gerekçesi.
function chipsOf(s, st) {
  const chips = [];
  if (s.overdueCount) chips.push({ tone: "danger", icon: Clock, text: `${s.overdueCount} ödev gecikti` });
  const seen = lastSeenInfo(s.lastSeenAt, s.createdAt);
  if (seen.inactive) chips.push({ tone: "track", text: seen.never ? "hiç giriş yapmadı" : `${seen.days} gündür giriş yok` });
  const skipped = s.week.filter((w) => w.status === "skipped");
  if (skipped.length) {
    const reasons = [...new Set(skipped.map((w) => w.skipReason))];
    const same = skipped.length > 1 && reasons.length === 1 && SKIP_REASONS[reasons[0]];
    chips.push({ tone: "warning", text: `${skipped.length} ödevi pas geçti${same ? ` · hepsi “${SKIP_REASONS[reasons[0]].toLocaleLowerCase("tr-TR")}”` : ""}` });
  }
  if (!GRADE_LEVELS.includes(s.gradeLevel)) chips.push({ tone: "track", text: `${gradeLabel(s.gradeLevel)} — yöneticiye bildir` });
  const reason = st?.reasons?.[0];
  if (reason) chips.push({ tone: chips.length ? "track" : "brand", text: reason });
  if (s.banned) chips.push({ tone: "danger", text: "Askıda" });
  return chips;
}

function StudentCard({ s, st, onOpen }) {
  const chips = chipsOf(s, st);
  const late = s.overdueCount > 0;
  const pct = s.mine?.total ? (s.mine.done / s.mine.total) * 100 : 0;
  return (
    <Card hover onClick={() => onOpen(s.id, s.name)} style={{ padding: 14, borderRadius: 20, border: "none", cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Avatar name={s.name} size={44} tint />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: bodyFont, fontSize: 15, fontWeight: 700, color: C.inkText }}>{s.name}</div>
          {s.mine?.total > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <span style={{ ...NUM, fontSize: 12.5, color: C.inkMuted, whiteSpace: "nowrap" }}>Benim ödevim <b style={{ color: C.inkText }}>{s.mine.done}/{s.mine.total}</b></span>
              <span aria-hidden="true" style={{ flex: 1, maxWidth: 90, height: 6, borderRadius: 3, background: C.track, overflow: "hidden" }}>
                <span style={{ display: "block", width: `${pct}%`, height: "100%", borderRadius: 3, background: C.brand }} />
              </span>
            </div>
          )}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ ...NUM, fontSize: 22, fontWeight: 800, lineHeight: 1, color: s.weekNet != null ? C.inkText : C.inkMuted }}>{s.weekNet != null ? fmtNet(s.weekNet) : "—"}</div>
          <div style={{ fontFamily: bodyFont, fontSize: 11, color: C.inkMuted, marginTop: 3 }}>net</div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 4, marginTop: 12 }}>
        {BOARD_BRANCHES.map((b) => {
          const status = branchStatus(s.week.filter((w) => w.schoolWide && boardBranchOf(w.subject) === b.key));
          return (
            <span key={b.key} style={{ opacity: status ? 1 : 0.45, display: "inline-flex" }}>
              <StatusSquare subject={b.icon} status={status || "open"} size={38} title={`${b.label}: ${status ? STATUS_LABEL[status] : "bu hafta ödev yok"}`} />
            </span>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.cardDivider}` }}>
        {chips.map((c) => (
          <StatusChip key={c.text} tone={c.tone}>{c.icon && <c.icon size={13} strokeWidth={2.4} aria-hidden="true" />}{c.text}</StatusChip>
        ))}
        <span aria-hidden="true" style={{
          marginLeft: "auto", width: 32, height: 32, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
          background: late ? C.danger : C.brandTint, color: late ? C.onBrand : C.brandText,
        }}>
          <ChevronRight size={17} strokeWidth={2.4} />
        </span>
      </div>
    </Card>
  );
}

export default function TeacherStudentsScreen({ user, onOpen, unreadCount, onOpenNotifications, onOpenMonthly }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  // id → { status, statusLabel, reasons }; yalnızca gelenler (gerekçe çipi için). Önbellektekiler ilk çizimde hazır.
  const [statuses, setStatuses] = useState({});

  useEffect(() => {
    api.teacherListStudents()
      .then(({ students }) => {
        const cached = {};
        for (const s of students) {
          const hit = getCachedStatus(s.id);
          if (hit) cached[s.id] = hit;
        }
        setStatuses(cached);
        setStudents(students);
      })
      .catch((e) => setLoadError(e.message || "Öğrenci listesi yüklenemedi"))
      .finally(() => setLoading(false));
  }, []);

  const week = weekBounds();
  const sorted = useMemo(() => [...students].sort(compareStudents), [students]);

  // Gerekçeler listedeki sırayla (üstteki önce) yüklenir; ekran kapanınca sıradakiler için istek başlatılmaz.
  useEffect(() => {
    if (!sorted.length) return undefined;
    const ctrl = new AbortController();
    loadStudentStatuses(sorted.map((s) => s.id), {
      signal: ctrl.signal,
      onStatus: (id, value) => setStatuses((prev) => (prev[id] === value ? prev : { ...prev, [id]: value })),
    });
    return () => ctrl.abort();
  }, [sorted]);

  const behind = students.filter((s) => s.overdueCount > 0).length;
  const skippedWeek = students.reduce((n, s) => n + s.week.filter((w) => w.status === "skipped").length, 0);
  const nets = students.map((s) => s.weekNet).filter((n) => n != null);
  const avgNet = nets.length ? nets.reduce((a, b) => a + b, 0) / nets.length : null;
  const legend = [["done", "Çözüldü"], ["skipped", "Pas geçti"], ["missed", "Yapılmadı"], ["open", "Süresi dolmadı"]];

  return (
    <div>
      <HeroHeader compact>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...NUM, fontSize: 13, color: C.onBrandMuted, lineHeight: 1.35 }}>
              {user?.name && <span style={{ whiteSpace: "nowrap" }}>{user.name} · </span>}
              <span style={{ whiteSpace: "nowrap" }}>{shortDate(week.mon)} – {shortDate(week.sun)}</span>
            </div>
            <h1 style={{ margin: 0, fontFamily: displayFont, fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: C.onBrand }}>Öğrencilerim</h1>
          </div>
          {onOpenMonthly && <HeroTextButton icon={BarChart3} label="Aylık rapor" onClick={onOpenMonthly} />}
          <HeroBell unreadCount={unreadCount} onClick={onOpenNotifications} />
        </div>
        {!loading && !loadError && students.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 18 }}>
            <HeroStat lime label="öğrenci takipte" value={behind} />
            <HeroStat label="ödev pas geçildi" value={skippedWeek} />
            <HeroStat label="ortalama net" value={avgNet != null ? formatNet(avgNet, 1) : "—"} />
          </div>
        )}
      </HeroHeader>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "20px 16px 24px" }}>
        <PushPermissionBanner reason="Öğrencilerinin geciken ödev özetlerini kaçırmamak için." />
        {loading ? (
          <LoadingState />
        ) : loadError ? (
          <EmptyState text={loadError} />
        ) : students.length === 0 ? (
          <EmptyState text="Henüz sana atanmış bir öğrenci yok — okul yöneticinden öğrenci ataması istemen gerekebilir." />
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
              <h2 style={{ margin: 0, fontFamily: displayFont, fontSize: 19, fontWeight: 800, color: C.inkText }}>Bu haftanın durumu</h2>
              <span style={{ ...NUM, fontSize: 12, color: C.inkMuted }}>{BOARD_BRANCHES.length} branş ödevi</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {legend.map(([st, label]) => (
                <span key={st} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 28, padding: "0 10px", borderRadius: 999, background: C.surface, fontFamily: bodyFont, fontSize: 12, fontWeight: 600, color: C.inkText }}>
                  <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: st === "open" ? C.barEmpty : statusTone(st).fg }} />{label}
                </span>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {sorted.map((s) => <StudentCard key={s.id} s={s} st={statuses[s.id]} onOpen={onOpen} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
