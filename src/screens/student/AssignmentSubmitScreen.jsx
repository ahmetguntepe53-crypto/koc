import { useEffect, useRef, useState } from "react";
import { Camera, X, Check, AlertTriangle, BookOpen, ListOrdered } from "lucide-react";
import { C, displayFont, bodyFont, monoFont, formatNet } from "../../theme.js";
import { Card, Button, Input, Textarea, Pill, SubjectIcon, EmptyState, LoadingState, confirmDialog, Num } from "../../components/common.jsx";
import { api, photoUrl } from "../../api.js";
import { formatDateRange, daysUntil } from "../../dates.js";
import { subjectIconUrl } from "../../subjects.js";

// 20 fotoğraf ne öğrencinin yükleyeceği ne koçun bakacağı bir sayıydı — sunucu da 6'ya indirildi.
const MAX_PHOTOS = 6;
const PHOTO_COLUMNS = 3;

function parseQuestionNumbers(text) {
  return text
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n > 0);
}

// Ödevin soru sayısı ayrı bir alan değil — koç "Sayfa/Soru" alanına "30 soru" gibi yazıyorsa oradan
// okunur. Yoksa null: toplam kontrolü yapılmaz.
function expectedQuestionCount(pageRange) {
  const m = /(\d+)\s*soru/i.exec(pageRange || "");
  return m ? parseInt(m[1], 10) : null;
}

const cardTitleStyle = () => ({ fontFamily: displayFont, fontSize: 15.5, fontWeight: 700, letterSpacing: -0.1, color: C.text });

// Başlık kartındaki durum rozeti — Ödevlerim satırlarıyla aynı dil (kırmızı gecikti / yeşil tamamlandı /
// amber kalan gün).
function StatusPill({ completed, endDate }) {
  if (completed) return <Pill tone="green">Tamamlandı</Pill>;
  const daysLeft = daysUntil(endDate);
  if (daysLeft < 0) return <Pill tone="red"><Num>{Math.abs(daysLeft)}</Num>gün gecikti</Pill>;
  if (daysLeft === 0) return <Pill tone="amber">Bugün son gün</Pill>;
  if (daysLeft === 1) return <Pill tone="amber">Yarın</Pill>;
  return <Pill tone="amber"><Num>{daysLeft}</Num>gün kaldı</Pill>;
}

function DetailLine({ icon: Icon, children }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 7, fontFamily: bodyFont, fontSize: 12.5, fontWeight: 500, color: C.text2, marginTop: 6, lineHeight: 1.45 }}>
      <Icon size={13} strokeWidth={2.2} color={C.mutedLight} style={{ flexShrink: 0, marginTop: 2 }} />
      <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{children}</span>
    </div>
  );
}

// Doğru/Yanlış/Boş kutusu: etiket durumun renginde, kutu durumun açık tonunda, değer mono 22.
// Kenarlık durumun renginin %20'si — sabit hex/color-mix yerine üstte opaklığı 0.2 olan bir çerçeve
// katmanıyla (her iki temada, eski WebView'larda da çalışsın diye).
function ScoreField({ label, tone, value, onChange }) {
  const fg = { green: C.green, red: C.red, muted: C.muted }[tone];
  const bg = { green: C.greenSoft, red: C.redSoft, muted: C.surface2 }[tone];
  return (
    <label style={{ display: "block", minWidth: 0 }}>
      <div style={{ fontFamily: bodyFont, fontSize: 11, fontWeight: 700, color: fg, marginBottom: 6 }}>{label}</div>
      <div style={{ position: "relative" }}>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={3}
          autoComplete="off"
          required
          value={value}
          // Yalnızca rakam — type="number"ın masaüstündeki ok düğmeleri ortalanmış büyük rakamı kaydırıyordu.
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
          className="k-field"
          style={{
            display: "block", width: "100%", minWidth: 0, boxSizing: "border-box", height: 52, padding: "0 6px",
            borderRadius: 12, border: "1.5px solid transparent", background: bg, color: fg, outline: "none",
            fontFamily: monoFont, fontSize: 22, fontWeight: 700, textAlign: "center",
          }}
        />
        <span aria-hidden="true" style={{ position: "absolute", inset: 0, borderRadius: 12, border: `1.5px solid ${fg}`, opacity: 0.2, pointerEvents: "none" }} />
      </div>
    </label>
  );
}

