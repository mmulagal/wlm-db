/*
  Warnings:

  - Added the required column `credentials_id` to the `job` table without a default value. This is not possible if the table is not empty.
  - Added the required column `region` to the `job` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `job` ADD COLUMN `credentials_id` VARCHAR(80) NOT NULL,
    ADD COLUMN `region` VARCHAR(30) NOT NULL;
