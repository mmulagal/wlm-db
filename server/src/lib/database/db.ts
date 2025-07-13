import { DEPLOYMENT_STATUS, SOURCE, DATABASE_DEPLOYMENT_TYPE, DATABASE_TYPE } from '@prisma/client';
import { isArray, isEmpty } from 'lodash-es';
import getLogger from '../../utils/logger';
import { prisma } from '../../utils/prisma-utils';
import { checkAccount, isDemo, getInstancesWithResourceForDemo } from '../../utils/utils';
import { TCO_FEATURE } from '../../utils/consts';
import { Deployment, Event, Resource, Config, DatabaseInstanceRecord, ListDatabaseInstancesRecord } from './db-types';
import { ResourceDetails } from '../../utils/common-types';

const logger = getLogger();
const isDemoFlow = isDemo();
interface PaginatedDatabaseInstancesResponse {
    items: any[];
    nextToken?: string;
    totalCount: number;
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

async function listEvents(
    accountId?: string,
    deploymentName?: string,
    eventName?: string,
    pageSize?: number,
    nextToken?: string
) {
    logger.info('Listing events for a deployment', { accountId, deploymentName, eventName, pageSize });

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
        ],
        ...(pageSize && { take: pageSize }),
        ...(nextToken && {
            cursor: { id: nextToken },
            skip: 1
        })
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
    accountId?: string,
    resourceId?: string,
    credentialIds?: string | string[],
    region?: string | string[],
    resourceType?: string | string[],
    fsxId?: string,
    metaFilters?: { [x: string]: string | number | boolean },
    pageSize?: number,
    nextToken?: string,
    includeDatabaseInstances?: boolean
) {
    logger.info('Listing resources for params', {
        accountId,
        resourceId,
        resourceType,
        region,
        credentialIds,
        metaFilters,
        pageSize,
        nextToken,
        includeDatabaseInstances
    });

    if (accountId) {
        accountId = checkAccount(accountId);
    }
    resourceType = resourceType ? (isArray(resourceType) ? resourceType : [resourceType]) : undefined;
    region = region ? (isArray(region) ? region : [region]) : undefined;
    credentialIds = credentialIds ? (isArray(credentialIds) ? credentialIds : [credentialIds]) : undefined;

    const response = await prisma.client.resource.findMany({
        where: {
            ...(accountId && { account_id: accountId }),
            ...(resourceId && { resource_id: resourceId }),
            ...(resourceType && { resource_type: { in: resourceType } }),
            ...(region && { region: { in: region } }),
            ...(credentialIds && { credentials_id: { in: credentialIds } }),
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
        }),
        ...(includeDatabaseInstances && {
            include: {
                database_instances: true
            }
        })
    });

    if (!isEmpty(response) && isDemoFlow && includeDatabaseInstances) {
        for (const resource of response as ResourceDetails[]) {
            if (Array.isArray(resource.database_instances)) {
                resource.database_instances = resource.database_instances
                    .filter((instance: any) => instance.resource_id === resource.resource_id)
                    .map((instance: any) => {
                        if (instance.database_instance_name && resource.resource_name) {
                            return {
                                ...instance,
                                database_instance_name: instance.database_instance_name
                                    .replace(resource.resource_name, '')
                                    .trim()
                            };
                        }
                        return instance;
                    });
            }
        }
    }

    return response;
}

async function countResources(accountId?: string, credentialsId?: string, region?: string, resourceType?: string) {
    logger.info('Counting managed resources', { accountId, credentialsId, region, resourceType });

    if (accountId) {
        accountId = checkAccount(accountId);
    }

    return prisma.client.resource.aggregate({
        _count: {
            id: true
        },
        where: {
            ...(accountId && { account_id: accountId }),
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
        metadata,
        assessmentData
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
            ...(metadata && { metadata }),
            ...(assessmentData && {
                assessment_data: assessmentData
            })
        }
    });
}

async function deleteResource(accountId: string, resourceId: string, credentialsId?: string) {
    logger.info('Deleting resource', { accountId, credentialsId, resourceId });

    accountId = checkAccount(accountId);
    return prisma.client.resource.deleteMany({
        where: {
            account_id: accountId,
            resource_id: resourceId,
            ...(credentialsId && { credentials_id: credentialsId })
        }
    });
}

async function listConfig(accountId: string, id?: string, pageSize: number = 100, nextToken?: string) {
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
            modified_time: true,
            database_type: true
        },
        ...(pageSize && { take: pageSize }),
        ...(nextToken && {
            cursor: { id: nextToken },
            skip: 1
        })
    });
}

