-- AlterEnum
ALTER TYPE "ExamType" ADD VALUE 'LGS';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "gradeLevel" INTEGER;
