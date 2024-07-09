/*
  Warnings:

  - You are about to alter the column `storage_protocol` on the `database_instances` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(8))` to `VarChar(30)`.

*/
-- AlterTable
ALTER TABLE `database_instances` MODIFY `storage_protocol` VARCHAR(30) NULL;
