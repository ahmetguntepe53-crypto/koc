import { useEffect, useMemo, useState } from "react";
import { Trash2, BookOpen, Plus, ChevronLeft } from "lucide-react";
import { C, displayFont, bodyFont, formatNet } from "../../theme.js";
import { EmptyState, LoadingState, confirmDialog, alertDialog, HeaderIconButton } from "../../components/common.jsx";
import { HeroHeader, HeroBell, HeroStat, SectionCard, SegmentFilter, StatusChip, FieldLabel, fieldBox, TopicSelect, PrimaryButton, NUM } from "../../components/brand.jsx";
import { api } from "../../api.js";
import { SUBJECTS_BY_EXAM, trackForGrade } from "../../subjects.js";
import { todayISO } from "../../dates.js";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
}

function parseQuestionNumbers(text) {
  return text.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isInteger(n) && n > 0);
}

export default function StudyLogScreen({ user, prefill, onBack, unreadCount, onOpenNotifications }) {
  // Okul yalnızca YKS (TYT/AYT) hazırlığı yapıyor — sınıf düzeyi girilmemişse de TYT/AYT gösterilir.
  const track = trackForGrade(user?.gradeLevel);

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  // Rapordaki kısayoldan açıldıysa ders ve konu dolu gelir (kaydetmez — kullanıcı onaylar).
  const [examType, setExamType] = useState(() => (SUBJECTS_BY_EXAM[prefill?.examType] ? prefill.examType : "TYT"));
  const [subject, setSubject] = useState(() => {
    const ex = SUBJECTS_BY_EXAM[prefill?.examType] ? prefill.examType : "TYT";
    return SUBJECTS_BY_EXAM[ex].includes(prefill?.subject) ? prefill.subject : SUBJECTS_BY_EXAM[ex][0];
  });
  const [topic, setTopic] = useState(() => prefill?.topic || "");
  const [sourceBook, setSourceBook] = useState("");
  const [pageRange, setPageRange] = useState("");
  const [correctCount, setCorrectCount] = useState("");
  const [wrongCount, setWrongCount] = useState("");
  const [blankCount, setBlankCount] = useState("");
  const [note, setNote] = useState("");
  const [questionNumbers, setQuestionNumbers] = useState("");
  const [studyDate, setStudyDate] = useState(todayISO());
  const [moreOpen, setMoreOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const subjectOptions = useMemo(() => SUBJECTS_BY_EXAM[examType], [examType]);
  useEffect(() => { if (!subjectOptions.includes(subject)) setSubject(subjectOptions[0]); }, [subjectOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  const [loadError, setLoadError] = useState("");
  const load = () => {
    setLoading(true);
    // Önceki başarısız yüklemenin hatası temizlenmezse, sonraki başarılı yüklemede liste yerine hâlâ
    // hata metni görünüyordu.
    setLoadError("");
    api.listStudySessions().then(({ sessions }) => setSessions(sessions)).catch((e) => setLoadError(e.message || "Kayıtlar yüklenemedi")).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const payload = {
      examType, subject, topic: topic.trim(),
      sourceBook: sourceBook.trim() || undefined, pageRange: pageRange.trim() || undefined,
      correctCount: parseInt(correctCount, 10), wrongCount: parseInt(wrongCount, 10), blankCount: parseInt(blankCount, 10),
      note: note.trim() || undefined, questionNumbers: parseQuestionNumbers(questionNumbers), studyDate,
    };
    if (!payload.topic) { setError("Konu gerekli"); return; }
    if (![payload.correctCount, payload.wrongCount, payload.blankCount].every((n) => Number.isInteger(n) && n >= 0)) {
      setError("Doğru/Yanlış/Boş sayılarını gir");
      return;
    }
    setSaving(true);
    try {
      await api.createStudySession(payload);
      setTopic(""); setSourceBook(""); setPageRange(""); setCorrectCount(""); setWrongCount(""); setBlankCount(""); setNote(""); setQuestionNumbers("");
      load();
    } catch (err) {
      setError(err.message || "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!(await confirmDialog({ title: "Kayıt silinsin mi?", message: "Bu serbest çalışma kaydı raporlarından da kaldırılacak.", confirmLabel: "Sil", danger: true }))) return;
    try {
      await api.deleteStudySession(id);
    } catch (e) {
      alertDialog({ title: "Silinemedi", message: e.message || "Kayıt silinemedi, lütfen tekrar dene." });
    }
    load();
  };

  const weekFrom = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); })();
  const weekSessions = sessions.filter((x) => new Date(x.studyDate).getTime() >= weekFrom);
  const weekQ = weekSessions.reduce((n, x) => n + x.correctCount + x.wrongCount + x.blankCount, 0);
  const weekNet = weekSessions.reduce((n, x) => n + x.correctCount - x.wrongCount / 4, 0);
  const num = (id, label, value, set) => (
    <div style={{ minWidth: 0 }}>
      <FieldLabel htmlFor={id} required>{label}</FieldLabel>
      <input id={id} type="number" inputMode="numeric" pattern="[0-9]*" min="0" value={value} onChange={(e) => set(e.target.value)} required style={{ ...fieldBox(false), cursor: "text", textAlign: "center", ...NUM }} />
    </div>
  );

  return (
    <div>
      <HeroHeader compact>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {onBack && <HeaderIconButton onBrand icon={ChevronLeft} label="Geri" onClick={onBack} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.onBrandMuted }}>Ödev dışı kendi çalışmaların</div>
            <h1 style={{ margin: 0, fontFamily: displayFont, fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", color: C.onBrand }}>Çalışmam</h1>
          </div>
          <HeroBell unreadCount={unreadCount} onClick={onOpenNotifications} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 18 }}>
          <HeroStat lime label="kayıt bu hafta" value={weekSessions.length} />
          <HeroStat label="soru" value={weekQ} />
          <HeroStat label="net" value={weekSessions.length ? formatNet(weekNet, 1) : "—"} />
        </div>
      </HeroHeader>

      <div style={{ maxWidth: 580, margin: "0 auto", padding: "16px 16px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
        <SectionCard
          icon={Plus} iconBg={C.brand} iconFg={C.onBrand} title="Yeni kayıt"
          right={<SegmentFilter small label="Sınav türü" value={examType} onChange={setExamType} options={[{ id: "TYT", label: "TYT" }, { id: "AYT", label: "AYT" }]} style={{ width: 120, flexShrink: 0, background: C.pageTint }} />}
        >
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
            {!track && (
              <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.warningText }}>Sınıf düzeyin henüz girilmemiş, varsayılan olarak TYT/AYT gösteriliyor.</div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <FieldLabel htmlFor="s-subject">Ders</FieldLabel>
                <select id="s-subject" value={subject} onChange={(e) => setSubject(e.target.value)} style={fieldBox(false)}>
                  {subjectOptions.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
              <div style={{ minWidth: 0 }}>
                <FieldLabel htmlFor="s-topic" required>Konu</FieldLabel>
                <TopicSelect id="s-topic" examType={examType} subject={subject} value={topic} onChange={setTopic} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
              {num("s-d", "Doğru", correctCount, setCorrectCount)}
              {num("s-y", "Yanlış", wrongCount, setWrongCount)}
              {num("s-b", "Boş", blankCount, setBlankCount)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <FieldLabel htmlFor="s-date" required>Ne zaman?</FieldLabel>
                <input id="s-date" type="date" value={studyDate} onChange={(e) => setStudyDate(e.target.value)} required style={{ ...fieldBox(false), cursor: "text" }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <FieldLabel htmlFor="s-book">Kaynak kitap</FieldLabel>
                <input id="s-book" value={sourceBook} onChange={(e) => setSourceBook(e.target.value)} placeholder="isteğe bağlı" style={{ ...fieldBox(false), cursor: "text" }} />
              </div>
            </div>
            <button type="button" onClick={() => setMoreOpen((v) => !v)} style={{ alignSelf: "flex-start", minHeight: 44, padding: "0 2px", background: "none", border: "none", cursor: "pointer", fontFamily: bodyFont, fontSize: 13, fontWeight: 700, color: C.brandText }}>
              {moreOpen ? "Ek alanları gizle" : "Sayfa aralığı ve yanlış soru numaraları ekle"}
            </button>
            {moreOpen && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <FieldLabel htmlFor="s-range">Sayfa / soru aralığı</FieldLabel>
                  <input id="s-range" value={pageRange} onChange={(e) => setPageRange(e.target.value)} placeholder="ör. 20-30" style={{ ...fieldBox(false), cursor: "text" }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <FieldLabel htmlFor="s-nums">Yanlış/boş soru no.</FieldLabel>
                  <input id="s-nums" value={questionNumbers} onChange={(e) => setQuestionNumbers(e.target.value)} placeholder="ör. 4, 9" style={{ ...fieldBox(false), cursor: "text" }} />
                </div>
              </div>
            )}
            {error && <div role="alert" style={{ color: C.danger, fontFamily: bodyFont, fontSize: 13, fontWeight: 600 }}>{error}</div>}
            <PrimaryButton type="submit" inactive={saving}>{saving ? "Kaydediliyor..." : "Kaydet"}</PrimaryButton>
          </form>
        </SectionCard>

        <SectionCard icon={BookOpen} iconBg={C.successTint} iconFg={C.successText} title="Geçmiş kayıtlarım" count={loading || loadError ? null : sessions.length}>
          {loading ? (
            <div style={{ marginTop: 12 }}><LoadingState /></div>
          ) : loadError ? (
            <div style={{ marginTop: 12 }}><EmptyState compact text={loadError} /></div>
          ) : sessions.length === 0 ? (
            <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.inkMuted, marginTop: 10, lineHeight: 1.5 }}>Henüz serbest çalışma kaydın yok. Ödev dışında çözdüğün testleri yukarıdan ekleyebilirsin.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              {sessions.map((x) => (
                <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 6px 10px 12px", borderRadius: 16, background: C.pageTint }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: bodyFont, fontSize: 12, fontWeight: 600, color: C.brandText }}>{x.subject}</span>
                      <StatusChip tone="brand">{x.examType}</StatusChip>
                    </div>
                    <div style={{ fontFamily: bodyFont, fontSize: 15, fontWeight: 700, color: C.inkText, marginTop: 1, overflowWrap: "anywhere" }}>{x.topic}</div>
                    <div style={{ ...NUM, fontSize: 12, color: C.inkMuted, marginTop: 3 }}>
                      {formatDate(x.studyDate)} · {x.correctCount} doğru · {x.wrongCount} yanlış · {x.blankCount} boş
                    </div>
                  </div>
                  <button className="k-icon-btn" onClick={() => remove(x.id)} aria-label={`${x.subject} — ${x.topic} kaydını sil`} style={{ width: 44, height: 44, borderRadius: 12, border: "none", background: "transparent", color: C.inkMuted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Trash2 size={17} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
