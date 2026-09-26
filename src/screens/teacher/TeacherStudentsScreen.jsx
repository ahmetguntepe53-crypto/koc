import { useEffect, useMemo, useState } from "react";
import { ChevronRight, AlertTriangle, Search } from "lucide-react";
import { C, bodyFont, monoFont, completionTone } from "../../theme.js";
import { Card, Pill, Chip, EmptyState, Avatar, LoadingState, ProgressBar } from "../../components/common.jsx";
import { api } from "../../api.js";
import { GRADE_LEVELS, gradeLabel } from "../../subjects.js";
import PushPermissionBanner from "../../components/PushPermissionBanner.jsx";

// Filtre çipleri — varsayılan "Tümü". "Geciken var" başta: koçun listeye bakınca ilk sorduğu soru.
const FILTERS = [
  { value: "overdue", label: "Geciken var" },
  { value: "all", label: "Tümü" },
  { value: "11", label: "11. Sınıf" },
  { value: "12", label: "12. Sınıf" },
];

// Büyük/küçük harfe duyarsız arama için tr-TR yerel ayarı şart: varsayılan toLowerCase "I"yı "i"ye,
// "İ"yi noktalı birleşik "i̇"ye çeviriyor — "IŞIK" / "İlayda" aramaları eşleşmiyordu.
function lower(value) {
  return String(value || "").toLocaleLowerCase("tr-TR");
}

// En çok ilgi isteyen en üstte: tamamlama oranı artan. Ödevi hiç olmayan (null) en sonda — "hiç ödevi
// yok" ile "başarısız" aynı şey değil. Eşitlikte önce gecikeni çok olan, sonra ada göre.
function compareStudents(a, b) {
  const ar = a.completionRate, br = b.completionRate;
  if (ar == null && br != null) return 1;
  if (br == null && ar != null) return -1;
  if (ar != null && br != null && ar !== br) return ar - br;
  const od = (b.overdueCount || 0) - (a.overdueCount || 0);
  if (od !== 0) return od;
  return (a.name || "").localeCompare(b.name || "", "tr");
}

// Arama alanı — başında büyüteç ikonu. Input bileşeni etiket/alt boşluk taşıdığı için burada sade
// bir <input> (k-field: odakta mor çerçeve).
function SearchField({ value, onChange }) {
  return (
    <div style={{ position: "relative", marginBottom: 12 }}>
      <Search size={17} color={C.mutedLight} strokeWidth={2.2} aria-hidden="true" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
      <input
        type="search"
        enterKeyHint="search"
        className="k-field"
        aria-label="Ad veya okul numarasıyla öğrenci ara"
        placeholder="Öğrenci ara"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%", boxSizing: "border-box", height: 46, padding: "0 14px 0 40px",
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: C.radiusMd, boxShadow: C.shadowSm,
          fontFamily: bodyFont, fontSize: 15, fontWeight: 500, color: C.text, outline: "none",
        }}
      />
    </div>
  );
}

