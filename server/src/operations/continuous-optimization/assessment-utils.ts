import { JOBSTATUS } from '@prisma/client';
import createError from 'http-errors';
import ms from 'ms';
import { getJobs, registerJob } from '../database/job-operations';
import { getTimeDifferenceInMinutes } from '../../utils/utils';
import { updateLongRunningAuditGroup } from '../cloud-manager/audit-operations';
import {
    ASSESSMENT_CONFIGS,
    AssessmentStatus,
    DISMISS_DEACTIVATION_REASON,
    DISMISS_STATUS,
    DISMISS_UPDATE_STATUS,
    HOST_LEVEL_CONFIGURATIONS,
    STORAGE_ASSESMENT_CONFIGS_MAP,
    STORAGE_CONFIGURATION_ASSESMENT_MAP
} from '../../utils/continous-optimization-consts';
import getLogger from '../../utils/logger';
import {
    getInstanceInfo,
    updateDatabaseHostConfigurations,
    updateDatabaseInstanceConfigurations
} from '../database/database-operations';
import { BulkDismissConfigurationType } from '../../routes/types/continuous-optimization.types';
import {
    DatabaseInstanceDismissConfigs,
    DatabaseInstanceConfigurations,
    InstanceDismissParams,
    DatabaseHostConfigurations
} from '../../utils/common-types';

import { listResources } from '../../lib/database/db';

import { HttpErrorCodes, POSTPONE_AGE } from '../../utils/consts';

const logger = getLogger();

interface ConfigurationRecord {
    accountId: string;
    configName: string;
    startTime: number;
    configState: string;
    databaseHostId: string;
    credentialsId: string;
    region: string;
    response: BulkDismissConfigurationType;
    hostIndex: number;
    endTime: number;
    sqlServerInstances?: string[];
}
interface PerHostJobMetadata {
    optimizationType: string;
    resourceId: string;
    sqlServerInstances: Array<string>;
}
interface JobMetadata {
    hostsToOptimize: Array<PerHostJobMetadata>;
}

function getMatchingAssessmentStatus(finding: string) {
    logger.info('Getting matching assessment status for finding:', finding);
    switch (finding) {
        case 'NOT_OPTIMIZED':
            return AssessmentStatus.NOT_OPTIMIZED;
        case 'OVER_PROVISIONED':
            return AssessmentStatus.OVER_PROVISIONED;
        case 'UNDER_PROVISIONED':
            return AssessmentStatus.UNDER_PROVISIONED;
        case 'OPTIMIZED':
        default:
            return AssessmentStatus.OPTIMIZED;
    }
}

async function handleOptimizeJobCreation(
    accountId: string,
    credentialsId: string,
    region: string,
    serverNameWithHostName: string,
    jobType: string,
    jobName: string,
    jobDescription: string,
    parentJobId?: string,
    jobMetadata?: JobMetadata
) {
    updateLongRunningAuditGroup(undefined, undefined, serverNameWithHostName);

    const filterParams = {
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: serverNameWithHostName,
        typeFilter: jobType,
        region,
        credentialsId,
        ...(parentJobId && { parentJobId })
    };
    const {
        items: [job]
    } = await getJobs(accountId, filterParams);

    if (job) {
        const timeDifferenceInMinutes = getTimeDifferenceInMinutes(job.startTime);
        if (timeDifferenceInMinutes <= 5) {
            throw createError(412, `A job is already in progress with ID: ${job.id}. Please wait for it to finish.`);
        }
    }

    // create the parent job for optimize operation
    const { id } = await registerJob(accountId, credentialsId, region, {
        type: jobType,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: serverNameWithHostName,
        name: jobName,
        startTime: Date.now(),
        description: jobDescription,
        ...(parentJobId && { parentJobId }),
        ...(jobMetadata && { metadata: jobMetadata })
    });
    logger.debug(`Job created with id ${id}`);

    return id;
}

function createNewConfig(configurationName: string, configState: string, startTime: number, endTime?: number) {
    logger.debug('Creating new config for instance dismiss configurations', { configurationName });
    return {
        configurationName,
        startTime,
        configState,
        ...(() => {
            switch (configState) {
                case DISMISS_STATUS.POSTPONED:
                    return {
                        endTime,
                        deactivationReason: undefined
                    };
                case DISMISS_STATUS.DISMISSED:
                    return {
                        endTime: undefined,
                        deactivationReason: undefined
                    };
                case DISMISS_STATUS.ACTIVE:
                case DISMISS_STATUS.ACTIVATING:
                    return {
                        deactivationReason: DISMISS_DEACTIVATION_REASON.USER,
                        endTime: undefined,
                        configState: DISMISS_STATUS.ACTIVATING
                    };
                default:
                    return {};
            }
        })()
    };
}

