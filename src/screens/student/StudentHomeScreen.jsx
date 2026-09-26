import { useEffect, useState } from "react";
import { Clock, ClipboardCheck, PartyPopper } from "lucide-react";
import { C, bodyFont, monoFont, formatNet } from "../../theme.js";
import { Select, Pill, EmptyState, StatCard, StatGrid, SectionHeader, AssignmentRow, ShowMoreButton, LoadingState, Num } from "../../components/common.jsx";
import { api } from "../../api.js";
import { ALL_SUBJECTS, subjectIconUrl } from "../../subjects.js";
import { daysUntil } from "../../dates.js";
import PushPermissionBanner from "../../components/PushPermissionBanner.jsx";

// Geciken/Bekleyen: başta en fazla 2 satır, "N tane daha" her basışta 5 tane daha açar.
// Tamamlanan: başta 1 satır — başlıktaki "Tümü" hepsini açar, "Daha az" yeniden 1'e indirir.
const PAGE_SIZE = 5;
const INITIAL_OPEN_COUNT = 2;
const INITIAL_COMPLETED_COUNT = 1;

// Satırdaki durum rozeti: geciken kırmızı "N gün gecikti", bekleyen amber kalan gün, tamamlanan yeşil
// "Net 16,25" — tamamlanmış bir ödevin en değerli bilgisi sonucudur (sonuç yoksa "Tamamlandı").
function statusBadge(r) {
  if (r.completed) {
    const s = r.submission;
    if (!s) return <Pill tone="green">Tamamlandı</Pill>;
    return <Pill tone="green" mono>Net {formatNet(s.correctCount - s.wrongCount / 4)}</Pill>;
  }
  const daysLeft = daysUntil(r.assignment.endDate);
  if (daysLeft < 0) return <Pill tone="red"><Num>{Math.abs(daysLeft)}</Num>gün gecikti</Pill>;
  if (daysLeft === 0) return <Pill tone="amber">Bugün son gün</Pill>;
  if (daysLeft === 1) return <Pill tone="amber">Yarın</Pill>;
  return <Pill tone="amber"><Num>{daysLeft}</Num>gün kaldı</Pill>;
}

function Row({ r, onOpen }) {
  const a = r.assignment;
  const status = r.completed ? "done" : daysUntil(a.endDate) < 0 ? "overdue" : "pending";
  return (
    <AssignmentRow
      iconSrc={subjectIconUrl(a.subject)}
      title={`${a.subject} — ${a.topic}`}
      status={status}
      badge={statusBadge(r)}
      meta={[a.examType, a.pageRange].filter(Boolean).join(" · ")}
      onClick={() => onOpen(r.id)}
    />
  );
}

function RowList({ rows, onOpen }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map((r) => <Row key={r.id} r={r} onOpen={onOpen} />)}
    </div>
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

// Sınav tarihi admin panelinden yalnızca GÜN olarak girilir (bkz. AdminUsersScreen > ExamDatesCard),
// depolanan değer o günün UTC gece yarısı. Geri sayım YKS'nin ilk oturumu TYT'nin başlangıcına —
// Türkiye saatiyle 10.15'e (UTC 07.15) — göre hesaplanır; önceden gece yarısına sayıyordu.
const TYT_START_UTC_OFFSET_MS = (7 * 60 + 15) * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// "19 Haz 2027" — kısa ay adı, Türkiye saatine göre (gece yarısı UTC değeri cihaz saatiyle kaymasın).
function examShortDate(examDate) {
  return new Date(examDate).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Istanbul" });
}

// Mor gradyan kart: üst satırda saat ikonu + "YKS'YE KALAN" ve sağda tarih, altında duruma göre
// değişen içerik. Renkler countdown* jetonlarından — koyu temada altın gradyana döner.
function ExamCountdownShell({ dateLabel, children }) {
  return (
    <div style={{
      background: C.countdownBg, boxShadow: C.countdownShadow, color: C.onCountdown,
      borderRadius: C.radiusLg, padding: "15px 16px", marginBottom: 14,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, opacity: 0.75, minWidth: 0 }}>
          <Clock size={13} strokeWidth={2.4} style={{ flexShrink: 0 }} />
          <span style={{ fontFamily: bodyFont, fontSize: 10.5, fontWeight: 800, letterSpacing: 1.3, whiteSpace: "nowrap" }}>YKS'YE KALAN</span>
        </div>
        {dateLabel && <span style={{ fontFamily: bodyFont, fontSize: 11, fontWeight: 500, opacity: 0.62, whiteSpace: "nowrap" }}>{dateLabel}</span>}
      </div>
      <div style={{ marginTop: 8 }}>{children}</div>
    </div>
  );
}

