import getLogger from '../../utils/logger';
import { callSsmExecution } from './ssm-operations';
import { describeAvailablePatches } from '../../lib/aws/ssm';
import { sqlResponseParsing } from '../../utils/utils';
import { GET_INSTALLED_SQL_PATCHES } from '../workloads/mssql/assessment-scripts';

const logger = getLogger();

async function getAvailablePatches(credentialsId: string, region: string, instanceId: string, sqlServerYear: string) {
    logger.info('Get Available Patch Details', { credentialsId, region, instanceId });

    const params = {
        Filters: [
            {
                Key: 'PATCH_SET',
                Values: ['APPLICATION']
            },
            {
                Key: 'PRODUCT_FAMILY',
                Values: ['SQL Server']
            },
            {
                Key: 'MSRC_SEVERITY',
                Values: ['Important', 'Critical']
            },
            {
                Key: 'CLASSIFICATION',
                Values: ['SecurityUpdates']
            },
            {
                Key: 'PRODUCT',
                Values: [`Microsoft SQL Server ${sqlServerYear}`]
            }
        ]
    };

    const availablePatches = (await describeAvailablePatches(credentialsId, region, params)) || {};
    return availablePatches;
}

async function getInstalledSQLPatchDetails(
    credentialsId: string,
    region: string,
    instanceIds: string[],
    accountId: string
) {
    logger.info('Get Installed SQL Patch Details', { credentialsId, region, instanceIds, accountId });
    const ssmCommand = GET_INSTALLED_SQL_PATCHES();

    return Promise.all(
        instanceIds.map(async instanceId => {
            const response = await callSsmExecution({
                credentialsId,
                region,
                commands: [ssmCommand],
                ec2InstanceId: instanceId,
                comment: 'Get Installed SQL patches',
                accountId,
                cacheData: true
            });
            const parsedResponse = sqlResponseParsing(response);
            const { installedPatches } = parsedResponse;

            return {
                instanceId,
                installedPatches
            };
        })
    );
}

export { getAvailablePatches, getInstalledSQLPatchDetails };