// Öğrenci satırı (72px): avatar 42, ad + "11-A · 11. Sınıf" (+ geciken sayısı), sağda tamamlama
// yüzdesi ve 54px ilerleme çubuğu eşik renginde. Eskiden sınıf ve sınıf düzeyi iki ayrı rozetti —
// aynı bilgiyi veriyorlardı, tek metne indi.
function StudentRow({ s, onOpen }) {
  // Düzeyi eksik/eski (11-12 dışı) olan öğrenci ödev listelerinde görünmüyor — admin düzeltmeli,
  // bu yüzden kırmızı.
  const gradeOk = GRADE_LEVELS.includes(s.gradeLevel);
  const tone = completionTone(s.completionRate);
  return (
    <Card hover={!!onOpen} onClick={onOpen ? () => onOpen(s.id, s.name) : undefined} style={{ padding: 0, cursor: onOpen ? "pointer" : "default" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 72, padding: "0 13px 0 14px" }}>
        <Avatar name={s.name} size={42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ fontFamily: bodyFont, fontSize: 14.5, fontWeight: 700, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{s.name}</span>
            {s.banned && <Pill tone="red">Askıda</Pill>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, minWidth: 0, fontFamily: bodyFont, fontSize: 11.5 }}>
            <span style={{ fontWeight: 500, color: C.mutedLight, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
              {s.className ? `${s.className} · ` : ""}
              <span style={gradeOk ? undefined : { color: C.red, fontWeight: 700 }}>{gradeLabel(s.gradeLevel)}</span>
            </span>
            {s.overdueCount > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700, color: C.red, whiteSpace: "nowrap", flexShrink: 0 }}>
                <AlertTriangle size={12} strokeWidth={2.4} aria-hidden="true" />
                <span><span style={{ fontFamily: monoFont }}>{s.overdueCount}</span> geciken</span>
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
          <span style={{ fontFamily: monoFont, fontSize: 16, fontWeight: 700, color: tone.fg, lineHeight: 1 }}>
            {s.completionRate != null ? `%${s.completionRate}` : "—"}
          </span>
          <ProgressBar value={s.completionRate} color={tone.fg} width={54} height={5} />
        </div>
        {onOpen && <ChevronRight size={15} color={C.faintest} style={{ flexShrink: 0 }} />}
      </div>
    </Card>
  );
}

export default function TeacherStudentsScreen({ onOpen }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    api.teacherListStudents().then(({ students }) => setStudents(students)).catch((e) => setLoadError(e.message || "Öğrenci listesi yüklenemedi")).finally(() => setLoading(false));
  }, []);

  // Özet şeridi filtreden/aramadan bağımsız: koçun tüm öğrencileri için geçerli bir uyarı.
  const overdueStudentCount = useMemo(() => students.filter((s) => s.overdueCount > 0).length, [students]);

  const visibleStudents = useMemo(() => {
    const q = lower(query.trim());
    return students
      .filter((s) => {
        if (filter === "overdue" && !(s.overdueCount > 0)) return false;
        if ((filter === "11" || filter === "12") && s.gradeLevel !== Number(filter)) return false;
        if (q && !lower(s.name).includes(q) && !lower(s.username).includes(q)) return false;
        return true;
      })
      .sort(compareStudents);
  }, [students, query, filter]);

  return (
    <div className="k-page" style={{ padding: 28, maxWidth: 760, margin: "0 auto" }}>
      <PushPermissionBanner reason="Öğrencilerinin geciken ödev özetlerini kaçırmamak için." />
      {loading ? (
        <LoadingState />
      ) : loadError ? (
        <EmptyState text={loadError} />
      ) : students.length === 0 ? (
        <EmptyState text="Henüz sana atanmış bir öğrenci yok — okul yöneticinden öğrenci ataması istemen gerekebilir." />
      ) : (
        <>
          <SearchField value={query} onChange={setQuery} />
          <div className="k-chip-row" role="group" aria-label="Öğrenci filtresi" style={{ marginBottom: 14, paddingBottom: 2 }}>
            {FILTERS.map((f) => (
              <Chip key={f.value} active={filter === f.value} onClick={() => setFilter(f.value)}>{f.label}</Chip>
            ))}
          </div>

          {overdueStudentCount > 0 && (
            <div role="status" style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 13, background: C.redSoft, color: C.red, marginBottom: 14, fontFamily: bodyFont, fontSize: 12.5, fontWeight: 600 }}>
              <AlertTriangle size={16} strokeWidth={2.3} aria-hidden="true" style={{ flexShrink: 0 }} />
              <span><span style={{ fontFamily: monoFont, fontWeight: 700 }}>{overdueStudentCount}</span> öğrencinin geciken ödevi var</span>
            </div>
          )}

          {visibleStudents.length === 0 ? (
            <EmptyState
              icon={query.trim() ? Search : undefined}
              text={query.trim() ? "Aramana uyan öğrenci yok." : filter === "overdue" ? "Geciken ödevi olan öğrenci yok." : "Bu sınıf düzeyinde öğrencin yok."}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {visibleStudents.map((s) => <StudentRow key={s.id} s={s} onOpen={onOpen} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
