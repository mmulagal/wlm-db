-- DropForeignKey
ALTER TABLE `database_instance_config_data` DROP FOREIGN KEY `k_wlmdb_database_instances_unique_criteria`;

-- DropForeignKey
ALTER TABLE `database_instances` DROP FOREIGN KEY `k_wlmdb_resource_account_id_credentials_id_region_resource_id`;

-- DropForeignKey
ALTER TABLE `event` DROP FOREIGN KEY `fk_wlmdb_event_deployment_id`;

-- AlterTable
ALTER TABLE `database_instance_config_data` MODIFY `account_id` VARCHAR(64) NOT NULL;

-- AlterTable
ALTER TABLE `database_instances` MODIFY `account_id` VARCHAR(64) NOT NULL;

-- AlterTable
ALTER TABLE `deployment` MODIFY `account_id` VARCHAR(64) NOT NULL;

-- AlterTable
ALTER TABLE `event` MODIFY `account_id` VARCHAR(64) NOT NULL;

-- AlterTable
ALTER TABLE `job` MODIFY `account_id` VARCHAR(64) NOT NULL;

-- AlterTable
ALTER TABLE `resource` MODIFY `account_id` VARCHAR(64) NOT NULL;

-- AlterTable
ALTER TABLE `tracked_ec2` MODIFY `account_id` VARCHAR(64) NOT NULL;

-- AddForeignKey
ALTER TABLE `event` ADD CONSTRAINT `fk_wlmdb_event_deployment_id` FOREIGN KEY (`account_id`, `deployment_id`) REFERENCES `deployment`(`account_id`, `deployment_id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `database_instances` ADD CONSTRAINT `k_wlmdb_resource_account_id_credentials_id_region_resource_id` FOREIGN KEY (`account_id`, `credentials_id`, `region`, `resource_id`) REFERENCES `resource`(`account_id`, `credentials_id`, `region`, `resource_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `database_instance_config_data` ADD CONSTRAINT `k_wlmdb_database_instances_unique_criteria` FOREIGN KEY (`account_id`, `credentials_id`, `resource_id`, `database_instance_id`) REFERENCES `database_instances`(`account_id`, `credentials_id`, `resource_id`, `database_instance_id`) ON DELETE CASCADE ON UPDATE CASCADE;
