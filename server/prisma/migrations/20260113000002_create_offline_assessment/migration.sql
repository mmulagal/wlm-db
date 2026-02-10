-- CreateTable
CREATE TABLE `offline_assessment` (
    `id` VARCHAR(40) NOT NULL,
    `account_id` VARCHAR(64) NOT NULL,
    `credentials_id` VARCHAR(80) NULL,
    `region` VARCHAR(30) NULL,
    `resource_id` VARCHAR(255) NOT NULL,
    `database_instance_id` VARCHAR(36) NOT NULL,
    `database_type` ENUM('mssql', 'pgsql', 'oracle') NOT NULL,
    `rawdata` JSON NOT NULL,
    `mapped_ontap_volumes` JSON NULL DEFAULT ('{}'),
    `assessment_results` JSON NULL DEFAULT ('{}'),
    `metadata` JSON NULL DEFAULT ('{}'),
    `created_time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `k_wlmdb_offline_assessment_account_id`(`account_id`),
    INDEX `k_wlmdb_offline_assessment_credentials_id`(`credentials_id`),
    INDEX `k_wlmdb_offline_assessment_resource_id`(`resource_id`),
    INDEX `k_wlmdb_offline_assessment_database_instance_id`(`database_instance_id`),
    INDEX `k_wlmdb_offline_assessment_created_time`(`created_time`),
    UNIQUE INDEX `uk_wlmdb_offline_assessment`(`account_id`, `resource_id`, `database_instance_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
