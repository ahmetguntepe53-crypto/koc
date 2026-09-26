import { useState } from "react";
import { Clock, PauseCircle, Plus, Send } from "lucide-react";
import { C } from "../../theme.js";
import { Modal, Pill, ShowMoreButton } from "../../components/common.jsx";
import { fmtPct, fmtInt, fmtNet, fmtDay, TOPIC_STATUS, SKIP_OWNER } from "../../reportModel.js";
import { SKIP_REASONS } from "../../theme.js";
import { LabelChip, TrendMark, NoValue, Collapsible, SmallButton, mono, text } from "./parts.jsx";

const TONE = { solid: C.green, review: C.amber, open: C.amber, growing: C.text2, few: C.mutedLight };

function TopicRow({ t, right, sub }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: `1px solid ${C.divider}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...text(13.5, 600), overflow: "hidden", textOverflow: "ellipsis" }} title={t.raws?.join(" · ")}>
          {t.name}{t.approx ? <span style={text(12, 600, C.mutedLight)} title="yaklaşık eşleşme"> ~</span> : null}
        </div>
        {sub && <div style={{ ...text(12, 500, C.mutedLight), marginTop: 2 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

function ListBlock({ title, color, children, empty }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ ...text(12, 700, color || C.text2), marginBottom: 4 }}>{title}</div>
      {children && (Array.isArray(children) ? children.length : true) ? children : <div style={text(12.5, 500, C.mutedLight)}>{empty}</div>}
    </div>
  );
}

// Okul karşılaştırma şeridi: 0–100, gri Q1–Q3 bandı, ince medyan çizgisi, öğrencinin noktası.
function SchoolStrip({ row }) {
  const pos = (v) => `${Math.max(0, Math.min(100, v))}%`;
  const dot = row.tone === "green" ? C.green : row.tone === "amber" ? C.amber : C.text;
  return (
    <div role="img" aria-label={`Sen ${fmtPct(row.mine)}, okul medyanı ${fmtPct(row.median)}, orta yarı ${fmtPct(row.q1)}–${fmtPct(row.q3)}`}
      style={{ position: "relative", height: 14, borderRadius: 7, background: C.surface2, marginTop: 6 }}>
      <span style={{ position: "absolute", top: 3, bottom: 3, left: pos(row.q1), width: `calc(${pos(row.q3)} - ${pos(row.q1)})`, background: C.borderStrong, borderRadius: 4 }} />
      <span style={{ position: "absolute", top: 0, bottom: 0, left: pos(row.median), width: 2, background: C.mutedLight }} />
      <span style={{ position: "absolute", top: 2, left: `calc(${pos(row.mine)} - 5px)`, width: 10, height: 10, borderRadius: 999, background: dot, border: `2px solid ${C.surface}` }} />
    </div>
  );
}

export default function SubjectDetail({ subject: s, isCoach, onClose, onStudy, onAssign, onOpenItem }) {
  const [page, setPage] = useState(20);
  const recs = [...s.records].reverse();
  const act = (topic) => (isCoach
    ? onAssign && <SmallButton icon={Send} onClick={() => onAssign(s.key, topic)}>Bu konuya ödev ver</SmallButton>
    : onStudy && <SmallButton icon={Plus} onClick={() => onStudy(s.key, topic)}>Çalışma ekle</SmallButton>);
  const unmatched = s.records.filter((r) => r.topicUnmatched);
  return (
    <Modal title={s.name} onClose={onClose}>
      {/* Ders özeti */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <NoValue value={s.agg.NO} size={26} />
        <span style={text(12, 500, C.mutedLight)}>net oranı</span>
        <LabelChip label={s.label} from8w={s.from8w} />
        {s.konuBadge && <Pill tone="amber">konu pası {s.konuPass}</Pill>}
        <TrendMark trend={s.trend} student={!isCoach} withLabel />
      </div>
      <div style={{ ...text(12.5, 500, C.text2), marginTop: 8, lineHeight: 1.5 }}>Neden? {isCoach ? s.reason.coach : s.reason.student}</div>
      {s.trend?.note && <div style={{ ...text(12, 500, C.mutedLight), marginTop: 4 }}>Not: {s.trend.note}</div>}
      {isCoach && s.trend?.coachNote && <div style={{ ...text(12, 500, C.mutedLight), marginTop: 4 }}>Not: {s.trend.coachNote}</div>}
      <div style={{ ...mono(12.5, 600, C.text2), marginTop: 8 }}>
        Ödevde {fmtPct(s.hw.NO)} · Serbestte {fmtPct(s.free.NO)} · {fmtInt(s.agg.Q)} soru · {s.agg.n} kayıt
      </div>
      {s.schoolLine && <div style={{ ...text(12.5, 600, C.text2), marginTop: 4 }}>{isCoach ? s.schoolLine.coach : s.schoolLine.student}</div>}

      <ListBlock title="Önce bunlar" color={C.amber} empty="Şu an öne çıkan bir konu yok (konu başına en az 20 soru gerekiyor).">
        {s.lists.first.map((t) => (
          <TopicRow key={t.key} t={t} sub={<span style={mono(12, 600, C.mutedLight)}>{fmtPct(t.rStar)} · {t.Q} soru{t.books.length ? ` · ${t.books.join(", ")}` : ""}</span>} right={act(t.name)} />
        ))}
      </ListBlock>
      <ListBlock title="En sağlam konuların" color={C.green} empty="Henüz 'pekişti' diyebileceğimiz bir konu yok.">
        {s.lists.solid.map((t) => <TopicRow key={t.key} t={t} sub={<span style={mono(12, 600, C.mutedLight)}>{fmtPct(t.rStar)} · {t.Q} soru</span>} />)}
      </ListBlock>
      {s.lists.open.length > 0 && (
        <ListBlock title="Açık konular" color={C.amber}>
          {s.lists.open.map((o) => (
            <TopicRow key={o.itemId} t={o}
              sub={<span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <PauseCircle size={13} color={C.amber} aria-hidden="true" />
                {o.state === "skip" ? SKIP_REASONS[o.reason] || "Pas geçildi" : "sessiz kaldı"}
                {isCoach && o.state === "skip" && o.reason ? ` · ${SKIP_OWNER[o.reason]}${o.reason === "KONU" && o.teacher ? `: ${o.teacher}` : ""}` : ""}
              </span>}
              right={isCoach ? act(o.name) : onOpenItem && <SmallButton onClick={() => onOpenItem(o.itemId)}>Sonucu gir</SmallButton>} />
          ))}
        </ListBlock>
      )}
      {s.tracked && s.lists.schoolNoRecord.length > 0 && (
        <ListBlock title="Okulda işlendi, sende kayıt yok">
          {s.lists.schoolNoRecord.slice(0, 6).map((t) => <TopicRow key={t.key} t={t} sub={`${fmtDay(t.endDay)}${t.teacher ? ` · ${t.teacher}` : ""}`} right={act(t.name)} />)}
        </ListBlock>
      )}
      {s.lists.review.length > 0 && (
        <ListBlock title="Tekrar zamanı">
          {s.lists.review.slice(0, 4).map((t) => (
            <TopicRow key={t.key} t={t}
              sub={<span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Clock size={13} aria-hidden="true" /><span style={mono(12, 600, C.mutedLight)}>{t.daysSince} gün önce · {fmtPct(t.rStar)}</span></span>}
              right={act(t.name)} />
          ))}
        </ListBlock>
      )}

      {s.schoolRows.length > 0 && (
        <Collapsible title={isCoach ? "Okul ödevlerinde yeri" : "Okulla karşılaştır"} count={s.schoolRows.length} defaultOpen={isCoach}>
          {s.schoolRows.map((r) => (
            <div key={r.itemId} style={{ padding: "10px 0", borderTop: `1px solid ${C.divider}` }}>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <span style={{ ...text(12.5, 600), flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.topic}</span>
                <span style={mono(11.5, 600, C.mutedLight)}>{fmtDay(r.day)}</span>
              </div>
              <SchoolStrip row={r} />
              <div style={{ ...mono(11.5, 600, C.text2), marginTop: 5 }}>
                Sen {fmtPct(r.mine)} · Medyan {fmtPct(r.median)} · {r.n}/{r.recipients}
                {isCoach && r.pct != null ? ` · yüzdelik ${r.pct}` : !isCoach && r.pct >= 50 ? ` · ${r.pct >= 75 ? "üst çeyrek" : "üst yarı"}` : ""}
                {r.scope === "school" ? " · tüm okul" : ""}
              </div>
            </div>
          ))}
        </Collapsible>
      )}

      {s.reviewList.length > 0 && (
        <Collapsible title="Tekrar listesi" count={s.reviewList.length}>
          {s.reviewList.map((r, i) => (
            <div key={i} style={{ padding: "8px 0", borderTop: `1px solid ${C.divider}` }}>
              <div style={text(12.5, 600)}>{r.topic} · <span style={text(12, 500, C.mutedLight)}>{r.source}</span> · <span style={mono(11.5, 600, C.mutedLight)}>{fmtDay(r.day)}</span></div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>{r.numbers.map((n) => <Pill key={n} mono>{n}</Pill>)}</div>
            </div>
          ))}
        </Collapsible>
      )}

      <Collapsible title="Tüm konular" count={s.topics.length}>
        {s.topics.map((t) => (
          <div key={t.key} style={{ padding: "8px 0", borderTop: `1px solid ${C.divider}` }}>
            <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
              <span style={{ ...text(12.5, 600), flex: 1, minWidth: 0 }}>{t.name}{t.approx ? " ~" : ""}</span>
              <span style={mono(12, 700, t.NO < 0 ? C.red : C.text)}>{fmtPct(t.NO)}</span>
              <span style={text(11.5, 600, TONE[t.status])}>{TOPIC_STATUS[t.status]}</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: C.surface2, marginTop: 5 }}>
              <div style={{ width: `${Math.max(0, Math.min(100, t.NO ?? 0))}%`, height: "100%", borderRadius: 2, background: C.text2 }} />
            </div>
            <div style={{ ...mono(11, 500, C.mutedLight), marginTop: 3 }}>{t.n} kayıt · {t.Q} soru · son {fmtDay(t.lastDay)}</div>
          </div>
        ))}
      </Collapsible>

      <Collapsible title="Tüm kayıtlar" count={recs.length}>
        {recs.slice(0, page).map((r, i) => (
          <div key={`${r.day}-${i}`} style={{ padding: "8px 0", borderTop: `1px solid ${C.divider}` }}>
            <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
              <span style={{ ...text(12.5, 600), flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.topicName}</span>
              <span style={mono(11.5, 600, C.mutedLight)}>{fmtDay(r.day)}</span>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 5 }}>
              <Pill tone={r.kind === "coach" ? "koc" : "muted"}>{r.kind === "school" ? "okul" : r.kind === "coach" ? "kişisel" : "serbest"}</Pill>
              <Pill tone="green" mono>D {r.D}</Pill><Pill tone="red" mono>Y {r.Y}</Pill><Pill mono>B {r.B}</Pill>
              <span style={mono(12, 700, r.net < 0 ? C.red : C.text)}>{fmtNet(r.net)} net · {fmtPct(r.r)}</span>
            </div>
          </div>
        ))}
        <ShowMoreButton remaining={Math.min(20, recs.length - page)} onClick={() => setPage((p) => p + 20)} />
      </Collapsible>

      {isCoach && unmatched.length > 0 && (
        <Collapsible title="Eşleşmeyen kayıtlar" count={unmatched.length}>
          {unmatched.map((r, i) => <div key={i} style={{ ...text(12.5, 500, C.text2), padding: "6px 0", borderTop: `1px solid ${C.divider}` }}>{r.topic} · <span style={mono(11.5, 600, C.mutedLight)}>{fmtDay(r.day)}</span></div>)}
        </Collapsible>
      )}
      <div style={{ ...text(11.5, 500, C.mutedLight), marginTop: 16 }}>Konu eşleştirmesi metinden yaklaşık olarak yapılır (~).</div>
    </Modal>
  );
}
