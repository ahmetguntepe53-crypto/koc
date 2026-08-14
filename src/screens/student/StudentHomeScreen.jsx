import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { C, bodyFont } from "../../theme.js";
import { Card, Select, Pill, EmptyState, StatCard } from "../../components/common.jsx";
import { api } from "../../api.js";
import { ALL_SUBJECTS } from "../../subjects.js";
import { formatDateRange } from "../../dates.js";

export default function StudentHomeScreen({ onOpen, refreshKey }) {
  const [recipients, setRecipients] = useState([]);
  const [filter, setFilter] = useState("");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.listMyAssignments({ completed: filter || undefined, subject: subject || undefined }).then(({ recipients }) => setRecipients(recipients)).finally(() => setLoading(false));
  }, [filter, subject, refreshKey]);

  useEffect(() => { api.studentStats().then(setStats).catch(() => {}); }, [refreshKey]);

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
          <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">Tümü</option>
            <option value="false">Bekleyenler</option>
            <option value="true">Tamamlananlar</option>
          </Select>
        </div>
      </div>

      {stats && (
        <div style={{ display: "flex", gap: 12, marginBottom: 22, flexWrap: "wrap" }}>
          <StatCard label="Bekleyen" value={stats.pendingCount} tone="amber" />
          <StatCard label="Tamamlanan" value={stats.completedCount} tone="green" />
          <StatCard label="Serbest Çalışma" value={stats.studySessionCount} tone="accent" />
          {stats.totals && <StatCard label="Toplam D/Y/B" value={`${stats.totals.correct}/${stats.totals.wrong}/${stats.totals.blank}`} tone="muted" />}
        </div>
      )}

      {loading ? (
        <EmptyState text="Yükleniyor..." />
      ) : recipients.length === 0 ? (
        <EmptyState text="Henüz sana gönderilmiş bir ödev yok." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {recipients.map((r) => (
            <Card key={r.id} hover style={{ padding: 16, cursor: "pointer" }}>
              <div onClick={() => onOpen(r.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: bodyFont, fontSize: 14.5, fontWeight: 700, color: C.text }}>{r.assignment.subject} — {r.assignment.topic}</span>
                    <Pill tone={r.completed ? "green" : "amber"}>{r.completed ? "Tamamlandı" : "Bekliyor"}</Pill>
                    <Pill>{r.assignment.examType}</Pill>
                  </div>
                  <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.muted, marginTop: 4 }}>
                    {r.assignment.teacher.name} · {formatDateRange(r.assignment.scheduledDate, r.assignment.endDate)}
                    {r.assignment.sourceBook ? ` · ${r.assignment.sourceBook}` : ""}
                    {r.assignment.pageRange ? ` · ${r.assignment.pageRange}` : ""}
                  </div>
                </div>
                <ChevronRight size={18} color={C.muted} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
