-- CreateTable
CREATE TABLE `job` (
    `id` VARCHAR(40) NOT NULL,
    `account_id` VARCHAR(30) NOT NULL,
    `type` ENUM('DEPLOYMENT') NOT NULL,
    `status` ENUM('IN_PROGRESS', 'COMPLETED', 'FAILED') NOT NULL,
    `resource_name` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` VARCHAR(255) NULL,
    `error` TEXT NULL,
    `start_time` DATETIME(0) NOT NULL,
    `end_time` DATETIME(0) NULL,
    `parent_job_id` VARCHAR(40) NULL,
    `initiator` VARCHAR(80) NOT NULL DEFAULT 'SYSTEM',
    `last_update_time` DATETIME(0) NULL,

    INDEX `k_wlmdb_job_account_id`(`account_id`),
    INDEX `k_wlmdb_job_parent_job_id`(`parent_job_id`),
    INDEX `k_wlmdb_job_start_time`(`start_time`),
    UNIQUE INDEX `job_account_id_name_resource_name_initiator_start_time_key`(`account_id`, `name`, `resource_name`, `initiator`, `start_time`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
