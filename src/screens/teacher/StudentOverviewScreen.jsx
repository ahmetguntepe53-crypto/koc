import { useEffect, useMemo, useState } from "react";
import { PlusCircle } from "lucide-react";
import { C, displayFont, bodyFont, monoFont, completionTone, formatNet } from "../../theme.js";
import { Card, Button, Input, Textarea, Pill, Chip, EmptyState, StatCard, StatGrid, Avatar, Modal, ShowMoreButton, LoadingState, SectionHeader, AssignmentRow, Num } from "../../components/common.jsx";
import { api } from "../../api.js";
import { subjectIconUrl, gradeLabel, GRADE_LEVELS } from "../../subjects.js";
import { formatDate, daysUntil } from "../../dates.js";

// TYT/AYT'nin standart net hesaplama formülü — server/src/routes/stats.js'deki net()'in
// birebir aynısı, burada yalnızca tamamlanan satırlardaki "Net" rozeti için ayrıca hesaplanıyor.
function net(correctCount, wrongCount) {
  return Math.round((correctCount - wrongCount / 4) * 100) / 100;
}

// KULLANICI İSTEĞİ: "Tümü" en başta aktif haldeydi — öğretmen ekranı açar açmaz önce BUGÜNÜ görmeli,
// "Tümü" daha az kullanılan bir seçenek olduğu için listenin sonuna alındı.
const DATE_FILTERS = [
  { value: "today", label: "Bugün" },
  { value: "week", label: "Bu hafta" },
  { value: "month", label: "Bu ay" },
  { value: "range", label: "Aralık" },
  { value: "all", label: "Tümü" },
];

// Her bölümde başta en fazla 2 satır; "N tane daha" her basışta 5 tane daha açar.
const INITIAL_COUNT = 2;
const PAGE_SIZE = 5;

