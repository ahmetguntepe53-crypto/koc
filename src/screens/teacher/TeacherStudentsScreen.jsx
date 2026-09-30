import { useEffect, useMemo, useState } from "react";
import { BarChart3, Clock, ChevronRight, ChevronDown, Check } from "lucide-react";
import { C, displayFont, bodyFont, SKIP_REASONS } from "../../theme.js";
import { EmptyState, Avatar, LoadingState, Modal } from "../../components/common.jsx";
import { HeroHeader, HeroBell, HeroStat, HeroTextButton, StatusChip, NUM } from "../../components/brand.jsx";
import { api } from "../../api.js";
import { loadStudentStatuses, getCachedStatus } from "../../studentStatus.js";
import { GRADE_LEVELS, gradeLabel } from "../../subjects.js";
import { weekBounds, shortDate, lastSeenInfo } from "../../work.js";
import PushPermissionBanner from "../../components/PushPermissionBanner.jsx";

// Koç — Öğrencilerim (şartname Z3). Sağdaki yüzde tamamlama oranı: tüm öğretmenlerin ödevlerinden öğrencinin sorumlu olduğu
// (tamamladığı ya da süresi dolmuş) ödevlerin yüzde kaçını tamamladığı (server > teacher.js > completionRate).
// Sıralama: önce ödevi geciken, sonra tamamlama oranı düşük olan; eşitlikte en geriden (giriş yok, pas).
// Kartın altındaki gerekçe çipi (ör. "2 sessiz ödev (14 gün)") raporun koç panelindeki gerekçelerin
// ilki — src/studentStatus.js raporun modelini öğrenci öğrenci çalıştırır; liste onu beklemeden çizilir.

// Uygulamayı açmadığı gün sayısı (giriş yoksa sıralamada öne çıkar); aktifse 0.
function inactiveDays(s) {
  const info = lastSeenInfo(s.lastSeenAt, s.createdAt);
  return info.inactive ? info.days : 0;
}

// Tamamlama oranının dönemi (yüzdeye dokununca seçilir) cihazda hatırlanır — okunamazsa haftalık.
const PERIODS = [
  { id: "day", label: "Günlük", word: "bugün", hint: "Bitiş günü bugün olan ödevler" },
  { id: "week", label: "Haftalık", word: "bu hafta", hint: "Bitiş günü bu hafta (Pzt–Paz) olan ödevler" },
  { id: "month", label: "Aylık", word: "bu ay", hint: "Bitiş günü bu ay olan ödevler" },
];
const PERIOD_KEY = "kocluk-completion-period";
function readPeriod() {
  try { const v = localStorage.getItem(PERIOD_KEY); return PERIODS.some((p) => p.id === v) ? v : "week"; } catch { return "week"; }
}
function writePeriod(v) {
  try { localStorage.setItem(PERIOD_KEY, v); } catch { /* tercih yalnızca kolaylık */ }
}
const rateIn = (s, period) => s.completion?.[period] ?? null;

function compareStudents(a, b, period) {
  // Sorumlu olduğu ödev yoksa (null) sıralamada 100 sayılır — geride değil.
  const rateOf = (s) => rateIn(s, period) ?? 100;
  const lateA = a.overdueCount > 0 ? 1 : 0;
  const lateB = b.overdueCount > 0 ? 1 : 0;
  const skippedA = a.week.filter((w) => w.status === "skipped").length;
  const skippedB = b.week.filter((w) => w.status === "skipped").length;
  return lateB - lateA || (b.overdueCount || 0) - (a.overdueCount || 0) || rateOf(a) - rateOf(b)
    || inactiveDays(b) - inactiveDays(a) || skippedB - skippedA || (a.name || "").localeCompare(b.name || "", "tr");
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

// Kartın tamamı öğrenciyi açar (fare/dokunma); klavyede ad düğmesi. Yüzde ayrı bir düğme — dönem seçimini açar,
// kartın açılmasını tetiklemez (iç içe etkileşimli öğe olmasın diye kart kendisi düğme değil).
function StudentCard({ s, st, onOpen, period, onPickPeriod }) {
  const chips = chipsOf(s, st);
  const late = s.overdueCount > 0;
  const rate = rateIn(s, period);
  const word = PERIODS.find((p) => p.id === period).word;
  return (
    <div data-student-card="" onClick={() => onOpen(s.id, s.name)} className="k-card-hover" style={{ background: C.surface, padding: 14, borderRadius: 20, cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="button" style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12, padding: 0, background: "none", border: "none", textAlign: "left", cursor: "pointer" }}>
          <Avatar name={s.name} size={44} tint />
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontFamily: bodyFont, fontSize: 15, fontWeight: 700, color: C.inkText }}>{s.name}</span>
            {s.className && <span style={{ display: "block", fontFamily: bodyFont, fontSize: 12.5, color: C.inkMuted, marginTop: 2 }}>{s.className}</span>}
          </span>
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPickPeriod(); }}
          aria-label={`Tamamlama ${word} ${rate != null ? `yüzde ${rate}` : "yok"} — dönemi değiştir`}
          style={{ flexShrink: 0, minHeight: 44, minWidth: 64, padding: "2px 0 2px 8px", background: "none", border: "none", textAlign: "right", cursor: "pointer" }}
        >
          <span style={{ ...NUM, display: "block", fontSize: 22, fontWeight: 800, lineHeight: 1, color: rate != null ? C.inkText : C.inkMuted }}>{rate != null ? `%${rate}` : "—"}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontFamily: bodyFont, fontSize: 11, color: C.inkMuted, marginTop: 3 }}>
            {word}<ChevronDown size={12} aria-hidden="true" />
          </span>
        </button>
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
    </div>
  );
}

