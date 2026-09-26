import { useEffect, useMemo, useState } from "react";
import { Trash2, BookOpen } from "lucide-react";
import { C, displayFont, bodyFont } from "../../theme.js";
import { Card, Button, Input, Select, Pill, EmptyState, LoadingState, confirmDialog, alertDialog, SectionHeader } from "../../components/common.jsx";
import { api } from "../../api.js";
import { SUBJECTS_BY_EXAM, trackForGrade } from "../../subjects.js";
import { todayISO } from "../../dates.js";
import TopicField from "../../components/TopicField.jsx";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
}

function parseQuestionNumbers(text) {
  return text.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isInteger(n) && n > 0);
}

export default function StudyLogScreen({ user }) {
  // Okul yalnızca YKS (TYT/AYT) hazırlığı yapıyor — sınıf düzeyi girilmemişse de TYT/AYT gösterilir.
  const track = trackForGrade(user?.gradeLevel);

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [examType, setExamType] = useState("TYT");
  const [subject, setSubject] = useState(SUBJECTS_BY_EXAM.TYT[0]);
  const [topic, setTopic] = useState("");
  const [sourceBook, setSourceBook] = useState("");
  const [pageRange, setPageRange] = useState("");
  const [correctCount, setCorrectCount] = useState("");
  const [wrongCount, setWrongCount] = useState("");
  const [blankCount, setBlankCount] = useState("");
  const [note, setNote] = useState("");
  const [questionNumbers, setQuestionNumbers] = useState("");
  const [studyDate, setStudyDate] = useState(todayISO());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const subjectOptions = useMemo(() => SUBJECTS_BY_EXAM[examType], [examType]);
  useEffect(() => { if (!subjectOptions.includes(subject)) setSubject(subjectOptions[0]); }, [subjectOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  const [loadError, setLoadError] = useState("");
  const load = () => {
    setLoading(true);
    // Önceki başarısız yüklemenin hatası temizlenmezse, sonraki başarılı yüklemede liste yerine hâlâ
    // hata metni görünüyordu.
    setLoadError("");
    api.listStudySessions().then(({ sessions }) => setSessions(sessions)).catch((e) => setLoadError(e.message || "Kayıtlar yüklenemedi")).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const payload = {
      examType, subject, topic: topic.trim(),
      sourceBook: sourceBook.trim() || undefined, pageRange: pageRange.trim() || undefined,
      correctCount: parseInt(correctCount, 10), wrongCount: parseInt(wrongCount, 10), blankCount: parseInt(blankCount, 10),
      note: note.trim() || undefined, questionNumbers: parseQuestionNumbers(questionNumbers), studyDate,
    };
    if (!payload.topic) { setError("Konu gerekli"); return; }
    if (![payload.correctCount, payload.wrongCount, payload.blankCount].every((n) => Number.isInteger(n) && n >= 0)) {
      setError("Doğru/Yanlış/Boş sayılarını gir");
      return;
    }
    setSaving(true);
    try {
      await api.createStudySession(payload);
      setTopic(""); setSourceBook(""); setPageRange(""); setCorrectCount(""); setWrongCount(""); setBlankCount(""); setNote(""); setQuestionNumbers("");
      load();
    } catch (err) {
      setError(err.message || "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!(await confirmDialog({ title: "Kayıt silinsin mi?", message: "Bu serbest çalışma kaydı raporlarından da kaldırılacak.", confirmLabel: "Sil", danger: true }))) return;
    try {
      await api.deleteStudySession(id);
    } catch (e) {
      alertDialog({ title: "Silinemedi", message: e.message || "Kayıt silinemedi, lütfen tekrar dene." });
    }
    load();
  };

  return (
    <div className="k-page" style={{ padding: 28, maxWidth: 580, margin: "0 auto" }}>
      <Card style={{ marginBottom: 24 }}>
        <form onSubmit={submit}>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {["TYT", "AYT"].map((v) => (
              <button key={v} type="button" className="k-btn" onClick={() => setExamType(v)} style={{
                flex: 1, padding: "10px 12px", borderRadius: C.radiusSm, cursor: "pointer",
                border: `1.5px solid ${examType === v ? C.accent : C.border}`,
                background: examType === v ? C.accentSoft : C.surface2,
                color: examType === v ? C.accent : C.text, fontFamily: bodyFont, fontWeight: 700, fontSize: 13.5,
              }}>{v}</button>
            ))}
          </div>
          {!track && (
            <div style={{ fontSize: 12, color: C.amber, marginTop: -10, marginBottom: 16 }}>
              Sınıf düzeyin henüz girilmemiş, varsayılan olarak TYT/AYT gösteriliyor.
            </div>
          )}
          <Select label="Ders" value={subject} onChange={(e) => setSubject(e.target.value)}>
            {subjectOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <TopicField label="Konu" examType={examType} subject={subject} value={topic} onChange={setTopic} placeholder="ör. Fonksiyonlar" required />
          <Input label="Kaynak Kitap (opsiyonel)" value={sourceBook} onChange={(e) => setSourceBook(e.target.value)} />
          <Input label="Sayfa / Soru Aralığı (opsiyonel)" value={pageRange} onChange={(e) => setPageRange(e.target.value)} placeholder="ör. 20-30" />
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}><Input label="Doğru" type="number" inputMode="numeric" pattern="[0-9]*" min="0" value={correctCount} onChange={(e) => setCorrectCount(e.target.value)} required /></div>
            <div style={{ flex: 1, minWidth: 0 }}><Input label="Yanlış" type="number" inputMode="numeric" pattern="[0-9]*" min="0" value={wrongCount} onChange={(e) => setWrongCount(e.target.value)} required /></div>
            <div style={{ flex: 1, minWidth: 0 }}><Input label="Boş" type="number" inputMode="numeric" pattern="[0-9]*" min="0" value={blankCount} onChange={(e) => setBlankCount(e.target.value)} required /></div>
          </div>
          <Input label="Yanlış/boş soru numaraları (opsiyonel)" value={questionNumbers} onChange={(e) => setQuestionNumbers(e.target.value)} placeholder="ör. 4, 9" />
          <Input label="Ne zaman çalıştın?" type="date" value={studyDate} onChange={(e) => setStudyDate(e.target.value)} required />
          {error && <div style={{ color: C.red, fontSize: 12.5, fontWeight: 600, marginBottom: 14 }}>{error}</div>}
          <Button full type="submit" disabled={saving}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
        </form>
      </Card>

      <SectionHeader title="Geçmiş kayıtlarım" count={loading || loadError ? null : sessions.length} />
      {loading ? (
        <LoadingState />
      ) : loadError ? (
        <EmptyState text={loadError} />
      ) : sessions.length === 0 ? (
        <EmptyState icon={BookOpen} text="Henüz serbest çalışma kaydın yok. Ödev dışında çözdüğün testleri yukarıdan ekleyebilirsin." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sessions.map((s) => (
            <Card key={s.id} style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: bodyFont, fontSize: 13.5, fontWeight: 700, color: C.text }}>{s.subject} — {s.topic}</span>
                    <Pill>{s.examType}</Pill>
                  </div>
                  <div style={{ fontFamily: bodyFont, fontSize: 12, color: C.muted, marginTop: 4 }}>
                    {formatDate(s.studyDate)} · D:{s.correctCount} Y:{s.wrongCount} B:{s.blankCount}
                  </div>
                </div>
                <button className="k-icon-btn" onClick={() => remove(s.id)} title="Kaydı sil" aria-label="Kaydı sil" style={{ width: 36, height: 36, borderRadius: C.radiusSm, border: "none", background: "transparent", color: C.mutedLight, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Trash2 size={16} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
