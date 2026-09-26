import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { C } from "../../theme.js";
import { Modal, Button, Input, Chip } from "../../components/common.jsx";
import { api } from "../../api.js";
import { fmtNet, fmtInt } from "../../reportModel.js";
import { DENEME_LAYOUT, DENEME_EXAMS, denemeLabel, denemeNet, aytSubjectsForField } from "../../practiceExams.js";
import { mono, text } from "./parts.jsx";

// "Deneme ekle / düzenle" penceresi — öğrencinin Gelişim raporundan (kendisi için) ve koçun öğrenci raporundan (studentId
// ile) açılır. Her ders için Doğru / Yanlış / Boş küçük adımlayıcılarla girilir; D + Y + B dersin resmî soru sayısını
// aşamaz (+ düğmesi sınırda kapanır, elle yazılan fazlası kırmızı uyarı verir ve kaydı engeller — sunucu da reddeder).
// Ders ve toplam net canlı hesaplanır. Girilmeyen (0/0/0) ders kaydedilmez. AYT'de öğrencinin alanının dersleri ön seçili
// gelir (alan yoksa hepsi); çiplerle ders eklenip çıkarılır. Sınav türü değişince iki türün girişleri ayrı saklanır.

const num = (v) => (v === "" || v == null ? 0 : Number(v) || 0);
// Türkiye takvim günü (sunucunun "ileri tarih" kuralıyla aynı gün) — YYYY-MM-DD.
const trToday = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
const isoDay = (d) => new Date(d).toISOString().slice(0, 10);

function initialValues(exam) {
  const v = { TYT: {}, AYT: {} };
  for (const r of exam?.subjects || exam?.results || []) {
    v[exam.examType][r.subject] = { D: String(r.D ?? r.correct ?? 0), Y: String(r.Y ?? r.wrong ?? 0), B: String(r.B ?? r.blank ?? 0) };
  }
  return v;
}
function initialAyt(exam, field) {
  const base = aytSubjectsForField(field);
  if (exam?.examType !== "AYT") return base;
  const had = new Set((exam.subjects || exam.results || []).map((r) => r.subject));
  return DENEME_LAYOUT.AYT.map((x) => x.subject).filter((s) => had.has(s) || base.includes(s));
}

