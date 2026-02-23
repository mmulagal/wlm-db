import createError from 'http-errors';
import moment from 'moment';
import { DEPLOYMENT_STATUS } from '@prisma/client';
import { isEmpty } from 'lodash-es';
import {
    createConfig,
    updateConfig,
    deleteConfig,
    listConfig,
    listDeployments,
    listResources,
    countResources,
    listDatabaseInstances,
    updateDatabaseInstance,
    upsertDatabaseInstance as dbUpsertDatabaseInstance,
    updateResource,
    countDatabaseInstances,
    listTrackedEc2,
    countTrackedEc2
} from '../../lib/database/db';
import {
    FormConfigCreateResponseType,
    FormConfigListResponseType,
    FormConfigObjectResponseType,
    FormConfigUpdateResponseType
} from '../../routes/types/form-config.types';
import { DeploymentStatusListResponseType, DeploymentStatusResponseType } from '../../routes/types/deployment.types';
import getLogger from '../../utils/logger';
import {
    CONFIG_NOT_FOUND,
    HttpErrorCodes,
    RESOURCESTYPE,
    STACK_NOT_FOUND,
    TCO_FEATURE,
    DatabaseTypes
} from '../../utils/consts';
import {
    ResourceDetails,
    DeploymentDetails,
    DatabaseInstance,
    DatabaseInstanceMetadata
} from '../../utils/common-types';
import { getOfflineAssessment } from '../../lib/database/offline-assessment';
import { updateLongRunningAuditGroup } from '../cloud-manager/audit-operations';
import {
    ListDatabaseInstancesRecord,
    GetResourcesParams,
    PaginatedDatabaseInstancesResponse,
    ListTrackedEc2Params,
    DatabaseInstanceRecord
} from '../../lib/database/db-types';
import { getInstancesWithResourceForDemo, getNextToken, IS_DEMO_FLOW } from '../../utils/utils';
import { RESOURCE_DEFAULT_SELECT_FIELDS } from '../../utils/database-consts';

const logger = getLogger();

async function handleDemoFlowMapping(
    items: any[],
    accountId?: string,
    credentialsId?: string,
    additionalResourceFields?: string[]
) {
    if (!isEmpty(items) && IS_DEMO_FLOW) {
        const resourceSelectKeys = [...RESOURCE_DEFAULT_SELECT_FIELDS];
        if (additionalResourceFields?.length) {
            resourceSelectKeys.push(...additionalResourceFields);
        }

        const filteredResource = await listResources({
            accountId,
            credentialIds: credentialsId,
            selectKeys: resourceSelectKeys
        });
        return getInstancesWithResourceForDemo(items, filteredResource);
    }
    return items;
}

async function getSavedConfig(accountId: string, id: string): Promise<FormConfigObjectResponseType> {
    logger.info('Load individual saved config ', accountId);
    try {
        const [
            {
                user = '',
                creation_time: creationTime,
                data,
                name = '',
                modified_time: modifiedTime,
                database_type: databaseType
            } = {}
        ] = (await listConfig(accountId, id)) || [];
        return {
            accountId,
            id,
            user,
            creationTime: moment(creationTime).unix() * 1000,
            data,
            name,
            ...(modifiedTime && { modifiedTime: moment(modifiedTime).unix() * 1000 }),
            databaseType
        };
    } catch (error) {
        logger.error(`Error occurred while fetching saved config ${id}. Error: ${error}`);
        throw createError(HttpErrorCodes.NOT_FOUND, CONFIG_NOT_FOUND(id));
    }
}

async function deleteSavedConfig(accountId: string, id: string): Promise<void> {
    logger.info('Delete saved config ', accountId, id);
    const savedConfigs = await getSavedConfig(accountId, id);
    updateLongRunningAuditGroup(undefined, undefined, savedConfigs?.name);

    try {
        await deleteConfig(accountId, id);
    } catch (error) {
        logger.error(`Error occurred while deleting saved config ${id}. Error: ${error}`);
        throw createError(HttpErrorCodes.NOT_FOUND, CONFIG_NOT_FOUND(id));
    }
}

