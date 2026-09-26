import { useState } from "react";
import { Check } from "lucide-react";
import { C, displayFont, bodyFont, monoFont } from "../theme.js";
import { Button, Input } from "../components/common.jsx";
import { api, setToken } from "../api.js";

// İlk giriş (şartname Z7) — tek ekranda iki zorunlu adım: kendi şifreni belirle + KVKK onayı. İlk şifresi
// tahmin edilebilir hesaplar (öğrencide okul numarası, öğretmende kullanıcı adı, adminin verdiği geçici
// şifre) bu adımı geçmeden uygulamayı kullanamaz; sunucu da aynı kuralı uygular (middleware/auth.js).
// Kurallar hata mesajıyla sonradan öğretilmez — baştan görünür, yazdıkça işaretlenir. Kullanıcı az önce
// mevcut şifresiyle giriş yaptığı için tekrar sorulmaz (sunucu: set-password, mustChangePassword).
// E-posta kurulum bağlantısından geçmemiş hesaplar Gizlilik/KVKK/Kullanım Şartları'nı da burada kabul eder.
const TERMS_URL = "https://kocluk.maiakademi.com/terms.html";

function Rule({ ok, children }) {
  return (
    <li style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: bodyFont, fontSize: 14, color: ok ? C.text2 : C.mutedLight, lineHeight: 1.4 }}>
      <span aria-hidden="true" style={{ width: 16, display: "inline-flex", justifyContent: "center", flexShrink: 0 }}>
        {ok ? <Check size={15} strokeWidth={2.6} color={C.green} /> : <span style={{ width: 6, height: 6, borderRadius: 999, background: C.faintest }} />}
      </span>
      <span>{children}<span className="k-sr-only">{ok ? " — tamam" : " — henüz değil"}</span></span>
    </li>
  );
}

