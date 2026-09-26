import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Plus } from "lucide-react";
import { C, bodyFont, monoFont, formatNet, recipientStatus, netOf } from "../../theme.js";
import { Card, EmptyState, SectionHeader, LoadingState, StatusSquare, ListRow, ListGroup, SegmentBar, Legend, SourceTag, AlertBox, ShowMoreButton } from "../../components/common.jsx";
import { api } from "../../api.js";
import { BOARD_BRANCHES, boardBranchOf } from "../../subjects.js";
import { weekBounds, inWeek, dayKey, deadlineLabel, endedLabel, questionCountOf, isSchoolWide } from "../../work.js";
import PushPermissionBanner from "../../components/PushPermissionBanner.jsx";

// Öğrenci ana ekranı — "Bu hafta" (şartname Z1). Branş ödevleri ile koç ödevleri AYNI haftanın işi:
// tek listede, kaynak farkını yalnızca koç ödevindeki mor "koçundan" etiketi taşır. Geciken ödevler
// ayrı bir kovaya konmaz (suçluluk motive etmiyor) — tek satırlık uyarı + listenin başı.

const PAGE_SIZE = 6;
// Sınav tarihi admin panelinden GÜN olarak girilir (UTC gece yarısı). Geri sayım TYT oturumunun
// başlangıcına — Türkiye saatiyle 10.15'e (UTC 07.15) — göre.
const TYT_START_UTC_OFFSET_MS = (7 * 60 + 15) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function YksCard({ examDate }) {
  if (!examDate) {
    return <Card style={{ padding: "16px 20px", marginBottom: 12, color: C.mutedLight, fontFamily: bodyFont, fontSize: 14 }}>YKS tarihi henüz girilmedi.</Card>;
  }
  const examStart = new Date(examDate).getTime() + TYT_START_UTC_OFFSET_MS;
  const diff = examStart - Date.now();
  const dateLabel = new Date(examDate).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  if (diff <= 0) {
    const over = -diff > 2 * DAY_MS;
    return <Card style={{ padding: "16px 20px", marginBottom: 12, fontFamily: bodyFont, fontSize: 15, fontWeight: 600, color: C.text }}>{over ? "Yeni YKS tarihi henüz girilmedi." : "Sınav günü geldi — bol şans!"}</Card>;
  }
  const days = Math.ceil(diff / DAY_MS);
  return (
    <Card style={{ padding: "15px 20px", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.mutedLight }}>YKS'ye kalan</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2 }}>
          <span style={{ fontFamily: monoFont, fontSize: 27, fontWeight: 700, letterSpacing: -1.1, color: C.text }}>{days}</span>
          <span style={{ fontFamily: bodyFont, fontSize: 14, color: C.mutedLight }}>gün</span>
        </div>
      </div>
      <div style={{ textAlign: "right", fontFamily: bodyFont, fontSize: 13, color: C.mutedLight, lineHeight: 1.5 }}>
        <div>{dateLabel}</div>
        <div><span style={{ fontFamily: monoFont }}>{Math.floor(days / 7)}</span> hafta</div>
      </div>
    </Card>
  );
}

// Bu haftanın ödev kartı: sayı, toplam soru, branş/koç dağılımı, haftalık net, dört parçalı şerit.
// Şerit soru sayısıyla çizilir (her ödevin soru sayısı biliniyorsa), yoksa ödev sayısıyla.
function WeekCard({ items }) {
  const qs = items.map((r) => questionCountOf(r.assignment.pageRange));
  const allQ = items.length > 0 && qs.every((q) => q != null);
  const totalQ = allQ ? qs.reduce((a, b) => a + b, 0) : null;
  const weight = (r, i) => (allQ ? qs[i] : 1);
  const sums = { done: 0, missed: 0, skipped: 0, open: 0 };
  items.forEach((r, i) => { sums[recipientStatus(r)] += weight(r, i); });
  const branchCount = items.filter((r) => isSchoolWide(r.assignment)).length;
  const coachCount = items.length - branchCount;
  const nets = items.map((r) => netOf(r.submission)).filter((n) => n != null);
  const weekNet = nets.length ? nets.reduce((a, b) => a + b, 0) : null;
  return (
    <Card style={{ padding: "18px 20px", marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: bodyFont, fontSize: 10.5, fontWeight: 700, letterSpacing: 1.4, color: C.mutedLight }}>BU HAFTANIN ÖDEVLERİ</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: monoFont, fontSize: 34, fontWeight: 700, letterSpacing: -1.4, color: C.text, lineHeight: 1 }}>{items.length}</span>
            <span style={{ fontFamily: bodyFont, fontSize: 14.5, color: C.text2 }}>
              ödev{totalQ != null && <> · <span style={{ fontFamily: monoFont }}>{totalQ}</span> soru</>}
            </span>
          </div>
          {items.length > 0 && (
            <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.mutedLight, marginTop: 6 }}>
              {[branchCount && `${branchCount} branş ödevi`, coachCount && `${coachCount} koç ödevi`].filter(Boolean).join(" + ")}
            </div>
          )}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontFamily: monoFont, fontSize: 27, fontWeight: 700, letterSpacing: -1.1, color: weekNet != null ? C.green : C.faintest }}>{weekNet != null ? formatNet(weekNet, 2) : "—"}</div>
          <div style={{ fontFamily: bodyFont, fontSize: 12, color: C.mutedLight, marginTop: 2 }}>bu haftaki net</div>
        </div>
      </div>
      {items.length > 0 && (
        <>
          <div style={{ marginTop: 16 }}>
            <SegmentBar parts={[
              { label: "çözdüm", value: sums.done, color: C.green },
              { label: "gecikti", value: sums.missed, color: C.red },
              { label: "pas", value: sums.skipped, color: C.amber },
              { label: "kalan", value: sums.open, color: C.faintest },
            ]} />
          </div>
          <Legend style={{ marginTop: 12 }} items={[
            { label: "çözdüm", value: sums.done, color: C.green },
            { label: "gecikti", value: sums.missed, color: C.red },
            { label: "pas", value: sums.skipped, color: C.amber },
            { label: "kalan", value: sums.open, color: C.faintest },
          ]} />
        </>
      )}
    </Card>
  );
}

