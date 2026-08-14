import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { C, displayFont, bodyFont } from "../../theme.js";
import { Card, Button, Pill, EmptyState, Avatar } from "../../components/common.jsx";
import { api } from "../../api.js";
import { PERIOD_LABELS, SEND_MODE_LABELS, STATUS_LABELS } from "../../subjects.js";
import { formatDate, formatDateRange } from "../../dates.js";

export default function AssignmentDetailScreen({ assignmentId, onBack }) {
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    api.getAssignment(assignmentId)
      .then(({ assignment }) => setAssignment(assignment))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [assignmentId]);

  const sendNow = async () => {
    try { await api.sendAssignmentNow(assignmentId); load(); } catch (e) { setError(e.message); }
  };
  const remove = async () => {
    if (!window.confirm("Bu taslak ödev silinsin mi?")) return;
    try { await api.deleteAssignment(assignmentId); onBack(); } catch (e) { setError(e.message); }
  };

  if (loading) return <EmptyState text="Yükleniyor..." />;
  if (error) return <EmptyState text={error} />;
  if (!assignment) return null;

  return (
    <div style={{ padding: 28, maxWidth: 760, margin: "0 auto" }}>
      <button onClick={onBack} className="k-link-btn" style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: C.muted, cursor: "pointer", fontFamily: bodyFont, fontSize: 13, fontWeight: 600, marginBottom: 18 }}>
        <ArrowLeft size={16} /> Ödevlerime dön
      </button>

      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
          <span style={{ fontFamily: displayFont, fontSize: 18, fontWeight: 800 }}>{assignment.subject} — {assignment.topic}</span>
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
            <Button small onClick={sendNow}>Şimdi Gönder</Button>
            <Button small variant="danger" onClick={remove}>Sil</Button>
          </div>
        )}
        {error && <div style={{ color: C.red, fontSize: 12.5, marginTop: 10 }}>{error}</div>}
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
              ) : (
                <Pill tone={assignment.status === "SENT" ? "amber" : "muted"}>{assignment.status === "SENT" ? "Bekliyor" : "Henüz gönderilmedi"}</Pill>
              )}
            </div>
            {r.submission?.note && (
              <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.muted, marginTop: 8, fontStyle: "italic" }}>"{r.submission.note}"</div>
            )}
          </Card>
        ))}
      </div>
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
