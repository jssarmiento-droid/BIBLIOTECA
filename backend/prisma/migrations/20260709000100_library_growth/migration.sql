ALTER TABLE "User" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "Loan" ADD COLUMN "bookCopyId" INTEGER;
ALTER TABLE "Loan" ADD COLUMN "dueDate" TIMESTAMP(3);
ALTER TABLE "Loan" ADD COLUMN "renewalRequested" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "BookCopy" (
  "id" SERIAL NOT NULL,
  "code" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DISPONIBLE',
  "location" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "bookId" INTEGER NOT NULL,

  CONSTRAINT "BookCopy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BookRating" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "bookId" INTEGER NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BookRating_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Reservation" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "bookId" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fulfilledAt" TIMESTAMP(3),

  CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookCopy_code_key" ON "BookCopy"("code");
CREATE UNIQUE INDEX "BookRating_userId_bookId_key" ON "BookRating"("userId", "bookId");

ALTER TABLE "BookCopy" ADD CONSTRAINT "BookCopy_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_bookCopyId_fkey" FOREIGN KEY ("bookCopyId") REFERENCES "BookCopy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookRating" ADD CONSTRAINT "BookRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BookRating" ADD CONSTRAINT "BookRating_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "BookCopy" ("code", "status", "bookId")
SELECT
  CONCAT('LIB-', b."id", '-', LPAD(gs::TEXT, 3, '0')),
  CASE WHEN b."available" = true THEN 'DISPONIBLE' ELSE 'MANTENIMIENTO' END,
  b."id"
FROM "Book" b
JOIN LATERAL generate_series(1, GREATEST(b."stock", 1)) AS gs ON true
ON CONFLICT ("code") DO NOTHING;
