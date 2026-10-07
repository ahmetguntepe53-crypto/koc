import { useMemo, useState } from "react";
import { Users, ClipboardList, BookOpen, TrendingUp, Layers, ChevronLeft, ChevronRight, PenLine } from "lucide-react";
import { C, bodyFont, displayFont } from "../../theme.js";
import { Avatar, EmptyState, LoadingState } from "../../components/common.jsx";
import { HeroStat, SectionCard, SegmentFilter, StatusChip, NUM } from "../../components/brand.jsx";
import { api } from "../../api.js";
import { lastSeenInfo } from "../../work.js";
import { Hero, Body, PeriodFilter, usePeriod, useLoad, Meter, MetricRow, pct } from "./PrincipalScreens.jsx";
import AdminActivity from "../admin/AdminActivity.jsx";
import AdminAnalytics from "../admin/AdminAnalytics.jsx";

// Müdür > İstatistik (KULLANICI İSTEĞİ 2026-10-06): okul, sınıf düzeyi, şube, ders ve öğrenci istatistikleri; yöneticinin
// Aktivite ve Okul analizi ekranları da burada. Veri: GET /api/principal/stats (+ /students, /activity, /analytics).
// Tanımlar (bkz. server/src/principalAgg.js): tamamlama = sorumlu olunan ödevlerin tamamlanan yüzdesi; başarı = net / soru;
// gecikti = süresi dolmuş, sonucu girilmemiş, pas geçilmemiş.

const SECTIONS = [
  { id: "school", label: "Okul" },
  { id: "classes", label: "Sınıflar" },
  { id: "subjects", label: "Dersler" },
  { id: "activity", label: "Aktivite" },
  { id: "analysis", label: "Analiz" },
];
const SKIP_LABELS = { KONU: "Konuyu bilmiyorum", ZAMAN: "Zaman yetmedi", KAYNAK: "Kaynağım yok", DIGER: "Diğer" };
const fmt = (n) => (n == null ? "—" : Number(n).toLocaleString("tr-TR"));
const fmtNet = (n) => (n == null ? "—" : Number(n).toLocaleString("tr-TR", { maximumFractionDigits: 2 }));
const gradeName = (g) => (g == null ? "Sınıfı girilmemiş" : `${g}. sınıf`);
const weekLabel = (iso) => { const [, m, d] = iso.split("-"); return `${Number(d)}.${Number(m)}`; };

// Öğrenci profiline gidip dönünce aynı bölüm ve şube açık kalsın (ekran her geçişte yeniden kurulur).
const memo = { section: "school", className: null };

export function PrincipalStatsScreen({ user, unreadCount, onOpenNotifications, onOpenStudent }) {
  const [section, setSectionState] = useState(memo.section);
  const [className, setClassNameState] = useState(memo.className);
  const setSection = (v) => { memo.section = v; memo.className = null; setSectionState(v); setClassNameState(null); };
  const setClassName = (v) => { memo.className = v; setClassNameState(v); };
  const [period, setPeriod] = usePeriod();
  const usesStats = ["school", "classes", "subjects"].includes(section);
  // Üstteki üç özet her bölümde görünsün diye istatistik her zaman yüklenir (Aktivite/Analiz kendi verisini ayrıca çeker).
  const [data, error] = useLoad(() => api.principalStats(period), [period]);
  const s = data?.school;

  return (
    <div>
      <Hero
        subtitle={[user?.name, "Okul müdürü"].filter(Boolean).join(" · ")} title="İstatistik"
        unreadCount={unreadCount} onOpenNotifications={onOpenNotifications}
        stats={<>
          <HeroStat lime label="tamamlama" value={s ? pct(s.completionRate) : "…"} />
          <HeroStat label="başarı" value={s ? pct(s.successPct) : "…"} />
          <HeroStat label="7 günde giren" value={data ? pct(data.people.activeWeekPct) : "…"} />
        </>}
      />
      <Body>
        <SegmentFilter small label="Bölüm" value={section} onChange={setSection} options={SECTIONS} />
        {usesStats && <PeriodFilter value={period} onChange={setPeriod} />}
        {section === "activity" && <AdminActivity fetcher={api.principalActivity} peopleFetcher={api.principalActivityPeople} onOpenStudent={onOpenStudent} hint="Kaç öğrenci ve öğretmen giriş yapıyor; bir kutuya dokununca kimler olduğu ve en son ne zaman girdikleri açılır." />}
        {section === "analysis" && <AdminAnalytics fetcher={api.principalAnalytics} />}
        {usesStats && (error ? <EmptyState text={error} /> : !data ? <LoadingState /> : (
          <>
            {section === "school" && <SchoolSection data={data} />}
            {section === "classes" && (className
              ? <ClassDetail cls={data.classes.find((c) => c.className === className)} className={className} period={period} onBack={() => setClassName(null)} onOpenStudent={onOpenStudent} />
              : <ClassList classes={data.classes} grades={data.grades} onOpen={setClassName} />)}
            {section === "subjects" && <SubjectSection subjects={data.subjects} />}
          </>
        ))}
      </Body>
    </div>
  );
}

