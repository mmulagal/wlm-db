import { JsonValue } from '@prisma/client/runtime/library';
import type { database_instances as DatabaseInstances, resource as Resource } from '@prisma/client';
import { PlatformDifference, SavingsOpportunity } from '@aws-sdk/client-compute-optimizer';
import { GetCommandInvocationCommandOutput } from '@aws-sdk/client-ssm';
import { OracleDeploymentTenacy } from '../operations/workloads/oracle/consts';

enum DiscoverySource {
    DISCOVER = 'discover',
    TAGGING_SERVICE = 'tagging-service'
}

interface LicenseAssessment {
    licenseFinding: string;
    recommendedLicenseType: string;
    sqlServerInstances?: {
        sqlServerInstance: string;
        sqlServerState: string;
        sqlServerVersion: string;
        sqlServerProductYear: number;
        sqlServerEdition?: string;
        sqlServerEngineEdition?: number;
        sqlServerName?: string;
    }[];
}
interface ComputeAssessment {
    currentInstanceType: string;
    finding: string;
    findingReasonCodes: string[];
    recommendationOptions: {
        instanceType?: string;
        rank?: number;
        savingsOpportunity: SavingsOpportunity;
        platformDifferences: PlatformDifference[];
    }[];
}

interface HostOsPatchAssessmentObject {
    baselineId: string;
    criticalNonCompliantCount: number;
    otherNonCompliantCount: number;
    ec2InstanceId: string;
    ec2InstanceName?: string;
    operationStartTime: number;
    operationEndTime: number;
    securityNonCompliantCount: number;
    missingPatchDetails?: {
        classification?: string;
        kbId?: string;
        cveIds?: string;
        severity?: string;
        state?: string;
        title?: string;
    }[];
}

interface MSSQLPatchAssessmentObject {
    criticalMissingPatchesCount: number;
    ec2InstanceId: string;
    ec2InstanceName: string;
    importantMissingPatchesCount: number;
    missingPatchesCount: number;
    missingPatchDetails?: PatchDetail[];
}

interface PatchDetail {
    classification?: string;
    severity?: string;
    releaseDate?: string;
    title?: string;
    kbId?: string;
}

interface RssAdapter {
    adapterName: string;
    rssEnabled: boolean;
    rssProfile: string;
    baseProcessorNumber: number;
    numberOfReceiveQueues: number;
}

interface RssConfigAssesment {
    rssConfigFinding: string;
    recommendedAdapterSettings?: {
        recommendedReceiveQueues: number;
        recommendedRssProfile: string;
        recommendedBaseProcessorNumber: number;
    };
    rssAdapters?: RssAdapter[];
    tcpOffloadState: string;
    totalObjectsAssessed?: number;
    totalObjectsInViolation?: number;
}

interface MaxDOPAssesment {
    current: string;
    recommendedMaxDOP: string;
    status: string;
    vcpuCount?: number;
}

interface CrrDetails {
    volumeName: string;
    volumeUuid?: string;
    fsxVolumeId?: string;
    isCRREnabled: boolean;
    isSnapMirrored: boolean;
    sourceSvmUuid?: string;
    sourceSvmName?: string;
    peerClusterFsxId?: string | string[];
    peerSVMName?: string[];
    destinationPath?: string[];
    peerClusterName?: string[];
}
interface CrrAssessment {
    crrDetails: CrrDetails[];
    errorMessage?: string;
}
interface AWSBackupAssessment {
    fileSystemId: string;
    isAWSBackupEnabled: boolean;
    errorMessage?: string;
    volumeBackupDetails: VolumeBackupDetail[];
}

interface VolumeBackupDetail {
    uuid: string;
    name: string;
    isAWSBackupEnabled: boolean;
}

interface HighAvailabilityHeartbeatDetails {
    crossSiteDelay: number;
    sameSubnetDelay: number;
    crossSubnetDelay: number;
    crossSiteThreshold: number;
    sameSubnetThreshold: number;
    crossSubnetThreshold: number;
}

