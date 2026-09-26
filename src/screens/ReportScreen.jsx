import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, BarChart3, Flame, Sparkles, Target, AlertTriangle, X, Check, Plus, Send, ChevronRight, ClipboardList, PauseCircle } from "lucide-react";
import { C, SKIP_REASONS } from "../theme.js";
import { Card, Chip, EmptyState, LoadingState, SegmentBar, Legend, Pill, Button, Modal, HeaderTextButton, HEADER_SLOT_ID, SubjectIcon } from "../components/common.jsx";
import { api } from "../api.js";
import { subjectIconUrl } from "../subjects.js";
import {
  buildReport, WINDOWS, monthWindowKey, LABELS, PROFILES, SKIP_LABEL, SKIP_OWNER, fmtPct, fmtInt, fmtDec, fmtSignedPct, fmtDay, isRecHidden, recHideKey,
  pickRecs, STUDENT_SCREEN,
} from "../reportModel.js";
import { Section, LabelChip, TrendMark, NoValue, DybBar, Sparkline, Mini, Collapsible, GoalBar, SmallButton, mono, text } from "./report/parts.jsx";
import TrendChart from "./report/TrendChart.jsx";
import SubjectDetail from "./report/SubjectDetail.jsx";
import CoachPanel from "./report/CoachPanel.jsx";
import Denemeler from "./report/Denemeler.jsx";
import StudentNarrativeCard from "./report/StudentNarrative.jsx";
import { monthLabel } from "./teacher/MonthlyReportsScreen.jsx";