// ---------------------------------------------------------------- küçük parçalar
function Tile({ value, label, tone }) {
  const color = tone === "danger" ? C.danger : tone === "warning" ? C.warningText : C.numText;
  return (
    <div style={{ padding: "10px 12px", borderRadius: 14, background: C.pageTint, minWidth: 0 }}>
      <div style={{ ...NUM, fontSize: 20, fontWeight: 800, color, lineHeight: 1.15 }}>{value}</div>
      <div style={{ fontFamily: bodyFont, fontSize: 12, color: C.inkMuted, marginTop: 2, lineHeight: 1.3 }}>{label}</div>
    </div>
  );
}
const Tiles = ({ children, cols = 2 }) => <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 8, marginTop: 12 }}>{children}</div>;
const Note = ({ children }) => <div style={{ fontFamily: bodyFont, fontSize: 12, color: C.inkMuted, lineHeight: 1.5, marginTop: 10 }}>{children}</div>;

// Haftalık çubuk serisi: her çubuğun üstünde değer, altında haftanın pazartesisi.
function WeekBars({ title, weeks, valueOf, format = fmt, color }) {
  const values = weeks.map(valueOf);
  const max = Math.max(1, ...values.filter((v) => v != null));
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontFamily: bodyFont, fontSize: 13, fontWeight: 700, color: C.inkText }}>{title}</div>
      <div role="img" aria-label={`${title}: ${weeks.map((w, i) => `${weekLabel(w.start)} ${values[i] == null ? "veri yok" : format(values[i])}`).join(", ")}`}
        style={{ display: "grid", gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))`, gap: 6, alignItems: "end", marginTop: 8 }}>
        {weeks.map((w, i) => {
          const v = values[i];
          return (
            <div key={w.start} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 0 }}>
              <span style={{ ...NUM, fontSize: 10.5, fontWeight: 700, color: v == null ? C.inkMuted : C.numText, whiteSpace: "nowrap" }}>{v == null ? "—" : format(v)}</span>
              <span style={{ width: "100%", maxWidth: 26, height: v == null ? 3 : Math.max(4, Math.round((v / max) * 56)), borderRadius: 6, background: v == null ? C.track : color }} />
              <span style={{ ...NUM, fontSize: 10, color: C.inkMuted }}>{weekLabel(w.start)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SkipBars({ skips }) {
  const total = Object.values(skips).reduce((a, b) => a + b, 0);
  if (!total) return <Note>Bu dönemde pas geçilen ödev yok.</Note>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
      {Object.entries(SKIP_LABELS).map(([k, label]) => (
        <div key={k}>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: bodyFont, fontSize: 12.5, color: C.inkText }}>
            <span>{label}</span><span style={{ ...NUM, fontWeight: 800, color: C.numText }}>{skips[k]} <span style={{ color: C.inkMuted, fontWeight: 600 }}>· %{Math.round((skips[k] / total) * 100)}</span></span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: C.track, marginTop: 4, overflow: "hidden" }}>
            <div style={{ width: `${(skips[k] / total) * 100}%`, height: "100%", borderRadius: 3, background: C.warningText }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Okul
function SchoolSection({ data }) {
  const { people: p, school: s, weeks, grades } = data;
  return (
    <>
      <SectionCard icon={Users} iconBg={C.cta} iconFg={C.onCta} title="Öğrenciler">
        <Tiles cols={3}>
          <Tile value={fmt(p.students)} label="kayıtlı öğrenci" />
          <Tile value={fmt(p.activeToday)} label="bugün giren" />
          <Tile value={fmt(p.activeWeek)} label={`son 7 günde giren (${pct(p.activeWeekPct)})`} />
          <Tile value={fmt(p.inactive)} label="7 gündür girmeyen" tone={p.inactive ? "warning" : undefined} />
          <Tile value={fmt(p.never)} label="hiç giriş yapmayan" tone={p.never ? "danger" : undefined} />
          <Tile value={fmt(s.examStudents)} label="deneme giren öğrenci" />
        </Tiles>
      </SectionCard>

      <SectionCard icon={ClipboardList} iconBg={C.brandTint} iconFg={C.brandText} title="Ödevler">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginTop: 12 }}>
          <Meter label="Tamamlama" value={s.completionRate} color={C.success} />
          <Meter label="Başarı" value={s.successPct} color={C.cta} />
        </div>
        <Tiles cols={3}>
          <Tile value={fmt(s.assignments)} label="ödev" />
          <Tile value={fmt(s.submissions)} label="sonuç girişi" />
          <Tile value={fmt(s.questions)} label="ödevde çözülen soru" />
          <Tile value={fmt(s.overdue)} label="gecikti" tone={s.overdue ? "danger" : undefined} />
          <Tile value={fmt(s.skipped)} label="pas geçildi" tone={s.skipped ? "warning" : undefined} />
          <Tile value={fmt(s.assigned)} label="ödev ataması" />
        </Tiles>
      </SectionCard>

      <SectionCard icon={PenLine} iconBg={C.warningTint} iconFg={C.warningText} title="Pas sebepleri" note={s.skipped ? `${fmt(s.skipped)} pas` : null}>
        <SkipBars skips={s.skips} />
      </SectionCard>

      <SectionCard icon={BookOpen} iconBg={C.successTint} iconFg={C.successText} title="Serbest çalışma ve deneme">
        <Tiles cols={3}>
          <Tile value={fmt(s.studyQuestions)} label="serbest çalışmada soru" />
          <Tile value={fmt(s.studySessions)} label="çalışma kaydı" />
          <Tile value={fmt(s.studyStudents)} label="çalışma giren öğrenci" />
          <Tile value={fmt(s.exams.TYT.count)} label="TYT denemesi" />
          <Tile value={fmtNet(s.exams.TYT.avgNet)} label="TYT ort. net" />
          <Tile value={fmt(s.exams.AYT.count)} label={`AYT denemesi · ort. ${fmtNet(s.exams.AYT.avgNet)} net`} />
        </Tiles>
      </SectionCard>

      <SectionCard icon={TrendingUp} iconBg={C.brandTint} iconFg={C.brandText} title="Son 8 hafta" note="dönemden bağımsız">
        <WeekBars title="Tamamlama" weeks={weeks} valueOf={(w) => w.completionRate} format={(v) => `%${v}`} color={C.success} />
        <WeekBars title="Başarı" weeks={weeks} valueOf={(w) => w.successPct} format={(v) => `%${v}`} color={C.cta} />
        <WeekBars title="Çözülen soru (ödev + serbest)" weeks={weeks} valueOf={(w) => (w.questions || 0) + (w.studyQuestions || 0)} color={C.cta} />
        <WeekBars title="Giriş yapan öğrenci" weeks={weeks} valueOf={(w) => w.activeStudents} color={C.inkMuted} />
        <Note>Haftalar pazartesiden başlar; ödevler bitiş gününün haftasına sayılır.</Note>
      </SectionCard>

      <SectionCard icon={Layers} iconBg={C.track} iconFg={C.inkText} title="Sınıf düzeyleri" count={grades.length}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
          {grades.map((g) => (
            <MetricRow key={g.gradeLevel ?? "none"} title={gradeName(g.gradeLevel)}
              sub={`${fmt(g.students)} öğrenci · 7 günde ${pct(g.activeWeekPct)} giriş · ${fmt((g.questions || 0) + g.studyQuestions)} soru`}
              completion={g.completionRate} success={g.successPct} overdue={g.overdue} />
          ))}
        </div>
      </SectionCard>
    </>
  );
}

// ---------------------------------------------------------------- Sınıflar
const CLASS_SORTS = [
  { id: "name", label: "Şube" },
  { id: "completion", label: "Tamamlama" },
  { id: "success", label: "Başarı" },
  { id: "active", label: "Giriş" },
];
function ClassList({ classes, onOpen }) {
  const [sort, setSort] = useState("name");
  const list = useMemo(() => {
    const val = (c) => (sort === "completion" ? c.completionRate : sort === "success" ? c.successPct : c.activeWeekPct) ?? -1;
    return [...classes].sort((a, b) => (sort === "name" ? 0 : val(b) - val(a)) || (a.gradeLevel ?? 99) - (b.gradeLevel ?? 99) || a.className.localeCompare(b.className, "tr"));
  }, [classes, sort]);
  if (!classes.length) return <EmptyState compact text="Henüz şube yok." />;
  return (
    <>
      <SegmentFilter small label="Sırala" value={sort} onChange={setSort} options={CLASS_SORTS} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {list.map((c) => (
          <MetricRow key={c.className} title={c.className}
            chip={c.inactive > 0 ? <StatusChip tone="warning">{c.inactive} kişi 7 gündür yok</StatusChip> : null}
            sub={`${fmt(c.students)} öğrenci · 7 günde ${pct(c.activeWeekPct)} giriş · ${fmt((c.questions || 0) + c.studyQuestions)} soru`}
            completion={c.completionRate} success={c.successPct} overdue={c.overdue} onClick={() => onOpen(c.className)} />
        ))}
      </div>
    </>
  );
}

const STUDENT_SORTS = [
  { id: "completion", label: "Tamamlama" },
  { id: "success", label: "Başarı" },
  { id: "questions", label: "Soru" },
  { id: "name", label: "Ad" },
];
function ClassDetail({ cls, className, period, onBack, onOpenStudent }) {
  const [data, error] = useLoad(() => api.principalStudents(period), [period]);
  const [sort, setSort] = useState("completion");
  const students = useMemo(() => {
    const rows = (data?.students || []).filter((s) => (s.className || "Şubesiz") === className);
    const val = (s) => (sort === "completion" ? s.completionRate : sort === "success" ? s.successPct : (s.questions || 0) + (s.studyQuestions || 0)) ?? -1;
    return rows.sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name, "tr") : val(b) - val(a) || a.name.localeCompare(b.name, "tr")));
  }, [data, className, sort]);
  return (
    <>
      <button type="button" onClick={onBack} className="k-list-row" style={{ display: "inline-flex", alignItems: "center", gap: 4, alignSelf: "flex-start", minHeight: 40, padding: "0 12px 0 6px", borderRadius: 12, border: "none", background: C.surface, color: C.brandText, fontFamily: bodyFont, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
        <ChevronLeft size={18} aria-hidden="true" />Tüm sınıflar
      </button>
      {cls && (
        <SectionCard icon={Layers} iconBg={C.cta} iconFg={C.onCta} title={`${className} şubesi`} note={gradeName(cls.gradeLevel)}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginTop: 12 }}>
            <Meter label="Tamamlama" value={cls.completionRate} color={C.success} />
            <Meter label="Başarı" value={cls.successPct} color={C.cta} />
          </div>
          <Tiles cols={3}>
            <Tile value={fmt(cls.students)} label="öğrenci" />
            <Tile value={fmt(cls.activeWeek)} label="7 günde giren" />
            <Tile value={fmt(cls.overdue)} label="gecikti" tone={cls.overdue ? "danger" : undefined} />
            <Tile value={fmt(cls.submissions)} label="sonuç girişi" />
            <Tile value={fmt(cls.questions)} label="ödevde soru" />
            <Tile value={fmt(cls.studyQuestions)} label="serbest soru" />
          </Tiles>
        </SectionCard>
      )}
      <SegmentFilter small label="Öğrencileri sırala" value={sort} onChange={setSort} options={STUDENT_SORTS} />
      {error ? <EmptyState text={error} /> : !data ? <LoadingState /> : students.length === 0 ? <EmptyState compact text="Bu şubede öğrenci yok." /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {students.map((s, i) => {
            const seen = lastSeenInfo(s.lastSeenAt, null);
            return (
              <button key={s.id} type="button" onClick={() => onOpenStudent(s.id, s.name)} className="k-list-row"
                style={{ display: "block", width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 18, border: "none", background: C.surface, textAlign: "left", cursor: "pointer" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ ...NUM, width: 20, textAlign: "center", fontSize: 13, fontWeight: 800, color: C.inkMuted, flexShrink: 0 }}>{i + 1}</span>
                  <Avatar name={s.name} size={36} tint />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontFamily: bodyFont, fontSize: 15, fontWeight: 700, color: C.inkText }}>{s.name}</span>
                    <span style={{ display: "block", fontFamily: bodyFont, fontSize: 12, color: C.inkMuted, marginTop: 2 }}>
                      {[s.coachName && `Koç: ${s.coachName}`, seen.never ? "hiç girmedi" : `son giriş ${seen.label}`].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {s.overdue > 0 && <StatusChip tone="danger">{s.overdue} gecikti</StatusChip>}
                  <ChevronRight size={18} color={C.brandText} aria-hidden="true" style={{ flexShrink: 0 }} />
                </span>
                <span style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 10 }}>
                  <Mini label="tamamlama" value={pct(s.completionRate)} />
                  <Mini label="başarı" value={pct(s.successPct)} />
                  <Mini label="çözülen soru" value={fmt((s.questions || 0) + (s.studyQuestions || 0))} />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
const Mini = ({ label, value }) => (
  <span style={{ display: "block", padding: "8px 10px", borderRadius: 12, background: C.pageTint }}>
    <span style={{ ...NUM, display: "block", fontSize: 16, fontWeight: 800, color: C.numText }}>{value}</span>
    <span style={{ display: "block", fontFamily: bodyFont, fontSize: 11, color: C.inkMuted }}>{label}</span>
  </span>
);

// ---------------------------------------------------------------- Dersler
function SubjectSection({ subjects }) {
  const [exam, setExam] = useState("all");
  const list = exam === "all" ? subjects : subjects.filter((x) => x.examType === exam);
  if (!subjects.length) return <EmptyState compact text="Bu dönemde ödev ya da çalışma yok." />;
  return (
    <>
      <SegmentFilter small label="Sınav türü" value={exam} onChange={setExam} options={[{ id: "all", label: "Tümü" }, { id: "TYT", label: "TYT" }, { id: "AYT", label: "AYT" }]} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {list.map((x) => {
          const skipText = Object.entries(x.skips).filter(([, n]) => n > 0).map(([k, n]) => `${SKIP_LABELS[k].toLocaleLowerCase("tr-TR")} ${n}`).join(" · ");
          return (
            <div key={`${x.examType}|${x.subject}`} style={{ background: C.surface, borderRadius: 18 }}>
              <MetricRow title={x.subject} chip={<StatusChip tone="brand">{x.examType}</StatusChip>}
                sub={`${fmt(x.assignments)} ödev · ${fmt(x.submissions)} sonuç · ${fmt(x.questions)} ödev sorusu · ${fmt(x.studyQuestions)} serbest soru`}
                completion={x.completionRate} success={x.successPct} overdue={x.overdue} />
              {skipText && <div style={{ fontFamily: bodyFont, fontSize: 12, color: C.warningText, padding: "0 12px 10px" }}>Pas: {skipText}</div>}
            </div>
          );
        })}
      </div>
      <div style={{ fontFamily: bodyFont, fontSize: 12, color: C.inkMuted, lineHeight: 1.5 }}>
        Tamamlama: süresi dolan ödevlerin tamamlanan yüzdesi · Başarı: net / soru (net = doğru − yanlış/4).
      </div>
    </>
  );
}

export default PrincipalStatsScreen;
