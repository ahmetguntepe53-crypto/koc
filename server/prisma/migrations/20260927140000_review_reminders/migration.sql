-- Aralıklı tekrar hatırlatması günlüğü (bkz. server/src/reviewReminders.js): öğrenci × konu anahtarı × aşama (7 | 21)
-- başına tek satır. Yalnızca yeni tablo — mevcut veriye dokunmaz, eski uygulama sürümlerini etkilemez.

-- CreateTable
CREATE TABLE "ReviewReminderLog" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "stage" INTEGER NOT NULL,
    "baseDate" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewReminderLog_sentAt_idx" ON "ReviewReminderLog"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewReminderLog_studentId_key_stage_key" ON "ReviewReminderLog"("studentId", "key", "stage");

-- AddForeignKey
ALTER TABLE "ReviewReminderLog" ADD CONSTRAINT "ReviewReminderLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
