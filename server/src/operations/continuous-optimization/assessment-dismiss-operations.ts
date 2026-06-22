import ms from 'ms';
import throat from 'throat';
import { compact } from 'lodash-es';

import {
    DISMISS_DEACTIVATION_REASON,
    DISMISS_STATUS,
    DISMISS_UPDATE_STATUS
} from '../../utils/continous-optimization-consts';
import { GOLDEN_CONFIG_LOOKUP } from './assessment-utils';
import getLogger from '../../utils/logger';
import {
    getInstanceInfo,
    updateDatabaseHostConfigurations,
    updateDatabaseInstanceConfigurations
} from '../database/database-operations';
import {
    BulkDismissConfigurationType,
    BulkDismissConfigurationResponseItem,
    DismissConfig,
    DismissGroup
} from '../../utils/common-types';
import { listResources } from '../../lib/database/db';
import { DatabaseTypes, POSTPONE_AGE } from '../../utils/consts';

const logger = getLogger();

function buildDismissEntry(id: string, configState: string, startTime: number, endTime?: number): DismissConfig {
    if (configState === DISMISS_STATUS.POSTPONED) {
        return { id, configState, startTime, endTime };
    }
    if (configState === DISMISS_STATUS.DISMISSED) {
        return { id, configState, startTime };
    }
    return {
        id,
        configState: DISMISS_STATUS.ACTIVATING,
        startTime,
        reactivationReason: DISMISS_DEACTIVATION_REASON.USER
    };
}

function upsertDismissConfig(existing: DismissConfig[], incoming: DismissConfig[]): DismissConfig[] {
    const result = [...existing];
    for (const entry of incoming) {
        const idx = result.findIndex(c => c.id === entry.id);
        if (idx !== -1) {
            result[idx] = entry;
        } else {
            result.push(entry);
        }
    }
    return result;
}

async function persistDismissConfigs(accountId: string, group: DismissGroup): Promise<void> {
    const { credentialsId, region, hostId, instanceId, configs } = group;

    const incoming = configs.map(({ id, configState, startTime, endTime }) =>
        buildDismissEntry(id, configState, startTime, endTime)
    );

    if (instanceId) {
        const instance = await getInstanceInfo(accountId, credentialsId, hostId, instanceId, region);
        if (!instance) {
            throw new Error(`Database instance not found: ${instanceId}`);
        }
        const existing = Array.isArray(instance.configurations) ? (instance.configurations as DismissConfig[]) : [];
        await updateDatabaseInstanceConfigurations(
            accountId,
            credentialsId,
            region,
            hostId,
            instanceId,
            upsertDismissConfig(existing, incoming)
        );
        logger.info('Updated instance dismiss configurations', { hostId, instanceId, configCount: configs.length });
    } else {
        const [resource] = await listResources({
            accountId,
            resourceId: hostId,
            credentialIds: credentialsId,
            region,
            selectKeys: ['configurations']
        });
        if (!resource) {
            throw new Error(`Database host not found: ${hostId}`);
        }
        const existing = Array.isArray(resource.configurations) ? (resource.configurations as DismissConfig[]) : [];
        await updateDatabaseHostConfigurations(
            accountId,
            credentialsId,
            region,
            hostId,
            upsertDismissConfig(existing, incoming)
        );
        logger.info('Updated host dismiss configurations', { hostId, configCount: configs.length });
    }
}

