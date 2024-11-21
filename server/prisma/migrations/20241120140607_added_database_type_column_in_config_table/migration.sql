-- AlterTable
ALTER TABLE `config` ADD COLUMN `database_type` ENUM('mssql', 'pgsql') NOT NULL DEFAULT 'mssql';
