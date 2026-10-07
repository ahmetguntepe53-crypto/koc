import { useEffect, useState } from "react";
import { C, bodyFont, monoFont } from "../../theme.js";
import { Card, Chip, StatCard, StatGrid, SectionHeader, EmptyState, LoadingState, AlertBox, Button, MiniBars, Avatar } from "../../components/common.jsx";
import { ChevronRight, X } from "lucide-react";
import { api } from "../../api.js";
import { fmtDay, fmtInt, trDay } from "../../reportModel.js";

// Kurulum > "Aktivite" — kim ne kadar giriş yapıyor: bugün, son 7/14/30 günün günlük dökümü, bu hafta
// hiç girmeyenler. GİZLİLİK: burada da öğrenci/öğretmen ADI yok, yalnızca toplu sayılar (bkz. sunucu
// yorumu, routes/adminActivity.js) — bir kişinin tek tek giriş geçmişi Hesaplar'daki "son giriş" satırı.
const WINDOWS = [7, 14, 30];
const textStyle = (size = 13, weight = 500, color) => ({ fontFamily: bodyFont, fontSize: size, fontWeight: weight, color: color || C.text });
const M = ({ children, size = 12, weight = 700, color }) => <span style={{ fontFamily: monoFont, fontSize: size, fontWeight: weight, color: color || "inherit", fontVariantNumeric: "tabular-nums" }}>{children}</span>;

// fetcher: müdürün İstatistik sekmesi aynı ekranı /principal/activity ile kullanır. peopleFetcher (yalnız müdür ekranı):
// verilirse kutular tıklanır, altında o gruptaki kişiler son giriş zamanıyla listelenir; onOpenStudent öğrenciyi açar.
export default function AdminActivity({ fetcher = api.adminActivity, hint, peopleFetcher, onOpenStudent }) {
  const [open, setOpen] = useState(null); // { role, group }
  const toggle = peopleFetcher ? (role, group) => setOpen((o) => (o && o.role === role && o.group === group ? null : { role, group })) : null;
  const [days, setDays] = useState(14);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    fetcher(days)
      .then(setData)
      .catch((e) => setError(e.message || "Aktivite yüklenemedi"))
      .finally(() => setLoading(false));
  };
  useEffect(load, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div style={{ ...textStyle(13, 500, C.mutedLight), lineHeight: 1.5, marginBottom: 12 }}>
        {hint || "Kim değil, kaç kişi: günlük ve haftalık giriş sayıları. Tek bir öğrenci ya da öğretmenin adı burada geçmez — birinin son girişini görmek için Hesaplar'daki listeye bakın."}
      </div>
      <div className="k-chip-row" role="group" aria-label="Pencere" style={{ marginBottom: 16 }}>
        {WINDOWS.map((w) => <Chip key={w} active={days === w} onClick={() => setDays(w)}>{w} gün</Chip>)}
      </div>

      {error ? (
        <AlertBox title="Aktivite yüklenemedi">
          <div style={{ marginBottom: 10 }}>{error}</div>
          <Button small variant="secondary" onClick={load}>Tekrar dene</Button>
        </AlertBox>
      ) : loading && !data ? (
        <LoadingState />
      ) : data ? (
        <div aria-busy={loading || undefined} style={{ opacity: loading ? 0.55 : 1, transition: "opacity .15s" }}>
          <Overview data={data} onPick={toggle} open={open} />
          {open && peopleFetcher && <PeopleList key={`${open.role}-${open.group}`} {...open} data={data} fetcher={peopleFetcher} onClose={() => setOpen(null)} onOpenStudent={onOpenStudent} />}
          <DailyChart data={data} />
        </div>
      ) : null}
    </div>
  );
}

