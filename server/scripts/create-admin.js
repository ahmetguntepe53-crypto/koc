// Açık kayıt olmadığı için ilk ADMIN hesabı buradan, doğrudan veritabanına yazılır.
// Kullanım: node scripts/create-admin.js  (server/.env içindeki ADMIN_EMAIL/ADMIN_PASSWORD/ADMIN_NAME kullanılır)
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/db.js";

async function main() {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  const name = process.env.ADMIN_NAME || "Sistem Yöneticisi";
  if (!email || !password) {
    console.error("ADMIN_EMAIL ve ADMIN_PASSWORD .env içinde tanımlı olmalı.");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("ADMIN_PASSWORD en az 8 karakter olmalı.");
    process.exit(1);
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "ADMIN", banned: false },
    create: { email, passwordHash, role: "ADMIN", name },
  });
  console.log(`Admin hesabı hazır: ${user.email} (id: ${user.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
