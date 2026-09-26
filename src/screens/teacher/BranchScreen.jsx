import { useEffect, useState } from "react";
import { C, bodyFont, monoFont, formatNet, SKIP_REASONS } from "../../theme.js";
import { Card, Button, Chip, EmptyState, LoadingState, SectionHeader, SegmentBar, Legend, AlertBox, ListRow, ListGroup, BottomActionBar, confirmDialog } from "../../components/common.jsx";
import { api } from "../../api.js";
import { shortDate, deadlineLabel, dayDiff } from "../../work.js";

// Branş öğretmeni ekranı (şartname Z5) — koç ekranından AYRI bir sekme: biri 74 kişiye, diğeri 6 kişiye
// bakıyor. ROL SINIRI arayüzde görünür: yalnızca kendi yayınladığı okul çapındaki ödevlerin toplu
// sonuçları; sonuç girmeyenlerin takibi koçlarında (adlar burada yok, yalnızca koçlara özet gönderilir).
// Soru bazlı ısı haritası YOK — sistem soru bazlı veri toplamıyor, yalnızca D/Y/B toplamları var.

// Pas sebebinin "sahibi": konuyu bilmiyorum → branş öğretmeni, zaman yetmedi → koçlar, kaynağım yok → yönetim.
const OWNERS = {
  KONU: { label: "sana ait", color: () => C.red },
  ZAMAN: { label: "koçlara ait", color: () => C.amber },
  KAYNAK: { label: "yönetime ait", color: () => C.mutedLight },
  DIGER: { label: "diğer", color: () => C.mutedLight },
};

function rangeLabel(bin) {
  return `${bin.from}–${bin.to}`;
}

// Dağılımın ne anlattığını söyleyen tek cümle — yorum değil, dağılımın şekli.
function distributionSentence(bins, n) {
  if (!n) return null;
  const top = bins.reduce((best, b, i) => (b.count > bins[best].count ? i : best), 0);
  const upper = bins.slice(4).reduce((s, b) => s + b.count, 0) / n;
  const lower = bins.slice(0, 2).reduce((s, b) => s + b.count, 0) / n;
  if (upper < 0.1) return <>Dağılımın tepesi {rangeLabel(bins[top])} aralığında ve üst dilimler ({bins[4].from} ve üstü) neredeyse boş — <strong style={{ color: C.text }}>kimsenin iyi yapamadığı</strong> bir konu.</>;
  if (lower > 0.5) return <>Sonuç girenlerin yarısından fazlası alt dilimlerde ({bins[0].from}–{bins[1].to}) kalmış.</>;
  return <>Dağılımın tepesi {rangeLabel(bins[top])} aralığında; sınıf geniş bir aralığa yayılmış.</>;
}

// Hedef sınıf düzeyine göre öğrenci sayısı (12. sınıfın planı yalnız 12. sınıflara gider). Eski sunucu yanıtında
// studentCounts yoksa tüm YKS sayısına düşer.
const countFor = (data, grade) => (data.studentCounts ? (grade ? data.studentCounts[grade] ?? 0 : data.studentCounts.all) : data.studentCount);
const gradeText = (grade) => (grade ? `${grade}. sınıf` : "11–12. sınıf");

function CurrentCard({ cur, studentCount }) {
  const closed = dayDiff(cur.endDate) < 0;
  const { total, done, skipped } = cur.counts;
  const notDone = total - done - skipped;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const pctColor = pct >= 70 ? C.green : pct >= 40 ? C.amber : C.red;
  return (
    <Card style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: bodyFont, fontSize: 10.5, fontWeight: 700, letterSpacing: 1.4, color: C.mutedLight }}>{shortDate(cur.scheduledDate).toLocaleUpperCase("tr-TR")} – {shortDate(cur.endDate).toLocaleUpperCase("tr-TR")} · YAYINLADIĞIN ÖDEV</div>
          <div style={{ fontFamily: bodyFont, fontSize: 18, fontWeight: 700, letterSpacing: -0.4, color: C.text, marginTop: 8 }}>{cur.topic}</div>
          <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.mutedLight, marginTop: 4, lineHeight: 1.45 }}>
            {cur.questionCount != null && <><span style={{ fontFamily: monoFont }}>{cur.questionCount}</span> soru · </>}
            <span style={{ fontFamily: monoFont }}>{total}</span> öğrenciye gitti · {closed ? "kapandı" : `${deadlineLabel(cur.endDate)}'da kapanıyor`}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontFamily: monoFont, fontSize: 27, fontWeight: 700, letterSpacing: -1.1, color: pctColor }}>%{pct}</div>
          <div style={{ fontFamily: bodyFont, fontSize: 12, color: C.mutedLight }}>sonuç girdi</div>
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <SegmentBar parts={[
          { label: "girdi", value: done, color: C.green },
          { label: "pas geçti", value: skipped, color: C.amber },
          { label: closed ? "yapmadı" : "henüz girmedi", value: notDone, color: closed ? C.red : C.faintest },
        ]} />
      </div>
      <Legend style={{ marginTop: 12 }} items={[
        { label: "girdi", value: done, color: C.green },
        { label: "pas geçti", value: skipped, color: C.amber },
        { label: closed ? "yapmadı" : "henüz girmedi", value: notDone, color: closed ? C.red : C.faintest },
      ]} />
      {studentCount > total && <div style={{ fontFamily: bodyFont, fontSize: 12, color: C.mutedLight, marginTop: 10 }}>Okulda {studentCount} öğrenci var{cur.targetGrade ? ` (${cur.targetGrade}. sınıf)` : ""} — sonradan eklenenler bu ödevi almadı.</div>}
    </Card>
  );
}