function updateConfigsArray(
    configsArray: InstanceDismissParams[],
    newConfig: InstanceDismissParams
): InstanceDismissParams[] {
    logger.debug('Updating configs array', { configsArray, newConfig });
    const { configurationName } = newConfig;
    const existingConfigIndex = configsArray.findIndex(
        (config: InstanceDismissParams) => config.configurationName === configurationName
    );

    if (existingConfigIndex !== -1) {
        configsArray[existingConfigIndex] = newConfig;
    } else {
        configsArray.push(newConfig);
    }

    return configsArray;
}

async function formatInstanceDismissConfigurations(
    currentConfigs: DatabaseInstanceDismissConfigs,
    newConfigs: InstanceDismissParams
) {
    logger.info('Formatting instance dismiss configurations', { currentConfigs, newConfigs });
    const { configurationName, startTime, configState, endTime } = newConfigs;

    const matchingKey = Object.keys(ASSESSMENT_CONFIGS).find(
        key => ASSESSMENT_CONFIGS[key as keyof typeof ASSESSMENT_CONFIGS] === configurationName
    );

    if (matchingKey) {
        const newConfig = createNewConfig(configurationName, configState, startTime, endTime);
        const updatedConfigs = {
            ...currentConfigs,
            [matchingKey]: {
                ...newConfig
            }
        };
        return updatedConfigs;
    }

    const storageKey = Object.keys(STORAGE_ASSESMENT_CONFIGS_MAP).find(key =>
        STORAGE_ASSESMENT_CONFIGS_MAP[key as keyof typeof STORAGE_ASSESMENT_CONFIGS_MAP].includes(configurationName)
    );

    if (storageKey) {
        const updatedConfigs = { ...currentConfigs };
        updatedConfigs.storage = updatedConfigs.storage || {};
        const storageArray =
            (updatedConfigs.storage[storageKey as keyof typeof updatedConfigs.storage] as InstanceDismissParams[]) ||
            [];
        const newConfig = createNewConfig(configurationName, configState, startTime, endTime);
        updatedConfigs.storage[storageKey as keyof typeof updatedConfigs.storage] = updateConfigsArray(
            storageArray,
            newConfig
        );

        return updatedConfigs;
    }

    const storageConfigKey = Object.keys(STORAGE_CONFIGURATION_ASSESMENT_MAP).find(key =>
        STORAGE_CONFIGURATION_ASSESMENT_MAP[key as keyof typeof STORAGE_CONFIGURATION_ASSESMENT_MAP].includes(
            configurationName
        )
    );

    if (storageConfigKey) {
        const updatedConfigs = { ...currentConfigs };
        updatedConfigs.storage = updatedConfigs.storage || {};
        updatedConfigs.storage.configuration = updatedConfigs.storage.configuration || {};
        const configArray =
            updatedConfigs.storage.configuration[
                storageConfigKey as keyof typeof updatedConfigs.storage.configuration
            ] || [];
        const newConfig = createNewConfig(configurationName, configState, startTime, endTime);
        updatedConfigs.storage.configuration[storageConfigKey as keyof typeof updatedConfigs.storage.configuration] =
            updateConfigsArray(configArray, newConfig);

        return updatedConfigs;
    }

    logger.error('No matching key found for the configuration name:', configurationName);
    throw createError(
        HttpErrorCodes.NOT_FOUND,
        `No matching key found for the configuration name: ${configurationName}`
    );
}

