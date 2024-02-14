interface Metadata {
    node1InstanceId: string;
    node1InstanceName?: string;
    node2InstanceId?: string;
    node2InstanceName?: string;
    sqlDeploymentType?: string;
    fsxSecret?: string;
    activeDirectoryName?: string;
    activeDirectoryAddress?: string;
    creationDate?: string;
}

interface ResourceDetails {
    id: string;
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

export { Metadata, ResourceDetails, DeploymentDetails, NetworkViolation, SecurityGroup, Subnet, VPC, NetworkInterface };