interface HighAvailabilityClusterQuorumDetails {
    isMajority: boolean;
    quorumType: number;
    isPhysicalDisk: boolean;
    quorumResourceName: string;
    isPhysicalDiskAndMajority: boolean;
}

interface HighAvailabilityIgroupDetails {
    igroupName: string;
    igroupUuid: string;
    initiatorNames: string[];
    hostIqnsChecked: string[];
}

interface HighAvailabilityLunDetails {
    status: string;
    lunName: string;
    lunUuid: string;
    igroupDetails: HighAvailabilityIgroupDetails;
}

interface HighAvailabilitySharedStorage {
    status: string;
    lunDetails: HighAvailabilityLunDetails[];
    error?: string;
}

interface HighAvailabilitySqlServerServiceDetail {
    name: string;
    status: string;
    startType: string;
    instanceId?: string;
}

interface HighAvailabilityClusterDriveLetterDetails {
    name: string;
    status: string;
    missingDriveLetters: string[];
    primaryNodeDriveLetters: string[];
    standbyNodeInstanceId?: string;
    error?: string;
}

interface HighAvailabilityAssessment {
    driveLetter?: {
        status: string;
        details: HighAvailabilityClusterDriveLetterDetails;
        error?: string;
    };
    sharedStorage?: HighAvailabilitySharedStorage;
    sqlServerServices?: {
        status: string;
        preferredNodeId?: string;
        nonPreferredNodeId?: string;
        nodesInViolation?: string[];
        totalNodes?: number;
        details: HighAvailabilitySqlServerServiceDetail[];
        nodeDetails?: { nodeId: string; current: string; recommended: string }[];
        error?: string;
    };
}

interface CloneDetail {
    databaseHostName: string;
    databaseHostId: string;
    databaseInstanceName: string;
    sourceDatabaseHostName?: string;
    sourceDatabaseInstanceName?: string;
    sourceDatabaseName?: string;
    cloneDatabaseName?: string;
    tag?: string | null;
    cloneAge?: number;
    clonedBy?: string;
    cloneSize?: number;
    clonedVolumeDetails?: ClonedVolumeDetail[];
}

interface ClonedVolumeDetail {
    cloneVolumeUuid?: string;
    cloneVolumeName?: string;
    sourceVolumeName?: string;
    cloneVolumeCreateTime?: string;
    cloneDatabaseName?: string;
    cloneVolumeType?: string;
}

interface CloneAssessment {
    status: string;
    cloneDetails?: CloneDetail[];
    oldClones?: number;
    oldCloneDetails?: CloneDetail[];
    oldCloneDatabaseNames?: string[];
}

interface MtuAlignmentAssessment {
    fsxMTU?: {
        error?: string | null;
        fsxInterfaces?: Array<{
            MTU: number;
            Name: string;
        }>;
    };
    sqlServerMTU?: {
        error?: string | null;
        sqlInterfaces?: Array<{
            ips?: Array<{
                family: string;
                address: string;
            }>;
            mtu: number;
            name: string;
            ipCount?: number;
            interfaceIndex: number;
            listeningPorts?: string;
        }>;
    };
}

interface ComputeHostOsAssessment {
    transparentHugepages?: {
        error?: string | null;
        'thp-value'?: string;
        'thp-status'?: string;
        'thp-disabled'?: boolean;
    };
    tcpAdvancedOptions?: {
        error?: string | null;
        'tcp-features'?: {
            'tcp-sack-value'?: string;
            'tcp-sack-enabled'?: boolean;
            'tcp-timestamps-value'?: string;
            'tcp-timestamps-enabled'?: boolean;
            'tcp-window-scaling-value'?: string;
            'tcp-window-scaling-enabled'?: boolean;
        };
    };
}

