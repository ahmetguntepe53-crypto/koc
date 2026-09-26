-- Öğrencinin YKS alanı (SAY / EA / SOZ / DIL; boş = bilinmiyor). Düz metin: değerler uygulamada doğrulanır
-- (server/src/subjects.js > STUDENT_FIELDS). Mevcut kayıtlar boş kalır — rapor o durumda eski davranışla
-- (AYT derslerini son 8 haftanın kayıtlarından tahmin ederek) çalışır.
ALTER TABLE "User" ADD COLUMN "field" TEXT;