async function createConfig(accountId: string, params: Config) {
    logger.info('Creating config', { accountId, params });
    const { user, creationTime, data, name, databaseType } = params;
    accountId = checkAccount(accountId);

    return prisma.client.config.create({
        data: {
            account_id: accountId,
            user: user!,
            name,
            creation_time: new Date(creationTime!),
            data,
            database_type: databaseType! as DATABASE_TYPE
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

async function updateResource({
    accountId,
    credentialsId,
    region,
    resourceId,
    metaData,
    updatedConfigs,
    updatedAssessmentData,
    updatedAssessmentResults
}: {
    accountId: string;
    credentialsId?: string;
    region?: string;
    resourceId?: string;
    metaData?: any;
    updatedConfigs?: any;
    updatedAssessmentData?: any;
    updatedAssessmentResults?: any;
}) {
    logger.info('Updating resource metadata', { accountId, resourceId, credentialsId });

    accountId = checkAccount(accountId);

    return prisma.client.resource.updateMany({
        where: {
            account_id: accountId,
            resource_id: resourceId,
            ...(credentialsId && { credentials_id: credentialsId }),
            ...(region && { region })
        },
        data: {
            ...(!isEmpty(metaData) && { metadata: metaData }),
            ...(!isEmpty(updatedConfigs) && { configurations: updatedConfigs }),
            ...(!isEmpty(updatedAssessmentData) && { assessment_data: updatedAssessmentData }),
            ...(!isEmpty(updatedAssessmentResults) && { assessment_results: updatedAssessmentResults })
        }
    });
}

async function updateDatabaseInstance({
    accountId,
    credentialsId,
    region,
    databaseHostId,
    instanceId,
    metaData,
    updatedConfigs,
    assessmentResults
}: {
    accountId: string;
    credentialsId?: string;
    region?: string;
    databaseHostId?: string;
    instanceId: string;
    metaData?: any;
    updatedConfigs?: any;
    assessmentResults?: any;
}) {
    logger.info('Updating instance metadata', { accountId, instanceId });

    accountId = checkAccount(accountId);

    return prisma.client.database_instances.updateMany({
        where: {
            account_id: accountId,
            database_instance_id: instanceId,
            ...(databaseHostId && { resource_id: databaseHostId }),
            ...(credentialsId && { credentials_id: credentialsId }),
            ...(region && { region })
        },
        data: {
            ...(!isEmpty(metaData) && { metadata: metaData }),
            ...(!isEmpty(updatedConfigs) && { configurations: updatedConfigs }),
            ...(!isEmpty(assessmentResults) && { assessment_results: assessmentResults })
        }
    });
}

async function upsertDatabaseInstance(accountId: string, record: DatabaseInstanceRecord) {
    logger.info('Upserting a database instance record', { accountId, record });

    const {
        resourceId,
        credentialsId,
        region,
        databaseInstanceId,
        databaseInstanceName,
        fsxnIds,
        isDefault,
        source,
        sqlDeploymentType,
        fsxSvmId,
        numberofUserDbsCreated,
        sandboxCreated,
        storageProtocol,
        metaData,
        databaseType
    } = record;

    accountId = checkAccount(accountId);

    return prisma.client.database_instances.upsert({
        create: {
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            resource_id: resourceId,
            database_instance_id: databaseInstanceId,
            database_instance_name: databaseInstanceName,
            fsxn_ids: fsxnIds,
            is_default: isDefault,
            source: source as SOURCE, // Fix: Update the type of 'source' to 'SOURCE'
            database_type: databaseType,
            database_deployment_type: sqlDeploymentType as DATABASE_DEPLOYMENT_TYPE,
            fsx_svm_id: fsxSvmId,
            ...(storageProtocol && { storage_protocol: storageProtocol }),
            ...(numberofUserDbsCreated && { number_of_user_dbs_created: numberofUserDbsCreated }),
            ...(sandboxCreated && { sandbox_created: sandboxCreated }),
            ...(metaData && { metadata: metaData as { string: string } })
        },
        update: {
            ...(databaseInstanceName && { database_instance_name: databaseInstanceName }),
            ...(fsxnIds && { fsxn_ids: fsxnIds }),
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
                database_instance_id: databaseInstanceId
            }
        }
    });
}

async function listDatabaseInstances(
    accountId?: string,
    record?: ListDatabaseInstancesRecord,
    shouldIncludeResource: boolean = true
) {
    logger.info('List database instances for given account and record', { accountId, record });

    const { resourceId, sqlInstanceId, sqlInstanceName, isDefault, credentialsId, region, databaseType } = record ?? {};
    accountId = accountId ? checkAccount(accountId) : '';

    let databaseInstances = await prisma.client.database_instances.findMany({
        where: {
            ...(accountId && { account_id: accountId }),
            ...(credentialsId && { credentials_id: credentialsId }),
            ...(resourceId && { resource_id: resourceId }),
            ...(sqlInstanceId && { database_instance_id: sqlInstanceId }),
            ...(sqlInstanceName && { database_instance_name: sqlInstanceName }),
            ...(region && { region }),
            ...(isDefault && { is_default: isDefault }),
            ...(databaseType && { database_type: databaseType })
        },
        orderBy: {
            id: 'asc'
        },
        include: {
            resource: shouldIncludeResource
        }
    });

    if (!isEmpty(databaseInstances) && isDemoFlow) {
        // relational mapping in prismock has some issues. So we need to map the resource to the database instance
        const filteredResource = await listResources(accountId, undefined, credentialsId);
        databaseInstances = await getInstancesWithResourceForDemo(databaseInstances, filteredResource);
    }
    return databaseInstances;
}

async function deleteDatabaseInstance(
    accountId: string,
    credentialsId: string,
    resourceId: string,
    databaseInstanceIds: string[]
) {
    logger.info('Delete database instance records', { accountId, credentialsId, resourceId, databaseInstanceIds });

    accountId = checkAccount(accountId);
    return prisma.client.database_instances.deleteMany({
        where: {
            account_id: accountId,
            credentials_id: credentialsId,
            resource_id: resourceId,
            database_instance_id: {
                in: databaseInstanceIds
            }
        }
    });
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
async function createTrackedEc2Records(records: TrackedEc2Record[]) {
    logger.info('Creating tracked EC2 instances', { records });

    return prisma.client.tracked_ec2.createMany({
        data: records
    });
}

async function listTrackedEc2(
    feature: string = TCO_FEATURE,
    accountId?: string,
    region?: string,
    credentialsId?: string,
    instanceId?: string
) {
    logger.info('Listing tracked EC2 instances', { feature, accountId, region, credentialsId, instanceId });

    return prisma.client.tracked_ec2.findMany({
        where: {
            feature,
            ...(accountId && { account_id: accountId }),
            ...(region && { region }),
            ...(credentialsId && { credentials_id: credentialsId }),
            ...(instanceId && { instance_id: instanceId })
        }
    });
}

async function removeTrackedEc2Record(
    accountId: string,
    region: string,
    credentialsId: string,
    instanceId: string,
    feature: string
) {
    logger.info('Removing tracked EC2 instance', { accountId, region, credentialsId, instanceId, feature });

    return prisma.client.tracked_ec2.deleteMany({
        where: {
            account_id: accountId,
            region,
            credentials_id: credentialsId,
            instance_id: instanceId,
            feature
        }
    });
}

async function updateTrackedEc2Record(
    accountId: string,
    region: string,
    credentialsId: string,
    instanceId: string,
    feature: string,
    data: {
        account_id?: string;
        region?: string;
        credentials_id?: string;
        instance_id?: string;
        feature?: string;
        cloud_provider_account_id?: string;
        last_updated?: Date;
    }
) {
    logger.info('Updating tracked EC2 instance', { accountId, region, credentialsId, feature, instanceId, data });

    return prisma.client.tracked_ec2.updateMany({
        where: {
            account_id: accountId,
            region,
            credentials_id: credentialsId,
            feature,
            instance_id: instanceId
        },
        data
    });
}

async function deleteOlderDeployments(olderDate: number) {
    logger.info('Deleting older deployments', { olderDate });
    return prisma.client.deployment.deleteMany({
        where: {
            start_time: {
                lt: new Date(olderDate)
            }
        }
    });
}

async function listDatabaseInstancesPaginated(
    accountId?: string,
    record?: ListDatabaseInstancesRecord,
    pageSize: number = 50,
    nextToken?: string // This will be the last seen id as a string
): Promise<PaginatedDatabaseInstancesResponse> {
    logger.info('List paginated database instances for given account and record', {
        accountId,
        record,
        pageSize,
        nextToken
    });

    const { resourceId, sqlInstanceId, sqlInstanceName, isDefault, credentialsId, region, databaseType } = record ?? {};
    accountId = accountId ? checkAccount(accountId) : '';

    const whereClause = {
        ...(accountId && { account_id: accountId }),
        ...(credentialsId && { credentials_id: credentialsId }),
        ...(resourceId && { resource_id: resourceId }),
        ...(sqlInstanceId && { database_instance_id: sqlInstanceId }),
        ...(sqlInstanceName && { database_instance_name: sqlInstanceName }),
        ...(region && { region }),
        ...(isDefault && { is_default: isDefault }),
        ...(databaseType && { database_type: databaseType })
    };

    const queryOptions: any = {
        where: whereClause,
        orderBy: { id: 'asc' },
        include: { resource: true },
        take: pageSize,
        ...(nextToken && {
            cursor: { id: nextToken },
            skip: 1
        })
    };

    const [databaseInstances, totalCount] = await Promise.all([
        prisma.client.database_instances.findMany(queryOptions),
        prisma.client.database_instances.count({ where: whereClause })
    ]);

    let items = databaseInstances;

    if (!isEmpty(items) && isDemoFlow) {
        const filteredResource = await listResources(accountId, undefined, credentialsId);
        items = await getInstancesWithResourceForDemo(items, filteredResource);
    }

    // Set nextToken as the last item's id if there are more items
    const newNextToken = items.length === pageSize ? String(items[items.length - 1].id) : undefined;

    return {
        items,
        nextToken: newNextToken,
        totalCount
    };
}

export {
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
    updateResource,
    upsertDatabaseInstance,
    listDatabaseInstances,
    deleteDatabaseInstance,
    updateDatabaseInstance,
    createTrackedEc2Records,
    listTrackedEc2,
    removeTrackedEc2Record,
    updateTrackedEc2Record,
    deleteOlderDeployments,
    listDatabaseInstancesPaginated
};
