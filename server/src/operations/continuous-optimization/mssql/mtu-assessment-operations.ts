import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import getLogger from '../../../utils/logger';
import {
    ASSESSMENT_RESOURCE_TYPE,
    AssessmentStatus,
    DEFAULT_FSX_MTU_VALUE
} from '../../../utils/continous-optimization-consts';
import { GENERIC_ASSESSMENT_ERROR_MESSAGE } from '../../../utils/consts';
import { IS_DEMO_FLOW } from '../../../utils/utils';
import { Metadata, ResourceAssessmentData, WorkloadInstance } from '../../../utils/common-types';
import { registerJob, updateJobDetails } from '../../database/job-operations';
import { getInstanceInfo } from '../../database/database-operations';
import { callSsmExecution } from '../../aws/ssm-operations';
import { FETCH_MSSQL_INSTANCE_MTU_DETAILS } from '../../workloads/mssql/mtu-scripts';
import type { AssessmentErrorItemType } from '../../../routes/types/continuous-optimization.types';
import type { MssqlAssessmentItemType } from '../../../routes/types/mssql-continuous-optimisation.types';
import { MSSQL_GOLDEN_CONFIG } from './golden-config';
import { collectAllOntapRecords, buildOntapProxyBase, extractErrorMessage } from '../../../lib/ontap/ontap-gateway';

const logger = getLogger();

const FSX_ETHERNET_PORT_FIELDS = 'name,mtu';

interface OntapEthernetPortRecord {
    name?: string;
    mtu?: number;
}

interface FsxInterfaceRecord {
    Name: string;
    MTU: number;
}

interface FsxMtuData {
    fsxInterfaces: FsxInterfaceRecord[];
    error: string | null;
}

function toFsxInterfaceRow(port: OntapEthernetPortRecord): FsxInterfaceRecord | undefined {
    return port.name && port.mtu ? { Name: port.name, MTU: port.mtu } : undefined;
}

/** Replaces the previous host-side `Invoke-ONTAPRequest` call in `FETCH_FSX_MTU_DETAILS`. */
async function fetchFsxMtuData(accountId: string, instanceRecord: WorkloadInstance): Promise<FsxMtuData> {
    const base = buildOntapProxyBase(accountId, instanceRecord.fsxFileSystem, instanceRecord.region);
    logger.info('Fetching FSx ethernet port MTU details via proxy-forwarder', { accountId, targetId: base.targetId });

    try {
        const ports = await collectAllOntapRecords<OntapEthernetPortRecord>(base, 'api/network/ethernet/ports', {
            fields: FSX_ETHERNET_PORT_FIELDS
        });
        const fsxInterfaces = ports.map(toFsxInterfaceRow).filter((port): port is FsxInterfaceRecord => Boolean(port));
        return { fsxInterfaces, error: null };
    } catch (error) {
        logger.warn('Failed to fetch FSx ethernet port MTU details', { targetId: base.targetId, err: error });
        return { fsxInterfaces: [], error: extractErrorMessage(error) };
    }
}

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
        const [mssqlResponse, fsxMTU] = await Promise.all([
            callSsmExecution({
                credentialsId,
                region,
                commands: [FETCH_MSSQL_INSTANCE_MTU_DETAILS],
                ec2InstanceId: activeNodeInstanceId,
                comment: `Fetch MTU details for SQL Server instance ${activeNodeInstanceId}`,
                accountId,
                shouldReadFromCloudWatchLogs: true
            }),
            fetchFsxMtuData(accountId, instanceRecord)
        ]);

        const parsedMssqlResponse = typeof mssqlResponse === 'string' ? JSON.parse(mssqlResponse) : mssqlResponse;

        return {
            sqlServerMTU: parsedMssqlResponse,
            fsxMTU
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
): MssqlAssessmentItemType | AssessmentErrorItemType {
    logger.info('Calculating MTU alignment drift', { accountId, region, databaseHostId, credentialsId });
    const [goldenConfig] = MSSQL_GOLDEN_CONFIG.filter(e => e.id === 'mtu-alignment');

    try {
        const { mtuAlignment, errors } = assessmentData;

        if (!mtuAlignment) {
            const errorMessage = errors?.mtuAlignment || GENERIC_ASSESSMENT_ERROR_MESSAGE('MTU alignment');
            logger.error({ errorMessage });
            return { ...goldenConfig, errorMessage };
        }

        const { sqlServerMTU, fsxMTU } = mtuAlignment;

        if (!sqlServerMTU || !fsxMTU) {
            const errorMessage = 'SQL Server or FSx MTU data not found';
            logger.error({ errorMessage });
            return { ...goldenConfig, errorMessage };
        }

        if (sqlServerMTU.error || fsxMTU.error) {
            const errorMessage = `MTU assessment failed: ${sqlServerMTU.error || fsxMTU.error}`;
            logger.error({ errorMessage });
            return { ...goldenConfig, errorMessage };
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
                    const { name } = sqlInterface;
                    const interfaceToFix = {
                        ec2InstanceId: metadata?.node1InstanceId,
                        name: sqlInterface.name,
                        currentMTU,
                        recommendedMTU: fsxMtuValue,
                        interfaceIndex: sqlInterface.interfaceIndex
                    };
                    ec2InterfacesToFix.push(interfaceToFix);
                    violationDetails.push({
                        objectName: name,
                        value: `${currentMTU}`,
                        objectType: ASSESSMENT_RESOURCE_TYPE.NETWORK_INTERFACE,
                        recommended: `${fsxMtuValue}`
                    });
                }
            });
        }

        if (IS_DEMO_FLOW) {
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

        const totalObjectsAssessed = sqlServerMTU.sqlInterfaces?.length || 0;
        const totalObjectsInViolation = objectsInViolation.length;

        return {
            ...goldenConfig,
            status,
            recommended: AssessmentStatus.OPTIMIZED,
            objectsInViolation,
            totalObjectsAssessed,
            totalObjectsInViolation,
            violationDetails,
            ec2InterfacesToFix
        };
    } catch (error) {
        const errorMessage = `Error calculating MTU alignment drift: ${error}`;
        logger.error(errorMessage);
        return { ...goldenConfig, errorMessage };
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

export { calculateMTUAlignmentDrift, assessMTUAlignment, fetchFsxMtuData, type FsxMtuData, type FsxInterfaceRecord };
