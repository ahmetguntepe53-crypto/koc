import { useEffect, useState } from "react";
import { Input, Select } from "./common.jsx";
import { topicsFor } from "../topics.js";

const CUSTOM = "__custom__";

// Müfredat konusu seçici — seçili sınav türü + dersin konu listesi (bkz. topics.js) bir açılır listede
// numaralı gösterilir; listede olmayan bir konu için "kendim yazacağım" seçeneği serbest metin alanı
// açar. Yerel <select> kullanılır (datalist/otomatik tamamlama iOS WebView'da güvenilir değil).
// value/onChange düz konu metnidir — form ve sunucu tarafı değişmez.
export default function TopicField({ examType, subject, value, onChange, label = "Konu", required = false, placeholder = "Konuyu yaz" }) {
  const topics = topicsFor(examType, subject);
  // Listede olmayan kayıtlı bir değer (eski serbest metin) varsa doğrudan elle yazma modunda açılır.
  const [customMode, setCustomMode] = useState(() => !!value && !topics.includes(value));

  // Ders/sınav türü değişince önceki dersin konusu yeni listede yoksa seçim temizlenir — ör. Fizik'ten
  // Kimya'ya geçince "Optik" seçili kalmasın. Elle yazılmış metne dokunulmaz.
  useEffect(() => {
    if (!customMode && value && !topics.includes(value)) onChange("");
  }, [examType, subject]); // eslint-disable-line react-hooks/exhaustive-deps

  if (topics.length === 0) {
    return <Input label={label} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} />;
  }

  return (
    <>
      <Select
        label={label}
        value={customMode ? CUSTOM : value}
        required={required && !customMode}
        onChange={(e) => {
          if (e.target.value === CUSTOM) { setCustomMode(true); onChange(""); }
          else { setCustomMode(false); onChange(e.target.value); }
        }}
      >
        <option value="" disabled>Konu seç ({topics.length})</option>
        {topics.map((t, i) => <option key={t} value={t}>{i + 1}. {t}</option>)}
        <option value={CUSTOM}>Listede yok — kendim yazacağım</option>
      </Select>
      {customMode && (
        <Input
          aria-label={`${label} (elle)`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          autoFocus
        />
      )}
    </>
  );
}
