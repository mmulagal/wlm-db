-- CreateTable
CREATE TABLE `deployment` (
    `id` VARCHAR(191) NOT NULL,
    `deployment_id` VARCHAR(255) NOT NULL,
    `parent_deployment_id` VARCHAR(255) NULL,
    `deployment_name` VARCHAR(255) NOT NULL,
    `account_id` VARCHAR(80) NOT NULL,
    `cloud_provider_account_id` VARCHAR(80) NULL,
    `cloud_provider_name` VARCHAR(80) NULL,
    `region` VARCHAR(80) NOT NULL,
    `credentials_id` VARCHAR(80) NOT NULL,
    `deployment_status` ENUM('CREATE_COMPLETE', 'CREATE_IN_PROGRESS', 'CREATE_FAILED', 'DELETE_COMPLETE', 'DELETE_FAILED', 'DELETE_IN_PROGRESS', 'REVIEW_IN_PROGRESS', 'ROLLBACK_COMPLETE', 'ROLLBACK_FAILED', 'ROLLBACK_IN_PROGRESS', 'UPDATE_COMPLETE', 'UPDATE_COMPLETE_CLEANUP_IN_PROGRESS', 'UPDATE_IN_PROGRESS', 'UPDATE_ROLLBACK_COMPLETE', 'UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS', 'UPDATE_ROLLBACK_FAILED', 'UPDATE_ROLLBACK_IN_PROGRESS') NOT NULL,
    `deployment_status_reason` TEXT NULL,
    `start_time` DATETIME(0) NOT NULL,
    `end_time` DATETIME(0) NULL,
    `data` JSON NULL,

    INDEX `k_wlmdb_deployment_account_id`(`account_id`),
    INDEX `k_wlmdb_deployment_deployment_id`(`deployment_id`),
    UNIQUE INDEX `uk_wlmdb_deployment_account_id_deployment_id`(`account_id`, `deployment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `event` (
    `id` VARCHAR(191) NOT NULL,
    `event_id` VARCHAR(255) NOT NULL,
    `account_id` VARCHAR(255) NOT NULL,
    `deployment_id` VARCHAR(255) NOT NULL,
    `deployment_name` VARCHAR(255) NOT NULL,
    `event_status` ENUM('CREATE_COMPLETE', 'CREATE_IN_PROGRESS', 'CREATE_FAILED', 'DELETE_COMPLETE', 'DELETE_FAILED', 'DELETE_IN_PROGRESS', 'REVIEW_IN_PROGRESS', 'ROLLBACK_COMPLETE', 'ROLLBACK_FAILED', 'ROLLBACK_IN_PROGRESS', 'UPDATE_COMPLETE', 'UPDATE_COMPLETE_CLEANUP_IN_PROGRESS', 'UPDATE_IN_PROGRESS', 'UPDATE_ROLLBACK_COMPLETE', 'UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS', 'UPDATE_ROLLBACK_FAILED', 'UPDATE_ROLLBACK_IN_PROGRESS') NOT NULL,
    `event_status_reason` TEXT NULL,
    `resource_type` VARCHAR(255) NULL,
    `time` DATETIME(0) NOT NULL,
    `data` JSON NULL,

    INDEX `k_wlmdb_event_event_id`(`event_id`),
    INDEX `k_wlmdb_event_deployment_id`(`deployment_id`),
    UNIQUE INDEX `uk_wlmdb_event_deployment_id_event_id`(`deployment_id`, `event_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `resource` (
    `id` VARCHAR(191) NOT NULL,
    `account_id` VARCHAR(80) NOT NULL,
    `resource_id` VARCHAR(255) NOT NULL,
    `resource_name` VARCHAR(255) NULL,
    `resource_type` VARCHAR(20) NOT NULL,
    `co_relation_id` VARCHAR(20) NULL,
    `cloud_provider_account_id` VARCHAR(80) NULL,
    `cloud_provider_name` VARCHAR(80) NULL,
    `region` VARCHAR(80) NULL,
    `metadata` JSON NULL,

    INDEX `k_wlmdb_resource_account_id`(`account_id`),
    INDEX `k_wlmdb_resource_resource_id`(`resource_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `config` (
    `id` VARCHAR(191) NOT NULL,
    `account_id` VARCHAR(80) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `user` VARCHAR(255) NOT NULL,
    `creation_time` DATETIME(0) NOT NULL,
    `data` JSON NULL,

    INDEX `k_wlmdb_config_account_id`(`account_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `event` ADD CONSTRAINT `fk_wlmdb_event_deployment_id` FOREIGN KEY (`account_id`, `deployment_id`) REFERENCES `deployment`(`account_id`, `deployment_id`) ON DELETE CASCADE ON UPDATE RESTRICT;
