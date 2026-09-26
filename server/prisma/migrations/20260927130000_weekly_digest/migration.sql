-- CreateTable
CREATE TABLE "WeeklyDigestRun" (
    "week" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "WeeklyDigestRun_pkey" PRIMARY KEY ("week","kind")
);
