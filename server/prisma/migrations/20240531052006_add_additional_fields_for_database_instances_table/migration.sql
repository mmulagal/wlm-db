/*
  Warnings:

  - You are about to drop the column `sql_instance_id` on the `database_instances` table. All the data in the column will be lost.
  - You are about to drop the column `sql_instance_name` on the `database_instances` table. All the data in the column will be lost.
  - You are about to alter the column `account_id` on the `database_instances` table. The data in that column could be lost. The data in that column will be cast from `VarChar(80)` to `VarChar(30)`.
  - A unique constraint covering the columns `[account_id,credentials_id,resource_id,database_instance_id]` on the table `database_instances` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `database_deployment_type` to the `database_instances` table without a default value. This is not possible if the table is not empty.
  - Added the required column `database_instance_id` to the `database_instances` table without a default value. This is not possible if the table is not empty.
  - Added the required column `database_instance_name` to the `database_instances` table without a default value. This is not possible if the table is not empty.
  - Added the required column `source` to the `database_instances` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `database_instances` DROP FOREIGN KEY `k_wlmdb_resource_account_id_credentials_id_resource_id`;

-- DropIndex
DROP INDEX `k_wlmdb_database_instances_sql_instance_name` ON `database_instances`;

-- DropIndex
DROP INDEX `uk_wlmdb_database_instances` ON `database_instances`;

-- AlterTable
ALTER TABLE `database_instances` DROP COLUMN `sql_instance_id`,
    DROP COLUMN `sql_instance_name`,
    ADD COLUMN `database_deployment_type` VARCHAR(16) NOT NULL,
    ADD COLUMN `database_instance_id` VARCHAR(36) NOT NULL,
    ADD COLUMN `database_instance_name` VARCHAR(16) NOT NULL,
    ADD COLUMN `fsx_svm_id` VARCHAR(36) NULL,
    ADD COLUMN `metadata` JSON NULL,
    ADD COLUMN `number_of_user_dbs_created` INTEGER NULL DEFAULT 0,
    ADD COLUMN `sandbox_created` BOOLEAN NULL DEFAULT false,
    ADD COLUMN `source` VARCHAR(16) NOT NULL,
    ADD COLUMN `storage_protocol` VARCHAR(16) NULL,
    MODIFY `account_id` VARCHAR(30) NOT NULL;

-- CreateIndex
CREATE INDEX `k_wlmdb_database_instances_database_instance_name` ON `database_instances`(`database_instance_name`);

-- CreateIndex
CREATE UNIQUE INDEX `uk_wlmdb_database_instances` ON `database_instances`(`account_id`, `credentials_id`, `resource_id`, `database_instance_id`);

-- AddForeignKey
ALTER TABLE `database_instances` ADD CONSTRAINT `k_wlmdb_resource_account_id_credentials_id_resource_id` FOREIGN KEY (`account_id`, `credentials_id`, `resource_id`) REFERENCES `resource`(`account_id`, `credentials_id`, `resource_id`) ON DELETE CASCADE ON UPDATE CASCADE;
