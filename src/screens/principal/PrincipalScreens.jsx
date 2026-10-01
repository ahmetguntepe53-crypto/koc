import { useEffect, useMemo, useState } from "react";
import { Users, BookOpen, School, ChevronLeft, ChevronRight, Search, UserRound } from "lucide-react";
import { C, bodyFont, displayFont } from "../../theme.js";
import { Avatar, EmptyState, LoadingState, HeaderIconButton } from "../../components/common.jsx";
import { HeroHeader, HeroBell, HeroStat, SectionCard, SegmentFilter, StatusChip, fieldBox, NUM } from "../../components/brand.jsx";
import { api } from "../../api.js";
import { lastSeenInfo } from "../../work.js";
import { gradeLabel } from "../../subjects.js";

// Okul müdürü paneli (rol PRINCIPAL) — yalnızca okur. Tanımlar (bkz. server/src/routes/principal.js):
// tamamlama = sorumlu olunan (tamamlanmış ya da süresi dolmuş) ödevlerin tamamlanan yüzdesi; başarı = toplam net /
// toplam soru; gecikti = süresi dolmuş, sonucu girilmemiş, pas geçilmemiş. Dönem ödevin bitiş gününe göre.

const PERIODS = [
  { id: "week", label: "Bu hafta" },
  { id: "month", label: "Bu ay" },
  { id: "all", label: "Tüm dönem" },
];
const PERIOD_KEY = "kocluk-principal-period";
function usePeriod() {
  const [period, setPeriod] = useState(() => {
    try { const v = localStorage.getItem(PERIOD_KEY); return PERIODS.some((p) => p.id === v) ? v : "month"; } catch { return "month"; }
  });
  const change = (v) => { setPeriod(v); try { localStorage.setItem(PERIOD_KEY, v); } catch { /* yalnızca kolaylık */ } };
  return [period, change];
}
const pct = (v) => (v == null ? "—" : `%${v}`);

function PeriodFilter({ value, onChange }) {
  return <SegmentFilter small label="Dönem" value={value} onChange={onChange} options={PERIODS} />;
}

