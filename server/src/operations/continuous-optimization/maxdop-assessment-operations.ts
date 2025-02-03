import { isEmpty } from 'lodash-es';
import createError from 'http-errors';

import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import getLogger from '../../utils/logger';
import { MaxDOPAssesment } from '../../utils/common-types';
import { getInstanceDetails } from '../database-hosts-operations';
import { HttpErrorCodes } from '../../utils/consts';
import {
    AssessmentCategories,
    AssessmentStatus,
    AwsWellArchitecturedPillars,
    SEVERITY
} from '../../utils/continous-optimization-consts';
import { registerJob, updateJobDetails } from '../database/job-operations';
import { GET_VCPU_AND_MAXDOP_DETAILS } from '../workloads/mssql/continuous-optimization-scripts';
import { callSsmExecution } from '../aws/ssm-operations';
import { sqlResponseParsing } from '../../utils/utils';
import { ParameterDriftResponseType } from '../../routes/types/continuous-optimization.types';
import {
    createDatabaseInstanceConfigData,
    listDatabaseInstanceConfigData
} from '../../lib/database/database-instance-config';

const logger = getLogger();

async function calculateMaxDOPDrift(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string
) {
    logger.info('Calculating Max DOP drift', { accountId, credentialsId, region, databaseHostId, databaseInstanceId });
    let errorMessage = '';
    try {
        const [persistedConfigurationData] = await listDatabaseInstanceConfigData(
            accountId,
            region,
            credentialsId,
            databaseHostId,
            databaseInstanceId,
            AssessmentCategories.MAXDOP
        );

        logger.debug('Persisted max DOP configuration data from DB', persistedConfigurationData);
        const maxDOP = persistedConfigurationData?.config_data as unknown as MaxDOPAssesment;

        let maxDOPAssessment;

        if (!isEmpty(maxDOP)) {
            maxDOPAssessment = maxDOP as MaxDOPAssesment;
        } else {
            const {
                activeNodeInstanceId,
                newDatabaseInstanceDetails: { database_instance_name: instanceName, sqlAuthEnabled }
            } = await getInstanceDetails(accountId, credentialsId, region, databaseHostId, databaseInstanceId);

            if (!activeNodeInstanceId) {
                logger.error('Active node instance id not found');
                throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Active node instance id not found');
            }

            maxDOPAssessment = await runMaxDOPAssessment(
                accountId,
                credentialsId,
                region,
                activeNodeInstanceId,
                instanceName,
                sqlAuthEnabled
            );
            logger.debug('Max DOP assessment result while calculating', maxDOPAssessment);

            await createDatabaseInstanceConfigData([
                {
                    account_id: accountId,
                    credentials_id: credentialsId,
                    region,
                    resource_id: databaseHostId,
                    database_instance_id: databaseInstanceId,
                    creation_time: new Date(Date.now()),
                    config_data_type: AssessmentCategories.MAXDOP,
                    config_data: maxDOPAssessment
                }
            ]);
        }

        const { current, recommendedMaxDOP, status } = maxDOPAssessment;
        const recommendationMessage =
            status === AssessmentStatus.NOT_OPTIMIZED
                ? 'For optimal performance, it is recommended to set max degree of parallelism (MAXDOP) to 4 if the number of virtual CPUs is less than or equal to 8, 8 if the number of vCPUs is between 9 and 16, and 16 if the number of vCPUs is greater than 16. Your current settings are not optimized.'
                : 'Your MSSQL instance is optimized with the recommended MAXDOP settings for optimal performance.';

        const maxDOPResponse: ParameterDriftResponseType = {
            name: 'maxdop',
            status: status as AssessmentStatus,
            recommended: recommendedMaxDOP,
            severity: SEVERITY.WARNING,
            recommendation: recommendationMessage,
            current: current?.toString(),
            tags: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY]
        };
        return maxDOPResponse;
    } catch (error: any) {
        errorMessage = `Error while calculating max DOP drift. ${error.message}`;
        logger.error({ errorMessage, error });
    }
    return { errorMessage };
}

async function managedHostsMaxDOPAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string,
    resourceName: string,
    databaseHostId: string,
    databaseInstanceId: string,
    parentJobId?: string
) {
    logger.info('Managed hosts maxDOP assessment', {
        accountId,
        credentialsId,
        region,
        activeNodeInstanceId,
        resourceName,
        databaseHostId,
        databaseInstanceId,
        parentJobId
    });

    const { id: maxDopAssessmentJobId } = await registerJob(accountId, credentialsId, region, {
        name: `Microsoft SQL server MaxDOP assessment for ${resourceName} in EC2 instance ${activeNodeInstanceId}`,
        description: `Microsoft SQL server MaxDOP assessment for ${resourceName}`,
        resourceName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT,
        parentJobId
    });

    let maxDOPAssessment;
    let jobStatus;
    let errorMessage;
    try {
        const {
            newDatabaseInstanceDetails: { database_instance_name: instanceName, sqlAuthEnabled }
        } = await getInstanceDetails(accountId, credentialsId, region, databaseHostId, databaseInstanceId);
        maxDOPAssessment = await runMaxDOPAssessment(
            accountId,
            credentialsId,
            region,
            activeNodeInstanceId,
            instanceName,
            sqlAuthEnabled
        );
    } catch (error) {
        errorMessage = `Error while performing maxDOP assessment. ${error}`;
        logger.error(errorMessage);

        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, maxDopAssessmentJobId, {
            endTime: Date.now(),
            status: jobStatus || JOBSTATUS.COMPLETED,
            error: errorMessage
        });
    }

    return maxDOPAssessment;
}

async function runMaxDOPAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string,
    databaseInstanceName: string,
    sqlAuthEnabled?: boolean
) {
    logger.info('Running Max DOP assessment', {
        accountId,
        credentialsId,
        region,
        activeNodeInstanceId,
        databaseInstanceName,
        sqlAuthEnabled
    });
    const ssmCommand = GET_VCPU_AND_MAXDOP_DETAILS(databaseInstanceName, sqlAuthEnabled as boolean);
    const response = await callSsmExecution(
        credentialsId,
        region,
        [ssmCommand],
        activeNodeInstanceId,
        'Get MaxDOP and VCPU details'
    );
    const parsedResponse = sqlResponseParsing(response);
    const { maxDOP, vcpuCount } = parsedResponse;

    let recommendedMaxDOP;
    if (vcpuCount <= 8) {
        recommendedMaxDOP = '4';
    } else if (vcpuCount <= 16) {
        recommendedMaxDOP = '8';
    } else {
        recommendedMaxDOP = '16';
    }

    const isOptimized = maxDOP === recommendedMaxDOP;
    const optimizationStatus = isOptimized ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED;

    return {
        current: maxDOP?.toString(),
        recommendedMaxDOP,
        status: optimizationStatus
    };
}

export { managedHostsMaxDOPAssessment, calculateMaxDOPDrift, runMaxDOPAssessment };
