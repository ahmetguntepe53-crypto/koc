import { useState } from "react";
import { Plus, Pencil, Trash2, Target, ArrowUp, ArrowDown, ArrowRight } from "lucide-react";
import { C } from "../../theme.js";
import { Card, Button, Pill, confirmDialog, alertDialog, ShowMoreButton } from "../../components/common.jsx";
import { api } from "../../api.js";
import { fmtNet, fmtInt, fmtDay } from "../../reportModel.js";
import { Section, mono, text } from "./parts.jsx";
import DenemeChart from "./DenemeChart.jsx";
import DenemeForm from "./DenemeForm.jsx";

// Gelişim raporu > "Denemeler" bölümü (Özet'in hemen ardından, öğrenci ve koç görünümünde aynı). Model:
// model.denemeler (src/practiceExams.js > buildDenemeler). Deneme neti gerçek sınav netidir — burada yüzde değil net
// gösterilir ("TYT 78,5 net"); puan/sıralama tahmini yok. Renkler: artış yeşil; düşüş koçta amber, öğrencide nötr
// (öğrenciye olumsuz vurgu yapılmaz ama sayı gizlenmez); negatif net kırmızı; en çok net kaçan ders amber "fırsat".
const LIST_STEP = 5;

export default function Denemeler({ model, isCoach, canAdd, studentId, field, onChanged }) {
  const d = model.denemeler;
  const [exam, setExam] = useState(d.latestType);
  const [form, setForm] = useState(null); // { exam: model denemesi | null, type }
  const [shown, setShown] = useState(LIST_STEP);
  const s = d[exam];
  const openNew = () => setForm({ exam: null, type: exam });

  const remove = async (e) => {
    const ok = await confirmDialog({
      title: "Denemeyi sil",
      message: `${e.examType} · ${fmtDay(e.day, { year: true })}${e.name ? ` · ${e.name}` : ""} (${fmtNet(e.net)} net) silinsin mi? Bu işlem geri alınamaz.`,
      confirmLabel: "Sil", danger: true,
    });
    if (!ok) return;
    try {
      await api.deletePracticeExam(e.id);
      onChanged?.();
    } catch (err) {
      alertDialog({ title: "Silinemedi", message: err.message || "Deneme silinemedi — lütfen tekrar dene." });
    }
  };

  const formEl = form && (
    <DenemeForm exam={form.exam} defaultType={form.type} studentId={isCoach ? studentId : undefined} field={field}
      onClose={() => setForm(null)}
      onSaved={(saved) => { setForm(null); if (saved?.examType) setExam(saved.examType); onChanged?.(); }} />
  );
  const info = "Deneme neti gerçek sınav netidir: Net = D − Y/4 (4 yanlış 1 doğruyu götürür). Ödevlerdeki net oranıyla karıştırılmaz. Kaçan net = dersin soru sayısı − net; yanlış soru hem kendini hem çeyrek doğruyu götürür. Puan ya da sıralama tahmini yapılmaz.";

  if (d.all === 0) {
    return (
      <Section id="denemeler" title="Denemeler" info={info}>
        <Card style={{ padding: 18 }}>
          <div style={{ ...text(15, 700), marginBottom: 6 }}>Henüz deneme kaydı yok</div>
          <div style={{ ...text(13, 500, C.text2), lineHeight: 1.55 }}>
            {isCoach
              ? "Öğrencinin TYT/AYT denemelerini ders ders girdiğinizde net gelişimi, ders bazında değişim ve en çok net kaçan ders burada görünür."
              : "TYT/AYT denemelerini ders ders girdiğinde net gelişimin, ders bazında değişimin ve en çok net kaçırdığın ders burada görünür."}
          </div>
          {canAdd && <Button small icon={Plus} style={{ marginTop: 14 }} onClick={openNew}>Deneme ekle</Button>}
        </Card>
        {formEl}
      </Section>
    );
  }

  const chartExams = s.history.slice(-12);
  const lastEver = s.history[s.history.length - 1] || null;
  const list = [...s.list].reverse();

  return (
    <Section id="denemeler" title="Denemeler" info={info} right={<ExamTabs exam={exam} setExam={(e) => { setExam(e); setShown(LIST_STEP); }} counts={{ TYT: d.TYT.history.length, AYT: d.AYT.history.length }} />}>
      {!s.history.length ? (
        <Card style={{ padding: 16 }}>
          <div style={{ ...text(13.5, 500, C.text2), lineHeight: 1.5 }}>Henüz {exam} denemesi girilmedi.</div>
          {canAdd && <Button small icon={Plus} style={{ marginTop: 12 }} onClick={openNew}>{exam} denemesi ekle</Button>}
        </Card>
      ) : (
        <>
          <LastCard s={s} exam={exam} isCoach={isCoach} lastEver={lastEver} />

          <Card style={{ padding: "14px 12px 8px", marginTop: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, padding: "0 4px", flexWrap: "wrap" }}>
              <span style={{ ...text(13, 700), flex: 1 }}>Toplam net</span>
              <TotalTrend trend={s.trend} isCoach={isCoach} />
            </div>
            {chartExams.length < 2
              ? <div style={{ ...text(13, 500, C.mutedLight), padding: "18px 4px" }}>Grafik için en az 2 deneme gerekiyor ({chartExams.length}/2).</div>
              : <DenemeChart exams={chartExams} scaleMax={s.scaleMax} />}
            {s.history.length > chartExams.length && <div style={{ ...text(11.5, 500, C.mutedLight), padding: "2px 4px 6px" }}>Son 12 deneme gösteriliyor.</div>}
          </Card>

          {s.bySubject.length > 0 && <SubjectTable s={s} exam={exam} />}
          {s.lossTop && <LossCard loss={s.lossTop} isCoach={isCoach} />}
        </>
      )}

      {s.history.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <span style={{ ...text(12, 700, C.text2), flex: 1 }}>Bu aralıktaki {exam} denemeleri <span style={mono(12, 700, C.mutedLight)}>{list.length}</span></span>
            {canAdd && <Button small icon={Plus} onClick={openNew}>Deneme ekle</Button>}
          </div>
          {list.length === 0 ? (
            <div style={{ ...text(13, 500, C.mutedLight), padding: "10px 0" }}>Seçili aralıkta {exam} denemesi yok.</div>
          ) : (
            <div className="k-bleed" style={{ borderBottom: `1px solid ${C.divider}` }}>
              {list.slice(0, shown).map((e) => (
                <ExamRow key={e.id} e={e} isCoach={isCoach} canAdd={canAdd} onEdit={() => setForm({ exam: e, type: e.examType })} onDelete={() => remove(e)} />
              ))}
            </div>
          )}
          <ShowMoreButton remaining={list.length - shown} onClick={() => setShown((n) => n + LIST_STEP)} />
        </div>
      )}
      {formEl}
    </Section>
  );
}