async function updateDismissConfigurations(accountId: string, configurations: BulkDismissConfigurationType[]) {
    logger.info('Updating dismiss configurations for account:', { accountId, configurations });
    const finalResponse = await Promise.all(
        configurations.map(async config => {
            const { configurationName: configName, configState, databaseHosts: hostsToDismiss } = config;
            const startTime = Date.now();
            const thirtyDaysInMs = ms(`${POSTPONE_AGE}d`);
            const endTime = startTime + thirtyDaysInMs;
            const response = {
                configurationName: configName,
                startTime,
                configState,
                databaseHosts: hostsToDismiss,
                endTime: configState === DISMISS_STATUS.POSTPONED ? endTime : undefined
            };

            await Promise.all(
                hostsToDismiss.map(async host => {
                    const { id: databaseHostId, sqlServerInstances, credentialsId, region } = host;
                    const hostIndex = response.databaseHosts.findIndex(hostId => hostId.id === databaseHostId);

                    if (HOST_LEVEL_CONFIGURATIONS.includes(configName)) {
                        const record = {
                            accountId,
                            configName,
                            startTime,
                            configState,
                            databaseHostId,
                            credentialsId,
                            region,
                            response,
                            hostIndex,
                            endTime
                        };
                        await handleHostLevelConfigurations(record);
                    } else {
                        const record = {
                            accountId,
                            configName,
                            startTime,
                            configState,
                            databaseHostId,
                            credentialsId,
                            region,
                            response,
                            hostIndex,
                            endTime,
                            sqlServerInstances
                        };
                        await handleInstanceLevelConfigurations(record);
                    }
                })
            );

            return response;
        })
    );

    return { dismissedConfigurations: finalResponse };
}

async function handleHostLevelConfigurations(record: ConfigurationRecord) {
    logger.debug('Handling host level configurations', { record });
    const {
        accountId,
        configName,
        startTime,
        configState,
        databaseHostId,
        credentialsId,
        region,
        response,
        hostIndex,
        endTime
    } = record;
    let resourceDetails;
    let updatedStatus = DISMISS_UPDATE_STATUS.SUCCESS;

    try {
        [resourceDetails] = await listResources(accountId, databaseHostId, credentialsId, region);
    } catch (error) {
        logger.error('Error fetching resource details:', error);
    }

    if (!resourceDetails) {
        response.databaseHosts[hostIndex].failedInstances = [
            { databaseHostId, errorMessage: 'Database host not found' }
        ];
        updatedStatus = DISMISS_UPDATE_STATUS.FAILED;
    } else {
        const currentConfigs = resourceDetails.configurations as unknown as DatabaseHostConfigurations;
        const dismissedConfigs = currentConfigs?.dismissedConfigurations || {};
        const updatedConfigs = await formatInstanceDismissConfigurations(dismissedConfigs, {
            configurationName: configName,
            startTime,
            endTime,
            configState
        });

        try {
            await updateDatabaseHostConfigurations(accountId, credentialsId, region, databaseHostId, {
                dismissedConfigurations: updatedConfigs
            });
        } catch (error) {
            logger.error('Error updating dismiss configurations:', error);
            updatedStatus = DISMISS_UPDATE_STATUS.FAILED;
        }

        logger.info('Updating host level configurations', { configurations: updatedConfigs });
    }
    response.databaseHosts[hostIndex].status = updatedStatus;
}

async function handleInstanceLevelConfigurations(record: ConfigurationRecord) {
    logger.debug('Handling instance level configurations', { record });
    const {
        accountId,
        configName,
        startTime,
        configState,
        databaseHostId,
        credentialsId,
        region,
        response,
        hostIndex,
        endTime,
        sqlServerInstances = []
    } = record;
    await Promise.all(
        sqlServerInstances.map(async sqlServerInstanceId => {
            let instance;
            try {
                instance = await getInstanceInfo(accountId, credentialsId, databaseHostId, sqlServerInstanceId, region);
            } catch (error) {
                instance = undefined;
            }

            if (!instance) {
                addFailedInstance(response, hostIndex, sqlServerInstanceId, 'Database instance not found');
            } else {
                const currentConfigs = instance.configurations as unknown as DatabaseInstanceConfigurations;
                const dismissedConfigs = currentConfigs?.dismissedConfigurations || {};
                const updatedConfigs = await formatInstanceDismissConfigurations(dismissedConfigs, {
                    configurationName: configName,
                    startTime,
                    configState,
                    endTime
                });

                try {
                    await updateDatabaseInstanceConfigurations(
                        accountId,
                        credentialsId,
                        region,
                        databaseHostId,
                        sqlServerInstanceId,
                        { dismissedConfigurations: updatedConfigs }
                    );
                } catch (error) {
                    logger.error('Error updating dismiss configurations:', error);
                    addFailedInstance(
                        response,
                        hostIndex,
                        sqlServerInstanceId,
                        `Failed to update config details ${error}`
                    );
                }
            }
        })
    );

    updateHostStatus(response, hostIndex, sqlServerInstances);
}

