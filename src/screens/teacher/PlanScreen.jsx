import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Send, Trash2, Clock, CalendarClock } from "lucide-react";
import { C, displayFont, bodyFont, monoFont } from "../../theme.js";
import { Card, Button, Input, Select, Textarea, Pill, Chip, SectionHeader, EmptyState, Modal, LoadingState, confirmDialog } from "../../components/common.jsx";
import { api } from "../../api.js";
import { SUBJECTS_BY_EXAM, trackForGrade, branchOfSubject } from "../../subjects.js";
import TopicField from "../../components/TopicField.jsx";

// Telefonda bir güne dokunmak o günün kayıtlarını listeleyen alt sayfayı (DayAgendaModal) açar —
// masaüstünde doğrudan yeni kayıt penceresi. Hücreler her genişlikte aynı kompakt düzende (gün + en
// fazla 3 durum noktası); kayıtların kendisi takvimin altındaki "Bu ayın kayıtları" listesinde okunur.
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

// Okul kuralı günde en fazla 30 soru — birden çok günü kapsayan kayıtta sınır gün sayısıyla çarpılır
// (sunucu: routes/planEntries.js > maxQuestionCount).
const MAX_QUESTIONS_PER_DAY = 30;
function dayCount(date, endDate) {
  if (!date || !endDate || endDate <= date) return 1;
  return Math.round((new Date(`${endDate}T00:00:00Z`) - new Date(`${date}T00:00:00Z`)) / 86400000) + 1;
}
const KIND_LABELS = { TOPIC: "Konu anlatımı", PRACTICE_TEST: "Deneme", HOLIDAY: "Tatil ödevi" };
const KIND_TONES = { TOPIC: "accent", PRACTICE_TEST: "amber", HOLIDAY: "muted" };
const AUTO_SEND_LABELS = { ON_DATE: "Tarihi gelince otomatik", DAY_BEFORE: "Bir gün önceden otomatik" };
const WEEKDAY_LABELS = ["PZT", "SAL", "ÇAR", "PER", "CUM", "CMT", "PAZ"];

// Kaydın durumu — takvim noktası, açıklama ve satır rozeti aynı üç durumu gösterir:
// gönderildi (ödeve dönüştü), planlı (otomatik gönderim açık, zamanı gelince kendisi gidecek),
// taslak (otomatik gönderim kapalı, koçun elle "Yayınla" demesini bekliyor).
function entryStatus(entry) {
  if (entry.assignmentId) return "sent";
  if (entry.autoSend && entry.autoSend !== "OFF") return "planned";
  return "draft";
}
const STATUS_META = {
  sent: { label: "Gönderildi", tone: "green" },
  planned: { label: "Planlı", tone: "accent" },
  draft: { label: "Taslak", tone: "amber" },
};
// Fonksiyon olarak tanımlanır (sabit bir nesne DEĞİL) — C.* değerleri tema değişince YERİNDE
// güncellendiği için (bkz. theme.js), modül yüklenirken BİR KEZ hesaplanan bir nesne o anki temayı
// donmuş halde tutar; koyu temaya geçilince noktalar hâlâ eski (açık tema) renklerinde kalırdı.
function statusColor(status) {
  return { sent: C.green, planned: C.accent, draft: C.amber }[status];
}

