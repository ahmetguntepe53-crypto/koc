-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN "coachReminderSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AssignmentRecipient" ADD COLUMN "skipNote" TEXT,
ADD COLUMN "skipReason" TEXT,
ADD COLUMN "skippedAt" TIMESTAMP(3);
