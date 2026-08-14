import { useEffect, useState } from "react";
import { Send, Trash2, ChevronRight } from "lucide-react";
import { C, bodyFont } from "../../theme.js";
import { Card, Button, Select, Pill, EmptyState } from "../../components/common.jsx";
import { api } from "../../api.js";
import { PERIOD_LABELS, STATUS_LABELS, ALL_SUBJECTS } from "../../subjects.js";
import { formatDateRange } from "../../dates.js";

export default function AssignmentListScreen({ onOpen, refreshKey }) {
  const [assignments, setAssignments] = useState([]);
  const [status, setStatus] = useState("");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const load = () => {
    setLoading(true);
    api.listAssignments({ status, subject }).then(({ assignments }) => setAssignments(assignments)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [status, subject, refreshKey]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const sendNow = async (id) => {
    try {
      await api.sendAssignmentNow(id);
      load();
    } catch (e) {
      setToast({ type: "error", text: e.message });
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Bu taslak ödev silinsin mi?")) return;
    try {
      await api.deleteAssignment(id);
      load();
    } catch (e) {
      setToast({ type: "error", text: e.message });
    }
  };

  return (
    <div style={{ padding: 28, maxWidth: 760, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div style={{ minWidth: 170 }}>
          <Select value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">Tüm dersler</option>
            {ALL_SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>
        <div style={{ minWidth: 170 }}>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tümü</option>
            <option value="DRAFT">Bekliyor</option>
            <option value="SENT">Gönderildi</option>
          </Select>
        </div>
      </div>

      {toast && (
        <div style={{ marginBottom: 16, padding: "11px 15px", borderRadius: C.radiusSm, background: C.redSoft, color: C.red, fontSize: 13, fontWeight: 600 }}>{toast.text}</div>
      )}

      {loading ? (
        <EmptyState text="Yükleniyor..." />
      ) : assignments.length === 0 ? (
        <EmptyState text="Henüz ödev yok — soldaki 'Ödev Oluştur' sekmesinden ekleyebilirsin." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {assignments.map((a) => {
            const completedCount = a.recipients.filter((r) => r.completed).length;
            return (
              <Card key={a.id} hover style={{ padding: 16, cursor: "pointer" }}>
                <div onClick={() => onOpen(a.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: bodyFont, fontSize: 14.5, fontWeight: 700, color: C.text }}>{a.subject} — {a.topic}</span>
                      <Pill tone={a.status === "SENT" ? "green" : "amber"}>{STATUS_LABELS[a.status]}</Pill>
                      <Pill>{a.examType}</Pill>
                    </div>
                    <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.muted, marginTop: 4 }}>
                      {formatDateRange(a.scheduledDate, a.endDate)} · {PERIOD_LABELS[a.period]} · {a.recipients.length} öğrenci{a.status === "SENT" ? ` · ${completedCount}/${a.recipients.length} tamamladı` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    {a.status === "DRAFT" && (
                      <>
                        <IconButton title="Şimdi gönder" icon={Send} onClick={(e) => { e.stopPropagation(); sendNow(a.id); }} />
                        <IconButton title="Sil" icon={Trash2} danger onClick={(e) => { e.stopPropagation(); remove(a.id); }} />
                      </>
                    )}
                    <ChevronRight size={18} color={C.muted} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function IconButton({ icon: Icon, onClick, title, danger }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="k-icon-btn"
      style={{
        width: 32, height: 32, borderRadius: C.radiusSm, border: `1px solid ${C.border}`,
        background: C.surface2, color: danger ? C.red : C.muted, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <Icon size={14} />
    </button>
  );
}
