// Her test dosyasından önce yüklenir (vitest.config.js > setupFiles). Her dosya kendi süreç/modül grafiğinde koştuğu
// için kendi PrismaClient'ını açar — dosya bitince bağlantı havuzu kapatılır, açık bağlantılar birikmesin.
import { afterAll } from "vitest";
import { prisma } from "../src/db.js";

afterAll(async () => {
  await prisma.$disconnect();
});
