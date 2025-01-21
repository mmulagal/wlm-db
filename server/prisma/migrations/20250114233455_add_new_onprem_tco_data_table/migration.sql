-- AlterTable
ALTER TABLE `database_instances` MODIFY `database_deployment_type` ENUM('Standalone', 'FCI', 'AOAG') NOT NULL;

-- CreateTable
CREATE TABLE `onprem_tco_reports` (
    `id` VARCHAR(40) NOT NULL,
    `resource_id` VARCHAR(255) NOT NULL,
    `account_id` VARCHAR(64) NOT NULL,
    `database_type` ENUM('mssql', 'pgsql') NOT NULL DEFAULT 'mssql',
    `database_deployment_type` ENUM('Standalone', 'FCI', 'AOAG') NOT NULL,
    `host_config` JSON NULL,
    `database_instances_data` JSON NULL,
    `assessment_data` JSON NULL,
    `creation_time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `version` VARCHAR(64) NOT NULL,

    INDEX `k_wlmdb_onprem_tco_reports_account_id`(`account_id`),
    INDEX `k_wlmdb_onprem_tco_reports_resource_id`(`resource_id`),
    UNIQUE INDEX `uk_wlmdb_onprem_tco_reports`(`account_id`, `resource_id`, `creation_time`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