interface ResourceAssessmentData {
    license?: LicenseAssessment;
    compute?: ComputeAssessment;
    computeHostOs?: ComputeHostOsAssessment;
    hostOsPatch?: HostOsPatchAssessmentObject[];
    rssConfig?: RssConfigAssesment;
    maxDOP?: MaxDOPAssesment;
    clone?: CloneAssessment;
    mssqlPatch?: MSSQLPatchAssessmentObject[];
    mtuAlignment?: MtuAlignmentAssessment;
    highAvailability?: {
        heartbeat?: {
            status: string;
            details: HighAvailabilityHeartbeatDetails;
            error?: string;
        };
        clusterQuorum?: {
            status: string;
            details: HighAvailabilityClusterQuorumDetails;
            error?: string;
        };
        windowsClusterName: string;
    };
    aoagDetails?: {
        replicaRole: string;
        baseDeploymentType: string;
        replicaRoles?: Array<{ agName: string; replicaRole: string }>;
        databaseRoles?: Array<{ databaseName: string; agName: string; replicaRole: string }>;
    };
    lastAssessedDate?: string;
    errors?: {
        compute?: string;
        computeHostOs?: string;
        hostOsPatch?: string;
        rssConfig?: string;
        mssqlPatch?: string;
        license?: string;
        mtuAlignment?: string;
    };
}

interface ResourceAssessmentResults {
    license?: any;
    compute?: any;
    hostOsPatch?: any;
    rssConfig?: any;
    maxDOP?: any;
    mssqlPatch?: any;
}

interface Metadata {
    node1InstanceId: string;
    node2InstanceId?: string;
    sqlDeploymentType?: string;
    stackname?: string;
    activeDirectoryName?: string;
    activeDirectoryAddress?: string;
    creationDate?: string;
    fsxSvmId?: string;
    fsxDataVolumeName?: string;
    oracleDeploymentType?: OracleDeploymentTenacy;
    // this is used to retreive the newly created user databases in database list for demo
    userDatabase?: Array<UserDatabase>;
    sandboxes?: Array<Sandbox>;
    createDbMetrics?: CreateDbMetrics;
    sandboxCreated?: boolean;
    updatedManually?: boolean;
    storageProtocol?: string;
    isComputeOptimized?: boolean;
    isLicenseOptimized?: boolean;
    isHostOsPatchOptimized?: boolean;
    isRssConfigOptimized?: string[];
    oracleComputeHostOsDemoOptimized?: string[];
    isHeartBeatOptimized?: boolean;
    isClusterQuorumOptimized?: boolean;
    optimizedMtus?: string[];
    aoagDetails?: {
        baseDeploymentType: string;
    };
}

interface DatabaseInstanceMetadata {
    // this is used to retreive the newly created user databases in database list for demo
    userDatabase?: Array<UserDatabase>;
    sandboxes?: Array<Sandbox>;
    configsOptimized?: any;
    oracleDeploymentType?: OracleDeploymentTenacy;
    numberOfTimesAssessedOffline?: number;
}

interface DismissConfig {
    id: string;
    configState: string;
    startTime: number;
    endTime?: number;
    reactivationReason?: string;
}

interface CreateDbMetrics {
    numberofUserDbsCreated: number;
}

interface IsAWSBackup {
    fsxn: boolean;
    fsxw: boolean;
    ebs: boolean;
}

interface UserDatabaseLunFile {
    name: string;
    driveLetter: string;
}

interface UserDatabaseLuns {
    dataFiles: UserDatabaseLunFile[];
    logFiles: UserDatabaseLunFile[];
}

interface UserDatabase {
    name: string;
    databaseInstanceName?: string;
    size: number;
    status: string;
    type: string;
    protection?: {
        isAwsBackupEnabled: IsAWSBackup;
        isFsxOntapSnapshotsEnabled: boolean;
        isSqlNativeEnabled: boolean;
        isCRREnabled: boolean;
        isAppConsistentBackupEnabled?: boolean | string;
    };
    luns?: UserDatabaseLuns;
    collation: string;
}

