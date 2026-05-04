import { prisma } from '../prisma-utils';
import { RESOURCESTYPE } from '../consts';
import {
    mockOracleHostOsPatchAssessmentData,
    mockResourceAssessmentData,
    ORACLE_HOST_OS_MISSING_PATCHES,
    MSSQL_HOST_OS_MISSING_PATCHES,
    MSSQL_DATABASE_MISSING_PATCHES
} from './hostAssementsData';

// Patch SSM fixtures keep the patch-scan / get-assessment / re-run-assessment
// flows in lock-step with the seeded host OS / database patch demo data so
// Oracle Linux hosts surface the Oracle CVE patches and Windows MSSQL hosts
// surface KB updates. These shapes are consumed by the simulator SSM mock to
// replay AWS describe-instance-patch-states, describe-instance-patches, and
// describe-available-patches responses.
//
// The patch-detail lists themselves live in `hostAssementsData` so the seeded
// `assessment_data` (which intentionally omits `missingPatchDetails` to match
// what production persists) and the SSM mock both read from a single source
// of truth.

interface DemoInstancePatchState {
    BaselineId: string;
    CriticalNonCompliantCount: number;
    SecurityNonCompliantCount: number;
    OtherNonCompliantCount: number;
    FailedCount: number;
    InstalledCount: number;
    InstalledOtherCount: number;
    InstalledPendingRebootCount: number;
    InstalledRejectedCount: number;
    MissingCount: number;
    NotApplicableCount: number;
    Operation: string;
    OperationEndTime: string;
    OperationStartTime: string;
    OwnerInformation: string;
    PatchGroup: string;
    RebootOption: string;
    SnapshotId: string;
    UnreportedNotApplicableCount: number;
    InstanceId?: string;
}

interface DemoMissingPatch {
    Classification: string;
    CVEIds: string;
    InstalledTime: string;
    KBId: string;
    Severity: string;
    State: string;
    Title: string;
}

const ORACLE_HOST_OS_PATCH_FIXTURE = mockOracleHostOsPatchAssessmentData.hostOsPatch[0];
const MSSQL_HOST_OS_PATCH_FIXTURE = mockResourceAssessmentData.assessment.hostOsPatch[0];

const ORACLE_INSTANCE_PATCH_STATE: DemoInstancePatchState = {
    BaselineId: ORACLE_HOST_OS_PATCH_FIXTURE.baselineId,
    CriticalNonCompliantCount: ORACLE_HOST_OS_PATCH_FIXTURE.criticalNonCompliantCount,
    SecurityNonCompliantCount: ORACLE_HOST_OS_PATCH_FIXTURE.securityNonCompliantCount,
    OtherNonCompliantCount: ORACLE_HOST_OS_PATCH_FIXTURE.otherNonCompliantCount,
    FailedCount: 0,
    InstalledCount: 3,
    InstalledOtherCount: 4,
    InstalledPendingRebootCount: 0,
    InstalledRejectedCount: 0,
    MissingCount: ORACLE_HOST_OS_MISSING_PATCHES.length,
    NotApplicableCount: 2557,
    Operation: 'Scan',
    OperationEndTime: new Date(ORACLE_HOST_OS_PATCH_FIXTURE.operationEndTime).toISOString(),
    OperationStartTime: new Date(ORACLE_HOST_OS_PATCH_FIXTURE.operationStartTime).toISOString(),
    OwnerInformation: '',
    PatchGroup: '',
    RebootOption: 'RebootIfNeeded',
    SnapshotId: 'e9383295-8e8c-4807-bbd5-2a9d1f228498',
    UnreportedNotApplicableCount: 0
};

