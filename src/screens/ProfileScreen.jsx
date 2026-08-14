import { useState } from "react";
import { C, displayFont, bodyFont } from "../theme.js";
import { Card, Button, Input, Pill, Avatar, roleLabel } from "../components/common.jsx";
import { api, setToken } from "../api.js";
import { trackForGrade } from "../subjects.js";

export default function ProfileScreen({ user, onLogout }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    setSaving(true);
    try {
      const res = await api.setPassword(current, next);
      // Sunucu tokenVersion'ı artırır ve yeni bir token döner — eski token'ı kullanmaya devam edersek
      // bir sonraki istekte "oturum geçersiz kılınmış" hatası alırız (bkz. server requireAuth).
      if (res.token) setToken(res.token);
      setMsg({ type: "ok", text: "Şifren güncellendi." });
      setCurrent("");
      setNext("");
    } catch (err) {
      setMsg({ type: "error", text: err.message || "Şifre güncellenemedi" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 28, maxWidth: 500, margin: "0 auto" }}>
      <Card style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar name={user.name} size={52} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: displayFont, fontSize: 16.5, fontWeight: 800, color: C.text }}>{user.name}</div>
            <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.muted, marginTop: 1 }}>{user.email}</div>
            <div style={{ marginTop: 7, display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Pill tone="accent">{roleLabel(user.role)}</Pill>
              {user.className && <Pill>{user.className}</Pill>}
              {user.gradeLevel && <Pill tone="amber">{user.gradeLevel}. Sınıf ({trackForGrade(user.gradeLevel)})</Pill>}
            </div>
          </div>
        </div>
      </Card>
      <Card style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: displayFont, fontSize: 15, fontWeight: 800, marginBottom: 14, color: C.text }}>Şifremi Değiştir</div>
        <form onSubmit={submit}>
          <Input label="Mevcut şifre" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          <Input label="Yeni şifre (en az 8 karakter)" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required />
          {msg && <div style={{ color: msg.type === "ok" ? C.green : C.red, fontSize: 12.5, fontWeight: 600, marginBottom: 14 }}>{msg.text}</div>}
          <Button type="submit" disabled={saving}>{saving ? "..." : "Şifreyi Güncelle"}</Button>
        </form>
      </Card>
      <Button variant="secondary" full onClick={onLogout}>Çıkış Yap</Button>
    </div>
  );
}