async function getAllSavedConfig(accountId: string): Promise<FormConfigListResponseType> {
    logger.info('Load saved config ', accountId);

    const data = await listConfig(accountId);
    return data.map(
        ({
            id,
            user,
            creation_time: creationTime,
            data: configData,
            name,
            modified_time: modifiedTime,
            database_type: databaseType
        }) => ({
            accountId,
            id,
            user,
            name,
            creationTime: moment(creationTime).unix() * 1000,
            data: configData as object,
            ...(modifiedTime && { modifiedTime: moment(modifiedTime).unix() * 1000 }),
            databaseType
        })
    );
}

async function saveConfig(
    accountId: string,
    user: string,
    name: string,
    data: object,
    databaseType?: string
): Promise<FormConfigCreateResponseType> {
    logger.info('Save config ', accountId);
    logger.debug('Save config data', data);

    updateLongRunningAuditGroup(undefined, undefined, name);
    const { id, creation_time: configCreationTime } = await createConfig(accountId, {
        user,
        name,
        creationTime: Date.now(),
        data,
        databaseType
    });
    return {
        id,
        accountId,
        creationTime: moment(configCreationTime).unix() * 1000,
        user,
        data,
        name
    };
}

async function modifyConfig(
    accountId: string,
    configId: string,
    name: string,
    data?: object
): Promise<FormConfigUpdateResponseType> {
    logger.info('Modify config ', { accountId, configId });
    logger.debug('Modify config data', data);

    try {
        const { id } = await updateConfig(accountId, configId, {
            name,
            data
        });
        return { id };
    } catch (error) {
        logger.error(`Error occurred while updating saved config ${configId}. Error: ${error}`);
        throw createError(HttpErrorCodes.NOT_FOUND, CONFIG_NOT_FOUND(configId));
    }
}

async function getAllDeploymentStatus(accountId: string): Promise<DeploymentStatusListResponseType> {
    logger.info(' Deployment status', accountId);

    const data = await listDeployments(accountId);

    logger.debug(data);

    return data
        .filter(each => each.parent_deployment_id == null)
        .map(
            ({
                deployment_id: deploymentId,
                deployment_name: deploymentName,
                deployment_status: deploymentStatus,
                deployment_status_reason: reason
            }) => ({
                deploymentId,
                deploymentName,
                deploymentStatus,
                deploymentFailureReason: reason || ''
            })
        );
}

async function getDeploymentStatusByName(accountId: string, name: string): Promise<DeploymentStatusResponseType> {
    logger.info(' Deployment status by id', accountId, name);

    try {
        const [
            {
                deployment_id: deploymentId,
                deployment_name: deploymentName,
                deployment_status: deploymentStatus,
                deployment_status_reason: reason
            }
        ] = await listDeployments(accountId, undefined, name, undefined, undefined, 1);
        return {
            deploymentId,
            deploymentName,
            deploymentStatus,
            deploymentFailureReason: reason || ''
        };
    } catch (error) {
        throw createError(HttpErrorCodes.NOT_FOUND, STACK_NOT_FOUND(name));
    }
}

async function getDeployments(
    accountId?: string,
    deploymentId?: string,
    deploymentName?: string,
    statuses?: Array<DEPLOYMENT_STATUS>,
    parentStackOnly?: boolean,
    API_PAGE_SIZE?: number,
    nextToken?: string
): Promise<Array<DeploymentDetails>> {
    logger.info(' Get the Deployments', {
        accountId,
        deploymentId,
        deploymentName,
        statuses,
        parentStackOnly,
        API_PAGE_SIZE,
        nextToken
    });

    try {
        const records = await listDeployments(
            accountId,
            deploymentId,
            deploymentName,
            statuses,
            parentStackOnly,
            API_PAGE_SIZE,
            nextToken
        );
        return trimAccountIdForDemo(records);
    } catch (error) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to list the deployments');
    }
}