function addFailedInstance(
    response: BulkDismissConfigurationType,
    hostIndex: number,
    instanceId: string,
    errorMessage: string
) {
    logger.debug('Adding failed instance', { hostIndex, instanceId, errorMessage });
    if (!response.databaseHosts[hostIndex]?.failedInstances) {
        response.databaseHosts[hostIndex].failedInstances = [
            { databaseHostId: response.databaseHosts[hostIndex].id, instanceId, errorMessage }
        ];
    } else {
        response.databaseHosts[hostIndex].failedInstances.push({
            databaseHostId: response.databaseHosts[hostIndex].id,
            instanceId,
            errorMessage
        });
    }
}

function updateHostStatus(response: BulkDismissConfigurationType, hostIndex: number, sqlServerInstances: string[]) {
    logger.debug('Updating host status', { hostIndex, sqlServerInstances });
    const updatedInstancesCount =
        sqlServerInstances.length - (response.databaseHosts[hostIndex]?.failedInstances?.length || 0);
    let updatedStatus: string;
    if (updatedInstancesCount === 0) {
        updatedStatus = DISMISS_UPDATE_STATUS.FAILED;
    } else if (updatedInstancesCount === sqlServerInstances.length) {
        updatedStatus = DISMISS_UPDATE_STATUS.SUCCESS;
    } else {
        updatedStatus = DISMISS_UPDATE_STATUS.PARTIAL;
    }

    response.databaseHosts[hostIndex].status = updatedStatus;
}

function updateFieldsBasedOnDismissedConfigurations(
    fieldsValues: string[],
    dismissedConfigurations: DatabaseInstanceDismissConfigs
) {
    logger.info('Updating fields based on dismissed configurations', { fieldsValues, dismissedConfigurations });

    const updatedFieldsValues = fieldsValues.filter(
        fieldValue =>
            !Object.entries(dismissedConfigurations).some(
                ([keyName, config]) =>
                    (keyName === fieldValue ||
                        (config as { configurationName?: string }).configurationName === fieldValue) &&
                    [DISMISS_STATUS.POSTPONED, DISMISS_STATUS.DISMISSED].includes(config.configState) &&
                    config.configurationType !== 'storage'
            )
    );

    return updatedFieldsValues;
}

function processConfigForExpiration(configDetails: InstanceDismissParams) {
    logger.debug('Processing config for expiration', { configDetails });
    const { endTime, configState, configurationName } = configDetails;
    let updatedStorageConfig = configDetails;
    let isConfigExpired = false;

    if (
        configState === DISMISS_STATUS.ACTIVATING ||
        (configState === DISMISS_STATUS.POSTPONED && endTime && Date.now() > endTime)
    ) {
        logger.debug(`Configuration ${configurationName} has expired and will be activated`, { configDetails });
        updatedStorageConfig = {
            ...configDetails,
            configState: DISMISS_STATUS.ACTIVE,
            deactivationReason: DISMISS_DEACTIVATION_REASON.EXPIRED,
            endTime: undefined
        };
        isConfigExpired = true;
    }
    return { updatedStorageConfig, isConfigExpired };
}

function processConfigEntries(
    entries: [string, InstanceDismissParams][],
    dismissedConfigs: DatabaseInstanceDismissConfigs
) {
    let isConfigUpdated = false;

    const updatedConfigs: DatabaseInstanceDismissConfigs = { ...dismissedConfigs };
    entries.forEach(([key, config]) => {
        if (key === 'storage') {
            const storageEntries = Object.entries(config);
            storageEntries.forEach(([storageKey, storageConfig]) => {
                if (storageKey === 'configuration') {
                    const configEntries = Object.entries(storageConfig as DatabaseInstanceDismissConfigs);
                    configEntries.forEach(([configKeyName, configValue]) => {
                        const subCategories = Object.entries(configValue);
                        subCategories.forEach(([configName, configDetails]) => {
                            const { updatedStorageConfig, isConfigExpired } = processConfigForExpiration(
                                configDetails as InstanceDismissParams
                            );
                            if (isConfigExpired) {
                                (
                                    (
                                        updatedConfigs!.storage!.configuration as Record<
                                            string,
                                            Record<string, InstanceDismissParams>
                                        >
                                    )[configKeyName] as Record<string, InstanceDismissParams>
                                )[configName] = updatedStorageConfig;
                                isConfigUpdated = true;
                            }
                        });
                    });
                } else if (['sizing', 'layout'].includes(storageKey)) {
                    const storageConfigEntries = Object.entries(storageConfig as InstanceDismissParams);
                    storageConfigEntries.forEach(([configKey, configValue]) => {
                        const { updatedStorageConfig, isConfigExpired } = processConfigForExpiration(
                            configValue as InstanceDismissParams
                        );
                        if (isConfigExpired) {
                            (
                                updatedConfigs.storage![storageKey as keyof typeof updatedConfigs.storage] as Record<
                                    string,
                                    InstanceDismissParams
                                >
                            )[configKey] = updatedStorageConfig;
                            isConfigUpdated = true;
                        }
                    });
                }
            });
        } else {
            const { updatedStorageConfig, isConfigExpired } = processConfigForExpiration(config);
            if (isConfigExpired) {
                updatedConfigs[key as keyof typeof dismissedConfigs] = updatedStorageConfig;
                isConfigUpdated = true;
            }
        }
    });
    return { updatedConfigs, isConfigUpdated };
}

