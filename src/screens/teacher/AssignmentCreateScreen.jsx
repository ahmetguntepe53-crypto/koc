import { useEffect, useMemo, useRef, useState } from "react";
import { C, bodyFont, displayFont, monoFont } from "../../theme.js";
import { Card, Button, Input, Select, Avatar, EmptyState, LoadingState, ListRow, ListGroup } from "../../components/common.jsx";
import { api } from "../../api.js";
import { PERIOD_LABELS, subjectsForBranches } from "../../subjects.js";
import { todayISO } from "../../dates.js";
import { shortDate } from "../../work.js";
import TopicField from "../../components/TopicField.jsx";

// Ödev atama ekranı — 2026-09-28'den beri YALNIZCA branş öğretmenlerinde (bkz. App.jsx > tabsFor).
// Branş öğretmeni kendi koçluk ettiği öğrencilerle sınırlı değildir: okulun tamamını, bir sınıf düzeyini,
// bir şubeyi ya da tek tek seçtiği öğrencileri hedefler. Buna karşılık yalnızca KENDİ branşındaki dersten
// ödev verebilir (sunucu da doğrular: routes/assignments.js > assertCanAssign).

// Gönderim modunun KISA etiketleri — iki sütunlu ızgarada ~150px'lik alana "Otomatik — tarihi gelince
// gönder" sığmıyordu; alanın "Gönderim" etiketi bağlamı zaten veriyor. Değerler sunucuyla aynı.
const SEND_MODE_OPTIONS = [
  { value: "MANUAL_NOW", label: "Hemen" },
  { value: "AUTO_ON_DATE", label: "Tarihi gelince" },
  { value: "AUTO_DAY_BEFORE", label: "Bir gün önce" },
];

// Kime gönderileceği: okulun tamamı · sınıf düzeyi (11/12) · şube (12-A) · tek tek seçim.
const AUDIENCE_MODES = [
  { value: "all", label: "Tüm okul" },
  { value: "grade", label: "Sınıf düzeyi" },
  { value: "class", label: "Şube" },
  { value: "pick", label: "Seçerek" },
];

// İki sütunlu alan ızgarası; sütun asgari 140px — ~360px'ten dar ekranlarda (tarih alanı sığmıyor) medya
// sorgusuna gerek kalmadan tek sütuna düşer, geniş ekranda da hiçbir zaman 3 sütuna çıkmaz (her sütun en
// az yarı genişlik). Negatif alt boşluk, son satırdaki alanların kendi 16px alt boşluğunu kartın iç
// boşluğuyla çakışmasın diye geri alır.
const FIELD_GRID = {
  display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(max(140px, calc((100% - 12px) / 2)), 1fr))",
  columnGap: 12, marginBottom: -16,
};

