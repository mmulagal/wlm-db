import { DEPLOYMENT_MODEL, DEPLOYMENT_STATUS, Prisma, STORAGE_TYPE } from '@prisma/client';
import { DatabaseInstanceConfigurations, DatabaseInstanceMetadata } from '../../utils/common-types';

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
    sqlInstanceId?: string;
    sqlInstanceName?: string;
    isDefault?: boolean;
    credentialsId?: string;
    region?: string | null;
    databaseType?: string;
}

interface DatabaseInstanceConfigData {
    account_id: string;
    credentials_id: string;
    region: string;
    resource_id: string;
    database_instance_id: string;
    creation_time: Date;
    last_updated?: Date;
    config_data: object;
    config_data_type: string;
}

interface ListDatabaseInstanceConfigDataParams {
    accountId?: string;
    region?: string;
    credentialsId?: string;
    resourceId?: string;
    databaseInstanceId?: string;
    configDataType?: string;
    pageSize?: number;
    nextToken?: string;
    include?: Prisma.database_instance_config_dataInclude;
    select?: Prisma.database_instance_config_dataSelect;
    filters?: Record<string, any>;
}

type CountDatabaseInstanceConfigRecordsParams = Omit<
    ListDatabaseInstanceConfigDataParams,
    'include' | 'select' | 'pageSize' | 'nextToken'
>;

export {
    Deployment,
    Event,
    Resource,
    Config,
    DatabaseInstanceRecord,
    ListDatabaseInstancesRecord,
    DatabaseInstanceConfigData,
    ListDatabaseInstanceConfigDataParams,
    CountDatabaseInstanceConfigRecordsParams
};