function DistributionCard({ cur, prev }) {
  const n = cur.counts.done;
  if (!n) return null;
  const bins = cur.histogram;
  const max = Math.max(1, ...bins.map((b) => b.count));
  const top = bins.reduce((best, b, i) => (b.count > bins[best].count ? i : best), 0);
  const delta = cur.successPct != null && prev?.successPct != null ? cur.successPct - prev.successPct : null;
  return (
    <Card style={{ padding: "18px 20px", marginTop: 12 }}>
      <div style={{ fontFamily: bodyFont, fontSize: 10.5, fontWeight: 700, letterSpacing: 1.4, color: C.mutedLight }}>SONUÇ GİREN {n} ÖĞRENCİNİN NETİ</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, marginTop: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontFamily: monoFont, fontSize: 27, fontWeight: 700, letterSpacing: -1.1, color: C.text }}>{formatNet(cur.avgNet, 2)}</span>
          <span style={{ fontFamily: bodyFont, fontSize: 13, color: C.mutedLight }}>sınıf ortalaması{cur.questionCount != null && <> / <span style={{ fontFamily: monoFont }}>{cur.questionCount}</span></>}</span>
        </div>
        {delta != null && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: monoFont, fontSize: 15, fontWeight: 700, color: delta >= 0 ? C.green : C.red }}>{delta >= 0 ? "+" : "−"}{Math.abs(delta)} puan</div>
            <div style={{ fontFamily: bodyFont, fontSize: 11.5, color: C.mutedLight }}>geçen konuya göre</div>
          </div>
        )}
      </div>
      <div role="img" aria-label={`Net dağılımı: ${bins.map((b) => `${rangeLabel(b)} arası ${b.count} öğrenci`).join(", ")}`} style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 8, marginTop: 18, alignItems: "end" }}>
        {bins.map((b, i) => (
          <div key={i} style={{ textAlign: "center", minWidth: 0 }}>
            <div style={{ fontFamily: monoFont, fontSize: 12, color: i === top ? C.text : C.mutedLight, marginBottom: 6 }}>{b.count}</div>
            <div style={{ height: 84, display: "flex", alignItems: "flex-end" }}>
              <div style={{ width: "100%", height: Math.max(b.count ? 6 : 3, Math.round((b.count / max) * 84)), borderRadius: 4, background: i === top ? C.text : C.surfaceHover, border: i === top ? "none" : `1px solid ${C.borderStrong}` }} />
            </div>
            <div style={{ fontFamily: monoFont, fontSize: 10.5, color: C.mutedLight, marginTop: 8, whiteSpace: "nowrap" }}>{rangeLabel(b)}</div>
          </div>
        ))}
      </div>
      <div style={{ fontFamily: bodyFont, fontSize: 13.5, color: C.text2, lineHeight: 1.55, marginTop: 14 }}>{distributionSentence(bins, n)}</div>
    </Card>
  );
}

