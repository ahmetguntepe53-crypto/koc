import { useState } from "react";
import { Target, KeyRound, LogOut, Check, Sun, Moon, Palette, Plus } from "lucide-react";
import { C, displayFont, bodyFont, ACCENTS, TEXT_COLORS } from "../theme.js";
import { Avatar, roleLabel } from "../components/common.jsx";
import { HeroHeader, HeroBell, SectionCard, StatusChip, FieldLabel, fieldBox, PrimaryButton } from "../components/brand.jsx";
import { api, setToken } from "../api.js";
import { gradeLabel } from "../subjects.js";
import { STUDENT_FIELDS, FIELD_SHORT, FIELD_LABELS } from "../studentField.js";

// Öğrenci kendi YKS alanını seçer (koçu ve rapor buradan okur). Seçili seçeneğe yeniden dokunmak alanı siler.
function FieldCard({ user, onUserUpdated }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const value = user.field || null;
  const pick = async (f) => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await api.setMyField(f === value ? null : f);
      onUserUpdated?.(res.user);
    } catch (e) {
      setError(e.message || "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };
  return (
    <SectionCard
      icon={Target} iconBg={C.warningTint} iconFg={C.warningText} title="YKS alanım"
      right={value ? <StatusChip tone="success">{FIELD_SHORT[value]}</StatusChip> : <StatusChip tone="track">Seçilmedi</StatusChip>}
    >
      <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.inkMuted, margin: "8px 0 12px", lineHeight: 1.5 }}>
        {saving ? "Kaydediliyor..." : value ? `${FIELD_LABELS[value]} seçili. Raporun bu alanın AYT derslerini izler.` : "Hangi alandan hazırlandığını seç — raporun AYT derslerini buna göre izler, koçun da görür."}
      </div>
      <div role="group" aria-label="YKS alanı" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
        {STUDENT_FIELDS.map((f) => {
          const on = value === f;
          return (
            <button
              key={f}
              type="button"
              aria-pressed={on}
              onClick={() => pick(f)}
              style={{
                minHeight: 48, borderRadius: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                background: on ? C.cta : C.pageTint, border: `1px solid ${on ? C.cta : C.brandOutline}`, color: on ? C.onCta : C.inkText,
                fontFamily: bodyFont, fontSize: 14, fontWeight: 700,
              }}
            >
              {on && <Check size={15} strokeWidth={2.6} aria-hidden="true" />}{FIELD_SHORT[f]} · {FIELD_LABELS[f]}
            </button>
          );
        })}
      </div>
      {error && <div role="alert" style={{ color: C.danger, fontFamily: bodyFont, fontSize: 13, fontWeight: 600, marginTop: 8 }}>{error}</div>}
    </SectionCard>
  );
}

const THEME_OPTIONS = [
  { value: "light", label: "Açık", icon: Sun },
  { value: "dark", label: "Koyu", icon: Moon },
];

// Görünüm: açık (mor) ya da koyu (siyah-beyaz-gri) tema — bu cihazda saklanır.
// Hazır renkler + en sonda serbest renk paleti (dokununca sistemin renk seçicisi açılır; seçilen "#rrggbb" saklanır).
function Swatches({ title, label, list, value, onChange }) {
  const custom = /^#[0-9a-f]{6}$/i.test(value || "");
  const dot = (on, bg, children, extra = {}) => ({
    width: 40, height: 40, borderRadius: 999, cursor: "pointer", background: bg, color: "#0B0B0C", position: "relative",
    border: `3px solid ${on ? C.inkText : "transparent"}`, outline: on ? `2px solid ${C.bg}` : "none", outlineOffset: -5,
    display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box", ...extra,
  });
  return (
    <>
      <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.inkMuted, margin: "14px 0 10px" }}>{title}</div>
      <div role="group" aria-label={label} style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {list.map((a) => {
          const on = value === a.id;
          return (
            <button key={a.id} type="button" aria-pressed={on} aria-label={a.label} title={a.label} onClick={() => onChange(a.id)} style={dot(on, a.color)}>
              {on && <Check size={18} strokeWidth={3} aria-hidden="true" />}
            </button>
          );
        })}
        <label title="Paletten seç" style={dot(custom, custom ? value : "conic-gradient(#f87171, #fbbf24, #4ade80, #60a5fa, #a78bfa, #f472b6, #f87171)")}>
          {custom ? <Check size={18} strokeWidth={3} aria-hidden="true" /> : <Plus size={18} strokeWidth={3} aria-hidden="true" color="#0B0B0C" />}
          <input
            type="color"
            aria-label={`${label}: paletten seç`}
            value={custom ? value : list[0].color}
            onChange={(e) => onChange(e.target.value)}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", border: "none", padding: 0 }}
          />
        </label>
      </div>
    </>
  );
}

