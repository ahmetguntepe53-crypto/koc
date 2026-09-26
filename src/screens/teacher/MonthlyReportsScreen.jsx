import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { C, bodyFont, monoFont } from "../../theme.js";
import { Card, Chip, EmptyState, LoadingState, SectionHeader, ListRow, ListGroup, Avatar, Pill, Button, StatCard, StatGrid } from "../../components/common.jsx";
import { api } from "../../api.js";

// Aylık raporlar (koç) — her ayın başında gelen bildirim buraya açılır: öğrencilerin o ayki özeti, öğrenci
// öğrenci inceleme (dokununca o ayın ayrıntılı raporu + yapay zekâ incelemesi + PDF) ve tümünün tek PDF'i.
// Sayılar sunucudaki monthlySummary.js'ten — yapay zekâ incelemesi de aynı özeti görür.

const MONTHS_TR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

export function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS_TR[m - 1]} ${y}`;
}
// Son üç ay + içinde bulunulan ay (sürüyor).
export function recentMonths(now = new Date()) {
  return [0, 1, 2, 3].map((i) => monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
}
export function defaultReportMonth(now = new Date()) {
  // Ayın ilk haftasında geçen ayın raporu okunur; sonra içinde bulunulan ay.
  return now.getDate() <= 7 ? monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1)) : monthKey(now);
}

function deltaText(cur, prev) {
  if (cur == null || prev == null) return null;
  const d = Math.round(cur - prev);
  return { d, text: `${d >= 0 ? "+" : "−"}${Math.abs(d)}` };
}

export default function MonthlyReportsScreen({ month: initialMonth, onMonthChange, setHeader, onOpenStudent, onExportAll }) {
  const [month, setMonthState] = useState(initialMonth || defaultReportMonth());
  const setMonth = (m) => { setMonthState(m); onMonthChange?.(m); };
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const current = monthKey(new Date());
  const seq = useRef(0);

  useEffect(() => {
    const my = ++seq.current;
    setLoading(true);
    setError("");
    api.teacherMonthlyReports(month)
      .then((d) => {
        if (my !== seq.current) return; // ay hızlı değiştirildiyse eski yanıt yok sayılır
        setData(d);
        setHeader?.({ title: "Aylık raporlar", subtitle: `${monthLabel(month)}${month === current ? " (sürüyor)" : ""} · ${d.students.length} öğrenci` });
      })
      .catch((e) => { if (my === seq.current) setError(e.message || "Yüklenemedi"); })
      .finally(() => { if (my === seq.current) setLoading(false); });
  }, [month]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportAll = async () => {
    if (!onExportAll || !data) return;
    setExporting(true);
    setExportError("");
    try {
      await onExportAll(month, data.students);
    } catch (e) {
      console.error("[pdf] toplu rapor:", e);
      setExportError("PDF oluşturulamadı — lütfen tekrar dene.");
    } finally {
      setExporting(false);
    }
  };

  const rows = data?.students || [];
  const withData = rows.filter((r) => r.toplam.soru > 0);
  const withNO = withData.filter((r) => r.toplam.netOrani != null);
  const avgNO = withNO.length ? withNO.reduce((s, r) => s + r.toplam.netOrani, 0) / withNO.length : null;
  const due = rows.reduce((s, r) => s + r.odevDuzeni.suresiDolan, 0);
  const done = rows.reduce((s, r) => s + r.odevDuzeni.cozulen, 0);
  const noActivity = rows.filter((r) => r.aktifGunSayisi === 0).length;

  return (
    <div className="k-page" style={{ padding: 28, maxWidth: 760, margin: "0 auto" }}>
      <div className="k-chip-row" role="group" aria-label="Ay" style={{ marginBottom: 14 }}>
        {recentMonths().map((m) => (
          <Chip key={m} active={month === m} onClick={() => setMonth(m)}>{monthLabel(m).split(" ")[0]}{m === current ? " (bu ay)" : ""}</Chip>
        ))}
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <EmptyState text={error} />
      ) : rows.length === 0 ? (
        <EmptyState text="Sana atanmış öğrenci yok." />
      ) : (
        <>
          <StatGrid min={96}>
            <StatCard label="ortalama net oranı" value={avgNO != null ? `%${Math.round(avgNO)}` : "—"} />
            <StatCard label="ödev tamamlama" value={due ? `%${Math.round((done / due) * 100)}` : "—"} tone={due && done / due < 0.6 ? "amber" : "muted"} />
            <StatCard label="kaydı olmayan" value={noActivity} tone={noActivity ? "amber" : "muted"} />
          </StatGrid>

          <SectionHeader title="Öğrenci öğrenci" right="dokun, ayrıntılı raporu aç" />
          <ListGroup>
            {rows.map((r) => {
              const t = r.toplam;
              const d = deltaText(t.netOrani, r.oncekiAyToplam?.netOrani);
              return (
                <ListRow
                  key={r.id}
                  left={<Avatar name={r.name} size={40} />}
                  title={r.name}
                  titleExtra={r.aiHazir ? <Pill>YZ incelemesi</Pill> : null}
                  subtitle={
                    r.aktifGunSayisi > 0 ? (
                      <>
                        <span style={{ fontFamily: monoFont }}>{t.soru + (r.serbestCalisma?.soru || 0)}</span> soru · ödev net oranı <span style={{ fontFamily: monoFont }}>{t.netOrani != null ? `%${Math.round(t.netOrani)}` : "—"}</span>
                        {d && <span style={{ fontFamily: monoFont, color: d.d >= 0 ? C.green : C.amber }}> ({d.text})</span>}
                        {" · "}<span style={{ fontFamily: monoFont }}>{r.odevDuzeni.cozulen}/{r.odevDuzeni.suresiDolan}</span> ödev
                        {r.odakDersler.length > 0 && <span style={{ color: C.amber }}> · net oranı %40 altı: {r.odakDersler.slice(0, 2).join(", ")}</span>}
                      </>
                    ) : <span style={{ color: C.amber }}>bu ay kaydı yok{r.odevDuzeni.yapilmayan ? ` · ${r.odevDuzeni.yapilmayan} ödev sessiz kaldı` : ""}</span>
                  }
                  onClick={() => onOpenStudent(r.id, r.name, month)}
                />
              );
            })}
          </ListGroup>

          {onExportAll && (
            <Card style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ flex: 1, minWidth: 0, fontFamily: bodyFont }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>Tüm öğrencilerin raporu</div>
                <div style={{ fontSize: 13, color: C.mutedLight, marginTop: 3 }}>{monthLabel(month)} · <span style={{ fontFamily: monoFont }}>{rows.length}</span> öğrenci tek PDF'te</div>
              </div>
              <Button icon={Download} disabled={exporting} onClick={exportAll}>{exporting ? "Hazırlanıyor..." : "PDF"}</Button>
            </Card>
          )}
          {exportError && <div role="alert" style={{ color: C.red, fontFamily: bodyFont, fontSize: 13, fontWeight: 600, marginTop: 10 }}>{exportError}</div>}
        </>
      )}
    </div>
  );
}
