import { compact, isEmpty, partition, uniqBy } from 'lodash-es';
import { DATABASE_TYPE } from '@prisma/client';
import getLogger from '../utils/logger';
import { getCredentials } from './cloud-manager/credentials-operations';
import { creadteDemoDBData, prepopulateOfflineAssessmentData } from '../utils/demo-utils/demoDefaultUtils';
import { DatabaseTypes, MSSQL, GOV_ACCOUNT } from '../utils/consts';
import { getAsyncLocalStorageResource } from '../utils/async-local-storage';
import getAiLimiterConfig from '../lib/cloud-manager/ai-limiter';
import {
    onPremAOAGAUploadObject,
    onPremFCIUploadObject,
    onpremStdUploadObject,
    oracleStandaloneUploadObject,
    oracleDataGuardUploadObject,
    oracleMultiDBUploadObject,
    DEMO_FOCUS_WAD_ITEMS,
    DEMO_FOCUS_EVENT_ITEMS
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
import { MSSQL_ERROR_PATTERN, SEVERITIES, MSSQL_SEVERITY_RANGE } from '../utils/logs-analyzer/logs-analyzer-consts';
import { getLatestReportsForWidget } from '../lib/database/logs-analysis-reports';

const logger = getLogger();
const focusWidgetNameMap = generateFocusWidgetNameMap();
const DEFAULT_WIDGET_LIMIT = 4;

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
    engineType: string;
    resources: { name: string }[];
}

