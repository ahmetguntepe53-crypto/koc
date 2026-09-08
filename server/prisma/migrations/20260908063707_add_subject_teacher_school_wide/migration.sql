-- AlterEnum
ALTER TYPE "AssignmentTarget" ADD VALUE 'SCHOOL_WIDE';

-- AlterTable
ALTER TABLE "PlanEntry" ADD COLUMN     "schoolWide" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isSubjectTeacher" BOOLEAN NOT NULL DEFAULT false;
