import { DEPLOYMENT_STATUS, DEPLOYMENT_MODEL, STORAGE_TYPE } from '@prisma/client';
import { isEmpty } from 'lodash-es';
import getLogger from '../../utils/logger';
import { prisma } from '../../utils/prisma-utils';
import { checkAccount } from '../../utils/utils';
import { databaseInstanceMetadata } from '../../utils/common-types';

const logger = getLogger();

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
}

interface Config {
    user?: string;
    creationTime?: number;
    name: string;
    data?: object;
}

interface DatabaseInstance {
    credentialsId: string;
    resourceId: string;
    instanceId: string;
    instanceName: string;
    fsxnId: string;
    isDefault: boolean;
    source: string;
    sqlDeploymentType: string;
    fsxSvmId: string;
    storageProtocol?: string;
    numberofUserDbsCreated?: number;
    sandboxCreated?: boolean;
    metaData?: databaseInstanceMetadata;
}

async function listDeployments(
    accountId?: string,
    deploymentId?: string,
    deploymentName?: string,
    statuses?: Array<DEPLOYMENT_STATUS>,
    parentStackOnly?: boolean,
    pageSize?: number,
    nextToken?: string
) {
    logger.info('Listing deployments', { accountId, deploymentId, deploymentName, statuses });

    accountId = accountId ? checkAccount(accountId) : '';
    return prisma.client.deployment.findMany({
        where: {
            ...(accountId && { account_id: accountId }),
            ...(deploymentId && { deployment_id: deploymentId }),
            ...(deploymentName && { deployment_name: deploymentName }),
            ...(statuses && {
                deployment_status: {
                    in: statuses
                }
            }),
            ...(parentStackOnly && { parent_deployment_id: null })
        },
        orderBy: {
            id: 'asc'
        },
        ...(pageSize && { take: pageSize }),
        ...(nextToken && {
            cursor: { id: nextToken },
            skip: 1
        })
    });
}

async function createDeployment(accountId: string, params: Deployment) {
    logger.info('Creating deployment', { accountId, params });
    const {
        deploymentId,
        parentDeploymentId,
        deploymentName,
        cloudProviderAccountId,
        cloudProviderName,
        credentialsId,
        deploymentStatus,
        deploymentModel,
        deploymentStatusReason,
        startTime,
        endTime,
        region,
        data
    } = params;

    accountId = checkAccount(accountId);

    return prisma.client.deployment.create({
        data: {
            account_id: accountId,
            deployment_id: deploymentId,
            ...(parentDeploymentId && {
                parent_deployment_id: parentDeploymentId
            }),
            deployment_name: deploymentName,
            ...(cloudProviderAccountId && { cloud_provider_account_id: cloudProviderAccountId }),
            ...(cloudProviderName && { cloud_provider_name: cloudProviderName }),
            credentials_id: credentialsId,
            deployment_status: deploymentStatus,
            ...(deploymentModel && { deployment_model: deploymentModel }),
            ...(deploymentStatusReason && { deployment_status_reason: deploymentStatusReason }),
            start_time: new Date(startTime),
            ...(endTime && { end_time: new Date(endTime) }),
            ...(data && { data }),
            region
        }
    });
}

async function updateDeployment(
    accountId: string,
    id: string,
    params: {
        parentDeploymentId?: string;
        deploymentName?: string;
        deploymentStatus?: DEPLOYMENT_STATUS;
        deploymentStatusReason?: string;
        endTime?: number;
        data?: object;
    }
) {
    logger.info('Updating deployment', { id, params });
    const { parentDeploymentId, deploymentName, deploymentStatus, deploymentStatusReason, endTime, data } = params;
    return prisma.client.deployment.update({
        where: {
            account_id: accountId,
            id
        },
        data: {
            ...(parentDeploymentId && { parent_deployment_id: parentDeploymentId }),
            ...(deploymentName && { deployment_name: deploymentName }),
            ...(deploymentStatus && { deployment_status: deploymentStatus }),
            ...(deploymentStatusReason && { deployment_status_reason: deploymentStatusReason }),
            ...(endTime && { end_time: new Date(endTime) }),
            ...(!isEmpty(data) && { data })
        }
    });
}

