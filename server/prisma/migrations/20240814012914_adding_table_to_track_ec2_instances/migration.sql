-- CreateTable
CREATE TABLE `tracked_ec2` (
    `id` VARCHAR(40) NOT NULL,
    `instance_id` VARCHAR(30) NOT NULL,
    `account_id` VARCHAR(30) NOT NULL,
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