function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
// Pazartesi başlangıçlı hafta — PlanScreen'deki takvim ızgarasıyla aynı kural (bkz. WEEKDAY_LABELS).
function startOfWeek(d) { const x = startOfDay(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
function endOfWeek(d) { const x = startOfWeek(d); x.setDate(x.getDate() + 6); return endOfDay(x); }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d) { return endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }

// Bir ödevin [scheduledDate, endDate] aralığı seçilen dönemle KESİŞİYORSA eşleşir — böylece birden
// çok günü kapsayan bir ödev, o aralığa denk gelen her dönem filtresinde de (ör. hem "Bu hafta" hem
// başladığı günün "Bugün"ünde) görünür, yalnızca tek bir güne sabitlenmiş gibi kaybolmaz.
function overlapsRange(r, range) {
  if (!range) return true;
  const [from, to] = range;
  return new Date(r.assignment.endDate) >= from && new Date(r.assignment.scheduledDate) <= to;
}

// Satırın durum rozeti — bölüme göre: geciken kırmızı gün sayısı, bekleyen amber kalan süre, taslak
// nötr, tamamlanan yeşil net (tamamlanan bir ödevin en değerli bilgisi sonucudur).
function rowStatus(r, section) {
  if (section === "overdue") {
    return { status: "overdue", badge: <Pill tone="red"><Num>{Math.abs(daysUntil(r.assignment.endDate))}</Num>gün gecikti</Pill> };
  }
  if (section === "completed") {
    return {
      status: "done",
      badge: r.submission
        ? <Pill tone="green" mono>Net {formatNet(net(r.submission.correctCount, r.submission.wrongCount))}</Pill>
        : <Pill tone="green">Tamamlandı</Pill>,
    };
  }
  // Taslak — öğrenciye henüz gönderilmedi, bu yüzden "gecikti"/"kaldı" rozeti burada ASLA
  // gösterilmemeli (öğrenci ödevi hiç görmedi ki geciksin).
  if (r.assignment.status !== "SENT") return { status: "draft", badge: <Pill tone="muted">Taslak</Pill> };
  const diff = daysUntil(r.assignment.endDate);
  return {
    status: "pending",
    badge: diff <= 0 ? <Pill tone="amber">Bugün son gün</Pill>
      : diff === 1 ? <Pill tone="amber">Yarın</Pill>
      : <Pill tone="amber"><Num>{diff}</Num>gün kaldı</Pill>,
  };
}

// coachId: öğrencinin koçu (bu ekranı açan öğretmen) — ödevi başka bir öğretmen (ör. ders öğretmeninin
// okul çapındaki ödevi ya da önceki koç) verdiyse meta satırında kimin verdiği gösterilir; detay salt okunur açılır.
function RecipientRow({ r, section, onOpen, coachId }) {
  const { status, badge } = rowStatus(r, section);
  const byOtherTeacher = r.assignment.teacherId !== coachId && r.assignment.teacher?.name;
  const meta = [r.assignment.examType, r.assignment.pageRange, byOtherTeacher ? `${r.assignment.teacher.name} verdi` : null].filter(Boolean).join(" · ");
  return (
    <AssignmentRow
      iconSrc={subjectIconUrl(r.assignment.subject)}
      title={`${r.assignment.subject} — ${r.assignment.topic}`}
      status={status}
      badge={badge}
      meta={meta}
      onClick={() => onOpen(r.assignmentId, "studentOverview")}
    />
  );
}

// Geciken / Bekleyen / Tamamlanan bölümlerinden biri. Kutucuğa tıklanıp tek bir bölüme süzülmüşken
// başlıkta adet yerine "Tümünü göster" bağlantısı çıkar — eskiden "Toplam Ödev" kutucuğu bu işi
// görüyordu, kutucuk sayısı üçe inince geri dönüş yolu buraya taşındı.
function RecipientSection({ title, tone, section, items, visibleCount, onShowMore, emptyText, onClearFilter, onOpen, coachId }) {
  return (
    <div>
      <SectionHeader
        title={title}
        count={items.length}
        tone={tone}
        action={onClearFilter ? { label: "Tümünü göster", onClick: onClearFilter } : undefined}
      />
      {items.length === 0 ? (
        <EmptyState compact text={emptyText} />
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {items.slice(0, visibleCount).map((r) => <RecipientRow key={r.id} r={r} section={section} onOpen={onOpen} coachId={coachId} />)}
          </div>
          <ShowMoreButton remaining={items.length - Math.min(visibleCount, items.length)} onClick={onShowMore} />
        </>
      )}
    </div>
  );
}

// Koçun bu öğrenci için tuttuğu özel not — yalnızca koç görür, öğrenciye hiç gösterilmez (bkz.
// server/src/serialize.js > safeUser, coachNote orada bilerek süzülüyor). Artık sayfada sürekli yer
// kaplamıyor — App.jsx'teki başlık çubuğundaki not defteri ikonu bunu bir modal olarak açıyor
// (bkz. App.jsx > coachNoteOpen). key={studentId} ile öğrenci değişince sıfırdan mount edilir.
// onSaved: kaydedilen not üst bileşenin verisine geri yazılır — modal kapanınca unmount olup bir
// sonraki açılışta initialNote'tan (ilk yüklemedeki eski not) yeniden başladığı için, aksi halde
// tekrar açınca eski not görünüyor, o haliyle kaydedilirse yeni not siliniyordu.
function CoachNoteModal({ studentId, initialNote, onClose, onSaved }) {
  const [note, setNote] = useState(initialNote || "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3000);
    return () => clearTimeout(t);
  }, [msg]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const { coachNote } = await api.teacherUpdateStudentNote(studentId, note);
      onSaved?.(coachNote);
      setMsg({ type: "ok", text: "Kaydedildi." });
    } catch (e) {
      setMsg({ type: "error", text: e.message || "Kaydedilemedi" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Notlarım" onClose={onClose}>
      <div style={{ fontFamily: bodyFont, fontSize: 11.5, color: C.muted, marginBottom: 10 }}>
        Bu öğrenci hakkında yalnızca sen görürsün — öğrenciye hiçbir zaman gösterilmez.
      </div>
      <Textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)} rows={5} placeholder="ör. Matematik konularında tekrar gerekiyor, sınav kaygısı yüksek..." />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Button small disabled={saving} onClick={save}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
        {msg && <span style={{ fontSize: 12, fontWeight: 600, color: msg.type === "error" ? C.red : C.green }}>{msg.text}</span>}
      </div>
    </Modal>
  );
}

