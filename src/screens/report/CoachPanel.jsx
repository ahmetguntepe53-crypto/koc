import { useEffect, useRef, useState } from "react";
import { Copy, Check, Sparkles, RefreshCw } from "lucide-react";
import { C } from "../../theme.js";
import { Card, Chip, Button, Pill } from "../../components/common.jsx";
import { api } from "../../api.js";
import { fmtPct, fmtDay } from "../../reportModel.js";
import { Collapsible, mono, text } from "./parts.jsx";
import { monthLabel, recentMonths, defaultReportMonth } from "../teacher/MonthlyReportsScreen.jsx";

// Koç paneli — yalnız koçun açtığı raporda. Durum çipi öğrenciye hiçbir zaman gösterilmez; "güven" ya da "hile"
// imasıyla hiçbir metin üretilmez (fotoğraf oranı nötr bir sayıdır).
const STATUS_TONE = { intervene: "red", watch: "amber", ok: "green" };

function Kpi({ label, value, color }) {
  return (
    <div style={{ background: C.surface2, borderRadius: 12, padding: "10px 11px", minWidth: 0 }}>
      <div style={{ ...mono(16, 700, color || C.text), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
      <div style={{ ...text(11.5, 500, C.mutedLight), marginTop: 3 }}>{label}</div>
    </div>
  );
}

export default function CoachPanel({ model, studentId, aiMonth, onAiLoaded, onOpenAssignment }) {
  const c = model.coach;
  const [copied, setCopied] = useState(false);
  const seenColor = c.lastSeenDays == null ? C.mutedLight : c.lastSeenDays > 7 ? C.red : c.lastSeenDays > 3 ? C.amber : C.text;
  const dn = c.dataNotes;
  const copyAgenda = async () => {
    const txt = c.agenda.map((a, i) => `${i + 1}. ${a}`).join("\n");
    try {
      await navigator.clipboard.writeText(txt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* pano izni yoksa sessizce geç */ }
  };
  return (
    <>
      <Card style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <Pill tone={STATUS_TONE[c.status]}>{c.statusLabel}</Pill>
          <span style={{ ...text(12.5, 500, C.text2), minWidth: 0 }}>{c.reasons.join(" · ") || "belirgin bir sorun yok"}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
          <Kpi label="Son giriş" value={c.lastSeenDays == null ? "—" : c.lastSeenDays === 0 ? "bugün" : `${c.lastSeenDays} gün`} color={seenColor} />
          <Kpi label="Son kayıt" value={c.lastRecordDays == null ? "yok" : c.lastRecordDays === 0 ? "bugün" : `${c.lastRecordDays} gün`} color={c.lastRecordDays >= 7 ? C.red : undefined} />
          <Kpi label="Sessiz (28 g)" value={c.silent28} color={c.silent28 ? C.red : undefined} />
          <Kpi label="Teslim okul/kişisel" value={`${fmtPct(c.school.deliveredPct)}/${fmtPct(c.personal.deliveredPct)}`} />
          <Kpi label="Hatırlatma sonrası" value={c.afterReminder.total ? `${c.afterReminder.done}/${c.afterReminder.total}` : "—"} />
          <Kpi label="Seri" value={`${c.streak} hf`} />
        </div>
        {c.personalLoad && <div style={{ ...text(12.5, 600, C.amber), marginTop: 10 }}>Kişisel ödev yükü fazla olabilir: kişisel ödevde teslim okul ödevinden en az 20 puan düşük.</div>}
      </Card>

      <Card style={{ padding: 16, marginTop: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ ...text(14, 700), flex: 1 }}>Görüşme gündemi</span>
          <button type="button" onClick={copyAgenda} aria-label="Gündemi kopyala" className="k-btn"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 36, padding: "0 10px", borderRadius: 10, background: "transparent", border: `1px solid ${C.borderStrong}`, cursor: "pointer", ...text(12.5, 700, C.text2) }}>
            {copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Kopyalandı" : "Kopyala"}
          </button>
        </div>
        <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
          {c.agenda.map((a, i) => <li key={i} style={{ ...text(13, 500, C.text2), lineHeight: 1.5 }}>{a}</li>)}
        </ol>
      </Card>

      {c.notes.length > 0 && (
        <Collapsible title="Öğrencinin notları" count={c.notes.length} defaultOpen>
          {c.notes.map((n, i) => (
            <button key={i} type="button" onClick={() => onOpenAssignment?.(n.assignmentId)} className="k-list-row"
              style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderTop: `1px solid ${C.divider}`, padding: "10px 0", cursor: onOpenAssignment ? "pointer" : "default" }}>
              <div style={{ ...text(13, 500, C.text), fontStyle: "italic" }}>“{n.text}”</div>
              <div style={{ ...text(11.5, 500, C.mutedLight), marginTop: 3 }}>{n.kind === "pas" ? "Pas notu" : "Teslim notu"} · {n.name} · {n.topic} · <span style={mono(11, 600, C.mutedLight)}>{n.day != null ? fmtDay(n.day) : ""}</span></div>
            </button>
          ))}
        </Collapsible>
      )}

      <Collapsible title="Veri notları">
        <div style={{ display: "flex", flexDirection: "column", gap: 6, ...text(12.5, 500, C.text2) }}>
          {dn.approx && <div style={{ fontWeight: 700 }}>Bu dönemin oranlarını yaklaşık kabul edin.</div>}
          <div>Fotoğraflı teslim: <span style={mono(12.5)}>{fmtPct(dn.photoRate)}</span></div>
          <div>Kısmi teslim: <span style={mono(12.5)}>{fmtPct(dn.partialRate)}</span> · fazla giriş: <span style={mono(12.5)}>{fmtPct(dn.overRate)}</span> <span style={{ color: C.mutedLight }}>({dn.withE} ödevde beklenen soru biliniyor)</span></div>
          <div>Serbest çalışma net oranı <span style={mono(12.5)}>{fmtPct(dn.freeNO)}</span> · ödev <span style={mono(12.5)}>{fmtPct(dn.hwNO)}</span></div>
          <div>Eşleşmeyen konu kaydı: <span style={mono(12.5)}>{dn.unmatched}</span></div>
          {dn.untracked.length > 0 && <div>Takip dışı AYT dersleri: {dn.untracked.map((u) => `${u.name} (${u.schoolItems} okul ödevi, ${u.records} kayıt)`).join(" · ")}</div>}
        </div>
      </Collapsible>

      <AiCard studentId={studentId} initialMonth={aiMonth} onLoaded={onAiLoaded} />
    </>
  );
}

