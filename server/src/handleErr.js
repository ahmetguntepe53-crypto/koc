// GÜVENLİK: e.message yalnızca uygulama kodunun BİLEREK fırlattığı, kullanıcıya gösterilmek üzere
// yazılmış hatalarda istemciye döner — bunlar `Object.assign(new Error("..."), { status: XXX })`
// deseniyle .status alanını kendisi set ederek işaretlenir. .status set edilmemiş bir hata
// BEKLENMEYEN bir hatadır (Prisma iç hatası, programlama hatası vb.) — ham mesajı asla istemciye
// sızdırılmaz, sabit genel bir mesaj dönülür.
export function handleErr(res, e) {
  console.error(e);
  const status = e.status || 500;
  const message = e.status ? (e.message || "Sunucu hatası") : "Sunucu hatası";
  res.status(status).json({ error: message });
}