async function getResources(
    params: GetResourcesParams
): Promise<{ count: number; items: Array<ResourceDetails>; nextToken?: string }> {
    const {
        accountId,
        resourceId,
        credentialsId,
        region,
        resourceType: inputResourceType,
        pageSize = 200,
        nextToken,
        includeDatabaseInstances,
        allRecords,
        assessmentData
    } = params;

    logger.info(' Get the Resources', {
        accountId,
        resourceId,
        credentialsId,
        region,
        resourceType: inputResourceType,
        pageSize,
        nextToken,
        assessmentData
    });

    const resourceType = inputResourceType || [RESOURCESTYPE.MSSQL, RESOURCESTYPE.PGSQL];

    let finalPageSize: number | undefined = pageSize;
    if (allRecords) {
        finalPageSize = undefined;
    }

    try {
        const recordsPromise = listResources({
            accountId,
            resourceId,
            credentialIds: credentialsId,
            region,
            resourceType,
            pageSize: finalPageSize,
            nextToken,
            includeDatabaseInstances,
            selectKeys: [...RESOURCE_DEFAULT_SELECT_FIELDS, 'assessment_data', 'configurations']
        });

        const countPromise = countResources(accountId);

        const {
            _count: { id: totalResourcesCount }
        } = await countPromise;

        const records = await recordsPromise;
        const items = trimAccountIdForDemo(records) as Array<ResourceDetails>;

        const filteredItems = items.filter((item): item is ResourceDetails => item.id !== null);
        const filteredItemsWithStringId = filteredItems as Array<ResourceDetails & { id: string }>;
        return {
            count: filteredItems.length,
            items: filteredItems,
            ...(finalPageSize && {
                nextToken: getNextToken(filteredItemsWithStringId, totalResourcesCount, finalPageSize)
            })
        };
    } catch (error) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to list the resources');
    }
}

// To differentiate the users in the DEMO Mode, we are keeping accountId as accountId_UserId in the database
// So while saving & retrieving we have to maintain the same in demo mode
function trimAccountIdForDemo(records: any) {
    logger.debug('records', records);
    if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
        if (records && records.length) {
            const modifiedData = records.map((record: any) => {
                const { account_id: accountId, ...rest } = record;
                const [modifiedAccountId] = accountId.split('_');
                // For test cases there will not be bearer token so the user id will be undefined.. To handle that using accountId as it is
                return { account_id: modifiedAccountId || accountId, ...rest };
            });
            return modifiedData;
        }
    }
    return records;
}

