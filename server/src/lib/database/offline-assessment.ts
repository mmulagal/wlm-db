import { DATABASE_TYPE } from '@prisma/client';
import { isEmpty } from 'lodash-es';
import getLogger from '../../utils/logger';
import { prisma } from '../../utils/prisma-utils';
import { checkAccount, buildSelectFields } from '../../utils/utils';

const logger = getLogger();

/**
 * Record structure for offline assessment
 * rawdata: Contains the script output (storageAssessment, rssConfig, errors)
 * mapped_ontap_volumes: Contains the mapped ONTAP volumes data
 * metadata: Contains contextual info (hostname, storageEndpoint, assessmentTimestamp, databaseInstanceName, updateCount)
 * assessment_results: Computed assessment results (populated after processing)
 */
interface OfflineAssessmentRecord {
    accountId: string;
    credentialsId?: string;
    region?: string;
    resourceId: string;
    databaseInstanceId: string;
    databaseType: DATABASE_TYPE;
    rawdata: object;
    mappedOntapVolumes?: object;
    metadata?: {
        databaseInstanceName?: string;
        hostname?: string;
        storageEndpoint?: string;
        assessmentTimestamp?: string;
        updateCount?: number;
        [key: string]: unknown;
    };
    assessmentResults?: object;
}

interface ListOfflineAssessmentParams {
    accountId: string;
    credentialsId?: string;
    region?: string;
    resourceId?: string;
    databaseInstanceId?: string;
    databaseType?: DATABASE_TYPE;
    pageSize?: number;
    nextToken?: string;
}

/**
 * Upsert an offline assessment record
 * Creates a new record or updates existing one based on unique constraint
 * Tracks updateCount in metadata when record is updated
 */
async function upsertOfflineAssessment(record: OfflineAssessmentRecord) {
    const {
        accountId,
        resourceId,
        databaseInstanceId,
        credentialsId,
        region,
        databaseType,
        mappedOntapVolumes,
        assessmentResults,
        rawdata
    } = record;
    const checkedAccountId = checkAccount(accountId);

    // Check if record already exists to track update count
    const existingRecord = await prisma.client.offline_assessment.findUnique({
        where: {
            uk_wlmdb_offline_assessment: {
                account_id: checkedAccountId,
                resource_id: resourceId,
                database_instance_id: databaseInstanceId
            }
        },
        select: { metadata: true }
    });

    const existingMetadata = (existingRecord?.metadata as Record<string, unknown>) || {};
    const currentUpdateCount = (existingMetadata.updateCount as number) || 0;
    const newUpdateCount = existingRecord ? currentUpdateCount + 1 : 1;

    const metadata = {
        ...(record.metadata || {}),
        updateCount: newUpdateCount
    };

    return prisma.client.offline_assessment.upsert({
        where: {
            uk_wlmdb_offline_assessment: {
                account_id: checkedAccountId,
                resource_id: resourceId,
                database_instance_id: databaseInstanceId
            }
        },
        create: {
            account_id: checkedAccountId,
            credentials_id: credentialsId,
            region,
            resource_id: resourceId,
            database_instance_id: databaseInstanceId,
            database_type: databaseType,
            rawdata,
            mapped_ontap_volumes: mappedOntapVolumes || {},
            metadata,
            assessment_results: assessmentResults || {}
        },
        update: {
            credentials_id: credentialsId,
            region,
            database_type: databaseType,
            rawdata,
            mapped_ontap_volumes: mappedOntapVolumes || {},
            metadata,
            assessment_results: assessmentResults || {}
        }
    });
}

/**
 * List offline assessments with pagination
 */
async function listOfflineAssessments({
    accountId,
    credentialsId,
    region,
    resourceId,
    databaseInstanceId,
    databaseType,
    pageSize = 50,
    nextToken
}: ListOfflineAssessmentParams) {
    logger.info('Listing offline assessments', {
        accountId,
        credentialsId,
        region,
        resourceId,
        databaseInstanceId,
        databaseType
    });

    const checkedAccountId = checkAccount(accountId);

    // Two-step approach to avoid MySQL sort buffer issues:
    // 1. Get IDs only (minimal memory, uses index efficiently) with cursor pagination
    // 2. Fetch full records for those IDs using primary key lookup

    // Step 1: Get IDs only - this avoids loading large JSON fields during filtering
    const idResults = await prisma.client.offline_assessment.findMany({
        where: {
            account_id: checkedAccountId,
            ...(credentialsId && { credentials_id: credentialsId }),
            ...(region && { region }),
            ...(resourceId && { resource_id: resourceId }),
            ...(databaseInstanceId && { database_instance_id: databaseInstanceId }),
            ...(databaseType && { database_type: databaseType })
        },
        select: { id: true },
        orderBy: {
            created_time: 'desc'
        },
        ...(pageSize && pageSize > 0 && { take: pageSize }),
        ...(nextToken && {
            cursor: { id: nextToken },
            skip: 1
        })
    });

    if (idResults.length === 0) {
        return [];
    }

    // Step 2: Fetch full records using primary key lookup (very fast)
    const ids = idResults.map(r => r.id);
    return prisma.client.offline_assessment.findMany({
        where: {
            id: { in: ids }
        }
    });
}

/**
 * Get a specific offline assessment
 */
async function getOfflineAssessment(
    accountId: string,
    resourceId: string,
    databaseInstanceId: string,
    region?: string,
    credentialsId?: string,
    selectKeys?: string[]
) {
    logger.info('Getting offline assessment', {
        accountId,
        resourceId,
        databaseInstanceId,
        region,
        credentialsId,
        selectKeys
    });

    const checkedAccountId = checkAccount(accountId);

    const select = selectKeys && !isEmpty(selectKeys) ? buildSelectFields(selectKeys) : undefined;

    return prisma.client.offline_assessment.findUnique({
        where: {
            uk_wlmdb_offline_assessment: {
                account_id: checkedAccountId,
                resource_id: resourceId,
                database_instance_id: databaseInstanceId
            },
            ...(region && { region }),
            ...(credentialsId && { credentials_id: credentialsId })
        },
        ...(select && { select })
    });
}

/**
 * Bulk upsert offline assessments
 */
async function bulkUpsertOfflineAssessments(records: OfflineAssessmentRecord[]) {
    logger.info('Bulk upserting offline assessments', { count: records.length });

    const results = await Promise.all(records.map(record => upsertOfflineAssessment(record)));

    return results;
}

async function removeOfflineAssessmentData(accountId: string, resourceIdList: string[], databaseType?: DATABASE_TYPE) {
    logger.info('Removing offline assessment data', {
        accountId,
        resourceIdList,
        databaseType
    });

    return prisma.client.offline_assessment.deleteMany({
        where: {
            AND: [
                { account_id: checkAccount(accountId) },
                { resource_id: { in: resourceIdList } },
                ...(databaseType ? [{ database_type: databaseType }] : [])
            ]
        }
    });
}

async function updateOfflineAssessmentResults(
    accountId: string,
    resourceId: string,
    databaseInstanceId: string,
    assessmentResults: object
) {
    const checkedAccountId = checkAccount(accountId);
    return prisma.client.offline_assessment.updateMany({
        where: {
            account_id: checkedAccountId,
            resource_id: resourceId,
            database_instance_id: databaseInstanceId
        },
        data: { assessment_results: assessmentResults }
    });
}

export {
    OfflineAssessmentRecord,
    ListOfflineAssessmentParams,
    listOfflineAssessments,
    getOfflineAssessment,
    bulkUpsertOfflineAssessments,
    updateOfflineAssessmentResults,
    removeOfflineAssessmentData
};
