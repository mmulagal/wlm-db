import {
    listDatabaseInstanceConfigData,
    removeAllButLatestDatabaseInstanceConfigData
} from '../../lib/database/database-instance-config';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function purgeOlderAssessmentRecords() {
    logger.info('Purging older assessment records');
    const instanceAssessmentRecords = await listDatabaseInstanceConfigData();
    instanceAssessmentRecords.forEach(async instanceAssessmentRecord => {
        await removeAllButLatestDatabaseInstanceConfigData(
            instanceAssessmentRecord.account_id,
            instanceAssessmentRecord.region,
            instanceAssessmentRecord.credentials_id,
            instanceAssessmentRecord.resource_id,
            instanceAssessmentRecord.database_instance_id,
            instanceAssessmentRecord.creation_time
        );
    });
}

export { purgeOlderAssessmentRecords };