export default function ForcePasswordScreen({ user, onDone, onLogout }) {
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const needsTerms = !user.termsAcceptedAt;
  const isStudent = user.role === "STUDENT";
  const username = user.username || "";

  const rules = {
    length: next.length >= 8,
    letterDigit: /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(next) && /[0-9]/.test(next),
    notUsername: next.length > 0 && next.trim().toLowerCase() !== username.toLowerCase(),
  };
  const rulesOk = rules.length && rules.letterDigit && rules.notUsername;
  const matches = repeat.length > 0 && repeat === next;
  const ready = rulesOk && matches && (!needsTerms || accepted);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!rulesOk) { setError("Şifren yukarıdaki kuralların hepsini sağlamalı"); return; }
    if (!matches) { setError("İki şifre aynı değil"); return; }
    if (needsTerms && !accepted) { setError("Devam etmek için aydınlatma metnini onaylamalısın"); return; }
    setSaving(true);
    try {
      const res = await api.setPassword(undefined, next, needsTerms ? true : undefined);
      // Sunucu tokenVersion'ı artırıp yeni token döner — eskisiyle devam edilirse oturum geçersiz sayılır.
      if (res.token) setToken(res.token);
      onDone(res.user || { ...user, mustChangePassword: false });
    } catch (err) {
      setError(err.message || "Şifre kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  const idLabel = isStudent ? "okul numaran" : "kullanıcı adın";

  return (
    <div className="k-login-root" style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column" }}>
      <form onSubmit={submit} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, width: "100%", maxWidth: 440, margin: "0 auto", padding: "32px 22px 24px", boxSizing: "border-box" }}>
          <div style={{ fontFamily: bodyFont, fontSize: 10.5, fontWeight: 700, letterSpacing: 1.4, color: C.mutedLight }}>İLK GİRİŞ · 1. ADIM</div>
          <h1 style={{ margin: "10px 0 0", fontFamily: displayFont, fontSize: 27, fontWeight: 700, letterSpacing: -1, color: C.text }}>Kendi şifreni belirle</h1>
          <p style={{ margin: "10px 0 24px", fontFamily: bodyFont, fontSize: 15, color: C.muted, lineHeight: 1.55 }}>
            Merhaba {user.name?.split(" ")[0]}! {username
              ? <>Kullanıcı adın <span style={{ fontFamily: monoFont, color: C.text }}>{username}</span> — ilk şifren de genelde {idLabel}. Başkaları tarafından bilinebileceği için devam etmeden değiştirmen gerekiyor.</>
              : "Hesabının güvenliği için devam etmeden kendi şifreni belirlemen gerekiyor."}
          </p>

          <Input label="Yeni şifre" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required />
          <Input label="Yeni şifre tekrar" type="password" value={repeat} onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password" required error={repeat && !matches && repeat.length >= next.length ? "İki şifre aynı değil" : undefined} />

          <ul aria-label="Şifre kuralları" style={{ listStyle: "none", margin: "-4px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <Rule ok={rules.length}>En az 8 karakter</Rule>
            <Rule ok={rules.letterDigit}>Bir harf ve bir rakam</Rule>
            <Rule ok={rules.notUsername}>{isStudent ? "Okul numaranla aynı olamaz" : "Kullanıcı adınla aynı olamaz"}</Rule>
          </ul>

          {needsTerms && (
            <>
              <div style={{ fontFamily: bodyFont, fontSize: 10.5, fontWeight: 700, letterSpacing: 1.4, color: C.mutedLight, marginTop: 30 }}>2. ADIM · KVKK AYDINLATMA METNİ</div>
              <div style={{ position: "relative", marginTop: 12, borderRadius: 16, border: `1px solid ${C.border}`, background: C.surface }}>
                <div tabIndex={0} aria-label="Aydınlatma metni özeti" style={{ height: 116, overflowY: "auto", padding: "14px 18px 22px", fontFamily: bodyFont, fontSize: 14, color: C.text2, lineHeight: 1.65 }}>
                  Bu uygulamada adın, okul numaran, sınıfın, çözdüğün ödevlerin sonuçları, pas geçme sebeplerin, serbest çalışma kayıtların, yüklediğin kanıt fotoğrafları ve uygulamayı en son ne zaman kullandığın işlenir.
                  Uygulama içinde verilerine yalnızca sana atanmış koç öğretmen, ödevi veren branş öğretmeni ve okul yönetimi erişebilir.
                  Verilerin ne kadar süre saklandığı, veri sorumlusu ve başvuru hakların metnin tamamında yazılıdır.
                </div>
                <div aria-hidden="true" style={{ position: "absolute", left: 1, right: 1, bottom: 1, height: 30, borderRadius: "0 0 15px 15px", background: `linear-gradient(to bottom, transparent, ${C.surface})`, pointerEvents: "none" }} />
              </div>
              <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 12, fontFamily: bodyFont, fontSize: 14, fontWeight: 600, color: C.text, textDecoration: "underline", textUnderlineOffset: 3 }}>
                Metnin tamamını oku
              </a>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 14, marginTop: 16, padding: "16px 18px", borderRadius: 16, border: `1px solid ${accepted ? C.borderStrong : C.border}`, background: C.surface, cursor: "pointer" }}>
                <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} style={{ marginTop: 3, width: 20, height: 20, accentColor: C.text, flexShrink: 0 }} />
                <span style={{ fontFamily: bodyFont, fontSize: 14.5, color: C.text2, lineHeight: 1.5 }}>
                  Aydınlatma metnini, Gizlilik Politikası'nı ve Kullanım Şartları'nı okudum; verilerimin bu kapsamda işlenmesini onaylıyorum.
                </span>
              </label>
            </>
          )}

          {error && <div role="alert" style={{ color: C.red, fontFamily: bodyFont, fontSize: 13.5, fontWeight: 600, marginTop: 16 }}>{error}</div>}

          <div style={{ textAlign: "center", marginTop: 22 }}>
            <button type="button" onClick={onLogout} className="k-link-btn" style={{ background: "none", border: "none", cursor: "pointer", fontFamily: bodyFont, fontSize: 13.5, fontWeight: 600, color: C.mutedLight, padding: 10 }}>
              Çıkış yap
            </button>
          </div>
        </div>

        <div style={{ position: "sticky", bottom: 0, background: C.surface, borderTop: `1px solid ${C.divider}`, padding: "13px 22px calc(19px + env(safe-area-inset-bottom, 0px))" }}>
          <div style={{ maxWidth: 440, margin: "0 auto" }}>
            <Button full type="submit" disabled={saving || !ready}>{saving ? "Kaydediliyor..." : "Kaydet ve başla"}</Button>
            <div style={{ textAlign: "center", fontFamily: bodyFont, fontSize: 11.5, color: C.mutedLight, marginTop: 9 }}>
              {needsTerms ? "İkisi de tamamlanmadan uygulamaya girilemez" : "Şifreni belirlemeden uygulamaya girilemez"}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
