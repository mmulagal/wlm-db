import { compact, isEmpty, partition, uniqBy } from 'lodash-es';
import getLogger from '../utils/logger';
import { getCredentials } from './cloud-manager/credentials-operations';
import { creadteDemoDBData, prepopulateOfflineAssessmentData } from '../utils/demo-utils/demoDefaultUtils';
import { DatabaseTypes, MSSQL } from '../utils/consts';
import {
    onPremAOAGAUploadObject,
    onPremFCIUploadObject,
    onpremStdUploadObject,
    oracleStandaloneUploadObject,
    oracleDataGuardUploadObject,
    oracleMultiDBUploadObject
} from '../utils/demo-utils/demoMockdata';
import { getOnPremDatabaseResources, uploadOnpremTcoData } from './workloads/mssql/mssql-onprem-tco-operations';
import {
    uploadOracleTcoData,
    getOnPremisesOracleDatabaseResources
} from './workloads/oracle/oracle-onprem-tco-operations';
import { AssessmentCategories, SEVERITY } from '../utils/continous-optimization-consts';
import { MappedOnTapVolumeResponse } from '../utils/common-types';
import { paginateListInstanceConfigData } from './database/instance-config-operations';
import { countDatabaseInstances, getGroupedDatabaseInstancesBySeverity, groupResources } from '../lib/database/db';
import { GroupedDatabaseInstancesBySeverityResult } from '../lib/database/db-types';
import { IS_DEMO_FLOW, isDemoFlow, hyphenatedToPascalCaseWithSpace } from '../utils/utils';
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

    await prepopulateOfflineAssessmentData(accountId);
    const oracleResource = await getOnPremisesOracleDatabaseResources(accountId);
    if (oracleResource.count === 0) {
        uploadOracleTcoData(accountId, oracleStandaloneUploadObject.fileName, oracleStandaloneUploadObject.fileContent);
        uploadOracleTcoData(accountId, oracleDataGuardUploadObject.fileName, oracleDataGuardUploadObject.fileContent);
        uploadOracleTcoData(accountId, oracleMultiDBUploadObject.fileName, oracleMultiDBUploadObject.fileContent);
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
//     severity: "medium"
//   }
// ]
interface FocusItem {
    key: string;
    label: string;
    description: string;
    count: number;
    resources: { name: string }[];
}

interface FocusStatusResponseItem {
    description: string;
    label?: string;
    key?: string;
    resources?: { name: string }[];
}

interface FocusStatusResponse {
    severity: 'low' | 'medium' | 'high' | 'info';
    totalItems: number;
    noAnalysis?: boolean;
    items: FocusStatusResponseItem[];
}

function getLimitedItems(objects: GroupedDatabaseInstancesBySeverityResult[], limit = 0): FocusItem[] {
    const mapped = objects.map(obj => {
        const originalName = obj.name?.toString() || '';
        const recommendation = focusWidgetNameMap.get(originalName) || '';
        const displayLabel = originalName.includes('-') ? hyphenatedToPascalCaseWithSpace(originalName) : originalName;

        return {
            key: originalName,
            label: displayLabel,
            description: recommendation || displayLabel,
            count: obj.count,
            rawResourceNames: obj.resourceNames
        };
    });

    const grouped: Record<
        string,
        { key: string; label: string; description: string; count: number; resources: Set<string> }
    > = {};
    mapped.forEach(obj => {
        if (obj.key) {
            if (!grouped[obj.key]) {
                grouped[obj.key] = {
                    key: obj.key,
                    label: obj.label,
                    description: obj.description,
                    count: 0,
                    resources: new Set()
                };
            }
            grouped[obj.key].count += Number(obj.count) || 0;
            if (obj.rawResourceNames) {
                obj.rawResourceNames.split(',').forEach(rn => grouped[obj.key].resources.add(rn));
            }
        }
    });

    const uniqueItems = Object.values(grouped)
        .map(({ key, label, description, count, resources }) => ({
            key,
            label,
            description,
            count,
            resources: [...resources].sort().map(name => ({ name }))
        }))
        .sort((a, b) => b.count - a.count);

    if (!limit || uniqueItems.length <= limit) {
        return uniqueItems;
    }

    return uniqueItems.slice(0, limit);
}

function formatDescription(items: FocusItem[]) {
    return items.map(({ key, label, description, resources }) => ({ description, label, key, resources }));
}

async function getFocusStatus(
    accountId: string,
    credentialsIds?: string,
    regions?: string,
    limit?: number
): Promise<FocusStatusResponse> {
    logger.info('Getting focus status for account.', accountId, credentialsIds, regions, limit);
    // Always send only one severity. Sort the documents based on severity and send the top ones.
    // Priority is high > medium > low > info (assessment not run)
    // limit is applied on the number of items to be sent in the response not on the totalItems
    // e.g., if there are 10 high severity items and limit is 5, send only 5 high severity items, totalItems will be 10

    const credentialsIdList = credentialsIds?.split(',').map(id => id.trim());
    const regionList = regions?.split(',').map(region => region.trim());
    const [groupedDatabaseInstances, assessedInstanceCount] = await Promise.all([
        getGroupedDatabaseInstancesBySeverity({
            accountId,
            credentialsIdList,
            regionList
        }),
        countDatabaseInstances(accountId, credentialsIdList, regionList, undefined, { assessmentResults: true })
    ]);

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
            severity: 'medium',
            totalItems
        };
    }

    if (!isDemoFlow() && assessedInstanceCount?._count?.id === 0) {
        return {
            items: [
                {
                    description: 'No databases well-architected issues analysis performed'
                }
            ],
            severity: 'info',
            noAnalysis: true,
            totalItems: 0
        };
    }

    if (IS_DEMO_FLOW) {
        return {
            items: [
                {
                    label: 'Enable thin provisioning',
                    description: 'Enable thin provisioning for optimal storage efficiency',
                    key: 'thin-provisioning',
                    resources: [{ name: 'sqlnode1' }, { name: 'sqlnode2' }]
                },
                {
                    label: 'Enable volume autogrow',
                    description: 'Enable volume autogrow to prevent storage capacity issues',
                    key: 'volume-autogrow',
                    resources: [{ name: 'sqlnode1' }, { name: 'oraclenode1' }]
                },
                {
                    label: 'Disable fractional reserve',
                    description: 'Disable fractional reserve to maximize usable capacity',
                    key: 'fractional-reserve',
                    resources: [{ name: 'sqlnode2' }]
                },
                {
                    label: 'Enable space allocation',
                    description: 'Enable space allocation for write failure notification',
                    key: 'space-allocation',
                    resources: [{ name: 'oraclenode1' }, { name: 'oraclenode2' }]
                },
                {
                    label: 'Enable Multipath I/O',
                    description: 'Enable Multipath I/O for iSCSI storage resilience',
                    key: 'multipath-io',
                    resources: [{ name: 'sqlnode1' }]
                }
            ],
            severity: 'medium',
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