// Öğrenci başlık kartı — eskiden ayrı kutucuklarda duran "Toplam Ödev" ve "Tamamlanma Oranı" buraya
// taşındı: altı sayıyı aynı anda kimse okumuyordu. Durumu olmayan kart → sol şerit yok.
function StudentHeaderCard({ student, assignmentCount, completionRate }) {
  const gradeOk = GRADE_LEVELS.includes(student.gradeLevel);
  const tone = completionTone(completionRate);
  return (
    <Card style={{ padding: 16, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <Avatar name={student.name} size={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ fontFamily: displayFont, fontSize: 16, fontWeight: 700, letterSpacing: -0.1, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{student.name}</span>
            {student.banned && <Pill tone="red">Askıda</Pill>}
          </div>
          <div style={{ fontFamily: bodyFont, fontSize: 12, fontWeight: 500, color: C.muted, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {student.className ? `${student.className} · ` : ""}
            {/* Düzeyi eksik/eski (11-12 dışı) olan öğrenci ödev listelerinde görünmüyor — admin düzeltmeli. */}
            <span style={gradeOk ? undefined : { color: C.red, fontWeight: 700 }}>{gradeLabel(student.gradeLevel)}</span>
            {" · "}<span style={{ fontFamily: monoFont }}>{assignmentCount}</span> ödev
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
          <span style={{ fontFamily: monoFont, fontSize: 20, fontWeight: 700, letterSpacing: -0.4, color: tone.fg, lineHeight: 1.1 }}>
            {completionRate != null ? `%${completionRate}` : "—"}
          </span>
          <span style={{ fontFamily: bodyFont, fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: C.mutedLight, marginTop: 4 }}>
            Tamamlama
          </span>
        </div>
      </div>
    </Card>
  );
}

// onBack: geri düğmesi artık App başlığında (App.jsx > headerBack) — sayfada ayrı bir "dön" bağlantısı yok.
export default function StudentOverviewScreen({ studentId, onOpenAssignment, onCreateAssignment, noteOpen, onCloseNote }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Geciken/Bekleyen/Tamamlanan kutucuklarına tıklayınca aşağıdaki liste o bölüme süzülür; aynı
  // kutucuğa tekrar basmak (ya da başlıktaki "Tümünü göster") süzmeyi kaldırır.
  const [filter, setFilter] = useState("all"); // "all" | "overdue" | "pending" | "completed"
  const toggleFilter = (value) => setFilter((f) => (f === value ? "all" : value));
  const [dateFilter, setDateFilter] = useState("today"); // bkz. DATE_FILTERS — varsayılan "Bugün"
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  // Her bölümde başta INITIAL_COUNT satır; öğrenci ya da tarih aralığı değişince baştan başlar.
  const [visibleOverdueCount, setVisibleOverdueCount] = useState(INITIAL_COUNT);
  const [visiblePendingCount, setVisiblePendingCount] = useState(INITIAL_COUNT);
  const [visibleCompletedCount, setVisibleCompletedCount] = useState(INITIAL_COUNT);
  useEffect(() => {
    setVisibleOverdueCount(INITIAL_COUNT);
    setVisiblePendingCount(INITIAL_COUNT);
    setVisibleCompletedCount(INITIAL_COUNT);
  }, [studentId, dateFilter, rangeStart, rangeEnd]);

  useEffect(() => {
    setLoading(true);
    api.teacherStudentOverview(studentId)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [studentId]);

  // React Hook kuralları gereği erken return'lerden (aşağıdaki loading/error/!data kontrolleri)
  // ÖNCE çağrılmalı — aksi halde ilk (loading) render'da hiç çağrılmayıp veri gelince çağrılmaya
  // başlar, hook sayısı render'lar arası değişir ve React "Rendered more hooks than during the
  // previous render" hatasıyla çöker (ErrorBoundary'de "bir şeyler ters gitti" olarak görünür).
  const dateRange = useMemo(() => {
    const now = new Date();
    if (dateFilter === "today") return [startOfDay(now), endOfDay(now)];
    if (dateFilter === "week") return [startOfWeek(now), endOfWeek(now)];
    if (dateFilter === "month") return [startOfMonth(now), endOfMonth(now)];
    if (dateFilter === "range" && rangeStart && rangeEnd) return [startOfDay(new Date(rangeStart)), endOfDay(new Date(rangeEnd))];
    return null;
  }, [dateFilter, rangeStart, rangeEnd]);

  const page = (children) => <div className="k-page" style={{ padding: 28, maxWidth: 760, margin: "0 auto" }}>{children}</div>;
  if (loading) return page(<LoadingState />);
  if (error) return page(<EmptyState text={error} />);
  if (!data) return null;

  const { student, recipients, studySessions } = data;
  const updateCoachNote = (coachNote) => setData((d) => ({ ...d, student: { ...d.student, coachNote } }));
  const dateFilteredRecipients = recipients.filter((r) => overlapsRange(r, dateRange));

  // Tamamlanma oranı yalnızca GÖNDERİLMİŞ (SENT) ödevler üzerinden hesaplanır — taslaklar (DRAFT)
  // öğrenciye hiç ulaşmadığı için paydaya girerse oran yapay olarak düşer, ayrıca /teacher/students
  // listesindeki orandan (o da yalnızca SENT sayar) tutarsız çıkar. Başlıktaki ödev sayısı ve aşağıdaki
  // liste yine tüm recipients'ı (taslaklar dahil) gösterir — koç planladığı her şeyi görebilsin diye.
  // Hepsi seçili tarih dönemine göre (dateFilteredRecipients) hesaplanır — "Bu ay" seçiliyken
  // başlığın ve kutucukların o ayki durumu yansıtması için.
  const sentRecipients = dateFilteredRecipients.filter((r) => r.assignment.status === "SENT");
  const completionRate = sentRecipients.length ? Math.round((sentRecipients.filter((r) => r.completed).length / sentRecipients.length) * 100) : null;
  // Taslaklar (henüz öğrenciye gönderilmemiş) "tamamlanmış" olamayacağı için doğal olarak
  // bekleyenler tarafına düşer — koç onları da burada (ayrı "Taslak" rozetiyle) görsün ister.
  const pending = dateFilteredRecipients.filter((r) => !r.completed);
  // Geciken ödevler kendi ayrı bölümünde (en üstte) gösteriliyor — "Bekleyen" bölümüyle çakışıp aynı
  // ödevin iki kez listelenmemesi için buradan çıkarılıyor.
  const isOverdue = (r) => r.assignment.status === "SENT" && daysUntil(r.assignment.endDate) < 0;
  const overdue = pending.filter(isOverdue);
  const notOverdue = pending.filter((r) => !isOverdue(r));
  const completed = dateFilteredRecipients.filter((r) => r.completed);
  const clearFilter = filter !== "all" ? () => setFilter("all") : undefined;

  return (
    <div className="k-page" style={{ padding: 28, maxWidth: 760, margin: "0 auto" }}>
      <StudentHeaderCard student={student} assignmentCount={dateFilteredRecipients.length} completionRate={completionRate} />

      {noteOpen && <CoachNoteModal key={studentId} studentId={studentId} initialNote={student.coachNote} onClose={onCloseNote} onSaved={updateCoachNote} />}

      {/* Tarih filtreleri tek satırda yatay kayar — telefonda "Tümü" tek başına alt satıra düşüyordu. */}
      <div className="k-chip-row" role="group" aria-label="Tarih aralığı" style={{ marginBottom: dateFilter === "range" ? 10 : 14, paddingBottom: 2 }}>
        {DATE_FILTERS.map((f) => (
          <Chip key={f.value} active={dateFilter === f.value} onClick={() => setDateFilter(f.value)}>{f.label}</Chip>
        ))}
      </div>
      {dateFilter === "range" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <div style={{ flex: 1, minWidth: 0 }}><Input aria-label="Başlangıç" type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} /></div>
          <span style={{ color: C.muted, fontSize: 12.5, marginBottom: 16 }}>—</span>
          <div style={{ flex: 1, minWidth: 0 }}><Input aria-label="Bitiş" type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} /></div>
        </div>
      )}

      {/* Altı kutucuk üçe indi: toplam ve oran başlık kartında, serbest çalışma sayısı kendi bölüm başlığında. */}
      <StatGrid min={90} style={{ marginBottom: 12 }}>
        <StatCard label="Geciken" value={overdue.length} tone="red" onClick={() => toggleFilter("overdue")} active={filter === "overdue"} />
        <StatCard label="Bekleyen" value={notOverdue.length} tone="amber" onClick={() => toggleFilter("pending")} active={filter === "pending"} />
        <StatCard label="Tamamlanan" value={completed.length} tone="green" onClick={() => toggleFilter("completed")} active={filter === "completed"} />
      </StatGrid>

      {/* Ekranın birincil eylemi — eskiden sağa yaslı küçük bir düğmeydi, gözden kaçıyordu. */}
      {onCreateAssignment && (
        <Button full icon={PlusCircle} onClick={() => onCreateAssignment(studentId)} style={{ height: 48 }}>Yeni ödev ata</Button>
      )}

      {recipients.length === 0 ? (
        <EmptyState text="Bu öğrenciye henüz ödev gönderilmemiş." />
      ) : dateFilteredRecipients.length === 0 ? (
        <EmptyState text="Seçilen dönemde ödev yok." />
      ) : (
        <div style={{ marginBottom: 8 }}>
          {(filter === "all" || filter === "overdue") && (
            <RecipientSection
              title="Geciken" tone="red" section="overdue" items={overdue}
              visibleCount={visibleOverdueCount} onShowMore={() => setVisibleOverdueCount((n) => n + PAGE_SIZE)}
              emptyText="Geciken ödevi yok." onClearFilter={clearFilter} onOpen={onOpenAssignment} coachId={student.teacherId}
            />
          )}
          {(filter === "all" || filter === "pending") && (
            <RecipientSection
              title="Bekleyen" tone="amber" section="pending" items={notOverdue}
              visibleCount={visiblePendingCount} onShowMore={() => setVisiblePendingCount((n) => n + PAGE_SIZE)}
              emptyText="Bekleyen ödevi yok." onClearFilter={clearFilter} onOpen={onOpenAssignment} coachId={student.teacherId}
            />
          )}
          {(filter === "all" || filter === "completed") && (
            <RecipientSection
              title="Tamamlanan" tone="green" section="completed" items={completed}
              visibleCount={visibleCompletedCount} onShowMore={() => setVisibleCompletedCount((n) => n + PAGE_SIZE)}
              emptyText="Henüz tamamlanmış ödev yok." onClearFilter={clearFilter} onOpen={onOpenAssignment} coachId={student.teacherId}
            />
          )}
        </div>
      )}

      <SectionHeader title="Serbest çalışmaları" count={studySessions.length} />
      {studySessions.length === 0 ? (
        <EmptyState text="Bu öğrenci henüz serbest çalışma kaydı girmemiş." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {studySessions.map((s) => (
            <Card key={s.id} style={{ padding: "13px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ fontFamily: bodyFont, fontSize: 14, fontWeight: 700, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{s.subject} — {s.topic}</span>
                <Pill>{s.examType}</Pill>
              </div>
              {/* Tarih ve D/Y/B rakamları mono — sayılar alt alta kartlarda hizalı dursun. */}
              <div style={{ fontFamily: monoFont, fontSize: 11.5, fontWeight: 500, color: C.mutedLight, marginTop: 5 }}>
                {formatDate(s.studyDate)} · D {s.correctCount} · Y {s.wrongCount} · B {s.blankCount}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