// NET şeridinin sağı: girilen toplam soru sayısı ödevinkiyle tutuyor mu? Üç alan da girilince yeşil tik
// ya da amber uyarı; ödevin soru sayısı bilinmiyorsa yalnızca toplam.
function TotalCheck({ total, allEntered, anyEntered, expected }) {
  const unit = <span style={{ fontFamily: bodyFont, fontSize: 11.5, fontWeight: 500, color: C.muted }}>soru</span>;
  const mono = (color, text) => <span style={{ fontFamily: monoFont, fontSize: 12, fontWeight: 700, color }}>{text}</span>;
  const row = (children) => <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: "auto", flexShrink: 0 }}>{children}</div>;

  if (expected == null) {
    if (!anyEntered) return null;
    return row(<>{mono(C.muted, total)}{unit}</>);
  }
  if (!allEntered) return row(<>{mono(C.muted, `${total}/${expected}`)}{unit}</>);
  if (total === expected) {
    return row(<><Check size={14} strokeWidth={2.6} color={C.green} />{mono(C.green, `${total}/${expected}`)}{unit}</>);
  }
  const diff = Math.abs(expected - total);
  return row(
    <>
      <AlertTriangle size={14} strokeWidth={2.4} color={C.amber} />
      {mono(C.amber, `${total}/${expected}`)}
      <span style={{ fontFamily: bodyFont, fontSize: 11.5, fontWeight: 600, color: C.amber }}>
        · <span style={{ fontFamily: monoFont }}>{diff}</span> soru {total < expected ? "eksik" : "fazla"}
      </span>
    </>
  );
}

function tileStyle() {
  // Taslaktaki gibi yatay kutu (~10:7) — kare kutular kartı gereksiz uzatıyordu.
  return { position: "relative", aspectRatio: "10 / 7", borderRadius: 12, overflow: "hidden", boxSizing: "border-box", minWidth: 0 };
}