// Geciken uyarısı — tek satır; öğrenci her ödev için kaç kez uyarılacağını bilmeli (bir kez).
function OverdueAlert({ missed }) {
  if (!missed.length) return null;
  if (missed.length === 1) {
    const r = missed[0];
    const reminded = r.overdueReminderSentAt ? "1 hatırlatma gönderildi" : "tek hatırlatma gönderilir";
    return <AlertBox style={{ marginBottom: 4 }}>{r.assignment.subject} · {r.assignment.topic} ödevinin süresi {endedLabel(r.assignment.endDate).replace(" bitti", "")} doldu · {reminded}</AlertBox>;
  }
  return <AlertBox style={{ marginBottom: 4 }}>{missed.length} ödevinin süresi doldu · her biri için yalnızca 1 hatırlatma gönderilir — hâlâ sonucunu girebilirsin.</AlertBox>;
}

// Satırın alt yazısı: "Matematik · dün bitti" (kırmızı), "çözdüm · 31,0 net" (yeşil), "pas geçtim"
// (sarı), "Pazar 23:59" (soluk).
function rowSubtitle(r) {
  const a = r.assignment;
  const status = recipientStatus(r);
  const net = netOf(r.submission);
  const text = {
    done: net != null ? `çözdüm · ${formatNet(net, 1)} net` : "çözdüm",
    missed: endedLabel(a.endDate),
    skipped: "pas geçtim",
    open: deadlineLabel(a.endDate),
  }[status];
  const color = { done: C.green, missed: C.red, skipped: C.amber, open: C.mutedLight }[status];
  return <>{a.subject} <span aria-hidden="true">·</span> <span style={{ color }}>{text}</span></>;
}

function AssignmentItem({ r, onOpen }) {
  const a = r.assignment;
  const q = questionCountOf(a.pageRange);
  return (
    <ListRow
      left={<StatusSquare subject={a.subject} status={recipientStatus(r)} size={36} />}
      title={a.topic}
      titleExtra={!isSchoolWide(a) ? <SourceTag /> : null}
      subtitle={rowSubtitle(r)}
      right={q != null ? (
        <span style={{ textAlign: "right", flexShrink: 0 }}>
          <span style={{ display: "block", fontFamily: monoFont, fontSize: 17, fontWeight: 700, color: C.text }}>{q}</span>
          <span style={{ display: "block", fontFamily: bodyFont, fontSize: 11, color: C.mutedLight }}>soru</span>
        </span>
      ) : null}
      onClick={() => onOpen(r.id)}
    />
  );
}

// Listenin sırası: gecikenler en üstte, sonra branş ödevleri (koç panosundaki branş sırasıyla), en
// sonda koç ödevleri — koç ile öğrenci aynı düzeni görsün.
const BRANCH_ORDER = Object.fromEntries(BOARD_BRANCHES.map((b, i) => [b.key, i]));
function listRank(r) {
  const status = recipientStatus(r);
  if (status === "missed") return [0, dayKey(r.assignment.endDate)];
  if (isSchoolWide(r.assignment)) return [1, String(BRANCH_ORDER[boardBranchOf(r.assignment.subject)] ?? 9).padStart(2, "0") + r.assignment.subject];
  return [2, dayKey(r.assignment.endDate)];
}

