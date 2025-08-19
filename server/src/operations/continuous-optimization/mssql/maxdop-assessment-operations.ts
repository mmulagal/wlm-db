import { isEmpty } from 'lodash-es';

import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import getLogger from '../../../utils/logger';
import { MaxDOPAssesment } from '../../../utils/common-types';
import { getInstanceDetails } from '../../database-hosts-operations';
import { GENERIC_ASSESSMENT_ERROR_MESSAGE } from '../../../utils/consts';
import {
    ASSESSMENT_RESOURCE_TYPE,
    AssessmentCategories,
    AssessmentStatus,
    AwsWellArchitecturedPillars,
    SEVERITY
} from '../../../utils/continous-optimization-consts';
import { registerJob, updateJobDetails } from '../../database/job-operations';
import { GET_VCPU_AND_MAXDOP_DETAILS } from '../../workloads/mssql/continuous-optimization-scripts';
import { callSsmExecution } from '../../aws/ssm-operations';
import { sqlResponseParsing } from '../../../utils/utils';
import { ParameterDriftResponseType } from '../../../routes/types/mssql-continuous-optimisation.types';
import { createDatabaseInstanceConfigData } from '../../../lib/database/database-instance-config';

const logger = getLogger();

function calculateMaxDOPDrift(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    maxdopAssessmentData: MaxDOPAssesment
) {
    logger.info('Calculating Max DOP drift', { accountId, credentialsId, region, databaseHostId, databaseInstanceId });
    let errorMessage = '';
    try {
        logger.debug('Persisted max DOP configuration data from DB', maxdopAssessmentData);

        if (isEmpty(maxdopAssessmentData)) {
            errorMessage = GENERIC_ASSESSMENT_ERROR_MESSAGE(AssessmentCategories.MAXDOP);
            logger.error({ errorMessage });
            return { errorMessage };
        }

        const maxDOPAssessment = maxdopAssessmentData as MaxDOPAssesment;

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
            tags: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY],
            resourceType: ASSESSMENT_RESOURCE_TYPE.SQL_INSTANCE
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
        name: 'MaxDOP assessment ',
        description: 'MaxDOP assessment',
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

    if (!isEmpty(maxDOPAssessment)) {
        await createDatabaseInstanceConfigData([
            {
                account_id: accountId,
                credentials_id: credentialsId,
                region,
                resource_id: databaseHostId,
                database_instance_id: databaseInstanceId as string,
                creation_time: new Date(Date.now()),
                config_data_type: AssessmentCategories.MAXDOP,
                config_data: maxDOPAssessment
            }
        ]);
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
        'Get MaxDOP and VCPU details',
        accountId
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
