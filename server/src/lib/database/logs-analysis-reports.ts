import { DATABASE_TYPE } from '@prisma/client';
import getLogger from '../../utils/logger';
import { prisma } from '../../utils/prisma-utils';
import { checkAccount } from './db';

const logger = getLogger();

interface LogsAnalysisReportObject {
    credentials_id: string;
    resource_id: string;
    database_instance_id: string;
    job_id: string;
    account_id: string;
    database_type: DATABASE_TYPE;
    logs_analysis_data?: object;
    version: string;
    creation_time?: Date;
    start_time?: Date;
    end_time?: Date;
}

async function createLogsAnalysisReports(records: LogsAnalysisReportObject[]) {
    logger.info('Creating logs analysis reports', { records: records.length });
    records.forEach(record => {
        record.account_id = checkAccount(record.account_id);
    });
    return prisma.client.logs_analysis_reports.createMany({
        data: records
    });
}

async function removeLogsAnalysisReports(
    id?: string[],
    accountId?: string,
    resourceIdList?: string[],
    databaseInstanceIdList?: string[],
    jobIdList?: string[],
    databaseType?: DATABASE_TYPE
) {
    logger.info('Removing logs analysis reports', {
        id,
        accountId,
        resourceIdList,
        databaseInstanceIdList,
        jobIdList,
        databaseType
    });

    return prisma.client.logs_analysis_reports.deleteMany({
        where: {
            AND: [
                ...(id ? [{ id: { in: id } }] : []),
                ...(accountId ? [{ account_id: accountId }] : []),
                ...(resourceIdList ? [{ resource_id: { in: resourceIdList } }] : []),
                ...(databaseInstanceIdList ? [{ database_instance_id: { in: databaseInstanceIdList } }] : []),
                ...(jobIdList ? [{ job_id: { in: jobIdList } }] : []),
                ...(databaseType ? [{ database_type: databaseType }] : [])
            ]
        }
    });
}

async function listLogsAnalysisReports(
    accountId: string,
    databaseHostId: string,
    databaseInstanceId: string,
    jobId?: string,
    reportId?: string,
    sort: string = 'creation_time',
    sortOrder: string = 'desc',
    pageSize?: number,
    nextToken?: string
) {
    logger.info('Listing logs analysis reports', {
        accountId,
        databaseHostId,
        databaseInstanceId,
        jobId,
        reportId
    });

    accountId = checkAccount(accountId);

    return prisma.client.logs_analysis_reports.findMany({
        where: {
            account_id: accountId,
            resource_id: databaseHostId,
            database_instance_id: databaseInstanceId,
            ...(jobId && { job_id: jobId }),
            ...(reportId && { id: reportId })
        },
        orderBy: [
            {
                [sort]: `${sortOrder}`
            }
        ],
        ...(pageSize && pageSize > 0 && { take: pageSize }),
        ...(nextToken && {
            cursor: { id: nextToken },
            skip: 1
        })
    });
}

export { createLogsAnalysisReports, removeLogsAnalysisReports, listLogsAnalysisReports, LogsAnalysisReportObject };
