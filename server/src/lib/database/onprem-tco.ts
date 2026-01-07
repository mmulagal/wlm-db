import { DATABASE_DEPLOYMENT_TYPE, DATABASE_TYPE } from '@prisma/client';
import { isEmpty } from 'lodash-es';
import getLogger from '../../utils/logger';
import { prisma } from '../../utils/prisma-utils';
import { checkAccount } from './db';

const logger = getLogger();

interface OnPremTcoReportObject {
    account_id: string;
    resource_id: string;
    database_type: DATABASE_TYPE;
    database_deployment_type: DATABASE_DEPLOYMENT_TYPE;
    creation_time: Date;
    version: string;
    host_config: object;
    database_instances_data: object;
    assessment_data?: object;
}
async function createOnPremTcoReportData(records: OnPremTcoReportObject[]) {
    logger.info('Creating onpremises TCO report', { records: records.length });
    records.forEach(record => {
        record.account_id = checkAccount(record.account_id);
    });
    return prisma.client.onprem_tco_reports.createMany({
        data: records
    });
}

async function removeOnPremTcoReportData(
    id?: string[],
    accountId?: string,
    resourceIdList?: string[],
    databaseType?: DATABASE_TYPE
) {
    logger.info('Removing onpremises TCO report', {
        id,
        accountId,
        resourceIdList,
        databaseType
    });

    return prisma.client.onprem_tco_reports.deleteMany({
        where: {
            AND: [
                ...(id ? [{ id: { in: id } }] : []),
                ...(accountId ? [{ account_id: accountId }] : []),
                ...(resourceIdList ? [{ resource_id: { in: resourceIdList } }] : []),
                ...(databaseType ? [{ database_type: databaseType }] : [])
            ]
        }
    });
}

async function updateOnPremTcoReportRecord(
    accountId: string,
    resourceId: string,
    databaseType: string,
    data: {
        assessment_data: object;
    }
) {
    logger.info('Updating onprem TCO report', { accountId, resourceId, databaseType, data });

    return prisma.client.onprem_tco_reports.updateMany({
        where: {
            account_id: accountId,
            resource_id: resourceId
        },
        data
    });
}

async function listOnPremDatabaseResources(
    accountId: string,
    databaseType: DATABASE_TYPE,
    pageSize?: number,
    nextToken?: string,
    resourceIds?: string[],
    timestamp?: Date,
    sort: string = 'creation_time',
    sortOrder: string = 'desc'
) {
    logger.info('Listing on-prem database resources', { accountId, databaseType, pageSize, nextToken, timestamp });

    accountId = checkAccount(accountId);

    return prisma.client.onprem_tco_reports.findMany({
        where: {
            account_id: accountId,
            database_type: databaseType,
            ...(!isEmpty(resourceIds) && { resource_id: { in: resourceIds } }),
            ...(timestamp && { creation_time: timestamp })
        },
        orderBy: [
            {
                [sort]: `${sortOrder}`
            }
        ],
        ...(pageSize && { take: pageSize }),
        ...(nextToken && {
            cursor: { id: nextToken },
            skip: 1
        })
    });
}
export {
    createOnPremTcoReportData,
    removeOnPremTcoReportData,
    updateOnPremTcoReportRecord,
    listOnPremDatabaseResources,
    OnPremTcoReportObject
};
