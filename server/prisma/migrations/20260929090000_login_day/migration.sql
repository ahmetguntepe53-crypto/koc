-- CreateTable
CREATE TABLE "LoginDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoginDay_day_idx" ON "LoginDay"("day");

-- CreateIndex
CREATE UNIQUE INDEX "LoginDay_userId_day_key" ON "LoginDay"("userId", "day");

-- AddForeignKey
ALTER TABLE "LoginDay" ADD CONSTRAINT "LoginDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
