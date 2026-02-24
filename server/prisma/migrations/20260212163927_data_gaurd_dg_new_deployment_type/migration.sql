-- AlterTable
ALTER TABLE `database_instances` MODIFY `database_deployment_type` ENUM('Standalone', 'FCI', 'AOAG', 'HA', 'DG') NOT NULL;

-- AlterTable
ALTER TABLE `onprem_tco_reports` MODIFY `database_deployment_type` ENUM('Standalone', 'FCI', 'AOAG', 'HA', 'DG') NOT NULL;
