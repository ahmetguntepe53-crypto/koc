-- Deneme sınavları (TYT/AYT): öğrencinin ders ders doğru/yanlış/boş sayıları. Deneme neti gerçek sınav netidir.
-- Ders listesi ve resmî soru sayıları uygulamada doğrulanır (server/src/practiceExams.js > PRACTICE_EXAM_LAYOUT).
-- AYT Felsefe Grubu (Felsefe + Mantık + Psikoloji + Sosyoloji, 12 soru) tek satırda "Felsefe" adıyla tutulur.
-- Mevcut tablolara dokunulmaz; yalnızca iki yeni tablo eklenir (eski uygulama sürümleri etkilenmez).

-- CreateTable
CREATE TABLE "PracticeExam" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "examType" "ExamType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeExamResult" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "correct" INTEGER NOT NULL,
    "wrong" INTEGER NOT NULL,
    "blank" INTEGER NOT NULL,

    CONSTRAINT "PracticeExamResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PracticeExam_studentId_date_idx" ON "PracticeExam"("studentId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PracticeExamResult_examId_subject_key" ON "PracticeExamResult"("examId", "subject");

-- AddForeignKey
ALTER TABLE "PracticeExam" ADD CONSTRAINT "PracticeExam_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeExam" ADD CONSTRAINT "PracticeExam_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeExamResult" ADD CONSTRAINT "PracticeExamResult_examId_fkey" FOREIGN KEY ("examId") REFERENCES "PracticeExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

