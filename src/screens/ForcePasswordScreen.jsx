import { useState } from "react";
import { KeyRound } from "lucide-react";
import { C, displayFont, bodyFont } from "../theme.js";
import { Card, Button, Input, LogoMark } from "../components/common.jsx";
import { api, setToken } from "../api.js";

// İlk girişte kendi şifreni belirle — ilk şifresi tahmin edilebilir olan hesaplar (öğrencide okul
// numarası, öğretmende dağıtılan geçici şifre, adminin sözlü ilettiği şifre) uygulamayı bu adımı
// geçmeden kullanamaz; sunucu da aynı kuralı uygular (bkz. server/src/middleware/auth.js).
// E-posta kurulum bağlantısından geçmemiş hesaplar Gizlilik/KVKK/Kullanım Şartları'nı da burada kabul eder.
export default function ForcePasswordScreen({ user, onDone, onLogout }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const needsTerms = !user.termsAcceptedAt;
  const isStudent = user.role === "STUDENT";

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (next.length < 8) { setError("Yeni şifre en az 8 karakter olmalı"); return; }
    if (next !== repeat) { setError("Yeni şifreler aynı değil"); return; }
    if (needsTerms && !accepted) { setError("Devam etmek için metni kabul etmelisin"); return; }
    setSaving(true);
    try {
      const res = await api.setPassword(current, next, needsTerms ? true : undefined);
      // Sunucu tokenVersion'ı artırıp yeni token döner — eskisiyle devam edilirse oturum geçersiz sayılır.
      if (res.token) setToken(res.token);
      onDone(res.user || { ...user, mustChangePassword: false });
    } catch (err) {
      setError(err.message || "Şifre kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="k-login-root" style={{ minHeight: "100vh", background: C.bg, display: "flex", justifyContent: "center", padding: "32px 16px" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <LogoMark width={72} />
        </div>
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ margin: 0, fontFamily: displayFont, fontSize: 22, fontWeight: 700, letterSpacing: -0.5, color: C.text }}>Kendi şifreni belirle</h1>
          <p style={{ margin: "6px 0 0", fontFamily: bodyFont, fontSize: 13.5, color: C.muted, lineHeight: 1.5 }}>
            Merhaba {user.name?.split(" ")[0]}! Hesabının güvenliği için ilk girişte sana özel bir şifre belirlemelisin.
            {isStudent ? " Okul numaran başkaları tarafından bilinebilir." : ""}
          </p>
        </div>
        <Card>
          <form onSubmit={submit}>
            <Input
              label="Şu anki şifren"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              placeholder={isStudent ? "İlk şifren okul numaran" : ""}
              required
            />
            <Input label="Yeni şifre (en az 8 karakter)" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required />
            <Input label="Yeni şifre (tekrar)" type="password" value={repeat} onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password" required />
            {needsTerms && (
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 16, fontFamily: bodyFont, fontSize: 13, color: C.text2, lineHeight: 1.45, cursor: "pointer" }}>
                <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} style={{ marginTop: 3, accentColor: C.accent, width: 16, height: 16, flexShrink: 0 }} />
                <span>
                  <a href="https://kocluk.maiakademi.com/terms.html" target="_blank" rel="noopener noreferrer" style={{ color: C.accent, fontWeight: 600 }}>
                    Gizlilik Politikası, KVKK Aydınlatma Metni ve Kullanım Şartları
                  </a>'nı okudum, kabul ediyorum.
                </span>
              </label>
            )}
            {error && <div role="alert" style={{ color: C.red, fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{error}</div>}
            <Button full type="submit" icon={KeyRound} disabled={saving}>{saving ? "Kaydediliyor..." : "Şifremi kaydet"}</Button>
          </form>
        </Card>
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button type="button" onClick={onLogout} className="k-link-btn" style={{ background: "none", border: "none", cursor: "pointer", fontFamily: bodyFont, fontSize: 13.5, fontWeight: 600, color: C.muted }}>
            Çıkış yap
          </button>
        </div>
      </div>
    </div>
  );
}
