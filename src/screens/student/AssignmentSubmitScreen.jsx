import { useEffect, useRef, useState } from "react";
import { X, Plus, Check, BookOpen, ListOrdered } from "lucide-react";
import { C, bodyFont, monoFont, formatNet, netOf, recipientStatus, SKIP_REASONS } from "../../theme.js";
import { Card, Button, Input, Textarea, EmptyState, LoadingState, confirmDialog, Stepper, SectionHeader, SourceTag, Chip, BottomActionBar, AlertBox } from "../../components/common.jsx";
import { api, photoUrl } from "../../api.js";
import { questionCountOf, isSchoolWide, deadlineLabel, endedLabel, shortDate, dayKey } from "../../work.js";

// Sonuç girişi (şartname Z2): üç adımlayıcı, net kartı + soru sayısı mutabakatı, aynı dersteki son üç
// ödevin gelişimi, kanıt fotoğrafı, çözemediysen "pas geç" + sebep. Giriş ekranı veri toplamakla
// kalmayıp karşılığında bir şey verir (gelişim); pas sebebi sorulur ki pas verisi yalnızca bir eksik
// sayısı olmasın.

const MAX_PHOTOS = 6;

function parseQuestionNumbers(text) {
  return text.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isInteger(n) && n > 0);
}

// Başarı yüzdesi — ödevlerin soru sayıları farklı (30 / 148...) olduğu için gelişim çubukları ham net
// yerine net/soru oranıyla karşılaştırılır; etiket yine net.
function successPct(s) {
  const total = s.correctCount + s.wrongCount + s.blankCount;
  return total ? Math.round(((s.correctCount - s.wrongCount / 4) / total) * 100) : null;
}

