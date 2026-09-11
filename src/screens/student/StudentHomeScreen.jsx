import { useEffect, useState } from "react";
import { ChevronRight, CalendarClock, AlertTriangle, BookOpen, ListOrdered } from "lucide-react";
import { C, displayFont, bodyFont } from "../../theme.js";
import { Card, Button, Select, Pill, EmptyState, StatCard } from "../../components/common.jsx";
import { api } from "../../api.js";
import { ALL_SUBJECTS, trackForGrade, subjectIconUrl } from "../../subjects.js";
import { daysUntil } from "../../dates.js";

const COMPLETED_PAGE_SIZE = 10;
const COMPLETED_INITIAL_COUNT = 2;

function AssignmentRow({ r, onOpen }) {
  const daysLeft = !r.completed ? daysUntil(r.assignment.endDate) : 0;
  const isOverdue = daysLeft < 0;
  return (
    <Card hover style={{ padding: 16, cursor: "pointer" }}>
      <div onClick={() => onOpen(r.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <img src={subjectIconUrl(r.assignment.subject)} alt="" width={38} height={38} style={{ borderRadius: 10, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: bodyFont, fontSize: 14.5, fontWeight: 700, color: C.text }}>{r.assignment.subject} — {r.assignment.topic}</span>
            {r.completed ? (
              <Pill tone="green">Tamamlandı</Pill>
            ) : isOverdue ? (
              <Pill tone="red"><AlertTriangle size={11} strokeWidth={2.5} /> {Math.abs(daysLeft)} gün gecikti</Pill>
            ) : (
              <Pill tone="amber">{daysLeft === 0 ? "Bugün son gün" : daysLeft === 1 ? "Yarın son gün" : `${daysLeft} gün kaldı`}</Pill>
            )}
            <Pill>{r.assignment.examType}</Pill>
          </div>
          {(r.assignment.sourceBook || r.assignment.pageRange) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {r.assignment.sourceBook && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 5, background: C.surface2, color: C.muted,
                  fontFamily: bodyFont, fontSize: 11.5, fontWeight: 700, padding: "4px 9px", borderRadius: 8,
                }}>
                  <BookOpen size={12} strokeWidth={2.3} /> {r.assignment.sourceBook}
                </span>
              )}
              {r.assignment.pageRange && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 5, background: C.surface2, color: C.muted,
                  fontFamily: bodyFont, fontSize: 11.5, fontWeight: 700, padding: "4px 9px", borderRadius: 8,
                }}>
                  <ListOrdered size={12} strokeWidth={2.3} /> {r.assignment.pageRange}
                </span>
              )}
            </div>
          )}
        </div>
        <ChevronRight size={18} color={C.muted} />
      </div>
    </Card>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontFamily: displayFont, fontSize: 13, fontWeight: 800, color: C.mutedLight, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
      {children}
    </div>
  );
}

function CountdownSegment({ value, label }) {
  return (
    <div style={{ minWidth: 56, textAlign: "center" }}>
      <div style={{ fontFamily: displayFont, fontSize: 34, fontWeight: 800, color: C.text, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
        {String(value).padStart(2, "0")}
      </div>
      <div style={{ fontFamily: bodyFont, fontSize: 10.5, fontWeight: 700, color: C.mutedLight, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 6 }}>
        {label}
      </div>
    </div>
  );
}

function CountdownDivider() {
  return <div style={{ width: 1, height: 34, background: C.border, flexShrink: 0 }} />;
}

// Başlığı (ikon + "X'YE KALAN") ortalanmış, kartın kalan içeriği duruma göre değişen ortak kabuk.
function ExamCountdownShell({ track, children }) {
  return (
    <Card style={{ marginBottom: 22, padding: "22px 20px", textAlign: "center" }}>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 14px 6px 10px", borderRadius: 999,
        background: C.accentSoft, marginBottom: 18,
      }}>
        <CalendarClock size={14} color={C.accent} strokeWidth={2.4} />
        <span style={{ fontFamily: displayFont, fontSize: 12, fontWeight: 800, color: C.accent, textTransform: "uppercase", letterSpacing: 0.6 }}>
          {track}'ye Kalan
        </span>
      </div>
      {children}
    </Card>
  );
}

