ALTER TABLE `tracked_ec2`
  ADD COLUMN `database_type` ENUM('mssql', 'pgsql', 'oracle') NOT NULL DEFAULT 'mssql';
