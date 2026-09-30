import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, Lock, Send, CalendarClock } from "lucide-react";
import { C, bodyFont, displayFont } from "../../theme.js";
import { Avatar, EmptyState, LoadingState, HeaderIconButton } from "../../components/common.jsx";
import { HeroHeader, HeroBell, SegmentFilter, NUM } from "../../components/brand.jsx";
import { api } from "../../api.js";
import { subjectsForBranches } from "../../subjects.js";
import { topicsFor } from "../../topics.js";
import { todayISO } from "../../dates.js";

// Ödev atama ekranı — YALNIZCA branş öğretmenlerinde (bkz. App.jsx > tabsFor). Branş öğretmeni bir sınıf
// düzeyini, bir şubeyi ya da tek tek seçtiği öğrencileri hedefler ("Tüm okul" 2026-09-30'da kaldırıldı, sunucu
// da reddeder); yalnızca KENDİ branşındaki dersten ödev verebilir (routes/assignments.js > assertCanAssign).
// Varsayılanlar: başlangıç bugün, gönderim hemen — ikisi de yalnızca "Planla" açılınca sorulur. Sayfa/soru
// alanı kaldırıldı (eski kayıtlarda duruyor). Kaynak kitap zorunlu.

const AUDIENCE_MODES = [
  { id: "grade", label: "Sınıf düzeyi", hint: "Bir sınıf düzeyi seç, o düzeydeki tüm öğrencilere gider." },
  { id: "class", label: "Şube", hint: "Bir şube seç, o şubedeki öğrencilere gider." },
  { id: "pick", label: "Seçerek", hint: "Öğrencileri tek tek seç." },
];
const PLAN_MODES = [
  { id: "AUTO_ON_DATE", label: "Başlangıç günü" },
  { id: "AUTO_DAY_BEFORE", label: "Bir gün önce" },
];
const CUSTOM = "__custom__";

const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const longDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
const capFirst = (t) => t.charAt(0).toLocaleUpperCase("tr-TR") + t.slice(1);

// Alan kutuları: 52px, radius 14, bg zemin, 1px çerçeve, 15/600 yazı; üstünde 12/700 etiket.
const boxStyle = (disabled) => ({
  width: "100%", minWidth: 0, boxSizing: "border-box", minHeight: 52, borderRadius: 14, padding: "0 14px",
  background: disabled ? C.track : C.pageTint, border: `1px solid ${C.brandOutline}`, color: C.inkText,
  fontFamily: bodyFont, fontSize: 15, fontWeight: 600, outline: "none", cursor: disabled ? "default" : "pointer",
});
function FieldLabel({ htmlFor, children, required }) {
  return (
    <label htmlFor={htmlFor} style={{ display: "block", fontFamily: bodyFont, fontSize: 12, fontWeight: 700, color: C.inkMuted, marginBottom: 6 }}>
      {children}{required && <span aria-hidden="true" style={{ color: C.danger }}> *</span>}
    </label>
  );
}