export default function DenemeForm({ exam, studentId, field, defaultType = "TYT", onClose, onSaved }) {
  const editing = !!exam;
  const [examType, setExamType] = useState(exam?.examType || defaultType);
  const [date, setDate] = useState(exam ? isoDay(exam.date) : trToday());
  const [name, setName] = useState(exam?.name || "");
  const [values, setValues] = useState(() => initialValues(exam));
  const [aytSel, setAytSel] = useState(() => initialAyt(exam, field));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const rows = useMemo(() => DENEME_LAYOUT[examType]
    .filter((x) => examType === "TYT" || aytSel.includes(x.subject))
    .map((x) => {
      const v = values[examType][x.subject] || { D: "", Y: "", B: "" };
      const D = num(v.D), Y = num(v.Y), B = num(v.B);
      const Q = D + Y + B;
      return { ...x, label: denemeLabel(examType, x.subject), v, D, Y, B, Q, net: denemeNet(D, Y), over: Q > x.max };
    }), [examType, aytSel, values]);
  const filled = rows.filter((r) => r.Q > 0);
  const overRows = rows.filter((r) => r.over);
  const totalNet = filled.reduce((s, r) => s + r.net, 0);
  const totalQ = filled.reduce((s, r) => s + r.Q, 0);
  const totalMax = rows.reduce((s, r) => s + r.max, 0);
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= trToday();
  const canSave = !busy && filled.length > 0 && !overRows.length && dateOk;

  const setVal = (subject, part, val) => setValues((prev) => ({
    ...prev, [examType]: { ...prev[examType], [subject]: { ...(prev[examType][subject] || { D: "", Y: "", B: "" }), [part]: val } },
  }));
  const toggleAyt = (s) => setAytSel((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : DENEME_LAYOUT.AYT.map((x) => x.subject).filter((x) => x === s || prev.includes(x))));

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    setError("");
    const payload = {
      ...(studentId ? { studentId } : {}),
      examType, date, name: name.trim() || null,
      results: filled.map((r) => ({ subject: r.subject, correct: r.D, wrong: r.Y, blank: r.B })),
    };
    try {
      const res = editing ? await api.updatePracticeExam(exam.id, payload) : await api.createPracticeExam(payload);
      onSaved?.(res.exam);
    } catch (e) {
      setError(e.message || "Deneme kaydedilemedi — lütfen tekrar dene.");
      setBusy(false);
    }
  };

  // Kitapçıktaki bölümler (Türkçe · Sosyal Bilimler · Temel Matematik · Fen Bilimleri …) başlıklarıyla.
  const groups = [];
  for (const r of rows) {
    const g = groups[groups.length - 1];
    if (g && g.name === r.group) g.rows.push(r);
    else groups.push({ name: r.group, rows: [r] });
  }

  return (
    <Modal title={editing ? "Denemeyi düzenle" : "Deneme ekle"} onClose={onClose}>
      <div role="group" aria-label="Sınav türü" style={{ display: "flex", gap: 6, background: C.surface2, borderRadius: 12, padding: 4, marginBottom: 16 }}>
        {DENEME_EXAMS.map((e) => (
          <button key={e} type="button" aria-pressed={examType === e} onClick={() => setExamType(e)}
            style={{ flex: 1, minHeight: 44, borderRadius: 9, border: "none", cursor: "pointer", background: examType === e ? C.accent : "transparent", ...text(14, 700, examType === e ? C.onAccent : C.text2) }}>
            {e}
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.4fr)", gap: 10 }}>
        <Input label="Tarih" type="date" value={date} max={trToday()} onChange={(e) => setDate(e.target.value)} error={!date ? "Tarih gir" : !dateOk ? "İleri bir tarih olamaz" : null} />
        <Input label="Yayın / deneme adı" placeholder="ör. X Yayınları TYT-4" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      {examType === "AYT" && (
        <div style={{ marginBottom: 6 }}>
          {/* Form hem öğrenciye hem koça açılır — hitapsız, ikisine de uyan dil. */}
          <div style={{ ...text(13.5, 600, C.muted), marginBottom: 8 }}>Denemede girilen dersler{field ? "" : " (alan bilgisi yok — girilmeyenleri boş bırak)"}</div>
          <div role="group" aria-label="AYT dersleri" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {DENEME_LAYOUT.AYT.map((x) => (
              <Chip key={x.subject} active={aytSel.includes(x.subject)} onClick={() => toggleAyt(x.subject)}>{denemeLabel("AYT", x.subject)}</Chip>
            ))}
          </div>
        </div>
      )}

      {groups.map((g) => (
        <div key={g.name} style={{ marginTop: 14 }}>
          <div style={{ ...text(10.5, 700, C.mutedLight), letterSpacing: 1.2 }}>
            {g.name.toLocaleUpperCase("tr-TR")} · <span style={mono(10.5, 700, C.mutedLight)}>{g.rows.reduce((s, r) => s + r.max, 0)}</span> SORU
          </div>
          {g.rows.map((r) => <SubjectRow key={r.subject} r={r} onChange={(part, val) => setVal(r.subject, part, val)} />)}
        </div>
      ))}
      {examType === "AYT" && !rows.length && <div style={{ ...text(13, 500, C.mutedLight), padding: "14px 0" }}>Yukarıdan denemede girilen AYT derslerini seç.</div>}

      {/* Yapışkan alt şerit. Gölge, şeridin ALTINDAKİ boşluğu (pencerenin alt dolgusu + telefonda home çubuğu payı)
          yüzey rengiyle örter — yoksa kaydırılan ders satırları Kaydet düğmesinin altından görünürdü. */}
      <div style={{ position: "sticky", bottom: 0, background: C.surface, borderTop: `1px solid ${C.divider}`, padding: "12px 0 2px", marginTop: 12, boxShadow: `0 64px 0 ${C.surface}` }}>
        <div aria-live="polite" style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
          <span style={text(13, 600, C.text2)}>Toplam</span>
          <span style={mono(20, 700, totalNet < 0 ? C.red : C.text)}>{filled.length ? `${fmtNet(totalNet)} net` : "—"}</span>
          <span style={{ marginLeft: "auto", ...mono(12, 600, C.mutedLight) }}>{fmtInt(totalQ)}/{fmtInt(totalMax)} soru</span>
        </div>
        {overRows.length > 0 && <div role="alert" style={{ ...text(12.5, 600, C.red), marginBottom: 8 }}>Soru sayısını aşan ders var: {overRows.map((r) => r.label).join(", ")}.</div>}
        {error && <div role="alert" style={{ ...text(12.5, 600, C.red), marginBottom: 8 }}>{error}</div>}
        {/* Kaydet neden kapalı: hiçbir ders girilmediyse sessizce kapalı kalmasın. */}
        {!filled.length && !overRows.length && <div style={{ ...text(12.5, 500, C.mutedLight), marginBottom: 8 }}>Kaydetmek için en az bir dersin doğru, yanlış ya da boş sayısını gir.</div>}
        <Button full disabled={!canSave} onClick={save}>{busy ? "Kaydediliyor…" : editing ? "Değişiklikleri kaydet" : "Denemeyi kaydet"}</Button>
      </div>
    </Modal>
  );
}

function SubjectRow({ r, onChange }) {
  return (
    <div style={{ padding: "12px 0", borderTop: `1px solid ${C.divider}` }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
        <span style={{ ...text(14, 700), flex: 1, minWidth: 0 }}>{r.label}</span>
        <span style={mono(11.5, 600, r.over ? C.red : C.mutedLight)}>{r.Q}/{r.max}</span>
        <span style={{ ...mono(14, 700, r.net < 0 ? C.red : r.Q ? C.text : C.mutedLight), minWidth: 62, textAlign: "right" }}>{r.Q ? `${fmtNet(r.net)} net` : "—"}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
        <MiniStepper label="Doğru" name={`${r.label} doğru`} color={C.green} value={r.v.D} canInc={r.Q < r.max} onChange={(v) => onChange("D", v)} />
        <MiniStepper label="Yanlış" name={`${r.label} yanlış`} color={C.red} value={r.v.Y} canInc={r.Q < r.max} onChange={(v) => onChange("Y", v)} />
        <MiniStepper label="Boş" name={`${r.label} boş`} color={C.blank} value={r.v.B} canInc={r.Q < r.max} onChange={(v) => onChange("B", v)} />
      </div>
      {r.over && <div role="alert" style={{ ...text(12, 600, C.red), marginTop: 6 }}>{r.label} dersinde en fazla {r.max} soru var.</div>}
    </div>
  );
}

// Küçük adımlayıcı: − [sayı] + — dokunma alanı 44 px yükseklik; sayı elle de yazılabilir (yalnızca rakam, en fazla 2 hane).
function MiniStepper({ label, name, color, value, canInc, onChange }) {
  const n = num(value);
  const btn = (delta, Icon, aria, disabled) => (
    <button type="button" aria-label={aria} disabled={disabled} onClick={() => onChange(String(Math.max(0, n + delta)))} className="k-icon-btn"
      style={{ width: 40, height: 44, flexShrink: 0, border: "none", background: "transparent", color: C.text, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.35 : 1, display: "flex", alignItems: "center", justifyContent: "center", touchAction: "manipulation" }}>
      <Icon size={16} strokeWidth={2.4} />
    </button>
  );
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4, ...text(11.5, 600, C.mutedLight) }}>
        <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: color, flexShrink: 0 }} />{label}
      </div>
      <div style={{ display: "flex", alignItems: "center", border: `1px solid ${C.borderStrong}`, borderRadius: 12, background: C.fieldBg, overflow: "hidden" }}>
        {btn(-1, Minus, `${name} bir azalt`, n <= 0)}
        <input aria-label={name} inputMode="numeric" pattern="[0-9]*" enterKeyHint="next" value={value} placeholder="0"
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 2))} onFocus={(e) => e.target.select()}
          style={{ flex: 1, minWidth: 0, width: 0, textAlign: "center", border: "none", outline: "none", background: "transparent", padding: "10px 0", ...mono(17, 700) }} />
        {btn(1, Plus, `${name} bir artır`, !canInc)}
      </div>
    </div>
  );
}