async function upsertDeployment(accountId: string, params: Deployment) {
    logger.info('Upserting deployment', { params });
    const {
        deploymentId,
        parentDeploymentId,
        deploymentName,
        cloudProviderAccountId,
        cloudProviderName,
        credentialsId,
        deploymentStatus,
        deploymentModel,
        deploymentStatusReason,
        startTime,
        endTime,
        region,
        data
    } = params;
    return prisma.client.deployment.upsert({
        where: {
            uk_wlmdb_deployment_account_id_deployment_id: {
                account_id: accountId,
                deployment_id: deploymentId
            }
        },
        create: {
            account_id: accountId,
            deployment_id: deploymentId,
            ...(parentDeploymentId && {
                parent_deployment_id: parentDeploymentId
            }),
            deployment_name: deploymentName,
            ...(cloudProviderAccountId && { cloud_provider_account_id: cloudProviderAccountId }),
            ...(cloudProviderName && { cloud_provider_name: cloudProviderName }),
            credentials_id: credentialsId,
            deployment_status: deploymentStatus,
            ...(deploymentModel && { deployment_model: deploymentModel }),
            ...(deploymentStatusReason && { deployment_status_reason: deploymentStatusReason }),
            start_time: new Date(startTime),
            ...(endTime && { end_time: new Date(endTime) }),
            ...(data && { data }),
            region
        },
        update: {
            ...(parentDeploymentId && { parent_deployment_id: parentDeploymentId }),
            ...(deploymentName && { deployment_name: deploymentName }),
            ...(deploymentStatus && { deployment_status: deploymentStatus }),
            ...(deploymentStatusReason && { deployment_status_reason: deploymentStatusReason }),
            ...(endTime && { end_time: new Date(endTime) }),
            ...(!isEmpty(data) && { data })
        }
    });
}

async function createEvent(params: Event) {
    logger.debug('Creating event', { params });
    const {
        eventId,
        accountId,
        deploymentId,
        deploymentName,
        eventStatus,
        eventStatusReason,
        resourceType,
        time,
        data
    } = params;
    return prisma.client.event.create({
        data: {
            event_id: eventId,
            account_id: accountId,
            deployment_id: deploymentId,
            deployment_name: deploymentName,
            event_status: eventStatus,
            event_status_reason: eventStatusReason,
            resource_type: resourceType,
            time: new Date(time),
            ...(data && { data })
        }
    });
}

async function listEvents(accountId?: string, deploymentName?: string, eventName?: string) {
    logger.info('Listing events for a deployment', { accountId, deploymentName });

    accountId = accountId ? checkAccount(accountId) : '';
    return prisma.client.event.findMany({
        where: {
            ...(accountId && { account_id: accountId }),
            ...(deploymentName && { deployment_name: deploymentName }),
            ...(eventName && { event_id: { contains: eventName } })
        },
        orderBy: [
            {
                time: 'desc'
            }
        ]
    });
}

async function deleteDeployment(accountId: string, deploymentId: string) {
    logger.info('Deleting deployment', { accountId, deploymentId });
    accountId = checkAccount(accountId);
    return prisma.client.deployment.deleteMany({
        where: {
            account_id: accountId,
            deployment_id: deploymentId
        }
    });
}

async function listResources(
    accountId: string,
    resourceId?: string,
    credentialsId?: string,
    region?: string,
    resourceType?: string,
    fsxId?: string,
    metaFilters?: { [x: string]: string | number | boolean },
    pageSize?: number,
    nextToken?: string
) {
    logger.info('Listing resources', {
        accountId,
        resourceId,
        resourceType,
        region,
        credentialsId,
        metaFilters,
        pageSize,
        nextToken
    });
    accountId = checkAccount(accountId);

    return prisma.client.resource.findMany({
        where: {
            account_id: accountId,
            ...(resourceId && { resource_id: resourceId }),
            ...(resourceType && { resource_type: resourceType }),
            ...(region && { region }),
            ...(credentialsId && { credentials_id: credentialsId }),
            ...(fsxId && { co_relation_id: fsxId }),
            ...(metaFilters && {
                AND: Object.entries(metaFilters).map(([key, val]) => ({
                    metadata: {
                        path: `$.${key}`,
                        equals: val
                    }
                }))
            })
        },
        orderBy: {
            id: 'asc'
        },
        ...(pageSize && { take: pageSize }),
        ...(nextToken && {
            cursor: { id: nextToken },
            skip: 1
        })
    });
}

