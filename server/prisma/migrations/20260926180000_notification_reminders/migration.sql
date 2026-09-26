-- AlterTable
ALTER TABLE "AssignmentRecipient" ADD COLUMN "dueReminderSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "pushPending" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Notification_pushPending_idx" ON "Notification"("pushPending");
