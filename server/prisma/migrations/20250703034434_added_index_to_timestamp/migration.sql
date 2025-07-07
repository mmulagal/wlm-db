-- AlterTable
ALTER TABLE `logs_analysis_reports` ADD COLUMN `end_time` DATETIME(3) NULL,
    ADD COLUMN `start_time` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `k_wlmdb_event_time` ON `event`(`time`);

-- CreateIndex
CREATE INDEX `k_wlmdb_logs_analysis_reports_creation_time` ON `logs_analysis_reports`(`creation_time`);

-- CreateIndex
CREATE INDEX `k_wlmdb_onprem_tco_reports_creation_time` ON `onprem_tco_reports`(`creation_time`);
