-- AlterTable
ALTER TABLE `resource` ADD COLUMN `credentials_id` VARCHAR(80) NOT NULL DEFAULT '',
    ADD COLUMN `storage_type` ENUM('FSXN', 'FSXW', 'EBS') NOT NULL DEFAULT 'FSXN';
