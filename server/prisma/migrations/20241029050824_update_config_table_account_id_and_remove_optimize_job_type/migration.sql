/*
  Warnings:

  - The values [OPTIMIZE] on the enum `job_type` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `config` MODIFY `account_id` VARCHAR(64) NOT NULL;

-- AlterTable
ALTER TABLE `job` MODIFY `type` ENUM('DEPLOYMENT', 'CREATE_RESOURCE', 'PREPARE_RESOURCE', 'SANDBOX', 'ASSESSMENT', 'OPTIMIZATION') NOT NULL;
