/*
  Warnings:

  - Added the required column `endDate` to the `Assignment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "AssignmentTarget" ADD VALUE 'SELECTED_STUDENTS';

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "endDate" TIMESTAMP(3) NOT NULL;
