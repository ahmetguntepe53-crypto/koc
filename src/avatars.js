// Öğrencinin profil resmi olarak seçebileceği "ruh hayvanı" avatarları (KULLANICI İSTEĞİ 2026-10-07; tavşan 2026-10-08'de
// kaldırıldı — eski bir kayıtta kalırsa avatarSrc null döner, baş harfler görünür). Dosyalar
// public/avatars/<id>.svg; sunucudaki server/src/avatars.js ile AYNI kimlik listesi. Fotoğraf yükleme yok (KVKK).
export const AVATARS = [
  { id: "baykus", name: "Baykuş", trait: "Gece Kuşu" },
  { id: "kedi", name: "Kedi", trait: "Bağımsız" },
  { id: "tilki", name: "Tilki", trait: "Zeki" },
  { id: "kelebek", name: "Kelebek", trait: "Dönüşüm" },
  { id: "panda", name: "Panda", trait: "Sakin Güç" },
  { id: "geyik", name: "Geyik", trait: "Zarif" },
  { id: "kugu", name: "Kuğu", trait: "Asil" },
  { id: "yunus", name: "Yunus", trait: "Neşeli" },
  { id: "kar-leopari", name: "Kar Leoparı", trait: "Kararlı" },
  { id: "penguen", name: "Penguen", trait: "Disiplinli" },
  { id: "koala", name: "Koala", trait: "Huzurlu" },
  { id: "kizil-panda", name: "Kızıl Panda", trait: "Meraklı" },
  { id: "kirpi", name: "Kirpi", trait: "Azimli" },
  { id: "sincap", name: "Sincap", trait: "Çalışkan" },
];
const IDS = new Set(AVATARS.map((a) => a.id));
// Vite'ın base yolu (web'de "/", Capacitor'da da "/"); bilinmeyen kimlik null — baş harflere düşer.
export const avatarSrc = (id) => (id && IDS.has(id) ? `${import.meta.env.BASE_URL || "/"}avatars/${id}.svg` : null);
export const avatarInfo = (id) => AVATARS.find((a) => a.id === id) || null;
