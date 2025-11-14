import createError from 'http-errors';
import ms from 'ms';
import throat from 'throat';
import {
    ASSESSMENT_CONFIGS,
    DISMISS_DEACTIVATION_REASON,
    DISMISS_STATUS,
    DISMISS_UPDATE_STATUS,
    HOST_LEVEL_CONFIGURATIONS,
    INSTANCE_LEVEL_CONFIGURATIONS,
    MSSQL_STORAGE_ASSESSMENT_CONFIGS_MAP,
    MSSQL_STORAGE_CONFIGURATION_ASSESSMENT_MAP,
    ORACLE_STORAGE_CONFIGURATION_ASSESSMENT_MAP,
    ORACLE_STORAGE_ASSESSMENT_CONFIGS_MAP,
    ORACLE_ISCSI_SPECIFIC_LAYOUT_CONFIGS,
    ORACLE_NFS_STORAGE_CONFIGURATION_ASSESSMENT_MAP,
    ORACLE_ISCSI_STORAGE_CONFIGURATION_ASSESSMENT_MAP
} from '../../utils/continous-optimization-consts';
import getLogger from '../../utils/logger';
import {
    getInstanceInfo,
    updateDatabaseHostConfigurations,
    updateDatabaseInstanceConfigurations
} from '../database/database-operations';
import {
    BulkDismissConfigurationType,
    DatabaseInstanceDismissConfigs,
    DatabaseInstanceConfigurations,
    InstanceDismissParams,
    DatabaseHostConfigurations,
    DismissHostGroup,
    DismissInstanceGroup,
    BulkDismissConfigurationResponseItem,
    StorageDismissConfigs
} from '../../utils/common-types';
import { listResources } from '../../lib/database/db';
import { HttpErrorCodes, POSTPONE_AGE, DatabaseTypes, STORAGE_PROTOCOLS } from '../../utils/consts';
import { RESOURCE_DEFAULT_SELECT_FIELDS } from '../../utils/database-consts';

const logger = getLogger();

enum DismissGroupType {
    Host = 'host',
    Instance = 'instance'
}
enum DismissConfigType {
    Common = 'common',
    StorageConfig = 'storageConfig',
    Storage = 'storage',
    HighAvailability = 'highAvailability'
}

function isConfigDismissed(configState: string): boolean {
    return [DISMISS_STATUS.POSTPONED, DISMISS_STATUS.DISMISSED].includes(configState);
}

