import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import getLogger from '../../../utils/logger';
import {
    ASSESSMENT_RESOURCE_TYPE,
    AssessmentStatus,
    AwsWellArchitecturedPillars,
    DEFAULT_FSX_MTU_VALUE,
    SEVERITY
} from '../../../utils/continous-optimization-consts';
import { GENERIC_ASSESSMENT_ERROR_MESSAGE } from '../../../utils/consts';
import { Metadata, ResourceAssessmentData, WorkloadInstance } from '../../../utils/common-types';
import { registerJob, updateJobDetails } from '../../database/job-operations';
import { getInstanceInfo } from '../../database/database-operations';
import { callSsmExecution } from '../../aws/ssm-operations';
import { FETCH_MSSQL_INSTANCE_MTU_DETAILS, FETCH_FSX_MTU_DETAILS } from '../../workloads/mssql/mtu-scripts';
import { isDemo } from '../../../utils/utils';

const logger = getLogger();

const isDemoFlow = isDemo();

interface SqlInterface {
    name: string;
    mtu: number;
    interfaceIndex: number;
}

interface Ec2InterfaceToFix {
    ec2InstanceId?: string;
    name: string;
    currentMTU: number;
    recommendedMTU: number;
    interfaceIndex: number;
}

interface FsxInterface {
    MTU: number;
}

async function mtuAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    activeNodeInstanceId: string,
    databaseInstanceId: string,
    metadata: Metadata
) {
    logger.info('Starting MTU assessment', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        activeNodeInstanceId,
        databaseInstanceId,
        metadata
    });
    const instanceInfo = await getInstanceInfo(accountId, credentialsId, databaseHostId, databaseInstanceId || '');
    if (!instanceInfo || !instanceInfo.resource) {
        throw new Error(`Instance information not found for databaseHostId: ${databaseHostId}`);
    }

    const { node1InstanceId, node2InstanceId } = metadata as Metadata;
    const instanceIds = node2InstanceId ? [node1InstanceId, node2InstanceId] : [node1InstanceId];

    const fsxId = instanceInfo.fsxn_ids;
    if (!fsxId) {
        throw new Error('FSx file system ID not found for MTU assessment');
    }

    if (instanceIds.length === 0) {
        throw new Error('No EC2 instance IDs found for MTU assessment');
    }

    const instanceRecord: WorkloadInstance = {
        id: databaseHostId,
        name: databaseHostId,
        type: 'MSSQL',
        fsxFileSystem: fsxId,
        region,
        sqlAuthEnabled: false,
        activeNodeInstanceid: activeNodeInstanceId,
        resourceName: databaseHostId
    };
    try {
        const [mssqlResponse, fsxResponse] = await Promise.all([
            callSsmExecution(
                credentialsId,
                region,
                [FETCH_MSSQL_INSTANCE_MTU_DETAILS],
                activeNodeInstanceId,
                `Fetch MTU details for SQL Server instance ${activeNodeInstanceId}`,
                accountId,
                false,
                undefined,
                true
            ),
            callSsmExecution(
                credentialsId,
                region,
                [FETCH_FSX_MTU_DETAILS(instanceRecord)],
                activeNodeInstanceId,
                'Fetch FSx MTU details',
                accountId,
                false,
                undefined,
                true
            )
        ]);

        const parsedMssqlResponse = typeof mssqlResponse === 'string' ? JSON.parse(mssqlResponse) : mssqlResponse;
        const parsedFsxResponse = typeof fsxResponse === 'string' ? JSON.parse(fsxResponse) : fsxResponse;

        return {
            sqlServerMTU: parsedMssqlResponse,
            fsxMTU: parsedFsxResponse
        };
    } catch (error) {
        logger.error('Failed to assess MTU alignment', {
            error,
            accountId,
            databaseHostId,
            region
        });
        throw error;
    }
}

