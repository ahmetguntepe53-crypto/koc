import { useEffect, useRef, useState } from "react";
import { ArrowUp, ArrowDown, ArrowRight } from "lucide-react";
import { C, bodyFont, monoFont } from "../../theme.js";
import { Button, Card, Chip, Pill, StatCard, StatGrid, SectionHeader, EmptyState, LoadingState, AlertBox, MiniBars } from "../../components/common.jsx";
import { api } from "../../api.js";
import { fmtPct, fmtInt, fmtSigned, fmtDay, fmtRange, trDay } from "../../reportModel.js";

// Okul analizi (Kurulum > "Okul analizi" sekmesi) — okul yönetiminin branş öğretmenlerinin okul geneli ödevlerine TOPLU
// bakışı: hangi derste konu pası yüksek, hangi haftanın ödevi herkese zor gelmiş, katılım nasıl. Branş öğretmenleriyle
// toplantıda doğrudan kullanılsın diye sayılar ödev, ders ve hafta düzeyinde.
// GİZLİLİK: sunucu (server/src/routes/adminAnalytics.js) öğrenci adı, kimliği ya da tekil sonuç DÖNDÜRMEZ; 10'dan az
// alıcılı ödevler hiç gelmez (yalnızca sayısı). Bu ekran da hiçbir öğrenciye inmez — tıklanıp açılan bir liste yok.
// Dil: "zor gelen", "konu eksiği sinyali", "düşük katılım" birer işarettir, kimseyi etiketlemez; renk yalnızca amber
// (odak) — kırmızı müdahale rengi burada kullanılmaz, çünkü karar branş öğretmeniyle konuşularak verilir.

const WINDOWS = [4, 8, 16];
const GRADES = [
  { value: "", label: "Tümü" },
  { value: 11, label: "11. sınıf" },
  { value: 12, label: "12. sınıf" },
];
// Sunucu eşikleri yanıtta da gönderir (thresholds); eski/eksik yanıtta bunlara düşülür.
const DEFAULT_THRESHOLDS = { minGroup: 10, minQuestions: 10, hardMedian: 35, konuSignal: 20, lowParticipation: 60 };
const FLAG_LABEL = { zor: "Zor gelen", konu: "Konu eksiği sinyali", katilim: "Düşük katılım" };
// Eğilimde ±3 puandan küçük fark "sabit" sayılır — tek ödevin gürültüsü yükseliş/düşüş gibi görünmesin.
const TREND_DEADBAND = 3;

const monoStyle = (size = 13, weight = 700, color) => ({ fontFamily: monoFont, fontSize: size, fontWeight: weight, color: color || C.text, fontVariantNumeric: "tabular-nums" });
const textStyle = (size = 13, weight = 500, color) => ({ fontFamily: bodyFont, fontSize: size, fontWeight: weight, color: color || C.text });
const M = ({ children, size = 12, weight = 600, color }) => <span style={monoStyle(size, weight, color || "inherit")}>{children}</span>;

// Tarih aralığı: aynı günse tek gün ("18 Eylül 2026"), değilse "14–18 Eylül 2026".
function dateRange(start, end) {
  const a = trDay(start), b = trDay(end);
  return a === b ? fmtDay(b, { short: false, year: true }) : fmtRange(a, b);
}

