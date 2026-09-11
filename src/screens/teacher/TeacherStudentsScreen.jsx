import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { C, displayFont, bodyFont } from "../../theme.js";
import { Card, Pill, EmptyState, Avatar } from "../../components/common.jsx";
import { api } from "../../api.js";
import { trackForGrade } from "../../subjects.js";

// Öğrencinin kendi tamamlama oranı kutusu için renk — ReportScreen'deki başarı oranı eşikleriyle aynı.
function rateTone(rate) {
  if (rate == null) return "muted";
  if (rate >= 70) return "green";
  if (rate >= 40) return "amber";
  return "red";
}

function CompletionBox({ rate }) {
  const tone = rateTone(rate);
  const colors = {
    muted: { bg: C.surface2, color: C.mutedLight },
    green: { bg: C.greenSoft, color: C.green },
    amber: { bg: C.amberSoft, color: C.amber },
    red: { bg: C.redSoft, color: C.red },
  }[tone];
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minWidth: 56, padding: "6px 10px", borderRadius: 10, background: colors.bg, flexShrink: 0,
    }}>
      <span style={{ fontFamily: displayFont, fontSize: 15, fontWeight: 800, color: colors.color, lineHeight: 1.1 }}>
        {rate != null ? `%${rate}` : "—"}
      </span>
      <span style={{ fontFamily: bodyFont, fontSize: 8.5, fontWeight: 700, color: C.mutedLight, textTransform: "uppercase", letterSpacing: 0.3, marginTop: 2 }}>
        Tamamlama
      </span>
    </div>
  );
}

export default function TeacherStudentsScreen({ onOpen }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    api.teacherListStudents().then(({ students }) => setStudents(students)).catch((e) => setLoadError(e.message || "Öğrenci listesi yüklenemedi")).finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: 28, maxWidth: 760, margin: "0 auto" }}>
      {loading ? (
        <EmptyState text="Yükleniyor..." />
      ) : loadError ? (
        <EmptyState text={loadError} />
      ) : students.length === 0 ? (
        <EmptyState text="Henüz sana atanmış bir öğrenci yok — okul yöneticinden öğrenci ataması istemen gerekebilir." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {students.map((s) => {
            const track = trackForGrade(s.gradeLevel);
            return (
              <Card key={s.id} hover={!!onOpen} style={{ padding: 16, cursor: onOpen ? "pointer" : "default" }}>
                <div onClick={onOpen ? () => onOpen(s.id, s.name) : undefined} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <Avatar name={s.name} size={38} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: bodyFont, fontSize: 14.5, fontWeight: 700, color: C.text }}>{s.name}</span>
                      {/* Sınıf (className) ile sınav türü (track) ayrı kutucuklarda — track'in rengi
                          YKS/LGS'yi göze bir bakışta ayırt etsin diye farklı (YKS: mor/accent, LGS: yeşil). */}
                      {s.className ? <Pill>{s.className}</Pill> : s.gradeLevel ? <Pill>{s.gradeLevel}. Sınıf</Pill> : null}
                      {track && <Pill tone={track === "YKS" ? "accent" : "green"}>{track}</Pill>}
                      {s.banned && <Pill tone="red">Askıda</Pill>}
                    </div>
                  </div>
                  <CompletionBox rate={s.completionRate} />
                  {onOpen && <ChevronRight size={18} color={C.muted} />}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
