import {
    listDatabaseInstanceConfigData,
    removeAllButLatestDatabaseInstanceConfigData
} from '../../lib/database/database-instance-config';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function purgeOlderAssessmentRecords() {
    logger.info('Purging older assessment records');
    const instanceAssessmentRecords = await listDatabaseInstanceConfigData();
    instanceAssessmentRecords.forEach(
        async ({
            account_id: accountId,
            region,
            credentials_id: credentialsId,
            resource_id: resourceId,
            database_instance_id: databaseInstanceId,
            creation_time: creationTime
        }) => {
            await removeAllButLatestDatabaseInstanceConfigData(
                accountId,
                region,
                credentialsId,
                resourceId,
                databaseInstanceId,
                creationTime
            );
        }
    );
}

export { purgeOlderAssessmentRecords };
