/*
  Warnings:

  - A unique constraint covering the columns `[resource_id,account_id]` on the table `resource` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `uk_wlmdb_resource_resource_id_account_id` ON `resource`(`resource_id`, `account_id`);
