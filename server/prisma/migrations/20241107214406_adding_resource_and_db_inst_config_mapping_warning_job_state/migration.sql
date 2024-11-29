-- AlterTable
ALTER TABLE `job` MODIFY `status` ENUM('IN_PROGRESS', 'COMPLETED', 'FAILED', 'WARNING') NOT NULL;

-- AddForeignKey
ALTER TABLE `database_instance_config_data` ADD CONSTRAINT `k_wlmdb_database_instance_config_data_resource_unique_criteria` FOREIGN KEY (`account_id`, `credentials_id`, `region`, `resource_id`) REFERENCES `resource`(`account_id`, `credentials_id`, `region`, `resource_id`) ON DELETE CASCADE ON UPDATE CASCADE;
