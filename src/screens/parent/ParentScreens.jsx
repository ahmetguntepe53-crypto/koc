import { useMemo, useState } from "react";
import { BarChart3, ClipboardList, ChevronRight, CalendarDays, PieChart, BookOpen, Flame, TrendingUp } from "lucide-react";
import { C, bodyFont, displayFont } from "../../theme.js";
import { Avatar, EmptyState, LoadingState } from "../../components/common.jsx";
import { HeroHeader, HeroBell, HeroStat, SectionCard, SegmentFilter, StatusChip, NUM } from "../../components/brand.jsx";
import { api } from "../../api.js";
import { lastSeenInfo } from "../../work.js";
import { useLoad } from "../principal/PrincipalScreens.jsx";

// Veli paneli (rol PARENT). KULLANICI İSTEĞİ (2026-10-14): veli yalnızca KENDİ öğrencisinin ödev takibini yapar ve toplam
// çözdüğü soru sayısını günlük/haftalık/aylık izler; doğru/yanlış GÖRMEZ (sunucu zaten göndermez — routes/parent.js).

const fmt = (n) => Number(n || 0).toLocaleString("tr-TR");
const dayLabel = (iso) => { const [, m, d] = iso.split("-"); return `${Number(d)}.${Number(m)}`; };
// 14 günlük seride yalnızca gün numarası (ayın 1'inde ay adı) — tam tarih dar ekranda birbirine giriyordu.
const dayShort = (iso) => { const [, , d] = iso.split("-"); return Number(d) === 1 ? monthLabel(iso) : String(Number(d)); };
const monthLabel = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("tr-TR", { month: "short" });
const shortDate = (iso) => new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });

const STATUS = {
  done: { tone: "success", text: "Tamamladı" },
  open: { tone: "warning", text: "Bekliyor" },
  missed: { tone: "danger", text: "Gecikti" },
  skipped: { tone: "track", text: "Pas geçti" },
};

function ChildHero({ child, unreadCount, onOpenNotifications, title, stats }) {
  return (
    <HeroHeader compact>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {child && <Avatar name={child.name} size={52} lime avatar={child.avatar} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.onBrandMuted, lineHeight: 1.35 }}>
            {[title, child?.className].filter(Boolean).join(" · ")}
          </div>
          <h1 style={{ margin: 0, fontFamily: displayFont, fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.15, color: C.onBrand, overflowWrap: "anywhere" }}>{child?.name || "…"}</h1>
        </div>
        <HeroBell unreadCount={unreadCount} onClick={onOpenNotifications} />
      </div>
      {stats && <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 18 }}>{stats}</div>}
    </HeroHeader>
  );
}
const Body = ({ children }) => <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px 16px 24px", display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>;

