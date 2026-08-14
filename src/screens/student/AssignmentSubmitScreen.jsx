import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { C, displayFont, bodyFont } from "../../theme.js";
import { Card, Button, Input, Textarea, Pill, EmptyState } from "../../components/common.jsx";
import { api } from "../../api.js";
import { formatDateRange } from "../../dates.js";

function parseQuestionNumbers(text) {
  return text
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n > 0);
}

export default function AssignmentSubmitScreen({ recipientId, onBack }) {
  const [recipient, setRecipient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [correctCount, setCorrectCount] = useState("");
  const [wrongCount, setWrongCount] = useState("");
  const [blankCount, setBlankCount] = useState("");
  const [note, setNote] = useState("");
  const [questionNumbers, setQuestionNumbers] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getRecipient(recipientId).then(({ recipient }) => {
      setRecipient(recipient);
      if (recipient.submission) {
        setCorrectCount(String(recipient.submission.correctCount));
        setWrongCount(String(recipient.submission.wrongCount));
        setBlankCount(String(recipient.submission.blankCount));
        setNote(recipient.submission.note || "");
        setQuestionNumbers((recipient.submission.questionNumbers || []).join(", "));
      }
    }).finally(() => setLoading(false));
  }, [recipientId]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    const payload = {
      correctCount: parseInt(correctCount, 10),
      wrongCount: parseInt(wrongCount, 10),
      blankCount: parseInt(blankCount, 10),
      note: note.trim() || undefined,
      questionNumbers: parseQuestionNumbers(questionNumbers),
    };
    if (![payload.correctCount, payload.wrongCount, payload.blankCount].every((n) => Number.isInteger(n) && n >= 0)) {
      setError("Doğru/Yanlış/Boş sayılarını gir");
      return;
    }
    setSaving(true);
    try {
      const { submission } = await api.submitRecipient(recipientId, payload);
      setRecipient((r) => ({ ...r, completed: true, submission }));
      setSuccess("Sonucun kaydedildi.");
    } catch (err) {
      setError(err.message || "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <EmptyState text="Yükleniyor..." />;
  if (!recipient) return null;
  const a = recipient.assignment;

  return (
    <div style={{ padding: 28, maxWidth: 580, margin: "0 auto" }}>
      <button onClick={onBack} className="k-link-btn" style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: C.muted, cursor: "pointer", fontFamily: bodyFont, fontSize: 13, fontWeight: 600, marginBottom: 18 }}>
        <ArrowLeft size={16} /> Ödevlerime dön
      </button>

      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
          <span style={{ fontFamily: displayFont, fontSize: 18, fontWeight: 800 }}>{a.subject} — {a.topic}</span>
          <Pill>{a.examType}</Pill>
          {recipient.completed && <Pill tone="green">Tamamlandı</Pill>}
        </div>
        <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.muted }}>
          {a.teacher.name} · {formatDateRange(a.scheduledDate, a.endDate)}
        </div>
        {a.sourceBook && <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.text, marginTop: 8 }}>Kaynak: {a.sourceBook}</div>}
        {a.pageRange && <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.text, marginTop: 4 }}>Sayfa/Soru: {a.pageRange}</div>}
      </Card>

      <Card>
        <div style={{ fontFamily: displayFont, fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
          {recipient.completed ? "Sonucunu Güncelle" : "Sonucunu Gir"}
        </div>
        <form onSubmit={submit}>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Input label="Doğru" type="number" min="0" value={correctCount} onChange={(e) => setCorrectCount(e.target.value)} required />
            </div>
            <div style={{ flex: 1 }}>
              <Input label="Yanlış" type="number" min="0" value={wrongCount} onChange={(e) => setWrongCount(e.target.value)} required />
            </div>
            <div style={{ flex: 1 }}>
              <Input label="Boş" type="number" min="0" value={blankCount} onChange={(e) => setBlankCount(e.target.value)} required />
            </div>
          </div>
          <Input label="Yanlış/boş yaptığın soru numaraları (opsiyonel, virgülle ayır)" value={questionNumbers} onChange={(e) => setQuestionNumbers(e.target.value)} placeholder="ör. 3, 7, 12" />
          <Textarea label="Not (opsiyonel)" value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="ör. 19. soruyu anlamadım" />
          {error && <div style={{ color: C.red, fontSize: 12.5, fontWeight: 600, marginBottom: 14 }}>{error}</div>}
          {success && <div style={{ color: C.green, fontSize: 12.5, fontWeight: 600, marginBottom: 14 }}>{success}</div>}
          <Button full type="submit" disabled={saving}>{saving ? "Kaydediliyor..." : recipient.completed ? "Güncelle" : "Kaydet"}</Button>
        </form>
      </Card>
    </div>
  );
}