function Overview({ data, onPick, open }) {
  // onPick verilirse (müdür ekranı) her kutu bir düğme: dokununca o gruptaki kişiler aşağıda açılır.
  const pick = (role, group) => (onPick ? { onClick: () => onPick(role, group), active: open?.role === role && open?.group === group } : {});
  return (
    <>
      <SectionHeader title="Bugün" />
      <StatGrid min={110}>
        <StatCard label="öğrenci giriş yaptı" value={`${fmtInt(data.today.students)}/${fmtInt(data.totals.students)}`} {...pick("STUDENT", "today")} />
        <StatCard label="öğretmen giriş yaptı" value={`${fmtInt(data.today.teachers)}/${fmtInt(data.totals.teachers)}`} {...pick("TEACHER", "today")} />
      </StatGrid>
      <SectionHeader title={`Son ${data.inactiveDays} gün`} style={{ marginTop: 4 }} />
      <StatGrid min={110}>
        <StatCard label="en az bir kez giren öğrenci" value={`${fmtInt(data.activeThisWeek.students)}/${fmtInt(data.totals.students)}`} {...pick("STUDENT", "week")} />
        <StatCard label="en az bir kez giren öğretmen" value={`${fmtInt(data.activeThisWeek.teachers)}/${fmtInt(data.totals.teachers)}`} {...pick("TEACHER", "week")} />
        <StatCard label="son 7 günde girmeyen öğrenci" value={fmtInt(data.inactive.students)} tone={data.inactive.students > 0 ? "amber" : "muted"} {...pick("STUDENT", "inactive")} />
        <StatCard label="son 7 günde girmeyen öğretmen" value={fmtInt(data.inactive.teachers)} tone={data.inactive.teachers > 0 ? "amber" : "muted"} {...pick("TEACHER", "inactive")} />
      </StatGrid>
      {onPick && <div style={{ ...textStyle(12, 500, C.mutedLight), margin: "2px 0 8px" }}>Kimler olduğunu görmek için bir kutuya dokun.</div>}
      {data.totals.students === 0 && data.totals.teachers === 0 && <EmptyState text="Henüz hesap yok." />}
    </>
  );
}

