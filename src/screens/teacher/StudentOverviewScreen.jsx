import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BarChart3, ChevronRight, Plus, AlertTriangle } from "lucide-react";
import { C, displayFont, bodyFont } from "../../theme.js";
import { Card, Button, Input, Textarea, Pill, EmptyState, StatCard, Avatar } from "../../components/common.jsx";
import { api } from "../../api.js";
import { trackForGrade } from "../../subjects.js";
import { formatDate, formatDateRange, daysUntil } from "../../dates.js";

// TYT/AYT/LGS'nin standart net hesaplama formülü — server/src/routes/stats.js'deki net()'in
// birebir aynısı, burada yalnızca özet kartlarda göstermek için ayrıca hesaplanıyor.
function net(correctCount, wrongCount) {
  return Math.round((correctCount - wrongCount / 4) * 100) / 100;
}

const DATE_FILTERS = [
  { value: "all", label: "Tümü" },
  { value: "today", label: "Bugün" },
  { value: "week", label: "Bu Hafta" },
  { value: "month", label: "Bu Ay" },
  { value: "range", label: "Aralık" },
];

function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
// Pazartesi başlangıçlı hafta — PlanScreen'deki takvim ızgarasıyla aynı kural (bkz. WEEKDAY_LABELS).
function startOfWeek(d) { const x = startOfDay(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
function endOfWeek(d) { const x = startOfWeek(d); x.setDate(x.getDate() + 6); return endOfDay(x); }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d) { return endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }

// Bir ödevin [scheduledDate, endDate] aralığı seçilen dönemle KESİŞİYORSA eşleşir — böylece birden
// çok günü kapsayan bir ödev, o aralığa denk gelen her dönem filtresinde de (ör. hem "Bu Hafta" hem
// başladığı günün "Bugün"ünde) görünür, yalnızca tek bir güne sabitlenmiş gibi kaybolmaz.
function overlapsRange(r, range) {
  if (!range) return true;
  const [from, to] = range;
  return new Date(r.assignment.endDate) >= from && new Date(r.assignment.scheduledDate) <= to;
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontFamily: displayFont, fontSize: 14, fontWeight: 800, color: C.mutedLight, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
      {children}
    </div>
  );
}

function RecipientRow({ r, onOpen }) {
  return (
    <Card hover style={{ padding: 14, cursor: "pointer" }}>
      <div onClick={() => onOpen(r.assignmentId, "studentOverview")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: bodyFont, fontSize: 13.5, fontWeight: 700, color: C.text }}>{r.assignment.subject} — {r.assignment.topic}</span>
            <Pill>{r.assignment.examType}</Pill>
            {r.submission ? (
              <>
                <Pill tone="green">D:{r.submission.correctCount} Y:{r.submission.wrongCount} B:{r.submission.blankCount}</Pill>
                <Pill tone="accent">Net: {net(r.submission.correctCount, r.submission.wrongCount)}</Pill>
              </>
            ) : r.assignment.status === "SENT" ? (
              r.completed ? (
                <Pill tone="green">Tamamlandı</Pill>
              ) : daysUntil(r.assignment.endDate) < 0 ? (
                <Pill tone="red"><AlertTriangle size={11} strokeWidth={2.5} /> {Math.abs(daysUntil(r.assignment.endDate))} gün gecikti</Pill>
              ) : (
                <>
                  <Pill tone="amber">Bekliyor</Pill>
                  <UrgencyPill endDate={r.assignment.endDate} />
                </>
              )
            ) : (
              // Taslak — öğrenciye henüz gönderilmedi, bu yüzden "gecikti" rozeti burada
              // ASLA gösterilmemeli (öğrenci ödevi hiç görmedi ki geciksin).
              <Pill tone="muted">Taslak — henüz gönderilmedi</Pill>
            )}
          </div>
          <div style={{ fontFamily: bodyFont, fontSize: 12, color: C.muted, marginTop: 4 }}>
            {formatDateRange(r.assignment.scheduledDate, r.assignment.endDate)}
            {r.assignment.sourceBook ? ` · ${r.assignment.sourceBook}` : ""}
            {r.assignment.pageRange ? ` · ${r.assignment.pageRange}` : ""}
          </div>
        </div>
        <ChevronRight size={16} color={C.muted} />
      </div>
    </Card>
  );
}