// TYT/AYT sekmeleri raporun diğer sekmeleriyle aynı görünümde; deneme sayısı ekran okuyucuya "TYT, 5 deneme" diye okunur.
function ExamTabs({ exam, setExam, counts }) {
  return (
    <div role="group" aria-label="Deneme türü" style={{ display: "flex", gap: 4, background: C.surface2, borderRadius: 10, padding: 3 }}>
      {["TYT", "AYT"].map((e) => (
        <button key={e} type="button" aria-pressed={exam === e} aria-label={counts[e] ? `${e}, ${counts[e]} deneme` : e} onClick={() => setExam(e)}
          style={{ minHeight: 30, minWidth: 44, padding: "0 10px", borderRadius: 8, border: "none", cursor: "pointer", background: exam === e ? C.accent : "transparent", ...text(12.5, 700, exam === e ? C.onAccent : C.text2) }}>
          {e}{counts[e] ? <span style={{ ...mono(11, 600, exam === e ? C.onAccent : C.mutedLight), marginLeft: 4 }}>{counts[e]}</span> : null}
        </button>
      ))}
    </div>
  );
}

// Değişim: artış yeşil ↑; düşüş koçta amber ↓, öğrencide nötr (sayı yine yazılır); değişmedi nötr.
function Delta({ value, isCoach, suffix }) {
  if (value == null) return null;
  const r = Math.round(value * 100) / 100;
  const up = r > 0, down = r < 0;
  const color = up ? C.green : down && isCoach ? C.amber : C.mutedLight;
  const Icon = up ? ArrowUp : down ? ArrowDown : ArrowRight;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, ...mono(12.5, 700, color), whiteSpace: "nowrap" }}>
      <Icon size={13} strokeWidth={2.4} aria-hidden="true" />
      {r === 0 ? "aynı" : `${up ? "+" : ""}${fmtNet(r)} net`}{suffix ? <span style={text(12, 500, C.mutedLight)}>&nbsp;{suffix}</span> : null}
    </span>
  );
}

