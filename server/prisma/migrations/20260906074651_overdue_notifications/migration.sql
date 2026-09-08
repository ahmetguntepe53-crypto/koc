-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "teacherOverdueNotifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AssignmentRecipient" ADD COLUMN     "overdueReminderSentAt" TIMESTAMP(3);
