import { useEffect, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { C, displayFont, bodyFont } from "../../theme.js";
import { Card, Button, Pill, EmptyState, Avatar, Modal } from "../../components/common.jsx";
import { api, photoUrl } from "../../api.js";
import { PERIOD_LABELS, SEND_MODE_LABELS, STATUS_LABELS } from "../../subjects.js";
import { formatDate, formatDateRange, daysUntil } from "../../dates.js";

export default function AssignmentDetailScreen({ assignmentId, onBack }) {
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lightbox, setLightbox] = useState(null); // { photos, index }

  const load = () => {
    setLoading(true);
    api.getAssignment(assignmentId)
      .then(({ assignment }) => setAssignment(assignment))
      .catch((e) => setLoadError(e.message || "Ödev yüklenemedi"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [assignmentId]);

  const sendNow = async () => {
    if (!window.confirm("Bu ödev şimdi öğrencilere gönderilsin mi?")) return;
    setActionError("");
    setBusy(true);
    try { await api.sendAssignmentNow(assignmentId); load(); } catch (e) { setActionError(e.message); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm("Bu taslak ödev silinsin mi?")) return;
    setActionError("");
    setBusy(true);
    try { await api.deleteAssignment(assignmentId); onBack(); } catch (e) { setActionError(e.message); setBusy(false); }
  };

  if (loading) return <EmptyState text="Yükleniyor..." />;
  if (loadError) return <EmptyState text={loadError} />;
  if (!assignment) return null;

  return (
    <div style={{ padding: 28, maxWidth: 760, margin: "0 auto" }}>
      <button onClick={onBack} className="k-link-btn" style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: C.muted, cursor: "pointer", fontFamily: bodyFont, fontSize: 13, fontWeight: 600, marginBottom: 18 }}>
        <ArrowLeft size={16} /> Ödevlerime dön
      </button>

      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
          <span style={{ fontFamily: displayFont, fontSize: 18, fontWeight: 800, color: C.text }}>{assignment.subject} — {assignment.topic}</span>
          <Pill tone={assignment.status === "SENT" ? "green" : "amber"}>{STATUS_LABELS[assignment.status]}</Pill>
          <Pill>{assignment.examType}</Pill>
        </div>
        <DetailRow label="Tarih" value={formatDateRange(assignment.scheduledDate, assignment.endDate)} />
        <DetailRow label="Periyot" value={PERIOD_LABELS[assignment.period]} />
        <DetailRow label="Gönderim modu" value={SEND_MODE_LABELS[assignment.sendMode]} />
        {assignment.sourceBook && <DetailRow label="Kaynak kitap" value={assignment.sourceBook} />}
        {assignment.pageRange && <DetailRow label="Sayfa / soru aralığı" value={assignment.pageRange} />}
        {assignment.sentAt && <DetailRow label="Gönderildi" value={formatDate(assignment.sentAt)} />}

        {assignment.status === "DRAFT" && (
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <Button small disabled={busy} onClick={sendNow}>Şimdi Gönder</Button>
            <Button small variant="danger" disabled={busy} onClick={remove}>Sil</Button>
          </div>
        )}
        {actionError && <div style={{ color: C.red, fontSize: 12.5, marginTop: 10 }}>{actionError}</div>}
      </Card>

      <div style={{ fontFamily: displayFont, fontSize: 14, fontWeight: 800, marginBottom: 12, color: C.mutedLight, textTransform: "uppercase", letterSpacing: 0.5 }}>
        Öğrenciler ({assignment.recipients.length})
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {assignment.recipients.map((r) => (
          <Card key={r.id} style={{ padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar name={r.student.name} size={30} />
                <div>
                  <span style={{ fontFamily: bodyFont, fontSize: 13.5, fontWeight: 700, color: C.text }}>{r.student.name}</span>
                  {r.student.className && <span style={{ fontFamily: bodyFont, fontSize: 12, color: C.muted, marginLeft: 6 }}>({r.student.className})</span>}
                </div>
              </div>
              {r.submission ? (
                <Pill tone="green">D:{r.submission.correctCount} Y:{r.submission.wrongCount} B:{r.submission.blankCount}</Pill>
              ) : assignment.status === "SENT" && daysUntil(assignment.endDate) < 0 ? (
                <Pill tone="red">Gecikti</Pill>
              ) : (
                <Pill tone={assignment.status === "SENT" ? "amber" : "muted"}>{assignment.status === "SENT" ? "Bekliyor" : "Henüz gönderilmedi"}</Pill>
              )}
            </div>
            {r.submission?.note && (
              <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.muted, marginTop: 8, fontStyle: "italic" }}>"{r.submission.note}"</div>
            )}
            {r.photos?.length > 0 && (
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                {r.photos.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setLightbox({ photos: r.photos, index: i })}
                    style={{ width: 44, height: 44, borderRadius: C.radiusSm, overflow: "hidden", border: `1px solid ${C.border}`, padding: 0, cursor: "pointer", flexShrink: 0 }}
                  >
                    <img src={photoUrl(p)} alt="Kanıt fotoğrafı" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  </button>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>

      {lightbox && (
        <Modal title={`Kanıt Fotoğrafı (${lightbox.index + 1}/${lightbox.photos.length})`} onClose={() => setLightbox(null)}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => setLightbox((l) => ({ ...l, index: (l.index - 1 + l.photos.length) % l.photos.length }))}
              disabled={lightbox.photos.length < 2}
              style={{ background: "none", border: "none", cursor: lightbox.photos.length < 2 ? "default" : "pointer", opacity: lightbox.photos.length < 2 ? 0.3 : 1, flexShrink: 0 }}
            >
              <ChevronLeft size={22} color={C.text} />
            </button>
            <img
              src={photoUrl(lightbox.photos[lightbox.index])}
              alt="Kanıt fotoğrafı"
              style={{ width: "100%", maxHeight: "65vh", objectFit: "contain", borderRadius: C.radiusSm, background: C.surface2 }}
            />
            <button
              type="button"
              onClick={() => setLightbox((l) => ({ ...l, index: (l.index + 1) % l.photos.length }))}
              disabled={lightbox.photos.length < 2}
              style={{ background: "none", border: "none", cursor: lightbox.photos.length < 2 ? "default" : "pointer", opacity: lightbox.photos.length < 2 ? 0.3 : 1, flexShrink: 0 }}
            >
              <ChevronRight size={22} color={C.text} />
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
      <span style={{ color: C.muted, fontFamily: bodyFont }}>{label}</span>
      <span style={{ color: C.text, fontFamily: bodyFont, fontWeight: 600 }}>{value}</span>
    </div>
  );
}
