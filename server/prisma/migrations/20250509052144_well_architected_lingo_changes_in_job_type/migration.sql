/*
  Warnings:

  - The values [OPTIMIZATION] on the enum `job_type` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `job` MODIFY `type` ENUM('DEPLOYMENT', 'CREATE_RESOURCE', 'PREPARE_RESOURCE', 'SANDBOX', 'ASSESSMENT', 'WELL_ARCHITECTED') NOT NULL;
