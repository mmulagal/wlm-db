/*
  Warnings:

  - You are about to alter the column `account_id` on the `database_instances` table. The data in that column could be lost. The data in that column will be cast from `VarChar(80)` to `VarChar(30)`.
  - You are about to alter the column `sql_instance_id` on the `database_instances` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(36)`.
  - You are about to alter the column `sql_instance_name` on the `database_instances` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(16)`.
  - Added the required column `source` to the `database_instances` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sql_deployment_type` to the `database_instances` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `database_instances` DROP FOREIGN KEY `k_wlmdb_resource_account_id_credentials_id_resource_id`;

-- AlterTable
ALTER TABLE `database_instances` ADD COLUMN `fsx_svm_id` VARCHAR(36) NULL,
    ADD COLUMN `metadata` JSON NULL,
    ADD COLUMN `number_of_user_dbs_created` INTEGER NULL DEFAULT 0,
    ADD COLUMN `sandbox_created` BOOLEAN NULL DEFAULT false,
    ADD COLUMN `source` VARCHAR(16) NOT NULL,
    ADD COLUMN `sql_deployment_type` VARCHAR(16) NOT NULL,
    ADD COLUMN `storage_protocol` VARCHAR(16) NULL,
    MODIFY `account_id` VARCHAR(30) NOT NULL,
    MODIFY `sql_instance_id` VARCHAR(36) NOT NULL,
    MODIFY `sql_instance_name` VARCHAR(16) NOT NULL;

-- AddForeignKey
ALTER TABLE `database_instances` ADD CONSTRAINT `k_wlmdb_resource_account_id_credentials_id_resource_id` FOREIGN KEY (`account_id`, `credentials_id`, `resource_id`) REFERENCES `resource`(`account_id`, `credentials_id`, `resource_id`) ON DELETE CASCADE ON UPDATE CASCADE;
