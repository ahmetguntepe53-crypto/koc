import { useEffect, useState } from "react";
import { Check, Target, ArrowRight } from "lucide-react";
import { C } from "../../theme.js";
import { Card, Chip, Pill, LoadingState } from "../../components/common.jsx";
import { monthLabel, recentMonths, defaultReportMonth } from "../teacher/MonthlyReportsScreen.jsx";
import { buildNarrative } from "../../narrative/index.js";
import { text } from "./parts.jsx";

// "Ayın değerlendirmesi" — öğrencinin Gelişim ekranında, yalnız öğrenci görünümünde. Koçun "Aylık değerlendirme"
// kartıyla (CoachPanel.jsx > NarrativeCard) aynı motor ve aynı desen, öğrenci sürümüyle (audience: "student"): "sen"
// diliyle özet, güçlü yönler, gelişim alanları ("Sonraki adım") ve bu hafta yapılabilecek 2–4 somut eylem. Koça özel
// hiçbir şey (durum çipi, koça öneriler, görüşme, dikkat) üretilmez. Renkler yalnız anlam taşır: güçlü yön yeşil, odak
// amber; gerisi nötr.
export default function StudentNarrativeCard({ raw }) {
  const [month, setMonth] = useState(defaultReportMonth);
  // Birkaç ayın modeli hesaplandığı için (telefonda birkaç yüz ms) ilk çizimden SONRA hesaplanır — rapor açılışı takılmasın.
  const [n, setN] = useState(undefined); // undefined: hazırlanıyor · null: hazırlanamadı
  useEffect(() => {
    let alive = true;
    setN(undefined);
    const t = setTimeout(() => {
      let v = null;
      try { v = buildNarrative(raw, { month, audience: "student" }); } catch (e) { console.error("[değerlendirme]", e); }
      if (alive) setN(v);
    }, 30);
    return () => { alive = false; clearTimeout(t); };
  }, [raw, month]);

  return (
    <Card style={{ padding: 16 }}>
      <div className="k-chip-row" role="group" aria-label="Değerlendirilecek ay" style={{ marginBottom: 4 }}>
        {recentMonths().map((m) => <Chip key={m} active={m === month} onClick={() => setMonth(m)}>{monthLabel(m).split(" ")[0]}</Chip>)}
      </div>
      {n === undefined ? (
        <div style={{ paddingTop: 8 }}><LoadingState rows={1} /></div>
      ) : !n ? (
        <div style={{ ...text(12.5, 500, C.mutedLight), padding: "8px 0" }}>Bu ay için değerlendirme hazırlanamadı.</div>
      ) : (
        <div aria-live="polite" style={{ paddingTop: 8, display: "flex", flexDirection: "column", gap: 14 }}>
          {n.veriYeterliligi !== "yeterli" && <div><Pill>{n.veriYeterliligi === "sinirli" ? "kayıtlar sınırlı" : "ön değerlendirme"}</Pill></div>}
          {n.ozet && <div style={{ ...text(14, 500, C.text), lineHeight: 1.55 }}>{n.ozet}</div>}

          {n.gucluYonler.length > 0 && (
            <div>
              <div style={{ ...text(12.5, 700, C.green), marginBottom: 6 }}>Güçlü yönlerin</div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                {n.gucluYonler.map((g, i) => (
                  <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <Check size={15} color={C.green} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ ...text(13, 500, C.text2), lineHeight: 1.5 }}>{g}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {n.gelisimAlanlari.length > 0 && (
            <div>
              <div style={{ ...text(12.5, 700, C.amber), marginBottom: 2 }}>Gelişim alanların</div>
              {n.gelisimAlanlari.map((g, i) => (
                <div key={i} style={{ padding: "8px 0", borderTop: i ? `1px solid ${C.divider}` : "none" }}>
                  <div style={{ ...text(13.5, 700), lineHeight: 1.4 }}>{g.alan}</div>
                  <div style={{ ...text(12.5, 500, C.mutedLight), marginTop: 3, lineHeight: 1.5 }}>{g.kanit}</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "flex-start", marginTop: 4 }}>
                    <ArrowRight size={14} color={C.text2} aria-hidden="true" style={{ flexShrink: 0, marginTop: 3 }} />
                    <span style={{ ...text(13, 500, C.text2), lineHeight: 1.5 }}><b style={{ fontWeight: 700 }}>Sonraki adım:</b> {g.oneri}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {n.sonrakiAdimlar.length > 0 && (
            <div style={{ background: C.surface2, borderRadius: 12, padding: "12px 12px 10px" }}>
              <div style={{ ...text(12.5, 700, C.text), marginBottom: 6 }}>Bu hafta yapabileceklerin</div>
              <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 7 }}>
                {n.sonrakiAdimlar.map((a, i) => (
                  <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <Target size={15} color={C.text2} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ ...text(13, 500, C.text2), lineHeight: 1.5 }}>{a}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div style={{ ...text(11.5, 500, C.mutedLight), lineHeight: 1.5 }}>
            Raporunun kendi sayılarından kurallarla hazırlanır; verin cihazından çıkmaz.
          </div>
        </div>
      )}
    </Card>
  );
}