function CountdownMessage({ children }) {
  return <div style={{ fontFamily: bodyFont, fontSize: 14.5, fontWeight: 700, lineHeight: 1.4, padding: "4px 0 2px" }}>{children}</div>;
}

// Saat/dakika: gün sayısından küçük, ikincil — "00 sa  37 dk".
function CountdownUnit({ value, unit }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4 }}>
      <span style={{ fontFamily: monoFont, fontSize: 19, fontWeight: 700, letterSpacing: -0.4, opacity: 0.92 }}>{String(value).padStart(2, "0")}</span>
      <span style={{ fontFamily: bodyFont, fontSize: 12, fontWeight: 600, opacity: 0.7 }}>{unit}</span>
    </span>
  );
}

function ExamCountdownCard({ examDate }) {
  const now = useNowTicking();

  if (!examDate) {
    return (
      <ExamCountdownShell>
        <CountdownMessage>YKS tarihi henüz girilmedi.</CountdownMessage>
      </ExamCountdownShell>
    );
  }

  const examStart = new Date(examDate).getTime() + TYT_START_UTC_OFFSET_MS;
  const diffMs = examStart - now;
  if (diffMs <= 0) {
    // Sınav günü (TYT + ertesi gün AYT) "bol şans"; ondan sonra kayıtlı tarih eskimiş demektir — bir
    // sonraki yılın tarihi girilene kadar eski sınavı "geldi" diye göstermeye devam etmesin.
    const examOver = now - examStart > 2 * ONE_DAY_MS;
    return (
      <ExamCountdownShell dateLabel={examOver ? null : examShortDate(examDate)}>
        <CountdownMessage>{examOver ? "Yeni YKS tarihi henüz girilmedi." : "Sınav günü geldi — bol şans! 🍀"}</CountdownMessage>
      </ExamCountdownShell>
    );
  }

  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  return (
    <ExamCountdownShell dateLabel={`${examShortDate(examDate)} · 10.15`}>
      {/* Gün sayısı öne çıkar, saat/dakika ikincil — eski kartta üçü eşit büyüklükteydi. */}
      <div aria-label={`${days} gün ${hours} saat ${minutes} dakika`} style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", columnGap: 14, rowGap: 2 }}>
        <span style={{ display: "inline-flex", alignItems: "baseline", gap: 5 }}>
          <span style={{ fontFamily: monoFont, fontSize: 38, fontWeight: 700, letterSpacing: -1.8, lineHeight: 1.05 }}>{days}</span>
          <span style={{ fontFamily: bodyFont, fontSize: 13, fontWeight: 600, opacity: 0.75 }}>gün</span>
        </span>
        <CountdownUnit value={hours} unit="sa" />
        <CountdownUnit value={minutes} unit="dk" />
      </div>
    </ExamCountdownShell>
  );
}

