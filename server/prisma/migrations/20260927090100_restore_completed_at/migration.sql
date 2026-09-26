-- Veri düzeltmesi: eski sürümde girilmiş bir sonucun DÜZENLENMESİ teslim zamanını (completedAt) düzenleme anına
-- taşıyordu; zamanında teslim edilmiş ödev geriye dönük "geç" görünüyordu. İlk teslimin gerçek zamanı Submission.createdAt'te
-- duruyor (yalnızca ilk girişte yazılır, düzenleme değiştirmez). completedAt ondan belirgin biçimde sonraysa (5 sn tolerans:
-- düzenlenmemiş kayıtlarda iki zaman aynı işlemde birkaç ms arayla yazılır) ilk teslim zamanına geri alınır.
UPDATE "AssignmentRecipient" r
SET "completedAt" = s."createdAt"
FROM "Submission" s
WHERE s."recipientId" = r."id"
  AND r."completed" = true
  AND r."completedAt" > s."createdAt" + interval '5 seconds';