// Günlük seyir: iki seri (öğrenci, öğretmen), MiniBars ile — AdminAnalytics'teki haftalık seyirle aynı desen.
function DailyChart({ data }) {
  const days = data.daily;
  if (!days.length) return null;
  const wide = days.length <= 14;
  const barWidth = wide ? 10 : 5;
  const gap = wide ? 5 : 3;
  const label = (d) => fmtDay(trDay(d.day));
  const barsWidth = days.length * barWidth + (days.length - 1) * gap;
  const series = [
    { key: "students", title: "Öğrenci girişleri" },
    { key: "teachers", title: "Öğretmen girişleri" },
  ];
  return (
    <>
      <SectionHeader title="Günlük giriş" right={`${days.length} gün`} />
      <Card style={{ padding: "14px 16px" }}>
        {series.map((s, i) => (
          <div key={s.key} style={{ marginTop: i ? 16 : 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
              <span style={textStyle(12.5, 700, C.text2)}>{s.title}</span>
              <span style={textStyle(11.5, 500, C.mutedLight)}>bugün <M size={12} weight={700} color={C.text}>{fmtInt(days[days.length - 1][s.key])}</M></span>
            </div>
            <div role="img" aria-label={`${s.title}, günlük: ${days.map((d) => `${label(d)} ${fmtInt(d[s.key])} kişi`).join(", ")}`}>
              <MiniBars values={days.map((d) => d[s.key])} height={40} barWidth={barWidth} gap={gap} />
            </div>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, width: barsWidth, maxWidth: "100%", ...textStyle(11, 500, C.mutedLight), marginTop: 8 }}>
          <M size={11} weight={500}>{label(days[0])}</M>
          <span>bugün</span>
        </div>
      </Card>
    </>
  );
}

// ---- kutuya dokununca: o gruptaki kişiler (yalnız müdür ekranı, bkz. server > /principal/activity-people)
const GROUP_TITLE = {
  today: { STUDENT: "Bugün giriş yapan öğrenciler", TEACHER: "Bugün giriş yapan öğretmenler" },
  week: { STUDENT: "Son 7 günde giriş yapan öğrenciler", TEACHER: "Son 7 günde giriş yapan öğretmenler" },
  inactive: { STUDENT: "7 gündür giriş yapmayan öğrenciler", TEACHER: "7 gündür giriş yapmayan öğretmenler" },
};
const pad2 = (n) => String(n).padStart(2, "0");
// "bugün 14:32" · "dün 21:05" · "3 Eki 09:10 · 4 gün önce" · "hiç giriş yapmadı"
function lastSeenText(iso, now = new Date()) {
  if (!iso) return "hiç giriş yapmadı";
  const d = new Date(iso);
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86400000);
  if (diff <= 0) return `bugün ${time}`;
  if (diff === 1) return `dün ${time}`;
  return `${d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" })} ${time} · ${diff} gün önce`;
}

function PeopleList({ role, group, fetcher, onClose, onOpenStudent }) {
  const [people, setPeople] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    fetcher(role, group).then((d) => { if (alive) setPeople(d.people); }).catch((e) => { if (alive) setError(e.message || "Liste yüklenemedi"); });
    return () => { alive = false; };
  }, [role, group]); // eslint-disable-line react-hooks/exhaustive-deps
  const student = role === "STUDENT";
  return (
    <Card style={{ padding: 14, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ ...textStyle(14.5, 800), flex: 1, minWidth: 0 }}>{GROUP_TITLE[group][role]}{people ? ` (${people.length})` : ""}</span>
        <button type="button" onClick={onClose} aria-label="Listeyi kapat" className="k-icon-btn" style={{ width: 36, height: 36, borderRadius: 12, border: "none", background: C.surface2, color: C.text, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      {error ? <div style={textStyle(13, 500, C.red)}>{error}</div> : !people ? <LoadingState /> : people.length === 0 ? (
        <div style={textStyle(13, 500, C.mutedLight)}>Bu grupta kimse yok.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {people.map((p) => {
            const sub = student
              ? [p.className, p.coachName && `Koç: ${p.coachName}`].filter(Boolean).join(" · ")
              : p.isSubjectTeacher && p.teachingSubjects?.length ? `Branş: ${p.teachingSubjects.join(", ")}` : "Koç";
            const Row = student && onOpenStudent ? "button" : "div";
            return (
              <Row
                key={p.id}
                type={Row === "button" ? "button" : undefined}
                onClick={Row === "button" ? () => onOpenStudent(p.id, p.name) : undefined}
                className={Row === "button" ? "k-list-row" : undefined}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", boxSizing: "border-box", padding: "9px 10px", borderRadius: 12, border: "none", background: C.surface2, textAlign: "left", cursor: Row === "button" ? "pointer" : "default", fontFamily: "inherit" }}
              >
                <Avatar name={p.name} size={34} tint />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ ...textStyle(14, 700), display: "block" }}>{p.name}</span>
                  {sub && <span style={{ ...textStyle(12, 500, C.mutedLight), display: "block", marginTop: 1 }}>{sub}</span>}
                </span>
                <span style={{ textAlign: "right", flexShrink: 0 }}>
                  <span style={{ ...textStyle(12, 700, p.lastSeenAt ? C.text : C.amber), display: "block" }}>{lastSeenText(p.lastSeenAt)}</span>
                  <span style={{ ...textStyle(11, 500, C.mutedLight), display: "block", marginTop: 1 }}>son 7 günde {p.daysThisWeek} gün</span>
                </span>
                {Row === "button" && <ChevronRight size={16} color={C.mutedLight} aria-hidden="true" style={{ flexShrink: 0 }} />}
              </Row>
            );
          })}
        </div>
      )}
    </Card>
  );
}
