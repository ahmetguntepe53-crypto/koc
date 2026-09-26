-- CreateTable
CREATE TABLE "MonthlyReportRun" (
    "month" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "MonthlyReportRun_pkey" PRIMARY KEY ("month")
);