function ThemeCard({ theme, onChange, accent, onChangeAccent, textColor, onChangeTextColor }) {
  return (
    <SectionCard icon={Palette} iconBg={C.brandTint} iconFg={C.brandText} title="Görünüm">
      <div role="group" aria-label="Tema" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginTop: 12 }}>
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
          const on = theme === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(value)}
              style={{
                minHeight: 48, borderRadius: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                background: on ? C.cta : C.pageTint, border: `1px solid ${on ? C.cta : C.brandOutline}`, color: on ? C.onCta : C.inkText,
                fontFamily: bodyFont, fontSize: 14, fontWeight: 700,
              }}
            >
              <Icon size={16} aria-hidden="true" />{label}
            </button>
          );
        })}
      </div>
      {theme === "dark" && onChangeAccent && (
        <Swatches title="Vurgu rengi — rakamlar ve düğmeler" label="Vurgu rengi" list={ACCENTS} value={accent} onChange={onChangeAccent} />
      )}
      {theme === "dark" && onChangeTextColor && (
        <Swatches title="Yazı rengi — başlıklar ve ana metin" label="Yazı rengi" list={TEXT_COLORS} value={textColor} onChange={onChangeTextColor} />
      )}
    </SectionCard>
  );
}

export default function ProfileScreen({ user, onLogout, onUserUpdated, unreadCount, onOpenNotifications, theme, onChangeTheme, accent, onChangeAccent, textColor, onChangeTextColor }) {
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

  const chips = [roleLabel(user.role), user.className, user.gradeLevel && gradeLabel(user.gradeLevel)].filter(Boolean);

  return (
    <div>
      <HeroHeader compact>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar name={user.name} size={60} lime />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontFamily: displayFont, fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.15, color: C.onBrand, overflowWrap: "anywhere" }}>{user.name}</h1>
            <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.onBrandMuted, marginTop: 2, overflowWrap: "anywhere" }}>{user.username ? `Kullanıcı adı: ${user.username}` : user.email}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {chips.map((c) => <StatusChip key={c} tone="onBrand">{c}</StatusChip>)}
            </div>
          </div>
          <HeroBell unreadCount={unreadCount} onClick={onOpenNotifications} />
        </div>
      </HeroHeader>

      <div style={{ maxWidth: 580, margin: "0 auto", padding: "16px 16px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
        {user.role === "STUDENT" && <FieldCard user={user} onUserUpdated={onUserUpdated} />}
        {onChangeTheme && <ThemeCard theme={theme} onChange={onChangeTheme} accent={accent} onChangeAccent={onChangeAccent} textColor={textColor} onChangeTextColor={onChangeTextColor} />}

        <SectionCard icon={KeyRound} iconBg={C.brandTint} iconFg={C.brandText} title="Şifremi değiştir">
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
            <div>
              <FieldLabel htmlFor="p-cur">Mevcut şifre</FieldLabel>
              <input id="p-cur" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" style={{ ...fieldBox(false), cursor: "text" }} />
            </div>
            <div>
              <FieldLabel htmlFor="p-new" required>Yeni şifre (en az 8 karakter)</FieldLabel>
              <input id="p-new" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required style={{ ...fieldBox(false), cursor: "text" }} />
            </div>
            {msg && <div role={msg.type === "ok" ? "status" : "alert"} style={{ color: msg.type === "ok" ? C.success : C.danger, fontFamily: bodyFont, fontSize: 13, fontWeight: 600 }}>{msg.text}</div>}
            <PrimaryButton type="submit" inactive={saving || !next}>{saving ? "Kaydediliyor..." : "Şifreyi güncelle"}</PrimaryButton>
          </form>
        </SectionCard>

        <button
          type="button"
          onClick={onLogout}
          style={{
            minHeight: 52, borderRadius: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            background: C.surface, border: `1px solid ${C.brandOutline}`, color: C.danger, fontFamily: bodyFont, fontSize: 15, fontWeight: 800,
          }}
        >
          <LogOut size={17} aria-hidden="true" />Çıkış yap
        </button>
      </div>
    </div>
  );
}