// Saniye hassasiyeti göstermiyoruz (gün/saat/dakika yeterli) — bu yüzden dakikada bir yenilense
// yeterli, saniyede bir yeniden render etmenin bir faydası yok.
function useNowTicking(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

// Sınav tarihi admin panelinden yalnızca GÜN olarak girildiği için (bkz. AdminUsersScreen >
// ExamDatesCard), depolanan değer o günün UTC gece yarısı — geri sayım bu ana kadar hesaplanır.
function ExamCountdownCard({ track, examDate }) {
  const now = useNowTicking();
  if (!track) return null;

  if (!examDate) {
    return (
      <ExamCountdownShell track={track}>
        <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.muted }}>Sınav tarihi henüz girilmedi.</div>
      </ExamCountdownShell>
    );
  }

  const diffMs = new Date(examDate).getTime() - now;
  if (diffMs <= 0) {
    return (
      <ExamCountdownShell track={track}>
        <div style={{ fontFamily: bodyFont, fontSize: 14, fontWeight: 700, color: C.text }}>Sınav tarihi geldi — bol şans! 🍀</div>
      </ExamCountdownShell>
    );
  }

  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  return (
    <ExamCountdownShell track={track}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
        <CountdownSegment value={days} label="Gün" />
        <CountdownDivider />
        <CountdownSegment value={hours} label="Saat" />
        <CountdownDivider />
        <CountdownSegment value={minutes} label="Dakika" />
      </div>
    </ExamCountdownShell>
  );
}