async function countResources(accountId: string, credentialsId?: string, region?: string, resourceType?: string) {
    logger.info('Counting managed resources', { accountId, credentialsId, region, resourceType });

    accountId = checkAccount(accountId);

    return prisma.client.resource.aggregate({
        _count: {
            id: true
        },
        where: {
            account_id: accountId,
            ...(credentialsId && { credentials_id: credentialsId }),
            ...(region && { region }),
            ...(resourceType && { resource_type: resourceType })
        }
    });
}

async function createResource(accountId: string, params: Resource) {
    logger.info('Creating resource', { accountId, params });
    const {
        resourceId,
        resourceName,
        credentialsId,
        storageType,
        resourceType,
        coRelationId,
        cloudProviderAccountId,
        cloudProviderName,
        region,
        metadata
    } = params;

    accountId = checkAccount(accountId);

    return prisma.client.resource.create({
        data: {
            account_id: accountId,
            resource_id: resourceId,
            credentials_id: credentialsId,
            storage_type: storageType,
            ...(coRelationId && {
                co_relation_id: coRelationId
            }),
            resource_name: resourceName,
            resource_type: resourceType,
            ...(cloudProviderAccountId && { cloud_provider_account_id: cloudProviderAccountId }),
            ...(cloudProviderName && { cloud_provider_name: cloudProviderName }),
            region,
            ...(metadata && { metadata })
        }
    });
}

async function deleteResource(accountId: string, resourceId: string) {
    logger.info('Deleting resource', { accountId, resourceId });

    accountId = checkAccount(accountId);
    return prisma.client.resource.deleteMany({
        where: {
            account_id: accountId,
            resource_id: resourceId
        }
    });
}

async function listConfig(accountId: string, id?: string) {
    logger.info('Listing config', accountId, id);

    accountId = checkAccount(accountId);
    return prisma.client.config.findMany({
        where: {
            account_id: accountId,
            ...(id && { id })
        },
        select: {
            id: true,
            user: true,
            creation_time: true,
            account_id: true,
            data: !isEmpty(id),
            name: true,
            modified_time: true
        },
        take: 100
    });
}

async function createConfig(accountId: string, params: Config) {
    logger.info('Creating config', { accountId, params });
    const { user, creationTime, data, name } = params;
    accountId = checkAccount(accountId);

    return prisma.client.config.create({
        data: {
            account_id: accountId,
            user: user!,
            name,
            creation_time: new Date(creationTime!),
            data
        }
    });
}

async function updateConfig(accountId: string, configId: string, params: Config) {
    logger.info('Updating config', { accountId, configId, params });

    const { data, name } = params;
    accountId = checkAccount(accountId);

    return prisma.client.config.update({
        where: {
            id: configId
        },
        data: {
            account_id: accountId,
            name,
            ...(!isEmpty(data) && { data })
        }
    });
}
async function deleteConfig(accountId: string, id: string) {
    logger.info('Deleting config', { accountId, id });

    accountId = checkAccount(accountId);

    return prisma.client.config.delete({
        where: {
            account_id: accountId,
            id
        }
    });
}

async function listRelationshipsResources(accountId: string, resourceId?: string) {
    logger.info('Listing resources which has relation', { accountId });

    accountId = checkAccount(accountId);

    return prisma.client.resource.findMany({
        where: {
            account_id: accountId,
            co_relation_id: {
                not: null
            },
            ...(resourceId && { resource_id: resourceId })
        },
        select: {
            resource_id: true,
            co_relation_id: true
        }
    });
}

async function deploymentJobsCount(accountId: string, fromDate: Date, statuses: Array<DEPLOYMENT_STATUS>) {
    logger.info('Deployment jobs count', accountId, fromDate, statuses);

    accountId = checkAccount(accountId);

    return prisma.client.deployment.findMany({
        where: {
            account_id: accountId,
            parent_deployment_id: null,
            deployment_status: {
                in: statuses
            },
            start_time: {
                gte: fromDate
            }
        }
    });
}

async function deleteDeploymentJobById(accountId: string, jobId: string) {
    logger.info('Deleting Deployment Job by Id', { accountId, jobId });

    accountId = checkAccount(accountId);

    return prisma.client.deployment.deleteMany({
        where: {
            account_id: accountId,
            id: jobId
        }
    });
}

async function updateResourceMetaData(accountId: string, resourceId: string, metaData: any) {
    logger.info('Updating resource metadata', { accountId, resourceId });

    accountId = checkAccount(accountId);

    return prisma.client.resource.updateMany({
        where: {
            account_id: accountId,
            resource_id: resourceId
        },
        data: {
            ...(!isEmpty(metaData) && { metadata: metaData })
        }
    });
}