async function checkAndUpdatePostponedEndTime(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    dismissedConfigurations: { instance?: DatabaseInstanceDismissConfigs; host?: DatabaseInstanceDismissConfigs },
    databaseInstanceId?: string
) {
    logger.info('Check and update postponed config for end time', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        dismissedInstanceConfigurationsExists: Boolean(dismissedConfigurations?.instance),
        dismissedHostConfigurationsExists: Boolean(dismissedConfigurations?.host),
        databaseInstanceId
    });
    const dismissedInstanceConfigurations = dismissedConfigurations?.instance || {};
    const dismissedHostConfigurations = dismissedConfigurations?.host || {};

    let updatedInstanceConfigs = dismissedInstanceConfigurations;
    let updatedHostConfigs = dismissedHostConfigurations;
    let isInstanceConfigUpdated = false;
    let isHostConfigUpdated = false;

    if (dismissedInstanceConfigurations) {
        const result = processConfigEntries(
            Object.entries(dismissedInstanceConfigurations),
            dismissedInstanceConfigurations
        );
        updatedInstanceConfigs = result.updatedConfigs;
        isInstanceConfigUpdated = result.isConfigUpdated;
    }
    if (dismissedHostConfigurations) {
        const result = processConfigEntries(Object.entries(dismissedHostConfigurations), dismissedHostConfigurations);
        updatedHostConfigs = result.updatedConfigs;
        isHostConfigUpdated = result.isConfigUpdated;
    }

    if (!isInstanceConfigUpdated && !isHostConfigUpdated) {
        logger.info('No postponed configurations found to update end time');
        return { dismissedInstanceConfigurations, dismissedHostConfigurations };
    }

    await Promise.all([
        databaseInstanceId
            ? updateDatabaseInstanceConfigurations(
                  accountId,
                  credentialsId,
                  region,
                  databaseHostId,
                  databaseInstanceId,
                  { dismissedConfigurations: dismissedInstanceConfigurations }
              )
            : Promise.resolve(),
        updateDatabaseHostConfigurations(accountId, credentialsId, region, databaseHostId, {
            dismissedConfigurations: dismissedHostConfigurations
        })
    ]);

    return { dismissedInstanceConfigurations: updatedInstanceConfigs, dismissedHostConfigurations: updatedHostConfigs };
}

// Recursive function to check for any "not-optimized" status in the assessment results.
// It checks both arrays and objects, looking for the specific status in any nested structure.
// Returns true if any "not-optimized" status is found, otherwise false.
// This is used to determine if an instance has any assessment results that are not optimized.
function hasNotOptimizedStatus(obj: any): boolean {
    if (Array.isArray(obj)) {
        return obj.some(hasNotOptimizedStatus);
    }
    if (obj && typeof obj === 'object') {
        if (obj.status === AssessmentStatus.NOT_OPTIMIZED || obj.errorMessage) {
            return true;
        }
        return Object.values(obj).some(hasNotOptimizedStatus);
    }
    return false;
}

export {
    getMatchingAssessmentStatus,
    handleOptimizeJobCreation,
    JobMetadata,
    updateDismissConfigurations,
    formatInstanceDismissConfigurations,
    updateFieldsBasedOnDismissedConfigurations,
    checkAndUpdatePostponedEndTime,
    hasNotOptimizedStatus
};