interface Sandbox {
    databaseName: string;
    createdAt: number;
    updatedAt: number;
    source: string;
    tag: string;
    baseSnapshot?: string;
    databaseInstanceId?: string;
}

interface NodeDetails {
    ec2InstanceId: string;
    ec2InstancePrivateIpAddress?: string;
    ec2InstanceName?: string;
    ec2InstanceType: string;
    ec2UsageOperation?: string;
    ec2InstancePrivateDnsName?: string;
}
interface ResourceDetails {
    id: string | null; // the value is null when the resource is not found in the database; in case of unmanaged hosts the DB record is not created.
    account_id: string;
    resource_id: string;
    resource_name: string | null;
    resource_type: string;
    co_relation_id: string | null;
    cloud_provider_account_id: string | null;
    cloud_provider_name: string | null;
    region: string | null;
    credentials_id: string;
    storage_type?: string;
    metadata: unknown;
    ebsVolumeIds?: string[]; // internal field used to store the ebs volume id for the unmanaged MSSQL resource
    fsxwId?: string; // internal field used to store the windows fsx ID for the unmanaged MSSQL resource,
    sqlServerDeploymentType?: string;
    clusterNodeDetails?: NodeDetails[];
    database_instances?: DatabaseInstance[];
    ec2UsageOperation?: string; // internal field used to store the ec2 usage operation for the unmanaged MSSQL resource
    configurations?: DismissConfig[] | JsonValue;
    assessment_data?: ResourceAssessmentData | JsonValue;
    assessment_results?: ResourceAssessmentResults | JsonValue;
}

interface DeploymentDetails {
    id: string;
    account_id: string;
    deployment_id: string;
    parent_deployment_id?: string;
    deployment_name: string;
    cloud_provider_account_id?: string;
    cloud_provider_name?: string;
    region: string;
    credentials_id: string;
    deployment_status: string;
    deployment_model?: string;
    deployment_status_reason?: string;
    start_time: string;
    end_time: string;
    data: unknown;
}

interface NetworkViolation {
    isViolated: boolean;
    violationMessage?: string;
}

interface Subnet {
    id?: string;
    name?: string;
    state?: string;
    vpcId?: string;
    tags?: Array<{ Key?: string; Value?: string }>;
    cidrBlock?: string;
    availabilityZone?: string;
    availableIps?: number;
    routeTableId?: string;
}
interface SecurityGroup {
    id?: string;
    description?: string;
    vpcId?: string;
    ipPermissions?: any;
    name?: string;
    securityGroupName?: string;
}
interface VPC {
    id?: string;
    state?: string;
    cidrBlock?: any;
    tags?: Array<{ Key?: string; Value?: string }>;
    isDefault?: boolean;
    subnets?: Array<Subnet>;
    securityGroups?: Array<SecurityGroup>;
    name?: string;
}

interface NetworkInterface {
    id?: string;
    description?: string;
    vpcId?: string;
    subnetId?: string;
    securityGroups?: Array<string>;
    availabilityZone?: string;
}

type SqlCredential = { sqlinstancename: string; username: string; password: string };
type OracleCredential = { oracleinstancename: string; username: string; password: string };

interface SSMParameterObject {
    path: string;
    value: {
        [key: string]: { username: string; password: string } | Array<SqlCredential | OracleCredential>;
    };
}

interface MissingPermission {
    service: string;
    action: string;
    reason: string;
}
interface MissingPermissionInterface {
    implicitlyDenied: MissingPermission[];
    explicitlyDenied: MissingPermission[];
}

interface DatabaseInstance {
    database_instance_name: string;
    instanceState?: string;
    database_instance_id: string;
    database_type: string;
    is_default: boolean;
    metadata: DatabaseInstanceMetadata | JsonValue;
    created_time?: string | Date;
    database_deployment_type?: string;
    fsxn_ids: string;
    credentials_id: string;
    fsx_svm_id?: JSON | JsonValue;
    fsxwId?: string;
    ebsVolumeIds?: string[];
    storage_protocol?: string | null;
    region: string;
    databaseType?: string;
    storage_type?: string;
    sqlAuthEnabled?: boolean;
    isManaged?: boolean;
    resource: ResourceDetails;
    configurations?: DismissConfig[] | JsonValue;
    crrConfigData?: { crrDetails: CrrDetails[] };
    account_id?: string;
    resource_id?: string;
}

