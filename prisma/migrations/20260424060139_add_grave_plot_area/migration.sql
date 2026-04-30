-- AlterTable
ALTER TABLE "GravePlot" ADD COLUMN     "areaId" UUID;

-- CreateTable
CREATE TABLE "GravePlotArea" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "canvasWidth" INTEGER NOT NULL DEFAULT 1200,
    "canvasHeight" INTEGER NOT NULL DEFAULT 800,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GravePlotArea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GravePlotArea_tenantId_idx" ON "GravePlotArea"("tenantId");

-- CreateIndex
CREATE INDEX "GravePlotArea_tenantId_sortOrder_idx" ON "GravePlotArea"("tenantId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "GravePlotArea_tenantId_name_key" ON "GravePlotArea"("tenantId", "name");

-- CreateIndex
CREATE INDEX "GravePlot_tenantId_areaId_idx" ON "GravePlot"("tenantId", "areaId");

-- AddForeignKey
ALTER TABLE "GravePlot" ADD CONSTRAINT "GravePlot_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "GravePlotArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GravePlotArea" ADD CONSTRAINT "GravePlotArea_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
