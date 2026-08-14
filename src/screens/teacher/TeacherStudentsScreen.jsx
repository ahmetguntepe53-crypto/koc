import { useEffect, useState } from "react";
import { C, bodyFont } from "../../theme.js";
import { Card, Pill, EmptyState, StatCard, Avatar } from "../../components/common.jsx";
import { api } from "../../api.js";
import { trackForGrade } from "../../subjects.js";

export default function TeacherStudentsScreen() {
  const [students, setStudents] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.teacherListStudents().then(({ students }) => setStudents(students)).finally(() => setLoading(false));
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
      ) : students.length === 0 ? (
        <EmptyState text="Henüz sana atanmış bir öğrenci yok — okul yöneticinden öğrenci ataması istemen gerekebilir." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {students.map((s) => (
            <Card key={s.id} style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <Avatar name={s.name} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: bodyFont, fontSize: 14.5, fontWeight: 700, color: C.text }}>{s.name}</span>
                    {s.className && <Pill>{s.className}</Pill>}
                    {s.gradeLevel && <Pill tone="amber">{s.gradeLevel}. Sınıf ({trackForGrade(s.gradeLevel)})</Pill>}
                    {s.banned && <Pill tone="red">Askıda</Pill>}
                  </div>
                  <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.muted, marginTop: 3 }}>{s.email}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
