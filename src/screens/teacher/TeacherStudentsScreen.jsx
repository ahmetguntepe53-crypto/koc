import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { C, bodyFont } from "../../theme.js";
import { Card, Pill, EmptyState, StatCard, Avatar } from "../../components/common.jsx";
import { api } from "../../api.js";
import { trackForGrade } from "../../subjects.js";

export default function TeacherStudentsScreen({ onOpen }) {
  const [students, setStudents] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    api.teacherListStudents().then(({ students }) => setStudents(students)).catch((e) => setLoadError(e.message || "Öğrenci listesi yüklenemedi")).finally(() => setLoading(false));
    api.teacherStats().then(setStats).catch(() => {});
  }, []);

  return (
    <div style={{ padding: 28, maxWidth: 760, margin: "0 auto" }}>
      {stats && (
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          <StatCard label="Öğrenci" value={stats.studentCount} tone="accent" />
          <StatCard label="Bekleyen Taslak" value={stats.draftCount} tone="amber" />
          <StatCard label="Gönderilen Ödev" value={stats.sentCount} tone="muted" />
          <StatCard label="Tamamlanma Oranı" value={stats.completionRate != null ? `%${stats.completionRate}` : "—"} tone="green" />
        </div>
      )}

      {loading ? (
        <EmptyState text="Yükleniyor..." />
      ) : loadError ? (
        <EmptyState text={loadError} />
      ) : students.length === 0 ? (
        <EmptyState text="Henüz sana atanmış bir öğrenci yok — okul yöneticinden öğrenci ataması istemen gerekebilir." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {students.map((s) => (
            <Card key={s.id} hover={!!onOpen} style={{ padding: 16, cursor: onOpen ? "pointer" : "default" }}>
              <div onClick={onOpen ? () => onOpen(s.id) : undefined} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <Avatar name={s.name} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: bodyFont, fontSize: 14.5, fontWeight: 700, color: C.text }}>{s.name}</span>
                    {s.className && <Pill>{s.className}</Pill>}
                    {s.gradeLevel && <Pill tone="amber">{s.gradeLevel}. Sınıf ({trackForGrade(s.gradeLevel)})</Pill>}
                    {s.banned && <Pill tone="red">Askıda</Pill>}
                  </div>
                </div>
                {onOpen && <ChevronRight size={18} color={C.muted} />}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
