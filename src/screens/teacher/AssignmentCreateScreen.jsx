import { useEffect, useMemo, useRef, useState } from "react";
import { C, bodyFont, displayFont, monoFont } from "../../theme.js";
import { Card, Button, Input, Select, Avatar, EmptyState } from "../../components/common.jsx";
import { api } from "../../api.js";
import { SUBJECTS_BY_EXAM, PERIOD_LABELS, trackForGrade } from "../../subjects.js";
import { todayISO } from "../../dates.js";
import TopicField from "../../components/TopicField.jsx";

// Gönderim modunun KISA etiketleri — iki sütunlu ızgarada ~150px'lik alana "Otomatik — tarihi gelince
// gönder" sığmıyordu; alanın "Gönderim" etiketi bağlamı zaten veriyor. Değerler sunucuyla aynı.
const SEND_MODE_OPTIONS = [
  { value: "MANUAL_NOW", label: "Hemen" },
  { value: "AUTO_ON_DATE", label: "Tarihi gelince" },
  { value: "AUTO_DAY_BEFORE", label: "Bir gün önce" },
];

// İki sütunlu alan ızgarası; sütun asgari 140px — ~360px'ten dar ekranlarda (tarih alanı sığmıyor) medya
// sorgusuna gerek kalmadan tek sütuna düşer, geniş ekranda da hiçbir zaman 3 sütuna çıkmaz (her sütun en
// az yarı genişlik). Negatif alt boşluk, son satırdaki alanların kendi 16px alt boşluğunu kartın iç
// boşluğuyla çakışmasın diye geri alır.
const FIELD_GRID = {
  display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(max(140px, calc((100% - 12px) / 2)), 1fr))",
  columnGap: 12, marginBottom: -16,
};

