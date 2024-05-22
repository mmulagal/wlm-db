-- CreateTable
CREATE TABLE `databaseInstances` (
    `id`                VARCHAR(191) NOT NULL,
    `account_id`        VARCHAR(80)  NOT NULL,
    `credentials_id`    VARCHAR(80)  NOT NULL,
    `resource_id`       VARCHAR(255) NOT NULL,
    `instance_id`       VARCHAR(255) NOT NULL,
    `instance_name`     VARCHAR(255) NOT NULL,
    `fsxn_id`           VARCHAR(20)  NOT NULL,
    `is_default`        BOOLEAN      NOT NULL DEFAULT false,
    `manage_start_time` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_update_time`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `i_wlmdb_databaseInstances_account_id`(`account_id`),
    INDEX `i_wlmdb_databaseInstances_credentials_id`(`credentials_id`),
    INDEX `i_wlmdb_databaseInstances_resource_id`(`resource_id`),
    INDEX `i_wlmdb_databaseInstances_instance_name`(`instance_name`),
    UNIQUE INDEX `ui_wlmdb_databaseInstances`(`account_id`, `credentials_id`, `resource_id`, `instance_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;