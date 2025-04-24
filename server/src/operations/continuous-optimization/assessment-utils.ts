import { JOBSTATUS } from '@prisma/client';
import createError from 'http-errors';
// import throat from 'throat';
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
    const { configurationName, startTime, configState } = newConfigs;
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
                ...(configState === DISMISS_STATUS.POSTPONED && {
                    endTime: new Date(startTime).getTime() + 30 * 24 * 60 * 60 * 1000,
                    deactivationReason: undefined
                }),
                ...(configState === DISMISS_STATUS.DISMISSED && { endTime: undefined, deactivationReason: undefined }),
                ...(configState === DISMISS_STATUS.ACTIVE && {
                    deactivationReason: DISMISS_DEACTIVATION_REASON.USER,
                    endTime: undefined
                })
            }
        };
        return updatedConfigs;
    }
    logger.error('No matching key found for the configuration name:', configurationName);
    throw createError(
        HttpErrorCodes.NOT_FOUND,
        `No matching key found for the configuration name:, ${configurationName}`
    );
}

async function updateDismissConfigurations(accountId: string, configurations: BulkDismissConfigurationType[]) {
    logger.info('Updating dismiss configurations for account:', { accountId, configurations });
    const finalResponse = [];
    for (const config of configurations) {
        const { configurationName: configName, configState, databaseHosts: hostsToDismiss } = config;
        const startTime = Date.now();
        const response = {
            configurationName: configName,
            startTime,
            configState,
            databaseHosts: hostsToDismiss
        };

        await Promise.all(
            hostsToDismiss.map(async host => {
                const { id: databaseHostId, sqlServerInstances, credentialsId, region } = host;
                const hostIndex = response.databaseHosts.findIndex(hostId => hostId.id === databaseHostId);

                if (HOST_LEVEL_CONFIGURATIONS.includes(configName)) {
                    await handleHostLevelConfigurations(
                        configName,
                        startTime,
                        configState,
                        databaseHostId,
                        credentialsId,
                        region,
                        response,
                        hostIndex
                    );
                } else {
                    await handleInstanceLevelConfigurations(
                        configName,
                        startTime,
                        configState,
                        databaseHostId,
                        sqlServerInstances,
                        credentialsId,
                        region,
                        response,
                        hostIndex
                    );
                }
            })
        );

        finalResponse.push(response);
    }

    return { dismisssedConfigurations: finalResponse };

    async function handleHostLevelConfigurations(
        configName: string,
        startTime: number,
        configState: string,
        databaseHostId: string,
        credentialsId: string,
        region: string,
        response: BulkDismissConfigurationType,
        hostIndex: number
    ) {
        logger.debug('Handling host level configurations', { configName, startTime, configState, databaseHostId });
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

    async function handleInstanceLevelConfigurations(
        configName: string,
        startTime: number,
        configState: string,
        databaseHostId: string,
        sqlServerInstances: string[],
        credentialsId: string,
        region: string,
        response: BulkDismissConfigurationType,
        hostIndex: number
    ) {
        logger.debug('Handling instance level configurations', { configName, startTime, configState, databaseHostId });
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
                    configState
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
        const updatedStatus =
            updatedInstancesCount === 0
                ? DISMISS_UPDATE_STATUS.FAILED
                : updatedInstancesCount === sqlServerInstances.length
                ? DISMISS_UPDATE_STATUS.SUCCESS
                : DISMISS_UPDATE_STATUS.PARTIAL;

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

export {
    getMatchingAssessmentStatus,
    handleOptimizeJobCreation,
    JobMetadata,
    updateDismissConfigurations,
    formatInstanceDismissConfigurations,
    getLastAssessedTime,
    updateFieldsBasedOnDismissedConfigurations
};