function PeriodModal({ value, onPick, onClose }) {
  return (
    <Modal title="Tamamlama oranı" onClose={onClose}>
      <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.mutedLight, lineHeight: 1.5, marginBottom: 14 }}>
        Tüm öğretmenlerin ödevlerinden, öğrencinin sorumlu olduklarının (tamamladığı ya da süresi dolmuş) yüzde kaçını tamamladığı.
      </div>
      <div role="radiogroup" aria-label="Dönem" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {PERIODS.map((p) => {
          const on = p.id === value;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onPick(p.id)}
              style={{
                display: "flex", alignItems: "center", gap: 12, minHeight: 56, padding: "0 14px", borderRadius: 14, cursor: "pointer", textAlign: "left",
                background: on ? C.brandTint : C.pageTint, border: `1.5px solid ${on ? C.brand : "transparent"}`,
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontFamily: bodyFont, fontSize: 15, fontWeight: 700, color: C.inkText }}>{p.label}</span>
                <span style={{ display: "block", fontFamily: bodyFont, fontSize: 12.5, color: C.inkMuted, marginTop: 2 }}>{p.hint}</span>
              </span>
              {on && <Check size={18} color={C.brandText} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

export default function TeacherStudentsScreen({ user, onOpen, unreadCount, onOpenNotifications, onOpenMonthly }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  // id → { status, statusLabel, reasons }; yalnızca gelenler (gerekçe çipi için). Önbellektekiler ilk çizimde hazır.
  const [statuses, setStatuses] = useState({});
  const [period, setPeriod] = useState(readPeriod);
  const [periodOpen, setPeriodOpen] = useState(false);
  const pickPeriod = (v) => { setPeriod(v); writePeriod(v); setPeriodOpen(false); };

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
  const sorted = useMemo(() => [...students].sort((a, b) => compareStudents(a, b, period)), [students, period]);
  // Gerekçe yüklemesi dönem değişince yeniden başlamasın diye sıra, öğrenci listesinin ilk sırası.
  const loadOrder = useMemo(() => [...students].sort((a, b) => compareStudents(a, b, readPeriod())), [students]);

  // Gerekçeler listedeki sırayla (üstteki önce) yüklenir; ekran kapanınca sıradakiler için istek başlatılmaz.
  useEffect(() => {
    if (!loadOrder.length) return undefined;
    const ctrl = new AbortController();
    loadStudentStatuses(loadOrder.map((s) => s.id), {
      signal: ctrl.signal,
      onStatus: (id, value) => setStatuses((prev) => (prev[id] === value ? prev : { ...prev, [id]: value })),
    });
    return () => ctrl.abort();
  }, [loadOrder]);

  const behind = students.filter((s) => s.overdueCount > 0).length;
  const skippedWeek = students.reduce((n, s) => n + s.week.filter((w) => w.status === "skipped").length, 0);
  const rates = students.map((s) => rateIn(s, period)).filter((n) => n != null);
  const avgRate = rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : null;

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
            <HeroStat label={`ort. tamamlama · ${PERIODS.find((p) => p.id === period).word}`} value={avgRate != null ? `%${avgRate}` : "—"} />
          </div>
        )}
      </HeroHeader>

      {periodOpen && <PeriodModal value={period} onPick={pickPeriod} onClose={() => setPeriodOpen(false)} />}
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
            <h2 style={{ margin: "0 0 12px", fontFamily: displayFont, fontSize: 19, fontWeight: 800, color: C.inkText }}>Bu haftanın durumu</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {sorted.map((s) => <StudentCard key={s.id} s={s} st={statuses[s.id]} onOpen={onOpen} period={period} onPickPeriod={() => setPeriodOpen(true)} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