const MSSQL_INSTANCE_PATCH_STATE: DemoInstancePatchState = {
    BaselineId: MSSQL_HOST_OS_PATCH_FIXTURE.baselineId,
    CriticalNonCompliantCount: MSSQL_HOST_OS_PATCH_FIXTURE.criticalNonCompliantCount,
    SecurityNonCompliantCount: MSSQL_HOST_OS_PATCH_FIXTURE.securityNonCompliantCount,
    OtherNonCompliantCount: MSSQL_HOST_OS_PATCH_FIXTURE.otherNonCompliantCount,
    FailedCount: 0,
    InstalledCount: 3,
    InstalledOtherCount: 4,
    InstalledPendingRebootCount: 0,
    InstalledRejectedCount: 0,
    MissingCount: MSSQL_HOST_OS_MISSING_PATCHES.length,
    NotApplicableCount: 2557,
    Operation: 'Scan',
    OperationEndTime: new Date(MSSQL_HOST_OS_PATCH_FIXTURE.operationEndTime).toISOString(),
    OperationStartTime: new Date(MSSQL_HOST_OS_PATCH_FIXTURE.operationStartTime).toISOString(),
    OwnerInformation: '',
    PatchGroup: '',
    RebootOption: 'RebootIfNeeded',
    SnapshotId: 'e9383295-8e8c-4807-bbd5-2a9d1f228498',
    UnreportedNotApplicableCount: 0
};

const ORACLE_MISSING_PATCHES: DemoMissingPatch[] = ORACLE_HOST_OS_MISSING_PATCHES.map(
    ({ classification = '', cveIds = '', severity = '', state = '', title = '' }) => ({
        Classification: classification,
        CVEIds: cveIds,
        InstalledTime: '1970-01-01T00:00:00.000Z',
        KBId: '',
        Severity: severity,
        State: state,
        Title: title
    })
);

const MSSQL_MISSING_PATCHES: DemoMissingPatch[] = MSSQL_HOST_OS_MISSING_PATCHES.map(
    ({ classification = '', kbId = '', severity = '', state = '', title = '' }) => ({
        Classification: classification,
        CVEIds: '',
        InstalledTime: '1970-01-01T00:00:00.000Z',
        KBId: kbId,
        Severity: severity,
        State: state,
        Title: title
    })
);

async function resolveResourceTypeForInstanceId(instanceId?: string): Promise<string | undefined> {
    if (!instanceId || !prisma?.client?.resource) {
        return undefined;
    }
    try {
        const resources = (await prisma.client.resource.findMany({
            select: { resource_type: true, metadata: true, assessment_data: true }
        })) as {
            resource_type: string | null;
            metadata: Record<string, unknown> | null;
            assessment_data: Record<string, unknown> | null;
        }[];

        const matchedByMetadata = resources.find(({ metadata }) => {
            const meta = (metadata || {}) as Record<string, unknown>;
            return (
                meta.node1InstanceId === instanceId ||
                meta.node2InstanceId === instanceId ||
                meta.activeNodeInstanceId === instanceId
            );
        });
        if (matchedByMetadata?.resource_type) {
            return matchedByMetadata.resource_type;
        }

        // Fall back to looking up the instance ID inside the resource's
        // seeded `assessment_data.hostOsPatch[*].ec2InstanceId` and
        // `assessment_data.mssqlPatch[*].ec2InstanceId`. The MSSQL cluster
        // discovery flow (`getAllClusterNodeDetails` → EC2 describeInstances
        // by private IP) returns inventory-driven instance IDs that don't
        // appear in `metadata`, so this widens the match without invalidating
        // the metadata-first lookup above.
        const matchedByAssessmentData = resources.find(({ assessment_data: assessmentData }) => {
            const assessment = (assessmentData || {}) as {
                hostOsPatch?: { ec2InstanceId?: string }[];
                mssqlPatch?: { ec2InstanceId?: string }[];
            };
            const seededInstanceIds = [...(assessment.hostOsPatch ?? []), ...(assessment.mssqlPatch ?? [])].map(
                ({ ec2InstanceId }) => ec2InstanceId
            );
            return seededInstanceIds.includes(instanceId);
        });
        if (matchedByAssessmentData?.resource_type) {
            return matchedByAssessmentData.resource_type;
        }

        // Demo deployments typically register all hosts of the same engine.
        // When the cluster discovery surfaces a synthetic instance ID that
        // isn't tied to any seeded host (sampled from inventory mock data),
        // default to the only engine present so MSSQL clusters keep returning
        // MSSQL patches across every node.
        const resourceTypes = new Set(resources.map(({ resource_type: resourceType }) => resourceType).filter(Boolean));
        if (resourceTypes.size === 1) {
            const [onlyType] = [...resourceTypes];
            return onlyType ?? undefined;
        }
        if (resourceTypes.has(RESOURCESTYPE.MSSQL)) {
            return RESOURCESTYPE.MSSQL;
        }
        return undefined;
    } catch {
        return undefined;
    }
}

