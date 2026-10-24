-- AlterTable
ALTER TABLE "bills" ADD COLUMN     "end_month" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "every_months" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "start_month" TEXT NOT NULL DEFAULT '2026-06';

-- CreateTable
CREATE TABLE "bill_payments" (
    "id" SERIAL NOT NULL,
    "bill_id" INTEGER NOT NULL,
    "month" TEXT NOT NULL,

    CONSTRAINT "bill_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bill_payments_bill_id_month_key" ON "bill_payments"("bill_id", "month");

-- AddForeignKey
ALTER TABLE "bill_payments" ADD CONSTRAINT "bill_payments_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing "paid" flags were for June 2026 (the only month the app showed): carry them over as payments.
INSERT INTO "bill_payments" ("bill_id", "month") SELECT "id", '2026-06' FROM "bills" WHERE "paid" = true;