function entryTitle(entry) {
  return entry.subject ? `${entry.subject} — ${entry.topic}` : entry.topic || KIND_LABELS[entry.kind];
}

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
  const [shiftFrom, setShiftFrom] = useState(null); // "Ertele" penceresinin başlangıç kaydı

  useEffect(() => {
    api.teacherListStudents().then(({ students }) => setStudents(students)).catch((e) => setRosterError(e.message || "Öğrenci listesi yüklenemedi"));
  }, []);
  const activeStudents = useMemo(() => students.filter((s) => !s.banned).map((s) => ({ ...s, track: trackForGrade(s.gradeLevel) })), [students]);
  const tracksPresent = useMemo(() => [...new Set(activeStudents.map((s) => s.track).filter(Boolean))], [activeStudents]);
  // Sınav türü (TYT/AYT) hızlıca değiştirilince önceki türün
  // geç gelen yanıtı yeni sekmenin altında gösterilmesin diye yalnızca SON isteğin yanıtı uygulanır.
  const loadSeq = useRef(0);
  const load = () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    api.listPlanEntries(examType)
      .then(({ entries }) => { if (seq === loadSeq.current) setEntries(entries); })
      .catch((e) => { if (seq === loadSeq.current) setToast({ type: "error", text: e.message }); })
      .finally(() => { if (seq === loadSeq.current) setLoading(false); });
  };
  useEffect(load, [examType]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!toast) return;
    // "Geri al" düğmeli bildirim daha uzun kalır — öğretmen fark edip dokunabilsin.
    const t = setTimeout(() => setToast(null), toast.action ? 12000 : 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const afterShift = (result, weeks) => {
    setShiftFrom(null);
    load();
    setToast({
      type: "ok",
      text: `${result.total} konu ${weeks} hafta ertelendi.`,
      action: {
        label: "Geri al",
        run: async () => {
          setToast(null);
          try {
            await api.restorePlanDates(result.undo);
            setToast({ type: "ok", text: "Erteleme geri alındı." });
          } catch (e) {
            setToast({ type: "error", text: e.message || "Geri alınamadı" });
          }
          load();
        },
      },
    });
  };

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
  const today = new Date();
  const todayKey = ymd(today);
  const viewingTodayMonth = viewDate.getFullYear() === today.getFullYear() && currentMonth === today.getMonth();

  const openNew = (dateKey) => setModalState({ date: dateKey, entry: null });
  const openExisting = (dateKey, entry) => setModalState({ date: dateKey, entry });
  // Telefonda bir güne dokunmak (kayıt olsun ya da olmasın) küçük bir noktaya isabet ettirmeye
  // çalışmak yerine önce o günün kayıtlarını listeleyen bir ajanda açar — yeni kayıt eklemek de
  // oradaki "Yeni kayıt ekle" düğmesiyle olur.
  const openDayCell = (dateKey) => {
    if (isMobile) setDayAgendaDate(dateKey);
    else openNew(dateKey);
  };

  const afterSave = () => { setModalState(null); load(); };

  if (rosterError) return <EmptyState text={rosterError} />;
  if (tracksPresent.length === 0 && !loading) {
    return <EmptyState text="Yıllık plan oluşturmak için önce öğrencilerine sınıf düzeyi girilmiş olmalı." />;
  }

  const monthEntries = entries.filter((e) => {
    const d = new Date(`${e.date.slice(0, 10)}T00:00:00`);
    return d.getFullYear() === viewDate.getFullYear() && d.getMonth() === currentMonth;
  });

  return (
    <div className="k-page" style={{ padding: 28, maxWidth: 760, margin: "0 auto" }}>
      {toast && (
        <div role={toast.type === "error" ? "alert" : "status"} style={{ marginBottom: 14, padding: "11px 14px", borderRadius: 12, background: toast.type === "error" ? C.redSoft : C.greenSoft, color: toast.type === "error" ? C.red : C.green, fontSize: 12.5, fontWeight: 600, fontFamily: bodyFont, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ flex: 1, minWidth: 0 }}>{toast.text}</span>
          {toast.action && (
            <button type="button" onClick={toast.action.run} style={{ background: "none", border: "none", padding: "2px 4px", cursor: "pointer", fontFamily: bodyFont, fontSize: 12.5, fontWeight: 800, color: "inherit", textDecoration: "underline" }}>
              {toast.action.label}
            </button>
          )}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
        <div className="k-chip-row" role="group" aria-label="Sınav türü">
          {tracksPresent.includes("YKS") && (
            <>
              <Chip active={examType === "TYT"} onClick={() => setExamType("TYT")}>TYT</Chip>
              <Chip active={examType === "AYT"} onClick={() => setExamType("AYT")}>AYT</Chip>
            </>
          )}
        </div>
        {/* Başka bir aya geçildiyse bugüne tek dokunuşla dönüş — içinde bulunulan ay açıkken gereksiz, gizli. */}
        {!viewingTodayMonth && <Button small variant="ghost" onClick={() => setViewDate(new Date())}>Bugün</Button>}
      </div>

      {loading ? (
        <LoadingState />
      ) : (
        <>
          <Card style={{ padding: "14px 12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0 2px" }}>
              <MonthNavButton label="Önceki ay" icon={ChevronLeft} onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))} />
              <div aria-live="polite" style={{ fontFamily: displayFont, fontSize: 16, fontWeight: 700, letterSpacing: -0.1, color: C.text, textTransform: "capitalize", textAlign: "center", minWidth: 0 }}>
                {monthLabel(viewDate)}
              </div>
              <MonthNavButton label="Sonraki ay" icon={ChevronRight} onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))} />
            </div>

            <div aria-hidden="true" style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", marginTop: 12, marginBottom: 2 }}>
              {WEEKDAY_LABELS.map((w) => (
                <div key={w} style={{ textAlign: "center", fontFamily: bodyFont, fontSize: 10.5, fontWeight: 800, letterSpacing: 1.2, color: C.mutedLight, padding: "6px 0" }}>{w}</div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", rowGap: 2 }}>
              {grid.map((d) => {
                const key = ymd(d);
                const dayEntries = entriesByDate.get(key) || [];
                const inMonth = d.getMonth() === currentMonth;
                const isToday = key === todayKey;
                return (
                  <button
                    key={key}
                    type="button"
                    data-date={key}
                    onClick={() => openDayCell(key)}
                    aria-current={isToday ? "date" : undefined}
                    aria-label={`${d.getDate()} ${d.toLocaleDateString("tr-TR", { month: "long" })}${dayEntries.length ? `, ${dayEntries.length} kayıt` : ""}`}
                    className="k-icon-btn"
                    style={{
                      height: 44, minWidth: 0, padding: 0, border: "none", borderRadius: 10, background: "transparent", cursor: "pointer",
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
                    }}
                  >
                    <span style={{
                      width: 26, height: 26, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center",
                      background: isToday ? C.accent : "transparent",
                      // Diğer ayın günleri soluk ama okunur (mutedLight, 4.5:1) — tıklanabilir düğmeler oldukları
                      // için dokümandaki en soluk ton (#BAC1D4, 1.8:1) yerine; bu ayın günleri koyu kalır.
                      color: isToday ? C.onAccent : inMonth ? C.text : C.mutedLight,
                      fontFamily: monoFont, fontSize: 12.5, fontWeight: isToday ? 700 : 500,
                    }}>
                      {d.getDate()}
                    </span>
                    <span aria-hidden="true" style={{ height: 5, display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
                      {dayEntries.slice(0, 3).map((entry) => (
                        <span key={entry.id} style={{ width: 5, height: 5, borderRadius: 999, background: statusColor(entryStatus(entry)), flexShrink: 0 }} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Noktaların ne anlama geldiği — önceden üç renk vardı ama hiçbir yerde açıklanmıyordu. */}
            <div style={{ height: 1, background: C.divider, margin: "10px 2px 12px" }} />
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: "0 4px" }}>
              <Legend color={statusColor("planned")} label={STATUS_META.planned.label} />
              <Legend color={statusColor("sent")} label={STATUS_META.sent.label} />
              <Legend color={statusColor("draft")} label={STATUS_META.draft.label} />
            </div>
          </Card>

          {/* Hücreler yalnızca nokta gösterdiği için ayın kayıtları takvimin altında okunur bir liste olarak
              da verilir — hangi gün ne var, tek tek güne dokunmadan görülsün. */}
          <MonthEntries
            entries={monthEntries}
            onOpenEntry={(entry) => openExisting(entry.date.slice(0, 10), entry)}
          />
        </>
      )}

      {modalState && (
        <PlanEntryModal
          examType={examType}
          dateKey={modalState.date}
          existing={modalState.entry}
          isSubjectTeacher={isSubjectTeacher}
          teachingSubjects={user?.teachingSubjects || []}
          onClose={() => setModalState(null)}
          onSaved={afterSave}
          onShift={(entry) => { setModalState(null); setShiftFrom(entry); }}
        />
      )}

      {shiftFrom && <ShiftModal entry={shiftFrom} onClose={() => setShiftFrom(null)} onDone={afterShift} />}

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

function MonthNavButton({ label, icon: Icon, onClick }) {
  return (
    <button
      type="button" aria-label={label} onClick={onClick} className="k-icon-btn"
      style={{ width: 36, height: 36, flexShrink: 0, borderRadius: C.radiusSm, border: "none", background: C.surface2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.text2 }}
    >
      <Icon size={17} />
    </button>
  );
}

// Telefonda bir güne dokunulunca açılan liste — o günün kayıtları (varsa) düzenlenebilir satırlar
// olarak, altında da her zaman "Yeni kayıt ekle" düğmesi olarak gösterilir.
function DayAgendaModal({ dateKey, entries, onClose, onOpenEntry, onAddNew }) {
  const dateLabel = new Date(`${dateKey}T00:00:00`).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric", weekday: "long" });
  return (
    <Modal title={dateLabel} onClose={onClose}>
      {entries.length === 0 ? (
        <div style={{ fontFamily: bodyFont, fontSize: 13.5, color: C.muted, marginBottom: 16 }}>Bu gün için henüz bir kayıt yok.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {entries.map((entry) => {
            const status = entryStatus(entry);
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => onOpenEntry(entry)}
                className="k-icon-btn"
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 52, textAlign: "left",
                  background: C.fieldBg, border: `1px solid ${C.border}`, borderRadius: 12,
                  padding: "8px 12px", cursor: "pointer",
                }}
              >
                <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: statusColor(status), flexShrink: 0 }} />
                <span style={{ fontFamily: bodyFont, fontSize: 13.5, fontWeight: 700, color: C.text, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {entryTitle(entry)}
                </span>
                {entry.schoolWide && <Pill tone="blue">Okul çapında</Pill>}
                {entry.gradeLevel && <Pill mono>{entry.gradeLevel}. sınıf</Pill>}
                <Pill tone={STATUS_META[status].tone}>{STATUS_META[status].label}</Pill>
              </button>
            );
          })}
        </div>
      )}
      <Button full icon={Plus} onClick={onAddNew}>Yeni kayıt ekle</Button>
    </Modal>
  );
}

function MonthEntries({ entries, onOpenEntry }) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <section>
      <SectionHeader title="Bu ayın kayıtları" count={sorted.length} />
      {sorted.length === 0 ? (
        <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.muted, textAlign: "center", padding: "10px 0" }}>
          Bu ay için henüz kayıt yok — takvimden bir gün seçip ekleyebilirsin.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sorted.map((entry) => <EntryRow key={entry.id} entry={entry} onClick={() => onOpenEntry(entry)} />)}
        </div>
      )}
    </section>
  );
}

