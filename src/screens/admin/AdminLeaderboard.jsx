import { useEffect, useState } from "react";
import { C, bodyFont, monoFont } from "../../theme.js";
import { Avatar, Button, EmptyState, LoadingState, AlertBox, SectionHeader } from "../../components/common.jsx";
import { api } from "../../api.js";
import { fmtPct, fmtInt } from "../../reportModel.js";
import { gradeLabel } from "../../subjects.js";

// Kurulum > "Sıralama" — öğrenci ADIYLA genel başarı sıralaması (tüm derslerin toplamı, ders bazlı
// değil). 2026-09-29: okulun bilinçli kararıyla eklendi — "Okul analizi"nin (AdminAnalytics.jsx)
// aksine burada öğrenci kimliği GİZLENMEZ. Sunucu: routes/adminLeaderboard.js.
export default function AdminLeaderboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    api.adminLeaderboard()
      .then(setData)
      .catch((e) => setError(e.message || "Sıralama yüklenemedi"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  if (error) {
    return (
      <AlertBox title="Sıralama yüklenemedi">
        <div style={{ marginBottom: 10 }}>{error}</div>
        <Button small variant="secondary" onClick={load}>Tekrar dene</Button>
      </AlertBox>
    );
  }
  if (loading && !data) return <LoadingState />;
  if (!data) return null;

  const ranked = data.students.filter((s) => s.ranked);
  const unranked = data.students.filter((s) => !s.ranked);

  return (
    <div>
      <div style={{ fontFamily: bodyFont, fontSize: 13, fontWeight: 500, color: C.mutedLight, lineHeight: 1.5, marginBottom: 12 }}>
        Öğrencinin bugüne kadarki TÜM sonuçlarının (ödev + serbest çalışma, tüm dersler) toplamına göre genel net oranı.
        En az <span style={{ fontFamily: monoFont }}>{data.minQuestions}</span> soru çözmeyen öğrenci ayrı listede — sayı azken
        yüzde anlamsız çıkar.
      </div>

      {ranked.length === 0 ? (
        <EmptyState text="Henüz sıralamaya girecek kadar soru çözen öğrenci yok." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {ranked.map((s, i) => <Row key={s.id} rank={i + 1} s={s} />)}
        </div>
      )}

      {unranked.length > 0 && (
        <>
          <SectionHeader title="Yeterli veri yok" count={unranked.length} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {unranked.map((s) => <Row key={s.id} s={s} />)}
          </div>
        </>
      )}
    </div>
  );
}

function Row({ rank, s }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 14, background: C.surface, border: `1px solid ${C.border}` }}>
      {rank != null && (
        <span style={{ width: 22, flexShrink: 0, textAlign: "center", fontFamily: monoFont, fontSize: 13, fontWeight: 700, color: rank <= 3 ? C.amber : C.mutedLight }}>{rank}</span>
      )}
      <Avatar name={s.name} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: bodyFont, fontSize: 14, fontWeight: 700, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
        <div style={{ fontFamily: bodyFont, fontSize: 12, color: C.mutedLight, marginTop: 1 }}>
          {[s.className, gradeLabel(s.gradeLevel)].filter(Boolean).join(" · ")}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontFamily: monoFont, fontSize: 17, fontWeight: 700, color: s.netRate == null ? C.mutedLight : C.text }}>{fmtPct(s.netRate)}</div>
        <div style={{ fontFamily: monoFont, fontSize: 11, color: C.mutedLight, marginTop: 1 }}>{fmtInt(s.totalQuestions)} soru</div>
      </div>
    </div>
  );
}
