-- AlterTable
ALTER TABLE `database_instances` ADD COLUMN `storage_type` ENUM('FSXN') NOT NULL DEFAULT 'FSXN';