// fetcher: müdürün İstatistik sekmesi aynı ekranı /principal/analytics ile kullanır.
export default function AdminAnalytics({ fetcher = api.adminAnalytics }) {
  const [weeks, setWeeks] = useState(8);
  const [grade, setGrade] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);
  // Çiplere art arda dokunulursa geç gelen eski yanıt yenisinin üstüne yazmasın.
  const reqId = useRef(0);

  const load = () => {
    const id = ++reqId.current;
    setLoading(true);
    setError("");
    fetcher(weeks, grade)
      .then((d) => { if (id === reqId.current) setData(d); })
      .catch((e) => { if (id === reqId.current) setError(e.message || "Okul analizi yüklenemedi"); })
      .finally(() => { if (id === reqId.current) setLoading(false); });
  };
  useEffect(load, [weeks, grade]); // eslint-disable-line react-hooks/exhaustive-deps

  const th = { ...DEFAULT_THRESHOLDS, ...(data?.thresholds || {}) };

  return (
    <div>
      <div style={{ ...textStyle(13, 500, C.mutedLight), lineHeight: 1.5, marginBottom: 12 }}>
        Branş öğretmenlerinin okul geneli ödevlerinin toplu sonuçları. Öğrenci adı ya da tek bir öğrencinin sonucu burada yer almaz.
      </div>
      <div className="k-chip-row" role="group" aria-label="Dönem" style={{ marginBottom: 8 }}>
        {WINDOWS.map((w) => <Chip key={w} active={weeks === w} onClick={() => setWeeks(w)}>{w} hafta</Chip>)}
      </div>
      <div className="k-chip-row" role="group" aria-label="Sınıf düzeyi" style={{ marginBottom: 16 }}>
        {GRADES.map((g) => <Chip key={g.label} active={grade === g.value} onClick={() => setGrade(g.value)}>{g.label}</Chip>)}
      </div>

      {error ? (
        <AlertBox title="Okul analizi yüklenemedi">
          <div style={{ marginBottom: 10 }}>{error}</div>
          <Button small variant="secondary" onClick={load}>Tekrar dene</Button>
        </AlertBox>
      ) : loading && !data ? (
        <LoadingState />
      ) : data ? (
        <div aria-busy={loading || undefined} style={{ opacity: loading ? 0.55 : 1, transition: "opacity .15s" }}>
          <Overview data={data} th={th} />
          <Flagged data={data} th={th} showAll={showAll} onToggleAll={() => setShowAll((v) => !v)} />
          <SubjectTable subjects={data.subjects} />
          <WeeklyTrend weeks={data.weeks} th={th} />
        </div>
      ) : null}
    </div>
  );
}

function Overview({ data, th }) {
  const s = data.summary;
  return (
    <>
      <StatGrid min={96}>
        <StatCard label="katılım" value={fmtPct(s.participation)} tone={s.participation != null && s.participation < th.lowParticipation ? "amber" : "muted"} />
        <StatCard label="medyan net oranı" value={fmtPct(s.median)} tone={s.median != null && s.median < th.hardMedian ? "amber" : "muted"} />
        <StatCard label="konu pası oranı" value={fmtPct(s.konuPassRate)} tone={s.konuPassRate != null && s.konuPassRate >= th.konuSignal ? "amber" : "muted"} />
      </StatGrid>
      <div style={{ ...textStyle(12.5, 500, C.mutedLight), lineHeight: 1.5, marginTop: 6 }}>
        <M>{fmtInt(s.assignments)}</M> ödev · <M>{fmtInt(s.recipients)}</M> alıcı · <M weight={500}>{dateRange(data.window.from, data.window.to)}</M>
      </div>
      <div style={{ ...textStyle(12, 500, C.mutedLight), lineHeight: 1.5, marginTop: 8, padding: "10px 12px", borderRadius: 12, background: C.surface2 }}>
        10&apos;dan az öğrencili ödevler gösterilmez (k-anonimlik) ve toplamlara katılmaz.
        {/* Sunucu sınıf süzgecinde, geri kalan alıcıları 10'dan az olan ödevi de gizler (Tümü ile farkı o grubu verirdi). */}
        {data.window.gradeLevel && <> Sınıf seçiliyken diğer sınıftaki alıcıları 10&apos;dan az olan ödev de gizlenir.</>}
        {data.hidden > 0 &&<> Bu seçimde <M>{fmtInt(data.hidden)}</M> ödev bu yüzden gizli.</>}
        {" "}Katılım ve konu pası kişi ağırlıklı; medyan net oranı ödev medyanlarının medyanı.
      </div>
      {s.assignments === 0 && <EmptyState text="Bu dönemde gösterilecek okul geneli ödev yok." />}
    </>
  );
}

// Tek ödevin satırı — başlık, bağlam, işaretler ve dört sayı. Tıklanmaz: öğrenci düzeyine inilmez.
function AssignmentItem({ a }) {
  const flagged = (f) => a.flags.includes(f);
  const cell = (value, label, sub, amber) => (
    <div style={{ minWidth: 0 }}>
      <div style={monoStyle(15, 700, amber ? C.amber : C.text)}>{value}</div>
      <div style={{ ...textStyle(11.5, 500, C.mutedLight), marginTop: 2, lineHeight: 1.3 }}>{label}</div>
      {sub && <div style={{ ...monoStyle(11, 500, C.mutedLight), marginTop: 1 }}>{sub}</div>}
    </div>
  );
  return (
    <li style={{ listStyle: "none", padding: "14px 0", borderTop: `1px solid ${C.divider}` }}>
      <div style={{ ...textStyle(14.5, 700), letterSpacing: -0.2, lineHeight: 1.35 }}>{a.subject} — {a.topic}</div>
      <div style={{ ...textStyle(12, 500, C.mutedLight), marginTop: 3, lineHeight: 1.4 }}>
        {[a.examType, a.teacher].filter(Boolean).join(" · ")} · <M size={11.5} weight={500}>{dateRange(a.scheduledDate, a.endDate)}</M>
        {a.targetGrade ? <> · <M size={11.5} weight={500}>{a.targetGrade}.</M> sınıf</> : null}
      </div>
      {(a.flags.length > 0 || !a.closed) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {a.flags.map((f) => <Pill key={f} tone="amber">{FLAG_LABEL[f] || f}</Pill>)}
          {!a.closed && <Pill>sürüyor</Pill>}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, marginTop: 10 }}>
        {cell(fmtPct(a.participation), "katılım", `${fmtInt(a.submitted)}/${fmtInt(a.recipients)}`, flagged("katilim"))}
        {cell(fmtPct(a.median), "medyan net", a.q1 != null ? `${fmtPct(a.q1)}–${fmtPct(a.q3)}` : null, flagged("zor"))}
        {cell(fmtPct(a.konuPassRate), "konu pası", `${fmtInt(a.skips?.KONU ?? 0)} kişi`, flagged("konu"))}
        {cell(fmtInt(a.silent), "kayıt yok", null, false)}
      </div>
    </li>
  );
}

