import { useEffect, useState } from "react";
import { ArrowLeft, BarChart3, ChevronRight, Plus } from "lucide-react";
import { C, displayFont, bodyFont } from "../../theme.js";
import { Card, Button, Pill, EmptyState, StatCard, Avatar } from "../../components/common.jsx";
import { api } from "../../api.js";
import { trackForGrade } from "../../subjects.js";
import { formatDate, formatDateRange, daysUntil } from "../../dates.js";

// TYT/AYT/LGS'nin standart net hesaplama formülü — server/src/routes/stats.js'deki net()'in
// birebir aynısı, burada yalnızca özet kartlarda göstermek için ayrıca hesaplanıyor.
function net(correctCount, wrongCount) {
  return Math.round((correctCount - wrongCount / 4) * 100) / 100;
}

// Bekleyen bir ödevin aciliyetini gösteren rozet — yalnızca gecikmiş veya son 2 gün içindeyse
// gösterilir, her satırda gereksiz gürültü yaratmasın diye.
function UrgencyPill({ endDate }) {
  const diff = daysUntil(endDate);
  if (diff < 0) return <Pill tone="red">{Math.abs(diff)} gün gecikti</Pill>;
  if (diff === 0) return <Pill tone="amber">Son gün bugün</Pill>;
  if (diff === 1) return <Pill tone="amber">Son 1 gün</Pill>;
  if (diff === 2) return <Pill tone="amber">Son 2 gün</Pill>;
  return null;
}

export default function StudentOverviewScreen({ studentId, onBack, onOpenAssignment, onCreateAssignment, onOpenReport }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    api.teacherStudentOverview(studentId)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) return <EmptyState text="Yükleniyor..." />;
  if (error) return <EmptyState text={error} />;
  if (!data) return null;

  const { student, recipients, studySessions } = data;
  // Tamamlanma oranı yalnızca GÖNDERİLMİŞ (SENT) ödevler üzerinden hesaplanır — taslaklar (DRAFT)
  // öğrenciye hiç ulaşmadığı için paydaya girerse oran yapay olarak düşer, ayrıca /teacher/students
  // listesindeki orandan (o da yalnızca SENT sayar) tutarsız çıkar. "Toplam Ödev" ve aşağıdaki liste
  // yine tüm recipients'ı (taslaklar dahil) gösterir — koç planladığı her şeyi görebilsin diye.
  const sentRecipients = recipients.filter((r) => r.assignment.status === "SENT");
  const completedCount = sentRecipients.filter((r) => r.completed).length;
  const completionRate = sentRecipients.length ? Math.round((completedCount / sentRecipients.length) * 100) : null;

  return (
    <div style={{ padding: 28, maxWidth: 760, margin: "0 auto" }}>
      <button onClick={onBack} className="k-link-btn" style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: C.muted, cursor: "pointer", fontFamily: bodyFont, fontSize: 13, fontWeight: 600, marginBottom: 18 }}>
        <ArrowLeft size={16} /> Öğrencilerime dön
      </button>

      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <Avatar name={student.name} size={44} />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontFamily: displayFont, fontSize: 17, fontWeight: 800, color: C.text }}>{student.name}</span>
                {student.className && <Pill>{student.className}</Pill>}
                {student.gradeLevel && <Pill tone="amber">{student.gradeLevel}. Sınıf ({trackForGrade(student.gradeLevel)})</Pill>}
                {student.banned && <Pill tone="red">Askıda</Pill>}
              </div>
              <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.muted, marginTop: 3 }}>{student.email}</div>
            </div>
          </div>
          {onOpenReport && (
            <Button small variant="secondary" icon={BarChart3} onClick={() => onOpenReport(studentId, student.name)}>Raporunu Gör</Button>
          )}
        </div>
      </Card>

      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <StatCard label="Toplam Ödev" value={recipients.length} tone="accent" />
        <StatCard label="Tamamlanan" value={completedCount} tone="green" />
        <StatCard label="Tamamlanma Oranı" value={completionRate != null ? `%${completionRate}` : "—"} tone="muted" />
        <StatCard label="Serbest Çalışma" value={studySessions.length} tone="amber" />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontFamily: displayFont, fontSize: 14, fontWeight: 800, color: C.mutedLight, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Ödevleri ({recipients.length})
        </div>
        {onCreateAssignment && (
          <Button small variant="secondary" icon={Plus} onClick={() => onCreateAssignment(studentId)}>Yeni Ödev Ata</Button>
        )}
      </div>
      {recipients.length === 0 ? (
        <EmptyState text="Bu öğrenciye henüz ödev gönderilmemiş." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
          {recipients.map((r) => (
            <Card key={r.id} hover style={{ padding: 14, cursor: "pointer" }}>
              <div onClick={() => onOpenAssignment(r.assignmentId, "studentOverview")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: bodyFont, fontSize: 13.5, fontWeight: 700, color: C.text }}>{r.assignment.subject} — {r.assignment.topic}</span>
                    <Pill>{r.assignment.examType}</Pill>
                    {r.submission ? (
                      <>
                        <Pill tone="green">D:{r.submission.correctCount} Y:{r.submission.wrongCount} B:{r.submission.blankCount}</Pill>
                        <Pill tone="accent">Net: {net(r.submission.correctCount, r.submission.wrongCount)}</Pill>
                      </>
                    ) : r.assignment.status === "SENT" ? (
                      <>
                        <Pill tone={r.completed ? "green" : "amber"}>{r.completed ? "Tamamlandı" : "Bekliyor"}</Pill>
                        {!r.completed && <UrgencyPill endDate={r.assignment.endDate} />}
                      </>
                    ) : (
                      // Taslak — öğrenciye henüz gönderilmedi, bu yüzden "gecikti" rozeti burada
                      // ASLA gösterilmemeli (öğrenci ödevi hiç görmedi ki geciksin).
                      <Pill tone="muted">Taslak — henüz gönderilmedi</Pill>
                    )}
                  </div>
                  <div style={{ fontFamily: bodyFont, fontSize: 12, color: C.muted, marginTop: 4 }}>
                    {formatDateRange(r.assignment.scheduledDate, r.assignment.endDate)}
                    {r.assignment.sourceBook ? ` · ${r.assignment.sourceBook}` : ""}
                    {r.assignment.pageRange ? ` · ${r.assignment.pageRange}` : ""}
                  </div>
                </div>
                <ChevronRight size={16} color={C.muted} />
              </div>
            </Card>
          ))}
        </div>
      )}

      <div style={{ fontFamily: displayFont, fontSize: 14, fontWeight: 800, marginBottom: 12, color: C.mutedLight, textTransform: "uppercase", letterSpacing: 0.5 }}>
        Serbest Çalışmaları ({studySessions.length})
      </div>
      {studySessions.length === 0 ? (
        <EmptyState text="Bu öğrenci henüz serbest çalışma kaydı girmemiş." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {studySessions.map((s) => (
            <Card key={s.id} style={{ padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontFamily: bodyFont, fontSize: 13.5, fontWeight: 700, color: C.text }}>{s.subject} — {s.topic}</span>
                <Pill>{s.examType}</Pill>
              </div>
              <div style={{ fontFamily: bodyFont, fontSize: 12, color: C.muted, marginTop: 4 }}>
                {formatDate(s.studyDate)} · D:{s.correctCount} Y:{s.wrongCount} B:{s.blankCount}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
