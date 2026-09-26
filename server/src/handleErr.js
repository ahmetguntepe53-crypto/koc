import { Prisma } from "@prisma/client";

// GÜVENLİK: e.message yalnızca uygulama kodunun BİLEREK fırlattığı, kullanıcıya gösterilmek üzere
// yazılmış hatalarda istemciye döner — bunlar `Object.assign(new Error("..."), { status: XXX })`
// deseniyle .status alanını kendisi set ederek işaretlenir. .status set edilmemiş bir hata
// BEKLENMEYEN bir hatadır (Prisma iç hatası, programlama hatası vb.) — ham mesajı asla istemciye
// sızdırılmaz, sabit genel bir mesaj dönülür.
//
// İstisna: Prisma P2025 ("kayıt bulunamadı") — update/delete'e bilinmeyen bir id verilince fırlar
// (ör. admin'in var olmayan bir kullanıcıyı banlaması). Bu bir sunucu hatası değil, 404'tür.
export function handleErr(res, e) {
  console.error(e);
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
    return res.status(404).json({ error: "Bulunamadı" });
  }
  const status = e.status || 500;
  const message = e.status ? (e.message || "Sunucu hatası") : "Sunucu hatası";
  res.status(status).json({ error: message });
}
