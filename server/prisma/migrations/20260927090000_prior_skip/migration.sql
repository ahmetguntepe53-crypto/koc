-- AlterTable: pas geçilip sonradan teslim edilen ödevin pas bilgisi (rapor bunu gecikme saymaz).
ALTER TABLE "AssignmentRecipient" ADD COLUMN "priorSkippedAt" TIMESTAMP(3),
ADD COLUMN "priorSkipReason" TEXT;