// Kart başlığı: 24×24 mor kutuda sıra numarası + başlık + alt açıklama — uzun tek form "Kime / Ne /
// Ne zaman" diye üç gruba bölündü, koç hangi adımda olduğunu görsün diye.
function GroupHeader({ n, id, title, subtitle }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
      <span aria-hidden="true" style={{
        width: 24, height: 24, borderRadius: 8, flexShrink: 0, marginTop: 1,
        background: C.accentSoft, color: C.accent, fontFamily: monoFont, fontSize: 12.5, fontWeight: 700,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>{n}</span>
      <div style={{ minWidth: 0 }}>
        <h2 id={id} style={{ margin: 0, fontFamily: displayFont, fontSize: 14.5, fontWeight: 700, letterSpacing: -0.1, color: C.text, lineHeight: 1.3 }}>{title}</h2>
        {subtitle && <div style={{ fontFamily: bodyFont, fontSize: 11.5, fontWeight: 500, color: C.mutedLight, marginTop: 2 }}>{subtitle}</div>}
      </div>
    </div>
  );
}

// İki seçenekli bölümlü düğme (TYT/AYT, sınav grubu) — aktif mor dolu, pasif alan zemini.
function Segmented({ value, onChange, options, label }) {
  return (
    <div role="group" aria-label={label} style={{ display: "flex", gap: 8, marginBottom: 14 }}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className="k-btn"
            style={{
              flex: 1, minWidth: 0, height: 40, borderRadius: 12, cursor: "pointer",
              border: `1px solid ${active ? C.accent : C.border}`,
              background: active ? C.accent : C.fieldBg,
              color: active ? C.onAccent : C.muted, fontFamily: bodyFont, fontWeight: 700, fontSize: 14,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// Özet satırındaki kısa tarih aralığı: "26 Eylül", "26–28 Eylül", "30 Eylül – 2 Ekim"; yıl yalnızca bu
// yıl değilse eklenir. Tarih alanı boşaltılmışsa (geçersiz) boş döner.
function shortDateRange(start, end) {
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end || start}T00:00:00`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "";
  const thisYear = new Date().getFullYear();
  const month = (d) => d.toLocaleDateString("tr-TR", { month: "long" });
  const year = (d) => (d.getFullYear() !== thisYear ? ` ${d.getFullYear()}` : "");
  if (s.getTime() === e.getTime()) return `${s.getDate()} ${month(s)}${year(s)}`;
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) return `${s.getDate()}–${e.getDate()} ${month(e)}${year(e)}`;
  if (s.getFullYear() === e.getFullYear()) return `${s.getDate()} ${month(s)} – ${e.getDate()} ${month(e)}${year(e)}`;
  return `${s.getDate()} ${month(s)}${year(s)} – ${e.getDate()} ${month(e)}${year(e)}`;
}

export default function AssignmentCreateScreen({ onCreated, initialStudentId, prefill }) {
  const [students, setStudents] = useState([]);
  const [manualTrack, setManualTrack] = useState(null); // roster karma sınav türlerinden oluşuyorsa koçun elle seçtiği
  const [checkedIds, setCheckedIds] = useState(() => new Set());
  // Rapordaki kısayoldan açıldıysa ders ve konu dolu gelir (kaydetmez — kullanıcı onaylar).
  const [examType, setExamType] = useState(() => (SUBJECTS_BY_EXAM[prefill?.examType] ? prefill.examType : "TYT"));
  const [subject, setSubject] = useState(() => {
    const ex = SUBJECTS_BY_EXAM[prefill?.examType] ? prefill.examType : "TYT";
    return SUBJECTS_BY_EXAM[ex].includes(prefill?.subject) ? prefill.subject : SUBJECTS_BY_EXAM[ex][0];
  });
  const [topic, setTopic] = useState(() => prefill?.topic || "");
  const [sourceBook, setSourceBook] = useState("");
  const [sourceBooks, setSourceBooks] = useState([]);
  const [pageRange, setPageRange] = useState("");
  const [scheduledDate, setScheduledDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(todayISO());
  const [endDateTouched, setEndDateTouched] = useState(false);
  const [period, setPeriod] = useState("WEEKLY");
  const [sendMode, setSendMode] = useState("MANUAL_NOW");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const [rosterError, setRosterError] = useState("");
  useEffect(() => {
    api.teacherListStudents().then(({ students }) => setStudents(students)).catch((e) => setRosterError(e.message || "Öğrenci listesi yüklenemedi"));
  }, []);
  useEffect(() => { api.listSourceBooks(examType).then(({ sourceBooks }) => setSourceBooks(sourceBooks)).catch(() => {}); }, [examType]);

  const activeStudents = useMemo(() => students.filter((s) => !s.banned).map((s) => ({ ...s, track: trackForGrade(s.gradeLevel) })), [students]);
  const tracksPresent = useMemo(() => [...new Set(activeStudents.map((s) => s.track).filter(Boolean))], [activeStudents]);

  useEffect(() => {
    if (tracksPresent.length && !tracksPresent.includes(manualTrack)) setManualTrack(tracksPresent[0]);
  }, [tracksPresent.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // Roster boşsa (kimse sınıf düzeyi girilmemiş) YKS'ye düşülür — form kilitlenmesin diye.
  const effectiveTrack = tracksPresent.length === 1 ? tracksPresent[0] : tracksPresent.length > 1 ? manualTrack : "YKS";
  const gradeMissingCount = activeStudents.filter((s) => !s.track).length;

  // Yalnızca seçilen sınav türüyle uyumlu öğrenciler tikletilebilir — böylece işaretlenen HERKES
  // gerçekten o ödevi alır, sunucuda "bazıları uyumsuz" gibi sürpriz bir filtrelemeye gerek kalmaz.
  const eligibleStudents = useMemo(() => activeStudents.filter((s) => s.track === effectiveTrack), [activeStudents, effectiveTrack]);
  const eligibleIdsKey = eligibleStudents.map((s) => s.id).join(",");

  // Uygun öğrenci havuzu İLK KEZ görüldüğünde (roster yüklendi, ya da yeni bir öğrenci roster'a
  // eklendi) varsayılan olarak tiklenir. Daha önce de eligible olan bir öğrencinin tik durumu
  // KORUNUR — aksi halde (karma sınav gruplu bir roster'da) "Sınav Grubu" arasında ileri geri geçmek, koçun
  // az önce kaldırdığı tikleri sessizce geri koyup o öğrencilere de ödev gönderirdi.
  const seenEligibleIdsRef = useRef(new Set());
  useEffect(() => {
    const prevSeen = seenEligibleIdsRef.current;
    const nextEligible = new Set(eligibleStudents.map((s) => s.id));
    setCheckedIds((prevChecked) => {
      const next = new Set();
      for (const id of nextEligible) {
        if (prevSeen.has(id)) { if (prevChecked.has(id)) next.add(id); }
        else next.add(id);
      }
      return next;
    });
    seenEligibleIdsRef.current = nextEligible;
  }, [eligibleIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Öğrenci Özeti ekranındaki "Yeni Ödev Ata" hızlı eylemiyle açıldıysa (initialStudentId dolu) yukarıdaki
  // "tüm uygun öğrenciler tikli" varsayılanını GEÇERSİZ KILIP yalnızca bu öğrenciyi tikler. Hedef öğrencinin
  // sınav grubu farklıysa önce ona geçilir (checkedIds daraltması bir SONRAKİ render'da, eligibleStudents o
  // gruba göre yeniden hesaplanınca uygulanır) — bu yüzden bayrak yalnızca hedef gerçekten eligible listede
  // görününce "uygulandı" sayılır, tek seferlik zorlamayı erken bitirip koçun sonraki tik değişikliklerini
  // ezmemek için.
  const initialStudentAppliedRef = useRef(false);
  useEffect(() => {
    if (!initialStudentId || initialStudentAppliedRef.current) return;
    const target = activeStudents.find((s) => s.id === initialStudentId);
    if (!target || !target.track) return;
    if (target.track !== effectiveTrack) {
      if (tracksPresent.length > 1) setManualTrack(target.track);
      return;
    }
    if (!eligibleStudents.some((s) => s.id === initialStudentId)) return;
    initialStudentAppliedRef.current = true;
    setCheckedIds(new Set([initialStudentId]));
  }, [initialStudentId, activeStudents, effectiveTrack, tracksPresent, eligibleStudents]); // eslint-disable-line react-hooks/exhaustive-deps

  const subjectOptions = useMemo(() => SUBJECTS_BY_EXAM[examType], [examType]);
  useEffect(() => {
    if (!subjectOptions.includes(subject)) setSubject(subjectOptions[0]);
  }, [subjectOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  // Avatar çiplerinde yalnızca ilk ad yazılır; aynı ilk ada sahip iki öğrenci karışmasın diye onlarda
  // soyadının baş harfi eklenir ("Ahmet Y."). Tam ad çipin title/aria-label'ında.
  const chipLabels = useMemo(() => {
    const partsOf = (name) => (name || "").trim().split(/\s+/).filter(Boolean);
    const firstCounts = new Map();
    for (const s of eligibleStudents) {
      const first = partsOf(s.name)[0] || "";
      firstCounts.set(first, (firstCounts.get(first) || 0) + 1);
    }
    return new Map(eligibleStudents.map((s) => {
      const parts = partsOf(s.name);
      const first = parts[0] || s.name || "?";
      const label = firstCounts.get(first) > 1 && parts.length > 1 ? `${first} ${parts[parts.length - 1][0]}.` : first;
      return [s.id, label];
    }));
  }, [eligibleStudents]);

  const toggleStudent = (id) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAll = () => setCheckedIds(new Set(eligibleStudents.map((s) => s.id)));
  const selectNone = () => setCheckedIds(new Set());

  const onStartDateChange = (v) => {
    setScheduledDate(v);
    if (!endDateTouched || endDate < v) setEndDate(v);
  };
  const onEndDateChange = (v) => { setEndDate(v); setEndDateTouched(true); };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (checkedIds.size === 0) { setError("En az bir öğrenci seçmelisin"); return; }
    if (!topic.trim()) { setError("Müfredat konusu gerekli"); return; }
    // HTML'in date input'undaki min= özelliği bazı mobil klavye/tarih seçicilerde elle girişte
    // katı uygulanmayabilir — sunucuya gitmeden önce burada da açıkça doğrulanır.
    if (endDate < scheduledDate) { setError("Bitiş tarihi başlangıç tarihinden önce olamaz"); return; }
    setSaving(true);
    try {
      const { assignment } = await api.createAssignment({
        studentIds: [...checkedIds],
        examType, subject, topic: topic.trim(),
        sourceBook: sourceBook.trim() || undefined, pageRange: pageRange.trim() || undefined,
        period, scheduledDate, endDate, sendMode,
      });
      setSuccess(assignment.status === "SENT" ? "Ödev oluşturuldu ve gönderildi." : "Ödev taslak olarak takvime kaydedildi.");
      setTopic("");
      setSourceBook("");
      setPageRange("");
      setScheduledDate(todayISO());
      setEndDate(todayISO());
      setEndDateTouched(false);
      if (onCreated) onCreated(assignment);
    } catch (err) {
      setError(err.message || "Ödev kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  if (rosterError) return <EmptyState text={rosterError} />;

  // Alttaki sabit düğmenin ne atayacağını özetler — uzun formda "ne seçmiştim?" sorusu için.
  const summary = [subject, shortDateRange(scheduledDate, endDate), (PERIOD_LABELS[period] || "").toLocaleLowerCase("tr-TR")].filter(Boolean).join(" · ");

  return (
    <div className="k-page k-page-form" style={{ padding: 28, maxWidth: 580, margin: "0 auto" }}>
      <form onSubmit={submit}>
        <Card style={{ padding: 16, marginBottom: 12 }}>
          <section aria-labelledby="create-group-who">
            <GroupHeader
              n={1} id="create-group-who" title="Kime"
              subtitle={<><span style={{ fontFamily: monoFont }}>{checkedIds.size}</span> öğrenci seçili</>}
            />

            {tracksPresent.length > 1 && (
              <>
                <div style={{ fontFamily: bodyFont, fontSize: 12.5, fontWeight: 600, color: C.muted, marginBottom: 7 }}>Sınav grubu</div>
                <Segmented
                  label="Sınav grubu"
                  value={manualTrack}
                  onChange={setManualTrack}
                  options={tracksPresent.map((t) => ({ value: t, label: `${t} (${activeStudents.filter((s) => s.track === t).length})` }))}
                />
              </>
            )}

            <Segmented label="Sınav türü" value={examType} onChange={setExamType} options={[{ value: "TYT", label: "TYT" }, { value: "AYT", label: "AYT" }]} />

            {eligibleStudents.length === 0 ? (
              <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.red }}>
                Sınıf düzeyi girilmiş (11 veya 12. sınıf) bir öğrencin yok.
              </div>
            ) : (
              <>
                {/* Onay kutulu satır listesi yerine avatar çipleri — 6 satırlık liste ~300px yer kaplıyordu. */}
                <div role="group" aria-label="Öğrenciler" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {eligibleStudents.map((s) => {
                    const checked = checkedIds.has(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleStudent(s.id)}
                        aria-pressed={checked}
                        aria-label={s.className ? `${s.name}, ${s.className}` : s.name}
                        title={s.name}
                        className="k-btn"
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 7, height: 36, boxSizing: "border-box",
                          padding: "0 11px 0 4px", borderRadius: 18, cursor: "pointer", maxWidth: "100%",
                          background: checked ? C.accentSoft : C.fieldBg, border: `1px solid ${checked ? C.accent : C.border}`,
                          color: checked ? C.accent : C.muted, fontFamily: bodyFont, fontSize: 12.5, fontWeight: checked ? 700 : 600,
                        }}
                      >
                        <Avatar name={s.name} size={28} />
                        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{chipLabels.get(s.id)}</span>
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12 }}>
                  <button type="button" onClick={selectAll} className="k-link-btn" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: bodyFont, fontSize: 12.5, fontWeight: 700, color: C.accent }}>
                    Tümünü seç
                  </button>
                  <button type="button" onClick={selectNone} className="k-link-btn" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: bodyFont, fontSize: 12.5, fontWeight: 600, color: C.muted }}>
                    Hiçbirini seçme
                  </button>
                </div>
              </>
            )}
            {gradeMissingCount > 0 && (
              <div style={{ fontFamily: bodyFont, fontSize: 11.5, color: C.amber, marginTop: 12, lineHeight: 1.45 }}>
                {gradeMissingCount} öğrencinin sınıf düzeyi girilmemiş ya da güncel değil, listede görünmüyor (yönetici Kullanıcılar sayfasından 11/12 olarak girebilir).
              </div>
            )}
          </section>
        </Card>

        <Card style={{ padding: 16, marginBottom: 12 }}>
          <section aria-labelledby="create-group-what">
            <GroupHeader n={2} id="create-group-what" title="Ne" subtitle="ders ve konu" />
            <div style={FIELD_GRID}>
              <Select label="Ders" value={subject} onChange={(e) => setSubject(e.target.value)}>
                {subjectOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
              {/* TopicField "listede yok" seçilince altına bir metin alanı daha ekliyor — ikisi aynı hücrede kalsın diye sarılı. */}
              <div style={{ minWidth: 0 }}>
                <TopicField label="Konu" examType={examType} subject={subject} value={topic} onChange={setTopic} placeholder="ör. Temel kavramlar" required />
              </div>
              <Input label="Kaynak kitap" list="source-book-suggestions" value={sourceBook} onChange={(e) => setSourceBook(e.target.value)} placeholder="opsiyonel" />
              <Input label="Sayfa / soru" value={pageRange} onChange={(e) => setPageRange(e.target.value)} placeholder="ör. 45-60" />
            </div>
            <datalist id="source-book-suggestions">
              {sourceBooks.map((b) => <option key={b} value={b} />)}
            </datalist>
          </section>
        </Card>

        <Card style={{ padding: 16 }}>
          <section aria-labelledby="create-group-when">
            <GroupHeader n={3} id="create-group-when" title="Ne zaman" subtitle="tek gün için ikisini aynı bırak" />
            <div style={FIELD_GRID}>
              <Input label="Başlangıç" type="date" value={scheduledDate} onChange={(e) => onStartDateChange(e.target.value)} required />
              <Input label="Bitiş" type="date" value={endDate} min={scheduledDate} onChange={(e) => onEndDateChange(e.target.value)} required />
              <Select label="Periyot" value={period} onChange={(e) => setPeriod(e.target.value)}>
                {Object.entries(PERIOD_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
              <Select label="Gönderim" value={sendMode} onChange={(e) => setSendMode(e.target.value)}>
                {SEND_MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </div>
          </section>
        </Card>

        {/* Alta sabit aksiyon: telefonda alt menünün hemen üstünde, masaüstünde sayfanın altına yapışık
            (bkz. index.html > .k-sticky-action). Akış içinde (position: sticky) kaldığı için kaydırma
            sonunda son kartın altına oturur, kartı örtmez. */}
        <div className="k-sticky-action" style={{ background: C.surface, borderTop: `1px solid ${C.border}`, padding: "12px 16px 14px", marginTop: 16 }}>
          {error && <div role="alert" style={{ color: C.red, fontFamily: bodyFont, fontSize: 12.5, fontWeight: 600, textAlign: "center", marginBottom: 10 }}>{error}</div>}
          {success && <div role="status" style={{ color: C.green, fontFamily: bodyFont, fontSize: 12.5, fontWeight: 600, textAlign: "center", marginBottom: 10 }}>{success}</div>}
          <Button full type="submit" disabled={saving || checkedIds.size === 0}>
            {saving ? "Kaydediliyor..." : sendMode === "MANUAL_NOW" ? `${checkedIds.size} öğrenciye ata` : "Takvime kaydet"}
          </Button>
          {summary && (
            <div style={{ fontFamily: bodyFont, fontSize: 11.5, fontWeight: 500, color: C.mutedLight, textAlign: "center", marginTop: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {summary}
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