function Flagged({ data, th, showAll, onToggleAll }) {
  const flagged = data.assignments.filter((a) => a.flags.length);
  if (!data.assignments.length) return null;
  return (
    <>
      <SectionHeader title="Dikkat gerektiren ödevler" count={flagged.length} />
      {flagged.length ? (
        <ul aria-label="Dikkat gerektiren ödevler" style={{ margin: 0, padding: 0, borderBottom: `1px solid ${C.divider}` }}>
          {flagged.map((a) => <AssignmentItem key={a.id} a={a} />)}
        </ul>
      ) : (
        <EmptyState compact text="Bu seçimde işaretli ödev yok." />
      )}
      <div style={{ ...textStyle(12, 500, C.mutedLight), lineHeight: 1.6, marginTop: 10 }}>
        <div><strong style={{ color: C.text2 }}>Zor gelen:</strong> medyan net oranı &lt; <M>%{th.hardMedian}</M></div>
        <div><strong style={{ color: C.text2 }}>Konu eksiği sinyali:</strong> &ldquo;Konuyu bilmiyorum&rdquo; pası ≥ <M>%{th.konuSignal}</M></div>
        <div><strong style={{ color: C.text2 }}>Düşük katılım:</strong> süresi dolan ödevde teslim &lt; <M>%{th.lowParticipation}</M></div>
        <div>Medyan ve Q1–Q3 yalnızca en az <M>{th.minGroup}</M> geçerli teslimle (en az <M>{th.minQuestions}</M> soru) verilir; yoksa —.</div>
      </div>

      {/* İşaretsiz ödevler de görülebilsin (toplantıda "şu ödev nasıl geçti?" sorusu için) — varsayılan kapalı. */}
      <button
        type="button"
        onClick={onToggleAll}
        aria-expanded={showAll}
        className="k-btn"
        style={{ width: "100%", minHeight: 44, marginTop: 14, borderRadius: 12, cursor: "pointer", background: C.surface, border: `1px solid ${C.border}`, ...textStyle(13.5, 700, C.text2) }}
      >
        {showAll ? "Tüm ödevleri gizle" : "Tüm ödevleri göster"}
      </button>
      {showAll && (
        <div>
          <SectionHeader title="Tüm ödevler" count={data.assignments.length} />
          <ul aria-label="Tüm ödevler" style={{ margin: 0, padding: 0, borderBottom: `1px solid ${C.divider}` }}>
            {data.assignments.map((a) => <AssignmentItem key={a.id} a={a} />)}
          </ul>
        </div>
      )}
    </>
  );
}

// Eğilim: dönemin son yarısının medyanı − ilk yarısının (puan). Yükseliş yeşil, düşüş amber (kırmızı değil), küçük fark nötr.
function TrendCell({ value }) {
  if (value == null) return <span style={monoStyle(12, 600, C.mutedLight)}>—</span>;
  const dir = value >= TREND_DEADBAND ? "up" : value <= -TREND_DEADBAND ? "down" : "flat";
  const Icon = dir === "up" ? ArrowUp : dir === "down" ? ArrowDown : ArrowRight;
  const color = dir === "up" ? C.green : dir === "down" ? C.amber : C.mutedLight;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, ...monoStyle(12, 700, color), whiteSpace: "nowrap" }}>
      <Icon size={12} strokeWidth={2.4} aria-hidden="true" />{fmtSigned(value)}
    </span>
  );
}