interface InstanceDetails {
    instanceName: string;
    instanceState: string;
    isDefault?: boolean;
    sqlAuthEnabled?: boolean;
}

interface PgSqlInstanceDetails {
    databaseInstanceId: string;
    instanceName: string;
    isManaged: boolean;
    instanceState: string;
    isDefault: boolean;
}

interface OracleInstanceDetails {
    databaseInstanceId: string;
    instanceName: string;
    isManaged: boolean;
    instanceState: string;
    isDefault: boolean;
}

interface WorkloadInstance {
    id: string;
    name: string;
    type: string;
    region: string;
    sqlAuthEnabled: boolean;
    fsxFileSystem: string;
    activeNodeInstanceid: string;
    mappedVolumeNames?: string[];
    mappedVolumesUuids?: string[];
    mappedVolumeError?: string;
    mappedLunNames?: string[];
    mappedLunUuids?: string[];
    mappedVolumeJunctionPaths?: string[];
    mappedVolumeLunPaths?: string[];
    mappedDiskGroups?: string[];
    cloudProviderAccountId?: string; // Refers to AWS account ID
    resourceName: string;
    svmId?: string;
    svmOntapUuid?: string | string[];
    svmOntapName?: string | string[];
    databaseInstanceObject?: DatabaseInstance;
    storageProtocol?: string;
    isASMManaged?: boolean;
    redoVolumeNames?: string[];
}
interface LogDriveDetails {
    lunUuid: string;
    svmName: string;
    databaseName: string;
    logAccessPath: string;
    dataAccessPath: string;
    logDriveLetter: string;
    dataDriveLetter: string;
    ontapVolumeName: string;
    ontapVolumeUuid: string;
    logDriveTotalSizeMB: number;
    dataDriveTotalSizeMB: number;
    diskNumber: number;
    sizePercentToDataDrive: number;
}

interface TempDbDriveDetails {
    lunUuid: string;
    svmName: string;
    ontapVolumeName: string;
    ontapVolumeUuid: string;
    tempdbDrivePath: string;
    tempdbDriveLetter: string;
    dataDriveTotalSizeMB: number;
    defaultDataDriveLetter: string;
    tempdbDriveTotalSizeMB: number;
    sizePercentToDataDrive: number;
}

interface Sizing {
    'performance-tier': boolean | Array<number> | Array<{ volumeName: string; performanceTierPercent: number }>;
    'data-log-drive-details': LogDriveDetails[];
    'data-tempdb-drive-details': TempDbDriveDetails;
}

interface UserDatabaseLayout {
    name: string;
    lunPath: string;
    lunUuid: string;
    svmName: string;
    fileName: string;
    sizeInMb: number;
    lunSerialNumber: string;
    ontapVolumeName: string;
    ontapVolumeUuid: string;
}

interface StorageLayout {
    'user-database-layout:': { log: [UserDatabaseLayout]; data: [UserDatabaseLayout] };
    'tempdb-files-location': string;
    'default-log-files-location': string;
    'default-data-files-location': string;
}

interface OSAssessment {
    'mpio-enabled': boolean;
    'mpio-iscsi-count': number;
    'ntfs-allocation-details': Array<{ Key?: string; Value?: string }>;
    'mpio-load-balance-policy': string;
    'ntfs-allocation-unit-size': number;
    'mpio-timeout': number;
}