async function upsertDatabaseInstanceRecord(accountId: string, record: DatabaseInstance) {
    logger.info('Upserting a database instance record', { accountId, record });

    const {
        resourceId,
        credentialsId,
        instanceId,
        instanceName,
        isDefault,
        fsxnId,
        source,
        sqlDeploymentType,
        fsxSvmId,
        numberofUserDbsCreated,
        sandboxCreated,
        storageProtocol,
        metaData
    } = record;

    accountId = checkAccount(accountId);

    return prisma.client.database_instances.upsert({
        create: {
            account_id: accountId,
            credentials_id: credentialsId,
            resource_id: resourceId,
            database_instance_id: instanceId,
            database_instance_name: instanceName,
            fsxn_ids: fsxnId,
            is_default: isDefault,
            source,
            database_deployment_type: sqlDeploymentType,
            ...(fsxSvmId && { fsx_svm_id: fsxSvmId }),
            ...(storageProtocol && { storage_protocol: storageProtocol }),
            ...(numberofUserDbsCreated && { number_of_user_dbs_created: numberofUserDbsCreated }),
            ...(sandboxCreated && { sandbox_created: sandboxCreated }),
            ...(metaData && { metdata: metaData })
        },
        update: {
            ...(instanceName && { database_instance_name: instanceName }),
            ...(fsxnId && { fsxn_ids: fsxnId }),
            ...(fsxSvmId && { fsx_svm_id: fsxSvmId }),
            ...(isDefault && { is_default: isDefault }),
            ...(numberofUserDbsCreated && { number_of_user_dbs_created: numberofUserDbsCreated }),
            ...(sandboxCreated && { sandbox_created: sandboxCreated })
        },
        where: {
            uk_wlmdb_database_instances: {
                account_id: accountId,
                credentials_id: credentialsId,
                resource_id: resourceId,
                database_instance_id: instanceId
            }
        }
    });
}

async function updateDatabaseInstanceMetadata(
    accountId: string,
    databaseInstanceId: string,
    credentialsId: string,
    metaData: any
) {
    logger.info('Updating resource metadata', { accountId, databaseInstanceId, credentialsId });

    accountId = checkAccount(accountId);

    return prisma.client.database_instances.updateMany({
        where: {
            account_id: accountId,
            database_instance_id: databaseInstanceId,
            credentials_id: credentialsId
        },
        data: {
            ...(!isEmpty(metaData) && { metadata: metaData })
        }
    });
}

async function listDatabaseInstances(accountId: string, record: any) {
    logger.info('List database instances for given account/credentialsId', accountId);

    const { resourceId, credentialsId, instanceId, instanceName, isDefault } = record;

    accountId = checkAccount(accountId);

    return prisma.client.database_instances.findMany({
        where: {
            account_id: accountId,
            credentials_id: credentialsId,
            ...(resourceId && { resource_id: resourceId }),
            ...(instanceId && { database_instance_id: instanceId }),
            ...(instanceName && { database_instance_name: instanceName }),
            ...(isDefault && { is_default: isDefault })
        },
        orderBy: {
            id: 'asc'
        }
    });
}

async function deleteDatabaseInstanceRecord(
    accountId: string,
    credentialsId: string,
    resourceId: string,
    instanceName: string
) {
    logger.info('Delete a database instance record', { accountId, credentialsId, resourceId, instanceName });

    accountId = checkAccount(accountId);
    return prisma.client.database_instances.deleteMany({
        where: {
            account_id: accountId,
            credentials_id: credentialsId,
            resource_id: resourceId,
            database_instance_name: instanceName
        }
    });
}

export {
    Resource,
    listDeployments,
    createDeployment,
    deleteDeployment,
    upsertDeployment,
    updateDeployment,
    createEvent,
    listResources,
    countResources,
    createResource,
    deleteResource,
    listConfig,
    createConfig,
    updateConfig,
    deleteConfig,
    listRelationshipsResources,
    deploymentJobsCount,
    deleteDeploymentJobById,
    checkAccount,
    listEvents,
    updateResourceMetaData,
    upsertDatabaseInstanceRecord,
    listDatabaseInstances,
    deleteDatabaseInstanceRecord,
    DatabaseInstance,
    updateDatabaseInstanceMetadata
};
