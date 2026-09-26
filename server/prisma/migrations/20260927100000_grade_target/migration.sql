-- Yıllık plan kaydı ve ondan yayınlanan ödev için hedef sınıf düzeyi (11 / 12; boş = ikisi).
-- Mevcut kayıtların işaretlenmesi ve 11. sınıflara gitmiş 12. sınıf ödevlerinin temizliği ayrı betikte
-- (scripts/fix-grade-targets.js: önce kuru çalışır, rapor okunup onaylanınca uygular).
ALTER TABLE "PlanEntry" ADD COLUMN "gradeLevel" INTEGER;
ALTER TABLE "Assignment" ADD COLUMN "targetGrade" INTEGER;