interface StorageAssessment {
    filesystemId: string;
    volumes: Array<{ Key?: string; Value?: string }>;
    luns: Array<{ Key?: string; Value?: string }>;
    os: OSAssessment;
    layout: JSON;
    sizing: Sizing;
    errors: {
        volumes: string;
        luns: string;
        'volumes-footprint': string;
        layout: string;
        sizing: string;
        'mpio-policy': string;
        'iscsi-sessions': string;
        'ntfs-allocation': string;
        'tempdb-files-location': string;
        'default-log-files-location': string;
        'default-data-files-location': string;
        'data-tempdb-drive-details': string;
        spaceMgmtTryFirst: string;
    };
}

interface DriftAssessmentJob {
    accountId: string;
    credentialsId: string;
    region: string;
    resourceId: string;
    managedInstanceIds: string[];
}
interface OntapRequestParams {
    fsxId: string;
    region: string;
    apiEndpoint: string;
    apiQueryFilter: string;
}
interface OptimizeStorageParams extends OntapRequestParams {
    apiBody: string;
    apiType?: string;
}

type VolumeSpaceRecord = {
    uuid: string;
    name: string;
    efficiency: {
        space_savings: {
            total: number;
            total_percent: number;
        };
    };
    space: {
        size: number;
        used: number;
        physical_used?: number;
        performance_tier_footprint?: number;
        capacity_tier_footprint?: number;
        snapshot?: {
            used?: number;
        };
    };
};

interface OptimizeParams {
    accountId: string;
    region: string;
    credentialsId: string;
    parentJobId: string;
    fsxId: string;
    instanceId: string;
    instanceName: string;
    databaseType: string;
    sqlAuthEnabled: boolean;
    serverNameWithHostName: string;
    databaseHostId: string;
    databaseInstanceId: string;
    activeNodeInstanceId?: string;
    standbyNodeInstanceId?: string;
    awsAccountId: string;
    instanceMetadata: any;
    sqlDeploymentType: string;
}

interface OptimizeMpioPolicyParams extends OptimizeParams {
    activeNodeName?: string;
    standbyNodeName?: string;
    changeClusterOwnership?: boolean;
    activeNodeCurrentPolicy?: string;
    standbyNodeCurrentPolicy?: string;
}

interface SessionsCountPerIscsiTarget {
    address: string;
    count: number;
}
interface OptimizeMpioIscsiSessionsParams extends OptimizeParams {
    svmId: string;
    iscsiTargetAddresses: string[];
    currentMpioSessionsCount: SessionsCountPerIscsiTarget[];
}

interface OptimizeMpioTimeoutParams extends OptimizeParams {
    ssmCommand: string;
}

interface DatabaseInstancesIncludingResource extends DatabaseInstances {
    resource: Resource;
}

interface StorageTierParams extends OptimizeParams {
    svmId: string;
    svmName: string;
    volumesToOptimize?: string[];
}

interface AwsFsxNBackupConfig {
    automaticBackupRetentionDays: number;
    dailyAutomaticBackupStartTime: string;
}

type MultipleCommandSsmResponse = {
    commandId: string;
    instanceId: string;
    response?: GetCommandInvocationCommandOutput;
    error?: string;
};

interface SsmSqlServerRunningStatus {
    name: string;
    status: string;
}

interface SVM {
    uuid: string;
    _links: {
        self: {
            href: string;
        };
    };
}

interface ParentVolume {
    name: string;
}

interface Clone {
    is_flexclone?: boolean;
    parent_volume?: ParentVolume;
}

interface VolumeSpace {
    size?: number;
    used?: number;
    physical_used?: number;
}

interface VolumeRecord {
    uuid: string;
    create_time?: string;
    name: string;
    snapshot_count?: number;
    clone?: Clone;
    svm?: SVM;
    fsxVolumeId?: string;
    space?: VolumeSpace;
}

interface LunRecord {
    uuid: string;
    name: string;
    serial_number: string;
    driveLetter?: string;
    ontapVolumeuuid?: string;
}
interface VolumeDBMapEntry {
    ontapVolumeuuid: string;
    databaseName: string;
    dataLunUuids?: string[];
    logLunUuids?: string[];
}

