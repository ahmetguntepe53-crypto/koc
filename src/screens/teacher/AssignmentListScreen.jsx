import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronDown, ChevronRight, CalendarDays, Users } from "lucide-react";
import { C, displayFont, bodyFont } from "../../theme.js";
import { Card, Avatar, EmptyState, LoadingState } from "../../components/common.jsx";
import { HeroHeader, HeroBell, OverlapCard, SegmentFilter, StatusChip, ProgressRing, NUM } from "../../components/brand.jsx";
import { api } from "../../api.js";
import { daysUntil } from "../../dates.js";

const day2 = (d) => String(d.getDate()).padStart(2, "0");
const mon = (d) => d.toLocaleDateString("tr-TR", { month: "short" });
function dateLabel(startIso, endIso) {
  const s = new Date(startIso);
  const e = new Date(endIso);
  if (s.toDateString() === e.toDateString()) return `${day2(e)} ${mon(e)}`;
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) return `${day2(s)} – ${day2(e)} ${mon(e)}`;
  return `${day2(s)} ${mon(s)} – ${day2(e)} ${mon(e)}`;
}

// Bir ödevin listede gösterilen her şeyi — tarihler bugüne göre. "Gecikti": son günü geçmiş, sonucunu
// girmemiş ve pas da geçmemiş öğrenci (detay ekranıyla aynı tanım).
function summarize(a) {
  const total = a.recipients.length;
  const done = a.recipients.filter((r) => r.submission).length;
  const isSent = a.status === "SENT";
  const startIn = daysUntil(a.scheduledDate);
  const daysLeft = daysUntil(a.endDate);
  const late = isSent && daysLeft < 0 ? a.recipients.filter((r) => !r.submission && !r.skippedAt).length : 0;
  let phase;
  if (startIn > 0) phase = { tone: "brand", label: startIn === 1 ? "Yarın başlıyor" : `${startIn} gün sonra` };
  else if (!isSent) phase = { tone: "track", label: "Gönderilmedi" };
  else if (daysLeft >= 0) phase = { tone: "success", label: daysLeft === 0 ? "Aktif · son gün" : `Aktif · ${daysLeft} gün kaldı` };
  else phase = { tone: "track", label: "Süre doldu" };
  return { a, total, done, late, active: daysLeft >= 0, phase };
}

// Pazartesi başlayan hafta; "Bu hafta" = tarih aralığı bu haftaya değen ödevler.
function weekBounds() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const start = new Date(d);
  start.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return [start.getTime(), end.getTime()];
}
function groupOf(a, [ws, we]) {
  if (new Date(a.scheduledDate).getTime() >= we) return "later";
  if (new Date(a.endDate).getTime() < ws) return "earlier";
  return "week";
}
const GROUPS = [["later", "İleride"], ["week", "Bu hafta"], ["earlier", "Önceki haftalar"]];

