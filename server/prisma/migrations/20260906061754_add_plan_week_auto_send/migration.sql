-- CreateEnum
CREATE TYPE "PlanAutoSend" AS ENUM ('OFF', 'ON_DATE', 'DAY_BEFORE');

-- AlterTable
ALTER TABLE "PlanWeek" ADD COLUMN     "autoSend" "PlanAutoSend" NOT NULL DEFAULT 'OFF';
