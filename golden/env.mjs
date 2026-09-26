// Golden kayıt sunucusunun ortamı — geliştirme veritabanına (kocluk_dev) ASLA dokunmaz: ayrı `kocluk_golden`
// DB'si her kayıtta sıfırdan kurulur. E-posta (Resend) ve push (Firebase) kapalı, hız sınırları kapalı
// (NODE_ENV=test), sabit bir JWT anahtarı.
import os from "node:os";

export const API_PORT = 4299;
export const PREVIEW_PORT = 5290;

export function serverEnv(db = "kocluk_golden") {
  const owner = process.env.PGUSER || os.userInfo().username;
  return {
    ...process.env,
    DB_OWNER: owner,
    DATABASE_URL: `postgresql://${owner}@localhost:5432/${db}?schema=public`,
    JWT_SECRET: "golden-jwt-secret",
    PORT: String(API_PORT),
    NODE_ENV: "test",
    RESEND_API_KEY: "",
    FIREBASE_SERVICE_ACCOUNT_PATH: "",
    API_PUBLIC_URL: `http://127.0.0.1:${API_PORT}`,
    ADMIN_EMAIL: "admin@golden.test",
    ADMIN_PASSWORD: "GoldenAdmin1",
    ADMIN_NAME: "Okul Yönetimi",
  };
}