export default function AssignmentListScreen({ onOpen, refreshKey, user, unreadCount, onOpenNotifications }) {
  const [assignments, setAssignments] = useState([]);
  const [subject, setSubject] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    setLoading(true);
    setLoadError("");
    api.listAssignments()
      .then(({ assignments }) => setAssignments(assignments))
      .catch((e) => setLoadError(e.message || "Ödevler yüklenemedi"))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const all = useMemo(() => assignments.map(summarize), [assignments]);
  const subjects = useMemo(() => [...new Set(assignments.map((a) => a.subject))].sort((x, y) => x.localeCompare(y, "tr")), [assignments]);
  const bySubject = subject ? all.filter((x) => x.a.subject === subject) : all;
  const counts = { all: bySubject.length, active: bySubject.filter((x) => x.active).length, late: bySubject.filter((x) => x.late > 0).length };
  const visible = filter === "active" ? bySubject.filter((x) => x.active) : filter === "late" ? bySubject.filter((x) => x.late > 0) : bySubject;

  const doneSum = all.reduce((n, x) => n + x.done, 0);
  const totalSum = all.reduce((n, x) => n + x.total, 0);
  const lateAssignments = all.filter((x) => x.late > 0).length;

  const bounds = weekBounds();
  const sorted = [...visible].sort((x, y) => new Date(y.a.scheduledDate) - new Date(x.a.scheduledDate));
  const groups = GROUPS.map(([id, title]) => ({ id, title, items: sorted.filter((x) => groupOf(x.a, bounds) === id) })).filter((g) => g.items.length);

  return (
    <div>
      <HeroHeader>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar name={user?.name} size={44} lime />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.onBrandMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Merhaba, {user?.name}</div>
            <h1 style={{ margin: 0, fontFamily: displayFont, fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: C.onBrand }}>Gönderdiğim ödevler</h1>
          </div>
          <HeroBell unreadCount={unreadCount} onClick={onOpenNotifications} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 18 }}>
          <HeroStat label="Ödev" value={all.length} />
          <HeroStat label="Teslim" value={<>{doneSum}<span style={{ color: C.onBrandMuted }}>/{totalSum}</span></>} />
          <HeroStat label="Gecikti" value={lateAssignments} lime />
        </div>
      </HeroHeader>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 16px 24px" }}>
        <OverlapCard overlap={44} style={{ padding: 8 }}>
          <label style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, minHeight: 44, padding: "0 12px 0 8px", borderRadius: 14, background: C.pageTint, cursor: "pointer" }}>
            <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: 8, background: C.brand, color: C.onBrand, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <BookOpen size={15} strokeWidth={2.4} />
            </span>
            <span style={{ flex: 1, minWidth: 0, fontFamily: bodyFont, fontSize: 14.5, fontWeight: 600, color: C.inkText }}>{subject || "Tüm dersler"}</span>
            <ChevronDown size={18} color={C.inkMuted} aria-hidden="true" />
            <select
              aria-label="Derse göre filtrele"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", fontSize: 16 }}
            >
              <option value="">Tüm dersler</option>
              {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <SegmentFilter
            label="Ödevleri filtrele"
            value={filter}
            onChange={setFilter}
            style={{ marginTop: 8, padding: 0 }}
            options={[
              { id: "all", label: "Tümü", count: counts.all },
              { id: "active", label: "Aktif", count: counts.active },
              { id: "late", label: "Gecikti", count: counts.late },
            ]}
          />
        </OverlapCard>

        {loading ? (
          <div style={{ marginTop: 20 }}><LoadingState /></div>
        ) : loadError ? (
          <div style={{ marginTop: 20 }}><EmptyState text={loadError} /></div>
        ) : assignments.length === 0 ? (
          <div style={{ marginTop: 20 }}><EmptyState text="Henüz ödev göndermedin — alttaki 'Ödev ata' sekmesinden başlayabilirsin." /></div>
        ) : groups.length === 0 ? (
          <div style={{ marginTop: 20 }}><EmptyState compact text="Bu filtrede ödev yok." /></div>
        ) : groups.map((g, i) => (
          <section key={g.id} style={{ marginTop: 22 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontFamily: displayFont, fontSize: 19, fontWeight: 800, color: C.inkText }}>{g.title}</h2>
              {i === 0 && <span style={{ fontFamily: bodyFont, fontSize: 12, color: C.inkMuted }}>Yeniden eskiye</span>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {g.items.map((x) => <AssignmentCard key={x.a.id} item={x} onOpen={onOpen} />)}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function HeroStat({ label, value, lime }) {
  return (
    <div style={{ minWidth: 0, borderRadius: 16, padding: "12px 12px 10px", background: lime ? C.lime : C.onBrandBox, color: lime ? C.ink : C.onBrand }}>
      <div style={{ ...NUM, fontSize: 22, fontWeight: 800, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontFamily: bodyFont, fontSize: 12, fontWeight: lime ? 700 : 500, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function AssignmentCard({ item, onOpen }) {
  const { a, total, done, late, phase } = item;
  const hasLate = late > 0;
  return (
    <Card
      hover
      onClick={() => onOpen(a.id)}
      style={{ padding: 14, borderRadius: 20, cursor: "pointer", border: hasLate ? `1px solid ${C.dangerBorder}` : "none", background: hasLate ? C.dangerTint : C.surface }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <ProgressRing size={52} stroke={6} value={total ? done / total : 0} showZero color={hasLate ? C.success : C.brand} track={C.track} label={`${total} öğrenciden ${done} tamamladı`}>
          <span style={{ ...NUM, fontSize: 13, fontWeight: 800, color: C.inkText }}>{done}/{total}</span>
        </ProgressRing>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: bodyFont, fontSize: 12, fontWeight: 600, color: C.brandText }}>{[a.subject, a.sourceBook].filter(Boolean).join(" · ")}</div>
          <div style={{ fontFamily: displayFont, fontSize: 17, fontWeight: 800, color: C.inkText, lineHeight: 1.2, marginTop: 2, overflowWrap: "anywhere" }}>{a.topic}</div>
          <div style={{ ...NUM, display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px 12px", fontSize: 12, color: C.inkMuted, marginTop: 6 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><CalendarDays size={13} aria-hidden="true" />{dateLabel(a.scheduledDate, a.endDate)}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Users size={13} aria-hidden="true" />{total} öğrenci</span>
          </div>
        </div>
        {a.successPct != null && (
          <div style={{ textAlign: "right", flexShrink: 0, alignSelf: "flex-start" }}>
            <div style={{ ...NUM, fontSize: 20, fontWeight: 800, color: C.inkText, lineHeight: 1.1 }}>%{a.successPct}</div>
            <div style={{ fontFamily: bodyFont, fontSize: 11, color: C.inkMuted, marginTop: 2 }}>başarı</div>
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 12, paddingTop: 12, borderTop: `1px solid ${hasLate ? C.dangerBorder : C.cardDivider}` }}>
        <StatusChip tone={phase.tone}>{phase.label}</StatusChip>
        {hasLate && <StatusChip tone="danger">{late} gecikti</StatusChip>}
        <StatusChip tone="brand">{a.examType}</StatusChip>
        <span aria-hidden="true" style={{
          marginLeft: "auto", width: 32, height: 32, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
          background: hasLate ? C.danger : C.brandTint, color: hasLate ? C.onBrand : C.brandText,
        }}>
          <ChevronRight size={17} strokeWidth={2.4} />
        </span>
      </div>
    </Card>
  );
}
