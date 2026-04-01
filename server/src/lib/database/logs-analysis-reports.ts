import { DATABASE_TYPE, Prisma } from '@prisma/client';
import { isEmpty } from 'lodash-es';
import getLogger from '../../utils/logger';
import { prisma } from '../../utils/prisma-utils';
import { checkAccount } from './db';

interface WidgetReportRow {
    database_instance_id: string;
    resource_id: string;
    database_type: string;
    database_instance_name: string;
    credentials_id: string;
    region: string;
    hostname: string;
    recommendations: Array<{
        uniqueErrorKey?: string;
        error: string;
        errorCode?: string;
        severity?: string;
        cause?: string;
    }>;
}

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
    region?: string;
    jobId?: string;
    reportId?: string;
    sort?: string;
    sortOrder?: string;
    pageSize?: number;
    nextToken?: string;
    select?: Record<string, boolean>;
    databaseType?: DATABASE_TYPE;
}) {
    logger.info('Listing logs analysis reports', params);
    let {
        accountId,
        databaseHostId,
        databaseInstanceId,
        credentialsId,
        region,
        jobId,
        reportId,
        sort = 'creation_time',
        sortOrder = 'desc',
        pageSize,
        nextToken,
        select,
        databaseType
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
            ...(reportId && { id: reportId }),
            ...(databaseType && { database_type: databaseType }),
            ...(region && {
                database_instances: {
                    region
                }
            })
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

async function countLogsAnalysisReports(accountId: string, credentialsId?: string, region?: string) {
    logger.info('Counting logs analysis reports', { accountId, credentialsId, region });

    if (accountId) {
        accountId = checkAccount(accountId);
    }

    return prisma.client.logs_analysis_reports.count({
        where: {
            ...(accountId && { account_id: accountId }),
            ...(credentialsId && { credentials_id: credentialsId }),
            ...(region && {
                database_instances: {
                    region
                }
            })
        }
    });
}

async function getLatestReportsForWidget(
    accountId: string,
    credentialsIdList?: string[],
    regionList?: string[]
): Promise<WidgetReportRow[]> {
    logger.info('Getting latest logs analysis reports for widget', { accountId, credentialsIdList, regionList });

    const checkedAccountId = checkAccount(accountId);

    const credentialsFilter =
        !isEmpty(credentialsIdList) && credentialsIdList
            ? Prisma.sql`AND di.credentials_id IN (${Prisma.join(credentialsIdList)})`
            : Prisma.empty;

    const regionFilter =
        !isEmpty(regionList) && regionList ? Prisma.sql`AND di.region IN (${Prisma.join(regionList)})` : Prisma.empty;

    return prisma.client.$queryRaw<WidgetReportRow[]>`
        SELECT
            lar.database_instance_id,
            lar.resource_id,
            lar.database_type,
            di.database_instance_name,
            lar.credentials_id,
            di.region,
            r.resource_name AS hostname,
            JSON_ARRAYAGG(
                JSON_OBJECT(
                    'uniqueErrorKey', rec.uniqueErrorKey,
                    'error',          rec.error,
                    'errorCode',      rec.errorCode,
                    'severity',       rec.severity,
                    'cause',          rec.cause
                )
            ) AS recommendations
        FROM logs_analysis_reports lar
        JOIN database_instances di
          ON  di.account_id           = lar.account_id
          AND di.credentials_id       = lar.credentials_id
          AND di.resource_id          = lar.resource_id
          AND di.database_instance_id = lar.database_instance_id
        JOIN resource r
          ON  r.account_id     = lar.account_id
          AND r.credentials_id = lar.credentials_id
          AND r.region         = di.region
          AND r.resource_id    = lar.resource_id
        LEFT JOIN JSON_TABLE(
            lar.logs_analysis_data,
            '$[*].data.remediationRecommendation[*]'
            COLUMNS (
                uniqueErrorKey VARCHAR(255) PATH '$.uniqueErrorKey',
                error          TEXT        PATH '$.error',
                errorCode      VARCHAR(64) PATH '$.errorCode',
                severity       VARCHAR(32) PATH '$.severity',
                cause          TEXT        PATH '$.cause'
            )
        ) rec ON TRUE
        WHERE lar.account_id = ${checkedAccountId}
          AND lar.creation_time = (
                SELECT MAX(lar2.creation_time)
                FROM logs_analysis_reports lar2
                WHERE lar2.account_id           = lar.account_id
                  AND lar2.database_instance_id = lar.database_instance_id
                  AND lar2.credentials_id       = lar.credentials_id
                  AND lar2.resource_id          = lar.resource_id
          )
          ${credentialsFilter}
          ${regionFilter}
        GROUP BY lar.database_instance_id, lar.resource_id, lar.database_type, di.database_instance_name, lar.credentials_id, di.region, r.resource_name
    `;
}

export {
    createLogsAnalysisReports,
    removeLogsAnalysisReports,
    listLogsAnalysisReports,
    LogsAnalysisReportObject,
    countLogsAnalysisReports,
    getLatestReportsForWidget
};