function LastCard({ s, exam, isCoach, lastEver }) {
  const L = s.last;
  if (!L) {
    return (
      <Card style={{ padding: 16 }}>
        <div style={{ ...text(13.5, 500, C.text2), lineHeight: 1.5 }}>
          Seçili aralıkta {exam} denemesi yok. Son deneme <span style={mono(13, 600, C.text2)}>{fmtDay(lastEver.day, { year: true })}</span>: <span style={mono(13.5, 700)}>{fmtNet(lastEver.net)} net</span>.
        </div>
      </Card>
    );
  }
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ ...text(10.5, 700, C.mutedLight), letterSpacing: 1.2, flex: 1 }}>SON DENEME</span>
        {s.record && <Pill tone="green">Kişisel rekor</Pill>}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
        <span style={text(15, 700, C.text2)}>{exam}</span>
        <span style={{ ...mono(28, 700, L.net < 0 ? C.red : C.text), letterSpacing: -0.8 }}>{fmtNet(L.net)}</span>
        <span style={text(14, 600, C.text2)}>net</span>
        <span style={{ marginLeft: 4 }}><Delta value={s.deltaVsPrev} isCoach={isCoach} suffix="önceki denemeye göre" /></span>
      </div>
      <div style={{ ...text(12.5, 500, C.mutedLight), marginTop: 4 }}>
        {L.name || "Adı girilmemiş deneme"} · <span style={mono(12, 600, C.mutedLight)}>{fmtDay(L.day, { year: true })}</span> · <span style={mono(12, 600, C.mutedLight)}>{fmtInt(L.Q)}/{fmtInt(L.max)}</span> soru
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 12 }}>
        <Stat label="En iyi" value={`${fmtNet(s.best.net)} net`} />
        <Stat label={s.avgCount === 1 ? "Ortalama" : `Son ${s.avgCount} ortalama`} value={`${fmtNet(Math.round(s.avgLast3 * 100) / 100)} net`} />
        <Stat label="Deneme" value={fmtInt(s.n)} />
      </div>
    </Card>
  );
}
function Stat({ label, value }) {
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <span style={mono(15, 700)}>{value}</span>
      <span style={text(11.5, 500, C.mutedLight)}>{label}</span>
    </span>
  );
}

function TotalTrend({ trend, isCoach }) {
  if (!trend?.enough) return <span style={text(11.5, 500, C.mutedLight)}>eğilim için en az 3 deneme</span>;
  if (trend.dir === "down" && !isCoach) return null;
  const label = { up: "Yükselişte", flat: "Sabit", down: "Düşüşte" }[trend.dir];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={text(12, 600, trend.dir === "up" ? C.green : trend.dir === "down" ? C.amber : C.mutedLight)}>{label}</span>
      {trend.dir !== "flat" && <Delta value={trend.delta} isCoach={isCoach} />}
    </span>
  );
}

