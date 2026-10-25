ALTER TYPE "TransactionStatus" ADD VALUE 'PROCESSING';
CREATE TYPE "PaymentMethod" AS ENUM ('STRIPE', 'COD');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'PARTIALLY_PAID', 'COD_DUE', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'DISPUTED');
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('CREATED', 'OPEN', 'PAID', 'FAILED', 'EXPIRED');
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'ON_HOLD');
CREATE TYPE "LedgerEntryType" AS ENUM ('PAYMENT', 'COD_PAYMENT', 'COMMISSION', 'REFUND', 'PAYOUT', 'PAYOUT_REVERSAL', 'DISPUTE');

ALTER TABLE "User"
  ADD COLUMN "stripeConnectAccountId" TEXT;
CREATE UNIQUE INDEX "User_stripeConnectAccountId_key" ON "User"("stripeConnectAccountId");

ALTER TABLE "Transaction"
  ADD COLUMN "paymentMethod" "PaymentMethod",
  ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "refundedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "commissionAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "sellerNetAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "paidAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3);

UPDATE "Transaction"
SET "paymentStatus" = 'PAID',
    "paidAmount" = "finalAmount",
    "paidAt" = "updatedAt",
    "commissionAmount" = ROUND("finalAmount" * 0.05, 2),
    "sellerNetAmount" = "finalAmount" - ROUND("finalAmount" * 0.05, 2)
WHERE "status" IN ('PAID', 'SHIPPED', 'COMPLETED');

UPDATE "Transaction"
SET "paymentMethod" = 'STRIPE',
    "completedAt" = CASE WHEN "status" = 'COMPLETED' THEN "updatedAt" ELSE NULL END
WHERE "status" IN ('PAID', 'SHIPPED', 'COMPLETED');

CREATE INDEX "Transaction_paymentStatus_paidAt_idx" ON "Transaction"("paymentStatus", "paidAt");
CREATE INDEX "Transaction_status_completedAt_idx" ON "Transaction"("status", "completedAt");

CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeCheckoutUrl" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'eur',
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'CREATED',
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StripeWebhookEvent" (
    "id" TEXT NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancialLedgerEntry" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "LedgerEntryType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'eur',
    "reference" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinancialLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SellerPayout" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "stripeTransferId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'eur',
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SellerPayout_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentDispute" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "stripeDisputeId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentDispute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentAttempt_stripeCheckoutSessionId_key" ON "PaymentAttempt"("stripeCheckoutSessionId");
CREATE UNIQUE INDEX "PaymentAttempt_stripePaymentIntentId_key" ON "PaymentAttempt"("stripePaymentIntentId");
CREATE INDEX "PaymentAttempt_transactionId_createdAt_idx" ON "PaymentAttempt"("transactionId", "createdAt");
CREATE INDEX "PaymentAttempt_status_createdAt_idx" ON "PaymentAttempt"("status", "createdAt");
CREATE UNIQUE INDEX "StripeWebhookEvent_stripeEventId_key" ON "StripeWebhookEvent"("stripeEventId");
CREATE INDEX "StripeWebhookEvent_type_createdAt_idx" ON "StripeWebhookEvent"("type", "createdAt");
CREATE UNIQUE INDEX "FinancialLedgerEntry_reference_key" ON "FinancialLedgerEntry"("reference");
CREATE INDEX "FinancialLedgerEntry_userId_createdAt_idx" ON "FinancialLedgerEntry"("userId", "createdAt");
CREATE INDEX "FinancialLedgerEntry_transactionId_createdAt_idx" ON "FinancialLedgerEntry"("transactionId", "createdAt");
CREATE INDEX "FinancialLedgerEntry_type_createdAt_idx" ON "FinancialLedgerEntry"("type", "createdAt");
CREATE UNIQUE INDEX "SellerPayout_transactionId_key" ON "SellerPayout"("transactionId");
CREATE UNIQUE INDEX "SellerPayout_stripeTransferId_key" ON "SellerPayout"("stripeTransferId");
CREATE INDEX "SellerPayout_status_scheduledAt_idx" ON "SellerPayout"("status", "scheduledAt");
CREATE UNIQUE INDEX "PaymentDispute_stripeDisputeId_key" ON "PaymentDispute"("stripeDisputeId");
CREATE INDEX "PaymentDispute_transactionId_createdAt_idx" ON "PaymentDispute"("transactionId", "createdAt");
CREATE INDEX "PaymentDispute_status_createdAt_idx" ON "PaymentDispute"("status", "createdAt");

ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT "FinancialLedgerEntry_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT "FinancialLedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SellerPayout" ADD CONSTRAINT "SellerPayout_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentDispute" ADD CONSTRAINT "PaymentDispute_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
