import { useEffect, useState } from "react";
import { C, bodyFont, monoFont } from "../../theme.js";
import { Card, Chip, StatCard, StatGrid, SectionHeader, EmptyState, LoadingState, AlertBox, Button, MiniBars } from "../../components/common.jsx";
import { api } from "../../api.js";
import { fmtDay, fmtInt, trDay } from "../../reportModel.js";

// Kurulum > "Aktivite" — kim ne kadar giriş yapıyor: bugün, son 7/14/30 günün günlük dökümü, bu hafta
// hiç girmeyenler. GİZLİLİK: burada da öğrenci/öğretmen ADI yok, yalnızca toplu sayılar (bkz. sunucu
// yorumu, routes/adminActivity.js) — bir kişinin tek tek giriş geçmişi Hesaplar'daki "son giriş" satırı.
const WINDOWS = [7, 14, 30];
const textStyle = (size = 13, weight = 500, color) => ({ fontFamily: bodyFont, fontSize: size, fontWeight: weight, color: color || C.text });
const M = ({ children, size = 12, weight = 700, color }) => <span style={{ fontFamily: monoFont, fontSize: size, fontWeight: weight, color: color || "inherit", fontVariantNumeric: "tabular-nums" }}>{children}</span>;

export default function AdminActivity() {
  const [days, setDays] = useState(14);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    api.adminActivity(days)
      .then(setData)
      .catch((e) => setError(e.message || "Aktivite yüklenemedi"))
      .finally(() => setLoading(false));
  };
  useEffect(load, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div style={{ ...textStyle(13, 500, C.mutedLight), lineHeight: 1.5, marginBottom: 12 }}>
        Kim değil, kaç kişi: günlük ve haftalık giriş sayıları. Tek bir öğrenci ya da öğretmenin adı burada geçmez —
        birinin son girişini görmek için Hesaplar'daki listeye bakın.
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
          <Overview data={data} />
          <DailyChart data={data} />
        </div>
      ) : null}
    </div>
  );
}

function Overview({ data }) {
  return (
    <>
      <SectionHeader title="Bugün" />
      <StatGrid min={110}>
        <StatCard label="öğrenci giriş yaptı" value={`${fmtInt(data.today.students)}/${fmtInt(data.totals.students)}`} />
        <StatCard label="öğretmen giriş yaptı" value={`${fmtInt(data.today.teachers)}/${fmtInt(data.totals.teachers)}`} />
      </StatGrid>
      <SectionHeader title={`Son ${data.inactiveDays} gün`} style={{ marginTop: 4 }} />
      <StatGrid min={110}>
        <StatCard label="en az bir kez giren öğrenci" value={`${fmtInt(data.activeThisWeek.students)}/${fmtInt(data.totals.students)}`} />
        <StatCard label="en az bir kez giren öğretmen" value={`${fmtInt(data.activeThisWeek.teachers)}/${fmtInt(data.totals.teachers)}`} />
        <StatCard label="öğrenci hiç girmedi" value={fmtInt(data.inactive.students)} tone={data.inactive.students > 0 ? "amber" : "muted"} />
        <StatCard label="öğretmen hiç girmedi" value={fmtInt(data.inactive.teachers)} tone={data.inactive.teachers > 0 ? "amber" : "muted"} />
      </StatGrid>
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
