import { useEffect, useState } from "react";
import { Bell, Check, ChevronRight, ClipboardList, AlertTriangle, Users, AlarmClock, BarChart3 } from "lucide-react";
import { C, bodyFont, monoFont } from "../theme.js";
import { Card, Button, EmptyState, LoadingState } from "../components/common.jsx";
import { api } from "../api.js";

// Aynı gönderenden aynı türde, bu süre içinde gelen bildirimler tek kartta toplanır — koç bir kerede
// yedi ödev gönderince yedi ayrı, birbirinden ayırt edilemeyen "az önce" kartı çıkıyordu.
const GROUP_WINDOW_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Gönderen ve ders bildirimde ayrı bir alan değil, yalnızca metinde — sunucudaki metinlerle birebir
// (bkz. server/src/routes/assignments.js ve scheduler.js). Kalıba uymayan metin gruplanmaz/vurgulanmaz.
// Yeni metinlerin sonunda " (son gün: 27 Eylül)" var; eski bildirimlerde yok — ikisi de ayrıştırılır.
const NEW_ASSIGNMENT_RE = /^(.+?) sana yeni bir ödev gönderdi: (.+?) — ([\s\S]*?)(?: \(son gün: ([^)]+)\))?$/;
const OVERDUE_RE = /^"([\s\S]+)" ödevinin süresi geçti([\s\S]*)$/;

function parseNewAssignment(text) {
  const m = NEW_ASSIGNMENT_RE.exec(text || "");
  return m ? { sender: m[1], subject: m[2], topic: m[3], due: m[4] || null } : null;
}

function startOfDay(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Bugünden kaç takvim günü önce (0 = bugün, 1 = dün) — saat farkına değil güne bakar.
function daysAgo(ms, now) {
  return Math.round((startOfDay(now) - startOfDay(ms)) / ONE_DAY_MS);
}

function clockLabel(ms) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
}

// Gün başlığı: "BUGÜN" / "DÜN" / "24 EYLÜL" (başka yıldansa yıl da).
function dayLabel(ms, now) {
  const ago = daysAgo(ms, now);
  if (ago <= 0) return "BUGÜN";
  if (ago === 1) return "DÜN";
  const d = new Date(ms);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", ...(sameYear ? {} : { year: "numeric" }) }).toLocaleUpperCase("tr-TR");
}

// Bugünküler göreli ("az önce", "12 dk önce", "3 sa önce"); önceki günler zaten gün başlığı altında
// olduğu için yalnızca saat ("dün 23.00", "18.20").
function timeLabel(ms, now) {
  const ago = daysAgo(ms, now);
  if (ago <= 0) {
    const mins = Math.floor((now - ms) / 60000);
    if (mins < 1) return "az önce";
    if (mins < 60) return `${mins} dk önce`;
    return `${Math.floor(mins / 60)} sa önce`;
  }
  return ago === 1 ? `dün ${clockLabel(ms)}` : clockLabel(ms);
}

// Yeni-ödev bildirimlerini gönderene göre gruplar. Liste en yeniden eskiye; bir bildirim, aynı
// gönderenin en son açılan grubuna — grubun en yenisiyle arası ≤ 1 saat ve aynı gün ise — katılır.
// Aynı gün şartı: bir grup gece yarısını aşıp iki gün başlığı arasında bölünmesin.
function buildEntries(notifications) {
  const sorted = [...notifications].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const entries = [];
  const openGroupBySender = new Map();
  for (const n of sorted) {
    const at = new Date(n.createdAt).getTime();
    const parsed = n.type === "assignment" ? parseNewAssignment(n.text) : null;
    if (parsed) {
      const key = `${n.type}|${parsed.sender}`;
      const g = openGroupBySender.get(key);
      if (g && g.newestAt - at <= GROUP_WINDOW_MS && startOfDay(g.newestAt) === startOfDay(at)) {
        g.items.push({ n, parsed });
        continue;
      }
      const group = { id: n.id, newestAt: at, sender: parsed.sender, items: [{ n, parsed }] };
      openGroupBySender.set(key, group);
      entries.push(group);
    } else {
      entries.push({ id: n.id, newestAt: at, items: [{ n, parsed: null }] });
    }
  }
  return entries;
}

function Highlight({ color, children }) {
  return <span style={{ color }}>{children}</span>;
}

