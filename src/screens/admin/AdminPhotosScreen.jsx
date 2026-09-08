import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { C, displayFont, bodyFont } from "../../theme.js";
import { Card, Button, Input, Pill, Modal, EmptyState } from "../../components/common.jsx";
import { api, photoUrl } from "../../api.js";
import { formatDate } from "../../dates.js";

// Fotoğrafları öğrenciye göre grupluyoruz — admin "hangi öğrenci ne yüklemiş" bağlamıyla temizlik
// yapıyor, düz kronolojik liste bu amaç için daha zor taranır.
function groupByStudent(photos) {
  const groups = new Map();
  for (const p of photos) {
    // p.recipient/.student normalde her zaman dolu gelir (zorunlu ilişkiler) — yine de bir
    // tutarsızlık (ör. kısmi bir temizlik) yüzünden eksikse bu satır sessizce atlanır, tüm ekran çökmez.
    const student = p.recipient?.student;
    if (!student) continue;
    if (!groups.has(student.id)) groups.set(student.id, { student, photos: [] });
    groups.get(student.id).photos.push(p);
  }
  return [...groups.values()];
}

export default function AdminPhotosScreen() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [toast, setToast] = useState(null);
  const [lightbox, setLightbox] = useState(null); // { photos, index }

  const load = async (query) => {
    setLoading(true);
    try {
      const { photos } = await api.adminListPhotos(query);
      setPhotos(photos);
    } catch (e) {
      setToast({ type: "error", text: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const runSearch = (e) => { e.preventDefault(); load(q); };

  const deletePhoto = async (photoId) => {
    if (!window.confirm("Bu fotoğraf kalıcı olarak silinsin mi?")) return;
    try {
      await api.adminDeletePhoto(photoId);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      setLightbox(null);
    } catch (e) {
      setToast({ type: "error", text: e.message });
    }
  };

  const groups = groupByStudent(photos);

  return (
    <div style={{ padding: 28, maxWidth: 1040, margin: "0 auto" }}>
      {toast && (
        <div style={{ marginBottom: 16, padding: "11px 15px", borderRadius: C.radiusSm, background: toast.type === "error" ? C.redSoft : C.greenSoft, color: toast.type === "error" ? C.red : C.green, fontSize: 13, fontWeight: 600, fontFamily: bodyFont }}>
          {toast.text}
        </div>
      )}

      <form onSubmit={runSearch} style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <Input placeholder="Öğrenci ismiyle ara..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button small variant="secondary" type="submit">Ara</Button>
      </form>

      {loading ? (
        <EmptyState text="Yükleniyor..." />
      ) : groups.length === 0 ? (
        <EmptyState text="Kanıt fotoğrafı bulunamadı." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {groups.map((g) => (
            <Card key={g.student.id} style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <span style={{ fontFamily: displayFont, fontSize: 14.5, fontWeight: 700, color: C.text }}>{g.student.name}</span>
                {g.student.className && <Pill>{g.student.className}</Pill>}
                <span style={{ fontFamily: bodyFont, fontSize: 12, color: C.mutedLight }}>{g.photos.length} fotoğraf</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))", gap: 8 }}>
                {g.photos.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setLightbox({ photos: g.photos, index: i })}
                    title={`${p.recipient.assignment?.subject} — ${p.recipient.assignment?.topic}`}
                    style={{ aspectRatio: "1", borderRadius: C.radiusSm, overflow: "hidden", border: `1px solid ${C.border}`, padding: 0, cursor: "pointer" }}
                  >
                    <img src={photoUrl(p)} alt="Kanıt fotoğrafı" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  </button>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {lightbox && (
        <Modal
          title={`${lightbox.photos[lightbox.index].recipient.assignment?.subject} — ${lightbox.photos[lightbox.index].recipient.assignment?.topic} (${lightbox.index + 1}/${lightbox.photos.length})`}
          onClose={() => setLightbox(null)}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => setLightbox((l) => ({ ...l, index: (l.index - 1 + l.photos.length) % l.photos.length }))}
              disabled={lightbox.photos.length < 2}
              style={{ background: "none", border: "none", cursor: lightbox.photos.length < 2 ? "default" : "pointer", opacity: lightbox.photos.length < 2 ? 0.3 : 1, flexShrink: 0 }}
            >
              <ChevronLeft size={22} color={C.text} />
            </button>
            <img
              src={photoUrl(lightbox.photos[lightbox.index])}
              alt="Kanıt fotoğrafı"
              style={{ width: "100%", maxHeight: "58vh", objectFit: "contain", borderRadius: C.radiusSm, background: C.surface2 }}
            />
            <button
              type="button"
              onClick={() => setLightbox((l) => ({ ...l, index: (l.index + 1) % l.photos.length }))}
              disabled={lightbox.photos.length < 2}
              style={{ background: "none", border: "none", cursor: lightbox.photos.length < 2 ? "default" : "pointer", opacity: lightbox.photos.length < 2 ? 0.3 : 1, flexShrink: 0 }}
            >
              <ChevronRight size={22} color={C.text} />
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
            <span style={{ fontFamily: bodyFont, fontSize: 12, color: C.muted }}>{formatDate(lightbox.photos[lightbox.index].createdAt)}</span>
            <Button small variant="danger" icon={Trash2} onClick={() => deletePhoto(lightbox.photos[lightbox.index].id)}>Sil</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