function StepCard({ n, title, right, children }) {
  return (
    <section aria-labelledby={`step-${n}`} style={{ background: C.surface, borderRadius: 20, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span aria-hidden="true" style={{ ...NUM, width: 26, height: 26, borderRadius: 999, background: C.brand, color: C.onBrand, fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</span>
        <h2 id={`step-${n}`} style={{ flex: 1, minWidth: 0, margin: 0, fontFamily: displayFont, fontSize: 16, fontWeight: 800, color: C.inkText }}>{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

// Çoklu seçim çipi (sınıf düzeyi, şube, öğrenci) — 44px dokunma alanı.
function ToggleChip({ active, onClick, children, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className="k-btn"
      style={{
        display: "inline-flex", alignItems: "center", gap: 7, minHeight: 44, padding: "0 14px", borderRadius: 12, cursor: "pointer", textAlign: "left",
        background: active ? C.brandTint : C.surface, border: `1.5px solid ${active ? C.brand : C.brandOutline}`,
        color: active ? C.brandText : C.inkText, fontFamily: bodyFont, fontSize: 14, fontWeight: active ? 700 : 600,
      }}
    >
      {children}
    </button>
  );
}

export default function AssignmentCreateScreen({ user, onCreated, initialStudentId, prefill, onBack, unreadCount, onOpenNotifications }) {
  const [audience, setAudience] = useState(null); // { students: [...] }
  const [audienceError, setAudienceError] = useState("");

  const branches = user?.teachingSubjects || [];
  const [examType, setExamType] = useState(() => (prefill?.examType === "AYT" ? "AYT" : "TYT"));
  const [subject, setSubject] = useState("");
  const [lastSubject, setLastSubject] = useState(null);
  const [topic, setTopic] = useState(() => prefill?.topic || "");
  const [topicCustom, setTopicCustom] = useState(false);
  const [sourceBook, setSourceBook] = useState("");
  const [sourceCustom, setSourceCustom] = useState(false);
  const [sourceBooks, setSourceBooks] = useState([]);
  const today = todayISO();
  const [endDate, setEndDate] = useState(today);
  // "Planla": kapalıyken başlangıç bugün, gönderim hemen (MANUAL_NOW) — sunucu da bu varsayılanları kullanır.
  const [planned, setPlanned] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(today);
  const [planMode, setPlanMode] = useState("AUTO_ON_DATE");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const dateRef = useRef(null);

  // Kime: mod + o moda ait seçim.
  const [mode, setMode] = useState(initialStudentId ? "pick" : "grade");
  const [grades, setGrades] = useState(() => new Set());
  const [classes, setClasses] = useState(() => new Set());
  const [picked, setPicked] = useState(() => new Set(initialStudentId ? [initialStudentId] : []));

  useEffect(() => {
    api.assignmentAudience()
      .then(setAudience)
      .catch((e) => setAudienceError(e.message || "Öğrenci listesi yüklenemedi"));
    // Ders varsayılanı: öğretmenin en son ödev verdiği ders (yoksa listedeki ilk ders).
    api.listAssignments()
      .then(({ assignments }) => {
        const last = [...assignments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
        setLastSubject(last?.subject || null);
      })
      .catch(() => {});
  }, []);

  const subjectOptions = useMemo(() => subjectsForBranches(examType, branches), [examType, branches.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (subjectOptions.includes(subject)) return;
    const pick = [prefill?.subject, lastSubject].find((s) => s && subjectOptions.includes(s)) || subjectOptions[0] || "";
    setSubject(pick);
  }, [subjectOptions, lastSubject]); // eslint-disable-line react-hooks/exhaustive-deps

  const topics = topicsFor(examType, subject);
  // Ders ya da sınav türü değişince konu ve kaynak kitap sıfırlanır; kaynak önerileri o derse göre gelir.
  const firstSubjectRef = useRef(true);
  useEffect(() => {
    if (!subject) return;
    if (firstSubjectRef.current) {
      firstSubjectRef.current = false;
      if (prefill?.topic && !topicsFor(examType, subject).includes(prefill.topic)) setTopicCustom(true);
    } else {
      setTopic("");
      setTopicCustom(false);
    }
    setSourceBook("");
    setSourceCustom(false);
    setSourceBooks([]);
    let alive = true;
    api.listSourceBooks(examType, subject)
      .then(({ sourceBooks: books }) => { if (alive) setSourceBooks(books); })
      .catch(() => {});
    return () => { alive = false; };
  }, [examType, subject]); // eslint-disable-line react-hooks/exhaustive-deps

  const students = audience?.students || [];
  const gradeOptions = useMemo(() => [...new Set(students.map((s) => s.gradeLevel).filter(Boolean))].sort((a, b) => a - b), [students]);
  const classOptions = useMemo(() => [...new Set(students.map((s) => s.className).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr")), [students]);

  const recipients = useMemo(() => {
    if (mode === "grade") return students.filter((s) => grades.has(s.gradeLevel));
    if (mode === "class") return students.filter((s) => classes.has(s.className));
    return students.filter((s) => picked.has(s.id));
  }, [mode, students, grades, classes, picked]);

  // Ödevlerim'de sayı yerine gösterilecek kısa etiket (bkz. Assignment.audienceLabel); "Seçerek" modunda null.
  const audienceLabel = useMemo(() => {
    if (mode === "grade" && grades.size) return `${[...grades].sort((a, b) => a - b).join(" ve ")}. sınıflar`;
    if (mode === "class" && classes.size) return [...classes].sort((a, b) => a.localeCompare(b, "tr")).join(", ");
    return null;
  }, [mode, grades, classes]);

  const toggleIn = (setter) => (value) => setter((prev) => {
    const next = new Set(prev);
    if (next.has(value)) next.delete(value); else next.add(value);
    return next;
  });

  const start = planned ? scheduledDate : today;
  const quick = [
    { id: "today", label: "Bugün", date: start },
    { id: "tomorrow", label: "Yarın", date: addDays(start, 1) },
    { id: "week", label: "1 hafta", date: addDays(start, 7) },
  ];
  const quickId = quick.find((q) => q.date === endDate)?.id || "custom";
  const onStartChange = (v) => {
    if (!v) return;
    setScheduledDate(v);
    if (endDate < v) setEndDate(v);
  };

  const missing = [
    recipients.length === 0 && (mode === "grade" ? "sınıf düzeyi" : mode === "class" ? "şube" : "öğrenci"),
    !topic.trim() && "konu",
    !sourceBook.trim() && "kaynak kitap",
  ].filter(Boolean);
  const missingText = missing.length === 1 ? `Önce ${missing[0]} seç`
    : missing.length ? `${capFirst(missing.slice(0, -1).join(", "))} ve ${missing[missing.length - 1]} seç` : "";
  const ready = missing.length === 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!ready || saving) return;
    setError("");
    if (endDate < start) { setError("Son teslim başlangıçtan önce olamaz"); return; }
    setSaving(true);
    try {
      const { assignment } = await api.createAssignment({
        studentIds: recipients.map((s) => s.id),
        examType, subject, topic: topic.trim(), sourceBook: sourceBook.trim(), endDate,
        ...(planned ? { scheduledDate, sendMode: planMode } : {}),
        audienceLabel: audienceLabel || undefined,
      });
      onCreated?.(assignment);
    } catch (err) {
      setError(err.message || "Ödev kaydedilemedi");
      setSaving(false);
    }
  };

  const hero = (
    <HeroHeader compact>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {onBack && <HeaderIconButton onBrand icon={ChevronLeft} label="Geri" onClick={onBack} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.onBrandMuted }}>{[subject, examType].filter(Boolean).join(" · ")}</div>
          <h1 style={{ margin: 0, fontFamily: displayFont, fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", color: C.onBrand }}>Yeni ödev</h1>
        </div>
        <HeroBell unreadCount={unreadCount} onClick={onOpenNotifications} />
      </div>
    </HeroHeader>
  );
  const shell = (children) => <div>{hero}<div style={{ maxWidth: 580, margin: "0 auto", padding: "16px 16px 24px" }}>{children}</div></div>;
  if (audienceError) return shell(<EmptyState text={audienceError} />);
  if (!audience) return shell(<LoadingState />);

  const modeHint = recipients.length ? `${recipients.length} öğrenciye gider.` : AUDIENCE_MODES.find((m) => m.id === mode).hint;
  const singleSubject = subjectOptions.length === 1;
  const noBooks = sourceBooks.length === 0;

  return shell(
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <StepCard n={1} title="Kime">
        <SegmentFilter label="Kime gönderilecek" value={mode} onChange={setMode} options={AUDIENCE_MODES} style={{ background: C.pageTint }} />
        <div role="status" style={{ fontFamily: bodyFont, fontSize: 13, color: C.inkMuted, marginTop: 10 }}>{modeHint}</div>

        {mode === "grade" && (
          <div role="group" aria-label="Sınıf düzeyi" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            {gradeOptions.map((g) => (
              <ToggleChip key={g} active={grades.has(g)} onClick={() => toggleIn(setGrades)(g)} label={`${g}. sınıf`}>
                {g}. sınıf <span style={NUM}>({students.filter((s) => s.gradeLevel === g).length})</span>
              </ToggleChip>
            ))}
          </div>
        )}
        {mode === "class" && (
          classOptions.length === 0
            ? <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.warningText, marginTop: 10 }}>Öğrencilerin şubesi (ör. 12-A) girilmemiş — yönetici Kurulum ekranından girebilir.</div>
            : (
              <div role="group" aria-label="Şube" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {classOptions.map((cn) => (
                  <ToggleChip key={cn} active={classes.has(cn)} onClick={() => toggleIn(setClasses)(cn)} label={`${cn} şubesi`}>
                    {cn} <span style={NUM}>({students.filter((s) => s.className === cn).length})</span>
                  </ToggleChip>
                ))}
              </div>
            )
        )}
        {mode === "pick" && (
          <>
            <div role="group" aria-label="Öğrenciler" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              {students.map((s) => (
                <ToggleChip key={s.id} active={picked.has(s.id)} onClick={() => toggleIn(setPicked)(s.id)} label={s.className ? `${s.name}, ${s.className}` : s.name}>
                  <Avatar name={s.name} size={26} />{s.name}
                </ToggleChip>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button type="button" onClick={() => setPicked(new Set(students.map((s) => s.id)))} style={{ minHeight: 44, padding: "0 4px", background: "none", border: "none", cursor: "pointer", fontFamily: bodyFont, fontSize: 13, fontWeight: 700, color: C.brandText }}>Tümünü seç</button>
              <button type="button" onClick={() => setPicked(new Set())} style={{ minHeight: 44, padding: "0 4px", background: "none", border: "none", cursor: "pointer", fontFamily: bodyFont, fontSize: 13, fontWeight: 600, color: C.inkMuted }}>Hiçbirini seçme</button>
            </div>
          </>
        )}
      </StepCard>

      <StepCard
        n={2}
        title="Ne"
        right={(
          <SegmentFilter
            label="Sınav türü" value={examType} onChange={setExamType} small
            options={[{ id: "TYT", label: "TYT" }, { id: "AYT", label: "AYT" }]}
            style={{ width: 120, flexShrink: 0, background: C.pageTint }}
          />
        )}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <FieldLabel htmlFor="f-subject">Ders</FieldLabel>
            {singleSubject ? (
              <div style={{ position: "relative" }}>
                <input id="f-subject" readOnly value={subject} aria-label={`Ders: ${subject}, tek branş`} style={{ ...boxStyle(true), paddingRight: 38 }} />
                <Lock size={15} color={C.inkMuted} aria-hidden="true" style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              </div>
            ) : (
              <select id="f-subject" value={subject} onChange={(e) => setSubject(e.target.value)} style={boxStyle(false)}>
                {subjectOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <FieldLabel htmlFor="f-topic" required>Konu</FieldLabel>
            {topics.length > 0 && !topicCustom ? (
              <select
                id="f-topic" value={topic}
                onChange={(e) => { if (e.target.value === CUSTOM) { setTopicCustom(true); setTopic(""); } else setTopic(e.target.value); }}
                style={boxStyle(false)}
              >
                <option value="" disabled>Konu seç ({topics.length})</option>
                {topics.map((t, i) => <option key={t} value={t}>{i + 1}. {t}</option>)}
                <option value={CUSTOM}>Listede yok — kendim yazacağım</option>
              </select>
            ) : (
              <input id="f-topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Konuyu yaz" style={{ ...boxStyle(false), cursor: "text" }} autoFocus={topicCustom} />
            )}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <FieldLabel htmlFor="f-book" required>Kaynak kitap</FieldLabel>
          {!sourceCustom && (
            <select
              id="f-book" value={sourceBook} disabled={noBooks}
              onChange={(e) => { if (e.target.value === CUSTOM) { setSourceCustom(true); setSourceBook(""); } else setSourceBook(e.target.value); }}
              style={boxStyle(noBooks)}
            >
              <option value="" disabled>Kaynak kitap seç</option>
              {sourceBooks.map((b) => <option key={b} value={b}>{b}</option>)}
              <option value={CUSTOM}>Yeni kaynak kitap yaz</option>
            </select>
          )}
          {!sourceCustom && noBooks && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 4 }}>
              <span style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.inkMuted }}>Bu ders için kayıtlı kaynak kitap yok</span>
              <button type="button" onClick={() => setSourceCustom(true)} style={{ minHeight: 44, padding: "0 4px", background: "none", border: "none", cursor: "pointer", fontFamily: bodyFont, fontSize: 13, fontWeight: 700, color: C.brandText, whiteSpace: "nowrap" }}>Yeni yaz</button>
            </div>
          )}
          {sourceCustom && (
            <>
              <input id="f-book" value={sourceBook} onChange={(e) => setSourceBook(e.target.value)} placeholder="Kaynak kitabın adı" autoFocus style={{ ...boxStyle(false), cursor: "text" }} />
              {!noBooks && (
                <button type="button" onClick={() => { setSourceCustom(false); setSourceBook(""); }} style={{ minHeight: 44, padding: "0 4px", background: "none", border: "none", cursor: "pointer", fontFamily: bodyFont, fontSize: 13, fontWeight: 700, color: C.brandText }}>Listeden seç</button>
              )}
            </>
          )}
        </div>
      </StepCard>

      <StepCard n={3} title="Son teslim" right={<span style={{ ...NUM, fontSize: 12, fontWeight: 600, color: C.inkMuted }}>{longDate(endDate)}</span>}>
        <div role="group" aria-label="Son teslim" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
          {[...quick, { id: "custom", label: "Tarih" }].map((q) => {
            const on = quickId === q.id;
            const btn = (
              <button
                key={q.id}
                type="button"
                aria-pressed={on}
                tabIndex={q.date ? undefined : -1}
                onClick={() => q.date && setEndDate(q.date)}
                style={{ width: "100%",
                  minHeight: 44, borderRadius: 12, cursor: "pointer", padding: "0 4px", whiteSpace: "nowrap",
                  background: on ? C.lime : C.surface, border: `1px solid ${on ? C.lime : C.brandOutline}`, color: C.inkText,
                  fontFamily: bodyFont, fontSize: 13.5, fontWeight: on ? 800 : 600,
                }}
              >
                {q.label}
              </button>
            );
            if (q.date) return btn;
            // "Tarih": görünür düğmenin üstünde saydam yerli tarih alanı — dokununca telefonun tarih seçicisi açılır.
            return (
              <span key={q.id} style={{ position: "relative", display: "block" }}>
                {btn}
                <input
                  ref={dateRef} type="date" aria-label="Son teslim tarihi" value={endDate} min={start}
                  onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch (_) { /* dokunuş yine açar */ } }}
                  onChange={(e) => e.target.value && setEndDate(e.target.value)}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", border: "none", padding: 0 }}
                />
              </span>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 48, padding: "0 6px 0 14px", borderRadius: 14, background: C.pageTint, marginTop: 10 }}>
          {planned ? <CalendarClock size={17} color={C.brandText} aria-hidden="true" /> : <Send size={16} color={C.success} aria-hidden="true" />}
          <span style={{ flex: 1, minWidth: 0, fontFamily: bodyFont, fontSize: 13.5, fontWeight: 600, color: C.inkText }}>
            {planned ? `${longDate(scheduledDate)} başlar · ${planMode === "AUTO_DAY_BEFORE" ? "bir gün önce" : "o gün"} gönderilir` : "Hemen gönderilir"}
          </span>
          <button type="button" onClick={() => setPlanned((p) => !p)} style={{ minHeight: 44, padding: "0 8px", background: "none", border: "none", cursor: "pointer", fontFamily: bodyFont, fontSize: 13.5, fontWeight: 800, color: C.brandText, whiteSpace: "nowrap" }}>
            {planned ? "Hemen gönder" : "Planla"}
          </button>
        </div>
        {planned && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginTop: 10 }}>
            <div style={{ minWidth: 0 }}>
              <FieldLabel htmlFor="f-start">Başlangıç</FieldLabel>
              <input id="f-start" type="date" value={scheduledDate} min={today} onChange={(e) => onStartChange(e.target.value)} style={{ ...boxStyle(false), cursor: "text" }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <FieldLabel htmlFor="f-send">Gönderim</FieldLabel>
              <select id="f-send" value={planMode} onChange={(e) => setPlanMode(e.target.value)} style={boxStyle(false)}>
                {PLAN_MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
          </div>
        )}
      </StepCard>

      <div style={{ marginTop: 6 }}>
        {error && <div role="alert" style={{ color: C.danger, fontFamily: bodyFont, fontSize: 13, fontWeight: 600, textAlign: "center", marginBottom: 8 }}>{error}</div>}
        <button
          type="submit"
          aria-disabled={!ready || saving}
          style={{
            width: "100%", minHeight: 56, borderRadius: 18, border: "none", cursor: ready && !saving ? "pointer" : "default",
            background: C.brand, color: C.onBrand, opacity: ready ? 1 : 0.4,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: bodyFont, fontSize: 16, fontWeight: 800,
          }}
        >
          {saving ? "Kaydediliyor..." : recipients.length ? `${recipients.length} öğrenciye ata` : "Ödevi ata"}
          {!saving && <ArrowRight size={18} strokeWidth={2.4} aria-hidden="true" />}
        </button>
        <div role="status" style={{ ...NUM, fontSize: 12.5, color: C.inkMuted, textAlign: "center", marginTop: 8 }}>
          {ready ? `${subject} · ${examType} · son teslim ${longDate(endDate)}` : missingText}
        </div>
      </div>
    </form>,
  );
}