// Gelişim raporu — öğrencinin "Gelişim" sekmesi ve koçun öğrenci detayı aynı ekranı ve aynı modeli (src/reportModel.js)
// kullanır. Bölüm sırası: Özet → Denemeler → Öneriler → (koç) Koç paneli / (öğrenci) Ayın değerlendirmesi → Ders karnesi →
// Ödev düzeni → Konu analizi → Gelişim trendi → Net nereden kaçıyor → Kapsam ve telafi. PDF bu bölümlerin tam hâlidir
// (src/reportPdf.js).
const HIDE_KEY = "kocluk-report-hidden";
function readHidden() {
  try { return JSON.parse(localStorage.getItem(HIDE_KEY) || "{}") || {}; } catch { return {}; }
}
function writeHidden(v) {
  try { localStorage.setItem(HIDE_KEY, JSON.stringify(v)); } catch { /* gizleme yalnızca kolaylık */ }
}
const scrollToSection = (id) => document.getElementById(`rapor-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

export default function ReportScreen({ user, studentId: fixedStudentId, studentName: fixedStudentName, month, onOpenRecipient, onOpenStudyLog, onAssign, onOpenAssignment, onOpenHome }) {
  const isCoach = user.role !== "STUDENT";
  const studentId = isCoach ? fixedStudentId : undefined;
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [windowKey, setWindowKey] = useState(month ? monthWindowKey(month) : "4w");
  const [exam, setExam] = useState("TYT");
  const [detailKey, setDetailKey] = useState(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [ai, setAi] = useState(null);
  const [narrative, setNarrative] = useState(null);
  const [hidden, setHidden] = useState(readHidden);
  const [headerSlot, setHeaderSlot] = useState(null);
  useEffect(() => setHeaderSlot(document.getElementById(HEADER_SLOT_ID)), []);

  const seq = useRef(0);
  // Deneme eklenince/silinince rapor sessizce yeniden çekilir (reloadKey > 0): yükleniyor ekranına düşülmez, kaydırma
  // yeri korunur; sessiz yenileme başarısız olursa eldeki rapor kalır.
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    if (isCoach && !studentId) return;
    const my = ++seq.current;
    const silent = reloadKey > 0;
    if (!silent) { setLoading(true); setError(""); }
    api.getFullReport(studentId)
      .then((d) => { if (my === seq.current) setRaw(d); })
      .catch((e) => { if (my === seq.current && !silent) setError(e.message || "Rapor yüklenemedi"); })
      .finally(() => { if (my === seq.current && !silent) setLoading(false); });
  }, [studentId, isCoach, reloadKey]);
  const reload = () => setReloadKey((k) => k + 1);

  const model = useMemo(() => (raw ? buildReport(raw, { window: windowKey }) : null), [raw, windowKey]);
  const windows = month ? [{ key: monthWindowKey(month), label: monthLabel(month) }, ...WINDOWS] : WINDOWS;
  const detail = detailKey && model ? model.subjectMap.get(detailKey) : null;
  const studentName = raw?.student?.name || fixedStudentName || user.name;
  const empty = model && model.allRecordCount === 0 && model.discipline.total.V === 0 && model.inProgress.length === 0 && model.denemeler.all === 0;
  // Deneme ekleyebilen: öğrenci kendisi için, koç kendi öğrencisi için (admin yalnızca okur).
  const canAddDeneme = user.role === "STUDENT" || (user.role === "TEACHER" && !!studentId);
  const denemeler = model && (
    <Denemeler model={model} isCoach={isCoach} canAdd={canAddDeneme} studentId={studentId} field={raw?.student?.field ?? null} onChanged={reload} />
  );

  const study = (subjectKey, topic) => {
    if (!onOpenStudyLog) return;
    const [examType, subject] = (subjectKey || "").split("|");
    onOpenStudyLog(subjectKey ? { examType, subject, topic: topic || "" } : null);
  };
  const assign = (subjectKey, topic) => {
    if (!onAssign) return;
    const [examType, subject] = (subjectKey || "").split("|");
    onAssign({ studentId, examType, subject, topic: topic || "" });
  };
  const hideRec = (rec) => {
    const next = { ...hidden, [recHideKey(rec)]: { until: Date.now() + 7 * 864e5, count: rec.evidenceCount } };
    setHidden(next);
    writeHidden(next);
  };

  return (
    <div className="k-page" style={{ padding: 28, maxWidth: 760, margin: "0 auto" }}>
      {headerSlot && createPortal(
        <HeaderTextButton icon={Download} label="PDF" onClick={() => setPdfOpen(true)} disabled={!model || empty} />,
        headerSlot
      )}
      <div className="k-chip-row" role="group" aria-label="Rapor aralığı" style={{ marginBottom: 8 }}>
        {windows.map((w) => <Chip key={w.key} active={windowKey === w.key} onClick={() => setWindowKey(w.key)}>{w.label}</Chip>)}
      </div>
      {model && !empty && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
          <span style={text(12, 500, C.mutedLight)}>{model.rangeText}</span>
          {/* YKS alanı (girilmişse) — AYT'de hangi derslerin izlendiğini belirler; nötr etiket. */}
          {model.fieldLabel && <span style={{ ...text(11.5, 600, C.mutedLight), whiteSpace: "nowrap", background: C.surface2, borderRadius: 7, padding: "3px 7px" }}>Alan: {model.fieldLabel}</span>}
          {model.daysToYks != null && <span style={{ ...mono(11.5, 600, C.mutedLight), whiteSpace: "nowrap", background: C.surface2, borderRadius: 7, padding: "3px 7px" }}>YKS'ye {model.daysToYks} gün</span>}
        </div>
      )}

      {loading ? (
        <div style={{ marginTop: 16 }}><LoadingState /></div>
      ) : error ? (
        <EmptyState text={error} />
      ) : !model ? null : empty ? (
        <>
          <EmptyState icon={BarChart3} text="Henüz raporlanacak bir sonuç yok — ödev sonuçları ve serbest çalışma kayıtları girildikçe burada görünecek." />
          {denemeler}
        </>
      ) : (
        <>
          <Summary model={model} isCoach={isCoach} onChip={setDetailKey} onStudy={study} onOpenHome={onOpenHome} />
          {denemeler}
          <Recommendations model={model} isCoach={isCoach} hidden={hidden} onHide={hideRec} onStudy={study} onAssign={assign}
            onOpenRecipient={onOpenRecipient} onOpenAssignment={onOpenAssignment} />
          {isCoach && studentId && (
            <Section id="koc" title="Koç paneli">
              <CoachPanel model={model} raw={raw} studentId={studentId} aiMonth={month || model.window.month} onAiLoaded={setAi} onNarrative={setNarrative} onOpenAssignment={onOpenAssignment} />
            </Section>
          )}
          {/* Öğrencinin kendi aylık değerlendirmesi ("sen" dili; koça özel bölüm yok) — yalnız öğrenci görünümünde. */}
          {!isCoach && (
            <Section id="degerlendirme" title="Ayın değerlendirmesi">
              <StudentNarrativeCard raw={raw} />
            </Section>
          )}
          <SubjectCards model={model} isCoach={isCoach} exam={exam} setExam={setExam} onOpen={setDetailKey} onStudy={study} />
          <Discipline model={model} isCoach={isCoach} onOpenRecipient={onOpenRecipient} onOpenAssignment={onOpenAssignment} />
          <PriorityTopics model={model} isCoach={isCoach} onStudy={onOpenStudyLog ? study : null} onAssign={onAssign ? assign : null} onOpen={setDetailKey} />
          <Trend model={model} isCoach={isCoach} exam={exam} setExam={setExam} onOpen={setDetailKey} />
          <NetLoss model={model} isCoach={isCoach} />
          <Coverage model={model} isCoach={isCoach} onOpenRecipient={onOpenRecipient} onStudy={onOpenStudyLog ? study : null} />
          <div style={{ ...text(11.5, 500, C.mutedLight), marginTop: 28, lineHeight: 1.5 }}>
            Sonuçlar öğrencinin girdiği doğru/yanlış/boş sayılarına dayanır. Ödev neti deneme neti değildir. Okul karşılaştırmaları yalnızca aynı ödevi çözenlerin toplu verisidir; kimsenin adı yer almaz.
          </div>
        </>
      )}

      {detail && (
        <SubjectDetail subject={detail} isCoach={isCoach} onClose={() => setDetailKey(null)}
          onStudy={!isCoach && onOpenStudyLog ? study : null} onAssign={isCoach && onAssign ? assign : null}
          onOpenItem={!isCoach ? onOpenRecipient : null} />
      )}
      {pdfOpen && raw && (
        <PdfSheet raw={raw} isCoach={isCoach} initialWindow={windowKey} windows={windows} ai={ai} narrative={narrative} studentName={studentName} onClose={() => setPdfOpen(false)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- 1. Özet
function Summary({ model, isCoach, onChip, onStudy, onOpenHome }) {
  const w = model.week;
  const showWeek = model.window.rolling;
  const celeb = model.recs.all.find((r) => r.type === "kutlama" && (isCoach ? r.audience.coach : r.audience.student));
  if (!model.enough) {
    const r00 = model.recs.all.find((r) => r.id === "R00");
    return (
      <Section id="ozet" title="Özet">
        <Card style={{ padding: 18 }}>
          <div style={{ ...text(16, 700), marginBottom: 6 }}>Raporun oluşuyor</div>
          <div style={{ ...text(13.5, 500, C.text2), lineHeight: 1.55 }}>{r00 ? (isCoach ? r00.text.coach : r00.text.student) : "Kayıt girildikçe rapor burada oluşacak."}</div>
          {!isCoach && (
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              {onOpenHome && <Button small icon={ClipboardList} onClick={onOpenHome}>Sonuç gir</Button>}
              <Button small variant="secondary" icon={Plus} onClick={() => onStudy(null)}>Serbest çalışma ekle</Button>
            </div>
          )}
        </Card>
        <DeliveryKpis model={model} />
      </Section>
    );
  }
  return (
    <Section id="ozet" title="Özet" info="Net oranı = 100 soruda kaç net yaptığın. Net = D − Y/4; ör. 40 soruda 30 D, 8 Y → 30 − 2 = 28 net → net oranı %70. Büyük setler en fazla 40 soru ağırlığıyla sayılır.">
      {showWeek && (
        <Card style={{ padding: 16 }}>
          <div style={{ ...text(10.5, 700, C.mutedLight), letterSpacing: 1.2 }}>BU HAFTA</div>
          {isCoach ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
              <Pill tone={{ intervene: "red", watch: "amber", ok: "green" }[model.coach.status]}>{model.coach.statusLabel}</Pill>
              <span style={text(13, 500, C.text2)}>{model.coach.reasons.join(" · ") || "belirgin bir sorun yok"}</span>
            </div>
          ) : (
            <div style={{ ...text(16, 700), marginTop: 6, lineHeight: 1.35 }}>{w.headline}</div>
          )}
          <div style={{ ...mono(12.5, 600, C.text2), marginTop: 8 }}>{w.handled}/{w.items.length} ödev · {fmtInt(w.Q)} soru · {w.activeDays}/7 gün</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
            <div role="img" aria-label={`Bu hafta ${w.activeDays} aktif gün`} style={{ display: "flex", gap: 6 }}>
              {w.dots.map((d) => (
                <span key={d.day} style={{
                  width: 12, height: 12, borderRadius: 999, boxSizing: "border-box",
                  background: d.active ? C.green : d.future ? "transparent" : C.surface2,
                  border: d.today ? `2px solid ${C.text}` : d.future ? `1px solid ${C.border}` : "none",
                }} />
              ))}
            </div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, ...text(12.5, 600, model.discipline.streak ? C.text : C.mutedLight) }}>
              <Flame size={15} color={model.discipline.streak ? C.amber : C.mutedLight} aria-hidden="true" />
              <span style={mono(12.5, 700)}>{model.discipline.streak}</span> hafta seri
            </span>
          </div>
          {celeb && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, padding: "9px 12px", borderRadius: 12, background: C.greenSoft }}>
              <Sparkles size={15} color={C.green} aria-hidden="true" />
              <span style={{ ...text(13, 600, C.text), minWidth: 0 }}>{isCoach ? celeb.title.coach : celeb.title.student}</span>
            </div>
          )}
          {w.lastWeekLine && <div style={{ ...mono(12, 500, C.mutedLight), marginTop: 10 }}>{w.lastWeekLine}</div>}
        </Card>
      )}

      {showWeek && w.goals.length > 0 && (
        <Card style={{ padding: 16, marginTop: 10 }}>
          <div style={{ ...text(14, 700), marginBottom: 10 }}>Bu haftanın hedefleri{w.allGoalsMet ? " — hepsi tamam!" : ""}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {w.goals.map((g) => {
              const clickable = g.id === "G2" && !isCoach;
              const Row = clickable ? "button" : "div";
              return (
                <Row key={g.id} type={clickable ? "button" : undefined} onClick={clickable ? () => onStudy(g.subjectKey) : undefined}
                  style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: 0, cursor: clickable ? "pointer" : "default" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    {g.met ? <Check size={15} color={C.green} aria-hidden="true" /> : <Target size={15} color={C.mutedLight} aria-hidden="true" />}
                    <span style={{ ...text(13, 600), flex: 1, minWidth: 0 }}>{g.text}</span>
                    <span style={mono(12.5, 700, g.met ? C.green : C.text2)}>{g.progress}/{g.target}</span>
                  </div>
                  <GoalBar value={g.progress} target={g.target} amber={g.skip || 0} met={g.met} />
                </Row>
              );
            })}
          </div>
        </Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginTop: 10 }}>
        <KpiBox label="Net oranı">
          <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
            {["TYT", "AYT"].map((e) => model.exams[e].agg.n > 0 && (
              <span key={e} style={{ whiteSpace: "nowrap" }}><span style={text(11.5, 600, C.mutedLight)}>{e} </span><NoValue value={model.exams[e].agg.NO} size={18} /></span>
            ))}
          </div>
          {["TYT", "AYT"].map((e) => {
            const t = model.exams[e].trend;
            if (!t.enough || t.dir === "flat" || (!isCoach && t.dir !== "up")) return null;
            return <div key={e} style={{ marginTop: 4 }}><span style={text(11, 600, C.mutedLight)}>{e} </span><TrendMark trend={t} student={!isCoach} withLabel size={11} /></div>;
          })}
        </KpiBox>
        <KpiBox label="Çözülen soru">
          <div style={mono(20)}>{fmtInt(model.kpi.questions.Q)}</div>
          {model.kpi.questions.pctDelta != null && Math.abs(model.kpi.questions.pctDelta) >= 15 && (
            <div style={{ ...mono(11.5, 600, C.mutedLight), marginTop: 3 }}>{model.kpi.questions.pctDelta > 0 ? "↑" : "↓"} {fmtSignedPct(model.kpi.questions.pctDelta)} önceki döneme göre</div>
          )}
        </KpiBox>
        <DeliveryKpi model={model} />
        <KpiBox label="Aktif gün">
          <div style={mono(20)}>{model.kpi.activeDays.n}/{model.kpi.activeDays.of}</div>
        </KpiBox>
      </div>

      {(model.chips.strong.length > 0 || model.chips.focus.length > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
          {model.chips.strong.length > 0 && <ChipLine title={model.chips.strongTitle === "Güçlü yanların" ? "Güçlü" : "En iyi"} tone={C.green} list={model.chips.strong} onChip={onChip} />}
          {model.chips.focus.length > 0 && <ChipLine title="Odak" tone={C.amber} list={model.chips.focus} onChip={onChip} />}
        </div>
      )}
    </Section>
  );
}
function KpiBox({ label, children }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "13px 14px", minWidth: 0 }}>
      {children}
      <div style={{ ...text(12, 500, C.mutedLight), marginTop: 5 }}>{label}</div>
    </div>
  );
}
function DeliveryKpi({ model }) {
  const d = model.kpi.delivery;
  return (
    <KpiBox label="Teslim">
      {d.V >= 5 ? (
        <>
          <div style={mono(20)}>{fmtPct(d.deliveredPct)}</div>
          <div style={{ ...mono(11.5, 600, C.mutedLight), marginTop: 3 }}>{d.delivered}/{d.V} · ele alınan {fmtPct(d.handledPct)}</div>
        </>
      ) : <div style={mono(20)}>{d.delivered}/{d.V}</div>}
    </KpiBox>
  );
}
function DeliveryKpis({ model }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginTop: 10 }}><DeliveryKpi model={model} /><KpiBox label="Aktif gün"><div style={mono(20)}>{model.kpi.activeDays.n}/{model.kpi.activeDays.of}</div></KpiBox></div>;
}
function ChipLine({ title, tone, list, onChip }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span style={{ ...text(12.5, 700, tone), minWidth: 44 }}>{title}:</span>
      {list.map((s) => (
        <button key={s.key} type="button" onClick={() => onChip(s.key)} className="k-btn"
          style={{ minHeight: 36, padding: "0 12px", borderRadius: 10, background: "transparent", border: `1px solid ${tone}66`, cursor: "pointer", ...text(13, 600) }}>
          {s.name}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- 2. Öneriler
function Recommendations({ model, isCoach, hidden, onHide, onStudy, onAssign, onOpenRecipient, onOpenAssignment }) {
  const [all, setAll] = useState(false);
  const [openWhy, setOpenWhy] = useState(null);
  // Öğrencinin gizlediği kart yerine sıradaki uygun kart gelir (aynı seçim kuralıyla).
  const list = isCoach ? (all ? model.recs.coachAll : model.recs.coach) : pickRecs(model.recs.studentAll.filter((r) => !isRecHidden(r, hidden)), STUDENT_SCREEN);
  const more = isCoach ? model.recs.coachAll.length - model.recs.coach.length : 0;
  if (!list.length) return null;
  return (
    <Section id="oneriler" title={isCoach ? "Dikkat gerektirenler" : "Senin için"}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {list.map((r) => {
          const key = `${r.id}|${r.subjectKey}|${r.topic}`;
          const body = isCoach ? r.text.coach : r.text.student;
          const title = isCoach ? r.title.coach : r.title.student;
          const rest = body.slice(title.length).trim();
          const celebr = r.type === "kutlama";
          const urgent = isCoach && r.priority === 1 && r.type === "engel";
          const Icon = celebr ? Sparkles : urgent ? AlertTriangle : Target;
          const iconColor = celebr ? C.green : urgent ? C.red : C.amber;
          const action = isCoach ? coachAction(r, onAssign, onOpenAssignment) : studentAction(r, onStudy, onOpenRecipient);
          return (
            <Card key={key} style={{ padding: "14px 14px 12px" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <Icon size={17} color={iconColor} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...text(14, 700), lineHeight: 1.4 }}>{title}</div>
                  {rest && <div style={{ ...text(13, 500, C.text2), lineHeight: 1.5, marginTop: 4, display: "-webkit-box", WebkitLineClamp: openWhy === key ? "unset" : 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{rest}</div>}
                  {openWhy === key && (
                    <div style={{ ...mono(12, 600, C.mutedLight), marginTop: 6 }}>
                      {isCoach ? r.evidence : r.evidenceStudent}
                      {r.section && <button type="button" onClick={() => scrollToSection(r.section)} style={{ background: "none", border: "none", padding: "0 0 0 8px", cursor: "pointer", ...text(12, 700, C.text2) }}>bölüme git ›</button>}
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    {action}
                    <button type="button" aria-expanded={openWhy === key} onClick={() => setOpenWhy(openWhy === key ? null : key)}
                      style={{ background: "none", border: "none", padding: "8px 4px", cursor: "pointer", ...text(12.5, 600, C.mutedLight) }}>Neden?</button>
                    {isCoach && <span style={{ marginLeft: "auto" }}><Pill>{r.owner === "Branş öğretmeni" && r.ownerName ? `Branş: ${r.ownerName}` : r.owner}</Pill></span>}
                  </div>
                </div>
                {!isCoach && (
                  <button type="button" aria-label="Bu kartı 7 gün gizle" onClick={() => onHide(r)}
                    style={{ background: "none", border: "none", padding: 8, margin: -6, cursor: "pointer", color: C.mutedLight, flexShrink: 0 }}>
                    <X size={16} />
                  </button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      {isCoach && more > 0 && !all && <Button small variant="secondary" style={{ marginTop: 10 }} onClick={() => setAll(true)}>Tümünü gör ({more} daha)</Button>}
    </Section>
  );
}
function studentAction(r, onStudy, onOpenRecipient) {
  const a = r.action;
  if (!a) return null;
  if (a.kind === "submit" && a.itemId && onOpenRecipient) return <SmallButton icon={ClipboardList} onClick={() => onOpenRecipient(a.itemId)}>Sonucu gir</SmallButton>;
  if (a.kind === "study" && onStudy) return <SmallButton icon={Plus} onClick={() => onStudy(a.subjectKey, a.topic)}>Çalışma ekle</SmallButton>;
  return null;
}
function coachAction(r, onAssign, onOpenAssignment) {
  const topicAction = r.coachAction || (r.action?.kind === "study" && r.action.subjectKey ? { kind: "assign", subjectKey: r.action.subjectKey, topic: r.action.topic } : null);
  if (topicAction?.kind === "assign" && onAssign) return <SmallButton icon={Send} onClick={() => onAssign(topicAction.subjectKey, topicAction.topic)}>Bu konuya ödev ver</SmallButton>;
  if (r.action?.kind === "submit" && r.action.assignmentId && onOpenAssignment) return <SmallButton onClick={() => onOpenAssignment(r.action.assignmentId)}>Ödeve git</SmallButton>;
  return null;
}

// ---------------------------------------------------------------- 3. Ders karnesi
function SubjectCards({ model, isCoach, exam, setExam, onOpen, onStudy }) {
  const all = model.subjects.filter((s) => s.examType === exam);
  const tracked = all.filter((s) => s.tracked && (s.agg.n > 0 || s.openOverdue > 0 || s.label !== "few"));
  const untracked = all.filter((s) => !s.tracked && (s.agg.n > 0 || s.openOverdue > 0));
  const order = isCoach ? { focus: 0, ok: 1, strong: 2, few: 3 } : { strong: 0, ok: 1, focus: 2, few: 3 };
  const rows = [...tracked].sort((a, b) => order[a.label] - order[b.label] || (a.label === "focus" ? b.priority - a.priority : (b.agg.NO ?? -99) - (a.agg.NO ?? -99)));
  const best = model.chips.strong.filter((s) => s.examType === exam);
  const focus = model.chips.focusAll.filter((s) => s.examType === exam).slice(0, 2);
  return (
    <Section id="karne" title="Ders karnesi" right={<ExamTabs exam={exam} setExam={setExam} />}
      info="Etiket: küçültülmüş net oranı ≥ %65 Güçlü, < %40 Odak, arası Yolunda. Okul ödevlerindeki yerine göre en fazla bir kademe düzeltilir. En az 3 kayıt, 60 soru ve 2 farklı hafta gerekir.">
      {!isCoach && (best.length > 0 || focus.length > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
          {best.length > 0 && <div style={text(12, 700, C.green)}>{model.chips.strongTitle}</div>}
          {best.map((s) => (
            <Card key={s.key} hover onClick={() => onOpen(s.key)} style={{ padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
              <SubjectIcon src={subjectIconUrl(s.subject)} size={34} radius={11} />
              <span style={{ ...text(14, 700), flex: 1, minWidth: 0 }}>{s.name}</span>
              <NoValue value={s.agg.NO} size={22} />
              <TrendMark trend={s.trend} student />
            </Card>
          ))}
          {focus.length > 0 && <div style={{ ...text(12, 700, C.amber), marginTop: 4 }}>Odak alanların</div>}
          {focus.map((s) => {
            const t = s.lists.first[0];
            return (
              <Card key={s.key} style={{ padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <SubjectIcon src={subjectIconUrl(s.subject)} size={34} radius={11} />
                  <button type="button" onClick={() => onOpen(s.key)} style={{ ...text(14, 700), flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer" }}>{s.name}</button>
                  <NoValue value={s.agg.NO} size={22} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                  <span style={{ ...text(12.5, 500, C.text2), flex: 1, minWidth: 0 }}>Sonraki adım: {t ? `${t.name} · 15 soru` : "karışık 20 soru"}</span>
                  <SmallButton icon={Plus} onClick={() => onStudy(s.key, t?.name)}>Çalışma ekle</SmallButton>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState compact text={`${exam} için henüz kayıt yok.`} />
      ) : (
        <div className="k-bleed" style={{ borderBottom: `1px solid ${C.divider}` }}>
          {rows.map((s) => <SubjectRow key={s.key} s={s} isCoach={isCoach} onOpen={onOpen} />)}
        </div>
      )}
      {untracked.length > 0 && (
        <Collapsible title="Takip dışı AYT dersleri" count={untracked.length}>
          <div style={{ ...text(12, 500, C.mutedLight), marginBottom: 6 }}>
            {model.fieldLabel
              ? `${model.fieldLabel} alanının dışında kalan ve son 8 haftada kaydı olmayan AYT dersleri düzen ve öneri hesabına girmez.`
              : "Son 8 haftada kaydı olmayan AYT dersleri düzen ve öneri hesabına girmez (alan bilgisi yok)."}
          </div>
          {untracked.map((s) => <SubjectRow key={s.key} s={s} isCoach={isCoach} onOpen={onOpen} />)}
        </Collapsible>
      )}
    </Section>
  );
}
function ExamTabs({ exam, setExam }) {
  return (
    <div role="group" aria-label="Sınav" style={{ display: "flex", gap: 4, background: C.surface2, borderRadius: 10, padding: 3 }}>
      {["TYT", "AYT"].map((e) => (
        <button key={e} type="button" aria-pressed={exam === e} onClick={() => setExam(e)}
          style={{ minHeight: 30, minWidth: 44, padding: "0 10px", borderRadius: 8, border: "none", cursor: "pointer", background: exam === e ? C.accent : "transparent", ...text(12.5, 700, exam === e ? C.onAccent : C.text2) }}>
          {e}
        </button>
      ))}
    </div>
  );
}
function SubjectRow({ s, isCoach, onOpen }) {
  const a = s.agg;
  return (
    <button type="button" onClick={() => onOpen(s.key)} className="k-list-row"
      style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderTop: `1px solid ${C.divider}`, padding: "12px 0", cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <SubjectIcon src={subjectIconUrl(s.subject)} size={30} radius={9} />
        <span style={{ ...text(14, 700), minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.subject}</span>
        <LabelChip label={s.label} from8w={s.from8w} small />
        {s.konuBadge && <Pill tone="amber">konu pası {s.konuPass}</Pill>}
        <span style={{ marginLeft: "auto" }}><NoValue value={a.NO} size={19} /></span>
        <ChevronRight size={16} color={C.faintest} aria-hidden="true" />
      </div>
      {a.n > 0 && <div style={{ marginTop: 8 }}><DybBar D={a.D} Y={a.Y} B={a.B} /></div>}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
        <span style={mono(11.5, 600, C.mutedLight)}>{fmtInt(a.Q)} soru · {a.n} kayıt</span>
        <TrendMark trend={s.trend} student={!isCoach} size={11} />
        {isCoach && a.n > 0 && <><Mini label="İsabet" value={fmtPct(a.accuracy)} /><Mini label="Boş" value={fmtPct(a.blankRate)} />{s.pTilde != null && s.compCount >= 2 && <Mini label="P̃" value={fmtInt(s.pTilde)} />}</>}
      </div>
      {s.schoolLine && <div style={{ ...text(12, 600, C.text2), marginTop: 4 }}>{isCoach ? s.schoolLine.coach : s.schoolLine.student}</div>}
      {s.notes.filter((n) => isCoach || !n.coachOnly).map((n) => <div key={n.text} style={{ ...text(11.5, 500, C.mutedLight), marginTop: 3 }}>{n.text}</div>)}
    </button>
  );
}

// ---------------------------------------------------------------- 4. Ödev düzeni
function Discipline({ model, isCoach, onOpenRecipient, onOpenAssignment }) {
  const d = model.discipline;
  const t = d.total;
  const [openMore, setOpenMore] = useState(false);
  const silentColor = isCoach ? C.red : C.amber;
  const openList = openMore ? d.open : d.open.slice(0, 5);
  return (
    <Section id="odev" title="Ödev düzeni" info="Teslim % = teslim edilen / vadesi gelen ödev. Ele alınan % = teslim + pas / vadesi gelen. Pas geçmek dürüst bir 'ele alma'dır; seriyi bozmaz. Süresi içinde pas geçip sonra yine de çözdüğün ödev 'pastan dönüş'tür: teslim sayılır, gecikme sayılmaz.">
      <Card style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
          <span><span style={mono(24)}>{t.V >= 5 ? fmtPct(t.deliveredPct) : `${t.delivered}/${t.V}`}</span> <span style={text(12, 500, C.mutedLight)}>teslim</span></span>
          {t.V >= 5 && <span><span style={mono(24)}>{fmtPct(t.handledPct)}</span> <span style={text(12, 500, C.mutedLight)}>ele alınan</span></span>}
          {d.label && <Pill tone={d.labelKey === "great" ? "green" : d.labelKey === "needs" ? "amber" : "muted"}>{d.label}</Pill>}
        </div>
        <div style={{ marginTop: 12 }}>
          <SegmentBar parts={[
            { label: "Zamanında", value: t.onTime, color: C.green },
            { label: "Pastan dönüş", value: t.fixed, color: `${C.green}BB` },
            { label: "Geç", value: t.late, color: `${C.green}77` },
            { label: "Pas", value: t.skip, color: C.amber },
            { label: "Sessiz", value: t.silent, color: silentColor },
          ]} />
          <Legend style={{ marginTop: 8 }} items={[
            { label: "zamanında", value: t.onTime, color: C.green },
            ...(t.fixed ? [{ label: "pastan dönüş", value: t.fixed, color: `${C.green}BB` }] : []),
            { label: "geç", value: t.late, color: `${C.green}77` },
            { label: "pas", value: t.skip, color: C.amber },
            { label: "sessiz", value: t.silent, color: silentColor },
          ]} />
        </div>
        {t.skip > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
            {Object.entries(d.skipReasons).map(([k, v]) => (
              <Pill key={k} tone={v ? "amber" : "muted"}>{SKIP_LABEL[k]} <span style={mono(11, 700)}>{v}</span>{isCoach && v ? ` · ${SKIP_OWNER[k]}` : ""}</Pill>
            ))}
          </div>
        )}
        {d.dominant && <div style={{ ...text(12.5, 500, C.text2), marginTop: 8 }}>Pasların çoğu: {SKIP_REASONS[d.dominant].toLocaleLowerCase("tr-TR")}{isCoach ? ` (sahibi: ${SKIP_OWNER[d.dominant]})` : " — nedenini söyledin, bu doğru yol."}</div>}
        {isCoach && (
          <div style={{ ...mono(12, 600, C.text2), marginTop: 10, lineHeight: 1.6 }}>
            Okul {fmtPct(d.school.deliveredPct)} · Kişisel {fmtPct(d.personal.deliveredPct)} · Hatırlatma sonrası {d.afterReminder.done}/{d.afterReminder.total} · Son gün {fmtPct(d.lastDayRate)} · Ort. gecikme {d.avgDelay != null ? `${fmtDec(d.avgDelay, 1)} gün` : "—"}
          </div>
        )}
        <Heatmap cells={d.heatmap} />
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, ...text(12.5, 600, C.text2) }}>
          <Flame size={15} color={d.streak ? C.amber : C.mutedLight} aria-hidden="true" />
          <span style={mono(12.5)}>{d.streak}</span> hafta seri · en uzun <span style={mono(12.5)}>{d.longest}</span>
        </div>
      </Card>
      {d.open.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ ...text(12, 700, C.text2), marginBottom: 2 }}>Açık ödevler</div>
          <div className="k-bleed" style={{ borderBottom: `1px solid ${C.divider}` }}>
            {openList.map((it) => (
              <div key={it.id} className="k-list-row" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderTop: `1px solid ${C.divider}`, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ ...text(13.5, 600), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name} · {it.topicName}</div>
                  <div style={{ ...mono(11.5, 600, it.state === "silent" ? silentColor : C.mutedLight), marginTop: 2 }}>
                    {it.state === "silent" ? `${it.overdueDays} gün geçti` : it.daysLeft === 0 ? "bugün son gün" : `${it.daysLeft} gün kaldı`}{it.expected ? ` · ${it.expected} soru` : ""}
                  </div>
                </div>
                {!isCoach && onOpenRecipient && <SmallButton onClick={() => onOpenRecipient(it.id)}>Sonucu gir</SmallButton>}
                {!isCoach && onOpenRecipient && <SmallButton icon={PauseCircle} onClick={() => onOpenRecipient(it.id)}>Pas geç</SmallButton>}
                {isCoach && onOpenAssignment && <SmallButton onClick={() => onOpenAssignment(it.assignmentId)}>Ödeve git</SmallButton>}
              </div>
            ))}
          </div>
          {d.open.length > 5 && !openMore && <Button small variant="secondary" style={{ marginTop: 8 }} onClick={() => setOpenMore(true)}>{d.open.length - 5} ödev daha</Button>}
        </div>
      )}
    </Section>
  );
}
function Heatmap({ cells }) {
  const shade = (q) => (q >= 80 ? C.green : q >= 30 ? `${C.green}AA` : q > 0 ? `${C.green}55` : C.surface2);
  return (
    <div style={{ marginTop: 14 }}>
      <div role="img" aria-label="Günlük soru ısı haritası" style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 3, maxWidth: 320 }}>
        {["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"].map((d) => <span key={d} style={{ ...text(10, 600, C.mutedLight), textAlign: "center" }}>{d}</span>)}
        {cells.map((c) => (
          <span key={c.day} title={`${fmtDay(c.day)}: ${c.Q} soru`}
            style={{ aspectRatio: "1", borderRadius: 4, background: c.future || !c.inWindow ? "transparent" : shade(c.Q), border: c.future || !c.inWindow ? `1px dashed ${C.border}` : "none" }} />
        ))}
      </div>
      <Legend style={{ marginTop: 6 }} square items={[{ label: "0", color: C.surface2 }, { label: "1–29", color: `${C.green}55` }, { label: "30–79", color: `${C.green}AA` }, { label: "80+ soru", color: C.green }]} />
    </div>
  );
}

// ---------------------------------------------------------------- 5. Konu analizi (kompakt)
function PriorityTopics({ model, isCoach, onStudy, onAssign, onOpen }) {
  const list = model.priorityTopics;
  return (
    <Section id="konu" title="Öncelikli konular" info="Konu net oranı az veride dersin ortalamasına doğru çekilir (20 soru ağırlığı). Listelere en az 20 soru çözülen konular girer. Konu eşleştirmesi yaklaşıktır (~).">
      {list.length === 0 ? (
        <EmptyState compact text="Odak derslerde öne çıkan bir konu yok. Ders satırına dokunarak konu dökümünü görebilirsin." />
      ) : (
        <div className="k-bleed" style={{ borderBottom: `1px solid ${C.divider}` }}>
          {list.map((t) => (
            <div key={`${t.subjectKey}${t.key}`} className="k-list-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: `1px solid ${C.divider}` }}>
              <button type="button" onClick={() => onOpen(t.subjectKey)} style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer" }}>
                <div style={{ ...text(13.5, 600), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}{t.approx ? " ~" : ""}</div>
                <div style={{ ...text(11.5, 500, C.mutedLight), marginTop: 2 }}>{t.subjectName} · <span style={mono(11.5, 600, C.mutedLight)}>{fmtPct(t.rStar)} · {t.Q} soru</span>{t.books.length ? ` · ${t.books[0]}` : ""}</div>
              </button>
              {isCoach
                ? onAssign && <SmallButton icon={Send} onClick={() => onAssign(t.subjectKey, t.name)}>Ödev ver</SmallButton>
                : onStudy && <SmallButton icon={Plus} onClick={() => onStudy(t.subjectKey, t.name)}>Çalışma ekle</SmallButton>}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------- 6. Gelişim trendi
function Trend({ model, isCoach, exam, setExam, onOpen }) {
  const [subjectKey, setSubjectKey] = useState(null);
  const subs = model.subjects.filter((s) => s.examType === exam && s.tracked && s.agg.n > 0);
  const sel = subjectKey && subs.some((s) => s.key === subjectKey) ? subjectKey : null;
  const weeks = sel ? model.subjectWeekly(sel) : model.trend[exam].weeks;
  const filled = weeks.filter((w) => w.NO != null).length;
  const t = sel ? model.subjectMap.get(sel).trend : model.trend[exam].trend;
  return (
    <Section id="trend" title="Gelişimin" right={<ExamTabs exam={exam} setExam={setExam} />}
      info="Son 4 hafta ile önceki 4 hafta karşılaştırılır. En az 5 puanlık ve istatistiksel olarak anlamlı değişim 'Yükselişte' ya da 'Düşüşte' sayılır; okul geneli de aynı yönde değiştiyse konular zorlaşmış olabilir.">
      <div className="k-chip-row" role="group" aria-label="Ders" style={{ marginBottom: 10 }}>
        <Chip active={!sel} onClick={() => setSubjectKey(null)}>Tümü</Chip>
        {subs.map((s) => <Chip key={s.key} active={sel === s.key} onClick={() => setSubjectKey(s.key)}>{s.subject}</Chip>)}
      </div>
      <Card style={{ padding: "14px 12px 8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, padding: "0 4px" }}>
          <span style={{ ...text(13, 700), flex: 1 }}>Haftalık net oranı</span>
          {t?.enough && !(t.dir === "down" && !isCoach) && <TrendMark trend={t} withLabel />}
        </div>
        {filled < 3 ? (
          <div style={{ ...text(13, 500, C.mutedLight), padding: "20px 4px" }}>Grafiğin için 3 hafta veri gerekiyor ({filled}/3). Haftada en az 20 soru girilen haftalar sayılır.</div>
        ) : (
          <TrendChart weeks={weeks} />
        )}
        {t?.note && <div style={{ ...text(12, 500, C.mutedLight), padding: "4px 4px 6px" }}>Not: {t.note}</div>}
        {!isCoach && t?.enough && t.dir === "down" && (
          <div style={{ ...text(12.5, 500, C.text2), padding: "4px 4px 6px" }}>Son 4 haftada biraz düştü; yeni konular zorlayıcı olabilir. Odak konularından biriyle kısa bir tekrar iyi gelir.</div>
        )}
        {sel && weeks.some((w) => w.school != null) && <Legend style={{ padding: "2px 4px 6px" }} items={[{ label: "sen", color: C.text }, { label: "okul medyanı (kesikli)", color: C.mutedLight }]} />}
      </Card>
      {subs.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ ...text(12, 700, C.text2), marginBottom: 2 }}>Derslerin son 8 haftası</div>
          {subs.map((s) => (
            <button key={s.key} type="button" onClick={() => onOpen(s.key)} className="k-list-row"
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "none", border: "none", borderTop: `1px solid ${C.divider}`, padding: "9px 0", cursor: "pointer", textAlign: "left" }}>
              <span style={{ ...text(13, 600), flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.subject}</span>
              {s.transition && <Pill tone="green">{LABELS[s.transition.from]} → {LABELS[s.transition.to]}</Pill>}
              <Sparkline points={s.spark} />
              <span style={{ minWidth: 48, textAlign: "right" }}><TrendMark trend={s.trend} student={!isCoach} /></span>
            </button>
          ))}
        </div>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------- 7. Net nereden kaçıyor
function NetLoss({ model, isCoach }) {
  const [open, setOpen] = useState(null);
  const rows = model.netLoss;
  if (!rows.length) return null;
  const max = Math.max(1, ...rows.map((r) => r.agg.lostWrong + r.agg.lostBlank));
  return (
    <Section id="netkaybi" title="Net nereden kaçıyor?" info="Kaçan net = 1,25 × yanlış + boş. Yanlış soru hem kendisini hem çeyrek doğruyu götürür.">
      <Card style={{ padding: 14, background: C.surface2, border: "none" }}>
        <div style={{ ...text(12.5, 500, C.text2), lineHeight: 1.55 }}>4 yanlış 1 doğruyu götürür. Ama iki şıkka indirebildiysen işaretlemek sana soru başına ortalama +0,375 net kazandırır. Hiç eleyemiyorsan işaretlemek de boş bırakmak da ortalamada aynıdır.</div>
      </Card>
      <div style={{ marginTop: 6 }}>
        {rows.map((r) => {
          const a = r.agg;
          const expanded = open === r.key;
          return (
            <button key={r.key} type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : r.key)}
              style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderTop: `1px solid ${C.divider}`, padding: "10px 0", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ ...text(13, 600), flex: 1, minWidth: 0 }}>{r.name}</span>
                {r.profile ? <Pill tone={r.profile === "gap" || r.profile === "wrong" ? "amber" : "muted"}>{PROFILES[r.profile].name}</Pill> : <Pill>Veri az</Pill>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 2, marginTop: 7 }}>
                <span style={{ width: `${(a.lostWrong / max) * 100}%`, height: 8, background: C.red, borderRadius: "3px 0 0 3px", minWidth: a.lostWrong ? 2 : 0 }} />
                <span style={{ width: `${(a.lostBlank / max) * 100}%`, height: 8, background: C.faintest, borderRadius: "0 3px 3px 0", minWidth: a.lostBlank ? 2 : 0 }} />
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 5, flexWrap: "wrap" }}>
                <span style={mono(11.5, 600, C.red)}>Yanlıştan −{fmtDec(a.lostWrong, 1)}</span>
                <span style={mono(11.5, 600, C.mutedLight)}>Boştan −{fmtDec(a.lostBlank, 1)}</span>
                {isCoach && <span style={mono(11.5, 600, C.text2)}>isabet {fmtPct(a.accuracy)} · boş {fmtPct(a.blankRate)} · götürü {fmtDec(a.gotur, 2)}</span>}
              </div>
              {expanded && r.profile && <div style={{ ...text(12.5, 500, C.text2), marginTop: 6, lineHeight: 1.5 }}>{PROFILES[r.profile].rx}</div>}
            </button>
          );
        })}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------- 8. Kapsam ve telafi
function Coverage({ model, isCoach, onOpenRecipient, onStudy }) {
  const cv = model.coverage;
  const [open, setOpen] = useState(null);
  const g12 = model.student.grade12;
  if (!cv.rows.length && !cv.makeup.length) return null;
  return (
    <Section id="kapsam" title="Kapsam ve telafi" info="Okul planı kapsamı: vadesi geçmiş okul ödevi konularından teslim ettiğin ya da sonradan en az 10 soru çalıştığın konuların oranı. Müfredat kapsamı (~) yaklaşıktır; sırası gelmemiş konu eksik sayılmaz.">
      {g12 && cv.share.total > 0 && (
        <Card style={{ padding: 14, marginBottom: 10 }}>
          {cv.weeksLeft != null && <div style={{ ...mono(12.5, 600, C.text2), marginBottom: 8 }}>YKS'ye {cv.weeksLeft} hafta</div>}
          <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", gap: 2 }}>
            <span style={{ flex: cv.share.tyt || 0, background: C.text2 }} />
            <span style={{ flex: cv.share.ayt || 0, background: C.faintest }} />
          </div>
          <div style={{ ...mono(12, 600, cv.share.flag ? C.amber : C.text2), marginTop: 6 }}>TYT {fmtPct(cv.share.tyt)} · AYT {fmtPct(cv.share.ayt)} <span style={text(11.5, 500, C.mutedLight)}>(son 28 gün)</span></div>
        </Card>
      )}
      {cv.rows.map((r) => {
        const pct = r.planPct;
        const color = pct == null ? C.text2 : pct >= 90 ? C.green : pct < 70 ? C.amber : C.text2;
        const expanded = open === r.key;
        return (
          <button key={r.key} type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : r.key)}
            style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderTop: `1px solid ${C.divider}`, padding: "10px 0", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <span style={{ ...text(13, 600), flex: 1, minWidth: 0 }}>{r.name}</span>
              <span style={mono(12, 600, color)}>okulda işlenen {r.planDone}/{r.planTotal}</span>
              {g12 && r.curriculum && <span style={mono(12, 600, C.mutedLight)}>· müfredat ~{r.curriculum.done}/{r.curriculum.total}</span>}
              {isCoach && g12 && r.tempo != null && <span style={mono(12, 600, r.tempo > 1.5 ? C.amber : C.mutedLight)}>· ~{r.U} konu · {fmtDec(r.tempo, 1)}/hf{r.tempo > 1.5 ? " Sıkışık" : ""}</span>}
            </div>
            <div style={{ height: 5, borderRadius: 3, background: C.surface2, marginTop: 6, overflow: "hidden" }}>
              <div style={{ width: `${pct ?? 0}%`, height: "100%", background: color }} />
            </div>
            {expanded && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                {[["studied", "Çalışılan", C.green], ["taught", "İşlendi ama kayıt yok", C.amber], ["notYet", "Henüz yok", C.mutedLight]].map(([k, label, col]) => {
                  const list = r.canonical.filter((c) => c.state === k);
                  return list.length ? <div key={k} style={text(12, 500, C.text2)}><span style={{ color: col, fontWeight: 700 }}>{label} ({list.length}):</span> {list.map((c) => c.name).join(" · ")}</div> : null;
                })}
              </div>
            )}
          </button>
        );
      })}
      {cv.makeup.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ ...text(12, 700, C.amber), marginBottom: 2 }}>Telafi listesi</div>
          {cv.makeup.slice(0, 3).map((m) => (
            <div key={m.itemId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: `1px solid ${C.divider}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...text(13, 600), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.topic}{m.approx ? " ~" : ""}</div>
                <div style={{ ...text(11.5, 500, C.mutedLight), marginTop: 2 }}>{m.name} · {m.state === "skip" ? "pas" : "sessiz"} · 20 soruyla kapat</div>
              </div>
              {!isCoach && (m.canSubmit
                ? onOpenRecipient && <SmallButton onClick={() => onOpenRecipient(m.itemId)}>Sonucu gir</SmallButton>
                : onStudy && <SmallButton icon={Plus} onClick={() => onStudy(m.subjectKey, m.topic)}>Çalışma ekle</SmallButton>)}
            </div>
          ))}
          {cv.makeup.length > 3 && <div style={{ ...text(12, 500, C.mutedLight), marginTop: 6 }}>+{cv.makeup.length - 3} konu daha — tamamı PDF'te.</div>}
        </div>
      )}
      <div style={{ ...text(11.5, 500, C.mutedLight), marginTop: 10 }}>Konu eşleştirmesi yaklaşıktır{cv.unmatched ? ` · ${cv.unmatched} kayıt eşleşmedi` : ""}.</div>
    </Section>
  );
}

