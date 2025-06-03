-- CreateTable
CREATE TABLE `logs_analysis_reports` (
    `id` VARCHAR(40) NOT NULL,
    `credentials_id` VARCHAR(80) NOT NULL,
    `resource_id` VARCHAR(255) NOT NULL,
    `database_instance_id` VARCHAR(36) NOT NULL,
    `job_id` VARCHAR(40) NOT NULL,
    `account_id` VARCHAR(64) NOT NULL,
    `database_type` ENUM('mssql', 'pgsql') NOT NULL DEFAULT 'mssql',
    `logs_analysis_data` JSON NULL,
    `creation_time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `version` VARCHAR(64) NOT NULL,

    INDEX `k_wlmdb_logs_analysis_reports_account_id`(`account_id`),
    INDEX `k_wlmdb_logs_analysis_reports_resource_id`(`resource_id`),
    UNIQUE INDEX `uk_wlmdb_logs_analysis_reports`(`account_id`, `resource_id`, `database_instance_id`, `job_id`),
    UNIQUE INDEX `uk_wlmdb_logs_analysis_reports_job_id`(`job_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `logs_analysis_reports` ADD CONSTRAINT `k_wlmdb_database_instances_unique_criteria_logs_analysis_reports` FOREIGN KEY (`account_id`, `credentials_id`, `resource_id`, `database_instance_id`) REFERENCES `database_instances`(`account_id`, `credentials_id`, `resource_id`, `database_instance_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `logs_analysis_reports` ADD CONSTRAINT `k_wlmdb_job_unique_criteria_logs_analysis_reports` FOREIGN KEY (`job_id`) REFERENCES `job`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