async function getInstanceInfo(
    accountId: string,
    credentialsId: string,
    databaseHostId: string,
    databaseInstanceId: string,
    region?: string
) {
    const result = await getPaginatedDatabaseInstances(accountId, {
        credentialsId,
        resourceId: databaseHostId,
        databaseInstanceId,
        region,
        shouldIncludeResource: true,
        additionalResourceFields: ['assessment_data', 'configurations']
    });

    const instances = Array.isArray(result) ? result : result.items;
    const [instanceDetail] = instances;

    if (isEmpty(instanceDetail)) {
        const errorMessage = `No database instance by id ${databaseInstanceId} in host by id ${databaseHostId} for ${accountId} is found.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    return instanceDetail;
}

async function listAllManagedInstances(accountId?: string, record?: ListDatabaseInstancesRecord) {
    return getPaginatedDatabaseInstances(accountId, record);
}

async function updateInstanceMetadata(accountId: string, instanceId: string, metaData: any) {
    logger.info('Update instance metadata', { accountId, instanceId });
    return updateDatabaseInstance({ accountId, instanceId, metaData });
}

async function updateDatabaseInstanceConfigurations(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    instanceId: string,
    updatedConfigs: any
) {
    logger.info('Update instance configurations', { accountId, instanceId });
    return updateDatabaseInstance({ accountId, credentialsId, region, databaseHostId, instanceId, updatedConfigs });
}

async function updateResourceMetaData(accountId: string, credentialsId: string, resourceId: string, metaData?: any) {
    logger.info('Update resource metadata', { accountId, resourceId });
    return updateResource({ accountId, credentialsId, resourceId, metaData });
}

async function updateDatabaseHostConfigurations(
    accountId: string,
    credentialsId: string,
    region: string,
    resourceId: string,
    updatedConfigs: any
) {
    logger.info('Update host configurations', { accountId, resourceId });
    return updateResource({ accountId, credentialsId, region, resourceId, updatedConfigs });
}

async function getPaginatedDatabaseInstances(
    accountId?: string,
    record?: ListDatabaseInstancesRecord
): Promise<PaginatedDatabaseInstancesResponse> {
    const {
        resourceId,
        databaseInstanceId,
        credentialsId,
        region,
        pageSize,
        nextToken,
        shouldIncludeResource,
        additionalResourceFields
    } = record || {};

    logger.info('Get paginated database instances', {
        accountId,
        resourceId,
        databaseInstanceId,
        credentialsId,
        region,
        pageSize,
        nextToken
    });

    try {
        // Only perform count and pagination operations when pageSize is provided
        let [records, instanceCountResult] = await Promise.all([
            listDatabaseInstances(accountId, record),
            pageSize ? countDatabaseInstances(accountId) : Promise.resolve({ _count: { id: 0 } })
        ]);
        if (shouldIncludeResource) {
            records = await handleDemoFlowMapping(records, accountId, credentialsId, additionalResourceFields);
        }
        const items = trimAccountIdForDemo(records) as Array<DatabaseInstance>;
        const filteredItems = items.filter((item): item is DatabaseInstance => item.database_instance_id !== null);

        if (pageSize) {
            const {
                _count: { id: totalInstancesCount }
            } = instanceCountResult;
            const filteredItemsWithStringId = filteredItems as Array<DatabaseInstance & { id: string }>;

            return {
                totalCount: filteredItems.length,
                items: filteredItems,
                nextToken: getNextToken(
                    filteredItemsWithStringId.filter(item => typeof item.id === 'string'),
                    totalInstancesCount,
                    pageSize
                )
            };
        }

        return {
            totalCount: filteredItems.length,
            items: filteredItems
            // No nextToken when pageSize is not provided
        };
    } catch (error) {
        logger.error('Failed to list database instances', error);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `Failed to list the Database Instances. ${error}`);
    }
}

async function updateDatabaseHostAssessmentData(
    accountId: string,
    credentialsId: string,
    resourceId: string,
    updatedAssessmentData: any
) {
    logger.info('Update host assessment data', { accountId, resourceId });
    return updateResource({ accountId, credentialsId, resourceId, updatedAssessmentData });
}

async function updateDatabaseHostAssessmentResults(
    accountId: string,
    credentialsId: string,
    region: string,
    resourceId: string,
    updatedAssessmentResults: any
) {
    logger.info('Update host assessment results', { accountId, resourceId });
    return updateResource({ accountId, credentialsId, region, resourceId, updatedAssessmentResults });
}

async function updateDatabaseInstanceAssessmentResults(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    instanceId: string,
    assessmentResults: any
) {
    logger.info('Update instance configurations', { accountId, instanceId });
    return updateDatabaseInstance({ accountId, credentialsId, region, databaseHostId, instanceId, assessmentResults });
}

async function populateDbInstances(resourceDetails: ResourceDetails) {
    const { account_id: accountId, credentials_id: credentialsId, region, resource_id: resourceId } = resourceDetails;
    if (isEmpty(resourceDetails.database_instances)) {
        try {
            const result = await getPaginatedDatabaseInstances(accountId, { credentialsId, region, resourceId });
            resourceDetails.database_instances = Array.isArray(result)
                ? (result as DatabaseInstance[])
                : (result.items as DatabaseInstance[]) ?? [];
        } catch (err) {
            logger.error('Failed to list database instances', err);
        }
    }
}

async function upsertDatabaseInstance(
    accountId: string,
    record: DatabaseInstanceRecord,
    checkOfflineAssessment: boolean = false
) {
    const { metaData, databaseType, resourceId, databaseInstanceId } = record;
    logger.info('Upsert database instance', {
        accountId,
        resourceId,
        databaseInstanceId,
        checkOfflineAssessment
    });

    try {
        // Check if instance was assessed using onetimewad and get updateCount
        // Only check when explicitly requested (e.g., from register-operations.ts)
        let numberOfTimesAssessedOffline: number | undefined;
        if (metaData && checkOfflineAssessment && databaseType === DatabaseTypes.MS_SQL_SERVER) {
            try {
                // Get offline assessment, selecting only metadata column
                const offlineAssessment = await getOfflineAssessment(accountId, resourceId, databaseInstanceId, [
                    'metadata'
                ]);

                if (offlineAssessment?.metadata) {
                    numberOfTimesAssessedOffline = (offlineAssessment.metadata as Record<string, unknown>)
                        .updateCount as number | undefined;
                }
            } catch (error: any) {
                logger.warn('Failed to check offline assessment for instance', {
                    accountId,
                    resourceId,
                    databaseInstanceId,
                    error: error.message
                });
            }
        }

        const finalMetaData: DatabaseInstanceMetadata | undefined =
            metaData !== undefined && numberOfTimesAssessedOffline !== undefined
                ? { ...metaData, numberOfTimesAssessedOffline }
                : metaData !== undefined
                ? metaData
                : undefined;

        // Create updated record with final metadata
        const updatedRecord: DatabaseInstanceRecord = {
            ...record,
            metaData: finalMetaData
        };

        return dbUpsertDatabaseInstance(accountId, updatedRecord);
    } catch (error) {
        logger.error('Failed to upsert database instance', {
            accountId,
            resourceId: record.resourceId,
            databaseInstanceId: record.databaseInstanceId,
            error
        });
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Failed to upsert database instance ${record.databaseInstanceId}. ${error}`
        );
    }
}