function calculateMTUAlignmentDrift(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    metadata: Metadata,
    assessmentData: ResourceAssessmentData
) {
    logger.info('Calculating MTU alignment drift', { accountId, region, databaseHostId, credentialsId });
    let errorMessage = '';

    try {
        const { mtuAlignment, errors } = assessmentData;

        if (!mtuAlignment) {
            errorMessage = errors?.mtuAlignment || GENERIC_ASSESSMENT_ERROR_MESSAGE('MTU alignment');
            logger.error({ errorMessage });
            return { errorMessage };
        }

        const { sqlServerMTU, fsxMTU } = mtuAlignment;

        if (!sqlServerMTU || !fsxMTU) {
            errorMessage = 'SQL Server or FSx MTU data not found';
            logger.error({ errorMessage });
            return { errorMessage };
        }

        if (sqlServerMTU.error || fsxMTU.error) {
            errorMessage = `MTU assessment failed: ${sqlServerMTU.error || fsxMTU.error}`;
            logger.error({ errorMessage });
            return { errorMessage };
        }

        const fsxMtuValue =
            fsxMTU.fsxInterfaces && fsxMTU.fsxInterfaces.length > 0
                ? Math.min(...fsxMTU.fsxInterfaces.map((iface: FsxInterface) => iface.MTU))
                : DEFAULT_FSX_MTU_VALUE;

        let ec2InterfacesToFix: Ec2InterfaceToFix[] = [];
        let objectsInViolation: string[] = [];
        let violationDetails: Array<{ objectName: string; value: string; objectType: string; recommended: string }> =
            [];

        if (
            sqlServerMTU.sqlInterfaces &&
            Array.isArray(sqlServerMTU.sqlInterfaces) &&
            sqlServerMTU.sqlInterfaces.length > 0
        ) {
            sqlServerMTU.sqlInterfaces.forEach((sqlInterface: SqlInterface) => {
                const currentMTU = sqlInterface.mtu;
                if (currentMTU !== fsxMtuValue) {
                    objectsInViolation.push(sqlInterface.name.toString());

                    const interfaceToFix = {
                        ec2InstanceId: metadata?.node1InstanceId,
                        name: sqlInterface.name,
                        currentMTU,
                        recommendedMTU: fsxMtuValue,
                        interfaceIndex: sqlInterface.interfaceIndex
                    };
                    ec2InterfacesToFix.push(interfaceToFix);
                    violationDetails.push({
                        objectName: interfaceToFix.name,
                        value: `${sqlInterface.interfaceIndex}`,
                        objectType: ASSESSMENT_RESOURCE_TYPE.NETWORK_INTERFACE,
                        recommended: `${fsxMtuValue}`
                    });
                }
            });
        }

        if (isDemoFlow) {
            const { optimizedMtus } = metadata;
            if (optimizedMtus && optimizedMtus.length > 0) {
                // Filter out optimized interfaces from all violation arrays
                const optimizedSet = new Set(optimizedMtus);

                objectsInViolation = objectsInViolation.filter(name => !optimizedSet.has(name));

                ec2InterfacesToFix = ec2InterfacesToFix.filter(iface => !optimizedSet.has(iface.name));

                violationDetails = violationDetails.filter(detail => !optimizedSet.has(detail.objectName));
            }
        }

        const status = objectsInViolation.length === 0 ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED;

        const recommendation =
            'Workload Factory recommends aligning EC2 instance Maximum Transmission Unit (MTU) settings with your FSX for ONTAP file system to prevent network fragmentation and optimize SQL Server performance. Fixing MTU misalignment ensures consistent MTU configuration across all nodes and network paths.';

        const totalObjectsAssessed = sqlServerMTU.sqlInterfaces?.length || 0;
        const totalObjectsInViolation = objectsInViolation.length;

        return {
            name: 'mtu-alignment',
            status,
            recommended: AssessmentStatus.OPTIMIZED,
            severity: SEVERITY.CRITICAL,
            recommendation,
            tags: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY, AwsWellArchitecturedPillars.RELIABILITY],
            objectsInViolation,
            resourceType: ASSESSMENT_RESOURCE_TYPE.NETWORK_INTERFACE,
            totalObjectsAssessed,
            totalObjectsInViolation,
            violationDetails,
            ec2InterfacesToFix
        };
    } catch (error) {
        errorMessage = `Error calculating MTU alignment drift: ${error}`;
        logger.error(errorMessage);
        return { errorMessage };
    }
}

async function assessMTUAlignment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    activeNodeInstanceId: string,
    databaseInstanceId: string,
    parentJobId: string,
    metadata: Metadata,
    resourceName: string
): Promise<any> {
    logger.info('Starting MTU alignment assessment', {
        accountId,
        databaseHostId,
        databaseInstanceId,
        region,
        credentialsId
    });

    const { id: mtuAlignmentAssessmentJobId } = await registerJob(accountId, credentialsId, region, {
        name: `Microsoft SQL Server MTU alignment assessment for ${resourceName} in EC2 instance ${activeNodeInstanceId}`,
        description: `Microsoft SQL Server MTU alignment assessment for ${resourceName}`,
        resourceName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT,
        parentJobId
    });
    let mtuAlignmentAssessment;
    let jobStatus;
    let errorMessage;
    try {
        mtuAlignmentAssessment = await mtuAssessment(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            activeNodeInstanceId,
            databaseInstanceId,
            metadata as unknown as Metadata
        );
    } catch (error) {
        errorMessage = `Error while performing mtu alignment assessment. ${error}`;
        logger.error(errorMessage);
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, mtuAlignmentAssessmentJobId, {
            endTime: Date.now(),
            status: jobStatus || JOBSTATUS.COMPLETED,
            error: errorMessage
        });
    }
    return { mtuAlignmentAssessment, errorMessage };
}

export { calculateMTUAlignmentDrift, assessMTUAlignment };