// Ders ders: son deneme / ortalama (penceredeki denemeler) / dersin soru sayısı (TYT 120'lik, AYT 160'lık düzen).
function SubjectTable({ s, exam }) {
  const cell = { padding: "8px 0", borderTop: `1px solid ${C.divider}` };
  const num = (v) => <span style={mono(13, 700, v < 0 ? C.red : C.text)}>{fmtNet(Math.round(v * 100) / 100)}</span>;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ ...text(12, 700, C.text2), marginBottom: 2 }}>Ders ders ({s.n > 1 ? `${s.n} deneme` : "tek deneme"})</div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <caption style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{exam} denemelerinde ders ders net</caption>
        <thead>
          <tr style={text(11.5, 600, C.mutedLight)}>
            <th scope="col" style={{ textAlign: "left", fontWeight: 600, padding: "4px 0" }}>Ders</th>
            <th scope="col" style={{ textAlign: "right", fontWeight: 600, width: 56 }}>Son</th>
            <th scope="col" style={{ textAlign: "right", fontWeight: 600, width: 56 }}>Ort.</th>
            <th scope="col" style={{ textAlign: "right", fontWeight: 600, width: 52 }}>Soru</th>
          </tr>
        </thead>
        <tbody>
          {s.bySubject.map((r) => (
            <tr key={r.subject}>
              <th scope="row" style={{ ...cell, textAlign: "left", ...text(13, 600), overflow: "hidden", textOverflow: "ellipsis" }}>{r.shortLabel}</th>
              <td style={{ ...cell, textAlign: "right" }}>{num(r.lastNet)}</td>
              <td style={{ ...cell, textAlign: "right" }}>{num(r.avgNet)}</td>
              <td style={{ ...cell, textAlign: "right" }}><span style={mono(12.5, 600, C.mutedLight)}>{r.max}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LossCard({ loss, isCoach }) {
  const parts = [];
  if (loss.wrongLost >= 0.25) parts.push(`yanlıştan ${fmtNet(Math.round(loss.wrongLost * 100) / 100)}`);
  if (loss.blankLost >= 0.25) parts.push(`boştan ${fmtNet(Math.round(loss.blankLost * 100) / 100)}`);
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", borderRadius: 14, background: C.amberSoft, border: `1px solid ${C.amber}44`, marginTop: 12 }}>
      <Target size={16} color={C.amber} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
      <div style={{ minWidth: 0 }}>
        <div style={{ ...text(13.5, 700), lineHeight: 1.4 }}>{isCoach ? "En çok net kaçan ders" : "En çok net kaçırdığın ders"}: {loss.label}</div>
        <div style={{ ...text(12.5, 500, C.text2), marginTop: 3, lineHeight: 1.5 }}>
          Son <span style={mono(12.5, 600, C.text2)}>{loss.n}</span> denemede <span style={mono(12.5, 600, C.text2)}>{loss.max}</span> sorudan ortalama <span style={mono(12.5, 700)}>{fmtNet(Math.round(loss.avgNet * 100) / 100)}</span> net;
          {" "}<span style={mono(12.5, 700)}>{fmtNet(Math.round(loss.avgLost * 100) / 100)}</span> net kazanma fırsatı{parts.length ? <> (<span style={mono(12.5, 600, C.text2)}>{parts.join(", ")}</span>)</> : null}.
        </div>
      </div>
    </div>
  );
}

function ExamRow({ e, isCoach, canAdd, onEdit, onDelete }) {
  const editable = canAdd && e.canEdit;
  const iconBtn = (Icon, label, onClick) => (
    <button type="button" aria-label={label} onClick={onClick} className="k-icon-btn"
      style={{ width: 44, height: 44, borderRadius: 12, border: "none", background: "transparent", color: C.mutedLight, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <Icon size={17} />
    </button>
  );
  const title = e.name || "Adı girilmemiş deneme";
  const aria = `${fmtDay(e.day, { year: true })} tarihli ${e.examType} denemesini`;
  return (
    <div className="k-list-row" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 0", borderTop: `1px solid ${C.divider}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...text(13.5, 600), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
          <span style={mono(11.5, 600, C.mutedLight)}>{fmtDay(e.day, { year: true })} · D {e.D} · Y {e.Y} · B {e.B}</span>
          {!isCoach && !e.canEdit && <Pill>koçun girdi</Pill>}
          {isCoach && e.byStudent && <Pill>öğrenci girdi</Pill>}
        </div>
      </div>
      <span style={{ ...mono(15, 700, e.net < 0 ? C.red : C.text), whiteSpace: "nowrap" }}>{fmtNet(e.net)} <span style={text(12, 600, C.text2)}>net</span></span>
      {editable && iconBtn(Pencil, `${aria} düzenle`, onEdit)}
      {editable && iconBtn(Trash2, `${aria} sil`, onDelete)}
    </div>
  );
}

