/*
  Warnings:

  - You are about to drop the column `sql_instance_id` on the `database_instances` table. All the data in the column will be lost.
  - You are about to drop the column `sql_instance_name` on the `database_instances` table. All the data in the column will be lost.
  - You are about to alter the column `account_id` on the `database_instances` table. The data in that column could be lost. The data in that column will be cast from `VarChar(80)` to `VarChar(30)`.
  - A unique constraint covering the columns `[account_id,credentials_id,resource_id,database_instance_id]` on the table `database_instances` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[resource_id,account_id,credentials_id,region]` on the table `resource` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `database_deployment_type` to the `database_instances` table without a default value. This is not possible if the table is not empty.
  - Added the required column `database_instance_id` to the `database_instances` table without a default value. This is not possible if the table is not empty.
  - Added the required column `database_instance_name` to the `database_instances` table without a default value. This is not possible if the table is not empty.
  - Added the required column `database_type` to the `database_instances` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fsx_svm_id` to the `database_instances` table without a default value. This is not possible if the table is not empty.
  - Added the required column `region` to the `database_instances` table without a default value. This is not possible if the table is not empty.
  - Added the required column `source` to the `database_instances` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `database_instances` DROP FOREIGN KEY `k_wlmdb_resource_account_id_credentials_id_resource_id`;

-- DropIndex
DROP INDEX `k_wlmdb_database_instances_sql_instance_name` ON `database_instances`;

-- DropIndex
DROP INDEX `uk_wlmdb_database_instances` ON `database_instances`;

-- DropIndex
DROP INDEX `k_wlmdb_resource_account_id_credentials_id_resource_id` ON `resource`;

-- DropIndex
DROP INDEX `uk_wlmdb_resource_resource_id_account_id_credentials_id` ON `resource`;

-- AlterTable
ALTER TABLE `database_instances` DROP COLUMN `sql_instance_id`,
    DROP COLUMN `sql_instance_name`,
    ADD COLUMN `database_deployment_type` ENUM('Standalone', 'FCI') NOT NULL,
    ADD COLUMN `database_instance_id` VARCHAR(36) NOT NULL,
    ADD COLUMN `database_instance_name` VARCHAR(16) NOT NULL,
    ADD COLUMN `database_type` VARCHAR(16) NOT NULL,
    ADD COLUMN `fsx_svm_id` JSON NOT NULL,
    ADD COLUMN `metadata` JSON NULL,
    ADD COLUMN `number_of_user_dbs_created` INTEGER NULL DEFAULT 0,
    ADD COLUMN `region` VARCHAR(30) NOT NULL,
    ADD COLUMN `sandbox_created` BOOLEAN NULL DEFAULT false,
    ADD COLUMN `source` ENUM('deployment', 'discovery') NOT NULL,
    ADD COLUMN `storage_protocol` ENUM('SMB', 'iSCSI') NULL DEFAULT 'iSCSI',
    MODIFY `account_id` VARCHAR(30) NOT NULL;

-- CreateIndex
CREATE INDEX `k_wlmdb_database_instances_database_instance_name` ON `database_instances`(`database_instance_name`);

-- CreateIndex
CREATE UNIQUE INDEX `uk_wlmdb_database_instances` ON `database_instances`(`account_id`, `credentials_id`, `resource_id`, `database_instance_id`);

-- CreateIndex
CREATE INDEX `k_wlmdb_resource_account_id_credentials_id_region_resource_id` ON `resource`(`account_id`, `credentials_id`, `region`, `resource_id`);

-- CreateIndex
CREATE UNIQUE INDEX `uk_wlmdb_resource_resource_id_account_id_credentials_id_region` ON `resource`(`resource_id`, `account_id`, `credentials_id`, `region`);

-- AddForeignKey
ALTER TABLE `database_instances` ADD CONSTRAINT `k_wlmdb_resource_account_id_credentials_id_region_resource_id` FOREIGN KEY (`account_id`, `credentials_id`, `region`, `resource_id`) REFERENCES `resource`(`account_id`, `credentials_id`, `region`, `resource_id`) ON DELETE CASCADE ON UPDATE CASCADE;
