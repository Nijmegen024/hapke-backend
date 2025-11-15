-- AlterTable
ALTER TABLE "Chat" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "category" TEXT,
ADD COLUMN     "cuisine" TEXT,
ADD COLUMN     "deliveryFee" DECIMAL(10,2),
ADD COLUMN     "etaDisplay" TEXT,
ADD COLUMN     "heroImageUrl" TEXT,
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "logoImageUrl" TEXT,
ADD COLUMN     "minOrder" DECIMAL(10,2),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "VendorMenuCategory" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorMenuCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorMenuItem" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "imageUrl" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isHighlighted" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorMenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VendorMenuCategory_vendorId_position_idx" ON "VendorMenuCategory"("vendorId", "position");

-- CreateIndex
CREATE INDEX "VendorMenuItem_vendorId_categoryId_idx" ON "VendorMenuItem"("vendorId", "categoryId");

-- CreateIndex
CREATE INDEX "VendorMenuItem_vendorId_position_idx" ON "VendorMenuItem"("vendorId", "position");

-- AddForeignKey
ALTER TABLE "VendorMenuCategory" ADD CONSTRAINT "VendorMenuCategory_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorMenuItem" ADD CONSTRAINT "VendorMenuItem_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorMenuItem" ADD CONSTRAINT "VendorMenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "VendorMenuCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
