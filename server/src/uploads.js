import path from "node:path";
import crypto from "node:crypto";
import { mkdirSync } from "node:fs";
import multer from "multer";

// "./firebase-service-account.json" gibi diğer .env yollarıyla aynı desen — process.cwd() her zaman
// server/ kökü (npm start / node --watch src/index.js buradan çalıştırılır).
const uploadsRoot = path.join(process.cwd(), "uploads");

export function recipientPhotosDir(recipientId) {
  return path.join(uploadsRoot, "assignment-photos", recipientId);
}

// Yalnızca jpg/png kabul edilir — hem MIME hem uzantı kontrol edilir (biri diğerini taklit edip
// yanlış etiketlenmiş bir dosya sızdırmasın diye çift kontrol).
const ALLOWED = { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"] };
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
    const allowedExts = ALLOWED[file.mimetype];
    if (!allowedExts || !allowedExts.includes(path.extname(file.originalname).toLowerCase())) {
      return cb(Object.assign(new Error("Yalnızca JPG veya PNG fotoğraf yükleyebilirsin"), { status: 400 }));
    }
    cb(null, true);
  },
}).single("photo");
