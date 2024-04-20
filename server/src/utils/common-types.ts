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
    createDbMetrics?: CreateDbMetrics;
    sandboxCreated?: boolean;
    updatedManually?: boolean;
}

interface CreateDbMetrics {
    numberofUserDbsCreated: number;
}
interface UserDatabase {
    name: string;
    size: number;
    status: string;
    type: string;
    protection: { isAWSBackupEnabled: boolean; isFsxOntapSnapshotsEnabled: boolean; isSqlNativeEnabled: boolean };
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
    storage_type: string;
    metadata: unknown;
    ebsVolumeIds?: string[]; // internal field used to store the ebs volume id for the unmanaged MSSQL resource
    fsxwId?: string; // internal field used to store the windows fsx ID for the unmanaged MSSQL resource
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

export {
    Metadata,
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
    MissingPermissionInterface
};
