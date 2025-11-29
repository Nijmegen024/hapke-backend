-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'VENDOR');

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'VENDOR';
