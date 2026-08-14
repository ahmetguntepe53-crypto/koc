import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { C, displayFont, bodyFont } from "../../theme.js";
import { Card, Button, Input, Select, Pill, EmptyState } from "../../components/common.jsx";
import { api } from "../../api.js";
import { SUBJECTS_BY_EXAM, trackForGrade } from "../../subjects.js";

const todayISO = () => new Date().toISOString().slice(0, 10);

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
}

function parseQuestionNumbers(text) {
  return text.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isInteger(n) && n > 0);
}

export default function StudyLogScreen({ user }) {
  // Öğrenci sadece kendi sınıf düzeyine (LGS ya da YKS) uygun dersleri girebilir — koçun ödev
  // formundaki mantığın öğrenci tarafındaki tekil (tek kişilik "grup") hâli.
  const track = trackForGrade(user?.gradeLevel);
  const isLGS = track === "LGS";

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [examType, setExamType] = useState(isLGS ? "LGS" : "TYT");
  const [subject, setSubject] = useState(SUBJECTS_BY_EXAM[isLGS ? "LGS" : "TYT"][0]);
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

  const load = () => {
    setLoading(true);
    api.listStudySessions().then(({ sessions }) => setSessions(sessions)).finally(() => setLoading(false));
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
    if (!window.confirm("Bu kayıt silinsin mi?")) return;
    await api.deleteStudySession(id).catch(() => {});
    load();
  };

  return (
    <div style={{ padding: 28, maxWidth: 580, margin: "0 auto" }}>
      <Card style={{ marginBottom: 24 }}>
        <form onSubmit={submit}>
          {isLGS ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Pill tone="amber">LGS</Pill>
            </div>
          ) : (
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
          )}
          {!track && (
            <div style={{ fontSize: 12, color: C.amber, marginTop: -10, marginBottom: 16 }}>
              Sınıf düzeyin henüz girilmemiş, varsayılan olarak TYT/AYT gösteriliyor.
            </div>
          )}
          <Select label="Ders" value={subject} onChange={(e) => setSubject(e.target.value)}>
            {subjectOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Input label="Konu" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="ör. Fonksiyonlar" required />
          <Input label="Kaynak Kitap (opsiyonel)" value={sourceBook} onChange={(e) => setSourceBook(e.target.value)} />
          <Input label="Sayfa / Soru Aralığı (opsiyonel)" value={pageRange} onChange={(e) => setPageRange(e.target.value)} placeholder="ör. 20-30" />
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><Input label="Doğru" type="number" min="0" value={correctCount} onChange={(e) => setCorrectCount(e.target.value)} required /></div>
            <div style={{ flex: 1 }}><Input label="Yanlış" type="number" min="0" value={wrongCount} onChange={(e) => setWrongCount(e.target.value)} required /></div>
            <div style={{ flex: 1 }}><Input label="Boş" type="number" min="0" value={blankCount} onChange={(e) => setBlankCount(e.target.value)} required /></div>
          </div>
          <Input label="Yanlış/boş soru numaraları (opsiyonel)" value={questionNumbers} onChange={(e) => setQuestionNumbers(e.target.value)} placeholder="ör. 4, 9" />
          <Input label="Ne zaman çalıştın?" type="date" value={studyDate} onChange={(e) => setStudyDate(e.target.value)} required />
          {error && <div style={{ color: C.red, fontSize: 12.5, fontWeight: 600, marginBottom: 14 }}>{error}</div>}
          <Button full type="submit" disabled={saving}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
        </form>
      </Card>

      <div style={{ fontFamily: displayFont, fontSize: 14, fontWeight: 800, marginBottom: 12, color: C.mutedLight, textTransform: "uppercase", letterSpacing: 0.5 }}>Geçmiş Kayıtlarım</div>
      {loading ? (
        <EmptyState text="Yükleniyor..." />
      ) : sessions.length === 0 ? (
        <EmptyState text="Henüz serbest çalışma kaydın yok." />
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
                <button className="k-icon-btn" onClick={() => remove(s.id)} title="Sil" style={{ width: 30, height: 30, borderRadius: C.radiusSm, border: `1px solid ${C.border}`, background: C.surface2, color: C.red, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
