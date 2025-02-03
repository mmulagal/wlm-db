import getLogger from '../../utils/logger';
import { callSsmExecution } from './ssm-operations';
import { describeAvailablePatches } from '../../lib/aws/ssm';
import { extractVersionYear, sqlResponseParsing } from '../../utils/utils';
import {
    GET_INSTALLED_MSSQL_VERSION,
    GET_INSTALLED_SQL_PATCHES
} from '../workloads/mssql/continuous-optimization-scripts';

const logger = getLogger();

async function getAvailablePatches(credentialsId: string, region: string, instanceIds: string[]) {
    logger.info('Get Available Patch Details', { credentialsId, region, instanceIds });

    return Promise.all(
        instanceIds.map(async instanceId => {
            const sqlServerYear = await getTheMSSqlversion(credentialsId, region, instanceId);

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

            const availablePatches = (await describeAvailablePatches(region, params)) || {};

            return {
                instanceId,
                availablePatches
            };
        })
    );
}

async function getTheMSSqlversion(credentialsId: string, region: string, instanceId: string) {
    const ssmCommand = GET_INSTALLED_MSSQL_VERSION();

    const response = await callSsmExecution(
        credentialsId,
        region,
        [ssmCommand],
        instanceId,
        'Get Installed SQL version'
    );
    const parsedResponse = sqlResponseParsing(response);
    const { sqlVersion } = parsedResponse;
    const versionYear = extractVersionYear(sqlVersion);

    return versionYear;
}

async function getInstalledSQLPatchDetails(credentialsId: string, region: string, instanceIds: string[]) {
    logger.info('Get Installed SQL Patch Details', { credentialsId, region, instanceIds });
    const ssmCommand = GET_INSTALLED_SQL_PATCHES();

    return Promise.all(
        instanceIds.map(async instanceId => {
            const response = await callSsmExecution(
                credentialsId,
                region,
                [ssmCommand],
                instanceId,
                'Get Installed SQL patches'
            );
            const parsedResponse = sqlResponseParsing(response);
            const { installedPatches } = parsedResponse;

            return {
                instanceId,
                installedPatches
            };
        })
    );
}

export { getAvailablePatches, getInstalledSQLPatchDetails, getTheMSSqlversion };