interface FocusStatusResponseItem {
    description: string;
    label?: string;
    key?: string;
    path?: string;
    resources?: Array<{ name: string; href?: string }>;
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
            key: displayLabel,
            label: displayLabel,
            description: recommendation || displayLabel,
            count: obj.count,
            engineType: obj.engineType || '',
            rawResourceNames: obj.resourceNames
        };
    });

    const grouped: Record<
        string,
        { key: string; label: string; description: string; count: number; engineType: string; resources: Set<string> }
    > = {};
    mapped.forEach(obj => {
        if (obj.key) {
            if (!grouped[obj.key]) {
                grouped[obj.key] = {
                    key: obj.key,
                    label: obj.label,
                    description: obj.description,
                    count: 0,
                    engineType: obj.engineType,
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
        .map(({ key, label, description, count, engineType, resources }) => ({
            key,
            label,
            description,
            count,
            engineType,
            resources: [...resources].sort().map(name => ({ name }))
        }))
        .sort((a, b) => b.count - a.count);

    if (!limit || uniqueItems.length <= limit) {
        return uniqueItems;
    }

    return uniqueItems.slice(0, limit);
}

function formatDescription(items: FocusItem[]) {
    return items.map(({ key, label, description, engineType, resources }) => ({
        description,
        label,
        key,
        path: `/databases/well-architected/configName/${encodeURIComponent(key)}/engineType/${engineType}`,
        resources
    }));
}

async function getFocusWadStatus(
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

    if (isDemoFlow()) {
        const demoLimit = limit || DEFAULT_WIDGET_LIMIT;
        const items = DEMO_FOCUS_WAD_ITEMS.slice(0, demoLimit);
        return {
            items,
            severity: 'medium',
            totalItems: items.length
        };
    }

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

    if (assessedInstanceCount?._count?.id === 0) {
        return {
            items: [],
            severity: 'info',
            noAnalysis: true,
            totalItems: 0
        };
    }

    return {
        items: [],
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

const SEVERITY_PRIORITY = [SEVERITIES.CRITICAL, SEVERITIES.SEVERE, SEVERITIES.IMPORTANT] as const;

const LOGS_SEVERITY_TO_FOCUS_SEVERITY: Record<string, string> = {
    [SEVERITIES.CRITICAL]: 'high',
    [SEVERITIES.SEVERE]: 'high',
    [SEVERITIES.IMPORTANT]: 'medium'
};

function buildOracleDescription(error: string): string {
    const stripped = error.replace(/^ORA-\d+:\s*/, '');
    return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

function buildErrorKey(databaseType: string, error: string, errorCode?: string): string | undefined {
    if (databaseType === DATABASE_TYPE.mssql) {
        const match = MSSQL_ERROR_PATTERN.exec(error);
        if (match?.groups?.errorCode) {
            const { errorCode: code, severity, state } = match.groups;
            return `Error: ${code}, Severity: ${severity}, State: ${state}`;
        }
        if (match?.groups?.keyword && match?.groups?.message) {
            const { keyword, message } = match.groups;
            const capitalised = keyword.charAt(0).toUpperCase() + keyword.slice(1);
            return `${capitalised}: ${message.trim()}`;
        }
    }
    if (databaseType === DATABASE_TYPE.oracle) {
        const oraMatch = /^(ORA-\d+)/.exec(error);
        return errorCode ?? oraMatch?.[1];
    }
    return errorCode;
}

function normalizeSeverity(rawSeverity?: string): string {
    if (!rawSeverity) {
        return SEVERITIES.IMPORTANT;
    }
    const lowerCaseSeverity = rawSeverity.toLowerCase();

    // Oracle or already-named severities
    if ([SEVERITIES.CRITICAL, SEVERITIES.SEVERE, SEVERITIES.IMPORTANT].includes(lowerCaseSeverity)) {
        return lowerCaseSeverity;
    }

    // MSSQL: numeric string — use MSSQL_SEVERITY_RANGE thresholds
    const severityToNumber = Number(rawSeverity);
    if (!Number.isNaN(severityToNumber)) {
        if (severityToNumber >= MSSQL_SEVERITY_RANGE[SEVERITIES.CRITICAL].start) {
            return SEVERITIES.CRITICAL;
        }
        if (severityToNumber >= MSSQL_SEVERITY_RANGE[SEVERITIES.SEVERE].start) {
            return SEVERITIES.SEVERE;
        }
        return SEVERITIES.IMPORTANT;
    }

    return SEVERITIES.IMPORTANT;
}

async function getLogsAnalysisStatus(
    accountId: string,
    credentialsIds?: string,
    regions?: string,
    limit?: number
): Promise<FocusStatusResponse> {
    logger.info('Getting logs analysis status for account', { accountId, credentialsIds, regions, limit });

    const credentialsIdList = compact(credentialsIds?.split(',').map(id => id.trim()));
    const regionList = compact(regions?.split(',').map(r => r.trim()));

    if (isDemoFlow()) {
        const demoLimit = limit || DEFAULT_WIDGET_LIMIT;
        const items = DEMO_FOCUS_EVENT_ITEMS.slice(0, demoLimit);
        return {
            items,
            severity: 'medium',
            totalItems: items.length
        };
    }

    const rows = await getLatestReportsForWidget(accountId, credentialsIdList, regionList);

    if (isEmpty(rows)) {
        return {
            items: [],
            severity: 'info',
            noAnalysis: true,
            totalItems: 0
        };
    }

    const errorMap = new Map<
        string,
        {
            description: string;
            key?: string;
            count: number;
            severity: string;
            resources: Map<
                string,
                {
                    credentialsId: string;
                    region: string;
                    hostId: string;
                    instanceId: string;
                    engineType: string;
                    hostname: string;
                    dbInstanceName: string;
                }
            >;
        }
    >();

    for (const row of rows) {
        const {
            recommendations = [],
            database_type: engineType,
            database_instance_id: instanceId,
            credentials_id: credentialsId,
            region,
            resource_id: hostId,
            database_instance_name: dbInstanceName,
            hostname
        } = row;

        const validRecommendations = recommendations.filter(rec => rec.uniqueErrorKey || rec.error || rec.errorCode);

        for (const rec of validRecommendations) {
            const { uniqueErrorKey, errorCode, error, severity, cause } = rec;
            const mapKey = uniqueErrorKey ?? errorCode ?? error;
            const existing = errorMap.get(mapKey);
            const normalizedSeverity = normalizeSeverity(severity);
            const key = buildErrorKey(engineType, error, errorCode);

            const resourceContext = {
                credentialsId,
                region,
                hostId,
                instanceId,
                engineType,
                hostname,
                dbInstanceName
            };

            if (!existing) {
                errorMap.set(mapKey, {
                    description:
                        engineType === DATABASE_TYPE.mssql
                            ? cause || error
                            : ((buildOracleDescription(error) || cause) as string),
                    key,
                    count: 1,
                    severity: normalizedSeverity,
                    resources: new Map([[instanceId, resourceContext]])
                });
            } else {
                existing.count += 1;
                existing.resources.set(instanceId, resourceContext);
            }
        }
    }

    const uniqueErrors = Array.from(errorMap.values());

    // If no errors found after filtering, return "analysis ran with no errors" response
    if (isEmpty(uniqueErrors)) {
        return {
            items: [],
            severity: 'low',
            totalItems: 0
        };
    }

    const totalItems = uniqueErrors.length;

    const topSeverity =
        SEVERITY_PRIORITY.find(level => uniqueErrors.some(e => e.severity === level)) ?? SEVERITIES.IMPORTANT;
    const focusSeverity = LOGS_SEVERITY_TO_FOCUS_SEVERITY[topSeverity] ?? 'medium';

    const sortedErrors = uniqueErrors.sort((a, b) => {
        const severityDiff = SEVERITY_PRIORITY.indexOf(a.severity) - SEVERITY_PRIORITY.indexOf(b.severity);
        return severityDiff !== 0 ? severityDiff : b.count - a.count;
    });
    const limitedErrors = limit && limit > 0 ? sortedErrors.slice(0, limit) : sortedErrors;

    const items = limitedErrors.map(({ description, key, resources }) => ({
        description,
        label: key,
        key,
        resources: [...resources.values()]
            .sort((a, b) => a.dbInstanceName.localeCompare(b.dbInstanceName))
            .map(context => {
                const { credentialsId, region, hostId, instanceId, engineType, hostname, dbInstanceName } = context;
                return {
                    name: dbInstanceName,
                    href: `/databases/inventory/cred/${credentialsId}/region/${region}/databaseHost/${hostId}/databaseInstance/${instanceId}/logAnalyzerStatus/active/engineType/${engineType}/hostname/${encodeURIComponent(
                        hostname
                    )}/dbInstanceName/${encodeURIComponent(dbInstanceName)}`
                };
            })
    }));

    return { severity: focusSeverity as FocusStatusResponse['severity'], totalItems, items };
}

async function getAccountInfo(accountId: string) {
    const isGovAccount = getAsyncLocalStorageResource<boolean>(GOV_ACCOUNT) ?? false;
    const { aiAnalysisEnabled } = await getAiLimiterConfig(accountId);
    logger.info('Get account info', { accountId, isGovAccount, aiAnalysisEnabled });
    return { isGovAccount, aiAnalysisEnabled };
}

export {
    getSystemStatus,
    getDatabaseVolumes,
    getFocusWadStatus,
    getLogsAnalysisStatus,
    getWidgetStatus,
    getAccountInfo,
    DEFAULT_WIDGET_LIMIT
};