// Yüzde çubuğu: etiket, değer ve 6px çubuk (başarı mor, tamamlama yeşil).
function Meter({ label, value, color }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 6, fontFamily: bodyFont, fontSize: 12, color: C.inkMuted }}>
        <span>{label}</span><span style={{ ...NUM, fontWeight: 800, color: C.inkText }}>{pct(value)}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: C.track, marginTop: 4, overflow: "hidden" }}>
        <div style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%`, height: "100%", borderRadius: 3, background: color }} />
      </div>
    </div>
  );
}

function MetricRow({ title, sub, chip, completion, success, overdue, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={onClick ? "k-list-row" : undefined}
      style={{ display: "block", width: "100%", boxSizing: "border-box", textAlign: "left", padding: 12, borderRadius: 16, border: "none", background: C.pageTint, cursor: onClick ? "pointer" : "default" }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontFamily: bodyFont, fontSize: 15, fontWeight: 700, color: C.inkText }}>{title}</span>
            {chip}
          </span>
          {sub && <span style={{ ...NUM, display: "block", fontSize: 12, color: C.inkMuted, marginTop: 2 }}>{sub}</span>}
        </span>
        {overdue > 0 && <StatusChip tone="danger">{overdue} gecikti</StatusChip>}
        {onClick && <ChevronRight size={18} color={C.brandText} aria-hidden="true" style={{ flexShrink: 0 }} />}
      </span>
      <span style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginTop: 10 }}>
        <Meter label="Tamamlama" value={completion} color={C.success} />
        <Meter label="Başarı" value={success} color={C.brand} />
      </span>
    </Tag>
  );
}

function Hero({ subtitle, title, onBack, unreadCount, onOpenNotifications, stats }) {
  return (
    <HeroHeader compact>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {onBack && <HeaderIconButton onBrand icon={ChevronLeft} label="Geri" onClick={onBack} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          {subtitle && <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.onBrandMuted, lineHeight: 1.35 }}>{subtitle}</div>}
          <h1 style={{ margin: 0, fontFamily: displayFont, fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.15, color: C.onBrand, overflowWrap: "anywhere" }}>{title}</h1>
        </div>
        <HeroBell unreadCount={unreadCount} onClick={onOpenNotifications} />
      </div>
      {stats && <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 18 }}>{stats}</div>}
    </HeroHeader>
  );
}
const Body = ({ children }) => <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px 16px 24px", display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>;

function useLoad(fn, deps) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    setData(null);
    setError("");
    fn().then((d) => { if (alive) setData(d); }).catch((e) => { if (alive) setError(e.message || "Yüklenemedi"); });
    return () => { alive = false; };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return [data, error];
}

// ---------------------------------------------------------------- Genel bakış
export function PrincipalOverviewScreen({ user, unreadCount, onOpenNotifications }) {
  const [period, setPeriod] = usePeriod();
  const [data, error] = useLoad(() => api.principalOverview(period), [period]);
  const s = data?.school;
  return (
    <div>
      <Hero
        subtitle={[user?.name, "Okul müdürü"].filter(Boolean).join(" · ")} title="Genel bakış"
        unreadCount={unreadCount} onOpenNotifications={onOpenNotifications}
        stats={<>
          <HeroStat lime label="tamamlama" value={s ? pct(s.completionRate) : "…"} />
          <HeroStat label="başarı" value={s ? pct(s.successPct) : "…"} />
          <HeroStat label="geciken ödev" value={s ? s.overdue : "…"} />
        </>}
      />
      <Body>
        <PeriodFilter value={period} onChange={setPeriod} />
        {error ? <EmptyState text={error} /> : !data ? <LoadingState /> : (
          <>
            <SectionCard icon={School} iconBg={C.brand} iconFg={C.onBrand} title="Okul">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginTop: 12 }}>
                {[
                  [data.students.total, "öğrenci"],
                  [data.students.activeWeek, "son 7 günde giren"],
                  [s.assignments, "ödev"],
                  [s.submissions, "sonuç girişi"],
                ].map(([v, l]) => (
                  <div key={l} style={{ padding: "10px 12px", borderRadius: 14, background: C.pageTint }}>
                    <div style={{ ...NUM, fontSize: 20, fontWeight: 800, color: C.inkText }}>{v}</div>
                    <div style={{ fontFamily: bodyFont, fontSize: 12, color: C.inkMuted }}>{l}</div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard icon={Users} iconBg={C.brandTint} iconFg={C.brandText} title="Sınıflar" count={data.classes.length}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                {data.classes.length === 0 && <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.inkMuted }}>Henüz öğrenci yok.</div>}
                {data.classes.map((c) => (
                  <MetricRow key={c.className} title={c.className} sub={`${c.students} öğrenci · ${c.assigned} ödev ataması`} completion={c.completionRate} success={c.successPct} overdue={c.overdue} />
                ))}
              </div>
            </SectionCard>

            <SectionCard icon={BookOpen} iconBg={C.successTint} iconFg={C.successText} title="Dersler" count={data.subjects.length}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                {data.subjects.length === 0 && <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.inkMuted }}>Bu dönemde ödev yok.</div>}
                {data.subjects.map((x) => (
                  <MetricRow key={`${x.examType}|${x.subject}`} title={x.subject} chip={<StatusChip tone="brand">{x.examType}</StatusChip>} sub={`${x.assignments} ödev · ${x.submissions} sonuç`} completion={x.completionRate} success={x.successPct} overdue={x.overdue} />
                ))}
              </div>
            </SectionCard>
          </>
        )}
      </Body>
    </div>
  );
}

// ---------------------------------------------------------------- Öğrenciler
const SORTS = [
  { id: "success", label: "Başarı" },
  { id: "completion", label: "Tamamlama" },
  { id: "name", label: "Ad" },
];

export function PrincipalStudentsScreen({ unreadCount, onOpenNotifications, onOpenStudent }) {
  const [period, setPeriod] = usePeriod();
  const [data, error] = useLoad(() => api.principalStudents(period), [period]);
  const [q, setQ] = useState("");
  const [cls, setCls] = useState("");
  const [sort, setSort] = useState("success");

  const classes = useMemo(() => [...new Set((data?.students || []).map((s) => s.className).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr")), [data]);
  const list = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr-TR");
    const rows = (data?.students || []).filter((s) => (!cls || s.className === cls) && (!needle || s.name.toLocaleLowerCase("tr-TR").includes(needle)));
    const val = (s) => (sort === "success" ? s.successPct : s.completionRate) ?? -1;
    return rows.sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name, "tr") : val(a) - val(b) || a.name.localeCompare(b.name, "tr")));
  }, [data, q, cls, sort]);

  const withOverdue = (data?.students || []).filter((s) => s.overdue > 0).length;
  return (
    <div>
      <Hero
        subtitle="Öğrenci öğrenci tamamlama ve başarı" title="Öğrenciler"
        unreadCount={unreadCount} onOpenNotifications={onOpenNotifications}
        stats={data && <>
          <HeroStat lime label="öğrenci" value={data.students.length} />
          <HeroStat label="gecikmesi olan" value={withOverdue} />
          <HeroStat label="hiç sonucu yok" value={data.students.filter((s) => s.successPct == null).length} />
        </>}
      />
      <Body>
        <PeriodFilter value={period} onChange={setPeriod} />
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)", gap: 8 }}>
          <label style={{ position: "relative", display: "block" }}>
            <Search size={16} color={C.inkMuted} aria-hidden="true" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
            <input type="search" aria-label="Öğrenci ara" placeholder="Öğrenci ara" value={q} onChange={(e) => setQ(e.target.value)} style={{ ...fieldBox(false), cursor: "text", paddingLeft: 38, background: C.surface }} />
          </label>
          <select aria-label="Şubeye göre süz" value={cls} onChange={(e) => setCls(e.target.value)} style={{ ...fieldBox(false), background: C.surface }}>
            <option value="">Tüm şubeler</option>
            {classes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <SegmentFilter label="Sırala" value={sort} onChange={setSort} options={SORTS} small />
        {error ? <EmptyState text={error} /> : !data ? <LoadingState /> : list.length === 0 ? <EmptyState compact text="Bu süzgeçte öğrenci yok." /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {list.map((s) => (
              <button key={s.id} type="button" onClick={() => onOpenStudent(s.id, s.name)} className="k-list-row" style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 18, border: "none", background: C.surface, textAlign: "left", cursor: "pointer" }}>
                <Avatar name={s.name} size={40} tint />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontFamily: bodyFont, fontSize: 15, fontWeight: 700, color: C.inkText }}>{s.name}</span>
                  <span style={{ display: "block", fontFamily: bodyFont, fontSize: 12, color: C.inkMuted, marginTop: 2 }}>
                    {[s.className, s.coachName && `Koç: ${s.coachName}`, s.overdue > 0 && `${s.overdue} gecikti`].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span style={{ textAlign: "right", flexShrink: 0 }}>
                  <span style={{ ...NUM, display: "block", fontSize: 18, fontWeight: 800, color: C.inkText }}>{pct(sort === "completion" ? s.completionRate : s.successPct)}</span>
                  <span style={{ display: "block", fontFamily: bodyFont, fontSize: 11, color: C.inkMuted }}>{sort === "completion" ? "tamamlama" : "başarı"}</span>
                </span>
                <ChevronRight size={18} color={C.brandText} aria-hidden="true" style={{ flexShrink: 0 }} />
              </button>
            ))}
          </div>
        )}
      </Body>
    </div>
  );
}

// ---------------------------------------------------------------- Öğretmenler
export function PrincipalTeachersScreen({ unreadCount, onOpenNotifications }) {
  const [period, setPeriod] = usePeriod();
  const [data, error] = useLoad(() => api.principalOverview(period), [period]);
  const teachers = data?.teachers || [];
  return (
    <div>
      <Hero
        subtitle="Gönderilen ödevler ve öğrencilerinin durumu" title="Öğretmenler"
        unreadCount={unreadCount} onOpenNotifications={onOpenNotifications}
        stats={data && <>
          <HeroStat lime label="öğretmen" value={teachers.length} />
          <HeroStat label="branş öğretmeni" value={teachers.filter((t) => t.isSubjectTeacher).length} />
          <HeroStat label="ödev gönderdi" value={teachers.filter((t) => t.assignmentsSent > 0).length} />
        </>}
      />
      <Body>
        <PeriodFilter value={period} onChange={setPeriod} />
        {error ? <EmptyState text={error} /> : !data ? <LoadingState /> : teachers.length === 0 ? <EmptyState compact text="Kayıtlı öğretmen yok." /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {teachers.map((t) => {
              const seen = lastSeenInfo(t.lastSeenAt, null);
              return (
                <div key={t.id} style={{ background: C.surface, borderRadius: 18, padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Avatar name={t.name} size={40} tint />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: bodyFont, fontSize: 15, fontWeight: 700, color: C.inkText }}>{t.name}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                        {t.isSubjectTeacher && t.teachingSubjects.map((b) => <StatusChip key={b} tone="brand">{b}</StatusChip>)}
                        {t.coachedStudents > 0 && <StatusChip tone="track"><UserRound size={12} aria-hidden="true" />{t.coachedStudents} öğrencinin koçu</StatusChip>}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ ...NUM, fontSize: 18, fontWeight: 800, color: C.inkText }}>{t.assignmentsSent}</div>
                      <div style={{ fontFamily: bodyFont, fontSize: 11, color: C.inkMuted }}>ödev</div>
                    </div>
                  </div>
                  <div style={{ ...NUM, fontSize: 12, color: C.inkMuted, marginTop: 8 }}>{seen.never ? "Hiç giriş yapmadı" : `Son giriş ${seen.label}`}</div>
                  {t.assignmentsSent > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginTop: 10 }}>
                      <Meter label="Tamamlama" value={t.completionRate} color={C.success} />
                      <Meter label="Başarı" value={t.successPct} color={C.brand} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Body>
    </div>
  );
}

// ---------------------------------------------------------------- Sıralama
// Öğrenci adıyla genel başarı sıralaması (yöneticinin "Sıralama" sekmesiyle aynı veri): tüm zamanların toplam neti /
// toplam soru. En az minQuestions soru çözmeyen öğrenci sıralamaya girmez, altta ayrı listelenir.
const RANK_PERIODS = [
  { id: "day", label: "Günlük" },
  { id: "week", label: "Haftalık" },
  { id: "month", label: "Aylık" },
  { id: "all", label: "Tümü" },
];
const RANK_KEY = "kocluk-principal-rank-period";
const RANK_HINT = { day: "bugün biten ödevler ve bugünkü serbest çalışma", week: "bu hafta (Pzt–Paz)", month: "bu ay", all: "tüm zamanların toplamı" };

export function PrincipalLeaderboardScreen({ unreadCount, onOpenNotifications, onOpenStudent }) {
  const [period, setPeriodState] = useState(() => {
    try { const v = localStorage.getItem(RANK_KEY); return RANK_PERIODS.some((p) => p.id === v) ? v : "week"; } catch { return "week"; }
  });
  const setPeriod = (v) => { setPeriodState(v); try { localStorage.setItem(RANK_KEY, v); } catch { /* yalnızca kolaylık */ } };
  const [data, error] = useLoad(() => api.principalLeaderboard(period), [period]);
  const ranked = (data?.students || []).filter((s) => s.ranked);
  const unranked = (data?.students || []).filter((s) => !s.ranked);
  const row = (s, rank) => (
    <button key={s.id} type="button" onClick={() => onOpenStudent(s.id, s.name)} className="k-list-row" style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 18, border: "none", background: C.surface, textAlign: "left", cursor: "pointer" }}>
      {rank != null && <span style={{ ...NUM, width: 24, flexShrink: 0, textAlign: "center", fontSize: 14, fontWeight: 800, color: rank <= 3 ? C.warningText : C.inkMuted }}>{rank}</span>}
      <Avatar name={s.name} size={40} tint />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontFamily: bodyFont, fontSize: 15, fontWeight: 700, color: C.inkText }}>{s.name}</span>
        <span style={{ display: "block", fontFamily: bodyFont, fontSize: 12, color: C.inkMuted, marginTop: 2 }}>{[s.className, gradeLabel(s.gradeLevel)].filter(Boolean).join(" · ")}</span>
      </span>
      <span style={{ textAlign: "right", flexShrink: 0 }}>
        <span style={{ ...NUM, display: "block", fontSize: 18, fontWeight: 800, color: s.netRate == null ? C.inkMuted : C.inkText }}>{s.netRate == null ? "—" : `%${String(s.netRate).replace(".", ",")}`}</span>
        <span style={{ ...NUM, display: "block", fontSize: 11, color: C.inkMuted }}>{s.totalQuestions} soru</span>
      </span>
      <ChevronRight size={18} color={C.brandText} aria-hidden="true" style={{ flexShrink: 0 }} />
    </button>
  );
  return (
    <div>
      <Hero
        subtitle={`Net oranı · ${RANK_HINT[period]}`} title="Sıralama"
        unreadCount={unreadCount} onOpenNotifications={onOpenNotifications}
        stats={data && <>
          <HeroStat lime label="sıralanan öğrenci" value={ranked.length} />
          <HeroStat label="yeterli veri yok" value={unranked.length} />
          <HeroStat label="en yüksek oran" value={ranked[0] ? `%${String(ranked[0].netRate).replace(".", ",")}` : "—"} />
        </>}
      />
      <Body>
        <SegmentFilter small label="Sıralama dönemi" value={period} onChange={setPeriod} options={RANK_PERIODS} />
        <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.inkMuted, lineHeight: 1.5 }}>
          Ödev ve serbest çalışma sonuçlarının toplamı. Dönemde en az {data?.minQuestions ?? "…"} soru çözmeyen öğrenci sıralamaya girmez; sayı azken yüzde anlamsız çıkar.
        </div>
        {error ? <EmptyState text={error} /> : !data ? <LoadingState /> : (
          <>
            {ranked.length === 0 ? <EmptyState compact text="Bu dönemde sıralamaya girecek kadar soru çözen öğrenci yok." /> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{ranked.map((s, i) => row(s, i + 1))}</div>
            )}
            {unranked.length > 0 && (
              <SectionCard icon={Users} iconBg={C.track} iconFg={C.inkText} title="Yeterli veri yok" count={unranked.length}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>{unranked.map((s) => row(s))}</div>
              </SectionCard>
            )}
          </>
        )}
      </Body>
    </div>
  );
}