function ProgressCard({ history, live }) {
  const items = [...history, ...(live ? [live] : [])].slice(-3);
  if (items.length < 2) {
    return (
      <Card style={{ fontFamily: bodyFont, fontSize: 13.5, color: C.mutedLight, lineHeight: 1.5 }}>
        Bu dersteki ilk sonucun — sonraki ödevlerde gelişimini burada göreceksin.
      </Card>
    );
  }
  const maxPct = Math.max(1, ...items.map((i) => i.pct || 0));
  const first = items[0].pct;
  const last = items[items.length - 1].pct;
  const delta = first != null && last != null ? last - first : null;
  return (
    <Card>
      <div style={{ fontFamily: bodyFont, fontSize: 10.5, fontWeight: 700, letterSpacing: 1.4, color: C.mutedLight, marginBottom: 16 }}>BU DERSTEKİ SON {items.length === 3 ? "ÜÇ" : "İKİ"} ÖDEVİN</div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`, gap: 12, alignItems: "end" }}>
        {items.map((it, i) => {
          const isLast = i === items.length - 1;
          return (
            <div key={it.key} style={{ minWidth: 0 }}>
              <div style={{ height: 52, display: "flex", alignItems: "flex-end" }}>
                <div style={{ width: "100%", height: Math.max(8, Math.round(((it.pct || 0) / maxPct) * 52)), borderRadius: 6, background: isLast ? C.green : C.faintest }} />
              </div>
              <div style={{ fontFamily: monoFont, fontSize: 15, fontWeight: 700, color: isLast ? C.text : C.text2, marginTop: 8 }}>{formatNet(it.net, 2)}</div>
              <div style={{ fontFamily: bodyFont, fontSize: 11.5, color: C.mutedLight, marginTop: 2 }}>
                {it.label}{it.pct != null && <> · <span style={{ fontFamily: monoFont }}>%{it.pct}</span></>}
              </div>
            </div>
          );
        })}
      </div>
      {delta != null && (
        <div style={{ fontFamily: bodyFont, fontSize: 13.5, fontWeight: 500, color: delta >= 0 ? C.green : C.red, marginTop: 14 }}>
          Başarın <span style={{ fontFamily: monoFont }}>%{first}</span> → <span style={{ fontFamily: monoFont }}>%{last}</span>
          {" "}({delta >= 0 ? "+" : "−"}<span style={{ fontFamily: monoFont }}>{Math.abs(delta)}</span> puan)
        </div>
      )}
    </Card>
  );
}

export default function AssignmentSubmitScreen({ user, recipientId, setHeader }) {
  const [recipient, setRecipient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [correctCount, setCorrectCount] = useState("");
  const [wrongCount, setWrongCount] = useState("");
  const [blankCount, setBlankCount] = useState("");
  const [note, setNote] = useState("");
  const [questionNumbers, setQuestionNumbers] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [photoError, setPhotoError] = useState("");
  const [uploadingCount, setUploadingCount] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [history, setHistory] = useState([]);
  const [skipOpen, setSkipOpen] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const [skipNote, setSkipNote] = useState("");
  const [skipBusy, setSkipBusy] = useState(false);
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
        if (recipient.submission.note || recipient.submission.questionNumbers?.length) setDetailsOpen(true);
      }
      const a = recipient.assignment;
      const q = questionCountOf(a.pageRange);
      setHeader?.({ title: a.topic, subtitle: [a.subject, a.teacher?.name, q != null && `${q} soru`].filter(Boolean).join(" · ") });
      // Gelişim kartı: aynı dersteki önceki (sonucu girilmiş) ödevler.
      api.listMyAssignments({ subject: a.subject, completed: "true" }).then(({ recipients }) => {
        setHistory(recipients
          .filter((r) => r.id !== recipient.id && r.submission)
          .sort((x, y) => dayKey(x.assignment.endDate).localeCompare(dayKey(y.assignment.endDate)))
          .slice(-2)
          .map((r) => ({ key: r.id, net: netOf(r.submission), pct: successPct(r.submission), label: shortDate(r.assignment.endDate) })));
      }).catch(() => {});
    }).catch((e) => setLoadError(e.message || "Ödev yüklenemedi")).finally(() => setLoading(false));
  }, [recipientId]); // eslint-disable-line react-hooks/exhaustive-deps

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
    // Kısmi başarıda son hatayı TEK BAŞINA göstermek "hiçbiri yüklenmedi" izlenimi verirdi.
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

  const toInt = (v) => (v === "" ? 0 : parseInt(v, 10));

  const submit = async () => {
    setError("");
    setSuccess("");
    const payload = {
      correctCount: toInt(correctCount),
      wrongCount: toInt(wrongCount),
      blankCount: toInt(blankCount),
      note: note.trim() || undefined,
      questionNumbers: parseQuestionNumbers(questionNumbers),
    };
    const total = payload.correctCount + payload.wrongCount + payload.blankCount;
    if (total === 0) { setError("Doğru, yanlış ve boş sayılarını gir"); return; }
    // Toplam soru sayısını tutmuyorsa kaydetme ENGELLENMEZ, onay istenir: soru sayısı ödevde ayrı bir
    // alan değil (koçun yazdığı "30 soru"dan okunuyor) — koç yanlış yazdıysa engel öğrenciyi sonucunu hiç
    // giremez hâlde bırakırdı. Net kartındaki kırmızı uyarı hatayı zaten görünür kılıyor.
    const expected = questionCountOf(recipient.assignment.pageRange);
    if (expected != null && total !== expected) {
      const diff = Math.abs(expected - total);
      const ok = await confirmDialog({
        title: "Soru sayısı tutmuyor",
        message: `Girdiğin toplam ${total}, bu ödevde ${expected} soru var (${diff} soru ${total < expected ? "eksik" : "fazla"}). Yine de kaydedilsin mi?`,
        confirmLabel: "Yine de kaydet",
        cancelLabel: "Düzelteyim",
      });
      if (!ok) return;
    }
    setSaving(true);
    try {
      const { submission } = await api.submitRecipient(recipientId, payload);
      setRecipient((r) => ({ ...r, completed: true, submission, skippedAt: null, skipReason: null }));
      setSkipOpen(false);
      setSuccess("Sonucun kaydedildi.");
    } catch (err) {
      setError(err.message || "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  const doSkip = async () => {
    if (!skipReason) return;
    setSkipBusy(true);
    setError("");
    try {
      const { recipient: upd } = await api.skipRecipient(recipientId, skipReason, skipReason === "DIGER" ? skipNote : undefined);
      setRecipient((r) => ({ ...r, ...upd }));
      setSkipOpen(false);
    } catch (err) {
      setError(err.message || "Pas geçilemedi");
    } finally {
      setSkipBusy(false);
    }
  };

  const undoSkip = async () => {
    setSkipBusy(true);
    try {
      await api.unskipRecipient(recipientId);
      setRecipient((r) => ({ ...r, skippedAt: null, skipReason: null, skipNote: null }));
      setSkipReason("");
    } catch (err) {
      setError(err.message || "Geri alınamadı");
    } finally {
      setSkipBusy(false);
    }
  };

  // Geri düğmesi App başlığında (headerBack).
  if (loading) return <div className="k-page" style={{ padding: 28, maxWidth: 760, margin: "0 auto" }}><LoadingState /></div>;
  if (loadError || !recipient) {
    return <div className="k-page" style={{ padding: 28, maxWidth: 760, margin: "0 auto" }}><EmptyState text={loadError || "Ödev bulunamadı"} /></div>;
  }
  const a = recipient.assignment;
  const expected = questionCountOf(a.pageRange);
  const branch = isSchoolWide(a);
  const status = recipientStatus(recipient);
  const pageRangeIsJustCount = !!a.pageRange && /^\s*\d+\s*soru\s*$/i.test(a.pageRange);

  const [cN, wN, bN] = [correctCount, wrongCount, blankCount].map(toInt);
  const liveNet = Math.round((cN - wN / 4) * 100) / 100;
  const liveTotal = cN + wN + bN;
  const anyEntered = liveTotal > 0;
  const matches = expected == null || liveTotal === expected;
  const live = anyEntered ? { key: "live", net: liveNet, pct: liveTotal ? Math.round((liveNet / liveTotal) * 100) : null, label: "bu ödev" } : null;

  const deadlineText = status === "missed" ? `süresi ${endedLabel(a.endDate).replace(" bitti", "")} doldu`
    : status === "open" ? `${deadlineLabel(a.endDate)}'a kadar`
    : null;
  const coachName = user?.coach?.name;
  const viewers = branch ? (coachName && coachName !== a.teacher?.name ? `${a.teacher?.name} ve koçun görür` : `${a.teacher?.name} görür`) : "Koçun görür";
  const uploading = uploadingCount > 0;
  const canAddPhoto = photos.length < MAX_PHOTOS;

  return (
    <div className="k-page k-page-form" style={{ padding: 28, maxWidth: 760, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontFamily: bodyFont, fontSize: 13, color: C.mutedLight, marginBottom: 4 }}>
        <SourceTag variant={branch ? "okul" : "koc"} />
        <span>{branch ? "Okul çapında branş ödevi" : "Koçunun kişisel ödevi"}{deadlineText && <> · <span style={{ color: status === "missed" ? C.red : C.mutedLight }}>{deadlineText}</span></>}</span>
      </div>
      {(a.sourceBook || (a.pageRange && !pageRangeIsJustCount) || a.note) && (
        <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.text2, marginTop: 10, lineHeight: 1.5 }}>
          {a.sourceBook && <div style={{ display: "flex", gap: 8, alignItems: "center" }}><BookOpen size={14} color={C.mutedLight} />{a.sourceBook}</div>}
          {a.pageRange && !pageRangeIsJustCount && <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}><ListOrdered size={14} color={C.mutedLight} />{a.pageRange}</div>}
          {a.note && <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`, whiteSpace: "pre-wrap" }}>{a.note}</div>}
        </div>
      )}

      {recipient.skippedAt && (
        <AlertBox tone="amber" style={{ marginTop: 16 }}>
          Bu ödevi pas geçtin · “{SKIP_REASONS[recipient.skipReason] || "Başka sebep"}”{recipient.skipNote ? ` — ${recipient.skipNote}` : ""}.{" "}
          <button type="button" onClick={undoSkip} disabled={skipBusy} style={{ background: "none", border: "none", padding: 0, color: "inherit", fontWeight: 700, textDecoration: "underline", cursor: "pointer", fontFamily: bodyFont, fontSize: 13.5 }}>Geri al</button>
          {" "}— sonucunu girersen pas kendiliğinden kalkar.
        </AlertBox>
      )}

      <SectionHeader title="Sonucu gir" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Stepper label="Doğru" dotColor={C.green} value={correctCount} onChange={setCorrectCount} />
        <Stepper label="Yanlış" dotColor={C.red} value={wrongCount} onChange={setWrongCount} />
        <Stepper label="Boş" dotColor={C.blank} value={blankCount} onChange={setBlankCount} />
      </div>

      <Card style={{ marginTop: 12, padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.mutedLight }}>Net</div>
          <div aria-live="polite" style={{ fontFamily: monoFont, fontSize: 42, fontWeight: 700, letterSpacing: -1.8, color: anyEntered ? C.text : C.faintest, lineHeight: 1.1, marginTop: 4 }}>{anyEntered ? formatNet(liveNet, 2) : "—"}</div>
          <div style={{ fontFamily: monoFont, fontSize: 13, color: C.mutedLight, marginTop: 6 }}>{cN} − {wN} / 4</div>
        </div>
        {expected != null && (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: monoFont, fontSize: 16, fontWeight: 700, color: !anyEntered ? C.mutedLight : matches ? C.green : C.red }}>
              {anyEntered && matches && <Check size={15} strokeWidth={2.6} />}
              {liveTotal} / {expected}
            </div>
            <div style={{ fontFamily: bodyFont, fontSize: 12, color: !anyEntered || matches ? C.mutedLight : C.red, marginTop: 4, maxWidth: 120, lineHeight: 1.35 }}>
              {!anyEntered ? "soru" : matches ? "soru sayısı tutuyor" : `${Math.abs(expected - liveTotal)} soru ${liveTotal < expected ? "eksik" : "fazla"}`}
            </div>
          </div>
        )}
      </Card>

      <button type="button" onClick={() => setDetailsOpen((v) => !v)} className="k-link-btn" style={{ background: "none", border: "none", padding: "12px 0 0", cursor: "pointer", fontFamily: bodyFont, fontSize: 13.5, fontWeight: 600, color: C.text2 }}>
        {detailsOpen ? "Soru numaralarını ve notu gizle" : "Yanlış soru numaraları ya da koçuna not ekle (isteğe bağlı)"}
      </button>
      {detailsOpen && (
        <div style={{ marginTop: 12 }}>
          <Input label="Yanlış ve boş soruların" value={questionNumbers} onChange={(e) => setQuestionNumbers(e.target.value)} placeholder="3, 7, 12" />
          <Textarea label="Koçuna not" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="19. soruyu anlamadım" style={{ minHeight: 68 }} />
        </div>
      )}

      <SectionHeader title="Gelişimin" />
      <ProgressCard history={history} live={live} />

      <SectionHeader title="Kanıt fotoğrafı" right="isteğe bağlı · en fazla 6" />
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${MAX_PHOTOS}, minmax(0, 1fr))`, gap: 8 }}>
        {Array.from({ length: MAX_PHOTOS }, (_, i) => {
          const p = photos[i];
          const tile = { position: "relative", aspectRatio: "1 / 1", borderRadius: 12, overflow: "hidden", boxSizing: "border-box", minWidth: 0 };
          if (p) {
            return (
              <div key={p.id} style={{ ...tile, border: `1px solid ${C.border}` }}>
                <img src={photoUrl(p)} alt={`Kanıt fotoğrafı ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                <button type="button" onClick={() => deletePhoto(p.id)} aria-label={`${i + 1}. fotoğrafı sil`} style={{ position: "absolute", top: 2, right: 2, width: 26, height: 26, borderRadius: 999, border: "none", background: "rgba(0,0,0,0.65)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <X size={12} />
                </button>
              </div>
            );
          }
          const isAdd = i === photos.length && canAddPhoto;
          return (
            <button
              key={`slot-${i}`} type="button" disabled={!isAdd || uploading}
              onClick={isAdd ? () => fileInputRef.current?.click() : undefined}
              aria-label={isAdd ? (uploading ? "Fotoğraf yükleniyor" : "Fotoğraf ekle") : undefined}
              aria-hidden={isAdd ? undefined : true} tabIndex={isAdd ? 0 : -1}
              className={isAdd ? "k-btn" : undefined}
              style={{ ...tile, border: `1.5px dashed ${C.borderStrong}`, background: C.surface, color: isAdd ? C.text2 : C.faintest, display: "flex", alignItems: "center", justifyContent: "center", cursor: isAdd ? "pointer" : "default", padding: 0 }}
            >
              <Plus size={18} strokeWidth={2} />
            </button>
          );
        })}
      </div>
      {canAddPhoto && <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" multiple hidden onChange={handleFilesSelected} />}
      {uploading && <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.mutedLight, marginTop: 8 }}>Yükleniyor…</div>}
      {photoError && <div role="alert" style={{ color: C.red, fontSize: 12.5, fontWeight: 600, marginTop: 10 }}>{photoError}</div>}

      {!recipient.completed && !recipient.skippedAt && (
        <>
          <SectionHeader title="Çözemediysen" />
          {!skipOpen ? (
            <Button full variant="secondary" onClick={() => setSkipOpen(true)}>Bu ödevi pas geç</Button>
          ) : (
            <Card>
              <div style={{ fontFamily: bodyFont, fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 12 }}>Neden pas geçiyorsun?</div>
              <div role="group" aria-label="Pas sebebi" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {Object.entries(SKIP_REASONS).map(([key, label]) => (
                  <Chip key={key} tone="amber" active={skipReason === key} onClick={() => setSkipReason(key)}>{label}</Chip>
                ))}
              </div>
              {skipReason === "DIGER" && (
                <div style={{ marginTop: 12 }}>
                  <Input label="Kısaca yaz (isteğe bağlı)" value={skipNote} maxLength={300} onChange={(e) => setSkipNote(e.target.value)} placeholder="ör. Okulda sınav vardı" />
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <Button variant="ghost" onClick={() => { setSkipOpen(false); setSkipReason(""); }}>Vazgeç</Button>
                <div style={{ flex: 1 }}><Button full disabled={!skipReason || skipBusy} onClick={doSkip}>{skipBusy ? "Kaydediliyor..." : "Pas geç"}</Button></div>
              </div>
            </Card>
          )}
          <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.mutedLight, lineHeight: 1.55, marginTop: 10, padding: "12px 14px", borderRadius: 14, background: C.surface, border: `1px solid ${C.border}` }}>
            Pas geçmek boş bırakmaktan iyidir: koçun sebebini görür. Aynı konuyu birçok öğrenci “bilmiyorum” diye pas geçerse branş öğretmenine geri gider.
          </div>
        </>
      )}

      {error && <div role="alert" style={{ color: C.red, fontFamily: bodyFont, fontSize: 13, fontWeight: 600, marginTop: 16 }}>{error}</div>}
      {success && <div role="status" style={{ color: C.green, fontFamily: bodyFont, fontSize: 13, fontWeight: 600, marginTop: 16 }}>{success}</div>}

      <BottomActionBar caption={<>{anyEntered ? <><span style={{ fontFamily: monoFont }}>{formatNet(liveNet, 2)}</span> net · </> : null}<span style={{ fontFamily: monoFont }}>{photos.length}</span> fotoğraf · {viewers}</>}>
        <Button full disabled={saving} onClick={submit}>{saving ? "Kaydediliyor..." : recipient.completed ? "Sonucu güncelle" : "Sonucu kaydet"}</Button>
      </BottomActionBar>
    </div>
  );
}