interface MappedDatabaseSummary {
    databaseId?: number;
    databaseName: string;
    creationDate?: string;
    databaseStatus?: string;
    databaseSize?: number;
    collationName?: string;
    availabilityGroup?: string;
    replicaRole?: string;
    synchronizationState?: string;
    isReadableSecondary?: number;
}

interface SqlNativeBackupEnabledDatabase {
    backedupDatabases: string;
}

interface MappedOnTapVolumeResponse {
    volumeRecords: VolumeRecord[];
    volumeDBMap: VolumeDBMapEntry[];
    lunRecords: LunRecord[];
    lunNames?: string[]; // Optional, used in some contexts
    databasesSummary?: MappedDatabaseSummary[];
    sqlNativeBackupEnabledDatabases?: SqlNativeBackupEnabledDatabase[];
}
interface InstancesResponse {
    [key: string]: MappedOnTapVolumeResponse;
}

interface DatabaseVolumeMapRow {
    DatabaseName: string;
    VolumeName: string;
    VolumeId: string;
    FileType: number;
    MountPoint: string;
}

interface MappedVolumesHostData {
    serialNumbers: string[];
    volumeSerialMapping: Record<string, string>;
    databaseVolumeMap: DatabaseVolumeMapRow[];
    cifsShareNames: string[];
    databasesSummary: MappedDatabaseSummary[];
    sqlNativeBackupEnabledDatabases: SqlNativeBackupEnabledDatabase[];
}

interface BulkDismissConfigurationType {
    configurationName: string;
    configState: string;
    databaseHosts: Array<{
        id: string;
        sqlServerInstances: string[];
        credentialsId: string;
        region: string;
        status?: string;
        failedInstances?: Array<{
            databaseHostId: string;
            instanceId?: string;
            errorMessage: string;
        }>;
    }>;
}

interface DismissGroup {
    credentialsId: string;
    region: string;
    hostId: string;
    instanceId?: string; // Present for instance-level configs; absent for host-level configs.
    configs: Array<DismissConfig & { configIndex: number }>;
}

// Bulk dismiss operation interfaces
interface BulkDismissConfigurationResponseItem extends BulkDismissConfigurationType {
    startTime: number;
    endTime?: number;
}

interface PerHostJobMetadata {
    optimizationType: string;
    resourceId: string;
    sqlServerInstances: Array<string>;
}

interface JobMetadata {
    hostsToOptimize: Array<PerHostJobMetadata>;
}

interface MappedVolumeResponseForClone {
    volumeMapping: MappedOnTapVolumeResponse;
    fsxId: string;
    activeNodeInstanceId: string;
}

interface AWSSDKCacheParams {
    useCache?: boolean;
    ttl?: number;
    credentialsId?: string; // Optional credentials ID for cache key generation
}

interface FSxCredsRegistration {
    fsxId: string;
    ontapconnectivity: boolean;
    ontaperror?: string;
}

interface DatabaseInstanceRegistration {
    sqlInstanceName: string;
    sqlInstanceConnectivity: boolean;
    sqlerror?: string;
    sqlEdition?: string;
    noOfDatabases?: number;
    sqlPermissions?: string[];
    availablePsModules?: string[];
}

interface OracleInstanceRegistration {
    oracleInstanceName: string;
    oracleInstanceConnectivity: boolean;
    oracleError?: string;
    oracleEdition?: string;
    isDataGuardConfigured?: string;
    dataGuardDetails?: any;
}

interface IgroupMissingInitiators {
    igroupName: string;
    igroupUuid: string;
    missingIqns: string[];
}

interface SSMDocument {
    documentName: string;
    documentVersion: string;
}

enum TrackerTaskStatus {
    PENDING = 'pending',
    SUCCESS = 'success',
    FAILURE = 'failure'
}

interface TaskCreate {
    id?: string;
    status: TrackerTaskStatus;
    actionName: string;
    actionDescription?: string;
    resourceId?: string;
    resourceName?: string;
    parentTaskId?: string;
    principal?: string;
    region?: string;
    failureReason?: string[];
}

