import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Plus, ChevronRight, Clock, BookOpen, ClipboardList, History } from "lucide-react";
import { C, bodyFont, displayFont, formatNet, recipientStatus, netOf } from "../../theme.js";
import { EmptyState, LoadingState, StatusSquare, SegmentBar, Legend, AlertBox, ShowMoreButton, Avatar } from "../../components/common.jsx";
import { HeroHeader, HeroBell, HeroStat, SectionCard, StatusChip, PrimaryButton, NUM } from "../../components/brand.jsx";
import { api } from "../../api.js";
import { weekBounds, inWeek, dayKey, deadlineLabel, endedLabel, questionCountOf } from "../../work.js";
import PushPermissionBanner from "../../components/PushPermissionBanner.jsx";

// Öğrenci ana ekranı — "Bu hafta" (şartname Z1). Branş ödevleri ile koç ödevleri AYNI haftanın işi: tek
// listede (kaynak çipi 2026-10-05 kaldırıldı). Geciken ödevler ayrı bir kovaya konmaz (suçluluk motive
// etmiyor) — tek satırlık uyarı + listenin başı.

const PAGE_SIZE = 6;
// Sınav tarihi admin panelinden GÜN olarak girilir (UTC gece yarısı). Geri sayım TYT oturumunun
// başlangıcına — Türkiye saatiyle 10.15'e (UTC 07.15) — göre.
const TYT_START_UTC_OFFSET_MS = (7 * 60 + 15) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const fmtNet = (v) => formatNet(v, 2).replace(/,00$/, ",0").replace(/(,\d)0$/, "$1");
const cap = (t) => (t ? t.charAt(0).toLocaleUpperCase("tr-TR") + t.slice(1) : t);

// YKS geri sayımı (üst alandaki lime kutu): { value, label }.
function yksStat(examDate) {
  if (!examDate) return { value: "—", label: "YKS tarihi girilmedi" };
  const diff = new Date(examDate).getTime() + TYT_START_UTC_OFFSET_MS - Date.now();
  if (diff <= 0) return -diff > 2 * DAY_MS ? { value: "—", label: "yeni YKS tarihi yok" } : { value: "Bugün", label: "YKS günü · bol şans!" };
  return { value: Math.ceil(diff / DAY_MS), label: "gün YKS'ye" };
}

// Koçun verdiği ödev mi (öğrencinin koçu = ödevi veren) — "Tüm okul" kaldırıldığından beri branş öğretmeninin
// sınıfa gönderdiği ödev de okul çapında değil; kaynağı hedef tipinden değil öğretmenden anlaşılır.

// Satır: "Cuma 23:59'a kadar", "Salı çözdün · 15,5 net", "süresi dün doldu", "pas geçtin".
function rowStatus(r) {
  const a = r.assignment;
  const status = recipientStatus(r);
  const net = netOf(r.submission);
  const q = questionCountOf(a.pageRange);
  const qText = q != null ? ` · ${q} soru` : "";
  if (status === "done") return { chip: ["success", "Çözdüm"], line: `${net != null ? `${fmtNet(net)} net` : "sonucun girildi"}${qText}` };
  if (status === "missed") return { chip: ["danger", "Gecikti"], line: `Süresi ${endedLabel(a.endDate).replace(" bitti", "")} doldu${qText}` };
  if (status === "skipped") return { chip: ["track", "Pas geçtim"], line: `Pas geçtin${qText}` };
  const due = deadlineLabel(a.endDate);
  return { chip: ["warning", "Bekliyor"], line: `${due.endsWith("23:59") ? `${cap(due)}'a kadar` : `Son gün ${due}`}${qText}` };
}

function AssignmentItem({ r, onOpen, user }) {
  const a = r.assignment;
  const { chip, line } = rowStatus(r);
  return (
    <button
      type="button"
      onClick={() => onOpen(r.id)}
      className="k-list-row"
      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 16, border: "none", background: C.pageTint, textAlign: "left", cursor: "pointer" }}
    >
      <StatusSquare subject={a.subject} status={recipientStatus(r)} size={40} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontFamily: bodyFont, fontSize: 12, fontWeight: 600, color: C.brandText }}>{a.subject}</span>
        </span>
        <span style={{ display: "block", fontFamily: bodyFont, fontSize: 15, fontWeight: 700, color: C.inkText, marginTop: 1, overflowWrap: "anywhere" }}>{a.topic}</span>
        <span style={{ ...NUM, display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: C.inkMuted, marginTop: 3 }}>
          <Clock size={12} aria-hidden="true" style={{ flexShrink: 0 }} />{line}
        </span>
      </span>
      <StatusChip tone={chip[0]}>{chip[1]}</StatusChip>
      <ChevronRight size={18} color={C.brandText} aria-hidden="true" style={{ flexShrink: 0 }} />
    </button>
  );
}

