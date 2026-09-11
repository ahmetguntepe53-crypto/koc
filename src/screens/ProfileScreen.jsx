import { useState } from "react";
import { BarChart3, Sun, Moon } from "lucide-react";
import { C, displayFont, bodyFont } from "../theme.js";
import { Card, Button, Input, Pill, Avatar, roleLabel } from "../components/common.jsx";
import { api, setToken } from "../api.js";
import { trackForGrade } from "../subjects.js";

const THEME_OPTIONS = [
  { value: "light", label: "Açık", icon: Sun },
  { value: "dark", label: "Koyu", icon: Moon },
];

export default function ProfileScreen({ user, onLogout, onOpenReport, theme, onChangeTheme }) {
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
      {user.role === "STUDENT" && onOpenReport && (
        <Card hover style={{ marginBottom: 18, cursor: "pointer" }}>
          <div onClick={onOpenReport} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 999, background: C.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <BarChart3 size={18} color={C.accent} />
            </div>
            <div>
              <div style={{ fontFamily: displayFont, fontSize: 15, fontWeight: 800, color: C.text }}>Raporum</div>
              <div style={{ fontFamily: bodyFont, fontSize: 12, color: C.muted, marginTop: 1 }}>Ders ve dönem bazlı doğru/yanlış/net dökümün</div>
            </div>
          </div>
        </Card>
      )}
      {onChangeTheme && (
        <Card style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: displayFont, fontSize: 15, fontWeight: 800, marginBottom: 3, color: C.text }}>Görünüm</div>
          <div style={{ fontFamily: bodyFont, fontSize: 12, color: C.muted, marginBottom: 14 }}>Uygulamanın açık/koyu temasını seç.</div>
          <div style={{ display: "flex", gap: 8 }}>
            {THEME_OPTIONS.map((opt) => {
              const active = theme === opt.value;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChangeTheme(opt.value)}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    padding: "12px 14px", borderRadius: C.radiusSm, cursor: "pointer",
                    border: `1.5px solid ${active ? C.accent : C.border}`,
                    background: active ? C.accentSoft : C.surface2,
                    color: active ? C.accent : C.muted, fontFamily: bodyFont, fontWeight: 700, fontSize: 13.5,
                  }}
                >
                  <Icon size={16} /> {opt.label}
                </button>
              );
            })}
          </div>
        </Card>
      )}
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