function createNewConfig(configurationName: string, configState: string, startTime: number, endTime?: number) {
    logger.debug('Creating new config for dismiss configurations', { configurationName });
    return {
        configurationName,
        startTime,
        configState,
        ...(() => {
            switch (configState) {
                case DISMISS_STATUS.POSTPONED:
                    return {
                        endTime,
                        reactivationReason: undefined
                    };
                case DISMISS_STATUS.DISMISSED:
                    return {
                        endTime: undefined,
                        reactivationReason: undefined
                    };
                case DISMISS_STATUS.ACTIVE:
                case DISMISS_STATUS.ACTIVATING:
                    return {
                        reactivationReason: DISMISS_DEACTIVATION_REASON.USER,
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

function updateConfig({
    currentConfigs,
    configKey,
    configType,
    configurationName,
    configState,
    startTime,
    endTime
}: {
    currentConfigs: DatabaseInstanceDismissConfigs;
    configKey: string;
    configType: DismissConfigType;
    configurationName: string;
    configState: string;
    startTime: number;
    endTime?: number;
}) {
    const updatedConfigs = { ...currentConfigs };
    const newConfig = createNewConfig(configurationName, configState, startTime, endTime);
    if (configType === DismissConfigType.Common) {
        (updatedConfigs as Record<string, unknown>)[configKey] = { ...newConfig };
    } else if (configType === DismissConfigType.Storage) {
        if (!updatedConfigs.storage) {
            updatedConfigs.storage = {};
        }
        const storageArray =
            (updatedConfigs.storage[configKey as keyof typeof updatedConfigs.storage] as InstanceDismissParams[]) ?? [];
        updatedConfigs.storage[configKey as keyof typeof updatedConfigs.storage] = updateConfigsArray(
            storageArray,
            newConfig
        );
    } else if (configType === DismissConfigType.StorageConfig) {
        if (!updatedConfigs.storage) {
            updatedConfigs.storage = {};
        }
        if (!updatedConfigs.storage.configuration) {
            updatedConfigs.storage.configuration = {};
        }
        const configArray =
            updatedConfigs.storage.configuration[configKey as keyof typeof updatedConfigs.storage.configuration] ?? [];
        updatedConfigs.storage.configuration[configKey as keyof typeof updatedConfigs.storage.configuration] =
            updateConfigsArray(configArray, newConfig);
    } else if (configType === DismissConfigType.HighAvailability) {
        if (!updatedConfigs.highAvailability) {
            updatedConfigs.highAvailability = [];
        }
        const haArray = updatedConfigs.highAvailability ?? [];
        updatedConfigs.highAvailability = updateConfigsArray(haArray, newConfig);
    }
    return updatedConfigs;
}

function formatDismissConfigurations(
    currentConfigs: DatabaseInstanceDismissConfigs,
    newConfigs: InstanceDismissParams,
    databaseType: DatabaseTypes = DatabaseTypes.MS_SQL_SERVER
) {
    logger.info('Formatting dismiss configurations', { currentConfigs, newConfigs, databaseType });
    const { configurationName, startTime, configState, endTime } = newConfigs;

    // Check for storage assessment configs (sizing, layout) based on database type
    const storageAssessmentMap =
        databaseType === DatabaseTypes.ORACLE
            ? ORACLE_STORAGE_ASSESSMENT_CONFIGS_MAP
            : MSSQL_STORAGE_ASSESSMENT_CONFIGS_MAP;

    const storageKey = Object.keys(storageAssessmentMap).find(key =>
        storageAssessmentMap[key as keyof typeof storageAssessmentMap].includes(configurationName)
    );
    if (storageKey) {
        return updateConfig({
            currentConfigs,
            configKey: storageKey,
            configType: DismissConfigType.Storage,
            configurationName,
            configState,
            startTime,
            endTime
        });
    }

    // Use appropriate storage configuration map based on database type
    const storageConfigMap =
        databaseType === DatabaseTypes.ORACLE
            ? ORACLE_STORAGE_CONFIGURATION_ASSESSMENT_MAP
            : MSSQL_STORAGE_CONFIGURATION_ASSESSMENT_MAP;

    const storageConfigKey = Object.keys(storageConfigMap).find(key =>
        storageConfigMap[key as keyof typeof storageConfigMap].includes(configurationName)
    );
    if (storageConfigKey) {
        return updateConfig({
            currentConfigs,
            configKey: storageConfigKey,
            configType: DismissConfigType.StorageConfig,
            configurationName,
            configState,
            startTime,
            endTime
        });
    }

    // High availability is only supported for MSSQL
    if (databaseType === DatabaseTypes.MS_SQL_SERVER) {
        const highAvailabilitySubkey = Object.keys(ASSESSMENT_CONFIGS.highAvailability).find(
            key =>
                ASSESSMENT_CONFIGS.highAvailability[key as keyof typeof ASSESSMENT_CONFIGS.highAvailability] ===
                configurationName
        );
        if (highAvailabilitySubkey) {
            return updateConfig({
                currentConfigs,
                configKey: highAvailabilitySubkey,
                configType: DismissConfigType.HighAvailability,
                configurationName,
                configState,
                startTime,
                endTime
            });
        }
    }

    const matchingKey = Object.keys(ASSESSMENT_CONFIGS).find(
        key => ASSESSMENT_CONFIGS[key as keyof typeof ASSESSMENT_CONFIGS] === configurationName
    );
    if (matchingKey) {
        return updateConfig({
            currentConfigs,
            configKey: matchingKey,
            configType: DismissConfigType.Common,
            configurationName,
            configState,
            startTime,
            endTime
        });
    }

    logger.error('No matching key found for the configuration name:', configurationName);
    throw createError(
        HttpErrorCodes.NOT_FOUND,
        `No matching key found for the configuration name: ${configurationName}`
    );
}

function calculateEndTime(currentTime: number, thirtyDaysInMs: number, configState: string): number | undefined {
    return configState === DISMISS_STATUS.POSTPONED ? currentTime + thirtyDaysInMs : undefined;
}

function getOrCreateGroup<T>(groupsMap: Map<string, T>, groupKey: string, groupData: T): T {
    let group = groupsMap.get(groupKey);
    if (!group) {
        group = groupData;
        groupsMap.set(groupKey, group);
    }
    return group;
}

function getOrCreateDismissGroup(
    groupsMap: Map<string, DismissHostGroup | DismissInstanceGroup>,
    groupKey: string,
    type: DismissGroupType,
    credentialsId: string,
    region: string,
    hostId: string,
    instanceId?: string
): DismissHostGroup | DismissInstanceGroup {
    if (type === DismissGroupType.Host) {
        return getOrCreateGroup(groupsMap, groupKey, {
            credentialsId,
            region,
            hostId,
            configs: []
        });
    }
    if (type === DismissGroupType.Instance) {
        if (!instanceId) {
            throw new Error(
                `instanceId is required for instance group (credentialsId: ${credentialsId}, region: ${region}, hostId: ${hostId})`
            );
        }
        return getOrCreateGroup(groupsMap, groupKey, {
            credentialsId,
            region,
            hostId,
            instanceId,
            configs: []
        });
    }
    throw new Error('Invalid group type');
}

function markGroupAsFailed(
    group: DismissHostGroup | DismissInstanceGroup,
    finalResponse: BulkDismissConfigurationResponseItem[],
    isInstanceGroup = false
): void {
    group.configs.forEach(({ originalConfigIndex }) => {
        const hostIndex = finalResponse[originalConfigIndex].databaseHosts.findIndex(h => h.id === group.hostId);
        if (hostIndex !== -1) {
            if (isInstanceGroup && 'instanceId' in group) {
                const response = finalResponse[originalConfigIndex];
                const errorMessage = 'Database update failed';
                if (!response.databaseHosts[hostIndex]?.failedInstances) {
                    response.databaseHosts[hostIndex].failedInstances = [
                        {
                            databaseHostId: response.databaseHosts[hostIndex].id,
                            instanceId: group.instanceId,
                            errorMessage
                        }
                    ];
                } else {
                    response.databaseHosts[hostIndex].failedInstances.push({
                        databaseHostId: response.databaseHosts[hostIndex].id,
                        instanceId: group.instanceId,
                        errorMessage
                    });
                }
                updateHostStatus(finalResponse[originalConfigIndex], hostIndex, [group.instanceId]);
            } else {
                finalResponse[originalConfigIndex].databaseHosts[hostIndex].status = DISMISS_UPDATE_STATUS.FAILED;
            }
        }
    });
}

async function updateDismissConfigurations(
    accountId: string,
    configurations: BulkDismissConfigurationType[],
    databaseType: DatabaseTypes = DatabaseTypes.MS_SQL_SERVER
) {
    logger.info('Updating dismiss configurations for account:', { accountId, configurations });

    const expandedConfigurations = expandConfigurations(configurations, databaseType);

    const hostGroups = new Map<string, DismissHostGroup>();
    const instanceGroups = new Map<string, DismissInstanceGroup>();

    const currentTime = Date.now();
    const thirtyDaysInMs = ms(`${POSTPONE_AGE}d`);

    const finalResponse: BulkDismissConfigurationResponseItem[] = expandedConfigurations.map(config => {
        const { configurationName: configName, configState, databaseHosts: hostsToDismiss } = config;

        return {
            configurationName: configName,
            startTime: currentTime,
            configState,
            databaseHosts: hostsToDismiss.map(host => ({
                ...host,
                status: undefined // Will be set based on actual DB operation results
            })),
            endTime: calculateEndTime(currentTime, thirtyDaysInMs, configState)
        };
    });

    expandedConfigurations.forEach((config, configIndex) => {
        const { configurationName: configName, configState, databaseHosts: hostsToDismiss } = config;
        const { endTime } = finalResponse[configIndex];

        hostsToDismiss.forEach(host => {
            const { id: hostId, credentialsId, region, sqlServerInstances = [] } = host;

            if (HOST_LEVEL_CONFIGURATIONS.includes(configName)) {
                const groupKey = `${credentialsId}:${region}:${hostId}`;
                const group = getOrCreateDismissGroup(
                    hostGroups,
                    groupKey,
                    DismissGroupType.Host,
                    credentialsId,
                    region,
                    hostId
                );
                group.configs.push({
                    configName,
                    configState,
                    startTime: currentTime,
                    endTime,
                    originalConfigIndex: configIndex
                });
            } else if (INSTANCE_LEVEL_CONFIGURATIONS.includes(configName)) {
                sqlServerInstances.forEach(instanceId => {
                    const groupKey = `${credentialsId}:${region}:${hostId}:${instanceId}`;
                    const group = getOrCreateDismissGroup(
                        instanceGroups,
                        groupKey,
                        DismissGroupType.Instance,
                        credentialsId,
                        region,
                        hostId,
                        instanceId
                    );
                    group.configs.push({
                        configName,
                        configState,
                        startTime: currentTime,
                        endTime,
                        originalConfigIndex: configIndex
                    });
                });
            } else {
                // Invalid configuration name - mark as failed at host level with failure reason
                const hostIndex = finalResponse[configIndex].databaseHosts.findIndex(h => h.id === host.id);
                if (hostIndex !== -1) {
                    finalResponse[configIndex].databaseHosts[hostIndex].status = DISMISS_UPDATE_STATUS.FAILED;
                    if (!finalResponse[configIndex].databaseHosts[hostIndex].failedInstances) {
                        finalResponse[configIndex].databaseHosts[hostIndex].failedInstances = [];
                    }
                    finalResponse[configIndex].databaseHosts[hostIndex].failedInstances!.push({
                        databaseHostId: host.id,
                        errorMessage: `Invalid configuration name: '${configName}'.`
                    });
                }
            }
        });
    });

    expandedConfigurations.forEach((_, configIndex) => {
        const allGroups = [...Array.from(hostGroups.values()), ...Array.from(instanceGroups.values())];

        const groupConfig = allGroups.flatMap(group => group.configs).find(c => c.originalConfigIndex === configIndex);

        if (groupConfig) {
            finalResponse[configIndex].startTime = groupConfig.startTime;
            finalResponse[configIndex].endTime = groupConfig.endTime;
        }
    });

    logger.info(`Processing ${hostGroups.size} host groups and ${instanceGroups.size} instance groups`);

    await Promise.all(
        Array.from(hostGroups.values()).map(
            throat(2, async (group: DismissHostGroup) => {
                try {
                    await processHostGroup(accountId, group, finalResponse, databaseType);
                } catch (error) {
                    logger.error('Error processing host group:', error);
                    markGroupAsFailed(group, finalResponse, false);
                }
            })
        )
    );

    await Promise.all(
        Array.from(instanceGroups.values()).map(
            throat(2, async (group: DismissInstanceGroup) => {
                try {
                    await processInstanceGroup(accountId, group, finalResponse, databaseType);
                } catch (error) {
                    logger.error('Error processing instance group:', error);
                    markGroupAsFailed(group, finalResponse, true);
                }
            })
        )
    );
    return { dismissedConfigurations: finalResponse };
}

function markGroupAsSuccessful(
    configs: Array<{ originalConfigIndex: number }>,
    finalResponse: BulkDismissConfigurationResponseItem[],
    hostId: string,
    instanceId?: string
): void {
    configs.forEach(({ originalConfigIndex }) => {
        const hostIndex = finalResponse[originalConfigIndex].databaseHosts.findIndex(h => h.id === hostId);
        if (hostIndex !== -1) {
            const host = finalResponse[originalConfigIndex].databaseHosts[hostIndex];
            if (instanceId) {
                if (!host.sqlServerInstances?.includes(instanceId)) {
                    host.sqlServerInstances = host.sqlServerInstances || [];
                    host.sqlServerInstances.push(instanceId);
                }
            }
            host.status = DISMISS_UPDATE_STATUS.SUCCESS;
        }
    });
}

function buildMergedConfigs(
    currentConfigs: DatabaseInstanceDismissConfigs,
    configs: Array<{
        configName: string;
        configState: string;
        startTime: number;
        endTime: number | undefined;
    }>,
    databaseType: DatabaseTypes = DatabaseTypes.MS_SQL_SERVER
): DatabaseInstanceDismissConfigs {
    let mergedConfigs = currentConfigs;

    for (const config of configs) {
        const { configName, configState, startTime, endTime } = config;
        mergedConfigs = formatDismissConfigurations(
            mergedConfigs,
            {
                configurationName: configName,
                startTime,
                endTime,
                configState
            },
            databaseType
        );
    }

    return mergedConfigs;
}

async function processHostGroup(
    accountId: string,
    group: DismissHostGroup,
    finalResponse: BulkDismissConfigurationResponseItem[],
    databaseType: DatabaseTypes = DatabaseTypes.MS_SQL_SERVER
) {
    const { credentialsId, region, hostId, configs } = group;

    let resourceDetails;
    try {
        [resourceDetails] = await listResources({
            accountId,
            resourceId: hostId,
            credentialIds: credentialsId,
            region,
            includeDatabaseInstances: true,
            selectKeys: [...RESOURCE_DEFAULT_SELECT_FIELDS, 'configurations']
        });
    } catch (error) {
        logger.error('Error fetching resource details:', error);
        throw error;
    }

    if (!resourceDetails) {
        throw new Error('Database host not found');
    }

    const currentConfigs = resourceDetails.configurations as unknown as DatabaseHostConfigurations;
    const mergedDismissConfigs = buildMergedConfigs(
        currentConfigs?.dismissedConfigurations || {},
        configs,
        databaseType
    );

    await updateDatabaseHostConfigurations(accountId, credentialsId, region, hostId, {
        dismissedConfigurations: mergedDismissConfigs
    });

    markGroupAsSuccessful(configs, finalResponse, hostId);

    logger.info(`Successfully updated ${configs.length} host configurations in single DB call`, {
        credentialsId,
        region,
        hostId,
        configCount: configs.length
    });
}

async function processInstanceGroup(
    accountId: string,
    group: DismissInstanceGroup,
    finalResponse: BulkDismissConfigurationResponseItem[],
    databaseType: DatabaseTypes = DatabaseTypes.MS_SQL_SERVER
) {
    const { credentialsId, region, hostId, instanceId, configs } = group;

    let instance;
    try {
        instance = await getInstanceInfo(accountId, credentialsId, hostId, instanceId, region);
    } catch (error) {
        logger.error('Error fetching instance details:', error);
        throw error;
    }

    if (!instance) {
        throw new Error('Database instance not found');
    }

    const currentConfigs = instance.configurations as unknown as DatabaseInstanceConfigurations;
    const mergedDismissConfigs = buildMergedConfigs(
        currentConfigs?.dismissedConfigurations || {},
        configs,
        databaseType
    );

    // Make single DB call for all configurations on this instance
    await updateDatabaseInstanceConfigurations(accountId, credentialsId, region, hostId, instanceId, {
        dismissedConfigurations: mergedDismissConfigs
    });

    // Mark all configs in this group as successful
    markGroupAsSuccessful(configs, finalResponse, hostId, instanceId);

    logger.info(`Successfully updated ${configs.length} instance configurations in single DB call`, {
        credentialsId,
        region,
        hostId,
        instanceId,
        configCount: configs.length
    });
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

function areAllConfigsDismissed(expectedConfigs: string[], categoryConfigs?: InstanceDismissParams[]): boolean {
    if (!Array.isArray(categoryConfigs)) {
        return false;
    }

    return expectedConfigs.every(expectedConfig =>
        categoryConfigs.some(
            config => config.configurationName === expectedConfig && isConfigDismissed(config.configState)
        )
    );
}

function areAllStorageConfigurationsDismissed(
    storageData: StorageDismissConfigs,
    databaseType: DatabaseTypes = DatabaseTypes.MS_SQL_SERVER,
    isOracleWithNFS: boolean = false
): boolean {
    const storageConfigMap =
        databaseType === DatabaseTypes.ORACLE
            ? ORACLE_STORAGE_CONFIGURATION_ASSESSMENT_MAP
            : MSSQL_STORAGE_CONFIGURATION_ASSESSMENT_MAP;

    const storageAssessmentMap =
        databaseType === DatabaseTypes.ORACLE
            ? ORACLE_STORAGE_ASSESSMENT_CONFIGS_MAP
            : MSSQL_STORAGE_ASSESSMENT_CONFIGS_MAP;

    const allConfigurationMapsDismissed = Object.entries(storageConfigMap).every(([category, expectedConfigs]) => {
        if (isOracleWithNFS && category === 'luns') {
            return true;
        }

        const categoryConfigs = storageData.configuration?.[category as keyof typeof storageData.configuration];
        return areAllConfigsDismissed(expectedConfigs, categoryConfigs);
    });

    const allAssessmentConfigsDismissed = Object.entries(storageAssessmentMap).every(([category, expectedConfigs]) => {
        const categoryConfigs = storageData[category as keyof typeof storageData] as
            | InstanceDismissParams[]
            | undefined;

        if (isOracleWithNFS && category === 'layout') {
            const nfsRelevantConfigs = expectedConfigs.filter(
                config => !ORACLE_ISCSI_SPECIFIC_LAYOUT_CONFIGS.includes(config)
            );
            return areAllConfigsDismissed(nfsRelevantConfigs, categoryConfigs);
        }

        if (!isOracleWithNFS && (category === 'volumes' || category === 'os')) {
            const nfsConfigs =
                ORACLE_NFS_STORAGE_CONFIGURATION_ASSESSMENT_MAP[
                    category as keyof typeof ORACLE_NFS_STORAGE_CONFIGURATION_ASSESSMENT_MAP
                ];
            const nonNfsConfigs = expectedConfigs.filter(config => !nfsConfigs.includes(config));
            return areAllConfigsDismissed(nonNfsConfigs, categoryConfigs);
        }

        return areAllConfigsDismissed(expectedConfigs, categoryConfigs);
    });

    return allConfigurationMapsDismissed && allAssessmentConfigsDismissed;
}

function createSubConfigs(
    subConfigNames: string[],
    configState: string,
    hostsToDismiss: BulkDismissConfigurationType['databaseHosts']
): BulkDismissConfigurationType[] {
    return subConfigNames.map(subConfigName => ({
        configurationName: subConfigName,
        configState,
        databaseHosts: hostsToDismiss
    }));
}

function expandConfigurations(
    configurations: BulkDismissConfigurationType[],
    databaseType: DatabaseTypes = DatabaseTypes.MS_SQL_SERVER
): BulkDismissConfigurationType[] {
    return configurations.flatMap(config => {
        const { configurationName: configName, configState, databaseHosts: hostsToDismiss } = config;

        switch (configName) {
            case 'high-availability': {
                if (databaseType === DatabaseTypes.MS_SQL_SERVER) {
                    const haSubcategories = Object.values(ASSESSMENT_CONFIGS.highAvailability);
                    return createSubConfigs(haSubcategories, configState, hostsToDismiss);
                }
                return [config];
            }
            case 'ontap-volumes': {
                if (databaseType === DatabaseTypes.ORACLE) {
                    const allOracleVolumeConfigs = [
                        ...ORACLE_STORAGE_CONFIGURATION_ASSESSMENT_MAP.volumes,
                        ...ORACLE_STORAGE_CONFIGURATION_ASSESSMENT_MAP.luns
                    ];
                    return createSubConfigs(allOracleVolumeConfigs, configState, hostsToDismiss);
                }
                const allOntapConfigs = [
                    ...MSSQL_STORAGE_CONFIGURATION_ASSESSMENT_MAP.volumes,
                    ...MSSQL_STORAGE_CONFIGURATION_ASSESSMENT_MAP.luns
                ];
                return createSubConfigs(allOntapConfigs, configState, hostsToDismiss);
            }
            case 'operating-system': {
                if (databaseType === DatabaseTypes.ORACLE) {
                    return createSubConfigs(
                        ORACLE_STORAGE_CONFIGURATION_ASSESSMENT_MAP.os,
                        configState,
                        hostsToDismiss
                    );
                }
                return createSubConfigs(MSSQL_STORAGE_CONFIGURATION_ASSESSMENT_MAP.os, configState, hostsToDismiss);
            }
            default:
                return [config];
        }
    });
}

function updateFieldsBasedOnDismissedConfigurations(
    fieldsValues: string[],
    dismissedConfigurations: DatabaseInstanceDismissConfigs,
    databaseType: DatabaseTypes = DatabaseTypes.MS_SQL_SERVER,
    storageProtocol?: string
) {
    logger.info('Updating fields based on dismissed configurations', {
        fieldsValues,
        dismissedConfigurations,
        storageProtocol
    });

    const isOracleWithNFS = databaseType === DatabaseTypes.ORACLE && storageProtocol === STORAGE_PROTOCOLS.NFS;

    return fieldsValues.filter(fieldValue => {
        if (
            fieldValue === 'high-availability' &&
            dismissedConfigurations.highAvailability &&
            databaseType === DatabaseTypes.MS_SQL_SERVER
        ) {
            const haConfigs = dismissedConfigurations.highAvailability;
            const allSupportedHAKeys = Object.values(ASSESSMENT_CONFIGS.highAvailability);
            const allHAConfigsDismissed = allSupportedHAKeys.every(configName => {
                const config = haConfigs.find(c => c.configurationName === configName);
                return config && isConfigDismissed(config.configState);
            });
            return !allHAConfigsDismissed;
        }

        if (fieldValue === 'storage' && dismissedConfigurations.storage) {
            return !areAllStorageConfigurationsDismissed(
                dismissedConfigurations.storage,
                databaseType,
                isOracleWithNFS
            );
        }

        // Skip Oracle iSCSI-specific layout configs for NFS protocol
        if (isOracleWithNFS && ORACLE_ISCSI_SPECIFIC_LAYOUT_CONFIGS.includes(fieldValue)) {
            return false;
        }

        if (
            (!isOracleWithNFS && ORACLE_NFS_STORAGE_CONFIGURATION_ASSESSMENT_MAP.volumes.includes(fieldValue)) ||
            ORACLE_NFS_STORAGE_CONFIGURATION_ASSESSMENT_MAP.os.includes(fieldValue)
        ) {
            return false;
        }

        if (!isOracleWithNFS && ORACLE_ISCSI_STORAGE_CONFIGURATION_ASSESSMENT_MAP.os.includes(fieldValue)) {
            return true;
        }

        return !Object.entries(dismissedConfigurations).some(
            ([keyName, config]) =>
                (keyName === fieldValue ||
                    (config as { configurationName?: string }).configurationName === fieldValue) &&
                isConfigDismissed(config.configState) &&
                config.configurationType !== 'storage'
        );
    });
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
            reactivationReason: DISMISS_DEACTIVATION_REASON.EXPIRED,
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
        } else if (key === 'highAvailability') {
            if (Array.isArray(config)) {
                const updatedHAConfigs = config.map(haConfig => {
                    const { updatedStorageConfig, isConfigExpired } = processConfigForExpiration(haConfig);
                    if (isConfigExpired) {
                        isConfigUpdated = true;
                        return updatedStorageConfig;
                    }
                    return haConfig;
                });
                if (isConfigUpdated) {
                    if (!updatedConfigs.highAvailability) {
                        updatedConfigs.highAvailability = [];
                    }
                    updatedConfigs.highAvailability = updatedHAConfigs;
                }
            }
        } else {
            const { updatedStorageConfig, isConfigExpired } = processConfigForExpiration(config);
            if (isConfigExpired) {
                (updatedConfigs as Record<string, InstanceDismissParams | InstanceDismissParams[]>)[key] =
                    updatedStorageConfig;
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
                  { dismissedConfigurations: updatedInstanceConfigs }
              )
            : Promise.resolve(),
        updateDatabaseHostConfigurations(accountId, credentialsId, region, databaseHostId, {
            dismissedConfigurations: updatedHostConfigs
        })
    ]);

    return { dismissedInstanceConfigurations: updatedInstanceConfigs, dismissedHostConfigurations: updatedHostConfigs };
}

function mergeDismissConfigurations(
    instanceDismissedConfigs?: DatabaseInstanceDismissConfigs,
    hostDismissedConfigs?: DatabaseInstanceDismissConfigs
): DatabaseInstanceDismissConfigs {
    const mergedHA = [
        ...(instanceDismissedConfigs?.highAvailability || []),
        ...(hostDismissedConfigs?.highAvailability || [])
    ];

    return {
        ...instanceDismissedConfigs,
        ...hostDismissedConfigs,
        ...(mergedHA.length > 0 ? { highAvailability: mergedHA } : {})
    };
}

async function processDismissedConfigurations(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    instanceDismissedConfigs: DatabaseInstanceDismissConfigs | undefined,
    hostDismissedConfigs: DatabaseInstanceDismissConfigs | undefined,
    databaseInstanceId?: string
): Promise<DatabaseInstanceDismissConfigs> {
    logger.debug('Processing dismissed configuration');
    const updatedDismissedConfigurations = await checkAndUpdatePostponedEndTime(
        accountId,
        credentialsId,
        region,
        databaseHostId,
        {
            instance: instanceDismissedConfigs,
            host: hostDismissedConfigs
        },
        databaseInstanceId
    );

    // Merge and return final dismissed configurations
    return mergeDismissConfigurations(
        updatedDismissedConfigurations.dismissedInstanceConfigurations,
        updatedDismissedConfigurations.dismissedHostConfigurations
    );
}

export {
    formatDismissConfigurations,
    updateDismissConfigurations,
    updateFieldsBasedOnDismissedConfigurations,
    checkAndUpdatePostponedEndTime,
    mergeDismissConfigurations,
    processDismissedConfigurations,
    updateConfig,
    getOrCreateGroup,
    DismissGroupType,
    DismissConfigType,
    areAllStorageConfigurationsDismissed
};
