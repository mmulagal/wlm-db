import { isEmpty } from 'lodash-es';

import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import getLogger from '../../../utils/logger';
import { MaxDOPAssesment } from '../../../utils/common-types';
import { getInstanceDetails } from '../../database-hosts-operations';
import { GENERIC_ASSESSMENT_ERROR_MESSAGE } from '../../../utils/consts';
import { AssessmentCategories, AssessmentStatus } from '../../../utils/continous-optimization-consts';
import { registerJob, updateJobDetails } from '../../database/job-operations';
import { GET_VCPU_AND_MAXDOP_DETAILS } from '../../workloads/mssql/assessment-scripts';
import { callSsmExecution } from '../../aws/ssm-operations';
import { sqlResponseParsing, calculateRecommendedMaxDOP } from '../../../utils/utils';
import type { AssessmentErrorItemType } from '../../../routes/types/continuous-optimization.types';
import type { MssqlAssessmentItemType } from '../../../routes/types/mssql-continuous-optimisation.types';
import { createDatabaseInstanceConfigData } from '../../../lib/database/database-instance-config';
import { MSSQL_GOLDEN_CONFIG } from './golden-config';

const logger = getLogger();

function calculateMaxDOPDrift(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    maxdopAssessmentData: MaxDOPAssesment,
    instanceName?: string
): MssqlAssessmentItemType | AssessmentErrorItemType {
    logger.info('Calculating Max DOP drift', { accountId, credentialsId, region, databaseHostId, databaseInstanceId });
    const [goldenConfig] = MSSQL_GOLDEN_CONFIG.filter(e => e.id === 'maxdop');
    try {
        logger.debug('Persisted max DOP configuration data from DB', maxdopAssessmentData);

        if (isEmpty(maxdopAssessmentData)) {
            const errorMessage = GENERIC_ASSESSMENT_ERROR_MESSAGE(AssessmentCategories.MAXDOP);
            logger.error({ errorMessage });
            return { ...goldenConfig, errorMessage };
        }

        const { current, recommendedMaxDOP, status } = maxdopAssessmentData as MaxDOPAssesment;
        const assessmentStatus = status as AssessmentStatus;
        const isViolation = assessmentStatus !== AssessmentStatus.OPTIMIZED;
        return {
            ...goldenConfig,
            status: assessmentStatus,
            recommended: recommendedMaxDOP,
            current: current?.toString(),
            totalObjectsAssessed: 1,
            totalObjectsInViolation: isViolation ? 1 : 0,
            objectsInViolation: isViolation ? [instanceName ?? databaseInstanceId] : []
        };
    } catch (error: any) {
        const errorMessage = `Error while calculating max DOP drift. ${error.message}`;
        logger.error({ errorMessage, error });
        return { ...goldenConfig, errorMessage };
    }
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
    const response = await callSsmExecution({
        credentialsId,
        region,
        commands: [ssmCommand],
        ec2InstanceId: activeNodeInstanceId,
        comment: 'Get MaxDOP and VCPU details',
        accountId
    });
    const parsedResponse = sqlResponseParsing(response);
    const { maxDOP, vcpuCount } = parsedResponse;

    const recommendedMaxDOP = calculateRecommendedMaxDOP(vcpuCount);
    const isOptimized = maxDOP === recommendedMaxDOP;
    const optimizationStatus = isOptimized ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED;

    return {
        current: maxDOP?.toString(),
        recommendedMaxDOP,
        status: optimizationStatus
    };
}

export { managedHostsMaxDOPAssessment, calculateMaxDOPDrift, runMaxDOPAssessment };
