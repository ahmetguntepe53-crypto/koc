import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, LineChart, FileText, Landmark, User, Users, BookOpen, Target, Clock, Plus, PenLine, TrendingDown } from "lucide-react";
import { C, displayFont, bodyFont, formatNet, netOf, recipientStatus, SKIP_REASONS } from "../../theme.js";
import { Button, Input, Textarea, Chip, EmptyState, Modal, ShowMoreButton, LoadingState, StatusSquare, MiniBars, AlertBox, Avatar, HeaderIconButton, confirmDialog } from "../../components/common.jsx";
import { HeroHeader, HeroTextButton, OverlapCard, SegmentFilter, StatusChip, NUM } from "../../components/brand.jsx";
import { api } from "../../api.js";
import { BOARD_BRANCHES, boardBranchOf, gradeLabel, GRADE_LEVELS } from "../../subjects.js";
import { STUDENT_FIELDS, FIELD_SHORT, FIELD_LABELS } from "../../studentField.js";
import { formatDate } from "../../dates.js";
import { weekBounds, inWeek, dayKey, deadlineLabel, endedLabel, shortDate, isSchoolWide, lastSeenInfo, noteDate } from "../../work.js";

// Koç — öğrenci detayı (şartname Z4): koçun asıl ekranı. Haftalık net + 6 haftalık seri, düşüş uyarısı,
// BRANŞ ÖDEVLERİ ile BENİM VERDİĞİM ayrı başlıklarda (sorumluluk farklı: branş ödevi gecikince koç
// hatırlatır, kendi ödevi gecikince kendi planını gözden geçirir), ders ders net, serbest çalışma, özel not.
//
// KULLANICI İSTEĞİ (korunuyor): tarih çiplerinde "Bugün" ilk ve varsayılan — öğretmen ekranı açınca önce
// bugünü görmeli; "Tümü" en sonda. Dönem, ödev bölümlerini, özet sayıları ve serbest çalışmayı süzer.
// Rapor ve Notlar mor üst alanda.
const DATE_FILTERS = [
  { value: "today", label: "Bugün" },
  { value: "week", label: "Bu hafta" },
  { value: "month", label: "Bu ay" },
  { value: "range", label: "Aralık" },
  { value: "all", label: "Tümü" },
];
const INITIAL_COUNT = 7;
const PAGE_SIZE = 7;
const WEEKS = 6;
const TYT_START_UTC_OFFSET_MS = (7 * 60 + 15) * 60 * 1000;

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Bir ödevin [scheduledDate, endDate] aralığı seçilen dönemle KESİŞİYORSA eşleşir — haftalık branş ödevi
// o haftanın her gününün "Bugün"ünde görünür.
function dateRangeFor(filter, rangeStart, rangeEnd) {
  const now = new Date();
  if (filter === "today") return [ymd(now), ymd(now)];
  if (filter === "week") { const w = weekBounds(); return [w.mon, w.sun]; }
  if (filter === "month") return [ymd(new Date(now.getFullYear(), now.getMonth(), 1)), ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0))];
  if (filter === "range" && rangeStart && rangeEnd) return [rangeStart, rangeEnd];
  return null;
}
function overlaps(r, range) {
  if (!range) return true;
  return dayKey(r.assignment.endDate) >= range[0] && dayKey(r.assignment.scheduledDate) <= range[1];
}

const cap = (t) => (t ? t.charAt(0).toLocaleUpperCase("tr-TR") + t.slice(1) : t);
const fmtNet = (v) => formatNet(v, 2).replace(/,00$/, ",0").replace(/(,\d)0$/, "$1");

