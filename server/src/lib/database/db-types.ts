import { DEPLOYMENT_MODEL, DEPLOYMENT_STATUS, Prisma, STORAGE_TYPE } from '@prisma/client';
import { JsonValue } from '@prisma/client/runtime/binary';
import {
    CrrDetails,
    DatabaseInstanceConfigurations,
    DatabaseInstanceMetadata,
    ResourceDetails
} from '../../utils/common-types';

interface Deployment {
    deploymentId: string;
    parentDeploymentId?: string;
    deploymentName: string;
    cloudProviderAccountId?: string;
    cloudProviderName?: string;
    credentialsId: string;
    deploymentStatus: DEPLOYMENT_STATUS;
    deploymentModel: DEPLOYMENT_MODEL;
    deploymentStatusReason?: string;
    startTime: number;
    endTime?: number;
    region: string;
    data?: object;
}

interface Event {
    eventId: string;
    accountId: string;
    deploymentId: string;
    deploymentName: string;
    eventStatus: DEPLOYMENT_STATUS;
    eventStatusReason: string;
    resourceType: string;
    time: number;
    data?: object;
}

interface Resource {
    resourceId: string;
    credentialsId: string;
    storageType: STORAGE_TYPE;
    resourceName?: string;
    resourceType: string;
    coRelationId?: string;
    cloudProviderAccountId?: string;
    cloudProviderName?: string;
    region: string;
    metadata?: object;
    assessmentData?: object;
}

interface Config {
    user?: string;
    creationTime?: number;
    name: string;
    data?: object;
    databaseType?: string;
}

interface DatabaseInstanceRecord {
    credentialsId: string;
    resourceId: string;
    region: string;
    databaseInstanceId: string;
    databaseInstanceName: string;
    fsxnIds: string;
    isDefault: boolean;
    source: string;
    sqlDeploymentType: string;
    fsxSvmId: object;
    storageProtocol?: string;
    numberofUserDbsCreated?: number;
    sandboxCreated?: boolean;
    metaData?: DatabaseInstanceMetadata;
    databaseType: string;
    storageType?: string;
    configurations?: DatabaseInstanceConfigurations;
}

interface ListDatabaseInstancesRecord {
    resourceId?: string;
    databaseInstanceId?: string;
    databaseInstanceName?: string;
    isDefault?: boolean;
    credentialsId?: string;
    region?: string | null;
    databaseType?: string[];
    selectKeys?: string[];
    shouldIncludeResource?: boolean;
    additionalResourceFields?: string[];
    pageSize?: number;
    nextToken?: string;
}

interface DatabaseInstanceDetails {
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
    configurations?: DatabaseInstanceConfigurations | JsonValue;
    crrConfigData?: { crrDetails: CrrDetails[] };
}
interface DatabaseInstanceConfigData {
    id?: string;
    account_id: string;
    credentials_id: string;
    region: string;
    resource_id: string;
    database_instance_id: string;
    creation_time: Date;
    last_updated?: Date;
    config_data: any;
    config_data_type: string;
    database_instances?: DatabaseInstanceDetails; // Required when includeDatabaseInstance is true
    resource?: ResourceDetails; // Required when includeResource is true
}
interface ListDatabaseInstanceConfigDataParams {
    accountId?: string;
    region?: string;
    credentialsId?: string;
    resourceId?: string;
    databaseInstanceIds?: string[];
    configDataType?: string;
    pageSize?: number;
    nextToken?: string;
    includeDatabaseInstance?: boolean;
    includeResource?: boolean;
    select?: Prisma.database_instance_config_dataSelect;
    filters?: Record<string, any>;
}

type CountDatabaseInstanceConfigRecordsParams = Omit<
    ListDatabaseInstanceConfigDataParams,
    'include' | 'select' | 'pageSize' | 'nextToken'
>;

interface ListResourcesParams {
    accountId?: string;
    resourceId?: string;
    credentialIds?: string | string[];
    region?: string | string[];
    resourceType?: string | string[];
    fsxId?: string;
    metaFilters?: { [x: string]: string | number | boolean };
    pageSize?: number;
    nextToken?: string;
    includeDatabaseInstances?: boolean;
    selectKeys?: string[];
}

interface GetResourcesParams {
    accountId?: string;
    resourceId?: string;
    credentialsId?: string | string[];
    region?: string | string[];
    resourceType?: string | string[];
    pageSize?: number;
    nextToken?: string;
    includeDatabaseInstances?: boolean;
    allRecords?: boolean;
    assessmentData?: boolean;
}
interface PaginatedDatabaseInstancesResponse {
    items: any[];
    nextToken?: string;
    totalCount: number;
}

interface ListTrackedEc2Params {
    feature: string;
    accountId?: string;
    region?: string;
    credentialsId?: string;
    instanceId?: string;
    awsAccountId?: string;
    pageSize?: number;
    nextToken?: string;
}

interface TrackedEc2Record {
    account_id: string;
    region: string;
    credentials_id: string;
    instance_id: string;
    feature: string;
    cloud_provider_account_id: string;
    last_updated?: Date;
}

type TrackedEc2RecordFilters = Partial<TrackedEc2Record>;

interface AccountIdCredRegionParams {
    accountId: string;
    credentialsIdList?: string[];
    regionList?: string[];
}

interface GroupedDatabaseInstancesBySeverityResult {
    name: string;
    severity: string;
    count: number;
}

export {
    Deployment,
    Event,
    Resource,
    Config,
    DatabaseInstanceRecord,
    ListDatabaseInstancesRecord,
    DatabaseInstanceConfigData,
    ListDatabaseInstanceConfigDataParams,
    CountDatabaseInstanceConfigRecordsParams,
    ListResourcesParams,
    GetResourcesParams,
    PaginatedDatabaseInstancesResponse,
    ListTrackedEc2Params,
    TrackedEc2Record,
    TrackedEc2RecordFilters,
    AccountIdCredRegionParams,
    GroupedDatabaseInstancesBySeverityResult
};