// Çubuk serisi: her çubuğun üstünde soru sayısı, altında gün / hafta / ay.
function Bars({ items, label }) {
  const max = Math.max(1, ...items.map((x) => x.questions));
  return (
    <div role="img" aria-label={items.map((x) => `${label(x.start)} ${x.questions} soru`).join(", ")}
      style={{ display: "grid", gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`, gap: items.length > 10 ? 3 : 6, alignItems: "end", marginTop: 14 }}>
      {items.map((x) => (
        <div key={x.start} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 0 }}>
          <span style={{ ...NUM, fontSize: 10, fontWeight: 700, color: x.questions ? C.numText : C.inkMuted, whiteSpace: "nowrap" }}>{x.questions ? fmt(x.questions) : "·"}</span>
          <span style={{ width: "100%", maxWidth: 26, height: x.questions ? Math.max(4, Math.round((x.questions / max) * 72)) : 3, borderRadius: 6, background: x.questions ? C.cta : C.track }} />
          <span style={{ ...NUM, fontSize: 9.5, color: C.inkMuted, whiteSpace: "nowrap" }}>{label(x.start)}</span>
        </div>
      ))}
    </div>
  );
}

const PERIODS = [
  { id: "days", label: "Günlük" },
  { id: "weeks", label: "Haftalık" },
  { id: "months", label: "Aylık" },
];

export function ParentHomeScreen({ unreadCount, onOpenNotifications, onOpenAssignments }) {
  const [data, error] = useLoad(() => api.parentOverview(), []);
  const [period, setPeriod] = useState("days");
  const q = data?.questions;
  const w = data?.summary.week;
  const seen = data ? lastSeenInfo(data.child.lastSeenAt, null) : null;
  return (
    <div>
      <ChildHero
        child={data?.child} title="Veli paneli" unreadCount={unreadCount} onOpenNotifications={onOpenNotifications}
        stats={<>
          <HeroStat lime label="bugün soru" value={q ? fmt(q.today) : "…"} />
          <HeroStat label="bu hafta" value={q ? fmt(q.week) : "…"} />
          <HeroStat label="bu ay" value={q ? fmt(q.month) : "…"} />
        </>}
      />
      <Body>
        {error ? <EmptyState text={error} /> : !data ? <LoadingState /> : (
          <>
            <SectionCard icon={BarChart3} iconBg={C.cta} iconFg={C.onCta} title="Çözdüğü soru sayısı">
              <SegmentFilter small label="Dönem" value={period} onChange={setPeriod} options={PERIODS} style={{ marginTop: 12 }} />
              <Bars items={q[period]} label={period === "months" ? monthLabel : period === "days" ? dayShort : dayLabel} />
              <div style={{ fontFamily: bodyFont, fontSize: 12, color: C.inkMuted, lineHeight: 1.5, marginTop: 12 }}>
                Ödevlerde ve serbest çalışmada işaretlediği sorular. {period === "weeks" ? "Haftalar pazartesiden başlar." : ""}
              </div>
            </SectionCard>

            <SectionCard icon={ClipboardList} iconBg={C.brandTint} iconFg={C.brandText} title="Bu haftanın ödevleri" count={w.total}>
              {w.total === 0 ? (
                <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.inkMuted, marginTop: 10 }}>Bu hafta son günü olan ödev yok.</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, marginTop: 12 }}>
                  {[["done", w.done], ["open", w.open], ["missed", w.missed], ["skipped", w.skipped]].map(([k, n]) => (
                    <div key={k} style={{ padding: "10px 6px", borderRadius: 14, background: C.pageTint, textAlign: "center", minWidth: 0 }}>
                      <div style={{ ...NUM, fontSize: 20, fontWeight: 800, color: k === "missed" && n ? C.danger : C.numText }}>{n}</div>
                      <div style={{ fontFamily: bodyFont, fontSize: 11.5, color: C.inkMuted, marginTop: 2 }}>{STATUS[k].text.toLocaleLowerCase("tr-TR")}</div>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" onClick={onOpenAssignments} className="k-list-row"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", minHeight: 44, marginTop: 12, padding: "0 12px", borderRadius: 12, border: "none", background: C.pageTint, color: C.brandText, fontFamily: bodyFont, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                Tüm ödevleri gör ({data.summary.all.total})<ChevronRight size={18} aria-hidden="true" />
              </button>
            </SectionCard>

            <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.inkMuted, lineHeight: 1.6, padding: "0 4px" }}>
              {[data.child.coachName && `Koçu: ${data.child.coachName}`, seen && (seen.never ? "Uygulamaya henüz giriş yapmadı" : `Uygulamaya son girişi: ${seen.label}`)].filter(Boolean).join(" · ")}
            </div>
          </>
        )}
      </Body>
    </div>
  );
}

const FILTERS = [
  { id: "all", label: "Tümü" },
  { id: "open", label: "Bekliyor" },
  { id: "done", label: "Tamamladı" },
  { id: "missed", label: "Gecikti" },
];

export function ParentAssignmentsScreen({ unreadCount, onOpenNotifications }) {
  const [data, error] = useLoad(() => api.parentOverview(), []);
  const [filter, setFilter] = useState("all");
  const list = useMemo(() => (data?.assignments || []).filter((a) => filter === "all" || a.status === filter), [data, filter]);
  const s = data?.summary.all;
  return (
    <div>
      <ChildHero
        child={data?.child} title="Ödevler" unreadCount={unreadCount} onOpenNotifications={onOpenNotifications}
        stats={s && <>
          <HeroStat lime label="tamamladı" value={s.done} />
          <HeroStat label="bekliyor" value={s.open} />
          <HeroStat label="gecikti" value={s.missed} />
        </>}
      />
      <Body>
        <SegmentFilter small label="Ödevleri süz" value={filter} onChange={setFilter}
          options={FILTERS.map((f) => ({ ...f, count: f.id === "all" ? s?.total : s?.[f.id] }))} />
        {error ? <EmptyState text={error} /> : !data ? <LoadingState /> : list.length === 0 ? <EmptyState compact text="Bu süzgeçte ödev yok." /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {list.map((a) => {
              const st = STATUS[a.status];
              const when = a.status === "done" && a.completedAt
                ? `${shortDate(a.completedAt)} tamamladı${a.late ? " · geç" : ""}`
                : `Son gün ${shortDate(a.endDate)}`;
              return (
                <div key={a.id} style={{ background: a.status === "missed" ? C.dangerTint : C.surface, border: a.status === "missed" ? `1px solid ${C.dangerBorder}` : "none", borderRadius: 18, padding: 14 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: bodyFont, fontSize: 12, fontWeight: 600, color: C.brandText }}>{[a.subject, a.examType, a.teacherName].filter(Boolean).join(" · ")}</div>
                      <div style={{ fontFamily: displayFont, fontSize: 16, fontWeight: 800, color: C.inkText, marginTop: 2, overflowWrap: "anywhere" }}>{a.topic}</div>
                      <div style={{ ...NUM, display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: a.status === "missed" ? C.dangerText : C.inkMuted, marginTop: 6 }}>
                        <CalendarDays size={13} aria-hidden="true" />{when}
                      </div>
                    </div>
                    <StatusChip tone={st.tone}>{st.text}</StatusChip>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ fontFamily: bodyFont, fontSize: 12, color: C.inkMuted, lineHeight: 1.5 }}>
          Ödevlerin sonuçları (doğru/yanlış) öğrenci ile koçu arasındadır; burada yalnızca yapılıp yapılmadığı görünür.
        </div>
      </Body>
    </div>
  );
}

// ---------------------------------------------------------------- İstatistik (2026-10-14): genel durum, doğru/yanlış yok
const pctText = (v) => (v == null ? "—" : `%${v}`);
function Meter({ label, value, color }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 6, fontFamily: bodyFont, fontSize: 12.5, color: C.inkMuted }}>
        <span>{label}</span><span style={{ ...NUM, fontWeight: 800, color: C.numText }}>{pctText(value)}</span>
      </div>
      <div style={{ height: 7, borderRadius: 4, background: C.track, marginTop: 5, overflow: "hidden" }}>
        <div style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%`, height: "100%", borderRadius: 4, background: color }} />
      </div>
    </div>
  );
}
const Tile = ({ value, label, tone }) => (
  <div style={{ padding: "10px 12px", borderRadius: 14, background: C.pageTint, minWidth: 0 }}>
    <div style={{ ...NUM, fontSize: 20, fontWeight: 800, lineHeight: 1.15, color: tone === "danger" ? C.danger : tone === "warning" ? C.warningText : C.numText }}>{value}</div>
    <div style={{ fontFamily: bodyFont, fontSize: 12, color: C.inkMuted, marginTop: 2, lineHeight: 1.3 }}>{label}</div>
  </div>
);
const Grid = ({ children, cols = 3 }) => <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 8, marginTop: 12 }}>{children}</div>;

