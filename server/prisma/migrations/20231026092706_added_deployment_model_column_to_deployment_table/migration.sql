-- AlterTable
ALTER TABLE `deployment` ADD COLUMN `deployment_model` ENUM('FCI', 'Standalone') NULL;