function SubjectTable({ subjects }) {
  if (!subjects?.length) return null;
  const thS = { ...textStyle(11, 700, C.mutedLight), textAlign: "right", padding: "6px 6px", whiteSpace: "nowrap" };
  const td = { ...monoStyle(12.5, 600, C.text2), textAlign: "right", padding: "8px 6px", whiteSpace: "nowrap", verticalAlign: "top" };
  const amber = (on) => (on ? { color: C.amber } : null);
  return (
    <>
      <SectionHeader title="Dersler" count={subjects.length} />
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th scope="col" style={{ ...thS, textAlign: "left", paddingLeft: 0 }}>Ders</th>
              <th scope="col" style={thS}>Ödev</th>
              <th scope="col" style={thS}>Katılım</th>
              <th scope="col" style={thS}>Medyan</th>
              <th scope="col" style={thS}>Konu pası</th>
              <th scope="col" style={{ ...thS, paddingRight: 0 }}>Eğilim</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((s) => (
              <tr key={`${s.examType}|${s.subject}`} style={{ borderTop: `1px solid ${C.divider}` }}>
                <th scope="row" style={{ ...textStyle(13, 600), textAlign: "left", padding: "8px 6px 8px 0", lineHeight: 1.3, minWidth: 96 }}>
                  <span style={{ ...textStyle(10.5, 700, C.mutedLight), letterSpacing: 0.6, display: "block" }}>{s.examType}</span>
                  {s.subject}
                </th>
                <td style={td}>{fmtInt(s.assignments)}</td>
                <td style={{ ...td, ...amber(s.flags.includes("katilim")) }}>{fmtPct(s.participation)}</td>
                <td style={{ ...td, ...amber(s.flags.includes("zor")) }}>{fmtPct(s.median)}</td>
                <td style={{ ...td, ...amber(s.flags.includes("konu")) }}>{fmtPct(s.konuPassRate)}</td>
                <td style={{ ...td, paddingRight: 0 }}><TrendCell value={s.trend?.median} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ ...textStyle(11.5, 500, C.mutedLight), lineHeight: 1.5, marginTop: 6 }}>
        Eğilim: dönemin son yarısındaki medyan eksi ilk yarısındaki (puan). Yarılardan birinde ödev yoksa —.
      </div>
    </>
  );
}

// Haftalık seyir: ISO haftası başına katılım ve medyan net oranı (MiniBars). Çubuklar görsel; aynı veri ekran okuyucuya
// aria-label olarak okunur. Eşiğin altındaki haftalar amber.
function WeeklyTrend({ weeks, th }) {
  if (!weeks?.length || !weeks.some((w) => w.assignments > 0)) return null;
  const wide = weeks.length <= 8;
  const barWidth = wide ? 14 : 8;
  const gap = wide ? 6 : 4;
  const label = (w) => fmtDay(trDay(w.start));
  // Tarih satırı çubuk serisiyle aynı genişlikte — "bu hafta" son çubuğun altına düşsün.
  const barsWidth = weeks.length * barWidth + (weeks.length - 1) * gap;
  const last = [...weeks].reverse().find((w) => w.assignments > 0);
  const series = [
    { key: "participation", title: "Katılım", low: (v) => v < th.lowParticipation },
    { key: "median", title: "Medyan net oranı", low: (v) => v < th.hardMedian },
  ];
  return (
    <>
      <SectionHeader title="Haftalık seyir" right={`${weeks.length} hafta`} />
      <Card style={{ padding: "14px 16px" }}>
        {series.map((s, i) => (
          <div key={s.key} style={{ marginTop: i ? 16 : 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
              <span style={textStyle(12.5, 700, C.text2)}>{s.title}</span>
              <span style={textStyle(11.5, 500, C.mutedLight)}>son ödevli hafta <M size={12} weight={700} color={C.text}>{fmtPct(last?.[s.key])}</M></span>
            </div>
            <div role="img" aria-label={`${s.title}, haftalık: ${weeks.map((w) => `${label(w)} ${w[s.key] == null ? "veri yok" : fmtPct(w[s.key])}`).join(", ")}`}>
              <MiniBars values={weeks.map((w) => w[s.key])} height={40} barWidth={barWidth} gap={gap} colorFor={(v) => (s.low(v) ? C.amber : C.text2)} />
            </div>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, width: barsWidth, maxWidth: "100%", ...textStyle(11, 500, C.mutedLight), marginTop: 8 }}>
          <M size={11} weight={500}>{label(weeks[0])}</M>
          <span>bu hafta</span>
        </div>
      </Card>
    </>
  );
}
