-- CreateTable
CREATE TABLE `host_config_data` (
    `id` VARCHAR(40) NOT NULL,
    `account_id` VARCHAR(30) NOT NULL,
    `credentials_id` VARCHAR(80) NOT NULL,
    `region` VARCHAR(30) NOT NULL,
    `resource_id` VARCHAR(255) NOT NULL,
    `database_instance_id` VARCHAR(36) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_updated` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `config_data` JSON NULL,
    `config_data_type` VARCHAR(255) NOT NULL DEFAULT 'CONFIG',

    INDEX `k_wlmdb_host_config_data_account_id`(`account_id`),
    INDEX `k_wlmdb_host_config_data_credentials_id`(`credentials_id`),
    INDEX `k_wlmdb_host_config_data_resource_id`(`resource_id`),
    UNIQUE INDEX `uk_wlmdb_host_config_data`(`account_id`, `credentials_id`, `resource_id`, `database_instance_id`, `timestamp`, `config_data_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