function buildDemoInstancePatchState(
    instanceId: string,
    resourceType: string | undefined,
    fallback: DemoInstancePatchState
): DemoInstancePatchState {
    if (resourceType === RESOURCESTYPE.ORACLE) {
        return { ...ORACLE_INSTANCE_PATCH_STATE, InstanceId: instanceId };
    }
    if (resourceType === RESOURCESTYPE.MSSQL) {
        return { ...MSSQL_INSTANCE_PATCH_STATE, InstanceId: instanceId };
    }
    return { ...fallback, InstanceId: instanceId };
}

function buildDemoMissingPatches(resourceType: string | undefined, fallback: DemoMissingPatch[]): DemoMissingPatch[] {
    if (resourceType === RESOURCESTYPE.ORACLE) {
        return ORACLE_MISSING_PATCHES;
    }
    if (resourceType === RESOURCESTYPE.MSSQL) {
        return MSSQL_MISSING_PATCHES;
    }
    return fallback;
}

// AWS-shape "available" patch entries for SSM `DescribeAvailablePatchesCommand`.
// Built from the same shared MSSQL database missing patch list so the post
// `runMSSQLPatchAssessment` result agrees with the seeded `mssqlPatch` count.
interface DemoAvailablePatch {
    Classification: string;
    ContentUrl: string;
    Description: string;
    Id: string;
    KbNumber: string;
    Language: string;
    MsrcNumber: string;
    MsrcSeverity: string;
    Product: string;
    ProductFamily: string;
    ReleaseDate: string;
    Title: string;
    Vendor: string;
}

const MSSQL_DATABASE_AVAILABLE_PATCHES: DemoAvailablePatch[] = MSSQL_DATABASE_MISSING_PATCHES.map(
    ({ classification = '', kbId = '', releaseDate = '', severity = '', title = '' }) => ({
        Classification: classification,
        ContentUrl: `https://support.microsoft.com/en-us/kb/${kbId.replace(/^KB/i, '')}`,
        Description: '',
        Id: kbId,
        KbNumber: kbId,
        Language: 'All',
        MsrcNumber: '',
        MsrcSeverity: severity,
        Product: 'Microsoft SQL Server 2019',
        ProductFamily: 'SQL Server',
        ReleaseDate: releaseDate,
        Title: title,
        Vendor: 'Microsoft'
    })
);

// Empty installed-patches payload so every entry returned by
// `DescribeAvailablePatchesCommand` (above) is treated as missing by
// `runMSSQLPatchAssessment`. Production calls SSM via
// `GetCommandInvocationCommand`; this is the `StandardOutputContent` shape it
// expects (`{ "installedPatches": [...] }`).
const MSSQL_DATABASE_INSTALLED_PATCHES_OUTPUT = JSON.stringify({ installedPatches: [] });

export type { DemoInstancePatchState, DemoMissingPatch, DemoAvailablePatch };

export {
    ORACLE_INSTANCE_PATCH_STATE,
    MSSQL_INSTANCE_PATCH_STATE,
    ORACLE_MISSING_PATCHES,
    MSSQL_MISSING_PATCHES,
    MSSQL_DATABASE_AVAILABLE_PATCHES,
    MSSQL_DATABASE_INSTALLED_PATCHES_OUTPUT,
    resolveResourceTypeForInstanceId,
    buildDemoInstancePatchState,
    buildDemoMissingPatches
};