export default function StudentHomeScreen({ onOpen, onOpenStudyLog, refreshKey }) {
  const [recipients, setRecipients] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [examDates, setExamDates] = useState(null);
  const [pastVisible, setPastVisible] = useState(0);

  useEffect(() => {
    setLoading(true);
    setLoadError("");
    Promise.all([api.listMyAssignments(), api.listStudySessions().catch(() => ({ sessions: [] }))])
      .then(([{ recipients }, { sessions }]) => { setRecipients(recipients); setSessions(sessions || []); })
      .catch((e) => setLoadError(e.message || "Ödevler yüklenemedi"))
      .finally(() => setLoading(false));
  }, [refreshKey]);
  useEffect(() => { api.getExamDates().then(setExamDates).catch(() => {}); }, []);

  const week = weekBounds();
  const { weekItems, list, past, missed } = useMemo(() => {
    const weekItems = recipients.filter((r) => inWeek(r.assignment.endDate, week));
    // Liste: bu hafta + önceki haftalardan hâlâ bekleyen (geciken) + ileri tarihli açık ödevler.
    const current = recipients.filter((r) => {
      const status = recipientStatus(r);
      return inWeek(r.assignment.endDate, week) || status === "missed" || (status === "open" && dayKey(r.assignment.endDate) > week.sun);
    });
    const byRank = (a, b) => {
      const [ra, ka] = listRank(a);
      const [rb, kb] = listRank(b);
      return ra - rb || ka.localeCompare(kb);
    };
    const currentIds = new Set(current.map((r) => r.id));
    const past = recipients.filter((r) => !currentIds.has(r.id)).sort((a, b) => dayKey(b.assignment.endDate).localeCompare(dayKey(a.assignment.endDate)));
    return { weekItems, list: [...current].sort(byRank), past, missed: current.filter((r) => recipientStatus(r) === "missed") };
  }, [recipients, week.mon, week.sun]); // eslint-disable-line react-hooks/exhaustive-deps

  const weekSessions = sessions.filter((s) => inWeek(s.studyDate, week));
  const sessionQ = weekSessions.reduce((sum, s) => sum + s.correctCount + s.wrongCount + s.blankCount, 0);
  const sessionNet = weekSessions.reduce((sum, s) => sum + netOf(s), 0);

  return (
    <div className="k-page" style={{ padding: 28, maxWidth: 760, margin: "0 auto" }}>
      <PushPermissionBanner reason="Yeni ödevleri ve son gün hatırlatmalarını kaçırmamak için." />
      {examDates && <YksCard examDate={examDates.yksExamDate} />}

      {loading ? (
        <LoadingState />
      ) : loadError ? (
        <EmptyState text={loadError} />
      ) : (
        <>
          <WeekCard items={weekItems} />
          <OverdueAlert missed={missed} />

          <SectionHeader title="Ödevler" count={list.length} />
          {list.length === 0 ? (
            <EmptyState icon={ClipboardCheck} text={recipients.length ? "Bu hafta bekleyen ödevin yok." : "Henüz sana gönderilmiş bir ödev yok. Branş öğretmenlerin ve koçun ödev gönderdiğinde burada göreceksin."} />
          ) : (
            <ListGroup>
              {list.map((r) => <AssignmentItem key={r.id} r={r} onOpen={onOpen} />)}
            </ListGroup>
          )}

          <SectionHeader title="Kendi çalışmam" />
          <Card style={{ padding: "16px 16px 16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: bodyFont, fontSize: 15.5, fontWeight: 600, color: C.text }}>Serbest çalışma</div>
              <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.mutedLight, marginTop: 3 }}>
                {weekSessions.length
                  ? <>Bu hafta <span style={{ fontFamily: monoFont }}>{weekSessions.length}</span> kayıt · <span style={{ fontFamily: monoFont }}>{sessionQ}</span> soru · <span style={{ fontFamily: monoFont }}>{formatNet(sessionNet, 1)}</span> net</>
                  : "Bu hafta henüz kayıt yok"}
              </div>
            </div>
            {onOpenStudyLog && (
              <button type="button" onClick={onOpenStudyLog} aria-label="Serbest çalışma ekle" className="k-icon-btn" style={{ width: 48, height: 48, borderRadius: 13, flexShrink: 0, background: C.surface2, border: `1px solid ${C.borderStrong}`, color: C.text, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <Plus size={20} strokeWidth={2.2} />
              </button>
            )}
          </Card>

          {past.length > 0 && (
            <>
              <SectionHeader
                title="Önceki haftalar"
                action={{ label: pastVisible ? "Gizle" : `${past.length} ödev`, onClick: () => setPastVisible((v) => (v ? 0 : PAGE_SIZE)) }}
              />
              {pastVisible > 0 && (
                <>
                  <ListGroup>
                    {past.slice(0, pastVisible).map((r) => <AssignmentItem key={r.id} r={r} onOpen={onOpen} />)}
                  </ListGroup>
                  <ShowMoreButton remaining={past.length - pastVisible} onClick={() => setPastVisible((n) => n + PAGE_SIZE)} />
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