interface TaskUpdateParams {
    status: TrackerTaskStatus.SUCCESS | TrackerTaskStatus.FAILURE;
    failureReason?: string[];
}

interface SsmTargetsInfo {
    ec2InstanceId: string;
    ec2InstanceName: string;
    ec2InstanceType: string;
    ec2UsageOperation: string;
    ssmState: string;
    ebsVolumeIDs: (string | undefined)[] | undefined;
    platform?: string;
    source: DiscoverySource;
    hostManageReadiness?: {
        extensiveRunPermission: boolean;
        canReadAWSSSMDocuments?: boolean;
        canQuerySSMInventory?: boolean;
        fsxLinkExists?: boolean;
        fsxLinksCount?: number;
    };
    vpc?: {
        id?: string;
        name?: string;
        cidrBlock?: string;
    };
}
interface OneTimeWADHeadroomData {
    ssdStorageCapacityInBytes?: number;
    storageUsedInBytes?: number;
    storageAvailableInBytes?: number;
    headroomPercent?: number;
    aggregateCount?: number;
}

export {
    BulkDismissConfigurationType,
    Metadata,
    NodeDetails,
    ResourceDetails,
    OneTimeWADHeadroomData,
    DeploymentDetails,
    NetworkViolation,
    SecurityGroup,
    Subnet,
    VPC,
    NetworkInterface,
    SSMParameterObject,
    UserDatabase,
    UserDatabaseLunFile,
    UserDatabaseLuns,
    MissingPermission,
    MissingPermissionInterface,
    DatabaseInstanceMetadata,
    Sandbox,
    DatabaseInstance,
    InstanceDetails,
    WorkloadInstance,
    LogDriveDetails,
    TempDbDriveDetails,
    StorageAssessment,
    DriftAssessmentJob,
    OntapRequestParams,
    OptimizeStorageParams,
    VolumeSpaceRecord,
    OptimizeMpioPolicyParams,
    StorageLayout,
    DatabaseInstancesIncludingResource,
    DatabaseInstances,
    Resource,
    StorageTierParams,
    ComputeAssessment,
    LicenseAssessment,
    HostOsPatchAssessmentObject,
    MSSQLPatchAssessmentObject,
    OptimizeMpioIscsiSessionsParams,
    SessionsCountPerIscsiTarget,
    PgSqlInstanceDetails,
    OracleInstanceDetails,
    RssConfigAssesment,
    MaxDOPAssesment,
    PatchDetail,
    AwsFsxNBackupConfig,
    MultipleCommandSsmResponse,
    SsmSqlServerRunningStatus,
    CloneAssessment,
    CloneDetail,
    VolumeSpace,
    VolumeRecord,
    LunRecord,
    MappedOnTapVolumeResponse,
    InstancesResponse,
    VolumeDBMapEntry,
    MappedDatabaseSummary,
    SqlNativeBackupEnabledDatabase,
    DatabaseVolumeMapRow,
    MappedVolumesHostData,
    AWSBackupAssessment,
    ResourceAssessmentData,
    ClonedVolumeDetail,
    MappedVolumeResponseForClone,
    DismissConfig,
    CrrAssessment,
    CrrDetails,
    OptimizeMpioTimeoutParams,
    AWSSDKCacheParams,
    FSxCredsRegistration,
    DatabaseInstanceRegistration,
    OracleCredential,
    TaskCreate,
    TaskUpdateParams,
    SqlCredential,
    OracleInstanceRegistration,
    HighAvailabilityAssessment,
    IgroupMissingInitiators,
    HighAvailabilitySharedStorage,
    UserDatabaseLayout,
    DismissGroup,
    BulkDismissConfigurationResponseItem,
    PerHostJobMetadata,
    JobMetadata,
    SSMDocument,
    ComputeHostOsAssessment,
    TrackerTaskStatus,
    MtuAlignmentAssessment,
    SsmTargetsInfo,
    DiscoverySource
};
