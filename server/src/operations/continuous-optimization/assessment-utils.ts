import { JOBSTATUS } from '@prisma/client';
import createError from 'http-errors';
import moment from 'moment';
import { getJobs, registerJob } from '../database/job-operations';
import { getTimeDifferenceInMinutes } from '../../utils/utils';
import { updateLongRunningAuditGroup } from '../cloud-manager/audit-operations';
import {
    ASSESSMENT_CONFIGS,
    AssessmentStatus,
    DISMISS_DEACTIVATION_REASON,
    DISMISS_STATUS,
    DISMISS_UPDATE_STATUS,
    HOST_LEVEL_CONFIGURATIONS
} from '../../utils/continous-optimization-consts';
import getLogger from '../../utils/logger';
import { getInstanceInfo } from '../database/database-operations';
import { BulkDismissConfigurationType } from '../../routes/types/continuous-optimization.types';
import {
    DatabaseInstanceDismissConfigs,
    DatabaseInstanceConfigurations,
    InstanceDismissParams,
    Metadata,
    DatabaseHostConfigurations
} from '../../utils/common-types';
import {
    listResources,
    updateDatabaseHostConfigurations,
    updateDatabaseInstanceConfigurations
} from '../../lib/database/db';
import { listDatabaseInstanceConfigData } from '../../lib/database/database-instance-config';
import { HttpErrorCodes } from '../../utils/consts';

const logger = getLogger();

interface configurationRecord {
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
        resourceName: serverNameWithHostName as string,
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
            throw createError(
                412,
                `The following optimization is running: Job ID:  ${job.id}. Wait until it completes.`
            );
        }
    }

    // create the parent job for optimize operation
    const { id } = await registerJob(accountId, credentialsId, region, {
        type: jobType,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: serverNameWithHostName as string,
        name: jobName,
        startTime: Date.now(),
        description: jobDescription,
        ...(parentJobId && { parentJobId }),
        ...(jobMetadata && { metadata: jobMetadata })
    });
    logger.debug(`Job created with id ${id}`);

    return id;
}

async function getLastAssessedTime(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string
) {
    const [[{ creation_time: latestInstanceLevelAssessedTime } = {}], [{ metadata = {} } = {}]] = await Promise.all([
        listDatabaseInstanceConfigData(accountId, region, credentialsId, databaseHostId, databaseInstanceId),
        listResources(accountId, databaseHostId, credentialsId, region)
    ]);

    const { assessment: { lastAssessedDate: latestHostLevelAssessedTime } = {} } = metadata as unknown as Metadata;
    const latestAssessmentTimestamp = Math.max(
        latestInstanceLevelAssessedTime ? latestInstanceLevelAssessedTime.getTime() : 0,
        latestHostLevelAssessedTime ? Number(latestHostLevelAssessedTime) : 0
    );

    return moment(Number(latestAssessmentTimestamp)).unix() * 1000;
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
        const existingConfig = currentConfigs[matchingKey as keyof typeof currentConfigs] || {};

        const updatedConfigs = {
            ...currentConfigs,
            [matchingKey]: {
                ...existingConfig,
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
                            return {
                                deactivationReason: DISMISS_DEACTIVATION_REASON.USER,
                                endTime: undefined
                            };
                        default:
                            return {};
                    }
                })()
            }
        };
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
            const thirtyDaysInMs = moment.duration(4, 'hours').asMilliseconds(); // Updated to 4 hours for testing
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

    async function handleHostLevelConfigurations(record: configurationRecord) {
        logger.debug('Handling host level configurations', { record });
        const {
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

    async function handleInstanceLevelConfigurations(record: configurationRecord) {
        logger.debug('Handling instance level configurations', { record });
        const {
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
        for (const sqlServerInstanceId of sqlServerInstances) {
            let instance;
            try {
                instance = await getInstanceInfo(accountId, credentialsId, databaseHostId, sqlServerInstanceId);
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
        }

        updateHostStatus(response, hostIndex, sqlServerInstances);
    }

    function addFailedInstance(response: any, hostIndex: number, instanceId: string, errorMessage: string) {
        logger.debug('Adding failed instance', { hostIndex, instanceId, errorMessage });
        if (!response.databaseHosts[hostIndex]?.failedInstances) {
            response.databaseHosts[hostIndex].failedInstances = [
                { databaseHostId: response.databaseHosts[hostIndex].id, instanceId, errorMessage }
            ];
        } else {
            response.databaseHosts[hostIndex].failedInstances.push({
                databaseHostId: response.databaseHosts[hostIndex].databaseHostId,
                instanceId,
                errorMessage
            });
        }
    }

    function updateHostStatus(response: any, hostIndex: number, sqlServerInstances: string[]) {
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
                    keyName === fieldValue &&
                    ((config as { configState: string }).configState === DISMISS_STATUS.POSTPONED ||
                        (config as { configState: string }).configState === DISMISS_STATUS.DISMISSED)
            )
    );

    return updatedFieldsValues;
}

async function checkAndUpdatePostponedEndTime(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    dismissedConfigs: DatabaseInstanceDismissConfigs,
    databaseInstanceId?: string
) {
    logger.info('Check and update postponed config for end time', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        dismissedConfigs,
        databaseInstanceId
    });
    const updatedConfigs = { ...dismissedConfigs };
    let isConfigUpdated = false;

    for (const [key, config] of Object.entries(dismissedConfigs)) {
        if (config.configState === DISMISS_STATUS.POSTPONED) {
            logger.debug(`Checking postponed configuration ${key}`, { config });
            const currentTime = Date.now();
            const { endTime } = config;
            if (currentTime > endTime) {
                logger.info(`Configuration ${key} has expired and will be activated`, { config });
                updatedConfigs[key as keyof typeof dismissedConfigs] = {
                    ...config,
                    configState: DISMISS_STATUS.ACTIVE,
                    deactivationReason: DISMISS_DEACTIVATION_REASON.EXPIRED,
                    endTime: undefined
                };
                isConfigUpdated = true;
            }
        }
    }
    if (isConfigUpdated) {
        if (databaseInstanceId) {
            await updateDatabaseInstanceConfigurations(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceId,
                { dismissedConfigurations: updatedConfigs }
            );
        } else {
            await updateDatabaseHostConfigurations(accountId, credentialsId, region, databaseHostId, {
                dismissedConfigurations: updatedConfigs
            });
        }
    }
}

export {
    getMatchingAssessmentStatus,
    handleOptimizeJobCreation,
    JobMetadata,
    updateDismissConfigurations,
    formatInstanceDismissConfigurations,
    getLastAssessedTime,
    updateFieldsBasedOnDismissedConfigurations,
    checkAndUpdatePostponedEndTime
};
