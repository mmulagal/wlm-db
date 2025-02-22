-- CreateTable
CREATE TABLE `deployment` (
    `id` VARCHAR(191) NOT NULL,
    `deployment_id` VARCHAR(255) NOT NULL,
    `parent_deployment_id` VARCHAR(255) NULL,
    `deployment_name` VARCHAR(255) NOT NULL,
    `account_id` VARCHAR(64) NOT NULL,
    `cloud_provider_account_id` VARCHAR(80) NULL,
    `cloud_provider_name` VARCHAR(30) NULL,
    `region` VARCHAR(30) NOT NULL,
    `credentials_id` VARCHAR(80) NOT NULL,
    `deployment_status` ENUM('CREATE_COMPLETE', 'CREATE_IN_PROGRESS', 'CREATE_FAILED', 'DELETE_COMPLETE', 'DELETE_FAILED', 'DELETE_IN_PROGRESS', 'REVIEW_IN_PROGRESS', 'ROLLBACK_COMPLETE', 'ROLLBACK_FAILED', 'ROLLBACK_IN_PROGRESS', 'UPDATE_COMPLETE', 'UPDATE_COMPLETE_CLEANUP_IN_PROGRESS', 'UPDATE_IN_PROGRESS', 'UPDATE_FAILED', 'UPDATE_ROLLBACK_COMPLETE', 'UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS', 'UPDATE_ROLLBACK_FAILED', 'UPDATE_ROLLBACK_IN_PROGRESS', 'DELETE_SKIPPED', 'IMPORT_COMPLETE', 'IMPORT_IN_PROGRESS', 'IMPORT_ROLLBACK_COMPLETE', 'IMPORT_ROLLBACK_FAILED', 'IMPORT_ROLLBACK_IN_PROGRESS') NOT NULL,
    `deployment_model` ENUM('FCI', 'Standalone') NULL,
    `deployment_status_reason` TEXT NULL,
    `start_time` DATETIME(3) NOT NULL,
    `end_time` DATETIME(3) NULL,
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
    `account_id` VARCHAR(64) NOT NULL,
    `deployment_id` VARCHAR(255) NOT NULL,
    `deployment_name` VARCHAR(255) NOT NULL,
    `event_status` ENUM('CREATE_COMPLETE', 'CREATE_IN_PROGRESS', 'CREATE_FAILED', 'DELETE_COMPLETE', 'DELETE_FAILED', 'DELETE_IN_PROGRESS', 'REVIEW_IN_PROGRESS', 'ROLLBACK_COMPLETE', 'ROLLBACK_FAILED', 'ROLLBACK_IN_PROGRESS', 'UPDATE_COMPLETE', 'UPDATE_COMPLETE_CLEANUP_IN_PROGRESS', 'UPDATE_IN_PROGRESS', 'UPDATE_FAILED', 'UPDATE_ROLLBACK_COMPLETE', 'UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS', 'UPDATE_ROLLBACK_FAILED', 'UPDATE_ROLLBACK_IN_PROGRESS', 'DELETE_SKIPPED', 'IMPORT_COMPLETE', 'IMPORT_IN_PROGRESS', 'IMPORT_ROLLBACK_COMPLETE', 'IMPORT_ROLLBACK_FAILED', 'IMPORT_ROLLBACK_IN_PROGRESS') NOT NULL,
    `event_status_reason` TEXT NULL,
    `resource_type` VARCHAR(255) NULL,
    `time` DATETIME(3) NOT NULL,
    `data` JSON NULL,

    INDEX `k_wlmdb_event_event_id`(`event_id`),
    INDEX `k_wlmdb_event_deployment_id`(`deployment_id`),
    UNIQUE INDEX `uk_wlmdb_event_deployment_id_event_id`(`deployment_id`, `event_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `resource` (
    `id` VARCHAR(191) NOT NULL,
    `account_id` VARCHAR(64) NOT NULL,
    `credentials_id` VARCHAR(80) NOT NULL DEFAULT '',
    `storage_type` ENUM('FSXN', 'FSXW', 'EBS') NOT NULL DEFAULT 'FSXN',
    `resource_id` VARCHAR(255) NOT NULL,
    `resource_name` VARCHAR(255) NULL,
    `resource_type` VARCHAR(20) NOT NULL,
    `co_relation_id` VARCHAR(20) NULL,
    `cloud_provider_account_id` VARCHAR(80) NULL,
    `cloud_provider_name` VARCHAR(30) NULL,
    `region` VARCHAR(30) NULL,
    `metadata` JSON NULL,
 
    INDEX `k_wlmdb_resource_account_id`(`account_id`),
    INDEX `k_wlmdb_resource_resource_id`(`resource_id`),
    UNIQUE INDEX `uk_wlmdb_resource_account_id_credentials_id_region_resource_id`(`account_id`, `credentials_id`, `region`, `resource_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `config` (
    `id` VARCHAR(191) NOT NULL,
    `account_id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `user` VARCHAR(255) NOT NULL,
    `creation_time` DATETIME(3) NOT NULL,
    `data` JSON NULL,
    `modified_time` DATETIME(3) NULL,
    `database_type` ENUM('mssql', 'pgsql') NOT NULL DEFAULT 'mssql',

    INDEX `k_wlmdb_config_account_id`(`account_id`),
    UNIQUE INDEX `uk_wlmdb_config_account_id_name_user`(`account_id`, `name`, `user`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job` (
    `id` VARCHAR(40) NOT NULL,
    `account_id` VARCHAR(64) NOT NULL,
    `credentials_id` VARCHAR(80) NOT NULL,
    `region` VARCHAR(30) NOT NULL,
    `type` ENUM('DEPLOYMENT', 'CREATE_RESOURCE', 'PREPARE_RESOURCE', 'SANDBOX', 'ASSESSMENT', 'OPTIMIZATION') NOT NULL,
    `status` ENUM('IN_PROGRESS', 'COMPLETED', 'FAILED', 'WARNING') NOT NULL,
    `resource_name` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` VARCHAR(2048) NULL,
    `error` TEXT NULL,
    `start_time` DATETIME(3) NOT NULL,
    `end_time` DATETIME(3) NULL,
    `parent_job_id` VARCHAR(40) NULL,
    `initiator` VARCHAR(80) NOT NULL DEFAULT 'SYSTEM',
    `last_update_time` DATETIME(3) NULL,

    INDEX `k_wlmdb_job_id`(`id`),
    INDEX `k_wlmdb_job_account_id`(`account_id`),
    INDEX `k_wlmdb_job_parent_job_id`(`parent_job_id`),
    INDEX `k_wlmdb_job_start_time`(`start_time`),
    UNIQUE INDEX `job_account_id_name_resource_name_initiator_start_time_key`(`account_id`, `name`, `resource_name`, `initiator`, `start_time`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `database_instances` (
    `id` VARCHAR(191) NOT NULL,
    `account_id` VARCHAR(64) NOT NULL,
    `credentials_id` VARCHAR(80) NOT NULL,
    `region` VARCHAR(30) NOT NULL,
    `resource_id` VARCHAR(255) NOT NULL,
    `database_instance_id` VARCHAR(36) NOT NULL,
    `database_instance_name` VARCHAR(36) NOT NULL,
    `fsxn_ids` VARCHAR(255) NOT NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `database_deployment_type` ENUM('Standalone', 'FCI') NOT NULL,
    `database_type` VARCHAR(16) NOT NULL,
    `created_time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `source` ENUM('deployment', 'discovery') NOT NULL,
    `number_of_user_dbs_created` INTEGER NULL DEFAULT 0,
    `sandbox_created` BOOLEAN NULL DEFAULT false,
    `storage_protocol` VARCHAR(30) NULL,
    `fsx_svm_id` JSON NOT NULL,
    `metadata` JSON NULL,

    INDEX `k_wlmdb_database_instances_account_id`(`account_id`),
    INDEX `k_wlmdb_database_instances_credentials_id`(`credentials_id`),
    INDEX `k_wlmdb_database_instances_resource_id`(`resource_id`),
    INDEX `k_wlmdb_database_instances_database_instance_name`(`database_instance_name`),
    UNIQUE INDEX `uk_wlmdb_database_instances`(`account_id`, `credentials_id`, `resource_id`, `database_instance_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tracked_ec2` (
    `id` VARCHAR(40) NOT NULL,
    `instance_id` VARCHAR(30) NOT NULL,
    `account_id` VARCHAR(64) NOT NULL,
    `credentials_id` VARCHAR(80) NOT NULL,
    `region` VARCHAR(30) NOT NULL,
    `feature` VARCHAR(255) NOT NULL,
    `cloud_provider_account_id` VARCHAR(80) NOT NULL,
    `last_updated` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `k_wlmdb_tracked_ec2_instance_id`(`instance_id`),
    INDEX `k_wlmdb_tracked_ec2_account_id`(`account_id`),
    UNIQUE INDEX `uk_wlmdb_tracked_ec2`(`instance_id`, `credentials_id`, `account_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `database_instance_config_data` (
    `id` VARCHAR(40) NOT NULL,
    `account_id` VARCHAR(64) NOT NULL,
    `credentials_id` VARCHAR(80) NOT NULL,
    `region` VARCHAR(30) NOT NULL,
    `resource_id` VARCHAR(255) NOT NULL,
    `database_instance_id` VARCHAR(36) NOT NULL,
    `creation_time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_updated` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `config_data` JSON NULL,
    `config_data_type` VARCHAR(255) NOT NULL DEFAULT 'CONFIG',

    INDEX `k_wlmdb_database_instance_config_data_account_id`(`account_id`),
    INDEX `k_wlmdb_database_instance_config_data_credentials_id`(`credentials_id`),
    INDEX `k_wlmdb_database_instance_config_data_resource_id`(`resource_id`),
    UNIQUE INDEX `uk_wlmdb_database_instance_config_data`(`account_id`, `credentials_id`, `region`, `database_instance_id`, `creation_time`, `config_data_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `event` ADD CONSTRAINT `fk_wlmdb_event_deployment_id` FOREIGN KEY (`account_id`, `deployment_id`) REFERENCES `deployment`(`account_id`, `deployment_id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `database_instances` ADD CONSTRAINT `k_wlmdb_resource_account_id_credentials_id_region_resource_id` FOREIGN KEY (`account_id`, `credentials_id`, `region`, `resource_id`) REFERENCES `resource`(`account_id`, `credentials_id`, `region`, `resource_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `database_instance_config_data` ADD CONSTRAINT `k_wlmdb_database_instances_unique_criteria` FOREIGN KEY (`account_id`, `credentials_id`, `resource_id`, `database_instance_id`) REFERENCES `database_instances`(`account_id`, `credentials_id`, `resource_id`, `database_instance_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `database_instance_config_data` ADD CONSTRAINT `k_wlmdb_database_instance_config_data_resource_unique_criteria` FOREIGN KEY (`account_id`, `credentials_id`, `region`, `resource_id`) REFERENCES `resource`(`account_id`, `credentials_id`, `region`, `resource_id`) ON DELETE CASCADE ON UPDATE CASCADE;