export default function BranchScreen({ user, setHeader, onOpenPlan }) {
  const [tracks, setTracks] = useState(null);
  const [track, setTrack] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.branchTracks()
      .then(({ tracks }) => { setTracks(tracks); setTrack(tracks[0] || null); if (!tracks.length) setLoading(false); })
      .catch((e) => { setError(e.message || "Yüklenemedi"); setLoading(false); });
  }, []);

  const load = () => {
    if (!track) return;
    setLoading(true);
    api.branchOverview(track.examType, track.subject)
      .then((d) => {
        setData(d);
        // Planın tamamı tek bir sınıf düzeyindeyse (ör. 12. sınıf yıllık planı) başlık onu ve o düzeydeki öğrenci sayısını gösterir.
        const grades = [...new Set((d.plan || []).filter((p) => p.schoolWide).map((p) => p.gradeLevel ?? null))];
        const g = grades.length === 1 ? grades[0] : null;
        setHeader?.({ title: track.subject.replace(/-\d$/, ""), subtitle: [d.teacher?.name || user?.name, gradeText(g), `${countFor(d, g)} öğrenci`].join(" · ") });
      })
      .catch((e) => setError(e.message || "Yüklenemedi"))
      .finally(() => setLoading(false));
  };
  useEffect(load, [track?.examType, track?.subject]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const remindCoaches = async () => {
    setBusy(true);
    try {
      const r = await api.branchRemindCoaches(data.current.id);
      setNotice({ type: "ok", text: `${r.coaches} koça özet gönderildi (${r.students} öğrenci).` });
      load();
    } catch (e) {
      setNotice({ type: "error", text: e.message || "Gönderilemedi" });
    } finally {
      setBusy(false);
    }
  };

  const publishNext = async () => {
    const next = data.nextDraft;
    const reach = next.schoolWide
      ? `okuldaki ${countFor(data, next.gradeLevel)} ${next.gradeLevel ? `${next.gradeLevel}. sınıf öğrencisine` : "öğrenciye"}`
      : `yalnızca kendi ${next.gradeLevel ? `${next.gradeLevel}. sınıf ` : ""}öğrencilerine`;
    if (!(await confirmDialog({ title: "Konu yayınlansın mı?", message: `“${next.topic}” ${reach} gönderilecek. Bu işlem geri alınamaz.`, confirmLabel: "Yayınla" }))) return;
    setBusy(true);
    try {
      await api.publishPlanEntry(next.id);
      setNotice({ type: "ok", text: "Yayınlandı — öğrencilere bildirim gitti." });
      load();
    } catch (e) {
      setNotice({ type: "error", text: e.message || "Yayınlanamadı" });
    } finally {
      setBusy(false);
    }
  };

  const page = (children) => <div className="k-page k-page-form" style={{ padding: 28, maxWidth: 760, margin: "0 auto" }}>{children}</div>;
  if (error) return page(<EmptyState text={error} />);
  if (tracks && !tracks.length) {
    return page(<EmptyState text="Henüz branşında bir plan ya da okul çapında ödev yok. Yıllık planına konu ekleyerek başlayabilirsin." action={<Button onClick={onOpenPlan}>Yıllık planı aç</Button>} />);
  }
  if (loading || !data) return page(<LoadingState />);

  const cur = data.current;
  const skipTotal = cur ? Object.values(cur.skipReasons).reduce((a, b) => a + b, 0) : 0;
  const konu = cur?.skipReasons.KONU || 0;
  const diagnose = cur && cur.successPct != null && cur.successPct < 50 && konu >= 3;
  // Plan listesinin penceresi: yayınlanmış son iki hafta + sıradaki üç konu; tamamı takvimde.
  const planIdx = data.plan.findIndex((p) => p.state !== "kapandı");
  const start = Math.max(0, (planIdx === -1 ? data.plan.length : planIdx) - 2);
  const planWindow = data.plan.slice(start, start + 5);
  const stateStyle = { kapandı: { color: C.green, weight: 600 }, açık: { color: C.text, weight: 700 }, taslak: { color: C.mutedLight, weight: 500 } };
  const reminderSentRecently = cur?.coachReminderSentAt && Date.now() - new Date(cur.coachReminderSentAt).getTime() < 24 * 3600e3;

  return (
    <div className="k-page k-page-form" style={{ padding: 28, maxWidth: 760, margin: "0 auto" }}>
      {tracks.length > 1 && (
        <div className="k-chip-row" role="group" aria-label="Ders" style={{ marginBottom: 14 }}>
          {tracks.map((t) => (
            <Chip key={`${t.examType}-${t.subject}`} active={track?.examType === t.examType && track?.subject === t.subject} onClick={() => setTrack(t)}>{t.examType} {t.subject}</Chip>
          ))}
        </div>
      )}
      {notice && <div role={notice.type === "error" ? "alert" : "status"} style={{ marginBottom: 12, padding: "11px 14px", borderRadius: 12, background: notice.type === "error" ? C.redSoft : C.greenSoft, color: notice.type === "error" ? C.red : C.green, fontFamily: bodyFont, fontSize: 13, fontWeight: 600 }}>{notice.text}</div>}

      {cur ? (
        <>
          <CurrentCard cur={cur} studentCount={countFor(data, cur.targetGrade)} />
          <DistributionCard cur={cur} prev={data.previous} />
          {diagnose && (
            <AlertBox style={{ marginTop: 12 }} title={`Pas geçen ${konu} öğrenci konuyu bilmediğini söyledi`}>
              Ortalamanın düşük olması (%{cur.successPct}) tek başına “zor konu” demek olabilir; “bilmiyorum” sebebiyle birleşince konu sınıfa oturmamış görünüyor. Sıradaki haftalardan birine tekrar eklemek mantıklı.
            </AlertBox>
          )}
          {skipTotal > 0 && (
            <>
              <SectionHeader title="Pas sebepleri · kime ait" />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Object.entries(cur.skipReasons).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([key, n]) => (
                  <Card key={key} style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{ fontFamily: monoFont, fontSize: 20, fontWeight: 700, color: OWNERS[key].color(), minWidth: 24 }}>{n}</span>
                    <span style={{ flex: 1, fontFamily: bodyFont, fontSize: 15, color: C.text }}>“{SKIP_REASONS[key]}”</span>
                    <span style={{ fontFamily: bodyFont, fontSize: 12.5, fontWeight: 700, color: OWNERS[key].color() }}>{OWNERS[key].label}</span>
                  </Card>
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <EmptyState text="Bu derste henüz okul çapında bir ödev yayınlamadın — aşağıdan sıradaki konuyu yayınlayabilirsin." />
      )}

      <SectionHeader title="Yıllık planım" action={{ label: `${data.plan.length} hafta · takvimi aç`, onClick: onOpenPlan }} />
      {data.plan.length === 0 ? (
        <EmptyState compact text="Bu derste plan kaydı yok." />
      ) : (
        <ListGroup>
          {planWindow.map((p) => (
            <ListRow
              key={p.id}
              left={
                <span style={{ width: 44, height: 44, borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0, lineHeight: 1.1 }}>
                  <span style={{ fontFamily: monoFont, fontSize: 14, fontWeight: 700, color: C.text2 }}>{shortDate(p.date).split(" ")[0]}</span>
                  <span style={{ fontFamily: bodyFont, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6, color: C.mutedLight }}>{(shortDate(p.date).split(" ")[1] || "").toLocaleUpperCase("tr-TR")}</span>
                </span>
              }
              title={p.topic}
              strong={p.state === "açık"}
              right={<span style={{ fontFamily: bodyFont, fontSize: 12.5, fontWeight: stateStyle[p.state].weight, color: stateStyle[p.state].color, flexShrink: 0 }}>{p.state}</span>}
              onClick={onOpenPlan}
            />
          ))}
        </ListGroup>
      )}

      {cur && data.nonSubmitters && data.nonSubmitters.count > 0 && (
        <>
          <SectionHeader title={`Sonuç girmeyen ${data.nonSubmitters.count} öğrenci`} right="koçlarına düşer" />
          <Card>
            <div style={{ fontFamily: bodyFont, fontSize: 14, color: C.text2, lineHeight: 1.55 }}>
              Bu {data.nonSubmitters.count} öğrencinin takibi sende değil, kendi koçlarında. Liste {data.nonSubmitters.coachCount} koça dağılıyor{data.nonSubmitters.withoutCoach ? ` (${data.nonSubmitters.withoutCoach} öğrencinin koçu yok)` : ""}.
            </div>
            <div style={{ marginTop: 14 }}>
              <Button full variant="secondary" disabled={busy || reminderSentRecently || !data.nonSubmitters.coachCount} onClick={remindCoaches}>
                {reminderSentRecently ? "Koçlara bugün özet gönderildi" : "Koçlara özet gönder"}
              </Button>
            </div>
          </Card>
        </>
      )}

      {data.nextDraft && (
        <BottomActionBar caption={<>{data.nextDraft.schoolWide ? <><span style={{ fontFamily: monoFont }}>{countFor(data, data.nextDraft.gradeLevel)}</span> {data.nextDraft.gradeLevel ? `${data.nextDraft.gradeLevel}. sınıf öğrencisine` : "öğrenciye"} gider</> : "Yalnızca kendi öğrencilerine gider"} · bildirim hemen gider (gece yayınlarsan sabah 07:00'de)</>}>
          <Button full disabled={busy} onClick={publishNext}>{shortDate(data.nextDraft.date)} konusunu yayınla</Button>
        </BottomActionBar>
      )}
    </div>
  );
}
