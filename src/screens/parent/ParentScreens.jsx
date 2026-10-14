import { useMemo, useState } from "react";
import { BarChart3, ClipboardList, ChevronRight, CalendarDays } from "lucide-react";
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