export default function StudentHomeScreen({ user, onOpen, refreshKey }) {
  const [recipients, setRecipients] = useState([]);
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [stats, setStats] = useState(null);
  const [examDates, setExamDates] = useState(null);
  // Tamamlananlar ilk açılışta yalnızca 2 tanesi gösterilir — "Devamını Gör" her basışta 10 tane
  // daha açar. Ders filtresi ya da liste değişince (yeni bir ödev tamamlanınca) baştan başlar.
  const [visibleCompletedCount, setVisibleCompletedCount] = useState(COMPLETED_INITIAL_COUNT);
  // Üstteki "Bekleyen/Geciken/Tamamlanan" kartlarına tıklayınca aşağıdaki listeyi filtreler —
  // aynı karta tekrar basmak "Tümü"ne (varsayılan, iki bölüm birden) geri döner.
  const [assignmentFilter, setAssignmentFilter] = useState("all"); // "all" | "pending" | "overdue" | "completed"
  const toggleFilter = (f) => setAssignmentFilter((cur) => (cur === f ? "all" : f));

  useEffect(() => {
    setLoading(true);
    setLoadError("");
    api.listMyAssignments({ subject: subject || undefined })
      .then(({ recipients }) => setRecipients(recipients))
      .catch((e) => setLoadError(e.message || "Ödevler yüklenemedi"))
      .finally(() => setLoading(false));
  }, [subject, refreshKey]);

  useEffect(() => { api.studentStats().then(setStats).catch(() => {}); }, [refreshKey]);
  useEffect(() => { api.getExamDates().then(setExamDates).catch(() => {}); }, []);
  useEffect(() => { setVisibleCompletedCount(COMPLETED_INITIAL_COUNT); setAssignmentFilter("all"); }, [subject, refreshKey]);

  const pending = recipients.filter((r) => !r.completed);
  // Geciken ödevler artık kendi ayrı başlığında (en üstte) gösteriliyor — "Bekleyen Ödevler"
  // bölümüyle çakışıp aynı ödevin iki kez listelenmemesi için buradan çıkarılıyor.
  const overdue = pending.filter((r) => daysUntil(r.assignment.endDate) < 0);
  // En az günü kalan (en acil) en üstte olacak şekilde sıralanır.
  const notOverdue = pending
    .filter((r) => daysUntil(r.assignment.endDate) >= 0)
    .sort((a, b) => daysUntil(a.assignment.endDate) - daysUntil(b.assignment.endDate));
  const completed = recipients.filter((r) => r.completed);
  const visibleCompleted = completed.slice(0, visibleCompletedCount);
  const hasMoreCompleted = completed.length > visibleCompletedCount;

  // 7-8. sınıf LGS'ye, 9-12. sınıf YKS'ye hazırlanıyor (bkz. subjects.js > trackForGrade) — sayaç
  // öğrencinin kendi sınavına göre otomatik seçilir, admin panelinden girilen tarihi okur.
  const track = trackForGrade(user?.gradeLevel);
  const examDate = track === "LGS" ? examDates?.lgsExamDate : track === "YKS" ? examDates?.yksExamDate : null;

  return (
    <div style={{ padding: 28, maxWidth: 760, margin: "0 auto" }}>
      <ExamCountdownCard track={track} examDate={examDate} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div style={{ minWidth: 170 }}>
          <Select value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">Tüm dersler</option>
            {ALL_SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>
      </div>

      {stats && (
        <div style={{ display: "flex", gap: 12, marginBottom: 22, flexWrap: "wrap" }}>
          <StatCard label="Bekleyen" value={notOverdue.length} tone="amber" onClick={() => toggleFilter("pending")} active={assignmentFilter === "pending"} />
          <StatCard label="Geciken" value={overdue.length} tone="red" onClick={() => toggleFilter("overdue")} active={assignmentFilter === "overdue"} />
          <StatCard label="Tamamlanan" value={stats.completedCount} tone="green" onClick={() => toggleFilter("completed")} active={assignmentFilter === "completed"} />
          <StatCard label="Serbest Çalışma" value={stats.studySessionCount} tone="accent" />
        </div>
      )}

      {loading ? (
        <EmptyState text="Yükleniyor..." />
      ) : loadError ? (
        <EmptyState text={loadError} />
      ) : recipients.length === 0 ? (
        <EmptyState text="Henüz sana gönderilmiş bir ödev yok." />
      ) : (
        <>
          {(assignmentFilter === "all" || assignmentFilter === "overdue") && (
            <div style={{ marginBottom: 28 }}>
              <SectionTitle>Geciken Ödevler ({overdue.length})</SectionTitle>
              {overdue.length === 0 ? (
                <EmptyState text="Geciken ödevin yok." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {overdue.map((r) => <AssignmentRow key={r.id} r={r} onOpen={onOpen} />)}
                </div>
              )}
            </div>
          )}
          {(assignmentFilter === "all" || assignmentFilter === "pending") && (
            <div style={{ marginBottom: 28 }}>
              <SectionTitle>Bekleyen Ödevler ({notOverdue.length})</SectionTitle>
              {notOverdue.length === 0 ? (
                <EmptyState text="Bekleyen ödevin yok, harika gidiyorsun." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {notOverdue.map((r) => <AssignmentRow key={r.id} r={r} onOpen={onOpen} />)}
                </div>
              )}
            </div>
          )}

          {(assignmentFilter === "all" || assignmentFilter === "completed") && (
            <div>
              <SectionTitle>Tamamlanan Ödevler ({completed.length})</SectionTitle>
              {completed.length === 0 ? (
                <EmptyState text="Henüz tamamladığın bir ödev yok." />
              ) : (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {visibleCompleted.map((r) => <AssignmentRow key={r.id} r={r} onOpen={onOpen} />)}
                  </div>
                  {hasMoreCompleted && (
                    <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
                      <Button variant="secondary" small onClick={() => setVisibleCompletedCount((n) => n + COMPLETED_PAGE_SIZE)}>
                        Devamını Gör ({completed.length - visibleCompleted.length} tane daha)
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
