-- AlterTable
ALTER TABLE `database_instances` ADD COLUMN `storage_type` ENUM('FSXN', 'FSXW', 'EBS') NOT NULL DEFAULT 'FSXN';
