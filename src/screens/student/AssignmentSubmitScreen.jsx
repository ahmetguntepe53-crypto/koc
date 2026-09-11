import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ImagePlus, X } from "lucide-react";
import { C, displayFont, bodyFont } from "../../theme.js";
import { Card, Button, Input, Textarea, Pill, EmptyState } from "../../components/common.jsx";
import { api, photoUrl } from "../../api.js";
import { formatDateRange, daysUntil } from "../../dates.js";

const MAX_PHOTOS = 20;

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
  const [photos, setPhotos] = useState([]);
  const [photoError, setPhotoError] = useState("");
  const [uploadingCount, setUploadingCount] = useState(0);
  const [loadError, setLoadError] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    api.getRecipient(recipientId).then(({ recipient }) => {
      setRecipient(recipient);
      setPhotos(recipient.photos || []);
      if (recipient.submission) {
        setCorrectCount(String(recipient.submission.correctCount));
        setWrongCount(String(recipient.submission.wrongCount));
        setBlankCount(String(recipient.submission.blankCount));
        setNote(recipient.submission.note || "");
        setQuestionNumbers((recipient.submission.questionNumbers || []).join(", "));
      }
    }).catch((e) => setLoadError(e.message || "Ödev yüklenemedi")).finally(() => setLoading(false));
  }, [recipientId]);

  const handleFilesSelected = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = ""; // aynı dosyayı art arda seçebilmek için input'u sıfırla
    if (!files.length) return;
    setPhotoError("");
    const remaining = MAX_PHOTOS - photos.length;
    const limitNotice = files.length > remaining
      ? (remaining > 0 ? `Yalnızca ${remaining} fotoğraf daha ekleyebilirsin, ilk ${remaining} tanesi eklendi.` : `En fazla ${MAX_PHOTOS} fotoğraf ekleyebilirsin.`)
      : "";
    const toUpload = files.slice(0, Math.max(0, remaining));
    setUploadingCount(toUpload.length);
    let succeeded = 0;
    let failed = 0;
    let lastFailure = "";
    for (const file of toUpload) {
      try {
        const { photo } = await api.uploadRecipientPhoto(recipientId, file);
        setPhotos((prev) => [...prev, photo]);
        succeeded++;
      } catch (err) {
        failed++;
        lastFailure = err.message || "Fotoğraf yüklenemedi";
      } finally {
        setUploadingCount((n) => n - 1);
      }
    }
    // Kısmi başarı durumunda son hatayı TEK BAŞINA göstermek "hiçbiri yüklenmedi" izlenimi verirdi —
    // kaç tanesinin başarılı olduğu da mesaja eklenir.
    const failureNotice = failed > 0 ? (succeeded > 0 ? `${succeeded} fotoğraf eklendi, ${failed} tanesi eklenemedi: ${lastFailure}` : lastFailure) : "";
    setPhotoError([limitNotice, failureNotice].filter(Boolean).join(" "));
  };

  const deletePhoto = async (photoId) => {
    try {
      await api.deleteRecipientPhoto(recipientId, photoId);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } catch (err) {
      setPhotoError(err.message || "Fotoğraf silinemedi");
    }
  };

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
  if (loadError || !recipient) {
    return (
      <div style={{ padding: 28, maxWidth: 580, margin: "0 auto" }}>
        <button onClick={onBack} className="k-link-btn" style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: C.muted, cursor: "pointer", fontFamily: bodyFont, fontSize: 13, fontWeight: 600, marginBottom: 18 }}>
          <ArrowLeft size={16} /> Ödevlerime dön
        </button>
        <EmptyState text={loadError || "Ödev bulunamadı"} />
      </div>
    );
  }
  const a = recipient.assignment;

  return (
    <div style={{ padding: 28, maxWidth: 580, margin: "0 auto" }}>
      <button onClick={onBack} className="k-link-btn" style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: C.muted, cursor: "pointer", fontFamily: bodyFont, fontSize: 13, fontWeight: 600, marginBottom: 18 }}>
        <ArrowLeft size={16} /> Ödevlerime dön
      </button>

      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
          <span style={{ fontFamily: displayFont, fontSize: 18, fontWeight: 800, color: C.text }}>{a.subject} — {a.topic}</span>
          <Pill>{a.examType}</Pill>
          {recipient.completed && <Pill tone="green">Tamamlandı</Pill>}
          {!recipient.completed && daysUntil(a.endDate) < 0 && <Pill tone="red">Gecikti</Pill>}
        </div>
        <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.muted }}>
          {a.teacher.name} · {formatDateRange(a.scheduledDate, a.endDate)}
        </div>
        {a.sourceBook && <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.text, marginTop: 8 }}>Kaynak: {a.sourceBook}</div>}
        {a.pageRange && <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.text, marginTop: 4 }}>Sayfa/Soru: {a.pageRange}</div>}
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontFamily: displayFont, fontSize: 15, fontWeight: 700, color: C.text }}>Kanıt Fotoğrafları</span>
          <span style={{ fontFamily: bodyFont, fontSize: 12, color: C.mutedLight, fontWeight: 600 }}>{photos.length}/{MAX_PHOTOS}</span>
        </div>
        {photos.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: 8, marginBottom: 12 }}>
            {photos.map((p) => (
              <div key={p.id} style={{ position: "relative", aspectRatio: "1", borderRadius: C.radiusSm, overflow: "hidden", border: `1px solid ${C.border}` }}>
                <img src={photoUrl(p)} alt="Kanıt fotoğrafı" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                <button
                  type="button"
                  onClick={() => deletePhoto(p.id)}
                  title="Fotoğrafı sil"
                  style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 999, border: "none", background: "rgba(15,23,42,0.6)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
        {photos.length < MAX_PHOTOS && (
          <>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" multiple hidden onChange={handleFilesSelected} />
            <Button variant="secondary" small icon={ImagePlus} onClick={() => fileInputRef.current?.click()} disabled={uploadingCount > 0}>
              {uploadingCount > 0 ? "Yükleniyor..." : "Fotoğraf Ekle"}
            </Button>
          </>
        )}
        {photoError && <div style={{ color: C.red, fontSize: 12.5, fontWeight: 600, marginTop: 10 }}>{photoError}</div>}
      </Card>

      <Card>
        <div style={{ fontFamily: displayFont, fontSize: 15, fontWeight: 700, marginBottom: 12, color: C.text }}>
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
