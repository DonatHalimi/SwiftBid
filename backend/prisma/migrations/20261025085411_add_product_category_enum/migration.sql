/*
  Warnings:

  - Changed the type of `category` on the `Product` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('ELECTRONICS', 'FASHION', 'HOME_AND_KITCHEN', 'BOOKS', 'SPORTS_AND_OUTDOORS', 'TOYS_AND_GAMES', 'COLLECTIBLES', 'VEHICLES', 'OTHER');

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "category",
ADD COLUMN     "category" "ProductCategory" NOT NULL;

-- CreateIndex
CREATE INDEX "Product_category_status_idx" ON "Product"("category", "status");
