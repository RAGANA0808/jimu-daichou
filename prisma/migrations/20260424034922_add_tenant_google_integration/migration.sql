-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "googleConnectedAt" TIMESTAMP(3),
ADD COLUMN     "googleConnectedEmail" TEXT,
ADD COLUMN     "googleRefreshToken" TEXT;
