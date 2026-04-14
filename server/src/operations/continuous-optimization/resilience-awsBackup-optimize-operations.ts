import createError from 'http-errors';
import { isEmpty } from 'lodash-es';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import throat from 'throat';
import getLogger from '../../utils/logger';
import { HttpErrorCodes } from '../../utils/consts';
import { AwsFsxNBackupConfig, JobMetadata } from '../../utils/common-types';
import { updateFsxBackup } from '../aws/fsx-operations';
import { updateJobDetails } from '../database/job-operations';
import { handleOptimizeJobCreation } from './assessment-utils';
import { OracleJobMetadata } from './oracle/consts';

const logger = getLogger();

interface FsxBackupHost {
    fsxFileSystemId?: string;
    backupRetentionDays?: number;
    backupStartTime?: string;
}

function buildFsxBackupConfigMap(hosts: FsxBackupHost[]) {
    const fsxFilesystemIds: string[] = [];
    const fsxBackupConfigMap = new Map<string, AwsFsxNBackupConfig>();
    hosts.forEach(host => {
        if (
            host.fsxFileSystemId &&
            !fsxBackupConfigMap.get(host.fsxFileSystemId) &&
            host.backupRetentionDays &&
            host.backupStartTime
        ) {
            fsxBackupConfigMap.set(host.fsxFileSystemId, {
                automaticBackupRetentionDays: host.backupRetentionDays,
                dailyAutomaticBackupStartTime: host.backupStartTime
            });
            fsxFilesystemIds.push(host.fsxFileSystemId);
        }
    });
    return { fsxBackupConfigMap, fsxFilesystemIds };
}

async function executeFsxBackupUpdates(
    accountId: string,
    credentialsId: string,
    region: string,
    fsxBackupConfigMap: Map<string, AwsFsxNBackupConfig>
): Promise<{ jobStatus: JOBSTATUS; errors: string[] }> {
    let jobStatus = JOBSTATUS.COMPLETED as JOBSTATUS;
    const errors: string[] = [];

    await Promise.all(
        Array.from(fsxBackupConfigMap.entries()).map(
            throat(2, async ([fsxFileSystemId, configuration]) => {
                try {
                    await updateFsxBackup(accountId, credentialsId, region, fsxFileSystemId, configuration);
                } catch (err: unknown) {
                    errors.push(
                        `Error occurred while updating AWS FSx for ONTAP backup for fsxFileSystemId ${fsxFileSystemId}. Error: ${String(
                            err
                        )}`
                    );
                    jobStatus = JOBSTATUS.FAILED;
                }
            })
        )
    );

    return { jobStatus, errors };
}

async function handleFsxBackupOptimizeJob(
    accountId: string,
    credentialsId: string,
    region: string,
    hosts: FsxBackupHost[],
    masterOptimizeParentId: string,
    jobMetadata: JobMetadata | OracleJobMetadata
): Promise<{ jobId: string; jobStatus: JOBSTATUS; errors: string[] }> {
    const { fsxBackupConfigMap, fsxFilesystemIds } = buildFsxBackupConfigMap(hosts);

    if (isEmpty(fsxBackupConfigMap)) {
        const errorMessage = 'No valid AWS FSx for ONTAP backup configuration found for the provided database hosts';
        logger.error('Failed to prepare FSx backup optimization job', {
            accountId,
            region,
            masterOptimizeParentId,
            errorMessage
        });
        throw createError(HttpErrorCodes.BAD_REQUEST, errorMessage);
    }

    const jobDescription = `Enable AWS FSx for ONTAP automatic backup for filesystems ${fsxFilesystemIds.join(', ')}`;

    const jobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        '',
        JOBTYPE.WELL_ARCHITECTED,
        'Update AWS FSx for ONTAP backup',
        jobDescription,
        masterOptimizeParentId,
        jobMetadata
    );

    const { jobStatus, errors } = await executeFsxBackupUpdates(accountId, credentialsId, region, fsxBackupConfigMap);

    if (errors.length > 0) {
        logger.error('Failed to update AWS FSx for ONTAP backup', {
            accountId,
            jobId,
            errors
        });
    }

    const jobUpdatePayload: { status: JOBSTATUS; endTime: number; error?: string } = {
        status: jobStatus,
        endTime: Date.now()
    };

    if (jobStatus === JOBSTATUS.FAILED && errors.length > 0) {
        jobUpdatePayload.error = errors.join(', ');
    }

    await updateJobDetails(accountId, jobId, jobUpdatePayload);

    return { jobId, jobStatus, errors };
}

export { buildFsxBackupConfigMap, executeFsxBackupUpdates, handleFsxBackupOptimizeJob, FsxBackupHost };