// Satırın alt satırı ("Cuma 23:59'a kadar", "Perşembe girdi · 15,5 net"...) ve durum çipi.
function rowStatus(r) {
  if (r.assignment.status !== "SENT") return { chip: ["track", "Gönderilmedi"], line: "Taslak · öğrenciye gitmedi" };
  const status = recipientStatus(r);
  if (status === "done") {
    const at = r.completedAt || r.submission?.createdAt;
    const day = at && inWeek(at, weekBounds()) ? new Date(at).toLocaleDateString("tr-TR", { weekday: "long" }) : at ? shortDate(at) : "";
    const net = netOf(r.submission);
    return { chip: ["success", "Girildi"], line: [`${day} girdi`.trim(), net != null && `${fmtNet(net)} net`].filter(Boolean).join(" · ") };
  }
  if (status === "skipped") return { chip: ["track", "Pas geçti"], line: `“${(SKIP_REASONS[r.skipReason] || "başka sebep").toLocaleLowerCase("tr-TR")}”` };
  if (status === "missed") return { chip: ["danger", "Gecikti"], line: `Süresi ${endedLabel(r.assignment.endDate).replace(" bitti", "")} doldu` };
  const due = deadlineLabel(r.assignment.endDate);
  return { chip: ["warning", "Girilmedi"], line: due.endsWith("23:59") ? `${cap(due)}'a kadar` : `Son gün ${due}` };
}

function AssignmentItem({ r, onOpen }) {
  const { chip, line } = rowStatus(r);
  return (
    <button
      type="button"
      onClick={() => onOpen(r.assignmentId, "studentOverview")}
      className="k-list-row"
      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 16, border: "none", background: C.pageTint, textAlign: "left", cursor: "pointer" }}
    >
      <StatusSquare plain subject={r.assignment.subject} size={40} title={r.assignment.subject} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontFamily: bodyFont, fontSize: 12, fontWeight: 600, color: C.brandText }}>{[r.assignment.subject, r.assignment.sourceBook].filter(Boolean).join(" · ")}</span>
        <span style={{ display: "block", fontFamily: bodyFont, fontSize: 15, fontWeight: 700, color: C.inkText, marginTop: 1, overflowWrap: "anywhere" }}>{r.assignment.topic}</span>
        <span style={{ ...NUM, display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: C.inkMuted, marginTop: 3 }}>
          <Clock size={12} aria-hidden="true" style={{ flexShrink: 0 }} />{line}
        </span>
      </span>
      <StatusChip tone={chip[0]}>{chip[1]}</StatusChip>
      <ChevronRight size={18} color={C.brandText} aria-hidden="true" style={{ flexShrink: 0 }} />
    </button>
  );
}

