import { useEffect, useRef, useState } from "react";
import { X, Plus, Check, BookOpen, ListOrdered, ChevronLeft, PenLine, TrendingUp, Camera, CircleSlash, StickyNote } from "lucide-react";
import { C, bodyFont, displayFont, formatNet, netOf, recipientStatus, SKIP_REASONS } from "../../theme.js";
import { EmptyState, LoadingState, confirmDialog, Stepper, Chip, BottomActionBar, AlertBox, HeaderIconButton } from "../../components/common.jsx";
import { HeroHeader, SectionCard, StatusChip, FieldLabel, fieldBox, PrimaryButton, NUM } from "../../components/brand.jsx";
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

function ProgressBody({ history, live }) {
  const items = [...history, ...(live ? [live] : [])].slice(-3);
  if (items.length < 2) {
    return <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.inkMuted, lineHeight: 1.5, marginTop: 8 }}>Bu dersteki ilk sonucun — sonraki ödevlerde gelişimini burada göreceksin.</div>;
  }
  const maxPct = Math.max(1, ...items.map((i) => i.pct || 0));
  const first = items[0].pct;
  const last = items[items.length - 1].pct;
  const delta = first != null && last != null ? last - first : null;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`, gap: 12, alignItems: "end" }}>
        {items.map((it, i) => {
          const isLast = i === items.length - 1;
          return (
            <div key={it.key} style={{ minWidth: 0 }}>
              <div style={{ height: 52, display: "flex", alignItems: "flex-end" }}>
                <div style={{ width: "100%", height: Math.max(8, Math.round(((it.pct || 0) / maxPct) * 52)), borderRadius: 8, background: isLast ? C.cta : C.track }} />
              </div>
              <div style={{ ...NUM, fontSize: 16, fontWeight: 800, color: C.numText, marginTop: 8 }}>{formatNet(it.net, 2)}</div>
              <div style={{ ...NUM, fontSize: 12, color: C.inkMuted, marginTop: 2 }}>{it.label}{it.pct != null && ` · %${it.pct}`}</div>
            </div>
          );
        })}
      </div>
      {delta != null && (
        <div style={{ ...NUM, fontSize: 13.5, fontWeight: 700, color: delta >= 0 ? C.success : C.danger, marginTop: 12 }}>
          Başarın %{first} → %{last} ({delta >= 0 ? "+" : "−"}{Math.abs(delta)} puan)
        </div>
      )}
    </div>
  );
}

export default function AssignmentSubmitScreen({ user, recipientId, onBack }) {
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

  const heroTop = (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {onBack && <HeaderIconButton onBrand icon={ChevronLeft} label="Geri" onClick={onBack} />}
      <span style={{ flex: 1, fontFamily: displayFont, fontSize: 17, fontWeight: 600, color: C.onBrand }}>Sonuç gir</span>
    </div>
  );
  const shell = (children) => <div><HeroHeader compact>{heroTop}</HeroHeader><div style={{ maxWidth: 760, margin: "0 auto", padding: "16px" }}>{children}</div></div>;
  if (loading) return shell(<LoadingState />);
  if (loadError || !recipient) return shell(<EmptyState text={loadError || "Ödev bulunamadı"} />);
  const a = recipient.assignment;
  const expected = questionCountOf(a.pageRange);
  const branch = isSchoolWide(a) || !(user?.teacherId && a.teacherId === user.teacherId);
  const status = recipientStatus(recipient);
  const pageRangeIsJustCount = !!a.pageRange && /^\s*\d+\s*soru\s*$/i.test(a.pageRange);

  const [cN, wN, bN] = [correctCount, wrongCount, blankCount].map(toInt);
  const liveNet = Math.round((cN - wN / 4) * 100) / 100;
  const liveTotal = cN + wN + bN;
  const anyEntered = liveTotal > 0;
  const matches = expected == null || liveTotal === expected;
  const live = anyEntered ? { key: "live", net: liveNet, pct: liveTotal ? Math.round((liveNet / liveTotal) * 100) : null, label: "bu ödev" } : null;

  const deadlineText = status === "missed" ? `Süresi ${endedLabel(a.endDate).replace(" bitti", "")} doldu`
    : status === "open" ? `${deadlineLabel(a.endDate)}'a kadar`
    : null;
  const coachName = user?.coach?.name;
  const viewers = branch ? (coachName && coachName !== a.teacher?.name ? `${a.teacher?.name} ve koçun görür` : `${a.teacher?.name} görür`) : "Koçun görür";
  const uploading = uploadingCount > 0;
  const canAddPhoto = photos.length < MAX_PHOTOS;

  return (
    <div>
      <HeroHeader compact>
        {heroTop}
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <StatusChip tone="lime">{a.subject}</StatusChip>
            {expected != null && <StatusChip tone="onBrand">{expected} soru</StatusChip>}
            {deadlineText && <StatusChip tone={status === "missed" ? "danger" : "onBrand"}>{deadlineText}</StatusChip>}
            {status === "done" && <StatusChip tone="success">Sonucun girildi</StatusChip>}
          </div>
          <h1 style={{ margin: "10px 0 0", fontFamily: displayFont, fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.15, color: C.onBrand, overflowWrap: "anywhere" }}>{a.topic}</h1>
          {a.teacher?.name && <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.onBrandMuted, marginTop: 4 }}>{a.teacher.name}</div>}
          {(a.sourceBook || (a.pageRange && !pageRangeIsJustCount)) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", fontFamily: bodyFont, fontSize: 13, color: C.onBrandMuted, marginTop: 6 }}>
              {a.sourceBook && <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><BookOpen size={14} aria-hidden="true" />{a.sourceBook}</span>}
              {a.pageRange && !pageRangeIsJustCount && <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><ListOrdered size={14} aria-hidden="true" />{a.pageRange}</span>}
            </div>
          )}
        </div>
      </HeroHeader>

      {/* Yan boşluk 18px: alttaki sabit çubuk (.k-sticky-action) telefonda iki yandan 18px dışarı uzanır. */}
      <div className="k-page-form" style={{ maxWidth: 760, margin: "0 auto", padding: "16px 18px 0", display: "flex", flexDirection: "column", gap: 10 }}>
        {a.note && (
          <SectionCard icon={StickyNote} iconBg={C.warningTint} iconFg={C.warningText} title="Öğretmeninin notu">
            <div style={{ fontFamily: bodyFont, fontSize: 14, color: C.inkText, marginTop: 8, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{a.note}</div>
          </SectionCard>
        )}

        {recipient.skippedAt && (
          <AlertBox tone="amber">
            Bu ödevi pas geçtin · “{SKIP_REASONS[recipient.skipReason] || "Başka sebep"}”{recipient.skipNote ? ` — ${recipient.skipNote}` : ""}.{" "}
            <button type="button" onClick={undoSkip} disabled={skipBusy} style={{ background: "none", border: "none", padding: 0, color: "inherit", fontWeight: 700, textDecoration: "underline", cursor: "pointer", fontFamily: bodyFont, fontSize: 13.5 }}>Geri al</button>
            {" "}— sonucunu girersen pas kendiliğinden kalkar.
          </AlertBox>
        )}

        <SectionCard icon={PenLine} iconBg={C.brand} iconFg={C.onBrand} title="Sonucu gir">
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            <Stepper label="Doğru" dotColor={C.success} value={correctCount} onChange={setCorrectCount} />
            <Stepper label="Yanlış" dotColor={C.danger} value={wrongCount} onChange={setWrongCount} />
            <Stepper label="Boş" dotColor={C.barEmpty} value={blankCount} onChange={setBlankCount} />
          </div>
          <div style={{ marginTop: 12, padding: "14px 16px", borderRadius: 16, background: C.pageTint, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: bodyFont, fontSize: 12, fontWeight: 700, color: C.inkMuted }}>Net</div>
              <div aria-live="polite" style={{ ...NUM, fontSize: 32, fontWeight: 800, color: anyEntered ? C.numText : C.inkMuted, lineHeight: 1.1, marginTop: 2 }}>{anyEntered ? formatNet(liveNet, 2) : "—"}</div>
              <div style={{ ...NUM, fontSize: 12.5, color: C.inkMuted, marginTop: 4 }}>{cN} − {wN} / 4</div>
            </div>
            {expected != null && (
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ ...NUM, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 16, fontWeight: 800, color: !anyEntered ? C.inkMuted : matches ? C.success : C.danger }}>
                  {anyEntered && matches && <Check size={15} strokeWidth={2.6} aria-hidden="true" />}
                  {liveTotal} / {expected}
                </div>
                <div style={{ fontFamily: bodyFont, fontSize: 12, color: !anyEntered || matches ? C.inkMuted : C.danger, marginTop: 4, maxWidth: 120, lineHeight: 1.35 }}>
                  {!anyEntered ? "soru" : matches ? "soru sayısı tutuyor" : `${Math.abs(expected - liveTotal)} soru ${liveTotal < expected ? "eksik" : "fazla"}`}
                </div>
              </div>
            )}
          </div>
          <button type="button" onClick={() => setDetailsOpen((v) => !v)} style={{ minHeight: 44, padding: "0 2px", marginTop: 4, background: "none", border: "none", cursor: "pointer", fontFamily: bodyFont, fontSize: 13, fontWeight: 700, color: C.brandText, textAlign: "left" }}>
            {detailsOpen ? "Soru numaralarını ve notu gizle" : "Yanlış soru numaraları ya da koçuna not ekle (isteğe bağlı)"}
          </button>
          {detailsOpen && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <FieldLabel htmlFor="r-nums">Yanlış ve boş soruların</FieldLabel>
                <input id="r-nums" value={questionNumbers} onChange={(e) => setQuestionNumbers(e.target.value)} placeholder="3, 7, 12" style={{ ...fieldBox(false), cursor: "text" }} />
              </div>
              <div>
                <FieldLabel htmlFor="r-note">Koçuna not</FieldLabel>
                <textarea id="r-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="19. soruyu anlamadım" style={{ ...fieldBox(false), cursor: "text", padding: "12px 14px", minHeight: 76, resize: "vertical" }} />
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard icon={TrendingUp} iconBg={C.brandTint} iconFg={C.brandText} title="Gelişimin" note={history.length ? "bu dersteki son ödevler" : undefined}>
          <ProgressBody history={history} live={live} />
        </SectionCard>

        <SectionCard icon={Camera} iconBg={C.successTint} iconFg={C.successText} title="Kanıt fotoğrafı" note="isteğe bağlı · en fazla 6">
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${MAX_PHOTOS}, minmax(0, 1fr))`, gap: 8, marginTop: 12 }}>
            {Array.from({ length: MAX_PHOTOS }, (_, i) => {
              const p = photos[i];
              const tile = { position: "relative", aspectRatio: "1 / 1", borderRadius: 12, overflow: "hidden", boxSizing: "border-box", minWidth: 0 };
              if (p) {
                return (
                  <div key={p.id} style={{ ...tile, border: `1px solid ${C.brandOutline}` }}>
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
                  style={{ ...tile, border: `1.5px dashed ${isAdd ? C.brand : C.brandOutline}`, background: isAdd ? C.brandTint : C.pageTint, color: isAdd ? C.brandText : C.inkMuted, display: "flex", alignItems: "center", justifyContent: "center", cursor: isAdd ? "pointer" : "default", padding: 0 }}
                >
                  <Plus size={18} strokeWidth={2.2} />
                </button>
              );
            })}
          </div>
          {canAddPhoto && <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" multiple hidden onChange={handleFilesSelected} />}
          {uploading && <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.inkMuted, marginTop: 8 }}>Yükleniyor…</div>}
          {photoError && <div role="alert" style={{ color: C.danger, fontSize: 12.5, fontWeight: 600, marginTop: 10 }}>{photoError}</div>}
        </SectionCard>

        {!recipient.completed && !recipient.skippedAt && (
          <SectionCard icon={CircleSlash} iconBg={C.track} iconFg={C.inkText} title="Çözemediysen">
            <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.inkMuted, lineHeight: 1.5, marginTop: 8 }}>
              Pas geçmek boş bırakmaktan iyidir: koçun sebebini görür. Aynı konuyu birçok öğrenci “bilmiyorum” diye pas geçerse branş öğretmenine geri gider.
            </div>
            {!skipOpen ? (
              <button type="button" onClick={() => setSkipOpen(true)} style={{ width: "100%", minHeight: 48, marginTop: 12, borderRadius: 14, cursor: "pointer", background: C.surface, border: `1px solid ${C.brandOutline}`, color: C.inkText, fontFamily: bodyFont, fontSize: 14.5, fontWeight: 700 }}>
                Bu ödevi pas geç
              </button>
            ) : (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontFamily: bodyFont, fontSize: 14, fontWeight: 700, color: C.inkText, marginBottom: 10 }}>Neden pas geçiyorsun?</div>
                <div role="group" aria-label="Pas sebebi" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {Object.entries(SKIP_REASONS).map(([key, label]) => (
                    <Chip key={key} tone="amber" active={skipReason === key} onClick={() => setSkipReason(key)}>{label}</Chip>
                  ))}
                </div>
                {skipReason === "DIGER" && (
                  <div style={{ marginTop: 12 }}>
                    <FieldLabel htmlFor="r-skip">Kısaca yaz (isteğe bağlı)</FieldLabel>
                    <input id="r-skip" value={skipNote} maxLength={300} onChange={(e) => setSkipNote(e.target.value)} placeholder="ör. Okulda sınav vardı" style={{ ...fieldBox(false), cursor: "text" }} />
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button type="button" onClick={() => { setSkipOpen(false); setSkipReason(""); }} style={{ minHeight: 48, padding: "0 16px", borderRadius: 14, background: "none", border: "none", cursor: "pointer", fontFamily: bodyFont, fontSize: 14, fontWeight: 700, color: C.inkMuted }}>Vazgeç</button>
                  <div style={{ flex: 1 }}><PrimaryButton inactive={!skipReason || skipBusy} onClick={doSkip} style={{ minHeight: 48, borderRadius: 14, fontSize: 15 }}>{skipBusy ? "Kaydediliyor..." : "Pas geç"}</PrimaryButton></div>
                </div>
              </div>
            )}
          </SectionCard>
        )}

        {error && <div role="alert" style={{ color: C.danger, fontFamily: bodyFont, fontSize: 13, fontWeight: 600 }}>{error}</div>}
        {success && <div role="status" style={{ color: C.success, fontFamily: bodyFont, fontSize: 13, fontWeight: 600 }}>{success}</div>}

        <BottomActionBar caption={<span style={NUM}>{anyEntered ? `${formatNet(liveNet, 2)} net · ` : ""}{photos.length} fotoğraf · {viewers}</span>}>
          <PrimaryButton inactive={saving} onClick={submit}>{saving ? "Kaydediliyor..." : recipient.completed ? "Sonucu güncelle" : "Sonucu kaydet"}</PrimaryButton>
        </BottomActionBar>
      </div>
    </div>
  );
}
