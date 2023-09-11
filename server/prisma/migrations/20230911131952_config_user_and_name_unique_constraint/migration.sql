/*
  Warnings:

  - You are about to alter the column `account_id` on the `config` table. The data in that column could be lost. The data in that column will be cast from `VarChar(80)` to `VarChar(30)`.
  - You are about to alter the column `account_id` on the `deployment` table. The data in that column could be lost. The data in that column will be cast from `VarChar(80)` to `VarChar(30)`.
  - You are about to alter the column `cloud_provider_name` on the `deployment` table. The data in that column could be lost. The data in that column will be cast from `VarChar(80)` to `VarChar(30)`.
  - You are about to alter the column `region` on the `deployment` table. The data in that column could be lost. The data in that column will be cast from `VarChar(80)` to `VarChar(30)`.
  - You are about to alter the column `account_id` on the `event` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(30)`.
  - You are about to alter the column `account_id` on the `resource` table. The data in that column could be lost. The data in that column will be cast from `VarChar(80)` to `VarChar(30)`.
  - You are about to alter the column `cloud_provider_name` on the `resource` table. The data in that column could be lost. The data in that column will be cast from `VarChar(80)` to `VarChar(30)`.
  - You are about to alter the column `region` on the `resource` table. The data in that column could be lost. The data in that column will be cast from `VarChar(80)` to `VarChar(30)`.
  - A unique constraint covering the columns `[name,user]` on the table `config` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `event` DROP FOREIGN KEY `fk_wlmdb_event_deployment_id`;

-- AlterTable
ALTER TABLE `config` MODIFY `account_id` VARCHAR(30) NOT NULL;

-- AlterTable
ALTER TABLE `deployment` MODIFY `account_id` VARCHAR(30) NOT NULL,
    MODIFY `cloud_provider_name` VARCHAR(30) NULL,
    MODIFY `region` VARCHAR(30) NOT NULL;

-- AlterTable
ALTER TABLE `event` MODIFY `account_id` VARCHAR(30) NOT NULL;

-- AlterTable
ALTER TABLE `resource` MODIFY `account_id` VARCHAR(30) NOT NULL,
    MODIFY `cloud_provider_name` VARCHAR(30) NULL,
    MODIFY `region` VARCHAR(30) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `uk_wlmdb_config_name_user` ON `config`(`name`, `user`);

-- AddForeignKey
ALTER TABLE `event` ADD CONSTRAINT `fk_wlmdb_event_deployment_id` FOREIGN KEY (`account_id`, `deployment_id`) REFERENCES `deployment`(`account_id`, `deployment_id`) ON DELETE CASCADE ON UPDATE RESTRICT;