// Bölüm kartı: 32px renkli ikon karesi, başlık, sağda açıklama ve sayı rozeti.
function SectionCard({ icon: Icon, iconBg, iconFg, title, note, count, countTone = "track", children, style }) {
  const badge = countTone === "brand" ? { background: C.brand, color: C.onBrand } : { background: C.track, color: C.inkText };
  return (
    <section style={{ background: C.surface, borderRadius: 20, padding: 14, ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 10, background: iconBg, color: iconFg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={16} strokeWidth={2.3} />
        </span>
        <h2 style={{ flex: 1, minWidth: 0, margin: 0, fontFamily: displayFont, fontSize: 15, fontWeight: 800, color: C.inkText }}>{title}</h2>
        {note && <span style={{ fontFamily: bodyFont, fontSize: 12, color: C.inkMuted, whiteSpace: "nowrap" }}>{note}</span>}
        {count != null && (
          <span style={{ ...NUM, ...badge, minWidth: 24, height: 24, padding: "0 7px", boxSizing: "border-box", borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{count}</span>
        )}
      </div>
      {children}
    </section>
  );
}

function AssignmentSection({ items, onOpen, emptyText, ...card }) {
  const [visible, setVisible] = useState(INITIAL_COUNT);
  return (
    <SectionCard {...card} count={items.length}>
      {items.length === 0 ? (
        <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.inkMuted, marginTop: 10, paddingLeft: 42 }}>{emptyText}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
          {items.slice(0, visible).map((r) => <AssignmentItem key={r.id} r={r} onOpen={onOpen} />)}
          <ShowMoreButton remaining={items.length - Math.min(visible, items.length)} onClick={() => setVisible((n) => n + PAGE_SIZE)} />
        </div>
      )}
    </SectionCard>
  );
}

// Eski tek not alanından taşınan not (migration 20260926220000, kimliği "mig" ile başlar) — ne zaman
// yazıldığı bilinmiyor; canlıya alma günü yazılmış gibi tarihlenmesin, "Önceki not" olarak gösterilir.
function isMigrated(note) {
  return String(note.id).startsWith("mig");
}

// Koçun tarihli özel notu — yalnızca yazan koç görür (bkz. server > schema.prisma > CoachNote).
// note verilirse düzenleme (ve silme), verilmezse yeni not. onSaved(note) / onDeleted(id) üst bileşenin
// listesini günceller — sayfa yeniden yüklenmeden.
function NoteModal({ studentId, note, onClose, onSaved, onDeleted }) {
  const [text, setText] = useState(note?.text || "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  // Eski tek not alanında sınır yoktu — taşınan uzun not kısaltmaya zorlanmadan düzenlenebilsin (sunucu da aynı kural).
  const maxLength = Math.max(2000, note?.text.length || 0);

  const save = async () => {
    if (!text.trim()) { setError("Not boş olamaz"); return; }
    // Değişmediyse istek atılmaz — not "düzenlendi" görünmesin.
    if (note && text.trim() === note.text) { onClose(); return; }
    setSaving(true);
    setError("");
    try {
      const res = note ? await api.teacherEditNote(note.id, text) : await api.teacherAddNote(studentId, text);
      onSaved(res.note);
    } catch (e) {
      setError(e.message || "Kaydedilemedi");
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!(await confirmDialog({ title: "Not silinsin mi?", message: "Bu not kalıcı olarak silinecek.", confirmLabel: "Sil", danger: true }))) return;
    setDeleting(true);
    try {
      await api.teacherDeleteNote(note.id);
      onDeleted(note.id);
    } catch (e) {
      setError(e.message || "Silinemedi");
      setDeleting(false);
    }
  };

  return (
    <Modal title={note ? (isMigrated(note) ? "Önceki not" : `${noteDate(note.createdAt)} notu`) : "Yeni not"} onClose={onClose}>
      <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.mutedLight, marginBottom: 10 }}>
        Yalnızca sen görürsün — öğrenciye ve branş öğretmenlerine gösterilmez. Öğrenci başka bir koça geçerse notların silinir.
      </div>
      <Textarea autoFocus value={text} maxLength={maxLength} onChange={(e) => setText(e.target.value)} rows={6} placeholder="ör. Matematik'te tıkanıyor, ailesiyle görüştüm..." />
      {error && <div role="alert" style={{ color: C.red, fontFamily: bodyFont, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        {note && <Button variant="danger" disabled={saving || deleting} onClick={remove}>{deleting ? "Siliniyor..." : "Sil"}</Button>}
        <div style={{ flex: 1 }}><Button full disabled={saving || deleting} onClick={save}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button></div>
      </div>
    </Modal>
  );
}

// Öğrencinin YKS alanı (SAY / EA / SÖZ / DİL) — koç kendi öğrencisi için girer; rapor alanın AYT derslerini kaydı
// olmasa da izler (bkz. reportModel.js > FIELD_AYT). Seçili çipe yeniden dokunmak alanı siler (bilinmiyor).
function FieldPicker({ studentId, value, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pick = async (f) => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await api.teacherSetStudentField(studentId, f === value ? null : f);
      onSaved(res.student?.field ?? null);
    } catch (e) {
      setError(e.message || "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.mutedLight, marginBottom: 10 }}>{saving ? "Kaydediliyor..." : value ? FIELD_LABELS[value] : "Alan girilmedi"}</div>
      <div className="k-chip-row" role="group" aria-label="YKS alanı">
        {STUDENT_FIELDS.map((f) => <Chip key={f} active={value === f} onClick={() => pick(f)}>{FIELD_SHORT[f]}</Chip>)}
      </div>
      <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.mutedLight, marginTop: 8, lineHeight: 1.5 }}>
        {value === "DIL"
          ? "DİL öğrencisi AYT yerine YDT'ye girer; raporda TYT/AYT dengesi önerilmez."
          : value
            ? `Raporda ${FIELD_LABELS[value]} alanının AYT dersleri kaydı olmasa da izlenir.`
            : "Girilmezse rapor AYT derslerini son 8 haftanın kayıtlarından tahmin eder."}
      </div>
      {error && <div role="alert" style={{ color: C.red, fontFamily: bodyFont, fontSize: 13, fontWeight: 600, marginTop: 8 }}>{error}</div>}
    </>
  );
}

// Haftalık net ve başarı yüzdesi serileri (son 6 hafta, en eski → bu hafta). Başarı yüzdesi = toplam net /
// toplam soru — ödevlerin soru sayıları farklı olduğu için düşüş/gelişim yüzdeyle değerlendirilir.
function weeklySeries(recipients, predicate = () => true) {
  return Array.from({ length: WEEKS }, (_, i) => {
    const bounds = weekBounds(i - (WEEKS - 1));
    let net = 0, total = 0, n = 0;
    for (const r of recipients) {
      if (!r.submission || !predicate(r) || !inWeek(r.assignment.endDate, bounds)) continue;
      net += netOf(r.submission);
      total += r.submission.correctCount + r.submission.wrongCount + r.submission.blankCount;
      n += 1;
    }
    return n ? { net, pct: total ? Math.round((net / total) * 100) : null } : null;
  });
}

// Düşüyor mu: en az 3 haftalık veri, son değer ilkinden 15 puandan fazla düşük ve bir önceki haftadan da düşük.
function declining(series) {
  const pts = series.filter((s) => s?.pct != null).map((s) => s.pct);
  return pts.length >= 3 && pts[pts.length - 1] < pts[0] - 15 && pts[pts.length - 1] <= pts[pts.length - 2];
}

const PERIOD_WORD = { today: "Bugün", week: "Bu hafta", month: "Bu ay", range: "Bu aralıkta", all: "Toplam" };

// Öğrencinin son girişi, çip metni olarak.
function seenChip(s) {
  const seen = lastSeenInfo(s.lastSeenAt, s.createdAt);
  if (seen.never) return { today: false, text: cap(seen.label) };
  if (seen.days <= 0) return { today: true, text: "Bugün girdi" };
  if (seen.days === 1) return { today: false, text: "Dün girdi" };
  return { today: false, text: `Son giriş ${seen.days} gün önce` };
}

export default function StudentOverviewScreen({ studentId, onBack, onOpenReport, onOpenAssignment, onCreateAssignment }) {
  const [data, setData] = useState(null);
  const [yksDays, setYksDays] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateFilter, setDateFilter] = useState("today"); // varsayılan "Bugün" (kullanıcı isteği)
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  // null | { note: null } (yeni) | { note } (düzenle)
  const [noteModal, setNoteModal] = useState(null);
  const [fieldOpen, setFieldOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const notesRef = useRef(null);
  const [notesVisible, setNotesVisible] = useState(3);
  const [sessionsVisible, setSessionsVisible] = useState(10);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.teacherStudentOverview(studentId), api.getExamDates().catch(() => null)])
      .then(([overview, exam]) => {
        setData(overview);
        setYksDays(exam?.yksExamDate ? Math.ceil((new Date(exam.yksExamDate).getTime() + TYT_START_UTC_OFFSET_MS - Date.now()) / 86400000) : null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [studentId]);

  const computed = useMemo(() => {
    if (!data) return null;
    const sent = data.recipients.filter((r) => r.assignment.status === "SENT");
    const thisWeek = weekBounds();
    const lastWeek = weekBounds(-1);
    const weekItems = sent.filter((r) => inWeek(r.assignment.endDate, thisWeek));
    const sumNet = (items) => items.reduce((s, r) => s + (netOf(r.submission) ?? 0), 0);
    const hasNet = (items) => items.some((r) => r.submission);
    const weekNet = hasNet(weekItems) ? sumNet(weekItems) : null;
    const lastItems = sent.filter((r) => inWeek(r.assignment.endDate, lastWeek));
    const lastNet = hasNet(lastItems) ? sumNet(lastItems) : null;
    // Haftanın 7 günü (Pzt–Paz): o gün girilen sonuçların neti — yukarıdaki haftalık netin günlere dağılımı.
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(`${thisWeek.mon}T00:00:00`);
      d.setDate(d.getDate() + i);
      const key = ymd(d);
      const items = weekItems.filter((r) => r.submission && dayKey(r.completedAt || r.submission.createdAt) === key);
      return { key, label: d.toLocaleDateString("tr-TR", { weekday: "short" }), net: items.length ? sumNet(items) : null };
    });
    const overall = weeklySeries(sent);
    const branches = BOARD_BRANCHES.map((b) => ({ ...b, series: weeklySeries(sent, (r) => boardBranchOf(r.assignment.subject) === b.key) }))
      .filter((b) => b.series.some(Boolean));
    const falling = branches.filter((b) => declining(b.series));
    return { weekNet, lastNet, days, overall, branches, falling };
  }, [data]);

  const hero = (content) => (
    <HeroHeader compact={!content} padBottom={content ? 72 : undefined}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <HeaderIconButton onBrand icon={ChevronLeft} label="Geri" onClick={onBack} />
        <span style={{ flex: 1 }} />
        {onOpenReport && <HeroTextButton icon={LineChart} label="Rapor" onClick={onOpenReport} />}
        {content && <HeroTextButton icon={FileText} label="Notlar" onClick={() => notesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} />}
      </div>
      {content}
    </HeroHeader>
  );
  const shell = (children) => <div>{hero(null)}<div style={{ maxWidth: 760, margin: "0 auto", padding: "20px 16px" }}>{children}</div></div>;
  if (loading) return shell(<LoadingState />);
  if (error) return shell(<EmptyState text={error} />);
  if (!data || !computed) return null;

  const { student, recipients, studySessions } = data;
  const coachId = student.teacherId;
  const notes = data.notes || [];
  const noteSaved = (note) => {
    setData((d) => {
      const list = d.notes || [];
      const exists = list.some((n) => n.id === note.id);
      return { ...d, notes: exists ? list.map((n) => (n.id === note.id ? note : n)) : [note, ...list] };
    });
    setNoteModal(null);
  };
  const noteDeleted = (id) => {
    setData((d) => ({ ...d, notes: (d.notes || []).filter((n) => n.id !== id) }));
    setNoteModal(null);
  };
  const range = dateRangeFor(dateFilter, rangeStart, rangeEnd);
  const visible = recipients.filter((r) => overlaps(r, range))
    .sort((a, b) => dayKey(a.assignment.endDate).localeCompare(dayKey(b.assignment.endDate)));
  const branchItems = visible.filter((r) => isSchoolWide(r.assignment));
  const mineItems = visible.filter((r) => !isSchoolWide(r.assignment) && r.assignment.teacherId === coachId);
  const otherItems = visible.filter((r) => !isSchoolWide(r.assignment) && r.assignment.teacherId !== coachId);
  // Özet sayılar aşağıdaki listelerle AYNI kümeden (seçili dönem). Taslaklar öğrenciye gitmediği için sayılmaz.
  const counts = { done: 0, missed: 0, skipped: 0, open: 0 };
  const periodItems = visible.filter((r) => r.assignment.status === "SENT");
  periodItems.forEach((r) => { counts[recipientStatus(r)] += 1; });

  const { weekNet, lastNet, days, branches, falling } = computed;
  const delta = weekNet != null && lastNet != null ? weekNet - lastNet : null;
  const gradeOk = GRADE_LEVELS.includes(student.gradeLevel);
  const maxDay = Math.max(1, ...days.map((d) => d.net ?? 0));

  const periodSessions = range ? studySessions.filter((x) => dayKey(x.studyDate) >= range[0] && dayKey(x.studyDate) <= range[1]) : studySessions;
  const weekSessions = studySessions.filter((x) => inWeek(x.studyDate, weekBounds()));
  const sessionSubjects = [...new Set(weekSessions.map((x) => x.subject))];
  const untouched = falling.filter((b) => !weekSessions.some((x) => boardBranchOf(x.subject) === b.key)).map((b) => b.label);
  const sessionComment = dateFilter === "week" ? [
    weekSessions.length > 1 && sessionSubjects.length === 1 && `Hepsi ${sessionSubjects[0]}.`,
    untouched.length > 0 && `${untouched.join(", ")} dersine kendi isteğiyle bu hafta hiç dokunmadı.`,
  ].filter(Boolean).join(" ") : "";
  const seen = seenChip(student);
  const field = student.field || null;

  return (
    <div>
      {hero(
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 18 }}>
          <Avatar name={student.name} size={60} lime />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontFamily: displayFont, fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.15, color: C.onBrand, overflowWrap: "anywhere", textWrap: "balance" }}>{student.name}</h1>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {student.className && <StatusChip tone="onBrand">{student.className}</StatusChip>}
              <StatusChip tone="onBrand">{seen.today && <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: C.lime }} />}{seen.text}</StatusChip>
              {coachId && <StatusChip tone="onBrand">Koçu sensin</StatusChip>}
              {yksDays > 0 && <StatusChip tone="lime">YKS'ye {yksDays} gün</StatusChip>}
              {student.banned && <StatusChip tone="danger">Hesap askıda</StatusChip>}
            </div>
          </div>
        </div>,
      )}

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 16px 24px" }}>
        {noteModal && (
          <NoteModal
            key={noteModal?.note?.id || "new"}
            studentId={studentId}
            note={noteModal?.note || null}
            onClose={() => setNoteModal(null)}
            onSaved={noteSaved}
            onDeleted={noteDeleted}
          />
        )}
        {fieldOpen && (
          <Modal title="YKS alanı" onClose={() => setFieldOpen(false)}>
            <FieldPicker studentId={studentId} value={field} onSaved={(f) => setData((d) => ({ ...d, student: { ...d.student, field: f } }))} />
          </Modal>
        )}
        {sessionsOpen && (
          <Modal title="Serbest çalışma" onClose={() => setSessionsOpen(false)}>
            {periodSessions.slice(0, sessionsVisible).map((x) => (
              <div key={x.id} style={{ padding: "10px 0", borderBottom: `1px solid ${C.divider}` }}>
                <div style={{ fontFamily: bodyFont, fontSize: 14, fontWeight: 600, color: C.text }}>{x.subject} — {x.topic}</div>
                <div style={{ ...NUM, fontSize: 12.5, color: C.mutedLight, marginTop: 3 }}>{formatDate(x.studyDate)} · {x.correctCount} doğru · {x.wrongCount} yanlış · {x.blankCount} boş</div>
              </div>
            ))}
            <ShowMoreButton remaining={periodSessions.length - Math.min(sessionsVisible, periodSessions.length)} onClick={() => setSessionsVisible((n) => n + 10)} />
          </Modal>
        )}

        <OverlapCard overlap={52}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: bodyFont, fontSize: 12, fontWeight: 700, color: C.inkMuted }}>Bu haftanın neti</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                <span style={{ ...NUM, fontSize: 32, fontWeight: 800, lineHeight: 1.1, color: weekNet != null ? C.inkText : C.inkMuted }}>{weekNet != null ? fmtNet(weekNet) : "—"}</span>
                {delta != null && <span style={{ ...NUM, fontSize: 13, fontWeight: 700, color: delta >= 0 ? C.success : C.danger }}>{delta >= 0 ? "+" : "−"}{fmtNet(Math.abs(delta))}</span>}
              </div>
              <div style={{ fontFamily: bodyFont, fontSize: 12, color: C.inkMuted, marginTop: 2 }}>
                {weekNet != null ? (delta != null ? "geçen haftaya göre" : "bu hafta girilen sonuçlar") : "Bu hafta henüz net girişi yok"}
              </div>
            </div>
            <div role="img" aria-label={`Günlük net: ${days.map((d) => `${d.label} ${d.net != null ? fmtNet(d.net) : "yok"}`).join(", ")}`} style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 40, flexShrink: 0 }}>
              {days.map((d) => (
                <span key={d.key} style={{ width: 12, borderRadius: 4, height: d.net != null && d.net > 0 ? Math.max(14, Math.round((d.net / maxDay) * 40)) : 12, background: d.net != null ? C.brand : C.track }} />
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 14 }}>
            <CountBox label="Ödev" value={periodItems.length} bg={C.brandTint} />
            <CountBox label="Girildi" value={counts.done} bg={C.pageTint} />
            <CountBox label="Gecikti" value={counts.missed} bg={counts.missed ? C.danger : C.pageTint} fg={counts.missed ? C.onBrand : undefined} />
          </div>
        </OverlapCard>

        {!gradeOk && <AlertBox style={{ marginTop: 12 }}>{gradeLabel(student.gradeLevel)} — bu öğrenci ödev listelerinde görünmüyor, okul yöneticisi düzeltmeli.</AlertBox>}
        {falling.length > 0 && (
          <AlertBox style={{ marginTop: 12 }}>
            {(() => {
              const b = falling[0];
              const pts = b.series.filter((x) => x?.pct != null).map((x) => x.pct);
              return <>{b.label} başarısı {WEEKS} haftada <span style={NUM}>%{pts[0]}</span> → <span style={NUM}>%{pts[pts.length - 1]}</span> düştü{falling.length > 1 ? ` · ${falling.slice(1).map((x) => x.label).join(", ")} da düşüyor` : ""}</>;
            })()}
          </AlertBox>
        )}

        <SegmentFilter
          small
          label="Dönem"
          value={dateFilter}
          onChange={setDateFilter}
          style={{ marginTop: 16 }}
          options={DATE_FILTERS.map((f) => ({ id: f.value, label: f.label }))}
        />
        {dateFilter === "range" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}><Input aria-label="Başlangıç" type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} /></div>
            <span style={{ color: C.mutedLight, fontSize: 13, marginBottom: 16 }}>—</span>
            <div style={{ flex: 1, minWidth: 0 }}><Input aria-label="Bitiş" type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} /></div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
          <AssignmentSection
            icon={Landmark} iconBg={C.brandTint} iconFg={C.brandText} title="Branş ödevleri" note="Okul çapında"
            items={branchItems} onOpen={onOpenAssignment} emptyText="Bu dönemde branş ödevi yok."
          />
          <AssignmentSection
            icon={User} iconBg={C.brand} iconFg={C.onBrand} title="Benim verdiğim" note="Kişisel" countTone="brand"
            items={mineItems} onOpen={onOpenAssignment} emptyText="Bu dönemde senin verdiğin ödev yok."
          />
          {otherItems.length > 0 && (
            <AssignmentSection
              icon={Users} iconBg={C.track} iconFg={C.inkText} title="Diğer öğretmenler"
              items={otherItems} onOpen={onOpenAssignment} emptyText=""
            />
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            <HalfCard
              icon={BookOpen} iconBg={C.successTint} iconFg={C.successText} title="Serbest çalışma"
              onClick={periodSessions.length ? () => setSessionsOpen(true) : undefined}
              label={periodSessions.length ? "Serbest çalışma kayıtlarını aç" : undefined}
            >
              {periodSessions.length
                ? <><span style={NUM}>{PERIOD_WORD[dateFilter]} {periodSessions.length} kayıt · {periodSessions.reduce((n, x) => n + x.correctCount + x.wrongCount + x.blankCount, 0)} soru · {fmtNet(periodSessions.reduce((n, x) => n + netOf(x), 0))} net</span>{sessionComment && <><br />{sessionComment}</>}</>
                : `${PERIOD_WORD[dateFilter]} kayıt yok`}
            </HalfCard>
            <HalfCard
              icon={Target} iconBg={C.warningTint} iconFg={C.warningText} title="YKS alanı"
              chip={field ? <StatusChip tone="success">{FIELD_SHORT[field]}</StatusChip> : <StatusChip tone="track">Girilmedi</StatusChip>}
              onClick={() => setFieldOpen(true)} label="YKS alanını seç"
            >
              {field === "DIL" ? "AYT yerine YDT; TYT/AYT dengesi önerilmez." : field ? `${FIELD_LABELS[field]} AYT dersleri raporda izlenir.` : "Girilmezse AYT dersleri kayıtlardan tahmin edilir."}
            </HalfCard>
          </div>

          {branches.length > 0 && (
            <SectionCard icon={TrendingDown} iconBg={C.track} iconFg={C.inkText} title="Ders ders net" note={`${WEEKS} hafta`}>
              <div style={{ display: "flex", flexDirection: "column", marginTop: 6 }}>
                {branches.map((b) => {
                  const last = [...b.series].reverse().find(Boolean);
                  const pts = b.series.filter((x) => x?.pct != null).map((x) => x.pct);
                  const d = pts.length >= 2 ? pts[pts.length - 1] - pts[pts.length - 2] : null;
                  const down = declining(b.series);
                  return (
                    <div key={b.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: `1px solid ${C.cardDivider}` }}>
                      <StatusSquare subject={b.icon} status="open" size={30} title={b.label} />
                      <span style={{ flex: 1, minWidth: 0, fontFamily: bodyFont, fontSize: 14, fontWeight: 600, color: C.inkText }}>{b.label}</span>
                      <MiniBars values={b.series.map((x) => (x ? x.pct : null))} height={24} barWidth={5} gap={3} colorFor={(v, i) => (down ? (i === WEEKS - 1 ? C.danger : `${C.danger}77`) : (i === WEEKS - 1 ? C.brand : `${C.brand}66`))} />
                      <span style={{ textAlign: "right", minWidth: 58 }}>
                        <span style={{ ...NUM, display: "block", fontSize: 14.5, fontWeight: 700, color: C.inkText }}>{last ? fmtNet(last.net) : "—"}</span>
                        {d != null && <span style={{ ...NUM, display: "block", fontSize: 11.5, fontWeight: 600, color: d >= 0 ? C.success : C.danger }}>{d >= 0 ? "+" : "−"}{Math.abs(d)} puan</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}

          <div ref={notesRef} style={{ scrollMarginTop: 16 }}>
            <SectionCard icon={FileText} iconBg={C.track} iconFg={C.inkText} title="Özel notlarım" note="Yalnızca sen" count={notes.length || null}>
              {notes.length === 0 ? (
                <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.inkMuted, marginTop: 10, lineHeight: 1.5 }}>Bu öğrenci hakkında henüz not almadın. Notlar tarihli tutulur ve yalnızca sen görürsün.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                  {notes.slice(0, notesVisible).map((n) => {
                    const edited = new Date(n.updatedAt) - new Date(n.createdAt) > 60000;
                    return (
                      <button key={n.id} type="button" onClick={() => setNoteModal({ note: n })} className="k-list-row" style={{ display: "block", width: "100%", textAlign: "left", padding: 12, borderRadius: 16, border: "none", background: C.pageTint, cursor: "pointer" }}>
                        <span style={{ ...NUM, display: "block", fontSize: 12, fontWeight: 600, color: C.inkMuted, marginBottom: 4 }}>
                          {isMigrated(n) ? "Önceki not" : noteDate(n.createdAt)}{edited ? " · düzenlendi" : ""}
                        </span>
                        <span style={{ display: "block", fontFamily: bodyFont, fontSize: 14, color: C.inkText, lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{n.text}</span>
                      </button>
                    );
                  })}
                  <ShowMoreButton remaining={notes.length - Math.min(notesVisible, notes.length)} onClick={() => setNotesVisible((v) => v + 5)} />
                </div>
              )}
            </SectionCard>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          {onCreateAssignment && (
            <Button icon={Plus} onClick={() => onCreateAssignment(studentId)} style={{ flex: 3, minHeight: 52, borderRadius: 16, background: C.brand, color: C.onBrand }}>Kişisel ödev ver</Button>
          )}
          <Button icon={PenLine} variant="secondary" onClick={() => setNoteModal({ note: null })} style={{ flex: 2, minHeight: 52, borderRadius: 16, background: C.surface, color: C.inkText, borderColor: C.brandOutline }}>Not ekle</Button>
        </div>
      </div>
    </div>
  );
}

function CountBox({ label, value, bg, fg }) {
  return (
    <div style={{ borderRadius: 14, padding: "10px 12px", background: bg, color: fg || C.inkText, minWidth: 0 }}>
      <div style={{ ...NUM, fontSize: 22, fontWeight: 800, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontFamily: bodyFont, fontSize: 12, fontWeight: fg ? 700 : 500, marginTop: 2, color: fg || C.inkMuted }}>{label}</div>
    </div>
  );
}

// Yan yana iki küçük kart (serbest çalışma, YKS alanı). onClick varsa kartın tamamı dokunulabilir.
function HalfCard({ icon: Icon, iconBg, iconFg, title, chip, onClick, label, children }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-label={label}
      className={onClick ? "k-list-row" : undefined}
      style={{ display: "block", width: "100%", boxSizing: "border-box", textAlign: "left", background: C.surface, border: "none", borderRadius: 20, padding: 14, cursor: onClick ? "pointer" : "default", minWidth: 0 }}
    >
      <span style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
        <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 10, background: iconBg, color: iconFg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={16} strokeWidth={2.3} />
        </span>
        {chip}
      </span>
      <span style={{ display: "block", fontFamily: displayFont, fontSize: 15, fontWeight: 800, color: C.inkText, marginTop: 12 }}>{title}</span>
      <span style={{ display: "block", fontFamily: bodyFont, fontSize: 12.5, color: C.inkMuted, marginTop: 4, lineHeight: 1.45 }}>{children}</span>
    </Tag>
  );
}
