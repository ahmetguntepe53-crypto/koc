import { useEffect, useState } from "react";
import { Bell, CheckCheck, ChevronRight, ClipboardList, AlertTriangle, Users } from "lucide-react";
import { C, bodyFont } from "../theme.js";
import { Card, Button, EmptyState, LoadingState } from "../components/common.jsx";
import { api } from "../api.js";

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "az önce";
  if (mins < 60) return `${mins} dk önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.floor(hours / 24);
  return `${days} gün önce`;
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

  const markRead = async (id) => {
    setNotifications((ns) => ns.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setServerUnreadCount((c) => Math.max(0, c - 1));
    api.markNotificationRead(id).catch(() => {});
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
    if (!n.read) markRead(n.id);
    if (n.data?.screen && onOpenTarget) onOpenTarget(n.data);
  };

  return (
    <div className="k-page" style={{ padding: 28, maxWidth: 600, margin: "0 auto" }}>
      {unreadCount > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
          <span style={{ fontFamily: bodyFont, fontSize: 13, fontWeight: 700, color: C.muted }}>{unreadCount} okunmamış</span>
          <Button small variant="ghost" icon={CheckCheck} onClick={markAllRead}>Tümünü okundu yap</Button>
        </div>
      )}
      {loading ? (
        <LoadingState />
      ) : loadError ? (
        <EmptyState text={loadError} />
      ) : notifications.length === 0 ? (
        <EmptyState icon={Bell} text="Henüz bildirim yok. Yeni bir ödev geldiğinde burada görünecek." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {notifications.map((n) => {
            const { icon: Icon, tone } = NOTIFICATION_STYLE[n.type] || NOTIFICATION_STYLE.info;
            const tappable = !n.read || !!n.data?.screen;
            return (
              <Card key={n.id} hover={tappable} style={{ padding: 0 }}>
                <button
                  type="button"
                  onClick={() => openNotification(n)}
                  disabled={!tappable}
                  style={{ display: "flex", alignItems: "flex-start", gap: 12, width: "100%", padding: "13px 14px", background: "none", border: "none", textAlign: "left", cursor: tappable ? "pointer" : "default", fontFamily: bodyFont }}
                >
                  <span style={{ width: 34, height: 34, borderRadius: 10, background: tone.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={16} color={tone.fg} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13.5, lineHeight: 1.45, color: C.text, fontWeight: n.read ? 500 : 700 }}>{n.text}</span>
                    <span style={{ display: "block", fontSize: 11.5, color: C.muted, marginTop: 4 }}>{timeAgo(n.createdAt)}</span>
                  </span>
                  {!n.read && <span aria-label="Okunmadı" style={{ width: 8, height: 8, borderRadius: 999, background: C.accent, flexShrink: 0, marginTop: 6 }} />}
                  {n.read && n.data?.screen && <ChevronRight size={16} color={C.mutedLight} style={{ flexShrink: 0, marginTop: 9 }} />}
                </button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Bildirim türüne göre simge + renk — sunucudaki notifyUser çağrılarının type değerleri
// (bkz. server/src/scheduler.js, routes/assignments.js).
const NOTIFICATION_STYLE = {
  get assignment() { return { icon: ClipboardList, tone: { bg: C.accentSoft, fg: C.accent } }; },
  get assignment_overdue() { return { icon: AlertTriangle, tone: { bg: C.redSoft, fg: C.red } }; },
  get assignment_overdue_summary() { return { icon: Users, tone: { bg: C.amberSoft, fg: C.amber } }; },
  get info() { return { icon: Bell, tone: { bg: C.surface2, fg: C.muted } }; },
};