// Geciken uyarısı — tek satır; öğrenci her ödev için kaç kez uyarılacağını bilmeli (bir kez).
function OverdueAlert({ missed }) {
  if (!missed.length) return null;
  if (missed.length === 1) {
    const r = missed[0];
    const reminded = r.overdueReminderSentAt ? "1 hatırlatma gönderildi" : "tek hatırlatma gönderilir";
    return <AlertBox>{r.assignment.subject} · {r.assignment.topic} ödevinin süresi {endedLabel(r.assignment.endDate).replace(" bitti", "")} doldu · {reminded}</AlertBox>;
  }
  return <AlertBox>{missed.length} ödevinin süresi doldu · her biri için yalnızca 1 hatırlatma gönderilir — hâlâ sonucunu girebilirsin.</AlertBox>;
}

// Listenin sırası: yapılacaklar üstte, bitenler altta — önce geciken, sonra bekleyen (son günü yakın olan önce),
// sonra pas geçilen, en altta çözülen (en son biten önce).
const STATUS_ORDER = { missed: 0, open: 1, skipped: 2, done: 3 };
function listRank(r) {
  const status = recipientStatus(r);
  const t = Date.parse(dayKey(r.assignment.endDate));
  return [STATUS_ORDER[status], status === "done" || status === "skipped" ? -t : t];
}

