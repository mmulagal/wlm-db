import { DATABASE_TYPE } from '@prisma/client';
import { isEmpty } from 'lodash-es';
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

async function listLogsAnalysisReports(params: {
    accountId: string;
    databaseHostId?: string;
    databaseInstanceId?: string;
    credentialsId?: string;
    jobId?: string;
    reportId?: string;
    sort?: string;
    sortOrder?: string;
    pageSize?: number;
    nextToken?: string;
    select?: Record<string, boolean>;
}) {
    logger.info('Listing logs analysis reports', params);
    let {
        accountId,
        databaseHostId,
        databaseInstanceId,
        credentialsId,
        jobId,
        reportId,
        sort = 'creation_time',
        sortOrder = 'desc',
        pageSize,
        nextToken,
        select
    } = params;

    accountId = checkAccount(accountId);

    // Two-step approach to avoid MySQL sort buffer issues:
    // 1. Get sorted IDs only (lightweight, uses index efficiently)
    // 2. Fetch full records for those IDs

    const sortedIdQuery = await prisma.client.logs_analysis_reports.findMany({
        where: {
            account_id: accountId,
            ...(databaseHostId && { resource_id: databaseHostId }),
            ...(databaseInstanceId && { database_instance_id: databaseInstanceId }),
            ...(credentialsId && { credentials_id: credentialsId }),
            ...(jobId && { job_id: jobId }),
            ...(reportId && { id: reportId })
        },
        orderBy: [
            {
                [sort]: `${sortOrder}`
            }
        ],
        select: { id: true }, // Only select ID - minimal memory usage
        ...(pageSize && pageSize > 0 && { take: pageSize }),
        ...(nextToken && {
            cursor: { id: nextToken },
            skip: 1
        })
    });

    if (sortedIdQuery.length === 0) {
        return [];
    }

    return prisma.client.logs_analysis_reports.findMany({
        where: {
            id: { in: sortedIdQuery.map(r => r.id) }
        },
        ...(select && !isEmpty(select) && { select })
    });
}

async function countLogsAnalysisReports(accountId: string, credentialsId?: string) {
    logger.info('Counting logs analysis reports', { accountId, credentialsId });

    if (accountId) {
        accountId = checkAccount(accountId);
    }

    return prisma.client.resource.count({
        where: {
            ...(accountId && { account_id: accountId }),
            ...(credentialsId && { credentials_id: credentialsId })
        }
    });
}

export {
    createLogsAnalysisReports,
    removeLogsAnalysisReports,
    listLogsAnalysisReports,
    LogsAnalysisReportObject,
    countLogsAnalysisReports
};