// Kayıt satırı (62px): solda gün + haftanın günü, ince dikey ayırıcı, başlık ve tür/soru sayısı,
// sağda durum rozeti. Ders ikonu bilerek yok — satırı günü öne çıkaran bir ajanda satırı gibi tutar.
function EntryRow({ entry, onClick }) {
  const d = new Date(`${entry.date.slice(0, 10)}T00:00:00`);
  const status = entryStatus(entry);
  const days = dayCount(entry.date.slice(0, 10), entry.endDate?.slice(0, 10));
  return (
    <button
      type="button"
      onClick={onClick}
      className="k-card-hover"
      style={{
        display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 62, boxSizing: "border-box",
        padding: "8px 14px 8px 12px", textAlign: "left", cursor: "pointer",
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: C.radiusMd, boxShadow: C.shadowMd,
      }}
    >
      <span style={{ width: 34, flexShrink: 0, textAlign: "center" }}>
        <span style={{ display: "block", fontFamily: monoFont, fontSize: 16, fontWeight: 700, color: C.text, lineHeight: 1.15 }}>{d.getDate()}</span>
        <span style={{ display: "block", fontFamily: bodyFont, fontSize: 9, fontWeight: 800, letterSpacing: 0.6, color: C.mutedLight, marginTop: 2 }}>{WEEKDAY_LABELS[(d.getDay() + 6) % 7]}</span>
      </span>
      <span aria-hidden="true" style={{ width: 1, height: 30, background: C.divider, flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontFamily: bodyFont, fontSize: 13.5, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {entryTitle(entry)}
        </span>
        <span style={{ display: "block", fontFamily: bodyFont, fontSize: 11.5, fontWeight: 500, color: C.mutedLight, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {KIND_LABELS[entry.kind]}
          {days > 1 ? <> · <span style={{ fontFamily: monoFont }}>{days}</span> gün</> : null}
          {entry.questionCount ? <> · <span style={{ fontFamily: monoFont }}>{entry.questionCount}</span> soru</> : null}
          {entry.schoolWide ? " · okul çapında" : ""}
          {entry.gradeLevel ? ` · ${entry.gradeLevel}. sınıf` : ""}
        </span>
      </span>
      <Pill tone={STATUS_META[status].tone}>{STATUS_META[status].label}</Pill>
    </button>
  );
}

function Legend({ color, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: color }} />
      <span style={{ fontFamily: bodyFont, fontSize: 11.5, fontWeight: 600, color: C.muted }}>{label}</span>
    </div>
  );
}

// Branş öğretmeninin yeni kaydında ders kendi branşından biriyle başlar (ör. Coğrafya öğretmeni AYT'de Coğrafya-1).
function defaultSubject(examType, teachingSubjects) {
  const list = SUBJECTS_BY_EXAM[examType];
  return list.find((s) => teachingSubjects.includes(branchOfSubject(s))) || list[0];
}

function PlanEntryModal({ examType: tabExamType, dateKey, existing, isSubjectTeacher, teachingSubjects, onClose, onSaved, onShift }) {
  const published = !!existing?.assignmentId;
  // Var olan bir kayıt düzenlenirken KENDİ sınav türü kullanılır — açık sekmeninki değil; aksi halde
  // kayıt sessizce başka sınav türüne taşınıyor ya da "Geçersiz ders" hatası veriyordu.
  const examType = existing?.examType || tabExamType;
  const [kind, setKind] = useState(existing?.kind || "TOPIC");
  const [subject, setSubject] = useState(existing?.subject || defaultSubject(examType, teachingSubjects));
  const [topic, setTopic] = useState(existing?.topic || "");
  const [sourceBook, setSourceBook] = useState(existing?.sourceBook || "");
  const [pageRange, setPageRange] = useState(existing?.pageRange || "");
  const [questionCount, setQuestionCount] = useState(existing?.questionCount ? String(existing.questionCount) : "");
  const [note, setNote] = useState(existing?.note || "");
  const [date, setDate] = useState(existing?.date ? existing.date.slice(0, 10) : dateKey);
  const [endDate, setEndDate] = useState(existing?.endDate ? existing.endDate.slice(0, 10) : "");
  const [autoSend, setAutoSend] = useState(existing?.autoSend || "OFF");
  const [schoolWide, setSchoolWide] = useState(existing?.schoolWide || false);
  // Hedef sınıf: "" = 11 ve 12 (tüm YKS), "11" / "12" = yalnız o düzey. Yıllık planlar sınıf düzeyine göre ayrıdır.
  const [gradeLevel, setGradeLevel] = useState(existing?.gradeLevel ? String(existing.gradeLevel) : "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const maxQuestions = MAX_QUESTIONS_PER_DAY * dayCount(date, endDate);

  const payload = () => ({
    examType, date, endDate: endDate || undefined, kind, subject: kind === "TOPIC" ? subject : undefined, topic: topic.trim(),
    sourceBook: sourceBook.trim() || undefined, pageRange: pageRange.trim() || undefined,
    questionCount: questionCount ? Number(questionCount) : undefined,
    note: note.trim() || undefined, autoSend, schoolWide: isSubjectTeacher ? schoolWide : false,
    gradeLevel: gradeLevel ? Number(gradeLevel) : null,
  });
  // Son kaydedilmiş hâlin anlık görüntüsü — "Yayınla"ya basıldığında formda kaydedilmemiş değişiklik
  // olup olmadığını anlamak için.
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(payload()));

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

  // Yayın, formdaki kaydedilmemiş düzeltmeleri (konu, tarih, okul çapı...) önce kaydeder — önceden
  // veritabanındaki ESKİ hâl tüm öğrencilere gönderiliyor (geri alınamaz), düzeltmeler kayboluyordu.
  const publishNow = async () => {
    const current = payload();
    const dirty = JSON.stringify(current) !== savedSnapshot;
    if (dirty && !current.topic) { setError(kind === "TOPIC" ? "Konu gerekli" : "Başlık gerekli (ör. Deneme Sınavı)"); return; }
    const g = current.gradeLevel;
    let confirmText = `Bu kayıt ${g ? `${g}. sınıftaki ` : "tüm "}öğrencilerinize şimdi gönderilsin mi? Bu işlem geri alınamaz.`;
    if (current.schoolWide) {
      confirmText = `Bu kayıt OKULDAKİ ${g ? `TÜM ${g}. SINIF` : "TÜM ilgili"} öğrencilere gönderilecek. Bu işlem geri alınamaz.`;
      try {
        const { count } = await api.planSchoolWideCount(examType, g);
        confirmText = `Bu kayıt okuldaki ${count} ${g ? `${g}. sınıf ` : ""}${examType} öğrencisine gönderilecek${g ? "" : " (11 ve 12. sınıflar)"} — yalnızca sizin öğrencileriniz değil. Bu işlem geri alınamaz. Devam edilsin mi?`;
      } catch { /* sayım alınamazsa genel uyarı ile devam */ }
    }
    if (dirty) confirmText = `Yaptığın değişiklikler önce kaydedilecek. ${confirmText}`;
    if (!(await confirmDialog({ title: "Kayıt yayınlansın mı?", message: confirmText, confirmLabel: "Yayınla" }))) return;
    setBusy(true);
    setError("");
    try {
      if (dirty) {
        await api.savePlanEntry(existing.id, current);
        setSavedSnapshot(JSON.stringify(current));
      }
      await api.publishPlanEntry(existing.id);
      onSaved();
    } catch (err) {
      setError(err.message || "Yayınlanamadı");
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!(await confirmDialog({ title: "Kayıt silinsin mi?", message: "Bu takvim kaydı silinecek.", confirmLabel: "Sil", danger: true }))) return;
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
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          <Pill tone="green">Gönderildi</Pill>
          <Pill tone={KIND_TONES[existing.kind]}>{KIND_LABELS[existing.kind]}</Pill>
          {existing.schoolWide && <Pill tone="blue">Okul çapında</Pill>}
          {existing.gradeLevel && <Pill mono>{existing.gradeLevel}. sınıf</Pill>}
        </div>
        <div style={{ fontFamily: displayFont, fontSize: 16, fontWeight: 700, letterSpacing: -0.1, color: C.text, marginBottom: 4 }}>
          {existing.subject ? `${existing.subject} — ` : ""}{existing.topic}
        </div>
        {existing.questionCount > 0 && (
          <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.muted }}>
            <span style={{ fontFamily: monoFont }}>{existing.questionCount}</span> soru
          </div>
        )}
        {existing.endDate && existing.endDate.slice(0, 10) !== existing.date.slice(0, 10) && (
          <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.muted }}>
            Bitiş: {new Date(`${existing.endDate.slice(0, 10)}T00:00:00`).toLocaleDateString("tr-TR", { day: "2-digit", month: "long" })}
          </div>
        )}
        {existing.note && <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.text2, marginTop: 8, whiteSpace: "pre-wrap" }}>{existing.note}</div>}
        <div style={{ fontFamily: bodyFont, fontSize: 12, color: C.mutedLight, marginTop: 14, lineHeight: 1.45 }}>
          Bu kayıt zaten yayınlandı, buradan değiştirilemez — ödevin kendisi "Ödevlerim" sekmesinden yönetilir.
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={dateLabel} onClose={onClose}>
      <form onSubmit={submit}>
        <Select label="Tür" value={kind} onChange={(e) => {
          const k = e.target.value;
          setKind(k);
          // Deneme/Tatil'in varsayılan başlığı Konu Anlatımı'na dönülünce "elle yazılmış konu" gibi kalmasın.
          if (k === "TOPIC") { if (topic === "Deneme Sınavı" || topic === "Tatil Ödevi") setTopic(""); }
          else if (!topic) setTopic(k === "PRACTICE_TEST" ? "Deneme Sınavı" : "Tatil Ödevi");
        }}>
          <option value="TOPIC">Konu anlatımı</option>
          <option value="PRACTICE_TEST">Deneme çözümü</option>
          <option value="HOLIDAY">Tatil ödevi</option>
        </Select>

        {kind === "TOPIC" ? (
          <>
            <Select label="Ders" value={subject} onChange={(e) => setSubject(e.target.value)}>
              {SUBJECTS_BY_EXAM[examType].map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
            <TopicField label="Konu" examType={examType} subject={subject} value={topic} onChange={setTopic} placeholder="ör. Çarpanlara ayırma" required />
            <Input label="Kaynak kitap (opsiyonel)" value={sourceBook} onChange={(e) => setSourceBook(e.target.value)} placeholder="ör. 3D Yayınları" />
            <Input label="Sayfa / soru aralığı (opsiyonel)" value={pageRange} onChange={(e) => setPageRange(e.target.value)} placeholder="ör. 45-60" />
            <Input
              label={maxQuestions === MAX_QUESTIONS_PER_DAY
                ? `Soru sayısı (opsiyonel, önerilen 20-${MAX_QUESTIONS_PER_DAY})`
                : `Soru sayısı (opsiyonel, günde ${MAX_QUESTIONS_PER_DAY} → en fazla ${maxQuestions})`}
              type="number" inputMode="numeric" pattern="[0-9]*" min="1" max={maxQuestions}
              value={questionCount} onChange={(e) => setQuestionCount(e.target.value)} placeholder="ör. 25"
            />
          </>
        ) : (
          <Input label="Başlık" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={kind === "PRACTICE_TEST" ? "ör. Deneme Sınavı" : "ör. Tatil Ödevi"} required />
        )}
        {/* Not artık yayınlanınca ödevle birlikte öğrenciye de gider (önceden sessizce kayboluyordu). */}
        <Textarea label="Öğrenciye not (opsiyonel)" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={kind === "TOPIC" ? "ör. Önce konu özetini oku" : "ör. Her gün 1 deneme çöz"} />

        <div style={{ display: "flex", gap: 12 }}>
          {/* minWidth:0 — iOS/Chrome tarih alanının kendi asgari genişliği flex çocuğunu pencerenin dışına taşırıyordu. */}
          <div style={{ flex: 1, minWidth: 0 }}><Input label="Tarih" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
          <div style={{ flex: 1, minWidth: 0 }}><Input label="Bitiş (opsiyonel)" type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} /></div>
        </div>
        {endDate && endDate < date && (
          <div style={{ fontFamily: bodyFont, fontSize: 11.5, color: C.red, marginTop: -10, marginBottom: 16 }}>Bitiş tarihi başlangıçtan önce olamaz.</div>
        )}

        <Select label="Gönderim" value={autoSend} onChange={(e) => setAutoSend(e.target.value)}>
          <option value="OFF">Elle yayınlayacağım</option>
          <option value="ON_DATE">Otomatik — tarihi gelince gönder</option>
          <option value="DAY_BEFORE">Otomatik — bir gün önceden gönder</option>
        </Select>
        {autoSend !== "OFF" && (
          <div style={{ fontFamily: bodyFont, fontSize: 11.5, color: C.muted, marginTop: -10, marginBottom: 16 }}>
            <Clock size={11} style={{ verticalAlign: -1, marginRight: 3 }} />{AUTO_SEND_LABELS[autoSend]} — istersen aşağıdan yine elle "Yayınla" diyebilirsin.
          </div>
        )}

        {isSubjectTeacher && (
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 16, padding: "11px 12px", borderRadius: 12, background: schoolWide ? C.accentSoft : C.fieldBg, border: `1px solid ${schoolWide ? C.accent : C.border}`, cursor: "pointer" }}>
            <input type="checkbox" checked={schoolWide} onChange={(e) => { setSchoolWide(e.target.checked); if (e.target.checked && !existing && !gradeLevel) setGradeLevel("12"); }} style={{ marginTop: 2, accentColor: C.accent }} />
            <span style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.text2, lineHeight: 1.45 }}>
              <strong style={{ color: C.text }}>Okul çapında ortak ödev</strong> — yayınlandığında yalnızca sizin öğrencilerinize değil, okuldaki bu sınav türüne ({examType}) hazırlanan TÜM öğrencilere gönderilir.
            </span>
          </label>
        )}

        <Select label="Hedef sınıf" value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)}>
          <option value="">11 ve 12. sınıflar</option>
          <option value="12">Yalnız 12. sınıf</option>
          <option value="11">Yalnız 11. sınıf</option>
        </Select>
        <div style={{ fontFamily: bodyFont, fontSize: 11.5, color: C.muted, marginTop: -10, marginBottom: 16 }}>
          Yayınlanınca yalnızca seçilen sınıf düzeyindeki öğrencilere gider{schoolWide ? " (okul çapında)" : " (senin öğrencilerin arasından)"}.
        </div>

        {error && <div role="alert" style={{ color: C.red, fontFamily: bodyFont, fontSize: 12.5, fontWeight: 600, marginBottom: 14 }}>{error}</div>}

        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <Button full type="submit" disabled={saving || busy}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
          </div>
          {existing && (
            <Button icon={Send} disabled={saving || busy} onClick={publishNow} style={{ height: 50 }}>Yayınla</Button>
          )}
        </div>
        {existing?.kind === "TOPIC" && (
          <Button full variant="secondary" icon={CalendarClock} disabled={saving || busy} onClick={() => onShift(existing)} style={{ marginTop: 10 }}>
            Ertele — bu haftadan itibaren kaydır
          </Button>
        )}
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

