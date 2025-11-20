-- AlterTable
ALTER TABLE `config` MODIFY `database_type` ENUM('mssql', 'pgsql', 'oracle') NOT NULL DEFAULT 'mssql';

-- AlterTable
ALTER TABLE `logs_analysis_reports` MODIFY `database_type` ENUM('mssql', 'pgsql', 'oracle') NOT NULL DEFAULT 'mssql';

-- AlterTable
ALTER TABLE `onprem_tco_reports` MODIFY `database_type` ENUM('mssql', 'pgsql', 'oracle') NOT NULL DEFAULT 'mssql';
