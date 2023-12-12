interface Metadata {
    credentialsId: string;
    activeNodeInstanceId: string;
    activeNodeInstanceName?: string;
    standbyNodeInstanceId?: string;
    standbyNodeInstanceName?: string;
    fsxSecret?: string;
    activeDirectoryName?: string;
    activeDirectoryAddress?: string;
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

export { Metadata, ResourceDetails, DeploymentDetails };
