import { JOBSTATUS } from '@prisma/client';
import createError from 'http-errors';
import throat from 'throat';
import moment from 'moment';
import { getJobs, registerJob } from '../database/job-operations';
import { getTimeDifferenceInMinutes } from '../../utils/utils';
import { updateLongRunningAuditGroup } from '../cloud-manager/audit-operations';
import {
    ASSESSMENT_CONFIGS,
    AssessmentStatus,
    DISMISS_DEACTIVATION_REASON,
    DISMISS_STATUS,
    DISMISS_UPDATE_STATUS
} from '../../utils/continous-optimization-consts';
import getLogger from '../../utils/logger';
import { getInstanceInfo } from '../database/database-operations';
import { BulkDismissConfigurationType } from '../../routes/types/continuous-optimization.types';
import {
    DatabaseInstanceDismissConfigs,
    DatabaseInstanceConfigurations,
    InstanceDismissParams,
    Metadata
} from '../../utils/common-types';
import { listResources, updateDatabaseInstanceConfigurations } from '../../lib/database/db';
import { listDatabaseInstanceConfigData } from '../../lib/database/database-instance-config';

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
    const { name, startTime, configState } = newConfigs;
    const matchingKey = Object.keys(ASSESSMENT_CONFIGS).find(
        key => ASSESSMENT_CONFIGS[key as keyof typeof ASSESSMENT_CONFIGS] === name
    );

    if (matchingKey) {
        const existingConfig = currentConfigs[matchingKey as keyof typeof currentConfigs] || {};
        currentConfigs[matchingKey as keyof typeof currentConfigs] = {
            ...existingConfig,
            name,
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
        };
    }

    return currentConfigs;
}

async function updateDismissConfigurations(accountId: string, configurations: BulkDismissConfigurationType[]) {
    logger.info('Updating dismiss configurations for account:', { accountId, configurations });
    const finalResponse = [];
    for (const config of configurations) {
        const { name: configName, configState, databaseHosts: hostsToDismiss } = config;
        const startTime = Date.now();
        const response = {
            name: configName,
            startTime,
            configState,
            databaseHosts: hostsToDismiss
        };

        await Promise.all(
            hostsToDismiss.map(
                throat(3, async host => {
                    const { id: databaseHostId, sqlServerInstances, credentialsId } = host;
                    const hostIndex = response.databaseHosts.findIndex(hostId => hostId.id === databaseHostId);

                    for (const sqlServerInstanceId of sqlServerInstances) {
                        await processInstance(
                            credentialsId,
                            databaseHostId,
                            sqlServerInstanceId,
                            configName,
                            startTime,
                            configState,
                            response,
                            hostIndex
                        );
                    }

                    updateHostStatus(response, hostIndex, sqlServerInstances.length);
                })
            )
        );

        finalResponse.push(response);
    }

    async function processInstance(
        credentialsId: string,
        databaseHostId: string,
        sqlServerInstanceId: string,
        configName: string,
        startTime: number,
        configState: string,
        response: any,
        hostIndex: number
    ) {
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
                name: configName,
                startTime,
                configState
            });

            try {
                await updateDatabaseInstanceConfigurations(
                    accountId,
                    credentialsId,
                    databaseHostId,
                    sqlServerInstanceId,
                    { dismissedConfigurations: updatedConfigs }
                );
            } catch (error) {
                logger.error('Error updating dismiss configurations:', error);
                addFailedInstance(response, hostIndex, sqlServerInstanceId, `Failed to update config details ${error}`);
            }
        }
    }

    function addFailedInstance(response: any, hostIndex: number, instanceId: string, errorMessage: string) {
        if (!response.databaseHosts[hostIndex]?.failedInstances) {
            response.databaseHosts[hostIndex].failedInstances = [{ instanceId, errorMessage }];
        } else {
            response.databaseHosts[hostIndex].failedInstances.push({ instanceId, errorMessage });
        }
    }

    function updateHostStatus(response: any, hostIndex: number, totalInstances: number) {
        const failedInstancesCount = response.databaseHosts[hostIndex]?.failedInstances?.length || 0;
        const updatedInstancesCount = totalInstances - failedInstancesCount;

        response.databaseHosts[hostIndex].status =
            updatedInstancesCount === 0
                ? DISMISS_UPDATE_STATUS.FAILED
                : updatedInstancesCount === totalInstances
                ? DISMISS_UPDATE_STATUS.SUCCESS
                : DISMISS_UPDATE_STATUS.PARTIAL;
    }
    return { dismisssedConfigurations: finalResponse };
}

export {
    getMatchingAssessmentStatus,
    handleOptimizeJobCreation,
    JobMetadata,
    updateDismissConfigurations,
    formatInstanceDismissConfigurations,
    getLastAssessedTime
};
