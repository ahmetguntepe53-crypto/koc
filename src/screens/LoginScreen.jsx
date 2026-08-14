import { useState } from "react";
import { ClipboardCheck, BellRing, LineChart } from "lucide-react";
import { C, displayFont, bodyFont } from "../theme.js";
import { Card, Button, Input, LogoMark } from "../components/common.jsx";

const HIGHLIGHTS = [
  { icon: ClipboardCheck, text: "Koçlar öğrencilerine ders/konu/kaynak bazlı ödev planlar" },
  { icon: BellRing, text: "Ödevler zamanı gelince otomatik gönderilir, bildirim gider" },
  { icon: LineChart, text: "Doğru/yanlış/boş sonuçları ve geri dönütler tek yerde toplanır" },
];

export default function LoginScreen({ onLogin, onForgotPassword }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (forgotMode) {
        await onForgotPassword(email);
        setForgotSent(true);
      } else {
        await onLogin(email, password);
      }
    } catch (err) {
      setError(err.message || "Bir şeyler ters gitti");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex" }}>
      <div className="k-login-brand" style={{
        flex: 1, background: `radial-gradient(120% 100% at 0% 0%, ${C.sidebarBgAlt}, ${C.sidebarBg} 55%)`,
        color: "#fff", padding: "56px 60px", display: "flex", flexDirection: "column", justifyContent: "space-between",
      }}>
        <LogoMark width={128} radius={16} />

        <div>
          <div style={{ fontFamily: bodyFont, fontSize: 11, fontWeight: 800, color: C.sidebarAccent, letterSpacing: 1.2, marginBottom: 12 }}>
            KOCLUK — SINAV KOÇLUĞU SİSTEMİ
          </div>
          <div style={{ fontFamily: displayFont, fontSize: 34, fontWeight: 800, lineHeight: 1.2, maxWidth: 420 }}>
            Sınav hazırlık sürecini tek yerden yönet.
          </div>
          <div style={{ fontFamily: bodyFont, fontSize: 14.5, color: C.sidebarText, marginTop: 14, maxWidth: 400, lineHeight: 1.6 }}>
            Koçlar ödev planlar, öğrenciler sonuçlarını girer, okul yönetimi tüm süreci tek panelden takip eder.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 36 }}>
            {HIGHLIGHTS.map((h, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <h.icon size={16} color={C.sidebarAccent} />
                </div>
                <span style={{ fontFamily: bodyFont, fontSize: 13.5, color: "#E4E6F5" }}>{h.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontFamily: bodyFont, fontSize: 11.5, color: C.sidebarText }}>
          Hesaplar okul yöneticisi tarafından oluşturulur.
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: C.bg }}>
        <div style={{ width: "100%", maxWidth: 380 }}>
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontFamily: displayFont, fontSize: 22, fontWeight: 800, color: C.text }}>
              {forgotSent ? "" : forgotMode ? "Şifreni sıfırla" : "Tekrar hoş geldin"}
            </div>
            {!forgotSent && (
              <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.muted, marginTop: 4 }}>
                {forgotMode ? "E-posta adresini gir, sana bir bağlantı gönderelim." : "Devam etmek için hesabına giriş yap."}
              </div>
            )}
          </div>
          <Card>
            {forgotSent ? (
              <div style={{ textAlign: "center", padding: "8px 0" }}>
                <div style={{ fontFamily: displayFont, fontSize: 15, fontWeight: 800, marginBottom: 8, color: C.text }}>E-postana bir bağlantı gönderdik</div>
                <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.muted, marginBottom: 20 }}>
                  {email} adresine şifre sıfırlama bağlantısı gönderildi (kayıtlıysa).
                </div>
                <Button full variant="secondary" onClick={() => { setForgotMode(false); setForgotSent(false); }}>Girişe dön</Button>
              </div>
            ) : (
              <form onSubmit={submit}>
                <Input label="E-posta" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
                {!forgotMode && (
                  <Input label="Şifre" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
                )}
                {error && <div style={{ color: C.red, fontSize: 12.5, fontWeight: 600, marginBottom: 14 }}>{error}</div>}
                <Button full type="submit" disabled={loading}>
                  {loading ? "..." : forgotMode ? "Sıfırlama Bağlantısı Gönder" : "Giriş Yap"}
                </Button>
                <div style={{ textAlign: "center", marginTop: 16 }}>
                  <button
                    type="button"
                    className="k-link-btn"
                    onClick={() => setForgotMode((m) => !m)}
                    style={{ background: "none", border: "none", color: C.muted, fontSize: 12.5, fontWeight: 600, fontFamily: bodyFont, cursor: "pointer" }}
                  >
                    {forgotMode ? "Girişe dön" : "Şifremi unuttum"}
                  </button>
                </div>
              </form>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