export function ParentStatsScreen({ unreadCount, onOpenNotifications }) {
  const [ov] = useLoad(() => api.parentOverview(), []);
  const [data, error] = useLoad(() => api.parentStats(), []);
  const o = data?.overall;
  return (
    <div>
      <ChildHero
        child={ov?.child} title="İstatistik" unreadCount={unreadCount} onOpenNotifications={onOpenNotifications}
        stats={<>
          <HeroStat lime label="tamamlama" value={o ? pctText(o.completionRate) : "…"} />
          <HeroStat label="zamanında" value={o ? pctText(o.onTimeRate) : "…"} />
          <HeroStat label="gün seri" value={data ? data.activeDays.streak : "…"} />
        </>}
      />
      <Body>
        {error ? <EmptyState text={error} /> : !data ? <LoadingState /> : (
          <>
            <SectionCard icon={PieChart} iconBg={C.cta} iconFg={C.onCta} title="Ödevlerin genel durumu" count={o.total}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginTop: 12 }}>
                <Meter label="Tamamlama" value={o.completionRate} color={C.success} />
                <Meter label="Zamanında teslim" value={o.onTimeRate} color={C.cta} />
              </div>
              <Grid>
                <Tile value={o.done} label="tamamladı" />
                <Tile value={o.open} label="süresi devam eden" />
                <Tile value={o.missed} label="gecikti" tone={o.missed ? "danger" : undefined} />
                <Tile value={o.skipped} label="pas geçti" tone={o.skipped ? "warning" : undefined} />
                <Tile value={o.done - o.onTime} label="geç teslim" tone={o.done - o.onTime ? "warning" : undefined} />
                <Tile value={o.total} label="toplam ödev" />
              </Grid>
              <div style={{ fontFamily: bodyFont, fontSize: 12, color: C.inkMuted, lineHeight: 1.5, marginTop: 10 }}>
                Tamamlama, süresi dolan ödevler üzerinden hesaplanır; süresi devam eden ödevler henüz sayılmaz.
              </div>
            </SectionCard>

            <SectionCard icon={Flame} iconBg={C.warningTint} iconFg={C.warningText} title="Çalışma düzeni">
              <Grid>
                <Tile value={data.activeDays.streak} label="gün üst üste" />
                <Tile value={data.activeDays.last30} label="son 30 günde çalıştığı gün" />
                <Tile value={fmt(o.questions + data.studyQuestions)} label="toplam çözdüğü soru" />
              </Grid>
              <Grid cols={2}>
                <Tile value={fmt(o.questions)} label="ödevlerde" />
                <Tile value={fmt(data.studyQuestions)} label="kendi çalışmasında" />
              </Grid>
            </SectionCard>

            <SectionCard icon={TrendingUp} iconBg={C.brandTint} iconFg={C.brandText} title="Haftalık tamamlama">
              <div role="img" aria-label={data.weeks.map((w) => `${dayLabel(w.start)} ${w.total ? `${w.done}/${w.total}` : "ödev yok"}`).join(", ")}
                style={{ display: "grid", gridTemplateColumns: `repeat(${data.weeks.length}, minmax(0, 1fr))`, gap: 6, alignItems: "end", marginTop: 14 }}>
                {data.weeks.map((w) => (
                  <div key={w.start} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 0 }}>
                    <span style={{ ...NUM, fontSize: 10, fontWeight: 700, color: w.total ? C.numText : C.inkMuted, whiteSpace: "nowrap" }}>{w.total ? `${w.done}/${w.total}` : "·"}</span>
                    <span style={{ width: "100%", maxWidth: 26, height: w.completionRate == null ? 3 : Math.max(4, Math.round((w.completionRate / 100) * 64)), borderRadius: 6, background: w.completionRate == null ? C.track : C.success }} />
                    <span style={{ ...NUM, fontSize: 9.5, color: C.inkMuted, whiteSpace: "nowrap" }}>{dayLabel(w.start)}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontFamily: bodyFont, fontSize: 12, color: C.inkMuted, marginTop: 10 }}>Her hafta: tamamladığı / o hafta biten ödev.</div>
            </SectionCard>

            <SectionCard icon={BookOpen} iconBg={C.successTint} iconFg={C.successText} title="Derslere göre" count={data.subjects.length}>
              {data.subjects.length === 0 ? <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.inkMuted, marginTop: 10 }}>Henüz ödev yok.</div> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                  {data.subjects.map((x) => (
                    <div key={`${x.examType}|${x.subject}`} style={{ padding: 12, borderRadius: 14, background: C.pageTint }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: bodyFont, fontSize: 15, fontWeight: 700, color: C.inkText }}>{x.subject}</span>
                        <StatusChip tone="brand">{x.examType}</StatusChip>
                        {x.missed > 0 && <span style={{ marginLeft: "auto" }}><StatusChip tone="danger">{x.missed} gecikti</StatusChip></span>}
                      </div>
                      <div style={{ ...NUM, fontSize: 12, color: C.inkMuted, marginTop: 3 }}>{x.done}/{x.total} ödev · {fmt(x.questions + x.studyQuestions)} soru</div>
                      <div style={{ marginTop: 8 }}><Meter label="Tamamlama" value={x.completionRate} color={C.success} /></div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </>
        )}
      </Body>
    </div>
  );
}
