import createError from 'http-errors';
import { isEmpty } from 'lodash-es';
import getLogger from '../../utils/logger';
import { AvailableSnapshotPoliciesResponseType } from '../../routes/types/continuous-optimization.types';
import { WorkloadInstance } from '../../utils/common-types';
import { ASSESSMENT_SSM_EXECUTION_TIMEOUT, HttpErrorCodes } from '../../utils/consts';
import { activeSqlNodeDetails } from '../cont-opt-optimize-operations';
import { GET_CLUSTER_SNAPSHOT_POLICIES } from '../workloads/mssql/continuous-optimization-scripts';
import { callSsmExecution } from '../aws/ssm-operations';
import { retryWithDelay, sqlResponseParsing } from '../../utils/utils';
import { describeFSxStorageVirtualMachines } from '../../lib/aws/fsx';

const logger = getLogger();

async function getAvailableSnapshotPolicyList(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string
): Promise<AvailableSnapshotPoliciesResponseType> {
    logger.info('Getting available snapshot policy list', { credentialsId, databaseInstanceId, databaseHostId });
    const response: AvailableSnapshotPoliciesResponseType = {
        snapshotPolicies: [],
        errorMessage: ''
    };
    try {
        const {
            sqlAuthEnabled,
            activeNodeInstanceId,
            fsxId,
            instanceId,
            instanceName,
            databaseType,
            awsAccountId,
            serverNameWithHostName
        } = await activeSqlNodeDetails(credentialsId, region, accountId, databaseHostId, databaseInstanceId);

        const instanceRecord: WorkloadInstance = {
            id: instanceId,
            name: instanceName,
            type: databaseType,
            region,
            sqlAuthEnabled: sqlAuthEnabled || false,
            fsxFileSystem: fsxId,
            activeNodeInstanceid: activeNodeInstanceId!,
            cloudProviderAccountId: awsAccountId,
            resourceName: serverNameWithHostName
        };

        const svmDetails = await describeFSxStorageVirtualMachines(credentialsId, region, fsxId);
        if (svmDetails?.StorageVirtualMachines.length === 0) {
            throw createError(HttpErrorCodes.NOT_FOUND, 'No SVM found for the given FSx ID');
        }
        const command = [GET_CLUSTER_SNAPSHOT_POLICIES(instanceRecord, svmDetails.StorageVirtualMachines[0].UUID!)];
        const ssmComment = 'Get available snapshot policies';

        const ssmResponse = await retryWithDelay(
            callSsmExecution.bind(
                null,
                credentialsId,
                region,
                command,
                instanceRecord.activeNodeInstanceid,
                ssmComment,
                accountId,
                false,
                ASSESSMENT_SSM_EXECUTION_TIMEOUT
            )
        );
        const parsedSsmResponse = sqlResponseParsing(ssmResponse);
        logger.info('SSM response', parsedSsmResponse);

        if (!isEmpty(parsedSsmResponse?.errors)) {
            logger.error('Error executing SSM command while getting snaphot policy list', parsedSsmResponse.errors);
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, parsedSsmResponse.errors);
        }

        if (!isEmpty(parsedSsmResponse?.snapshotPolicies)) {
            response.snapshotPolicies = parsedSsmResponse.snapshotPolicies;
        }

        return response;
    } catch (error) {
        logger.error('Error getting available snapshot policy list', JSON.stringify(error));
        response.errorMessage = JSON.stringify(error);
        return response;
    }
}

export { getAvailableSnapshotPolicyList };
