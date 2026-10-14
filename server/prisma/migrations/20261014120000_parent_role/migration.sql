-- Veli rolü ve velinin öğrencisi
ALTER TYPE "Role" ADD VALUE 'PARENT';
ALTER TABLE "User" ADD COLUMN "childId" TEXT;
CREATE UNIQUE INDEX "User_childId_key" ON "User"("childId");
ALTER TABLE "User" ADD CONSTRAINT "User_childId_fkey" FOREIGN KEY ("childId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
