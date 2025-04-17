import { JOBSTATUS } from '@prisma/client';
import createError from 'http-errors';
import { CloneDetailType } from '../../routes/types/continuous-optimization.types';
import {
    AuditStatus,
    HttpErrorCodes,
    SANDBOX_EXTENDED_PROPERTY_FLAG_VALUE,
    SandboxLifecycleAction
} from '../../utils/consts';
import getLogger from '../../utils/logger';
import { updateLongRunningAuditGroup } from '../cloud-manager/audit-operations';
import { updateJobDetails } from '../database/job-operations';
import {
    runSandboxPreValidations,
    performSandboxDeletion,
    getSandboxSnapshots,
    performLifecycleUpdate
} from '../sandbox-operations';
// const isDemoFlow = isDemo();

const logger = getLogger();

async function handleCloneRemediation(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    childCloneJobId: string,
    clone: CloneDetailType,
    serverNameWithHostName: string
) {
    logger.info('Handling clone remediation', {
        accountId,
        credentialsId,
        region,
        childCloneJobId,
        clone,
        serverNameWithHostName
    });

    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let jobError = '';
    const { cloneDatabaseName, action, clonedBy } = clone;

    try {
        if (clonedBy === SANDBOX_EXTENDED_PROPERTY_FLAG_VALUE) {
            if (!['delete', 'refresh'].includes(action)) {
                logger.error(`Invalid action type: ${action}`);
            }
            switch (action) {
                case 'refresh':
                    logger.info(`Refreshing clone ${cloneDatabaseName} created by netapp_wf.`);
                    await refreshClone(
                        accountId,
                        credentialsId,
                        region,
                        databaseHostId,
                        databaseInstanceId,
                        cloneDatabaseName,
                        childCloneJobId
                    );
                    break;

                case 'delete':
                    logger.info(`Deleting clone ${cloneDatabaseName} created by netapp_wf.`);
                    await deleteClone(
                        accountId,
                        credentialsId,
                        region,
                        databaseHostId,
                        databaseInstanceId,
                        cloneDatabaseName,
                        childCloneJobId
                    );
                    break;
                default:
                    logger.error(`Unsupported action: ${action}`);
            }
        } else if (clonedBy === 'other') {
            logger.info(`Deleting clone ${cloneDatabaseName} created by other source.`);
            // yet to Add logic to delete the clone created by others
            // await deleteClone();
        }
        logger.info(`Successfully handled clone remediation for ${cloneDatabaseName}`);
    } catch (error) {
        jobStatus = JOBSTATUS.FAILED;
        jobError = `Error while handling clone remediation: ${error}`;
        logger.error(jobError);
    } finally {
        await updateJobDetails(accountId, childCloneJobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: jobError
        });

        if (jobStatus === JOBSTATUS.FAILED) {
            updateLongRunningAuditGroup(AuditStatus.FAILED, jobError);
        } else {
            updateLongRunningAuditGroup(AuditStatus.SUCCESS);
        }
    }
}

async function deleteClone(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    cloneDatabaseName: string,
    jobId: string
) {
    try {
        const source = { host: databaseHostId, instance: databaseInstanceId, database: cloneDatabaseName };
        const { srcDetails } = await runSandboxPreValidations(accountId, credentialsId, region, source, source);
        logger.info(`Executing delete operation for clone ${cloneDatabaseName}`);
        await performSandboxDeletion(accountId, region, credentialsId, jobId, srcDetails);
        logger.info(`Successfully deleted clone ${cloneDatabaseName}`);
    } catch (error: any) {
        const errorMsg = `Error while deleting clone ${cloneDatabaseName}: ${error.message}`;
        logger.error(errorMsg, error);
        throw createError(error.statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMsg);
    }
}

async function refreshClone(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    cloneDatabaseName: string,
    jobId: string
) {
    logger.info(`Refreshing clone ${cloneDatabaseName} in database host ${databaseHostId}`, {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        cloneDatabaseName
    });

    try {
        const source = { host: databaseHostId, instance: databaseInstanceId, database: cloneDatabaseName };
        const { srcDetails } = await runSandboxPreValidations(accountId, credentialsId, region, source, source);
        // Fetch the latest snapshot for the sandbox
        const snapshots = await getSandboxSnapshots(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            cloneDatabaseName
        );

        if (!snapshots || snapshots.length === 0) {
            throw createError(
                HttpErrorCodes.NOT_FOUND,
                `No snapshots found for sandbox ${cloneDatabaseName} in database host ${databaseHostId}`
            );
        }

        // Convert the `created` property to a number and get the latest snapshot
        const latestSnapshot = snapshots.reduce(
            (latest: { name: string; created: number }, current: { name: string; created: string }) => {
                const currentCreated = new Date(current.created).getTime(); // Convert `created` to a timestamp
                return currentCreated > latest.created ? { ...current, created: currentCreated } : latest;
            },
            { name: '', created: 0 } // Initial value for `reduce`
        );

        logger.info(`Latest snapshot for sandbox ${cloneDatabaseName}: ${latestSnapshot.name}`, {
            snapshot: latestSnapshot
        });
        await performLifecycleUpdate(
            accountId,
            credentialsId,
            region,
            jobId,
            srcDetails,
            SandboxLifecycleAction.REFRESH,
            latestSnapshot.name
        );

        logger.info(`Successfully refreshed sandbox ${cloneDatabaseName} to the latest snapshot`);
    } catch (error: any) {
        const errorMsg = `Error while refreshing sandbox ${cloneDatabaseName} in database host ${databaseHostId}: ${error.message}`;
        logger.error(errorMsg, error);
        throw createError(error.statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMsg);
    }
}
export { handleCloneRemediation, deleteClone, refreshClone };