// Tekil bildirim metni — ödevin "Ders — Konu" kısmı türün renginde vurgulanır.
function notificationText(n, toneColor) {
  if (n.type === "assignment") {
    const p = parseNewAssignment(n.text);
    if (p) {
      return (
        <>
          {p.sender} sana yeni bir ödev gönderdi: <Highlight color={toneColor}>{p.subject} — {p.topic}</Highlight>
          {p.due && <span style={{ fontWeight: 500, color: C.muted }}> · son gün {p.due}</span>}
        </>
      );
    }
  }
  if (n.type === "assignment_overdue" || n.type === "assignment_overdue_summary") {
    const m = OVERDUE_RE.exec(n.text || "");
    if (m) return <><Highlight color={toneColor}>{m[1]}</Highlight> ödevinin süresi geçti{m[2]}</>;
  }
  return n.text;
}

function IconBox({ icon: Icon, tone }) {
  return (
    <span style={{ width: 38, height: 38, borderRadius: 12, background: tone.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <Icon size={18} strokeWidth={2.1} color={tone.fg} />
    </span>
  );
}

function UnreadDot() {
  return <span aria-label="Okunmadı" style={{ width: 8, height: 8, borderRadius: 999, background: C.accent, flexShrink: 0 }} />;
}

function TimeText({ children }) {
  return <span style={{ display: "block", fontSize: 11.5, fontWeight: 500, color: C.mutedLight, marginTop: 4 }}>{children}</span>;
}

function cardButtonStyle(tappable) {
  return { display: "block", width: "100%", padding: "14px 15px", background: "none", border: "none", textAlign: "left", cursor: tappable ? "pointer" : "default", fontFamily: bodyFont };
}

function DayHeader({ label, first }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: first ? "4px 0 10px" : "20px 0 10px" }}>
      <span style={{ fontFamily: bodyFont, fontSize: 10.5, fontWeight: 800, letterSpacing: 1.2, color: C.mutedLight, whiteSpace: "nowrap" }}>{label}</span>
      <span aria-hidden="true" style={{ flex: 1, height: 1, background: C.border }} />
    </div>
  );
}

