import { compact, isEmpty, partition, uniqBy } from 'lodash-es';
import getLogger from '../utils/logger';
import { getCredentials } from './cloud-manager/credentials-operations';
import { creadteDemoDBData } from '../utils/demo-utils/demoDefaultUtils';
import { DatabaseTypes, MSSQL } from '../utils/consts';
import {
    onPremAOAGAUploadObject,
    onPremFCIUploadObject,
    onpremStdUploadObject
} from '../utils/demo-utils/demoMockdata';
import { getOnPremDatabaseResources, uploadOnpremTcoData } from './onprem-tco-operations';
import { AssessmentCategories, SEVERITY } from '../utils/continous-optimization-consts';
import { MappedOnTapVolumeResponse } from '../utils/common-types';
import { paginateListInstanceConfigData } from './database/instance-config-operations';
import { getGroupedDatabaseInstancesBySeverity, groupResources } from '../lib/database/db';
import { GroupedDatabaseInstancesBySeverityResult } from '../lib/database/db-types';
import { IS_DEMO_FLOW, hyphenatedToPascalCaseWithSpace } from '../utils/utils';
import { generateFocusWidgetNameMap } from '../utils/golden-config-utils';

const logger = getLogger();
const focusWidgetNameMap = generateFocusWidgetNameMap();

async function getSystemStatus(accountId: string) {
    logger.info('Getting system status for account.', accountId);
    const credentialsType = 'aws_assume_role';
    const credentialsList = await getCredentials(credentialsType);
    if (process.env.NODE_ENV !== 'demo' && process.env.NODE_ENV !== 'simulator') {
        if (isEmpty(credentialsList)) {
            return { isActive: false };
        }
        return { isActive: true };
    }
    creadteDemoDBData(accountId, credentialsList);
    const resource = await getOnPremDatabaseResources(accountId, MSSQL);
    if (resource.count === 0) {
        uploadOnpremTcoData(accountId, MSSQL, onPremFCIUploadObject.fileName, onPremFCIUploadObject.fileContent);
        uploadOnpremTcoData(accountId, MSSQL, onPremAOAGAUploadObject.fileName, onPremAOAGAUploadObject.fileContent);
        uploadOnpremTcoData(accountId, MSSQL, onpremStdUploadObject.fileName, onpremStdUploadObject.fileContent);
    }
    return { isActive: true };
}

async function getDatabaseVolumes(accountId: string, pageSize = 500, nextToken?: string, fileSystemId?: string) {
    logger.info('Getting database volumes for account.', accountId, pageSize, nextToken, fileSystemId);

    const fileSystemIds = fileSystemId ? fileSystemId.trim().split(',') : undefined;
    const { items, nextToken: newToken } = await paginateListInstanceConfigData({
        accountId,
        configDataType: AssessmentCategories.MAPPED_ONTAP_VOLUMES,
        ...(pageSize && { pageSize }),
        ...(nextToken && { nextToken }),
        select: { config_data: true, id: true, database_instances: { select: { fsxn_ids: true } } },
        filters: {
            config_data: { not: {} },
            ...(!isEmpty(fileSystemIds) && {
                database_instances: {
                    fsxn_ids: { in: fileSystemIds }
                }
            })
        }
    });

    let volumes = items.flatMap(obj => {
        const { fsxn_ids: fsxId = '' } = obj.database_instances || {};
        return obj.config_data
            ? Object.values(obj.config_data).flatMap(cfg =>
                  (cfg as MappedOnTapVolumeResponse)?.volumeRecords
                      ?.filter(({ fsxVolumeId }) => Boolean(fsxVolumeId))
                      ?.map(({ uuid, name, fsxVolumeId }) => ({
                          id: fsxVolumeId ?? '',
                          name,
                          fsxId,
                          ontapUuid: uuid
                      }))
              )
            : [];
    });

    volumes = compact(uniqBy(volumes, 'id'));
    return { volumeCount: volumes?.length ?? 0, volumes, nextToken: newToken };
}