export default function StudentHomeScreen({ user, onOpen, onOpenStudyLog, onOpenProfile, refreshKey, unreadCount, onOpenNotifications }) {
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
      return ra - rb || ka - kb;
    };
    const currentIds = new Set(current.map((r) => r.id));
    const past = recipients.filter((r) => !currentIds.has(r.id)).sort((a, b) => dayKey(b.assignment.endDate).localeCompare(dayKey(a.assignment.endDate)));
    return { weekItems, list: [...current].sort(byRank), past, missed: current.filter((r) => recipientStatus(r) === "missed") };
  }, [recipients, week.mon, week.sun, user?.teacherId]); // eslint-disable-line react-hooks/exhaustive-deps

  const weekSessions = sessions.filter((s) => inWeek(s.studyDate, week));
  const sessionQ = weekSessions.reduce((sum, s) => sum + s.correctCount + s.wrongCount + s.blankCount, 0);
  const sessionNet = weekSessions.reduce((sum, s) => sum + netOf(s), 0);

  // Bu haftanın dağılımı (soru sayısı biliniyorsa soruyla, yoksa ödev sayısıyla).
  const qs = weekItems.map((r) => questionCountOf(r.assignment.pageRange));
  const allQ = weekItems.length > 0 && qs.every((q) => q != null);
  const sums = { done: 0, missed: 0, skipped: 0, open: 0 };
  weekItems.forEach((r, i) => { sums[recipientStatus(r)] += allQ ? qs[i] : 1; });
  const doneCount = weekItems.filter((r) => recipientStatus(r) === "done").length;
  const nets = weekItems.map((r) => netOf(r.submission)).filter((n) => n != null);
  const weekNet = nets.length ? nets.reduce((a, b) => a + b, 0) : null;
  const yks = yksStat(examDates?.yksExamDate);
  const legend = [
    { label: allQ ? "soru çözdüm" : "çözdüm", value: sums.done, color: C.success },
    { label: "gecikti", value: sums.missed, color: C.danger },
    { label: "pas", value: sums.skipped, color: C.warningText },
    { label: "kalan", value: sums.open, color: C.barEmpty },
  ];

  return (
    <div>
      <HeroHeader compact>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {user?.avatar && (
            <button type="button" onClick={onOpenProfile} aria-label="Profil resmim" style={{ padding: 0, border: "none", background: "none", cursor: onOpenProfile ? "pointer" : "default", borderRadius: 999, flexShrink: 0 }}>
              <Avatar name={user.name} size={48} avatar={user.avatar} />
            </button>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.onBrandMuted, lineHeight: 1.35 }}>
              {[user?.name, user?.className, user?.coach?.name && `Koçun: ${user.coach.name}`].filter(Boolean).join(" · ")}
            </div>
            <h1 style={{ margin: 0, fontFamily: displayFont, fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", color: C.onBrand }}>Bu hafta</h1>
          </div>
          <HeroBell unreadCount={unreadCount} onClick={onOpenNotifications} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 18 }}>
          <HeroStat lime label={yks.label} value={yks.value} />
          <HeroStat label="ödev çözdüm" value={<>{doneCount}<span style={{ color: C.onBrandMuted }}>/{weekItems.length}</span></>} />
          <HeroStat label="bu haftaki net" value={weekNet != null ? fmtNet(weekNet) : "—"} />
        </div>
      </HeroHeader>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px 16px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
        <PushPermissionBanner reason="Yeni ödevleri ve son gün hatırlatmalarını kaçırmamak için." />
        {user && !user.field && onOpenProfile && (
          <AlertBox tone="amber" title="YKS alanını seçmelisin">
            Raporun AYT derslerini alanına göre izlesin diye profilinden alanını (SAY, EA, SÖZ, DİL) seç.
            <div style={{ marginTop: 10, maxWidth: 220 }}><PrimaryButton onClick={onOpenProfile} style={{ minHeight: 44, borderRadius: 14, fontSize: 14 }}>Alanımı seç</PrimaryButton></div>
          </AlertBox>
        )}

        {loading ? (
          <LoadingState />
        ) : loadError ? (
          <EmptyState text={loadError} />
        ) : (
          <>
            <OverdueAlert missed={missed} />

            <SectionCard icon={ClipboardList} iconBg={C.brand} iconFg={C.onBrand} title="Ödevler" count={list.length} countTone="brand">
              {weekItems.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <SegmentBar height={10} gap={3} radius={5} parts={legend} />
                  <Legend items={legend} numFont={bodyFont} labelColor={C.inkMuted} valueColor={C.inkText} fontSize={12} style={{ marginTop: 8, columnGap: 12 }} />
                </div>
              )}
              {list.length === 0 ? (
                <div style={{ marginTop: 12 }}><EmptyState compact icon={ClipboardCheck} text={recipients.length ? "Bu hafta bekleyen ödevin yok." : "Henüz sana gönderilmiş bir ödev yok. Branş öğretmenlerin ve koçun ödev gönderdiğinde burada göreceksin."} /></div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                  {list.map((r) => <AssignmentItem key={r.id} r={r} onOpen={onOpen} user={user} />)}
                </div>
              )}
            </SectionCard>

            <SectionCard
              icon={BookOpen} iconBg={C.successTint} iconFg={C.successText} title="Kendi çalışmam"
              right={onOpenStudyLog && (
                <button type="button" onClick={onOpenStudyLog} aria-label="Serbest çalışma ekle" className="k-icon-btn" style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0, background: C.brandTint, border: "none", color: C.brandText, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <Plus size={20} strokeWidth={2.4} />
                </button>
              )}
            >
              <div style={{ ...NUM, fontSize: 13, color: C.inkMuted, marginTop: 6, paddingLeft: 42 }}>
                {weekSessions.length ? `Bu hafta ${weekSessions.length} kayıt · ${sessionQ} soru · ${fmtNet(sessionNet)} net` : "Bu hafta henüz kayıt yok"}
              </div>
            </SectionCard>

            {past.length > 0 && (
              <SectionCard
                icon={History} iconBg={C.track} iconFg={C.inkText} title="Önceki haftalar" count={past.length}
                right={(
                  <button type="button" onClick={() => setPastVisible((v) => (v ? 0 : PAGE_SIZE))} style={{ minHeight: 44, padding: "0 4px", background: "none", border: "none", cursor: "pointer", fontFamily: bodyFont, fontSize: 13, fontWeight: 700, color: C.brandText }}>
                    {pastVisible ? "Gizle" : "Göster"}
                  </button>
                )}
              >
                {pastVisible > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                    {past.slice(0, pastVisible).map((r) => <AssignmentItem key={r.id} r={r} onOpen={onOpen} user={user} />)}
                    <ShowMoreButton remaining={past.length - pastVisible} onClick={() => setPastVisible((n) => n + PAGE_SIZE)} />
                  </div>
                )}
              </SectionCard>
            )}
          </>
        )}
      </div>
    </div>
  );
}