// Koçun bu öğrenci için tuttuğu özel not — yalnızca koç görür, öğrenciye hiç gösterilmez (bkz.
// server/src/serialize.js > safeUser, coachNote orada bilerek süzülüyor). key={studentId} ile
// üst bileşende her öğrenci değişiminde sıfırdan mount edilir, bir önceki öğrencinin taslak metni
// kalmasın diye.
function CoachNoteCard({ studentId, initialNote }) {
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
      await api.teacherUpdateStudentNote(studentId, note);
      setMsg({ type: "ok", text: "Kaydedildi." });
    } catch (e) {
      setMsg({ type: "error", text: e.message || "Kaydedilemedi" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={{ marginBottom: 20, padding: 18 }}>
      <div style={{ fontFamily: displayFont, fontSize: 13, fontWeight: 800, color: C.mutedLight, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>
        Notlarım
      </div>
      <div style={{ fontFamily: bodyFont, fontSize: 11.5, color: C.muted, marginBottom: 10 }}>
        Bu öğrenci hakkında yalnızca sen görürsün — öğrenciye hiçbir zaman gösterilmez.
      </div>
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="ör. Matematik konularında tekrar gerekiyor, sınav kaygısı yüksek..." />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: -6 }}>
        <Button small disabled={saving} onClick={save}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
        {msg && <span style={{ fontSize: 12, fontWeight: 600, color: msg.type === "error" ? C.red : C.green }}>{msg.text}</span>}
      </div>
    </Card>
  );
}

// Henüz gecikmemiş ama son 2 gün içindeyse gösterilen ek uyarı rozeti — gecikmiş olan durum
// zaten RecipientRow'da ayrı (kırmızı, "X gün gecikti") bir rozetle ele alınıyor, burada tekrarlanmaz.
function UrgencyPill({ endDate }) {
  const diff = daysUntil(endDate);
  if (diff === 0) return <Pill tone="amber">Son gün bugün</Pill>;
  if (diff === 1) return <Pill tone="amber">Son 1 gün</Pill>;
  if (diff === 2) return <Pill tone="amber">Son 2 gün</Pill>;
  return null;
}

export default function StudentOverviewScreen({ studentId, onBack, onOpenAssignment, onCreateAssignment, onOpenReport }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Üstteki "Toplam/Bekleyen/Tamamlanan" kartlarına tıklayınca aşağıdaki listeyi filtreler.
  const [filter, setFilter] = useState("all"); // "all" | "pending" | "completed"
  const [dateFilter, setDateFilter] = useState("all"); // bkz. DATE_FILTERS
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");

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

  if (loading) return <EmptyState text="Yükleniyor..." />;
  if (error) return <EmptyState text={error} />;
  if (!data) return null;

  const { student, recipients, studySessions } = data;
  const dateFilteredRecipients = recipients.filter((r) => overlapsRange(r, dateRange));

  // Tamamlanma oranı yalnızca GÖNDERİLMİŞ (SENT) ödevler üzerinden hesaplanır — taslaklar (DRAFT)
  // öğrenciye hiç ulaşmadığı için paydaya girerse oran yapay olarak düşer, ayrıca /teacher/students
  // listesindeki orandan (o da yalnızca SENT sayar) tutarsız çıkar. "Toplam Ödev" ve aşağıdaki liste
  // yine tüm recipients'ı (taslaklar dahil) gösterir — koç planladığı her şeyi görebilsin diye.
  // Hepsi seçili tarih dönemine göre (dateFilteredRecipients) hesaplanır — "Bu Ay" seçiliyken
  // kartların o ayki durumu yansıtması için.
  const sentRecipients = dateFilteredRecipients.filter((r) => r.assignment.status === "SENT");
  const completionRate = sentRecipients.length ? Math.round((sentRecipients.filter((r) => r.completed).length / sentRecipients.length) * 100) : null;
  // Taslaklar (henüz öğrenciye gönderilmemiş) "tamamlanmış" olamayacağı için doğal olarak
  // bekleyenler tarafına düşer — koç onları da burada (ayrı "Taslak" rozetiyle) görsün ister.
  const pending = dateFilteredRecipients.filter((r) => !r.completed);
  // Geciken ödevler artık kendi ayrı başlığında (en üstte) gösteriliyor — "Bekleyen Ödevler"
  // bölümüyle çakışıp aynı ödevin iki kez listelenmemesi için buradan çıkarılıyor.
  const overdue = pending.filter((r) => r.assignment.status === "SENT" && daysUntil(r.assignment.endDate) < 0);
  const notOverdue = pending.filter((r) => !(r.assignment.status === "SENT" && daysUntil(r.assignment.endDate) < 0));
  const completed = dateFilteredRecipients.filter((r) => r.completed);

  return (
    <div style={{ padding: 28, maxWidth: 760, margin: "0 auto" }}>
      <button onClick={onBack} className="k-link-btn" style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: C.muted, cursor: "pointer", fontFamily: bodyFont, fontSize: 13, fontWeight: 600, marginBottom: 18 }}>
        <ArrowLeft size={16} /> Öğrencilerime dön
      </button>

      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <Avatar name={student.name} size={44} />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontFamily: displayFont, fontSize: 17, fontWeight: 800, color: C.text }}>{student.name}</span>
                {student.className && <Pill>{student.className}</Pill>}
                {student.gradeLevel && <Pill tone="amber">{student.gradeLevel}. Sınıf ({trackForGrade(student.gradeLevel)})</Pill>}
                {student.banned && <Pill tone="red">Askıda</Pill>}
              </div>
              <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.muted, marginTop: 3 }}>{student.email}</div>
            </div>
          </div>
          {onOpenReport && (
            <Button small variant="secondary" icon={BarChart3} onClick={() => onOpenReport(studentId, student.name)}>Raporunu Gör</Button>
          )}
        </div>
      </Card>

      <CoachNoteCard key={studentId} studentId={studentId} initialNote={student.coachNote} />

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {DATE_FILTERS.map((f) => (
          <Button key={f.value} small variant={dateFilter === f.value ? "primary" : "secondary"} onClick={() => setDateFilter(f.value)}>{f.label}</Button>
        ))}
        {dateFilter === "range" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} style={{ minWidth: 0 }} />
            <span style={{ color: C.mutedLight, fontSize: 12.5 }}>—</span>
            <Input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} style={{ minWidth: 0 }} />
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <StatCard label="Toplam Ödev" value={dateFilteredRecipients.length} tone="accent" onClick={() => setFilter("all")} active={filter === "all"} />
        <StatCard label="Bekleyen" value={notOverdue.length} tone="amber" onClick={() => setFilter("pending")} active={filter === "pending"} />
        <StatCard label="Geciken" value={overdue.length} tone="red" onClick={() => setFilter("overdue")} active={filter === "overdue"} />
        <StatCard label="Tamamlanan" value={completed.length} tone="green" onClick={() => setFilter("completed")} active={filter === "completed"} />
        <StatCard label="Tamamlanma Oranı" value={completionRate != null ? `%${completionRate}` : "—"} tone="muted" />
        <StatCard label="Serbest Çalışma" value={studySessions.length} tone="amber" />
      </div>

      {onCreateAssignment && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <Button small variant="secondary" icon={Plus} onClick={() => onCreateAssignment(studentId)}>Yeni Ödev Ata</Button>
        </div>
      )}

      {recipients.length === 0 ? (
        <EmptyState text="Bu öğrenciye henüz ödev gönderilmemiş." />
      ) : dateFilteredRecipients.length === 0 ? (
        <EmptyState text="Seçilen dönemde ödev yok." />
      ) : (
        <div style={{ marginBottom: 28 }}>
          {(filter === "all" || filter === "overdue") && (
            <div style={{ marginBottom: filter === "all" ? 24 : 0 }}>
              <SectionTitle>Geciken Ödevler ({overdue.length})</SectionTitle>
              {overdue.length === 0 ? (
                <EmptyState text="Geciken ödevi yok." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {overdue.map((r) => <RecipientRow key={r.id} r={r} onOpen={onOpenAssignment} />)}
                </div>
              )}
            </div>
          )}
          {(filter === "all" || filter === "pending") && (
            <div style={{ marginBottom: filter === "all" ? 24 : 0 }}>
              <SectionTitle>Bekleyen Ödevler ({notOverdue.length})</SectionTitle>
              {notOverdue.length === 0 ? (
                <EmptyState text="Bekleyen ödevi yok." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {notOverdue.map((r) => <RecipientRow key={r.id} r={r} onOpen={onOpenAssignment} />)}
                </div>
              )}
            </div>
          )}
          {(filter === "all" || filter === "completed") && (
            <div>
              <SectionTitle>Tamamlanan Ödevler ({completed.length})</SectionTitle>
              {completed.length === 0 ? (
                <EmptyState text="Henüz tamamlanmış ödev yok." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {completed.map((r) => <RecipientRow key={r.id} r={r} onOpen={onOpenAssignment} />)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ fontFamily: displayFont, fontSize: 14, fontWeight: 800, marginBottom: 12, color: C.mutedLight, textTransform: "uppercase", letterSpacing: 0.5 }}>
        Serbest Çalışmaları ({studySessions.length})
      </div>
      {studySessions.length === 0 ? (
        <EmptyState text="Bu öğrenci henüz serbest çalışma kaydı girmemiş." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {studySessions.map((s) => (
            <Card key={s.id} style={{ padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontFamily: bodyFont, fontSize: 13.5, fontWeight: 700, color: C.text }}>{s.subject} — {s.topic}</span>
                <Pill>{s.examType}</Pill>
              </div>
              <div style={{ fontFamily: bodyFont, fontSize: 12, color: C.muted, marginTop: 4 }}>
                {formatDate(s.studyDate)} · D:{s.correctCount} Y:{s.wrongCount} B:{s.blankCount}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
