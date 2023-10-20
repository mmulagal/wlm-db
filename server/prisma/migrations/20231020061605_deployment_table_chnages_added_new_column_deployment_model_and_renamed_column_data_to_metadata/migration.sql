/*
  Warnings:

  - You are about to drop the column `data` on the `deployment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `deployment` DROP COLUMN `data`,
    ADD COLUMN `metadata` JSON NULL;
