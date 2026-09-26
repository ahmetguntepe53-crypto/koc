import path from "node:path";
import crypto from "node:crypto";
import { mkdirSync } from "node:fs";
import { open } from "node:fs/promises";
import multer from "multer";

// "./firebase-service-account.json" gibi diğer .env yollarıyla aynı desen — process.cwd() her zaman
// server/ kökü (npm start / node --watch src/index.js buradan çalıştırılır).
const uploadsRoot = path.join(process.cwd(), "uploads");

export function recipientPhotosDir(recipientId) {
  return path.join(uploadsRoot, "assignment-photos", recipientId);
}

// Yalnızca jpg/png kabul edilir. Karar MIME'a göre verilir, dosya adının uzantısına göre DEĞİL:
// bazı telefonlar/galeriler JPEG'i ".jfif" ya da hiç uzantısız adla gönderiyor ve bunlar eskiden
// reddediliyordu. Uzantı zaten güvenlik sağlamıyordu (istemci ikisini de istediği gibi yazabilir) —
// gerçek içerik kontrolü yükleme bittikten sonra sihirli baytlarla yapılır (bkz. hasValidImageSignature).
const ALLOWED = { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"] };
// Dosyanın ilk baytları — beyan edilen MIME ile eşleşmeli ki kaydedilen uzantı (ve express.static'in
// buna göre verdiği Content-Type) gerçek içerikle tutarlı olsun.
const SIGNATURES = {
  "image/jpeg": Buffer.from([0xff, 0xd8, 0xff]),
  "image/png": Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
};
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB — telefon kamerasından tek bir fotoğraf için yeterli, nginx'in client_max_body_size 25m sınırının altında

export const photoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const dir = recipientPhotosDir(req.params.id);
      mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = ALLOWED[file.mimetype]?.includes(path.extname(file.originalname).toLowerCase())
        ? path.extname(file.originalname).toLowerCase()
        : file.mimetype === "image/png" ? ".png" : ".jpg";
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED[file.mimetype]) {
      return cb(Object.assign(new Error("Yalnızca JPG veya PNG fotoğraf yükleyebilirsin"), { status: 400 }));
    }
    cb(null, true);
  },
}).single("photo");

// multer yüklemeyi bitirdikten sonra çağrılır: MIME istemcinin beyanıdır, içerik gerçekten JPEG/PNG
// mi diye diskteki dosyanın ilk baytlarına bakılır. Okuma hatası da "geçersiz" sayılır.
export async function hasValidImageSignature(file) {
  const expected = SIGNATURES[file?.mimetype];
  if (!expected) return false;
  let handle;
  try {
    handle = await open(file.path, "r");
    const buf = Buffer.alloc(expected.length);
    const { bytesRead } = await handle.read(buf, 0, expected.length, 0);
    return bytesRead === expected.length && buf.equals(expected);
  } catch {
    return false;
  } finally {
    await handle?.close().catch(() => {});
  }
}
