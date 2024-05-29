/*
  Warnings:

  - You are about to alter the column `account_id` on the `database_instances` table. The data in that column could be lost. The data in that column will be cast from `VarChar(80)` to `VarChar(30)`.
  - You are about to alter the column `sql_instance_id` on the `database_instances` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(36)`.
  - You are about to alter the column `sql_instance_name` on the `database_instances` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(16)`.

*/
-- DropForeignKey
ALTER TABLE `database_instances` DROP FOREIGN KEY `k_wlmdb_resource_account_id_credentials_id_resource_id`;

-- AlterTable
ALTER TABLE `database_instances` ADD COLUMN `metadata` JSON NULL,
    MODIFY `account_id` VARCHAR(30) NOT NULL,
    MODIFY `sql_instance_id` VARCHAR(36) NOT NULL,
    MODIFY `sql_instance_name` VARCHAR(16) NOT NULL;

-- AddForeignKey
ALTER TABLE `database_instances` ADD CONSTRAINT `k_wlmdb_resource_account_id_credentials_id_resource_id` FOREIGN KEY (`account_id`, `credentials_id`, `resource_id`) REFERENCES `resource`(`account_id`, `credentials_id`, `resource_id`) ON DELETE CASCADE ON UPDATE CASCADE;