// Kart başlığı: 24×24 kutuda sıra numarası + başlık + alt açıklama — uzun tek form "Kime / Ne /
// Ne zaman" diye üç gruba bölündü, öğretmen hangi adımda olduğunu görsün diye.
function GroupHeader({ n, id, title, subtitle }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
      <span aria-hidden="true" style={{
        width: 24, height: 24, borderRadius: 8, flexShrink: 0, marginTop: 1,
        background: C.accentSoft, color: C.accent, fontFamily: monoFont, fontSize: 12.5, fontWeight: 700,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>{n}</span>
      <div style={{ minWidth: 0 }}>
        <h2 id={id} style={{ margin: 0, fontFamily: displayFont, fontSize: 14.5, fontWeight: 700, letterSpacing: -0.1, color: C.text, lineHeight: 1.3 }}>{title}</h2>
        {subtitle && <div style={{ fontFamily: bodyFont, fontSize: 11.5, fontWeight: 500, color: C.mutedLight, marginTop: 2 }}>{subtitle}</div>}
      </div>
    </div>
  );
}

// Bölümlü düğme (TYT/AYT, kime) — aktif dolu, pasif alan zemini. Izgara: sütun asgari 120px, yani
// telefonda dört seçenek 2×2 olur (tek bir düğmenin yalnız başına alt satıra düşmesi yerine), geniş
// ekranda dördü de tek sıraya çıkar. İki seçenekli kullanımda (TYT/AYT) her koşulda yan yana.
function Segmented({ value, onChange, options, label }) {
  return (
    <div role="group" aria-label={label} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginBottom: 14 }}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className="k-btn"
            style={{
              minWidth: 0, height: 40, borderRadius: 12, cursor: "pointer",
              border: `1px solid ${active ? C.accent : C.border}`,
              background: active ? C.accent : C.fieldBg,
              color: active ? C.onAccent : C.muted, fontFamily: bodyFont, fontWeight: 700, fontSize: 14,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// Çoklu seçim rozeti (sınıf düzeyi, şube) — seçili olanlar vurgulu.
function ToggleChip({ active, onClick, children, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className="k-btn"
      style={{
        height: 36, padding: "0 14px", borderRadius: 18, cursor: "pointer",
        background: active ? C.accentSoft : C.fieldBg, border: `1px solid ${active ? C.accent : C.border}`,
        color: active ? C.accent : C.muted, fontFamily: bodyFont, fontSize: 13, fontWeight: active ? 700 : 600,
      }}
    >
      {children}
    </button>
  );
}

// Özet satırındaki kısa tarih aralığı: "26 Eylül", "26–28 Eylül", "30 Eylül – 2 Ekim"; yıl yalnızca bu
// yıl değilse eklenir. Tarih alanı boşaltılmışsa (geçersiz) boş döner.
function shortDateRange(start, end) {
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end || start}T00:00:00`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "";
  const thisYear = new Date().getFullYear();
  const month = (d) => d.toLocaleDateString("tr-TR", { month: "long" });
  const year = (d) => (d.getFullYear() !== thisYear ? ` ${d.getFullYear()}` : "");
  if (s.getTime() === e.getTime()) return `${s.getDate()} ${month(s)}${year(s)}`;
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) return `${s.getDate()}–${e.getDate()} ${month(e)}${year(e)}`;
  if (s.getFullYear() === e.getFullYear()) return `${s.getDate()} ${month(s)} – ${e.getDate()} ${month(e)}${year(e)}`;
  return `${s.getDate()} ${month(s)}${year(s)} – ${e.getDate()} ${month(e)}${year(e)}`;
}

// "Son gönderdiklerim" — öğretmenin kendi gönderdiği ödevler, en yenisi üstte. Kaç öğrencinin sonuç
// girdiği de görünür; satıra dokununca ödevin kendi ekranı açılır.
function RecentAssignments({ onOpenAssignment, refreshKey }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    api.listAssignments({ status: "SENT" })
      .then(({ assignments }) => { if (alive) setRows(assignments.slice(0, 20)); })
      .catch((e) => { if (alive) setError(e.message || "Yüklenemedi"); });
    return () => { alive = false; };
  }, [refreshKey]);

  if (error) return <EmptyState text={error} />;
  if (!rows) return <LoadingState />;
  if (!rows.length) return <EmptyState text="Henüz ödev göndermedin. “Yeni ödev” sekmesinden ilk ödevini oluşturabilirsin." />;
  return (
    <ListGroup>
      {rows.map((a) => {
        const total = a.recipients?.length || 0;
        const done = a.recipients?.filter((r) => r.completed).length || 0;
        return (
          <ListRow
            key={a.id}
            title={a.topic}
            subtitle={`${a.examType} ${a.subject} · ${shortDate(a.scheduledDate)}${a.sourceBook ? ` · ${a.sourceBook}` : ""}`}
            right={
              <span style={{ textAlign: "right", flexShrink: 0 }}>
                <span style={{ display: "block", fontFamily: monoFont, fontSize: 14, fontWeight: 700, color: done === total && total ? C.green : C.text2 }}>{done}/{total}</span>
                <span style={{ display: "block", fontFamily: bodyFont, fontSize: 11, color: C.mutedLight }}>sonuç</span>
              </span>
            }
            onClick={onOpenAssignment ? () => onOpenAssignment(a.id) : undefined}
          />
        );
      })}
    </ListGroup>
  );
}

export default function AssignmentCreateScreen({ user, onCreated, initialStudentId, prefill, onOpenAssignment }) {
  const [tab, setTab] = useState("new");
  const [audience, setAudience] = useState(null); // { students: [...] }
  const [audienceError, setAudienceError] = useState("");
  const [sentCount, setSentCount] = useState(0); // "son gönderdiklerim" listesini tazelemek için

  const branches = user?.teachingSubjects || [];
  const [examType, setExamType] = useState(() => (prefill?.examType === "AYT" ? "AYT" : "TYT"));
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState(() => prefill?.topic || "");
  const [sourceBook, setSourceBook] = useState("");
  const [sourceBooks, setSourceBooks] = useState([]);
  const [pageRange, setPageRange] = useState("");
  const [scheduledDate, setScheduledDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(todayISO());
  const [endDateTouched, setEndDateTouched] = useState(false);
  const [period, setPeriod] = useState("WEEKLY");
  const [sendMode, setSendMode] = useState("MANUAL_NOW");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  // Kime: mod + o moda ait seçim.
  const [mode, setMode] = useState(initialStudentId ? "pick" : "all");
  const [grades, setGrades] = useState(() => new Set());
  const [classes, setClasses] = useState(() => new Set());
  const [picked, setPicked] = useState(() => new Set(initialStudentId ? [initialStudentId] : []));

  useEffect(() => {
    api.assignmentAudience()
      .then(setAudience)
      .catch((e) => setAudienceError(e.message || "Öğrenci listesi yüklenemedi"));
  }, []);

  // Kaynak kitap önerileri en yeniden eskiye gelir (bkz. GET /assignments/source-books) — ilki
  // öğretmenin EN SON kullandığı kaynaktır ve forma hazır gelir; yazarak ya da listeden başka bir
  // kaynağı seçmek serbest. Öğretmen alanı bilerek boşalttıysa (touched) tekrar doldurulmaz.
  const sourceTouchedRef = useRef(false);
  useEffect(() => {
    api.listSourceBooks(examType)
      .then(({ sourceBooks: books }) => {
        setSourceBooks(books);
        if (!sourceTouchedRef.current) setSourceBook(books[0] || "");
      })
      .catch(() => {});
  }, [examType]);

  const students = audience?.students || [];
  const gradeOptions = useMemo(() => [...new Set(students.map((s) => s.gradeLevel).filter(Boolean))].sort((a, b) => a - b), [students]);
  const classOptions = useMemo(() => [...new Set(students.map((s) => s.className).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr")), [students]);

  // Seçilen moda göre gerçek alıcı listesi — gönderim de, özet de bunu kullanır.
  const recipients = useMemo(() => {
    if (mode === "all") return students;
    if (mode === "grade") return students.filter((s) => grades.has(s.gradeLevel));
    if (mode === "class") return students.filter((s) => classes.has(s.className));
    return students.filter((s) => picked.has(s.id));
  }, [mode, students, grades, classes, picked]);

  const subjectOptions = useMemo(() => subjectsForBranches(examType, branches), [examType, branches.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!subjectOptions.includes(subject)) setSubject(subjectOptions.includes(prefill?.subject) ? prefill.subject : subjectOptions[0] || "");
  }, [subjectOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleIn = (setter) => (value) => setter((prev) => {
    const next = new Set(prev);
    if (next.has(value)) next.delete(value); else next.add(value);
    return next;
  });

  const onStartDateChange = (v) => {
    setScheduledDate(v);
    if (!endDateTouched || endDate < v) setEndDate(v);
  };
  const onEndDateChange = (v) => { setEndDate(v); setEndDateTouched(true); };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (recipients.length === 0) { setError("En az bir öğrenci seçmelisin"); return; }
    if (!topic.trim()) { setError("Müfredat konusu gerekli"); return; }
    // HTML'in date input'undaki min= özelliği bazı mobil klavye/tarih seçicilerde elle girişte
    // katı uygulanmayabilir — sunucuya gitmeden önce burada da açıkça doğrulanır.
    if (endDate < scheduledDate) { setError("Bitiş tarihi başlangıç tarihinden önce olamaz"); return; }
    setSaving(true);
    try {
      const { assignment } = await api.createAssignment({
        studentIds: recipients.map((s) => s.id),
        examType, subject, topic: topic.trim(),
        sourceBook: sourceBook.trim() || undefined, pageRange: pageRange.trim() || undefined,
        period, scheduledDate, endDate, sendMode,
      });
      setSuccess(assignment.status === "SENT"
        ? `Ödev ${recipients.length} öğrenciye gönderildi.`
        : "Ödev taslak olarak takvime kaydedildi.");
      setTopic("");
      setPageRange("");
      setScheduledDate(todayISO());
      setEndDate(todayISO());
      setEndDateTouched(false);
      setSentCount((n) => n + 1);
      // Kaynak kitap BİLEREK korunur — aynı kaynaktan arka arkaya konu göndermek olağan.
      if (onCreated) onCreated(assignment);
    } catch (err) {
      setError(err.message || "Ödev kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  const page = (children) => <div className="k-page k-page-form" style={{ padding: 28, maxWidth: 580, margin: "0 auto" }}>{children}</div>;

  const tabBar = (
    <div role="tablist" aria-label="Ödev" style={{ display: "flex", gap: 8, marginBottom: 14 }}>
      {[{ id: "new", label: "Yeni ödev" }, { id: "recent", label: "Son gönderdiklerim" }].map((t) => {
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setTab(t.id)}
            className="k-btn"
            style={{
              flex: 1, height: 40, borderRadius: 12, cursor: "pointer",
              border: `1px solid ${active ? C.accent : C.border}`,
              background: active ? C.accent : C.fieldBg,
              color: active ? C.onAccent : C.muted, fontFamily: bodyFont, fontWeight: 700, fontSize: 13.5,
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );

  if (audienceError) return page(<><EmptyState text={audienceError} /></>);
  if (tab === "recent") return page(<>{tabBar}<RecentAssignments onOpenAssignment={onOpenAssignment} refreshKey={sentCount} /></>);
  if (!audience) return page(<>{tabBar}<LoadingState /></>);

  // Alttaki sabit düğmenin ne atayacağını özetler — uzun formda "ne seçmiştim?" sorusu için.
  const summary = [subject, shortDateRange(scheduledDate, endDate), (PERIOD_LABELS[period] || "").toLocaleLowerCase("tr-TR")].filter(Boolean).join(" · ");
  const audienceText = mode === "all" ? "okuldaki tüm öğrenciler"
    : mode === "grade" ? (grades.size ? [...grades].sort().map((g) => `${g}. sınıf`).join(", ") : "sınıf düzeyi seç")
    : mode === "class" ? (classes.size ? [...classes].sort((a, b) => a.localeCompare(b, "tr")).join(", ") : "şube seç")
    : `${picked.size} öğrenci seçili`;

  return (
    <div className="k-page k-page-form" style={{ padding: 28, maxWidth: 580, margin: "0 auto" }}>
      {tabBar}
      <form onSubmit={submit}>
        <Card style={{ padding: 16, marginBottom: 12 }}>
          <section aria-labelledby="create-group-who">
            <GroupHeader
              n={1} id="create-group-who" title="Kime"
              subtitle={<><span style={{ fontFamily: monoFont }}>{recipients.length}</span> öğrenci · {audienceText}</>}
            />
            <Segmented label="Kime gönderilecek" value={mode} onChange={setMode} options={AUDIENCE_MODES} />

            {mode === "all" && (
              <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.mutedLight, lineHeight: 1.5 }}>
                Sınıf düzeyi girilmiş, askıya alınmamış <span style={{ fontFamily: monoFont, color: C.text2 }}>{students.length}</span> öğrencinin hepsine gider.
              </div>
            )}

            {mode === "grade" && (
              <div className="k-chip-row" role="group" aria-label="Sınıf düzeyi" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {gradeOptions.map((g) => (
                  <ToggleChip key={g} active={grades.has(g)} onClick={() => toggleIn(setGrades)(g)} label={`${g}. sınıf`}>
                    {g}. sınıf <span style={{ fontFamily: monoFont, opacity: 0.75 }}>({students.filter((s) => s.gradeLevel === g).length})</span>
                  </ToggleChip>
                ))}
              </div>
            )}

            {mode === "class" && (
              classOptions.length === 0
                ? <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.amber }}>Öğrencilerin şubesi (ör. 12-A) girilmemiş — yönetici Kurulum ekranından girebilir.</div>
                : (
                  <div className="k-chip-row" role="group" aria-label="Şube" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {classOptions.map((cn) => (
                      <ToggleChip key={cn} active={classes.has(cn)} onClick={() => toggleIn(setClasses)(cn)} label={`${cn} şubesi`}>
                        {cn} <span style={{ fontFamily: monoFont, opacity: 0.75 }}>({students.filter((s) => s.className === cn).length})</span>
                      </ToggleChip>
                    ))}
                  </div>
                )
            )}

            {mode === "pick" && (
              <>
                <div role="group" aria-label="Öğrenciler" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {students.map((s) => {
                    const checked = picked.has(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleIn(setPicked)(s.id)}
                        aria-pressed={checked}
                        aria-label={s.className ? `${s.name}, ${s.className}` : s.name}
                        title={s.className ? `${s.name} · ${s.className}` : s.name}
                        className="k-btn"
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 7, height: 36, boxSizing: "border-box",
                          padding: "0 11px 0 4px", borderRadius: 18, cursor: "pointer", maxWidth: "100%",
                          background: checked ? C.accentSoft : C.fieldBg, border: `1px solid ${checked ? C.accent : C.border}`,
                          color: checked ? C.accent : C.muted, fontFamily: bodyFont, fontSize: 12.5, fontWeight: checked ? 700 : 600,
                        }}
                      >
                        <Avatar name={s.name} size={28} />
                        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</span>
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12 }}>
                  <button type="button" onClick={() => setPicked(new Set(students.map((s) => s.id)))} className="k-link-btn" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: bodyFont, fontSize: 12.5, fontWeight: 700, color: C.accent }}>
                    Tümünü seç
                  </button>
                  <button type="button" onClick={() => setPicked(new Set())} className="k-link-btn" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: bodyFont, fontSize: 12.5, fontWeight: 600, color: C.muted }}>
                    Hiçbirini seçme
                  </button>
                </div>
              </>
            )}
          </section>
        </Card>

        <Card style={{ padding: 16, marginBottom: 12 }}>
          <section aria-labelledby="create-group-what">
            <GroupHeader n={2} id="create-group-what" title="Ne" subtitle={branches.length ? `ders ve konu · branşın: ${branches.join(", ")}` : "ders ve konu"} />
            <Segmented label="Sınav türü" value={examType} onChange={setExamType} options={[{ value: "TYT", label: "TYT" }, { value: "AYT", label: "AYT" }]} />
            <div style={FIELD_GRID}>
              <Select label="Ders" value={subject} onChange={(e) => setSubject(e.target.value)}>
                {subjectOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
              {/* TopicField "listede yok" seçilince altına bir metin alanı daha ekliyor — ikisi aynı hücrede kalsın diye sarılı. */}
              <div style={{ minWidth: 0 }}>
                <TopicField label="Konu" examType={examType} subject={subject} value={topic} onChange={setTopic} placeholder="ör. Temel kavramlar" required />
              </div>
              <Input
                label="Kaynak kitap" list="source-book-suggestions" value={sourceBook}
                onChange={(e) => { sourceTouchedRef.current = true; setSourceBook(e.target.value); }}
                placeholder="opsiyonel"
              />
              <Input label="Sayfa / soru" value={pageRange} onChange={(e) => setPageRange(e.target.value)} placeholder="opsiyonel — ör. 45-60" />
            </div>
            <datalist id="source-book-suggestions">
              {sourceBooks.map((b) => <option key={b} value={b} />)}
            </datalist>
          </section>
        </Card>

        <Card style={{ padding: 16 }}>
          <section aria-labelledby="create-group-when">
            <GroupHeader n={3} id="create-group-when" title="Ne zaman" subtitle="tek gün için ikisini aynı bırak" />
            <div style={FIELD_GRID}>
              <Input label="Başlangıç" type="date" value={scheduledDate} onChange={(e) => onStartDateChange(e.target.value)} required />
              <Input label="Bitiş" type="date" value={endDate} min={scheduledDate} onChange={(e) => onEndDateChange(e.target.value)} required />
              <Select label="Periyot" value={period} onChange={(e) => setPeriod(e.target.value)}>
                {Object.entries(PERIOD_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
              <Select label="Gönderim" value={sendMode} onChange={(e) => setSendMode(e.target.value)}>
                {SEND_MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </div>
          </section>
        </Card>

        {/* Alta sabit aksiyon: telefonda alt menünün hemen üstünde, masaüstünde sayfanın altına yapışık
            (bkz. index.html > .k-sticky-action). Akış içinde (position: sticky) kaldığı için kaydırma
            sonunda son kartın altına oturur, kartı örtmez. */}
        <div className="k-sticky-action" style={{ background: C.surface, borderTop: `1px solid ${C.border}`, padding: "12px 16px 14px", marginTop: 16 }}>
          {error && <div role="alert" style={{ color: C.red, fontFamily: bodyFont, fontSize: 12.5, fontWeight: 600, textAlign: "center", marginBottom: 10 }}>{error}</div>}
          {success && <div role="status" style={{ color: C.green, fontFamily: bodyFont, fontSize: 12.5, fontWeight: 600, textAlign: "center", marginBottom: 10 }}>{success}</div>}
          <Button full type="submit" disabled={saving || recipients.length === 0}>
            {saving ? "Kaydediliyor..." : sendMode === "MANUAL_NOW" ? `${recipients.length} öğrenciye ata` : "Takvime kaydet"}
          </Button>
          {summary && (
            <div style={{ fontFamily: bodyFont, fontSize: 11.5, fontWeight: 500, color: C.mutedLight, textAlign: "center", marginTop: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {summary}
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
