import { isEmpty } from 'lodash-es';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import throat from 'throat';
import getLogger from '../utils/logger';
import { DatabaseInstance, DatabaseInstancesIncludingResource } from '../utils/common-types';
import { DatabaseTypes } from '../utils/consts';
import { registerJob, updateJobDetails, updateParentJobStatus } from './database/job-operations';
import { AssessmentCategories } from '../utils/continous-optimization-consts';
import { listAllManagedInstances, updateDatabaseInstanceAssessmentResults } from './database/database-operations';
import {
    fetchMssqlDriftAssessment,
    triggerMssqlAssessment
} from './continuous-optimization/mssql/assessment-operations';

const logger = getLogger();

async function updateAssesmentResultsInInstanceMetadata(managedInstance: DatabaseInstancesIncludingResource) {
    const {
        account_id: accountId,
        region,
        credentials_id: credentialsId,
        resource_id: databaseHostId,
        database_instance_id: databaseInstanceId
    } = managedInstance;
    logger.info('Update assessment results in instance metadata', {
        accountId,
        credentialsId,
        databaseHostId,
        databaseInstanceId
    });
    const driftAssessmentData = await fetchMssqlDriftAssessment(
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        undefined,
        managedInstance as unknown as DatabaseInstance
    );

    try {
        await updateDatabaseInstanceAssessmentResults(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            driftAssessmentData
        );
    } catch (error) {
        logger.error('Error while updating assessment results in instance table', {
            accountId,
            databaseHostId,
            databaseInstanceId,
            error
        });
    }
}

async function cronAssessmentCollection(initiatedBy: string) {
    logger.info('Cron assessment collection', { initiatedBy });

    const allManagedInstances = (await listAllManagedInstances(undefined, {
        databaseType: DatabaseTypes.MS_SQL_SERVER
    })) as DatabaseInstancesIncludingResource[];

    if (isEmpty(allManagedInstances)) {
        logger.info('No successfully managed database instances found.');
        return;
    }

    // Group managed instances by account_id and remove empty groups
    const managedInstancesGroupedByAccountId = allManagedInstances.reduce((acc, managedInstance) => {
        if (managedInstance) {
            const key = managedInstance.account_id;
            (acc[key] ||= []).push(managedInstance);
        }
        return acc;
    }, {} as { [key: string]: DatabaseInstancesIncludingResource[] });

    await Promise.all(
        Object.entries(managedInstancesGroupedByAccountId).map(
            throat(3, async ([accountId, managedInstances]) => {
                let parentJobId = '';
                try {
                    const jobDescription = `Assess online SQL Server instances in account ${accountId} for best practice misalignments.`;
                    ({ id: parentJobId } = await registerJob(accountId, '', '', {
                        name: jobDescription,
                        description: jobDescription,
                        resourceName: accountId,
                        initiator: initiatedBy.toLocaleUpperCase(),
                        startTime: Date.now(),
                        status: JOBSTATUS.IN_PROGRESS,
                        type: JOBTYPE.ASSESSMENT
                    }));

                    if (!parentJobId) {
                        logger.error(`Failed to register parent job for account ${accountId}.`);
                        return;
                    }

                    const instanceAssessmentWithErrors = await Promise.allSettled(
                        managedInstances.map(
                            throat(3, async instance =>
                                triggerMssqlAssessment(instance, parentJobId, [
                                    AssessmentCategories.STORAGE,
                                    AssessmentCategories.AWS_BACKUP,
                                    AssessmentCategories.CRR,
                                    AssessmentCategories.CLONE,
                                    AssessmentCategories.MAXDOP
                                ])
                            )
                        )
                    );

                    const allFailed = instanceAssessmentWithErrors.every(result => result.status === 'rejected');
                    if (allFailed) {
                        const errorMessage = `No online and running instances found in account ${accountId}.`;
                        logger.error(errorMessage);
                        await updateJobDetails(accountId, parentJobId, {
                            status: JOBSTATUS.WARNING,
                            error: errorMessage,
                            endTime: Date.now()
                        });
                        return;
                    }

                    // Get unique resources from managed instances by account_id, credentials_id, and resource_id
                    const uniqueResources = Array.from(
                        new Map(
                            managedInstances.map(({ resource, ...details }) => [
                                `${resource.account_id}-${resource.credentials_id}-${resource.id}`,
                                { resource, details }
                            ])
                        ).values()
                    );

                    // Trigger host level drift assessment for unique resources
                    await Promise.all(
                        uniqueResources.map(
                            throat(3, ({ resource, details }) =>
                                triggerMssqlAssessment(
                                    { ...details, resource } as DatabaseInstancesIncludingResource,
                                    parentJobId,
                                    [
                                        AssessmentCategories.LICENSE,
                                        AssessmentCategories.COMPUTE,
                                        AssessmentCategories.HOST_OS_PATCH,
                                        AssessmentCategories.RSS_CONFIG,
                                        AssessmentCategories.MSSQL_PATCH
                                    ]
                                )
                            )
                        )
                    );
                } catch (error: any) {
                    logger.error(`Error during drift assessment for account ${accountId}:`, error);
                } finally {
                    if (parentJobId) {
                        await updateParentJobStatus(accountId, parentJobId, false);
                        await Promise.all(
                            managedInstances.map(
                                throat(3, instance => updateAssesmentResultsInInstanceMetadata(instance))
                            )
                        );
                    }
                }
            })
        )
    );
}

export { cronAssessmentCollection };
