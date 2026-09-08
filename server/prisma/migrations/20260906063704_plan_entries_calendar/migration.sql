/*
  Warnings:

  - You are about to drop the `PlanWeek` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "PlanWeek" DROP CONSTRAINT "PlanWeek_assignmentId_fkey";

-- DropForeignKey
ALTER TABLE "PlanWeek" DROP CONSTRAINT "PlanWeek_teacherId_fkey";

-- DropTable
DROP TABLE "PlanWeek";

-- CreateTable
CREATE TABLE "PlanEntry" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "examType" "ExamType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "kind" "PlanWeekKind" NOT NULL DEFAULT 'TOPIC',
    "subject" TEXT,
    "topic" TEXT,
    "sourceBook" TEXT,
    "pageRange" TEXT,
    "questionCount" INTEGER,
    "note" TEXT,
    "autoSend" "PlanAutoSend" NOT NULL DEFAULT 'OFF',
    "assignmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanEntry_assignmentId_key" ON "PlanEntry"("assignmentId");

-- CreateIndex
CREATE INDEX "PlanEntry_teacherId_examType_date_idx" ON "PlanEntry"("teacherId", "examType", "date");

-- AddForeignKey
ALTER TABLE "PlanEntry" ADD CONSTRAINT "PlanEntry_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEntry" ADD CONSTRAINT "PlanEntry_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