export default function StudentHomeScreen({ onOpen, refreshKey }) {
  const [recipients, setRecipients] = useState([]);
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [examDates, setExamDates] = useState(null);
  // Ders filtresi ya da liste değişince her bölüm baştan (2 / 2 / 1 satır) başlar.
  const [visibleOverdueCount, setVisibleOverdueCount] = useState(INITIAL_OPEN_COUNT);
  const [visiblePendingCount, setVisiblePendingCount] = useState(INITIAL_OPEN_COUNT);
  const [completedExpanded, setCompletedExpanded] = useState(false);
  // Üstteki "Geciken/Bekleyen/Tamamlanan" kutucuklarına tıklayınca aşağıdaki listeyi filtreler —
  // aynı kutucuğa tekrar basmak "Tümü"ne (varsayılan, üç bölüm birden) geri döner.
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

  useEffect(() => { api.getExamDates().then(setExamDates).catch(() => {}); }, []);
  // Yalnızca ders filtresi değişince baştan başlar — refreshKey artık uygulama arka plandan dönünce de
  // artıyor (bkz. App.jsx > kocluk:resume), o anda öğrencinin seçtiği kutucuk filtresi sıfırlanmamalı.
  useEffect(() => {
    setVisibleOverdueCount(INITIAL_OPEN_COUNT);
    setVisiblePendingCount(INITIAL_OPEN_COUNT);
    setCompletedExpanded(false);
    setAssignmentFilter("all");
  }, [subject]);

  const pending = recipients.filter((r) => !r.completed);
  // Geciken ödevler kendi ayrı bölümünde (en üstte) — "Bekleyen" bölümüyle çakışıp aynı ödevin iki
  // kez listelenmemesi için oradan çıkarılıyor.
  const overdue = pending.filter((r) => daysUntil(r.assignment.endDate) < 0);
  // En az günü kalan (en acil) en üstte olacak şekilde sıralanır.
  const notOverdue = pending
    .filter((r) => daysUntil(r.assignment.endDate) >= 0)
    .sort((a, b) => daysUntil(a.assignment.endDate) - daysUntil(b.assignment.endDate));
  const completed = recipients.filter((r) => r.completed);
  const visibleOverdue = overdue.slice(0, visibleOverdueCount);
  const visiblePending = notOverdue.slice(0, visiblePendingCount);
  const visibleCompleted = completedExpanded ? completed : completed.slice(0, INITIAL_COMPLETED_COUNT);

  // Okul yalnızca YKS'ye hazırlanıyor — sayaç herkes için admin panelinden girilen YKS tarihini okur.
  const examDate = examDates?.yksExamDate || null;
  // Kutucuk sayıları listeden gelir — ilk yükleme bitmeden "0 / 0 / 0" yanıp sönmesin.
  const showStats = !loadError && !(loading && recipients.length === 0);

  return (
    <div className="k-page" style={{ padding: 28, maxWidth: 760, margin: "0 auto" }}>
      <PushPermissionBanner reason="Yeni ödevleri ve son gün hatırlatmalarını kaçırmamak için." />
      {examDates && <ExamCountdownCard examDate={examDate} />}

      <Select
        aria-label="Derse göre filtrele"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        style={{ minHeight: 44, height: 44, padding: "0 14px" }}
      >
        <option value="">Tüm dersler</option>
        {ALL_SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
      </Select>

      {showStats && (
        <StatGrid>
          <StatCard label="Geciken" value={overdue.length} tone="red" onClick={() => toggleFilter("overdue")} active={assignmentFilter === "overdue"} />
          <StatCard label="Bekleyen" value={notOverdue.length} tone="amber" onClick={() => toggleFilter("pending")} active={assignmentFilter === "pending"} />
          {/* Geciken/Bekleyen gibi listeden sayılır — ders filtresi seçiliyken yalnızca o dersin toplamı. */}
          <StatCard label="Tamamlanan" value={completed.length} tone="green" onClick={() => toggleFilter("completed")} active={assignmentFilter === "completed"} />
        </StatGrid>
      )}

      {loading ? (
        <div style={{ marginTop: 22 }}><LoadingState /></div>
      ) : loadError ? (
        <EmptyState text={loadError} />
      ) : recipients.length === 0 ? (
        <EmptyState icon={ClipboardCheck} text={subject ? `${subject} dersinde sana gönderilmiş bir ödev yok.` : "Henüz sana gönderilmiş bir ödev yok. Koçun ödev gönderdiğinde burada ve bildirimlerinde göreceksin."} />
      ) : (
        <>
          {(assignmentFilter === "all" || assignmentFilter === "overdue") && (
            <section>
              <SectionHeader title="Geciken" count={overdue.length} tone="red" />
              {overdue.length === 0 ? (
                <EmptyState text="Geciken ödevin yok." />
              ) : (
                <>
                  <RowList rows={visibleOverdue} onOpen={onOpen} />
                  <ShowMoreButton remaining={overdue.length - visibleOverdue.length} onClick={() => setVisibleOverdueCount((n) => n + PAGE_SIZE)} />
                </>
              )}
            </section>
          )}

          {(assignmentFilter === "all" || assignmentFilter === "pending") && (
            <section>
              <SectionHeader title="Bekleyen" count={notOverdue.length} tone="amber" />
              {notOverdue.length === 0 ? (
                <EmptyState icon={PartyPopper} text="Bekleyen ödevin yok, harika gidiyorsun." />
              ) : (
                <>
                  <RowList rows={visiblePending} onOpen={onOpen} />
                  <ShowMoreButton remaining={notOverdue.length - visiblePending.length} onClick={() => setVisiblePendingCount((n) => n + PAGE_SIZE)} />
                </>
              )}
            </section>
          )}

          {(assignmentFilter === "all" || assignmentFilter === "completed") && (
            <section>
              <SectionHeader
                title="Tamamlanan"
                count={completed.length}
                tone="green"
                action={completed.length > INITIAL_COMPLETED_COUNT
                  ? { label: completedExpanded ? "Daha az" : "Tümü", onClick: () => setCompletedExpanded((v) => !v) }
                  : undefined}
              />
              {completed.length === 0 ? (
                <EmptyState text="Henüz tamamladığın bir ödev yok." />
              ) : (
                <RowList rows={visibleCompleted} onOpen={onOpen} />
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
