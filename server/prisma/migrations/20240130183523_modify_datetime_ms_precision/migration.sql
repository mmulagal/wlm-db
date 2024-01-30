-- AlterTable
ALTER TABLE `config` MODIFY `creation_time` DATETIME(3) NOT NULL,
    MODIFY `modified_time` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `deployment` MODIFY `start_time` DATETIME(3) NOT NULL,
    MODIFY `end_time` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `event` MODIFY `time` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `job` MODIFY `start_time` DATETIME(3) NOT NULL,
    MODIFY `end_time` DATETIME(3) NULL,
    MODIFY `last_update_time` DATETIME(3) NULL;
