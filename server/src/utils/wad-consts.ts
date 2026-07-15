// ─── Enums ───────────────────────────────────────────────────────────────────

enum ResourceOptimizationStatus {
    OPTIMIZED = 'OPTIMIZED',
    NOT_OPTIMIZED = 'NOT_OPTIMIZED',
    FIX_IN_PROGRESS = 'FIX_IN_PROGRESS'
}

enum TaskStatus {
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED'
}

enum ScanTrigger {
    MANUAL = 'MANUAL',
    SCHEDULED = 'SCHEDULED'
}

// ─── Base types ───────────────────────────────────────────────────────────────

interface ResourceRef {
    id: string;
    type: string;
}

interface ParentResource {
    id: string;
    name: string;
    type: string;
    accountId: string;
    region: string;
    credentialsIds: string[];
}

interface ParentResourceWithScopeForFix {
    id: string;
    region: string;
    credentialsIds: string[];
}

// ─── Scan / fix result records ────────────────────────────────────────────────

interface WadResourceEntry {
    resource: {
        id: string;
        type: string;
        name: string;
        workload?: string;
        metadata?: Record<string, unknown>;
    };
    status: ResourceOptimizationStatus;
}

interface WadConfigurationEntry {
    configurationId: string;
    parentResource: ParentResource;
    resources: WadResourceEntry[];
}

interface WadScanResultRecord {
    taskId: string;
    requestId: string;
    accountId: string;
    serviceId: string;
    completedAt: number;
    configurations: WadConfigurationEntry[];
}

interface DriftAssessmentDetail {
    id: string;
    name: string;
    currentValue: string;
    recommendedValue: string;
    status: string;
    svmName?: string;
}

interface DriftAssessmentItem {
    id: string;
    resourceType?: string;
    assessmentDetails?: DriftAssessmentDetail[];
}

interface FixResourceResult {
    resourceId: string;
    success: boolean;
    failureReason?: string;
}

// ─── Message types ────────────────────────────────────────────────────────────

interface WadScanContext {
    taskId: string;
    requestId: string;
    accountId: string;
    serviceId: string;
    configurationIds: string[];
    credentialsId: string;
    region: string;
    filesystemId: string;
    workload: string;
    svmName?: string;
}

interface ScanRequestMessage {
    taskId: string;
    requestId: string;
    accountId: string;
    serviceId: string;
    triggerMode: ScanTrigger;
    credentialsIds: string[];
    regions: string[];
    configurationIds: string[];
    triggeredAt: number;
    parentResource?: ResourceRef;
    trackerParentTaskId?: string;
    isSimulated?: boolean;
}

interface FixRequestMessage {
    taskId: string;
    requestId: string;
    accountId: string;
    serviceId: string;
    configurationId: string;
    parentResource: ParentResourceWithScopeForFix;
    resourceIds: string[];
    triggeredAt: number;
    trackerParentTaskId?: string;
    isSimulated?: boolean;
    metadata?: Record<string, unknown>;
}

interface ScanStatusMessage {
    taskId: string;
    requestId: string;
    accountId: string;
    serviceId: string;
    updatedAt: number;
    status: TaskStatus;
    errorMessage?: string;
    parentResources?: ResourceRef[];
}

interface FixStatusMessage {
    taskId: string;
    requestId: string;
    accountId: string;
    serviceId: string;
    configurationId: string;
    parentResourceId: string;
    updatedAt: number;
    status: TaskStatus;
    errorMessage?: string;
}

interface FixResultMessage {
    taskId: string;
    requestId: string;
    accountId: string;
    serviceId: string;
    configurationId: string;
    parentResourceId: string;
    resourceResults: FixResourceResult[];
    reportedAt: number;
}

const WAD_FILESYSTEM_RESOURCE_TYPE = 'FILESYSTEM';

// ─── Queue names ──────────────────────────────────────────────────────────────

const WAD_SERVICE_ID = process.env.WAD_SERVICE_ID || 'wlmdb';

const WAD_SCAN_REQUESTS_QUEUE = `wad.${WAD_SERVICE_ID}.scan.requests`;
const WAD_FIX_REQUESTS_QUEUE = `wad.${WAD_SERVICE_ID}.fix.requests`;
const WAD_SCAN_RESULTS_QUEUE = 'wad.scan.results';
const WAD_SCAN_STATUS_QUEUE = 'wad.scan.status';
const WAD_FIX_RESULTS_QUEUE = 'wad.fix.results';
const WAD_FIX_STATUS_QUEUE = 'wad.fix.status';

export {
    ResourceOptimizationStatus,
    TaskStatus,
    ScanTrigger,
    WadResourceEntry,
    WadConfigurationEntry,
    WadScanResultRecord,
    DriftAssessmentDetail,
    DriftAssessmentItem,
    FixResourceResult,
    WadScanContext,
    ScanRequestMessage,
    FixRequestMessage,
    ScanStatusMessage,
    FixStatusMessage,
    FixResultMessage,
    WAD_FILESYSTEM_RESOURCE_TYPE,
    WAD_SERVICE_ID,
    WAD_SCAN_REQUESTS_QUEUE,
    WAD_FIX_REQUESTS_QUEUE,
    WAD_SCAN_RESULTS_QUEUE,
    WAD_SCAN_STATUS_QUEUE,
    WAD_FIX_RESULTS_QUEUE,
    WAD_FIX_STATUS_QUEUE
};
