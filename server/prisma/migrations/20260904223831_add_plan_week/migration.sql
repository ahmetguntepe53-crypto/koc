-- CreateEnum
CREATE TYPE "PlanWeekKind" AS ENUM ('TOPIC', 'PRACTICE_TEST', 'HOLIDAY');

-- CreateTable
CREATE TABLE "PlanWeek" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "examType" "ExamType" NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "kind" "PlanWeekKind" NOT NULL DEFAULT 'TOPIC',
    "subject" TEXT,
    "topic" TEXT,
    "sourceBook" TEXT,
    "pageRange" TEXT,
    "questionCount" INTEGER,
    "note" TEXT,
    "scheduledDate" TIMESTAMP(3),
    "assignmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanWeek_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanWeek_assignmentId_key" ON "PlanWeek"("assignmentId");

-- CreateIndex
CREATE INDEX "PlanWeek_teacherId_examType_idx" ON "PlanWeek"("teacherId", "examType");

-- CreateIndex
CREATE UNIQUE INDEX "PlanWeek_teacherId_examType_weekNumber_key" ON "PlanWeek"("teacherId", "examType", "weekNumber");

-- AddForeignKey
ALTER TABLE "PlanWeek" ADD CONSTRAINT "PlanWeek_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanWeek" ADD CONSTRAINT "PlanWeek_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
