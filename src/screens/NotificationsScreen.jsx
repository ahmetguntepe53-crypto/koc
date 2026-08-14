import { useEffect, useState } from "react";
import { C, bodyFont } from "../theme.js";
import { Card, Button, Pill, EmptyState } from "../components/common.jsx";
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

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.listNotifications().then(({ notifications }) => setNotifications(notifications)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const markRead = async (id) => {
    setNotifications((ns) => ns.map((n) => (n.id === id ? { ...n, read: true } : n)));
    api.markNotificationRead(id).catch(() => {});
  };

  const markAllRead = async () => {
    setNotifications((ns) => ns.map((n) => ({ ...n, read: true })));
    api.markAllNotificationsRead().catch(() => {});
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div style={{ padding: 28, maxWidth: 600, margin: "0 auto" }}>
      {unreadCount > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
          <Button small variant="secondary" onClick={markAllRead}>Tümünü okundu işaretle</Button>
        </div>
      )}
      {loading ? (
        <EmptyState text="Yükleniyor..." />
      ) : notifications.length === 0 ? (
        <EmptyState text="Henüz bildirim yok." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {notifications.map((n) => (
            <Card
              key={n.id}
              hover={!n.read}
              style={{ padding: 14, cursor: n.read ? "default" : "pointer", borderColor: n.read ? C.border : C.accent, borderLeftWidth: n.read ? 1 : 3, borderLeftColor: n.read ? C.border : C.accent }}
            >
              <div onClick={() => !n.read && markRead(n.id)} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontFamily: bodyFont, fontSize: 13.5, color: C.text, fontWeight: n.read ? 400 : 700 }}>{n.text}</div>
                {!n.read && <Pill tone="accent">Yeni</Pill>}
              </div>
              <div style={{ fontFamily: bodyFont, fontSize: 11.5, color: C.muted, marginTop: 6 }}>{timeAgo(n.createdAt)}</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