// Yapay zekâ incelemesi — okul açmadıkça kapalı; modele yalnız kimliksiz aylık özet gider (server/src/monthlySummary.js).
function AiCard({ studentId, initialMonth, onLoaded }) {
  const [month, setMonth] = useState(initialMonth || defaultReportMonth());
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const seq = useRef(0);
  useEffect(() => { if (initialMonth) setMonth(initialMonth); }, [initialMonth]);
  useEffect(() => {
    const my = ++seq.current;
    setState(null);
    setError("");
    setBusy(false);
    api.getAiAnalysis(studentId, month)
      .then((d) => { if (my === seq.current) { setState(d); onLoaded?.(d.analysis ? { ...d.analysis.content, generatedAt: d.analysis.updatedAt, month } : null); } })
      .catch((e) => { if (my === seq.current) { setState({ enabled: false, configured: false, analysis: null }); setError(e.message || ""); } });
  }, [studentId, month]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (refresh) => {
    const my = ++seq.current;
    const forMonth = month;
    setBusy(true);
    setError("");
    try {
      const d = await api.createAiAnalysis(studentId, forMonth, refresh);
      // Beklerken başka aya geçildiyse eski ayın sonucu yeni ayın altında gösterilmez.
      if (my !== seq.current) return;
      setState(d);
      onLoaded?.(d.analysis ? { ...d.analysis.content, generatedAt: d.analysis.updatedAt, month: forMonth } : null);
    } catch (e) {
      if (my === seq.current) setError(e.message || "İnceleme hazırlanamadı.");
    } finally {
      if (my === seq.current) setBusy(false);
    }
  };
  const a = state?.analysis?.content;
  const canRefresh = state?.analysis && Date.now() - new Date(state.analysis.updatedAt).getTime() > 3600e3;
  return (
    <Card style={{ padding: 16, marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Sparkles size={16} color={C.koc} aria-hidden="true" />
        <span style={{ ...text(14, 700), flex: 1 }}>Yapay zekâ incelemesi</span>
      </div>
      <div className="k-chip-row" role="group" aria-label="İncelenecek ay" style={{ margin: "10px 0 4px" }}>
        {recentMonths().map((m) => <Chip key={m} active={m === month} onClick={() => setMonth(m)}>{monthLabel(m).split(" ")[0]}</Chip>)}
      </div>
      {!state ? (
        <div style={{ ...text(12.5, 500, C.mutedLight), padding: "8px 0" }}>Yükleniyor…</div>
      ) : !state.enabled ? (
        <div style={{ ...text(12.5, 500, C.mutedLight), lineHeight: 1.5, paddingTop: 6 }}>Okulda kapalı. Okul yönetimi Kurulum › Sistem'den açabilir.</div>
      ) : !state.configured ? (
        <div style={{ ...text(12.5, 500, C.mutedLight), lineHeight: 1.5, paddingTop: 6 }}>Yapay zekâ hizmeti sunucuda henüz yapılandırılmamış.</div>
      ) : !a ? (
        <div style={{ paddingTop: 8 }}>
          <div style={{ ...text(12.5, 500, C.text2), lineHeight: 1.5, marginBottom: 10 }}>{monthLabel(month)} sonuçlarını inceleyip sana güçlü yönler, gelişim alanları ve somut adımlar önerir. Modele ad ve kimlik bilgisi gönderilmez.</div>
          <Button small icon={Sparkles} disabled={busy} onClick={() => run(false)}>{busy ? "Hazırlanıyor…" : "İncelemeyi hazırla"}</Button>
        </div>
      ) : (
        <div style={{ paddingTop: 6, display: "flex", flexDirection: "column", gap: 12 }}>
          {a.veriYeterliligi && a.veriYeterliligi !== "yeterli" && <Pill tone="amber">{a.veriYeterliligi === "sinirli" ? "veri sınırlı" : "veri yetersiz"}</Pill>}
          <div style={{ ...text(13.5, 500, C.text), lineHeight: 1.55 }}>{a.ozet}</div>
          {a.gucluYonler?.length > 0 && (
            <div>
              <div style={{ ...text(12, 700, C.green), marginBottom: 4 }}>Güçlü yönler</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>{a.gucluYonler.map((g, i) => <li key={i} style={{ ...text(13, 500, C.text2), lineHeight: 1.5 }}>{g}</li>)}</ul>
            </div>
          )}
          {a.gelisimAlanlari?.length > 0 && (
            <div>
              <div style={{ ...text(12, 700, C.amber), marginBottom: 4 }}>Gelişim alanları</div>
              {a.gelisimAlanlari.map((g, i) => (
                <div key={i} style={{ padding: "6px 0", borderTop: i ? `1px solid ${C.divider}` : "none" }}>
                  <div style={text(13, 700)}>{g.alan}</div>
                  <div style={{ ...text(12, 500, C.mutedLight), marginTop: 2 }}>Kanıt: {g.kanit}</div>
                  <div style={{ ...text(12.5, 500, C.text2), marginTop: 2 }}>Öneri: {g.oneri}</div>
                </div>
              ))}
            </div>
          )}
          {a.kocaOneriler?.length > 0 && (
            <div>
              <div style={{ ...text(12, 700, C.text2), marginBottom: 4 }}>Önümüzdeki ay için</div>
              <ol style={{ margin: 0, paddingLeft: 18 }}>{a.kocaOneriler.map((g, i) => <li key={i} style={{ ...text(13, 500, C.text2), lineHeight: 1.5 }}>{g}</li>)}</ol>
            </div>
          )}
          {a.ogrenciyleKonusma && <div style={{ ...text(12.5, 500, C.text2), lineHeight: 1.5 }}><b>Görüşme için:</b> {a.ogrenciyleKonusma}</div>}
          {a.dikkat?.length > 0 && <div style={{ ...text(12.5, 600, C.amber), lineHeight: 1.5 }}>Dikkat: {a.dikkat.join(" · ")}</div>}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ ...text(11.5, 500, C.mutedLight), flex: 1, minWidth: 180 }}>Yapay zekâ önerisidir; son karar senin. Modele kimlik bilgisi gönderilmez.</span>
            {canRefresh && <Button small variant="secondary" icon={RefreshCw} disabled={busy} onClick={() => run(true)}>{busy ? "Hazırlanıyor…" : "Yeniden oluştur"}</Button>}
          </div>
        </div>
      )}
      {error && <div role="alert" style={{ ...text(12.5, 600, C.red), marginTop: 8 }}>{error}</div>}
    </Card>
  );
}
