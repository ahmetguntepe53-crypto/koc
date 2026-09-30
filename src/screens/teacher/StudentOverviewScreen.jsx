import { useEffect, useMemo, useRef, useState } from "react";
import { C, bodyFont, monoFont, formatNet, netOf, recipientStatus, SKIP_REASONS } from "../../theme.js";
import { Card, Button, Input, Textarea, Chip, EmptyState, Modal, ShowMoreButton, LoadingState, SectionHeader, StatusSquare, ListRow, ListGroup, MiniBars, AlertBox, BottomActionBar, Pill, confirmDialog } from "../../components/common.jsx";
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
// bugünü görmeli; "Tümü" en sonda. Çipler iki ödev bölümünü süzer. Rapor ve Notlar başlıkta (App.jsx).
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

// Satırın durum metni: "süresi dün doldu" (kırmızı), "Perşembe girdi" (yeşil), "Pazar 23:59" (soluk),
// "“konuyu bilmiyorum”" (sarı), taslak (soluk).
function statusText(r) {
  if (r.assignment.status !== "SENT") return { text: "taslak · gönderilmedi", color: C.mutedLight };
  const status = recipientStatus(r);
  if (status === "done") {
    const at = r.completedAt || r.submission?.createdAt;
    const label = at && inWeek(at, weekBounds()) ? new Date(at).toLocaleDateString("tr-TR", { weekday: "long" }) : at ? shortDate(at) : "";
    return { text: `${label} girdi`.trim(), color: C.green };
  }
  if (status === "skipped") return { text: `“${(SKIP_REASONS[r.skipReason] || "başka sebep").toLocaleLowerCase("tr-TR")}”`, color: C.amber };
  if (status === "missed") return { text: `süresi ${endedLabel(r.assignment.endDate).replace(" bitti", "")} doldu`, color: C.red };
  return { text: deadlineLabel(r.assignment.endDate), color: C.mutedLight };
}

function RecipientRow({ r, onOpen }) {
  const { text, color } = statusText(r);
  const net = netOf(r.submission);
  const status = r.assignment.status !== "SENT" ? "open" : recipientStatus(r);
  return (
    <ListRow
      left={<StatusSquare subject={r.assignment.subject} status={status} size={34} />}
      title={r.assignment.topic}
      subtitle={<span style={{ color }}>{r.assignment.subject} · {text}</span>}
      right={<span style={{ fontFamily: monoFont, fontSize: 15, fontWeight: 700, color: net != null ? C.text : C.faintest, flexShrink: 0 }}>{net != null ? formatNet(net, 2) : "—"}</span>}
      onClick={() => onOpen(r.assignmentId, "studentOverview")}
    />
  );
}

