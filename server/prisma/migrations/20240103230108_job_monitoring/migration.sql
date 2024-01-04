-- CreateTable
CREATE TABLE `job` (
    `id` VARCHAR(191) NOT NULL,
    `account_id` VARCHAR(80) NOT NULL,
    `type` VARCHAR(80) NOT NULL,
    `status` ENUM('IN_PROGRESS', 'COMPLETED', 'FAILED') NOT NULL,
    `resource_name` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` VARCHAR(255) NULL,
    `error` TEXT NULL,
    `start_time` DATETIME(0) NOT NULL,
    `end_time` DATETIME(0) NULL,
    `parent_job_id` VARCHAR(80) NULL,
    `initiator` VARCHAR(80) NULL DEFAULT 'SYSTEM',

    INDEX `k_wlmdb_job_account_id`(`account_id`),
    INDEX `k_wlmdb_job_parent_job_id`(`parent_job_id`),
    INDEX `k_wlmdb_job_start_time`(`start_time`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