async function updateDismissConfigurations(
    accountId: string,
    configurations: BulkDismissConfigurationType[],
    databaseType: DatabaseTypes
): Promise<{ dismissedConfigurations: BulkDismissConfigurationResponseItem[] }> {
    logger.info('Updating dismiss configurations', { accountId, databaseType, count: configurations.length });

    const lookup = GOLDEN_CONFIG_LOOKUP[databaseType as keyof typeof GOLDEN_CONFIG_LOOKUP];
    const hostLevelIds = new Set([...lookup.values()].filter(e => e.configLevel === 'host').map(e => e.id));
    const instanceLevelIds = new Set([...lookup.values()].filter(e => e.configLevel === 'database').map(e => e.id));
    const currentTime = Date.now();
    const postponeEndTime = currentTime + ms(`${POSTPONE_AGE}d`);

    // Step 1 — initial response skeleton; statuses updated inline below
    const response: BulkDismissConfigurationResponseItem[] = configurations.map(
        ({ configurationName, configState, databaseHosts }) => ({
            configurationName,
            configState,
            startTime: currentTime,
            endTime: configState === DISMISS_STATUS.POSTPONED ? postponeEndTime : undefined,
            databaseHosts: databaseHosts.map(h => ({ ...h, status: undefined }))
        })
    );

    // Step 2 — group by unique "cred:region:host[:instance]" key
    const updateGroups = new Map<string, DismissGroup>();

    configurations.forEach(({ configurationName, configState, databaseHosts }, configIndex) => {
        if (!hostLevelIds.has(configurationName) && !instanceLevelIds.has(configurationName)) {
            response[configIndex].databaseHosts.forEach(host => {
                host.failedInstances = [
                    { databaseHostId: host.id, errorMessage: `Invalid configuration name: '${configurationName}'.` }
                ];
                host.status = DISMISS_UPDATE_STATUS.FAILED;
            });
            return;
        }

        const endTime = configState === DISMISS_STATUS.POSTPONED ? postponeEndTime : undefined;
        const configItem: DismissConfig & { configIndex: number } = {
            id: configurationName,
            configState,
            startTime: currentTime,
            endTime,
            configIndex
        };

        databaseHosts.forEach(({ id: hostId, credentialsId, region, sqlServerInstances = [] }) => {
            if (hostLevelIds.has(configurationName)) {
                const key = `${credentialsId}:${region}:${hostId}`;
                if (!updateGroups.has(key)) {
                    updateGroups.set(key, { credentialsId, region, hostId, configs: [] });
                }
                updateGroups.get(key)!.configs.push(configItem);
            } else {
                sqlServerInstances.forEach(instanceId => {
                    const key = `${credentialsId}:${region}:${hostId}:${instanceId}`;
                    if (!updateGroups.has(key)) {
                        updateGroups.set(key, { credentialsId, region, hostId, instanceId, configs: [] });
                    }
                    updateGroups.get(key)!.configs.push(configItem);
                });
            }
        });
    });

    // Step 3 — run DB writes concurrently; update statuses inline on success or error
    await Promise.all(
        [...updateGroups.values()].map(
            throat(2, async (group: DismissGroup) => {
                let errorMessage: string | undefined;
                try {
                    await persistDismissConfigs(accountId, group);
                } catch (error) {
                    logger.error('Error persisting dismiss configs', error);
                    errorMessage = error instanceof Error ? error.message : 'Database update failed';
                }

                group.configs.forEach(({ configIndex }) => {
                    const host = response[configIndex].databaseHosts.find(h => h.id === group.hostId);
                    if (!host) {
                        return;
                    }

                    if (errorMessage) {
                        if (!host.failedInstances) {
                            host.failedInstances = [];
                        }
                        host.failedInstances.push(
                            group.instanceId
                                ? { databaseHostId: group.hostId, instanceId: group.instanceId, errorMessage }
                                : { databaseHostId: group.hostId, errorMessage }
                        );
                    } else if (group.instanceId && !host.sqlServerInstances?.includes(group.instanceId)) {
                        host.sqlServerInstances = [...(host.sqlServerInstances ?? []), group.instanceId];
                    }

                    const failedCount = host.failedInstances?.length ?? 0;
                    const totalCount = host.sqlServerInstances?.length ?? 1;
                    host.status =
                        failedCount === 0
                            ? DISMISS_UPDATE_STATUS.SUCCESS
                            : failedCount >= totalCount
                            ? DISMISS_UPDATE_STATUS.FAILED
                            : DISMISS_UPDATE_STATUS.PARTIAL;
                });
            })
        )
    );

    return { dismissedConfigurations: response };
}

function resolveConfigs(configs: DismissConfig[]) {
    const now = Date.now();
    const dismissedIds: string[] = [];
    const dismissedConfigs: DismissConfig[] = [];
    let changed = false;

    const resolved = configs.map(config => {
        const isExpired =
            config.configState === DISMISS_STATUS.ACTIVATING ||
            (config.configState === DISMISS_STATUS.POSTPONED && !!config.endTime && now > config.endTime);
        const updated = isExpired
            ? {
                  ...config,
                  configState: DISMISS_STATUS.ACTIVE,
                  reactivationReason: DISMISS_DEACTIVATION_REASON.EXPIRED,
                  endTime: undefined
              }
            : config;
        if (isExpired) {
            changed = true;
            logger.debug(`Dismiss config '${config.id}' expired; transitioning to ACTIVE`);
        } else if (updated.configState !== DISMISS_STATUS.ACTIVE) {
            dismissedIds.push(updated.id);
            dismissedConfigs.push(updated);
        }
        return updated;
    });
    return { resolved, dismissedIds, dismissedConfigs, changed };
}

// This function filters out expired dismiss configs and updates the database async
function filterExpiredDismissConfigs(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    instanceConfigs: DismissConfig[] | undefined,
    hostConfigs: DismissConfig[] | undefined,
    databaseInstanceId?: string
): { dismissedIds: Set<string>; dismissedConfigs: DismissConfig[] } {
    const {
        resolved: instanceResolved,
        dismissedIds: instanceDismissedIds,
        dismissedConfigs: instanceDismissedConfigs,
        changed: instanceChanged
    } = resolveConfigs(instanceConfigs ?? []);
    const {
        resolved: hostResolved,
        dismissedIds: hostDismissedIds,
        dismissedConfigs: hostDismissedConfigs,
        changed: hostChanged
    } = resolveConfigs(hostConfigs ?? []);

    Promise.all(
        compact([
            databaseInstanceId && instanceChanged
                ? updateDatabaseInstanceConfigurations(
                      accountId,
                      credentialsId,
                      region,
                      databaseHostId,
                      databaseInstanceId,
                      instanceResolved
                  )
                : null,
            hostChanged
                ? updateDatabaseHostConfigurations(accountId, credentialsId, region, databaseHostId, hostResolved)
                : null
        ])
    ).catch(error => {
        logger.error('Failed to update dismiss configurations', { accountId, databaseHostId, error });
    });

    return {
        dismissedIds: new Set([...instanceDismissedIds, ...hostDismissedIds]),
        dismissedConfigs: [...instanceDismissedConfigs, ...hostDismissedConfigs]
    };
}

export { updateDismissConfigurations, filterExpiredDismissConfigs };
