-- AlterTable
ALTER TABLE "User" ADD COLUMN "teachingSubjects" TEXT[] DEFAULT ARRAY[]::TEXT[];