// "Ertele": öğretmen geride kaldığında (hastalık, izin) bu kayıttan itibaren konular kendi planındaki
// sıradaki haftaya kayar — tatil/sınav haftaları planda boş olduğu için kendiliğinden atlanır (bkz.
// server > routes/planEntries.js > buildShiftPlan). Önce sunucudan önizleme alınır, hiçbir şey yazılmaz.
function shortDate(iso) {
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
}

function ShiftModal({ entry, onClose, onDone }) {
  const [weeks, setWeeks] = useState(1);
  const [onlyThis, setOnlyThis] = useState(false);
  const [preview, setPreview] = useState(null);
  const [multiSubject, setMultiSubject] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const from = entry.date.slice(0, 10);
  const payload = { from, weeks, ...(onlyThis ? { examType: entry.examType, subject: entry.subject } : {}) };
  const payloadKey = JSON.stringify(payload);

  useEffect(() => {
    let alive = true;
    setPreview(null);
    setError("");
    api.previewPlanShift(payload)
      .then((res) => {
        if (!alive) return;
        setPreview(res);
        if (!onlyThis) setMultiSubject(res.groups.length > 1);
      })
      .catch((e) => { if (alive) setError(e.message || "Önizleme alınamadı"); });
    return () => { alive = false; };
  }, [payloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const apply = async () => {
    setBusy(true);
    setError("");
    try {
      onDone(await api.shiftPlan(payload), weeks);
    } catch (e) {
      setError(e.message || "Ertelenemedi");
      setBusy(false);
    }
  };

  return (
    <Modal title="Konuları ertele" onClose={onClose}>
      <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.muted, lineHeight: 1.5, marginBottom: 14 }}>
        <strong style={{ color: C.text }}>{shortDate(from)}</strong> tarihinden itibaren her konu, planındaki sıradaki haftanın yerine geçer.
        Tatil ve sınav haftaları (planda boş olanlar) atlanır; yayınlanmış ödevler ve denemeler yerinde kalır.
      </div>

      <div style={{ fontFamily: bodyFont, fontSize: 12, fontWeight: 700, color: C.text2, marginBottom: 8 }}>Kaç hafta?</div>
      <div className="k-chip-row" role="group" aria-label="Kaç hafta" style={{ marginBottom: 14 }}>
        {[1, 2, 3].map((n) => <Chip key={n} active={weeks === n} onClick={() => setWeeks(n)}>{n} hafta</Chip>)}
      </div>

      {multiSubject && (
        <>
          <div style={{ fontFamily: bodyFont, fontSize: 12, fontWeight: 700, color: C.text2, marginBottom: 8 }}>Hangi dersler?</div>
          <div className="k-chip-row" role="group" aria-label="Hangi dersler" style={{ marginBottom: 14 }}>
            <Chip active={!onlyThis} onClick={() => setOnlyThis(false)}>Tüm derslerim</Chip>
            <Chip active={onlyThis} onClick={() => setOnlyThis(true)}>Yalnızca {entry.examType} {entry.subject}</Chip>
          </div>
        </>
      )}

      <div style={{ background: C.fieldBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 12px", marginBottom: 16, minHeight: 44 }}>
        {!preview && !error && <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.muted }}>Hesaplanıyor…</div>}
        {preview && preview.total === 0 && (
          <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.muted }}>Bu tarihten sonra ertelenecek yayınlanmamış konu yok.</div>
        )}
        {preview && preview.groups.map((g) => (
          <div key={`${g.examType}-${g.subject}`} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "4px 0", fontFamily: bodyFont, fontSize: 12.5 }}>
            <span style={{ fontWeight: 700, color: C.text }}>{g.examType} {g.subject}</span>
            <span style={{ color: C.muted, textAlign: "right" }}>
              <span style={{ fontFamily: monoFont }}>{g.count}</span> konu · son konu {shortDate(g.lastNewDate)}
            </span>
          </div>
        ))}
      </div>

      {error && <div role="alert" style={{ color: C.red, fontFamily: bodyFont, fontSize: 12.5, fontWeight: 600, marginBottom: 12 }}>{error}</div>}
      <Button full icon={CalendarClock} disabled={busy || !preview || preview.total === 0} onClick={apply}>
        {busy ? "Erteleniyor..." : preview?.total ? `${preview.total} konuyu ${weeks} hafta ertele` : "Ertele"}
      </Button>
    </Modal>
  );
}