function RecipientGroup({ title, right, items, onOpen, emptyText }) {
  const [visible, setVisible] = useState(INITIAL_COUNT);
  return (
    <>
      <SectionHeader title={`${title} (${items.length})`} right={right} />
      {items.length === 0 ? (
        <EmptyState compact text={emptyText} />
      ) : (
        <>
          <ListGroup>{items.slice(0, visible).map((r) => <RecipientRow key={r.id} r={r} onOpen={onOpen} />)}</ListGroup>
          <ShowMoreButton remaining={items.length - Math.min(visible, items.length)} onClick={() => setVisible((n) => n + PAGE_SIZE)} />
        </>
      )}
    </>
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
      <SectionHeader title="YKS alanı" right={saving ? "kaydediliyor..." : value ? FIELD_LABELS[value] : "girilmedi"} />
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

export default function StudentOverviewScreen({ studentId, onOpenAssignment, onCreateAssignment, noteOpen, onCloseNote, setHeader }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateFilter, setDateFilter] = useState("today"); // varsayılan "Bugün" (kullanıcı isteği)
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  // null | { note: null } (yeni) | { note } (düzenle)
  const [noteModal, setNoteModal] = useState(null);
  const notesRef = useRef(null);
  const [notesVisible, setNotesVisible] = useState(3);
  const [sessionsVisible, setSessionsVisible] = useState(3);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.teacherStudentOverview(studentId), api.getExamDates().catch(() => null)])
      .then(([overview, exam]) => {
        setData(overview);
        const s = overview.student;
        const yks = exam?.yksExamDate ? Math.ceil((new Date(exam.yksExamDate).getTime() + TYT_START_UTC_OFFSET_MS - Date.now()) / 86400000) : null;
        const seen = lastSeenInfo(s.lastSeenAt, s.createdAt);
        setHeader?.({ title: s.name, subtitle: [s.className, seen.never ? seen.label : `son giriş ${seen.label}`, "koçu sensin", yks > 0 && `YKS'ye ${yks} gün`].filter(Boolean).join(" · ") });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [studentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Başlıktaki "Notlar": not bölümüne kaydırır (eskiden tek notu açıyordu; notlar artık sayfada listeli).
  useEffect(() => {
    if (!noteOpen || !data) return;
    notesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    onCloseNote?.();
  }, [noteOpen, data]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const overall = weeklySeries(sent);
    const branches = BOARD_BRANCHES.map((b) => ({ ...b, series: weeklySeries(sent, (r) => boardBranchOf(r.assignment.subject) === b.key) }))
      .filter((b) => b.series.some(Boolean));
    const falling = branches.filter((b) => declining(b.series));
    return { weekItems, weekNet, lastNet, overall, branches, falling };
  }, [data]);

  const page = (children) => <div className="k-page" style={{ padding: 28, maxWidth: 760, margin: "0 auto" }}>{children}</div>;
  if (loading) return page(<LoadingState />);
  if (error) return page(<EmptyState text={error} />);
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
  // Özet sayılar aşağıdaki listelerle AYNI kümeden (seçili dönem) — önceden her zaman "bitişi bu haftada olan"
  // ödevleri sayıyordu; "Bugün" seçiliyken liste 1, özet 3 ödev gösteriyordu. Taslaklar öğrenciye gitmediği için sayılmaz.
  const counts = { done: 0, missed: 0, skipped: 0, open: 0 };
  const periodItems = visible.filter((r) => r.assignment.status === "SENT");
  periodItems.forEach((r) => { counts[recipientStatus(r)] += 1; });

  const { weekNet, lastNet, overall, branches, falling } = computed;
  const delta = weekNet != null && lastNet != null ? weekNet - lastNet : null;
  const gradeOk = GRADE_LEVELS.includes(student.gradeLevel);

  const weekSessions = studySessions.filter((s) => inWeek(s.studyDate, weekBounds()));
  const sessionSubjects = [...new Set(weekSessions.map((s) => s.subject))];
  const untouched = falling.filter((b) => !weekSessions.some((s) => boardBranchOf(s.subject) === b.key)).map((b) => b.label);
  const sessionComment = [
    weekSessions.length > 1 && sessionSubjects.length === 1 && `Hepsi ${sessionSubjects[0]}.`,
    untouched.length > 0 && `${untouched.join(", ")} dersine kendi isteğiyle bu hafta hiç dokunmadı.`,
  ].filter(Boolean).join(" ");

  const openNote = () => setNoteModal({ note: null });

  return (
    <div className="k-page k-page-form" style={{ padding: 28, maxWidth: 760, margin: "0 auto" }}>
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
      {!gradeOk && <AlertBox style={{ marginBottom: 12 }}>{gradeLabel(student.gradeLevel)} — bu öğrenci ödev listelerinde görünmüyor, okul yöneticisi düzeltmeli.</AlertBox>}
      {student.banned && <div style={{ marginBottom: 12 }}><Pill tone="red">Hesap askıda</Pill></div>}

      {/* Bu haftanın neti + 6 haftalık seri */}
      <Card style={{ padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: bodyFont, fontSize: 10.5, fontWeight: 700, letterSpacing: 1.4, color: C.mutedLight }}>BU HAFTANIN NETİ</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
            <span style={{ fontFamily: monoFont, fontSize: 34, fontWeight: 700, letterSpacing: -1.4, color: weekNet != null ? C.text : C.faintest }}>{weekNet != null ? formatNet(weekNet, 2) : "—"}</span>
            {delta != null && <span style={{ fontFamily: monoFont, fontSize: 15, fontWeight: 700, color: delta >= 0 ? C.green : C.red }}>{delta >= 0 ? "+" : "−"}{formatNet(Math.abs(delta), 2)}</span>}
          </div>
          <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.mutedLight, marginTop: 6 }}>
            {periodItems.length
              ? <><span style={{ fontFamily: monoFont }}>{periodItems.length}</span> ödev · <span style={{ fontFamily: monoFont }}>{counts.done}</span> girildi{counts.missed ? <> · <span style={{ fontFamily: monoFont }}>{counts.missed}</span> gecikti</> : null}{counts.skipped ? <> · <span style={{ fontFamily: monoFont }}>{counts.skipped}</span> pas</> : null}</>
              : "Bu dönemde ödev yok"}
          </div>
        </div>
        <MiniBars values={overall.map((w) => (w ? w.net : null))} height={40} barWidth={8} colorFor={(v, i) => (i === WEEKS - 1 ? C.green : `${C.green}66`)} />
      </Card>

      {falling.length > 0 && (
        <AlertBox style={{ marginTop: 12 }}>
          {(() => {
            const b = falling[0];
            const pts = b.series.filter((s) => s?.pct != null).map((s) => s.pct);
            return <>{b.label} başarısı {WEEKS} haftada <span style={{ fontFamily: monoFont }}>%{pts[0]}</span> → <span style={{ fontFamily: monoFont }}>%{pts[pts.length - 1]}</span> düştü{falling.length > 1 ? ` · ${falling.slice(1).map((x) => x.label).join(", ")} da düşüyor` : ""}</>;
          })()}
        </AlertBox>
      )}

      <div className="k-chip-row" role="group" aria-label="Tarih aralığı" style={{ marginTop: 18, paddingBottom: 2 }}>
        {DATE_FILTERS.map((f) => <Chip key={f.value} active={dateFilter === f.value} onClick={() => setDateFilter(f.value)}>{f.label}</Chip>)}
      </div>
      {dateFilter === "range" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}><Input aria-label="Başlangıç" type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} /></div>
          <span style={{ color: C.mutedLight, fontSize: 13, marginBottom: 16 }}>—</span>
          <div style={{ flex: 1, minWidth: 0 }}><Input aria-label="Bitiş" type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} /></div>
        </div>
      )}

      {recipients.length === 0 ? (
        <EmptyState text="Bu öğrenciye henüz ödev gönderilmemiş." />
      ) : (
        <>
          <RecipientGroup title="Branş ödevleri" right="okul çapında" items={branchItems} onOpen={onOpenAssignment} emptyText="Bu dönemde branş ödevi yok." />
          <RecipientGroup title="Benim verdiğim" right="kişisel" items={mineItems} onOpen={onOpenAssignment} emptyText="Bu dönemde senin verdiğin ödev yok." />
          {otherItems.length > 0 && <RecipientGroup title="Diğer öğretmenler" items={otherItems} onOpen={onOpenAssignment} emptyText="" />}
        </>
      )}

      {branches.length > 0 && (
        <>
          <SectionHeader title="Ders ders net" right={`${WEEKS} hafta`} />
          <ListGroup>
            {branches.map((b) => {
              const last = [...b.series].reverse().find(Boolean);
              const pts = b.series.filter((s) => s?.pct != null).map((s) => s.pct);
              const d = pts.length >= 2 ? pts[pts.length - 1] - pts[pts.length - 2] : null;
              const down = declining(b.series);
              return (
                <ListRow
                  key={b.key}
                  left={<StatusSquare subject={b.icon} status="open" size={30} title={b.label} />}
                  title={b.label}
                  right={
                    <span style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
                      <MiniBars values={b.series.map((s) => (s ? s.pct : null))} height={24} barWidth={5} gap={3} colorFor={(v, i) => (down ? (i === WEEKS - 1 ? C.red : `${C.red}77`) : (i === WEEKS - 1 ? C.green : `${C.green}66`))} />
                      <span style={{ textAlign: "right", minWidth: 58 }}>
                        <span style={{ display: "block", fontFamily: monoFont, fontSize: 14.5, fontWeight: 700, color: C.text }}>{last ? formatNet(last.net, 2) : "—"}</span>
                        {d != null && <span style={{ display: "block", fontFamily: monoFont, fontSize: 11.5, fontWeight: 600, color: d >= 0 ? C.green : C.red }}>{d >= 0 ? "+" : "−"}{Math.abs(d)} puan</span>}
                      </span>
                    </span>
                  }
                />
              );
            })}
          </ListGroup>
        </>
      )}

      <SectionHeader title="Serbest çalışması" count={studySessions.length || null} />
      <Card>
        <div style={{ fontFamily: bodyFont, fontSize: 14.5, fontWeight: 600, color: C.text }}>
          {weekSessions.length
            ? <>Bu hafta <span style={{ fontFamily: monoFont }}>{weekSessions.length}</span> kayıt · <span style={{ fontFamily: monoFont }}>{weekSessions.reduce((s, x) => s + x.correctCount + x.wrongCount + x.blankCount, 0)}</span> soru · <span style={{ fontFamily: monoFont }}>{formatNet(weekSessions.reduce((s, x) => s + netOf(x), 0), 1)}</span> net</>
            : "Bu hafta serbest çalışma kaydı yok"}
        </div>
        {sessionComment && <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.mutedLight, marginTop: 4 }}>{sessionComment}</div>}
        {studySessions.length > 0 && (
          <div style={{ marginTop: 12, borderTop: `1px solid ${C.divider}` }}>
            {studySessions.slice(0, sessionsVisible).map((s) => (
              <div key={s.id} style={{ padding: "10px 0", borderBottom: `1px solid ${C.divider}` }}>
                <div style={{ fontFamily: bodyFont, fontSize: 13.5, fontWeight: 600, color: C.text2 }}>{s.subject} — {s.topic}</div>
                <div style={{ fontFamily: monoFont, fontSize: 11.5, color: C.mutedLight, marginTop: 3 }}>{formatDate(s.studyDate)} · D {s.correctCount} · Y {s.wrongCount} · B {s.blankCount}</div>
              </div>
            ))}
            <ShowMoreButton remaining={studySessions.length - Math.min(sessionsVisible, studySessions.length)} onClick={() => setSessionsVisible((n) => n + 5)} />
          </div>
        )}
      </Card>

      <FieldPicker studentId={studentId} value={student.field || null} onSaved={(field) => setData((d) => ({ ...d, student: { ...d.student, field } }))} />

      <div ref={notesRef} style={{ scrollMarginTop: 80 }}>
        <SectionHeader title="Özel notlarım" count={notes.length || null} />
      </div>
      {notes.length === 0 ? (
        <Card style={{ fontFamily: bodyFont, fontSize: 14, color: C.mutedLight, lineHeight: 1.55 }}>
          Bu öğrenci hakkında henüz not almadın. Notlar tarihli tutulur ve yalnızca sen görürsün.
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {notes.slice(0, notesVisible).map((n) => {
            const edited = new Date(n.updatedAt) - new Date(n.createdAt) > 60000;
            return (
              <Card key={n.id} hover onClick={() => setNoteModal({ note: n })} style={{ padding: "14px 18px", cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                  {isMigrated(n)
                    ? <span style={{ fontFamily: bodyFont, fontSize: 12.5, fontWeight: 600, color: C.text2 }}>Önceki not</span>
                    : <span style={{ fontFamily: monoFont, fontSize: 12.5, fontWeight: 600, color: C.text2 }}>{noteDate(n.createdAt)}</span>}
                  <span style={{ fontFamily: bodyFont, fontSize: 10, fontWeight: 700, letterSpacing: 1.1, color: C.mutedLight }}>SADECE SEN GÖRÜRSÜN</span>
                  {edited && <span style={{ fontFamily: bodyFont, fontSize: 11.5, color: C.mutedLight }}>· düzenlendi</span>}
                </div>
                <div style={{ fontFamily: bodyFont, fontSize: 14, color: C.text, lineHeight: 1.55, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{n.text}</div>
              </Card>
            );
          })}
          <ShowMoreButton remaining={notes.length - Math.min(notesVisible, notes.length)} onClick={() => setNotesVisible((v) => v + 5)} />
        </div>
      )}

      <BottomActionBar>
        {onCreateAssignment && <div style={{ flex: 1.6 }}><Button full onClick={() => onCreateAssignment(studentId)}>Kişisel ödev ver</Button></div>}
        <div style={{ flex: 1 }}><Button full variant="secondary" onClick={openNote}>Not ekle</Button></div>
      </BottomActionBar>
    </div>
  );
}
