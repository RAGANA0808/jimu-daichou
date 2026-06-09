-- CreateEnum
CREATE TYPE "InteractionCategory" AS ENUM ('CONTRACT', 'MEMORIAL', 'FUNERAL', 'TOUR', 'FAMILY', 'HEALTH', 'MESSAGE', 'SCHEDULE', 'GRAVE_VISIT', 'KAIMYO', 'OTHER');

-- AlterTable
ALTER TABLE "InteractionNote" ADD COLUMN "category" "InteractionCategory" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "InteractionNote" ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false;