// ---------------------------------------------------------------- PDF sayfası
function PdfSheet({ raw, isCoach, initialWindow, windows, ai, narrative, studentName, onClose }) {
  const [win, setWin] = useState(initialWindow);
  const [variant, setVariant] = useState(isCoach ? "coach" : "student");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const make = async () => {
    setBusy(true);
    setError("");
    try {
      const { downloadReportPdf } = await import("../reportPdf.js");
      const model = buildReport(raw, { window: win });
      await downloadReportPdf({ model, variant, ai: variant === "coach" ? ai : null, narrative: variant === "coach" ? narrative : null });
      onClose();
    } catch (e) {
      console.error("[pdf] oluşturulamadı:", e);
      setError("PDF oluşturulamadı — lütfen tekrar dene.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="PDF raporu" onClose={onClose}>
      <div style={{ ...text(12.5, 500, C.text2), marginBottom: 12, lineHeight: 1.5 }}>{studentName} için A'dan Z'ye rapor: özet, denemeler, ders karnesi, trend, ödev düzeni, net kaybı, konu dökümü, kapsam ve ekler.</div>
      <div style={{ ...text(12, 700, C.mutedLight), marginBottom: 6 }}>Aralık</div>
      <div className="k-chip-row" role="group" aria-label="PDF aralığı" style={{ marginBottom: 14 }}>
        {windows.map((w) => <Chip key={w.key} active={win === w.key} onClick={() => setWin(w.key)}>{w.label}</Chip>)}
      </div>
      {isCoach && (
        <>
          <div style={{ ...text(12, 700, C.mutedLight), marginBottom: 6 }}>Kimin için</div>
          <div className="k-chip-row" role="group" aria-label="PDF türü" style={{ marginBottom: 8 }}>
            <Chip active={variant === "coach"} onClick={() => setVariant("coach")}>Koç için</Chip>
            <Chip active={variant === "parent"} onClick={() => setVariant("parent")}>Veli/öğrenci için</Chip>
          </div>
          <div style={{ ...text(12, 500, C.mutedLight), marginBottom: 14, lineHeight: 1.5 }}>
            {variant === "coach" ? `Koç eki, öğrenci notları, veri notları, aylık değerlendirme${ai ? " ve yapay zekâ incelemesi" : ""} dahil.` : "Koç eki, notlar, veri notları ve değerlendirmeler çıkarılır."} Özel notların hiçbir PDF'e girmez.
          </div>
        </>
      )}
      <Button full icon={Download} disabled={busy} onClick={make}>{busy ? "Hazırlanıyor…" : "PDF oluştur"}</Button>
      {error && <div role="alert" style={{ ...text(12.5, 600, C.red), marginTop: 10 }}>{error}</div>}
    </Modal>
  );
}
