import { useEffect, useMemo, useState } from "react";
import { C, bodyFont, monoFont, formatNet, netOf, recipientStatus, SKIP_REASONS } from "../../theme.js";
import { Card, Button, Input, Textarea, Chip, EmptyState, Modal, ShowMoreButton, LoadingState, SectionHeader, StatusSquare, ListRow, ListGroup, MiniBars, AlertBox, BottomActionBar, Pill } from "../../components/common.jsx";
import { api } from "../../api.js";
import { BOARD_BRANCHES, boardBranchOf, gradeLabel, GRADE_LEVELS } from "../../subjects.js";
import { formatDate } from "../../dates.js";
import { weekBounds, inWeek, dayKey, deadlineLabel, endedLabel, shortDate, isSchoolWide } from "../../work.js";

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

// Koçun bu öğrenci için tuttuğu özel not — yalnızca koç görür (bkz. server/src/serialize.js > safeUser).
// onSaved: kaydedilen not üst bileşenin verisine yazılır — modal tekrar açılınca eski not görünmesin.
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
    <Modal title="Özel notum" onClose={onClose}>
      <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.mutedLight, marginBottom: 10 }}>
        Bu öğrenci hakkında yalnızca sen görürsün — öğrenciye hiçbir zaman gösterilmez.
      </div>
      <Textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)} rows={6} placeholder="ör. Matematik'te tıkanıyor, ailesiyle görüştüm..." />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Button small disabled={saving} onClick={save}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
        {msg && <span style={{ fontSize: 12.5, fontWeight: 600, color: msg.type === "error" ? C.red : C.green }}>{msg.text}</span>}
      </div>
    </Modal>
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
  const [noteModal, setNoteModal] = useState(false);
  const [sessionsVisible, setSessionsVisible] = useState(3);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.teacherStudentOverview(studentId), api.getExamDates().catch(() => null)])
      .then(([overview, exam]) => {
        setData(overview);
        const s = overview.student;
        const yks = exam?.yksExamDate ? Math.ceil((new Date(exam.yksExamDate).getTime() + TYT_START_UTC_OFFSET_MS - Date.now()) / 86400000) : null;
        setHeader?.({ title: s.name, subtitle: [s.className, "koçu sensin", yks > 0 && `YKS'ye ${yks} gün`].filter(Boolean).join(" · ") });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [studentId]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const counts = { done: 0, missed: 0, skipped: 0, open: 0 };
    weekItems.forEach((r) => { counts[recipientStatus(r)] += 1; });
    const overall = weeklySeries(sent);
    const branches = BOARD_BRANCHES.map((b) => ({ ...b, series: weeklySeries(sent, (r) => boardBranchOf(r.assignment.subject) === b.key) }))
      .filter((b) => b.series.some(Boolean));
    const falling = branches.filter((b) => declining(b.series));
    return { weekItems, weekNet, lastNet, counts, overall, branches, falling };
  }, [data]);

  const page = (children) => <div className="k-page" style={{ padding: 28, maxWidth: 760, margin: "0 auto" }}>{children}</div>;
  if (loading) return page(<LoadingState />);
  if (error) return page(<EmptyState text={error} />);
  if (!data || !computed) return null;

  const { student, recipients, studySessions } = data;
  const coachId = student.teacherId;
  const updateCoachNote = (coachNote) => setData((d) => ({ ...d, student: { ...d.student, coachNote } }));
  const range = dateRangeFor(dateFilter, rangeStart, rangeEnd);
  const visible = recipients.filter((r) => overlaps(r, range))
    .sort((a, b) => dayKey(a.assignment.endDate).localeCompare(dayKey(b.assignment.endDate)));
  const branchItems = visible.filter((r) => isSchoolWide(r.assignment));
  const mineItems = visible.filter((r) => !isSchoolWide(r.assignment) && r.assignment.teacherId === coachId);
  const otherItems = visible.filter((r) => !isSchoolWide(r.assignment) && r.assignment.teacherId !== coachId);

  const { weekItems, weekNet, lastNet, counts, overall, branches, falling } = computed;
  const delta = weekNet != null && lastNet != null ? weekNet - lastNet : null;
  const gradeOk = GRADE_LEVELS.includes(student.gradeLevel);

  const weekSessions = studySessions.filter((s) => inWeek(s.studyDate, weekBounds()));
  const sessionSubjects = [...new Set(weekSessions.map((s) => s.subject))];
  const untouched = falling.filter((b) => !weekSessions.some((s) => boardBranchOf(s.subject) === b.key)).map((b) => b.label);
  const sessionComment = [
    weekSessions.length > 1 && sessionSubjects.length === 1 && `Hepsi ${sessionSubjects[0]}.`,
    untouched.length > 0 && `${untouched.join(", ")} dersine kendi isteğiyle bu hafta hiç dokunmadı.`,
  ].filter(Boolean).join(" ");

  const openNote = () => setNoteModal(true);

  return (
    <div className="k-page k-page-form" style={{ padding: 28, maxWidth: 760, margin: "0 auto" }}>
      {(noteOpen || noteModal) && (
        <CoachNoteModal key={studentId} studentId={studentId} initialNote={student.coachNote} onClose={() => { setNoteModal(false); onCloseNote?.(); }} onSaved={updateCoachNote} />
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
            {weekItems.length
              ? <><span style={{ fontFamily: monoFont }}>{weekItems.length}</span> ödev · <span style={{ fontFamily: monoFont }}>{counts.done}</span> girildi{counts.missed ? <> · <span style={{ fontFamily: monoFont }}>{counts.missed}</span> gecikti</> : null}{counts.skipped ? <> · <span style={{ fontFamily: monoFont }}>{counts.skipped}</span> pas</> : null}</>
              : "Bu hafta ödevi yok"}
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
                      <MiniBars values={b.series.map((s) => (s ? s.net : null))} height={24} barWidth={5} gap={3} colorFor={(v, i) => (down ? (i === WEEKS - 1 ? C.red : `${C.red}77`) : (i === WEEKS - 1 ? C.green : `${C.green}66`))} />
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

      <SectionHeader title="Özel notum" action={{ label: student.coachNote ? "Düzenle" : "Not ekle", onClick: openNote }} />
      <Card>
        <div style={{ fontFamily: bodyFont, fontSize: 10.5, fontWeight: 700, letterSpacing: 1.2, color: C.mutedLight, marginBottom: 8 }}>SADECE SEN GÖRÜRSÜN</div>
        <div style={{ fontFamily: bodyFont, fontSize: 14, color: student.coachNote ? C.text2 : C.mutedLight, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
          {student.coachNote || "Bu öğrenci hakkında henüz not almadın."}
        </div>
      </Card>

      <BottomActionBar>
        {onCreateAssignment && <div style={{ flex: 1.6 }}><Button full onClick={() => onCreateAssignment(studentId)}>Kişisel ödev ver</Button></div>}
        <div style={{ flex: 1 }}><Button full variant="secondary" onClick={openNote}>Not ekle</Button></div>
      </BottomActionBar>
    </div>
  );
}
