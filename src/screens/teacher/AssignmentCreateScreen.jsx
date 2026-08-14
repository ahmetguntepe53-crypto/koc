import { useEffect, useMemo, useState } from "react";
import { C, bodyFont } from "../../theme.js";
import { Card, Button, Input, Select, Pill, Avatar } from "../../components/common.jsx";
import { api } from "../../api.js";
import { SUBJECTS_BY_EXAM, PERIOD_LABELS, SEND_MODE_LABELS, trackForGrade } from "../../subjects.js";

function ToggleGroup({ value, onChange, options }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className="k-btn"
            style={{
              flex: 1, padding: "10px 12px", borderRadius: C.radiusSm, cursor: "pointer",
              border: `1.5px solid ${active ? C.accent : C.border}`,
              background: active ? C.accentSoft : C.surface2,
              color: active ? C.accent : C.text, fontFamily: bodyFont, fontWeight: 700, fontSize: 13.5,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

const todayISO = () => new Date().toISOString().slice(0, 10);

function FieldLabel({ children }) {
  return <div style={{ fontFamily: bodyFont, fontSize: 11, fontWeight: 700, color: C.mutedLight, marginBottom: 7, textTransform: "uppercase", letterSpacing: 0.5 }}>{children}</div>;
}

export default function AssignmentCreateScreen({ onCreated }) {
  const [students, setStudents] = useState([]);
  const [manualTrack, setManualTrack] = useState(null); // roster karma sınav türlerinden oluşuyorsa koçun elle seçtiği
  const [checkedIds, setCheckedIds] = useState(() => new Set());
  const [examType, setExamType] = useState("TYT");
  const [subject, setSubject] = useState(SUBJECTS_BY_EXAM.TYT[0]);
  const [topic, setTopic] = useState("");
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

  useEffect(() => { api.teacherListStudents().then(({ students }) => setStudents(students)); }, []);
  useEffect(() => { api.listSourceBooks(examType).then(({ sourceBooks }) => setSourceBooks(sourceBooks)); }, [examType]);

  const activeStudents = useMemo(() => students.filter((s) => !s.banned).map((s) => ({ ...s, track: trackForGrade(s.gradeLevel) })), [students]);
  const tracksPresent = useMemo(() => [...new Set(activeStudents.map((s) => s.track).filter(Boolean))], [activeStudents]);

  useEffect(() => {
    if (tracksPresent.length && !tracksPresent.includes(manualTrack)) setManualTrack(tracksPresent[0]);
  }, [tracksPresent.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // Roster boşsa (kimse sınıf düzeyi girilmemiş) YKS'ye düşülür — form kilitlenmesin diye.
  const effectiveTrack = tracksPresent.length === 1 ? tracksPresent[0] : tracksPresent.length > 1 ? manualTrack : "YKS";
  const gradeMissingCount = activeStudents.filter((s) => !s.track).length;

  // Yalnızca seçilen sınav türüyle uyumlu öğrenciler tikletilebilir — böylece işaretlenen HERKES
  // gerçekten o ödevi alır, sunucuda "bazıları uyumsuz" gibi sürpriz bir filtrelemeye gerek kalmaz.
  const eligibleStudents = useMemo(() => activeStudents.filter((s) => s.track === effectiveTrack), [activeStudents, effectiveTrack]);
  const eligibleIdsKey = eligibleStudents.map((s) => s.id).join(",");

  // Uygun öğrenci havuzu değiştiğinde (sınav türü değişti, roster yüklendi vb.) varsayılan olarak
  // hepsi tiklenir — eskiden "Tüm Öğrencilerim" olan davranışın karşılığı, ama artık koç isterse tikini kaldırabilir.
  useEffect(() => {
    setCheckedIds(new Set(eligibleStudents.map((s) => s.id)));
  }, [eligibleIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (effectiveTrack === "LGS" && examType !== "LGS") setExamType("LGS");
    else if (effectiveTrack === "YKS" && examType === "LGS") setExamType("TYT");
  }, [effectiveTrack]); // eslint-disable-line react-hooks/exhaustive-deps

  const subjectOptions = useMemo(() => SUBJECTS_BY_EXAM[examType], [examType]);
  useEffect(() => {
    if (!subjectOptions.includes(subject)) setSubject(subjectOptions[0]);
  }, [subjectOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleStudent = (id) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const allChecked = eligibleStudents.length > 0 && eligibleStudents.every((s) => checkedIds.has(s.id));
  const toggleAll = () => setCheckedIds(allChecked ? new Set() : new Set(eligibleStudents.map((s) => s.id)));

  const onStartDateChange = (v) => {
    setScheduledDate(v);
    if (!endDateTouched || endDate < v) setEndDate(v);
  };
  const onEndDateChange = (v) => { setEndDate(v); setEndDateTouched(true); };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (checkedIds.size === 0) { setError("En az bir öğrenci seçmelisin"); return; }
    if (!topic.trim()) { setError("Müfredat konusu gerekli"); return; }
    setSaving(true);
    try {
      const { assignment } = await api.createAssignment({
        studentIds: [...checkedIds],
        examType, subject, topic: topic.trim(),
        sourceBook: sourceBook.trim() || undefined, pageRange: pageRange.trim() || undefined,
        period, scheduledDate, endDate, sendMode,
      });
      setSuccess(assignment.status === "SENT" ? "Ödev oluşturuldu ve gönderildi." : "Ödev taslak olarak takvime kaydedildi.");
      setTopic("");
      setSourceBook("");
      setPageRange("");
      setScheduledDate(todayISO());
      setEndDate(todayISO());
      setEndDateTouched(false);
      if (onCreated) onCreated(assignment);
    } catch (err) {
      setError(err.message || "Ödev kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 28, maxWidth: 580, margin: "0 auto" }}>
      <Card>
        <form onSubmit={submit}>
          {tracksPresent.length > 1 && (
            <>
              <FieldLabel>Sınav Grubu</FieldLabel>
              <ToggleGroup
                value={manualTrack}
                onChange={setManualTrack}
                options={tracksPresent.map((t) => ({ value: t, label: `${t} (${activeStudents.filter((s) => s.track === t).length})` }))}
              />
            </>
          )}

          {effectiveTrack === "LGS" ? (
            <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <FieldLabelInline>Sınav Türü</FieldLabelInline>
              <Pill tone="amber">LGS</Pill>
            </div>
          ) : (
            <>
              <FieldLabel>Sınav Türü</FieldLabel>
              <ToggleGroup value={examType} onChange={setExamType} options={[{ value: "TYT", label: "TYT" }, { value: "AYT", label: "AYT" }]} />
            </>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
            <FieldLabel>Öğrenciler ({checkedIds.size}/{eligibleStudents.length} seçili)</FieldLabel>
            <button type="button" onClick={toggleAll} className="k-link-btn" style={{ background: "none", border: "none", color: C.accent, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: bodyFont, marginBottom: 7 }}>
              {allChecked ? "Hiçbirini seçme" : "Tümünü seç"}
            </button>
          </div>
          {eligibleStudents.length === 0 ? (
            <div style={{ fontSize: 12.5, color: C.red, marginBottom: 16 }}>
              {effectiveTrack} sınav türüne hazırlanan bir öğrencin yok.
            </div>
          ) : (
            <div style={{ border: `1px solid ${C.border}`, borderRadius: C.radiusSm, marginBottom: 6, maxHeight: 220, overflowY: "auto" }}>
              {eligibleStudents.map((s) => {
                const checked = checkedIds.has(s.id);
                return (
                  <label
                    key={s.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", cursor: "pointer",
                      borderBottom: `1px solid ${C.border}`, background: checked ? C.accentSoft : "transparent",
                    }}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggleStudent(s.id)} style={{ accentColor: C.accent, width: 15, height: 15, flexShrink: 0 }} />
                    <Avatar name={s.name} size={26} />
                    <span style={{ fontFamily: bodyFont, fontSize: 13, fontWeight: 600, color: C.text, flex: 1, minWidth: 0 }}>{s.name}</span>
                    {s.className && <Pill>{s.className}</Pill>}
                  </label>
                );
              })}
            </div>
          )}
          {gradeMissingCount > 0 && (
            <div style={{ fontSize: 11.5, color: C.amber, marginBottom: 16 }}>
              {gradeMissingCount} öğrencinin sınıf düzeyi girilmemiş, listede görünmüyor (Kullanıcılar sayfasından girilebilir).
            </div>
          )}
          {gradeMissingCount === 0 && <div style={{ marginBottom: 16 }} />}

          <Select label="Ders Başlığı" value={subject} onChange={(e) => setSubject(e.target.value)}>
            {subjectOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>

          <Input label="Müfredat Konusu" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="ör. Temel Kavramlar" required />

          <label style={{ display: "block", marginBottom: 16 }}>
            <FieldLabel>Kaynak Kitap (opsiyonel)</FieldLabel>
            <input
              list="source-book-suggestions"
              value={sourceBook}
              onChange={(e) => setSourceBook(e.target.value)}
              placeholder="ör. 3D Yayınları TYT Matematik"
              className="k-field"
              style={{ width: "100%", boxSizing: "border-box", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: C.radiusSm, padding: "10px 13px", fontSize: 14, fontFamily: bodyFont, color: C.text, outline: "none" }}
            />
            <datalist id="source-book-suggestions">
              {sourceBooks.map((b) => <option key={b} value={b} />)}
            </datalist>
          </label>

          <Input label="Sayfa / Soru Aralığı (opsiyonel)" value={pageRange} onChange={(e) => setPageRange(e.target.value)} placeholder="ör. 45-60" />

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Input label="Başlangıç Tarihi" type="date" value={scheduledDate} onChange={(e) => onStartDateChange(e.target.value)} required />
            </div>
            <div style={{ flex: 1 }}>
              <Input label="Bitiş Tarihi" type="date" value={endDate} min={scheduledDate} onChange={(e) => onEndDateChange(e.target.value)} required />
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: -10, marginBottom: 16 }}>
            Tek gün için başlangıç ve bitiş aynı kalabilir — birden fazla güne yayılan bir ödevse bitiş tarihini ileri al.
          </div>

          <Select label="Periyot" value={period} onChange={(e) => setPeriod(e.target.value)}>
            {Object.entries(PERIOD_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>

          <Select label="Gönderim Modu" value={sendMode} onChange={(e) => setSendMode(e.target.value)}>
            {Object.entries(SEND_MODE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>

          {error && <div style={{ color: C.red, fontSize: 12.5, fontWeight: 600, marginBottom: 14 }}>{error}</div>}
          {success && <div style={{ color: C.green, fontSize: 12.5, fontWeight: 600, marginBottom: 14 }}>{success}</div>}

          <Button full type="submit" disabled={saving || checkedIds.size === 0}>
            {saving ? "Kaydediliyor..." : sendMode === "MANUAL_NOW" ? `${checkedIds.size} öğrenciye Şimdi Gönder` : "Takvime Kaydet"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function FieldLabelInline({ children }) {
  return <div style={{ fontFamily: bodyFont, fontSize: 11, fontWeight: 700, color: C.mutedLight, textTransform: "uppercase", letterSpacing: 0.5 }}>{children}</div>;
}