export default function AssignmentSubmitScreen({ recipientId }) {
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
    // Köşedeki küçük X'e yanlışlıkla dokunmak kanıtı sessizce siliyordu.
    if (!(await confirmDialog({ title: "Fotoğraf silinsin mi?", message: "Bu kanıt fotoğrafı ödevinden kaldırılacak.", confirmLabel: "Sil", danger: true }))) return;
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
    // Toplam ödevin soru sayısını tutmuyorsa kaydetme ENGELLENMEZ, onay istenir — koç soru sayısını
    // yanlış yazmış olabilir (ya da öğrenci bazı soruları hiç görmemiş); engellemek öğrenciyi
    // sonucunu hiç giremez halde bırakırdı. Şeritteki amber uyarı hatayı zaten görünür kılıyor.
    const expectedCount = expectedQuestionCount(recipient.assignment.pageRange);
    const total = payload.correctCount + payload.wrongCount + payload.blankCount;
    if (expectedCount != null && total !== expectedCount) {
      const diff = Math.abs(expectedCount - total);
      const ok = await confirmDialog({
        title: "Soru sayısı tutmuyor",
        message: `Girdiğin toplam ${total}, bu ödevde ${expectedCount} soru var (${diff} soru ${total < expectedCount ? "eksik" : "fazla"}). Yine de kaydedilsin mi?`,
        confirmLabel: "Yine de kaydet",
        cancelLabel: "Düzelteyim",
      });
      if (!ok) return;
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

  // Geri düğmesi App başlığında (headerBack) — sayfa içinde ayrı bir "Ödevlerime dön" bağlantısı yok.
  if (loading) return <div className="k-page" style={{ padding: 28, maxWidth: 760, margin: "0 auto" }}><LoadingState /></div>;
  if (loadError || !recipient) {
    return (
      <div className="k-page" style={{ padding: 28, maxWidth: 760, margin: "0 auto" }}>
        <EmptyState text={loadError || "Ödev bulunamadı"} />
      </div>
    );
  }
  const a = recipient.assignment;
  const expected = expectedQuestionCount(a.pageRange);
  // "30 soru" rozet olarak zaten görünüyor — Sayfa/Soru metni yalnızca bundan fazlasını söylüyorsa ayrıca yazılır.
  const pageRangeIsJustCount = !!a.pageRange && /^\s*\d+\s*soru\s*$/i.test(a.pageRange);

  // Girilen D/Y/B'den anlık net — öğrenci kaydetmeden önce sonucunu görsün (TYT/AYT: 4 yanlış 1 doğruyu götürür).
  const [cN, wN, bN] = [correctCount, wrongCount, blankCount].map((v) => (v === "" ? null : parseInt(v, 10)));
  const liveNet = Number.isInteger(cN) && Number.isInteger(wN) ? Math.round((cN - wN / 4) * 100) / 100 : null;
  const liveTotal = (cN || 0) + (wN || 0) + (bN || 0);
  const allEntered = [cN, wN, bN].every(Number.isInteger);
  const anyEntered = [cN, wN, bN].some(Number.isInteger);

  const canAddPhoto = photos.length < MAX_PHOTOS;
  const tileCount = photos.length + (canAddPhoto ? 1 : 0);
  // Son satırı boş yuvalarla tamamla — "daha ekleyebilirsin" hissi, yarım satır görünmesin.
  const emptySlots = (PHOTO_COLUMNS - (tileCount % PHOTO_COLUMNS)) % PHOTO_COLUMNS;
  const uploading = uploadingCount > 0;

  return (
    <div className="k-page" style={{ padding: 28, maxWidth: 760, margin: "0 auto" }}>
      <Card style={{ marginBottom: 14, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <SubjectIcon src={subjectIconUrl(a.subject)} size={44} radius={13} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: displayFont, fontSize: 16, fontWeight: 700, letterSpacing: -0.1, color: C.text, lineHeight: 1.3 }}>{a.subject} — {a.topic}</div>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              <StatusPill completed={recipient.completed} endDate={a.endDate} />
              {a.examType && <Pill>{a.examType}</Pill>}
              {expected != null && <Pill><Num>{expected}</Num>soru</Pill>}
            </div>
            <div style={{ fontFamily: bodyFont, fontSize: 12, fontWeight: 500, color: C.mutedLight, marginTop: 8 }}>
              {a.teacher?.name} · {formatDateRange(a.scheduledDate, a.endDate)}
            </div>
          </div>
        </div>
        {(a.sourceBook || (a.pageRange && !pageRangeIsJustCount)) && (
          <div style={{ marginTop: 8 }}>
            {a.sourceBook && <DetailLine icon={BookOpen}>{a.sourceBook}</DetailLine>}
            {a.pageRange && !pageRangeIsJustCount && <DetailLine icon={ListOrdered}>{a.pageRange}</DetailLine>}
          </div>
        )}
        {a.note && (
          <div style={{ fontFamily: bodyFont, fontSize: 13, fontWeight: 500, color: C.text2, lineHeight: 1.5, marginTop: 12, padding: "10px 12px", borderRadius: C.radiusSm, background: C.surface2, whiteSpace: "pre-wrap" }}>
            {a.note}
          </div>
        )}
      </Card>

      {/* Sonuç formu önce — öğrencinin bu ekrandaki asıl işi; kanıt fotoğrafı onu tamamlayan adım. */}
      <Card style={{ marginBottom: 14, padding: 16 }}>
        <div style={{ ...cardTitleStyle(), marginBottom: 14 }}>
          {recipient.completed ? "Sonucunu güncelle" : "Sonucunu gir"}
        </div>
        <form onSubmit={submit}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
            <ScoreField label="Doğru" tone="green" value={correctCount} onChange={setCorrectCount} />
            <ScoreField label="Yanlış" tone="red" value={wrongCount} onChange={setWrongCount} />
            <ScoreField label="Boş" tone="muted" value={blankCount} onChange={setBlankCount} />
          </div>

          {/* NET şeridi: net = doğru − yanlış/4; sağda toplamın ödevin soru sayısını tutup tutmadığı. */}
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 12, rowGap: 4, marginTop: 12, marginBottom: 18, padding: "12px 14px", borderRadius: 13, background: C.accentSoft, minWidth: 0 }}>
            <span style={{ fontFamily: bodyFont, fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: C.accent }}>NET</span>
            <span style={{ fontFamily: monoFont, fontSize: 26, fontWeight: 700, letterSpacing: -1, color: C.accent, lineHeight: 1.1 }}>
              {liveNet != null ? formatNet(liveNet) : "—"}
            </span>
            <TotalCheck total={liveTotal} allEntered={allEntered} anyEntered={anyEntered} expected={expected} />
          </div>

          <Input label="Yanlış ve boş soruların" value={questionNumbers} onChange={(e) => setQuestionNumbers(e.target.value)} placeholder="3, 7, 12" />
          <Textarea label="Koçuna not" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="19. soruyu anlamadım" style={{ minHeight: 68 }} />
          {error && <div style={{ color: C.red, fontSize: 12.5, fontWeight: 600, marginBottom: 14 }}>{error}</div>}
          {success && <div style={{ color: C.green, fontSize: 12.5, fontWeight: 600, marginBottom: 14 }}>{success}</div>}
          <Button full type="submit" disabled={saving}>{saving ? "Kaydediliyor..." : recipient.completed ? "Güncelle" : "Kaydet"}</Button>
        </form>
      </Card>

      <Card style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={cardTitleStyle()}>Kanıt fotoğrafı</span>
          <span style={{ fontFamily: monoFont, fontSize: 12.5, fontWeight: 600, color: C.mutedLight }}>{photos.length}/{MAX_PHOTOS}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${PHOTO_COLUMNS}, minmax(0, 1fr))`, gap: 10 }}>
          {canAddPhoto && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              aria-label={uploading ? "Fotoğraf yükleniyor" : "Fotoğraf ekle"}
              className="k-btn"
              style={{
                ...tileStyle(), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
                border: `1.5px dashed ${C.faintest}`, background: C.surface, color: C.muted,
                cursor: uploading ? "default" : "pointer", fontFamily: bodyFont, fontSize: 12, fontWeight: 600, padding: 0,
              }}
            >
              <Camera size={20} strokeWidth={2} color={C.mutedLight} />
              {uploading ? "Yükleniyor..." : "Ekle"}
            </button>
          )}
          {photos.map((p) => (
            <div key={p.id} style={{ ...tileStyle(), border: `1px solid ${C.border}` }}>
              <img src={photoUrl(p)} alt="Kanıt fotoğrafı" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              <button
                type="button"
                onClick={() => deletePhoto(p.id)}
                title="Fotoğrafı sil"
                aria-label="Fotoğrafı sil"
                style={{ position: "absolute", top: 4, right: 4, width: 28, height: 28, borderRadius: 999, border: "none", background: "rgba(15,23,42,0.6)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                <X size={13} />
              </button>
            </div>
          ))}
          {Array.from({ length: emptySlots }, (_, i) => (
            <div key={`empty-${i}`} aria-hidden="true" style={{ ...tileStyle(), border: `1px solid ${C.border}`, background: C.fieldBg }} />
          ))}
        </div>
        {canAddPhoto && <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" multiple hidden onChange={handleFilesSelected} />}
        {photoError && <div style={{ color: C.red, fontSize: 12.5, fontWeight: 600, marginTop: 10 }}>{photoError}</div>}
      </Card>
    </div>
  );
}
