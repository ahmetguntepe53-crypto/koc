-- CreateTable
CREATE TABLE "RecipientPhoto" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipientPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecipientPhoto_recipientId_idx" ON "RecipientPhoto"("recipientId");

-- AddForeignKey
ALTER TABLE "RecipientPhoto" ADD CONSTRAINT "RecipientPhoto_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "AssignmentRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
