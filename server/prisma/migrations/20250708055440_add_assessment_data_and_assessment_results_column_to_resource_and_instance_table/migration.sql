-- AlterTable
ALTER TABLE `database_instances` ADD COLUMN `assessment_results` JSON NULL;

-- AlterTable
ALTER TABLE `resource` ADD COLUMN `assessment_data` JSON NULL,
    ADD COLUMN `assessment_results` JSON NULL;