async function listTrackedEc2Operation({
    feature,
    accountId,
    region,
    credentialsId,
    instanceId,
    pageSize,
    nextToken
}: ListTrackedEc2Params) {
    logger.info('Listing tracked EC2 instances', { feature, accountId, region, credentialsId, instanceId });

    feature = feature || TCO_FEATURE;
    const filters = {
        feature,
        ...(accountId && { account_id: accountId }),
        ...(region && { region }),
        ...(credentialsId && { credentials_id: credentialsId }),
        ...(instanceId && { instance_id: instanceId })
    };

    const [records, count] = await Promise.all([
        listTrackedEc2({ filters, pageSize, nextToken }),
        pageSize ? countTrackedEc2({ ...filters }) : Promise.resolve(0)
    ]);

    return {
        totalCount: count ?? 0,
        items: records ?? [],
        ...(pageSize && { nextToken: getNextToken(records, count, pageSize) })
    };
}

export {
    getSavedConfig,
    getAllSavedConfig,
    saveConfig,
    modifyConfig,
    deleteSavedConfig,
    getAllDeploymentStatus,
    getDeploymentStatusByName,
    getDeployments,
    getResources,
    trimAccountIdForDemo,
    getInstanceInfo,
    listAllManagedInstances,
    updateInstanceMetadata,
    updateDatabaseInstanceConfigurations,
    updateResourceMetaData,
    updateDatabaseHostConfigurations,
    getPaginatedDatabaseInstances,
    updateDatabaseHostAssessmentData,
    updateDatabaseHostAssessmentResults,
    updateDatabaseInstanceAssessmentResults,
    populateDbInstances,
    upsertDatabaseInstance,
    listTrackedEc2Operation
};