export default function NotificationsScreen({ onOpenTarget }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  // Sunucu yalnızca son 50 bildirimi döner ama rozet TÜM okunmamışları sayar — "Tümünü okundu işaretle"
  // yalnızca görünen 50'ye bakınca, daha eski okunmamışlar varken düğme gizleniyor ve rozet sonsuza
  // kadar takılı kalıyordu. Sunucunun toplam sayısı da tutulur.
  const [serverUnreadCount, setServerUnreadCount] = useState(0);

  const load = () => {
    api.listNotifications()
      .then(({ notifications, unreadCount }) => { setNotifications(notifications); setServerUnreadCount(unreadCount || 0); })
      .catch((e) => setLoadError(e.message || "Bildirimler yüklenemedi"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const markRead = (ids) => {
    if (!ids.length) return;
    const idSet = new Set(ids);
    setNotifications((ns) => ns.map((n) => (idSet.has(n.id) ? { ...n, read: true } : n)));
    setServerUnreadCount((c) => Math.max(0, c - ids.length));
    ids.forEach((id) => api.markNotificationRead(id).catch(() => {}));
  };

  const markAllRead = async () => {
    setNotifications((ns) => ns.map((n) => ({ ...n, read: true })));
    setServerUnreadCount(0);
    api.markAllNotificationsRead().catch(() => {});
  };

  const unreadCount = Math.max(serverUnreadCount, notifications.filter((n) => !n.read).length);

  // Bildirime dokunmak okundu işaretler VE ilgili ödevi açar (push'a dokunmakla aynı hedef, bkz.
  // App.jsx > goToNotificationTarget) — önceden yalnızca okundu işaretliyordu, öğrenci ödevi ayrıca
  // listeden bulmak zorunda kalıyordu.
  const openNotification = (n) => {
    if (!n.read) markRead([n.id]);
    if (n.data?.screen && onOpenTarget) onOpenTarget(n.data);
  };

  // Gruplu kart tek bir ödeve değil ödev listesine gider; içindeki okunmamışların hepsi okundu olur.
  const openGroup = (group) => {
    markRead(group.items.filter(({ n }) => !n.read).map(({ n }) => n.id));
    if (onOpenTarget) onOpenTarget({ screen: "home" });
  };

  const now = Date.now();
  const entries = buildEntries(notifications);

  const renderSingle = (n) => {
    const { icon, tone } = NOTIFICATION_STYLE[n.type] || NOTIFICATION_STYLE.info;
    const tappable = !n.read || !!n.data?.screen;
    return (
      <Card key={n.id} hover={tappable} style={{ padding: 0 }}>
        <button type="button" onClick={() => openNotification(n)} disabled={!tappable} style={cardButtonStyle(tappable)}>
          <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <IconBox icon={icon} tone={tone} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14, lineHeight: 1.4, fontWeight: n.read ? 600 : 700, color: n.read ? C.text2 : C.text, overflowWrap: "anywhere" }}>
                {notificationText(n, tone.fg)}
              </span>
              <TimeText>{timeLabel(new Date(n.createdAt).getTime(), now)}</TimeText>
            </span>
            {!n.read && <UnreadDot />}
            {n.read && n.data?.screen && <ChevronRight size={16} color={C.faintest} style={{ flexShrink: 0 }} />}
          </span>
        </button>
      </Card>
    );
  };

  const renderGroup = (group) => {
    const { icon, tone } = NOTIFICATION_STYLE.assignment;
    const anyUnread = group.items.some(({ n }) => !n.read);
    const tappable = anyUnread || !!onOpenTarget;
    // Ders çipleri: her ders bir kez, aynı dersten birden fazla ödev varsa yanında adedi.
    const subjectCounts = new Map();
    for (const { parsed } of group.items) subjectCounts.set(parsed.subject, (subjectCounts.get(parsed.subject) || 0) + 1);
    return (
      <Card key={group.id} hover={tappable} style={{ padding: 0 }}>
        <button type="button" onClick={() => openGroup(group)} disabled={!tappable} style={cardButtonStyle(tappable)}>
          <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <IconBox icon={icon} tone={tone} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14, lineHeight: 1.4, fontWeight: 700, color: anyUnread ? C.text : C.text2, overflowWrap: "anywhere" }}>
                {group.sender} sana <Highlight color={tone.fg}>{group.items.length} ödev</Highlight> gönderdi
              </span>
              <TimeText>{timeLabel(group.newestAt, now)}</TimeText>
            </span>
            {anyUnread && <UnreadDot />}
            {!anyUnread && onOpenTarget && <ChevronRight size={16} color={C.faintest} style={{ flexShrink: 0 }} />}
          </span>
          <span style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 11 }}>
            {[...subjectCounts].map(([subject, count]) => (
              <span key={subject} style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 24, padding: "0 9px", borderRadius: 8, background: C.surface2, color: C.text2, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
                {subject}
                {count > 1 && <span style={{ fontFamily: monoFont, color: C.muted }}>×{count}</span>}
              </span>
            ))}
          </span>
        </button>
      </Card>
    );
  };

  // Gün başlıklarıyla birlikte düz bir liste — girişler zaten en yeniden eskiye sıralı.
  const rows = [];
  let lastDay = null;
  for (const entry of entries) {
    const day = startOfDay(entry.newestAt);
    if (day !== lastDay) {
      rows.push(<DayHeader key={`day-${day}`} label={dayLabel(entry.newestAt, now)} first={lastDay === null} />);
      lastDay = day;
    }
    rows.push(
      <div key={entry.id} style={{ marginBottom: 8 }}>
        {entry.items.length > 1 ? renderGroup(entry) : renderSingle(entry.items[0].n)}
      </div>
    );
  }

  return (
    <div className="k-page" style={{ padding: 28, maxWidth: 760, margin: "0 auto" }}>
      {unreadCount > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
          <span style={{ fontFamily: bodyFont, fontSize: 13, fontWeight: 600, color: C.muted }}>{unreadCount} okunmamış</span>
          <Button small variant="ghost" icon={Check} onClick={markAllRead} style={{ paddingRight: 0 }}>Tümünü okundu yap</Button>
        </div>
      )}
      {loading ? (
        <LoadingState />
      ) : loadError ? (
        <EmptyState text={loadError} />
      ) : notifications.length === 0 ? (
        <EmptyState icon={Bell} text="Henüz bildirim yok. Yeni bir ödev geldiğinde burada görünecek." />
      ) : (
        <div>{rows}</div>
      )}
    </div>
  );
}

// Bildirim türüne göre simge + renk — sunucudaki notifyUser çağrılarının type değerleri
// (bkz. server/src/scheduler.js, routes/assignments.js).
const NOTIFICATION_STYLE = {
  get assignment() { return { icon: ClipboardList, tone: { bg: C.accentSoft, fg: C.accent } }; },
  get assignment_due() { return { icon: AlarmClock, tone: { bg: C.amberSoft, fg: C.amber } }; },
  get assignment_overdue() { return { icon: AlertTriangle, tone: { bg: C.redSoft, fg: C.red } }; },
  get assignment_overdue_summary() { return { icon: Users, tone: { bg: C.amberSoft, fg: C.amber } }; },
  get monthly_report() { return { icon: BarChart3, tone: { bg: C.surface2, fg: C.text2 } }; },
  get info() { return { icon: Bell, tone: { bg: C.surface2, fg: C.muted } }; },
};