// Returns array of grouped categories with name, count, and severity
// [
//   {
//     name: "storage | configuration",
//     count: 70,
//     severity: "high"
//   },
//   {
//     name: "storage | layout",
//     count: 10,
//     severity: "low"
//   }
// ]
function getLimitedItems(
    objects: GroupedDatabaseInstancesBySeverityResult[],
    limit = 0
): Array<{ name: string; count: number }> {
    const mapped = objects.map(obj => {
        const focusWidgetName = focusWidgetNameMap.get(obj.name?.toString() || '') || obj.name;
        // Convert hyphenated names to Pascal case with spaces for display
        const displayName =
            typeof focusWidgetName === 'string' && focusWidgetName.includes('-')
                ? hyphenatedToPascalCaseWithSpace(focusWidgetName)
                : focusWidgetName;
        return {
            ...obj,
            name: displayName
        };
    });

    // Group by name and sum counts
    const grouped: Record<string, { name: string; count: number }> = {};
    mapped.forEach(obj => {
        const name = obj.name?.toString() || '';
        if (name) {
            if (!grouped[name]) {
                grouped[name] = { name, count: 0 };
            }
            grouped[name].count += Number(obj.count) || 0;
        }
    });

    const uniqueItems = Object.values(grouped).sort((a, b) => b.count - a.count);

    if (!limit) {
        return uniqueItems;
    }

    if (uniqueItems.length <= limit) {
        return uniqueItems;
    }

    return uniqueItems.slice(0, limit);
}

function formatDescription(items: Array<{ name: string; count: number }>) {
    return items.map(({ name }) => ({ description: `${name}` }));
}

async function getFocusStatus(accountId: string, credentialsIds?: string, regions?: string, limit?: number) {
    logger.info('Getting focus status for account.', accountId, credentialsIds, regions, limit);
    // Always send only one severity. Sort the documents based on severity and send the top ones.
    // Priority is high > medium > low
    // limit is applied on the number of items to be sent in the response not on the totalItems
    // e.g., if there are 10 high severity items and limit is 5, send only 5 high severity items, totalItems will be 10

    const credentialsIdList = credentialsIds?.split(',').map(id => id.trim());
    const regionList = regions?.split(',').map(region => region.trim());
    const groupedDatabaseInstances = await getGroupedDatabaseInstancesBySeverity({
        accountId,
        credentialsIdList,
        regionList
    });

    const [highSeverityItems, lowSeverityItems] = partition(groupedDatabaseInstances, {
        severity: SEVERITY.CRITICAL
    });

    if (!isEmpty(highSeverityItems)) {
        const totalItems = highSeverityItems.reduce((sum, item) => sum + Number(item.count), 0);
        const items = getLimitedItems(highSeverityItems, limit);
        return {
            items: formatDescription(items),
            severity: 'high',
            totalItems
        };
    }

    if (!isEmpty(lowSeverityItems)) {
        const totalItems = lowSeverityItems.reduce((sum, item) => sum + Number(item.count), 0);
        const items = getLimitedItems(lowSeverityItems, limit);
        return {
            items: formatDescription(items),
            severity: 'low',
            totalItems
        };
    }

    if (IS_DEMO_FLOW) {
        return {
            items: [
                { description: 'Auto size configuration' },
                { description: 'Backup configuration' },
                { description: 'Performance tuning' },
                { description: 'Security patch' },
                { description: 'Resource utilization' }
            ],
            severity: 'low',
            totalItems: 5
        };
    }

    return {
        items: [{ description: 'All systems operational' }],
        severity: 'low',
        totalItems: 0
    };
}

async function getWidgetStatus(accountId: string, credentialsIds?: string, regions?: string) {
    logger.info('Getting widget status for account.', accountId, credentialsIds, regions);

    let count = await groupResources({
        accountId,
        credentialsIdList: credentialsIds ? credentialsIds.split(',') : undefined,
        regionList: regions ? regions.split(',') : undefined
    });

    if (IS_DEMO_FLOW) {
        count = [
            { resource_type: 'mssql', _count: { id: 15 } },
            { resource_type: 'oracle', _count: { id: 10 } },
            { resource_type: 'pgsql', _count: { id: 5 } }
        ];
    }

    return {
        items: [
            {
                data: compact(
                    count.map(
                        ({
                            resource_type: resourceType,
                            _count: { id }
                        }: {
                            resource_type: string;
                            _count: { id: number };
                        }) => ({
                            id: (resourceType as DatabaseTypes)?.toLowerCase?.() ?? '',
                            value: id || 0
                        })
                    )
                ),
                id: 'bar-chart'
            }
        ]
    };
}

export { getSystemStatus, getDatabaseVolumes, getFocusStatus, getWidgetStatus };
