/*
  Warnings:

  - You are about to alter the column `fsx_svm_id` on the `database_instances` table. The data in that column could be lost. The data in that column will be cast from `VarChar(36)` to `Json`.
  - You are about to alter the column `storage_protocol` on the `database_instances` table. The data in that column could be lost. The data in that column will be cast from `VarChar(16)` to `Enum(EnumId(6))`.
  - A unique constraint covering the columns `[resource_id,account_id,credentials_id,region]` on the table `resource` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `database_type` to the `database_instances` table without a default value. This is not possible if the table is not empty.
  - Added the required column `region` to the `database_instances` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `database_instances` DROP FOREIGN KEY `k_wlmdb_resource_account_id_credentials_id_resource_id`;

-- DropIndex
DROP INDEX `k_wlmdb_resource_account_id_credentials_id_resource_id` ON `resource`;

-- DropIndex
DROP INDEX `uk_wlmdb_resource_resource_id_account_id_credentials_id` ON `resource`;

-- AlterTable
ALTER TABLE `database_instances` ADD COLUMN `database_type` VARCHAR(16) NOT NULL,
    ADD COLUMN `region` VARCHAR(30) NOT NULL,
    MODIFY `fsx_svm_id` JSON NULL,
    MODIFY `storage_protocol` ENUM('SMB', 'iSCSI') NULL DEFAULT 'iSCSI';

-- CreateIndex
CREATE INDEX `k_wlmdb_resource_account_id_credentials_id_region_resource_id` ON `resource`(`account_id`, `credentials_id`, `region`, `resource_id`);

-- CreateIndex
CREATE UNIQUE INDEX `uk_wlmdb_resource_resource_id_account_id_credentials_id_region` ON `resource`(`resource_id`, `account_id`, `credentials_id`, `region`);

-- AddForeignKey
ALTER TABLE `database_instances` ADD CONSTRAINT `k_wlmdb_resource_account_id_credentials_id_region_resource_id` FOREIGN KEY (`account_id`, `credentials_id`, `region`, `resource_id`) REFERENCES `resource`(`account_id`, `credentials_id`, `region`, `resource_id`) ON DELETE CASCADE ON UPDATE CASCADE;
