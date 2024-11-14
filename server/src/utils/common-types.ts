import { JsonValue } from '@prisma/client/runtime/library';

interface Metadata {
    node1InstanceId: string;
    node2InstanceId?: string;
    sqlDeploymentType?: string;
    stackname?: string;
    activeDirectoryName?: string;
    activeDirectoryAddress?: string;
    creationDate?: string;
    fsxSvmId?: string;
    // this is used to retreive the newly created user databases in database list for demo
    userDatabase?: Array<UserDatabase>;
    sandboxes?: Array<Sandbox>;
    createDbMetrics?: CreateDbMetrics;
    sandboxCreated?: boolean;
    updatedManually?: boolean;
    storageProtocol?: string;
}
interface databaseInstanceMetadata {
    // this is used to retreive the newly created user databases in database list for demo
    userDatabase?: Array<UserDatabase>;
    sandboxes?: Array<Sandbox>;
}

interface CreateDbMetrics {
    numberofUserDbsCreated: number;
}

interface IsAWSBackup {
    fsxn: boolean;
    fsxw: boolean;
    ebs: boolean;
}

interface UserDatabase {
    name: string;
    size: number;
    status: string;
    type: string;
    protection: { isAwsBackupEnabled: IsAWSBackup; isFsxOntapSnapshotsEnabled: boolean; isSqlNativeEnabled: boolean };
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
    ec2InstancePrivateIpAddress: string;
    ec2InstanceName?: string;
    ec2InstanceType: string;
    ec2UsageOperation?: string;
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
    databaseInstanceDetails?: DatabaseInstance[];
    ec2UsageOperation?: string; // internal field used to store the ec2 usage operation for the unmanaged MSSQL resource
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

interface SSMParamterObject {
    path: string;
    value: {
        [key: string]:
            | {
                  username: string;
                  password: string;
              }
            | {
                  sqlinstancename: string;
                  username: string;
                  password: string;
              }[];
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
    metadata: databaseInstanceMetadata | JsonValue;
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
}

interface InstanceDetails {
    instanceName: string;
    instanceState: string;
    isDefault?: boolean;
    sqlAuthEnabled?: boolean;
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
    mappedLunNames?: string[];
    mappedLunUuids?: string[];
    cloudProviderAccountId: string;
    resourceName: string;
}
interface LogDriveDetails {
    databaseName: string;
    logDriveLetter: string;
    dataDriveLetter: string;
    logDriveTotalSizeMB: number;
    dataDriveTotalSizeMB: number;
    lunUuid: string;
    svmName: string;
    ontapVolumeName: string;
    ontapVolumeUuid: string;
}
interface TempDbDriveDetails {
    tempdbDriveLetter: string;
    dataDriveTotalSizeMB: number;
    defaultDataDriveLetter: string;
    tempdbDriveTotalSizeMB: number;
    lunUuid: string;
    svmName: string;
    ontapVolumeName: string;
    ontapVolumeUuid: string;
}
interface Sizing {
    'performance-tier': string;
    'data-log-drive-details': LogDriveDetails;
    'data-tempdb-drive-details': TempDbDriveDetails;
}
interface StorageAssessment {
    filesystemId: string;
    volumes: Array<{ Key?: string; Value?: string }>;
    luns: Array<{ Key?: string; Value?: string }>;
    os: Array<{ Key?: string; Value?: string }>;
    layout: JSON;
    sizing: Sizing;
}

interface DriftAssessmentJob {
    accountId: string;
    credentialsId: string;
    region: string;
    resourceId: string;
    managedInstanceIds: string[];
}

interface OptimizeStorageParams {
    fsxId: string;
    region: string;
    apiEndpoint: string;
    apiQueryFilter: string;
    apiBody: string;
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
    };
};

export {
    Metadata,
    NodeDetails,
    ResourceDetails,
    DeploymentDetails,
    NetworkViolation,
    SecurityGroup,
    Subnet,
    VPC,
    NetworkInterface,
    SSMParamterObject,
    UserDatabase,
    MissingPermission,
    MissingPermissionInterface,
    databaseInstanceMetadata,
    Sandbox,
    DatabaseInstance,
    InstanceDetails,
    WorkloadInstance,
    LogDriveDetails,
    TempDbDriveDetails,
    StorageAssessment,
    DriftAssessmentJob,
    OptimizeStorageParams,
    VolumeSpaceRecord
};
