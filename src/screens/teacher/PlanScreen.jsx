import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Send, Trash2, Clock } from "lucide-react";
import { C, displayFont, bodyFont } from "../../theme.js";
import { Card, Button, Input, Select, Textarea, Pill, EmptyState, Modal } from "../../components/common.jsx";
import { api } from "../../api.js";
import { SUBJECTS_BY_EXAM, trackForGrade } from "../../subjects.js";

// 7 sütunluk tam ay ızgarası telefon genişliğinde (~390px) hücre başına ~40px bırakıyor — ders adı
// yazan tam genişlikte satırlar bu genişlikte hiç sığmıyordu ("çok kötü" görünüm). Telefonda hücreler
// küçülüp içerik yalnızca renkli noktalara iner, dokunma da tek bir hedefe (tüm hücre → günün
// kayıtlarını listeleyen alt sayfa) toplanır — 6px'lik bir noktaya isabet ettirmeye çalışmak yerine.
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 640px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

const MAX_QUESTION_COUNT = 30;
const KIND_LABELS = { TOPIC: "Konu Anlatımı", PRACTICE_TEST: "Deneme", HOLIDAY: "Tatil Ödevi" };
const KIND_TONES = { TOPIC: "accent", PRACTICE_TEST: "amber", HOLIDAY: "muted" };
const KIND_DOT = { TOPIC: C.accent, PRACTICE_TEST: C.amber, HOLIDAY: C.mutedLight };
const AUTO_SEND_LABELS = { ON_DATE: "Tarihi gelince otomatik", DAY_BEFORE: "Bir gün önceden otomatik" };
const WEEKDAY_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function monthLabel(d) {
  return d.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
}
// Pazartesi başlangıçlı 6 satır x 7 sütunluk bir ızgara — önceki/sonraki aydan taşan günler de
// (soluk gösterilir) tıklanabilir kalır, bir okul haftası ay sınırında bölünmüş olabilir.
function buildMonthGrid(viewDate) {
  const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const firstWeekday = (first.getDay() + 6) % 7; // Pazartesi=0
  const start = new Date(first);
  start.setDate(start.getDate() - firstWeekday);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export default function PlanScreen({ user }) {
  const isMobile = useIsMobile();
  const isSubjectTeacher = !!user?.isSubjectTeacher;
  const [students, setStudents] = useState([]);
  const [examType, setExamType] = useState("TYT");
  const [entries, setEntries] = useState([]);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [rosterError, setRosterError] = useState("");
  const [modalState, setModalState] = useState(null); // { date: 'YYYY-MM-DD', entry: {...} | null }
  const [dayAgendaDate, setDayAgendaDate] = useState(null); // 'YYYY-MM-DD' | null — yalnızca mobilde kullanılır

  useEffect(() => {
    api.teacherListStudents().then(({ students }) => setStudents(students)).catch((e) => setRosterError(e.message || "Öğrenci listesi yüklenemedi"));
  }, []);
  const activeStudents = useMemo(() => students.filter((s) => !s.banned).map((s) => ({ ...s, track: trackForGrade(s.gradeLevel) })), [students]);
  const tracksPresent = useMemo(() => [...new Set(activeStudents.map((s) => s.track).filter(Boolean))], [activeStudents]);
  useEffect(() => {
    if (tracksPresent.includes("LGS") && !tracksPresent.includes("YKS")) setExamType("LGS");
    else if (examType === "LGS" && !tracksPresent.includes("LGS")) setExamType("TYT");
  }, [tracksPresent.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = () => {
    setLoading(true);
    api.listPlanEntries(examType).then(({ entries }) => setEntries(entries)).catch((e) => setToast({ type: "error", text: e.message })).finally(() => setLoading(false));
  };
  useEffect(load, [examType]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Bir kaydın tarihi UTC gece yarısı olarak saklanır (bkz. server > parseDateOnly) — ISO string'in
  // ilk 10 karakteri, saat dilimi dönüşümüne hiç girmeden doğrudan takvim gününü verir.
  const entriesByDate = useMemo(() => {
    const map = new Map();
    for (const e of entries) {
      const key = e.date.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    }
    return map;
  }, [entries]);

  const grid = useMemo(() => buildMonthGrid(viewDate), [viewDate]);
  const currentMonth = viewDate.getMonth();

  const openNew = (dateKey) => setModalState({ date: dateKey, entry: null });
  const openExisting = (dateKey, entry) => setModalState({ date: dateKey, entry });
  // Telefonda bir güne dokunmak (kayıt olsun ya da olmasın) küçük bir noktaya isabet ettirmeye
  // çalışmak yerine önce o günün kayıtlarını listeleyen bir ajanda açar — yeni kayıt eklemek de
  // oradaki "Yeni Kayıt Ekle" düğmesiyle olur.
  const openDayCell = (dateKey) => {
    if (isMobile) setDayAgendaDate(dateKey);
    else openNew(dateKey);
  };

  const afterSave = () => { setModalState(null); load(); };

  if (rosterError) return <EmptyState text={rosterError} />;
  if (tracksPresent.length === 0 && !loading) {
    return <EmptyState text="Yıllık plan oluşturmak için önce öğrencilerine sınıf düzeyi girilmiş olmalı." />;
  }

  return (
    <div style={{ padding: isMobile ? "14px 10px" : 28, maxWidth: 980, margin: "0 auto" }}>
      {toast && (
        <div style={{ marginBottom: 16, padding: "11px 15px", borderRadius: C.radiusSm, background: toast.type === "error" ? C.redSoft : C.greenSoft, color: toast.type === "error" ? C.red : C.green, fontSize: 13, fontWeight: 600, fontFamily: bodyFont }}>
          {toast.text}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {tracksPresent.includes("LGS") && (
            <Button small variant={examType === "LGS" ? "primary" : "secondary"} onClick={() => setExamType("LGS")}>LGS</Button>
          )}
          {tracksPresent.includes("YKS") && (
            <>
              <Button small variant={examType === "TYT" ? "primary" : "secondary"} onClick={() => setExamType("TYT")}>TYT</Button>
              <Button small variant={examType === "AYT" ? "primary" : "secondary"} onClick={() => setExamType("AYT")}>AYT</Button>
            </>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button type="button" onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="k-icon-btn" style={{ width: 30, height: 30, borderRadius: C.radiusSm, border: `1px solid ${C.border}`, background: C.surface, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ChevronLeft size={16} color={C.text} />
          </button>
          <span style={{ fontFamily: displayFont, fontSize: 15, fontWeight: 800, color: C.text, minWidth: isMobile ? 100 : 150, textAlign: "center", textTransform: "capitalize" }}>{monthLabel(viewDate)}</span>
          <button type="button" onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="k-icon-btn" style={{ width: 30, height: 30, borderRadius: C.radiusSm, border: `1px solid ${C.border}`, background: C.surface, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ChevronRight size={16} color={C.text} />
          </button>
          <Button small variant="secondary" onClick={() => setViewDate(new Date())}>Bugün</Button>
        </div>
      </div>

      {loading ? (
        <EmptyState text="Yükleniyor..." />
      ) : (
        <Card style={{ padding: isMobile ? 5 : 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: isMobile ? 3 : 6, marginBottom: 6 }}>
            {WEEKDAY_LABELS.map((w) => (
              <div key={w} style={{ textAlign: "center", fontFamily: bodyFont, fontSize: isMobile ? 9.5 : 11, fontWeight: 800, color: C.mutedLight, textTransform: "uppercase", padding: "4px 0" }}>{w}</div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: isMobile ? 3 : 6 }}>
            {grid.map((d) => {
              const key = ymd(d);
              const dayEntries = entriesByDate.get(key) || [];
              const inMonth = d.getMonth() === currentMonth;
              const isToday = key === ymd(new Date());
              return (
                <div
                  key={key}
                  data-date={key}
                  onClick={() => openDayCell(key)}
                  style={{
                    minHeight: isMobile ? 46 : 92, borderRadius: C.radiusSm, padding: isMobile ? 3 : 6, cursor: "pointer",
                    background: inMonth ? C.surface : C.surface2, border: `1px solid ${isToday ? C.accent : C.border}`,
                    opacity: inMonth ? 1 : 0.55, display: "flex", flexDirection: "column", gap: isMobile ? 2 : 4,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: bodyFont, fontSize: isMobile ? 10 : 11.5, fontWeight: isToday ? 800 : 600, color: isToday ? C.accent : C.muted }}>{d.getDate()}</span>
                    {!isMobile && <Plus size={12} color={C.mutedLight} />}
                  </div>
                  {isMobile ? (
                    dayEntries.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 2, justifyContent: "center" }}>
                        {dayEntries.slice(0, 4).map((entry) => (
                          <span key={entry.id} style={{ width: 6, height: 6, borderRadius: 999, background: entry.assignmentId ? C.green : KIND_DOT[entry.kind], flexShrink: 0 }} />
                        ))}
                      </div>
                    )
                  ) : (
                    dayEntries.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openExisting(key, entry); }}
                        title={`${entry.subject || ""} ${entry.topic || ""}`.trim()}
                        style={{
                          display: "flex", alignItems: "center", gap: 4, width: "100%", textAlign: "left",
                          background: entry.assignmentId ? C.greenSoft : C.accentSoft, border: "none", borderRadius: 6,
                          padding: "3px 5px", cursor: "pointer", overflow: "hidden",
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: 999, background: entry.assignmentId ? C.green : KIND_DOT[entry.kind], flexShrink: 0 }} />
                        <span style={{ fontFamily: bodyFont, fontSize: 10.5, fontWeight: 700, color: entry.assignmentId ? C.green : C.accent, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {entry.subject || KIND_LABELS[entry.kind]}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div style={{ display: "flex", gap: 14, marginTop: 14, flexWrap: "wrap" }}>
        <Legend color={KIND_DOT.TOPIC} label="Konu Anlatımı" />
        <Legend color={KIND_DOT.PRACTICE_TEST} label="Deneme" />
        <Legend color={KIND_DOT.HOLIDAY} label="Tatil Ödevi" />
        <Legend color={C.green} label="Gönderildi" />
      </div>

      {modalState && (
        <PlanEntryModal
          examType={examType}
          dateKey={modalState.date}
          existing={modalState.entry}
          isSubjectTeacher={isSubjectTeacher}
          onClose={() => setModalState(null)}
          onSaved={afterSave}
        />
      )}

      {dayAgendaDate && (
        <DayAgendaModal
          dateKey={dayAgendaDate}
          entries={entriesByDate.get(dayAgendaDate) || []}
          onClose={() => setDayAgendaDate(null)}
          onOpenEntry={(entry) => { setDayAgendaDate(null); openExisting(dayAgendaDate, entry); }}
          onAddNew={() => { setDayAgendaDate(null); openNew(dayAgendaDate); }}
        />
      )}
    </div>
  );
}

// Telefonda bir güne dokunulunca açılan liste — o günün kayıtları (varsa) düzenlenebilir satırlar
// olarak, altında da her zaman "Yeni Kayıt Ekle" düğmesi olarak gösterilir.
function DayAgendaModal({ dateKey, entries, onClose, onOpenEntry, onAddNew }) {
  const dateLabel = new Date(`${dateKey}T00:00:00`).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric", weekday: "long" });
  return (
    <Modal title={dateLabel} onClose={onClose}>
      {entries.length === 0 ? (
        <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.muted, marginBottom: 16 }}>Bu gün için henüz bir kayıt yok.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {entries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => onOpenEntry(entry)}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left",
                background: C.surface2, border: `1px solid ${C.border}`, borderRadius: C.radiusSm,
                padding: "10px 12px", cursor: "pointer",
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 999, background: entry.assignmentId ? C.green : KIND_DOT[entry.kind], flexShrink: 0 }} />
              <span style={{ fontFamily: bodyFont, fontSize: 13.5, fontWeight: 700, color: C.text, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {entry.subject ? `${entry.subject} — ${entry.topic}` : entry.topic || KIND_LABELS[entry.kind]}
              </span>
              {entry.schoolWide && <Pill tone="accent">Okul Çapında</Pill>}
              {entry.assignmentId && <Pill tone="green">Gönderildi</Pill>}
            </button>
          ))}
        </div>
      )}
      <Button full icon={Plus} onClick={onAddNew}>Yeni Kayıt Ekle</Button>
    </Modal>
  );
}

function Legend({ color, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: color }} />
      <span style={{ fontFamily: bodyFont, fontSize: 11.5, color: C.muted }}>{label}</span>
    </div>
  );
}

function PlanEntryModal({ examType, dateKey, existing, isSubjectTeacher, onClose, onSaved }) {
  const published = !!existing?.assignmentId;
  const [kind, setKind] = useState(existing?.kind || "TOPIC");
  const [subject, setSubject] = useState(existing?.subject || SUBJECTS_BY_EXAM[examType][0]);
  const [topic, setTopic] = useState(existing?.topic || "");
  const [sourceBook, setSourceBook] = useState(existing?.sourceBook || "");
  const [pageRange, setPageRange] = useState(existing?.pageRange || "");
  const [questionCount, setQuestionCount] = useState(existing?.questionCount ? String(existing.questionCount) : "");
  const [note, setNote] = useState(existing?.note || "");
  const [date, setDate] = useState(existing?.date ? existing.date.slice(0, 10) : dateKey);
  const [autoSend, setAutoSend] = useState(existing?.autoSend || "OFF");
  const [schoolWide, setSchoolWide] = useState(existing?.schoolWide || false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  const payload = () => ({
    examType, date, kind, subject: kind === "TOPIC" ? subject : undefined, topic: topic.trim(),
    sourceBook: sourceBook.trim() || undefined, pageRange: pageRange.trim() || undefined,
    questionCount: questionCount ? Number(questionCount) : undefined,
    note: note.trim() || undefined, autoSend, schoolWide: isSubjectTeacher ? schoolWide : false,
  });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!topic.trim()) { setError(kind === "TOPIC" ? "Konu gerekli" : "Başlık gerekli (ör. Deneme Sınavı)"); return; }
    setSaving(true);
    try {
      if (existing) await api.savePlanEntry(existing.id, payload());
      else await api.createPlanEntry(payload());
      onSaved();
    } catch (err) {
      setError(err.message || "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  const publishNow = async () => {
    let confirmText = "Bu kayıt tüm öğrencilerinize şimdi gönderilsin mi? Bu işlem geri alınamaz.";
    if (existing.schoolWide) {
      confirmText = "Bu kayıt OKULDAKİ TÜM ilgili öğrencilere gönderilecek. Bu işlem geri alınamaz.";
      try {
        const { count } = await api.planSchoolWideCount(existing.examType);
        confirmText = `Bu kayıt okuldaki TÜM ${count} ${existing.examType} öğrencisine gönderilecek (yalnızca sizin öğrencileriniz değil). Bu işlem geri alınamaz. Devam edilsin mi?`;
      } catch { /* sayım alınamazsa genel uyarı ile devam */ }
    }
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    setError("");
    try {
      await api.publishPlanEntry(existing.id);
      onSaved();
    } catch (err) {
      setError(err.message || "Yayınlanamadı");
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("Bu kayıt silinsin mi?")) return;
    setBusy(true);
    setError("");
    try {
      await api.deletePlanEntry(existing.id);
      onSaved();
    } catch (err) {
      setError(err.message || "Silinemedi");
      setBusy(false);
    }
  };

  const dateLabel = new Date(`${dateKey}T00:00:00`).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric", weekday: "long" });

  if (published) {
    return (
      <Modal title={dateLabel} onClose={onClose}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <Pill tone="green">Gönderildi</Pill>
          <Pill tone={KIND_TONES[existing.kind]}>{KIND_LABELS[existing.kind]}</Pill>
          {existing.schoolWide && <Pill tone="accent">Okul Çapında</Pill>}
        </div>
        <div style={{ fontFamily: displayFont, fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 4 }}>
          {existing.subject ? `${existing.subject} — ` : ""}{existing.topic}
        </div>
        {existing.questionCount && <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.muted }}>{existing.questionCount} soru</div>}
        <div style={{ fontFamily: bodyFont, fontSize: 12, color: C.mutedLight, marginTop: 12 }}>
          Bu kayıt zaten yayınlandı, buradan değiştirilemez — ödevin kendisi "Ödevlerim" sekmesinden yönetilir.
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={dateLabel} onClose={onClose}>
      <form onSubmit={submit}>
        <Select label="Tür" value={kind} onChange={(e) => { setKind(e.target.value); if (!topic) setTopic(e.target.value === "PRACTICE_TEST" ? "Deneme Sınavı" : e.target.value === "HOLIDAY" ? "Tatil Ödevi" : ""); }}>
          <option value="TOPIC">Konu Anlatımı</option>
          <option value="PRACTICE_TEST">Deneme Çözümü</option>
          <option value="HOLIDAY">Tatil Ödevi</option>
        </Select>

        {kind === "TOPIC" ? (
          <>
            <Select label="Ders" value={subject} onChange={(e) => setSubject(e.target.value)}>
              {SUBJECTS_BY_EXAM[examType].map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Input label="Konu" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="ör. Çarpanlara Ayırma" required />
            <Input label="Kaynak Kitap (opsiyonel)" value={sourceBook} onChange={(e) => setSourceBook(e.target.value)} placeholder="ör. 3D Yayınları" />
            <Input label="Sayfa / Soru Aralığı (opsiyonel)" value={pageRange} onChange={(e) => setPageRange(e.target.value)} placeholder="ör. 45-60" />
            <Input
              label={`Soru Sayısı (opsiyonel, önerilen 20-${MAX_QUESTION_COUNT})`} type="number" min="1" max={MAX_QUESTION_COUNT}
              value={questionCount} onChange={(e) => setQuestionCount(e.target.value)} placeholder="ör. 25"
            />
          </>
        ) : (
          <>
            <Input label="Başlık" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={kind === "PRACTICE_TEST" ? "ör. Deneme Sınavı" : "ör. Tatil Ödevi"} required />
            <Textarea label="Not (opsiyonel)" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="ör. Her gün 1 deneme çöz" />
          </>
        )}

        <Input label="Tarih" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />

        <Select label="Gönderim" value={autoSend} onChange={(e) => setAutoSend(e.target.value)}>
          <option value="OFF">Elle yayınlayacağım</option>
          <option value="ON_DATE">Otomatik — tarihi gelince gönder</option>
          <option value="DAY_BEFORE">Otomatik — bir gün önceden gönder</option>
        </Select>
        {autoSend !== "OFF" && (
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: -10, marginBottom: 16 }}>
            <Clock size={11} style={{ verticalAlign: -1, marginRight: 3 }} />{AUTO_SEND_LABELS[autoSend]} — istersen aşağıdan yine elle "Yayınla" diyebilirsin.
          </div>
        )}

        {isSubjectTeacher && (
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 16, padding: 10, borderRadius: C.radiusSm, background: schoolWide ? C.accentSoft : C.surface2, border: `1px solid ${schoolWide ? C.accent : C.border}`, cursor: "pointer" }}>
            <input type="checkbox" checked={schoolWide} onChange={(e) => setSchoolWide(e.target.checked)} style={{ marginTop: 2 }} />
            <span style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.text }}>
              <strong>Okul çapında ortak ödev</strong> — yayınlandığında yalnızca sizin öğrencilerinize değil, okuldaki bu sınav türüne ({examType}) hazırlanan TÜM öğrencilere gönderilir.
            </span>
          </label>
        )}

        {error && <div style={{ color: C.red, fontSize: 12.5, fontWeight: 600, marginBottom: 14 }}>{error}</div>}

        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <Button full type="submit" disabled={saving || busy}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
          </div>
          {existing && (
            <Button icon={Send} disabled={saving || busy} onClick={publishNow}>Yayınla</Button>
          )}
        </div>
        {existing && (
          <button
            type="button" onClick={remove} disabled={saving || busy}
            style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center", width: "100%", marginTop: 10, background: "none", border: "none", color: C.red, fontFamily: bodyFont, fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 6 }}
          >
            <Trash2 size={13} /> Bu kaydı sil
          </button>
        )}
      </form>
    </Modal>
  );
}
