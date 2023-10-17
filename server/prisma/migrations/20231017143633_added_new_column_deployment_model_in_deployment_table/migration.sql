/*
  Warnings:

  - Made the column `deployment_model` on table `deployment` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `deployment` MODIFY `deployment_model` ENUM('FCI', 'Standalone') NOT NULL;
