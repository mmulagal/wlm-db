-- DropIndex
DROP INDEX `k_wlmdb_resource_account_id_credentials_id_resource_id` ON `resource`;

-- AlterTable
ALTER TABLE `job` MODIFY `type` ENUM('DEPLOYMENT', 'CREATE_RESOURCE', 'PREPARE_RESOURCE', 'SANDBOX', 'ASSESSMENT') NOT NULL;
