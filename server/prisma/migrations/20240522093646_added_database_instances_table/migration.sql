-- Create index to support foreign key relationship between 'database_instances' and 'resource' tables.
CREATE INDEX `k_wlmdb_resource_account_id_credentials_id_resource_id` ON `resource`(`account_id`, `credentials_id`, `resource_id`);

-- Create table for database instance details
CREATE TABLE `database_instances` (
    `id`                VARCHAR(191) NOT NULL,
    `account_id`        VARCHAR(80)  NOT NULL,
    `credentials_id`    VARCHAR(80)  NOT NULL,
    `resource_id`       VARCHAR(255) NOT NULL,
    `sql_instance_id`   VARCHAR(255) NOT NULL,
    `sql_instance_name` VARCHAR(255) NOT NULL,
    `fsxn_ids`          VARCHAR(255) NOT NULL,
    `is_default`        BOOLEAN      NOT NULL DEFAULT false,
    `created_time`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_time`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `k_wlmdb_database_instances_account_id`(`account_id`),
    INDEX `k_wlmdb_database_instances_credentials_id`(`credentials_id`),
    INDEX `k_wlmdb_database_instances_resource_id`(`resource_id`),
    INDEX `k_wlmdb_database_instances_sql_instance_name`(`sql_instance_name`),
    UNIQUE INDEX `uk_wlmdb_database_instances`(`account_id`, `credentials_id`, `resource_id`, `sql_instance_id`),
    PRIMARY KEY (`id`),
    CONSTRAINT `k_wlmdb_resource_account_id_credentials_id_resource_id` FOREIGN KEY (`account_id`, `credentials_id`, `resource_id`) REFERENCES `resource`(`account_id`, `credentials_id`, `resource_id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;