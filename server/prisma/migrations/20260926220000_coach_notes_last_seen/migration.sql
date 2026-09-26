-- Koçun tek metinlik notu (User.coachNote) tarihli notlara (CoachNote) taşınır; son giriş (lastSeenAt) eklenir.

-- CreateTable
CREATE TABLE "CoachNote" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoachNote_studentId_teacherId_createdAt_idx" ON "CoachNote"("studentId", "teacherId", "createdAt");

-- AddForeignKey
ALTER TABLE "CoachNote" ADD CONSTRAINT "CoachNote_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachNote" ADD CONSTRAINT "CoachNote_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Veri taşıma: var olan not, öğrencinin ŞU ANKİ koçunun ilk notu olur (not zaten o koça görünüyordu).
-- Koçu olmayan öğrencinin notu kimseye görünmüyordu — sahipsiz not taşınmaz.
INSERT INTO "CoachNote" ("id", "studentId", "teacherId", "text", "createdAt", "updatedAt")
SELECT 'mig' || "id", "id", "teacherId", btrim("coachNote"), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User"
WHERE "coachNote" IS NOT NULL AND btrim("coachNote") <> '' AND "teacherId" IS NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "coachNote",
ADD COLUMN     "lastSeenAt" TIMESTAMP(3);

-- Son giriş, var olan hesaplar için bilinen son etkinlikten doldurulur: aksi halde canlıya alınır alınmaz
-- uygulamayı her gün kullanan herkes "hiç giriş yapmadı" görünürdü. GREATEST NULL'ları yok sayar; hiç iz
-- bırakmamış hesap (gerçekten hiç girmemiş) NULL kalır. Taşınan notlar (mig…) etkinlik sayılmaz.
UPDATE "User" u SET "lastSeenAt" = e.ts FROM (
  SELECT u2."id", GREATEST(
    u2."termsAcceptedAt",
    (SELECT max(r."completedAt") FROM "AssignmentRecipient" r WHERE r."studentId" = u2."id"),
    (SELECT max(r."skippedAt") FROM "AssignmentRecipient" r WHERE r."studentId" = u2."id"),
    (SELECT max(s."createdAt") FROM "StudySession" s WHERE s."studentId" = u2."id"),
    (SELECT max(p."createdAt") FROM "RecipientPhoto" p JOIN "AssignmentRecipient" r ON r."id" = p."recipientId" WHERE r."studentId" = u2."id"),
    (SELECT max(ps."createdAt") FROM "PushSubscription" ps WHERE ps."userId" = u2."id"),
    (SELECT max(a."createdAt") FROM "Assignment" a WHERE a."teacherId" = u2."id"),
    (SELECT max(pe."updatedAt") FROM "PlanEntry" pe WHERE pe."teacherId" = u2."id")
  ) AS ts
  FROM "User" u2
) e
WHERE e."id" = u."id" AND e.ts IS NOT NULL;
