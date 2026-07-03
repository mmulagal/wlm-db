import {
    DBType,
    GETWELL_STATUS,
    WAD_EXCLUDED_FLAT_CONFIG_IDS_MSSQL,
    WAD_EXCLUDED_FLAT_CONFIG_IDS_ORACLE,
    CONFIG_NAMES
} from '../../utils/consts';
import {
    AssessmentMetadata,
    AssessmentResponseInterface,
    DismissedConfigurationItem,
    HostAssessmentResponseInterface,
    PerConfigInterface
} from '../../utils/types/getWellTypes';

export type AssessmentItemFilter = {
    type?: string;
    subType?: string;
    id?: string;
    focusWidgetName?: string;
};

type HostAssessmentData = {
    instancesAssessment?: Array<HostAssessmentResponseInterface | null | undefined>;
};

const isDismissedConfigurationList = (
    value: AssessmentResponseInterface['dismissedConfigurations']
): value is DismissedConfigurationItem[] => Array.isArray(value);

export const getAssessmentMetadata = (instanceAssessments?: AssessmentResponseInterface | null): AssessmentMetadata =>
    instanceAssessments?.metadata ?? {};

export const getLastAssessmentTimestamp = (
    instanceAssessments?: AssessmentResponseInterface | null
): number | string | undefined => getAssessmentMetadata(instanceAssessments).lastAssessmentTimestamp;

export const hasAssessmentTimestamp = (instanceAssessments?: AssessmentResponseInterface | null): boolean =>
    !!getLastAssessmentTimestamp(instanceAssessments);

export const getAssessmentItems = (
    instanceAssessments?: AssessmentResponseInterface | null,
    filter?: AssessmentItemFilter
): PerConfigInterface[] => {
    const items = Array.isArray(instanceAssessments?.assessments) ? instanceAssessments.assessments : [];

    if (!filter) {
        return items;
    }

    return items.filter(item => {
        if (filter.id && item.id !== filter.id) {
            return false;
        }
        if (filter.type && item.type !== filter.type) {
            return false;
        }
        if (filter.subType && item.subType !== filter.subType) {
            return false;
        }
        if (filter.focusWidgetName && item.focusWidgetName !== filter.focusWidgetName) {
            return false;
        }
        return true;
    });
};

export const getAssessmentById = (
    instanceAssessments: AssessmentResponseInterface | null | undefined,
    id: string
): PerConfigInterface | undefined => getAssessmentItems(instanceAssessments, { id })[0];

/**
 * Searches all instances across the given host assessment array and returns the first
 * flat assessment item whose id matches configId.
 * Use this to read display metadata (name, categories, recommendation) directly from
 * the API response instead of going through the intermediate config catalog.
 */
export const findFlatConfigItem = (
    hosts: HostAssessmentData[] | null | undefined,
    configId: string
): PerConfigInterface | undefined => {
    const allInstances = (hosts ?? []).flatMap(host => host.instancesAssessment ?? []);

    const matchingInst = allInstances.find(
        (instance): instance is HostAssessmentResponseInterface =>
            !!instance && !!getAssessmentById(instance.assessments, configId)
    );

    return matchingInst ? getAssessmentById(matchingInst.assessments, configId) : undefined;
};

export const getAssessmentItemsByType = (
    instanceAssessments: AssessmentResponseInterface | null | undefined,
    type: string
): PerConfigInterface[] => getAssessmentItems(instanceAssessments, { type });

export const getDismissedConfigurations = (
    instanceAssessments?: AssessmentResponseInterface | null
): DismissedConfigurationItem[] => {
    if (!isDismissedConfigurationList(instanceAssessments?.dismissedConfigurations)) {
        return [];
    }

    return instanceAssessments.dismissedConfigurations;
};

export const getDismissedConfig = (
    instanceAssessments: AssessmentResponseInterface | null | undefined,
    configId: string
): DismissedConfigurationItem | undefined =>
    getDismissedConfigurations(instanceAssessments).find(dismissed => dismissed.id === configId);

export const mapAssessmentSeverityToFilterLabel = (severity?: string): string => {
    if (severity?.toLowerCase() === 'critical') {
        return GETWELL_STATUS.CRITICAL;
    }
    if (severity?.toLowerCase() === 'warning') {
        return GETWELL_STATUS.WARNING;
    }
    return severity ?? '';
};

export const isWadExcludedAssessmentConfigId = (configId: string, isWad: boolean, dbType?: string): boolean => {
    if (!isWad) {
        return false;
    }

    const excludedIds =
        dbType === DBType.ORACLE ? WAD_EXCLUDED_FLAT_CONFIG_IDS_ORACLE : WAD_EXCLUDED_FLAT_CONFIG_IDS_MSSQL;
    return excludedIds.has(configId);
};

export type DashboardTableConfig = {
    configId: string;
    configName: string;
    dismissConfigName: string;
    isFixSupported: boolean;
    dataMapping: (item: PerConfigInterface, instanceData?: HostAssessmentResponseInterface) => Record<string, unknown>;
    customColumns: Array<Record<string, unknown>>;
};

/** Table config for fix-page rows keyed by API assessment item id. */
// TODO: Fix this function it as part of dismiss workflow mirgration. use id and name instead of configurationName.
export const createDashboardTableConfig = (configId: string): DashboardTableConfig => ({
    configId,
    configName: configId,
    dismissConfigName: configId,
    isFixSupported: true,
    dataMapping: (item: PerConfigInterface) => ({
        totalObjectsAssessed: item?.totalObjectsAssessed,
        totalObjectsInViolation: item?.totalObjectsInViolation,
        violationDetails: item?.violationDetails || [],
        objectsInViolation: item?.objectsInViolation || [],
        sizingViolations: (item as { sizingViolations?: Record<string, unknown> }).sizingViolations,
        cloneDetails: (item as { cloneDetails?: unknown[] }).cloneDetails,
        ec2InterfacesToFix: (item as { ec2InterfacesToFix?: unknown[] }).ec2InterfacesToFix,
        missingPermissions: (item as { missingPermissions?: unknown[] }).missingPermissions,
        recommendationOptions: (item as { recommendationOptions?: unknown[] }).recommendationOptions,
        recommendedSizeInGib: (item as { recommendedSizeInGib?: number }).recommendedSizeInGib,
        tags: item?.tags ?? item?.categories,
        severity: item?.severity,
        configurationName: item.id ?? configId,
        configItem: item
    }),
    customColumns: []
});

export type ConfigStatsBucket = {
    optimized: number;
    dismissed: number;
    activating: number;
    total: number;
    partiallyDismissed?: number;
};

const getEngineConfigStatsMap = (
    configData: Record<string, unknown> | null | undefined,
    dbType?: string
): Record<string, ConfigStatsBucket> | undefined =>
    (dbType === DBType.ORACLE ? configData?.oracleStats : configData?.mssqlStats) as
        | Record<string, ConfigStatsBucket>
        | undefined;

const getEngineConfigStateMap = (
    configData: Record<string, unknown> | null | undefined,
    dbType?: string
): Record<string, string[]> | undefined =>
    (dbType === DBType.ORACLE ? configData?.oracleConfigState : configData?.mssqlConfigState) as
        | Record<string, string[]>
        | undefined;

const getEngineConfigSeverityMap = (
    configData: Record<string, unknown> | null | undefined,
    dbType?: string
): Record<string, string> | undefined =>
    (dbType === DBType.ORACLE ? configData?.oracleSeverityObj : configData?.mssqlSeverityObj) as
        | Record<string, string>
        | undefined;

/** Per-engine stats for a config id (MSSQL vs Oracle buckets are separate). */
export const getConfigStatsBucket = (
    configData: Record<string, unknown> | null | undefined,
    configId: string,
    dbType?: string
): ConfigStatsBucket | undefined => getEngineConfigStatsMap(configData, dbType)?.[configId];

export const getConfigStateList = (
    configData: Record<string, unknown> | null | undefined,
    configId: string,
    dbType?: string
): string[] => getEngineConfigStateMap(configData, dbType)?.[configId] || [];

export const getConfigSeverity = (
    configData: Record<string, unknown> | null | undefined,
    configId: string,
    dbType?: string
): string => getEngineConfigSeverityMap(configData, dbType)?.[configId] || '';

export const hasConfigStats = (
    configData: Record<string, unknown> | null | undefined,
    configId: string,
    dbType?: string
): boolean => !!getConfigStatsBucket(configData, configId, dbType);

/** Normalize fix-page/config type to API assessment item id. */
export const resolveConfigTypeId = (configType: string): string => {
    if (configType in CONFIG_NAMES) {
        return configType;
    }

    const matchedEntry = Object.entries(CONFIG_NAMES).find(([, displayName]) => displayName === configType);
    return matchedEntry?.[0] ?? configType;
};

/** Normalize fix-page/config type to legacy display name used by optimize/dismiss switches. */
export const resolveConfigDisplayName = (configType: string): string => {
    const configId = resolveConfigTypeId(configType);
    return CONFIG_NAMES[configId as keyof typeof CONFIG_NAMES] || configType;
};

/** Map API config id to legacy dialog switch key (display name or kebab id). */
export const resolveImpactedResourceConfigName = (configName?: string): string => {
    if (!configName) {
        return '';
    }

    return resolveConfigDisplayName(configName);
};

type ImpactedResourceDialogData = {
    violationDetails?: Array<Record<string, unknown>>;
    objectsInViolation?: unknown[];
    sizingViolations?: Record<string, unknown>;
    configItem?: PerConfigInterface;
    configurationName?: string;
    configObj?: { configurationName?: string };
    name?: string;
    recommended?: string;
    [key: string]: unknown;
};

/**
 * The dashboard table's dataMapping only promotes common fields (violationDetails,
 * objectsInViolation, etc.) to the row level. Config-specific fields such as
 * rssAdapters, sizingViolations, cloneDetails, and tcpOffloadState are not copied
 * — they remain inside configItem (the raw API assessment item stored on the row).
 *
 * This function unpacks those fields so the ImpactedResourceDialog can access
 * everything at the top level without reaching into configItem directly.
 * Row-level values always win; configItem is the fallback for fields that
 * the dataMapping override did not explicitly lift.
 */
export const normalizeImpactedResourceDialogData = <T extends ImpactedResourceDialogData>(data: T): T => {
    const { configItem } = data;
    if (!configItem) {
        return data;
    }

    const extendedItem = configItem as {
        rssAdapters?: unknown[];
        recommendedAdapterSettings?: Record<string, unknown>;
        tcpOffloadState?: string;
        sizingViolations?: Record<string, unknown>;
        cloneDetails?: unknown[];
        ec2InterfacesToFix?: unknown[];
        recommended?: string;
    };

    return {
        ...data,
        violationDetails: data.violationDetails?.length ? data.violationDetails : configItem.violationDetails,
        objectsInViolation: data.objectsInViolation?.length ? data.objectsInViolation : configItem.objectsInViolation,
        sizingViolations: data.sizingViolations || extendedItem.sizingViolations,
        cloneDetails: data.cloneDetails ?? extendedItem.cloneDetails,
        ec2InterfacesToFix: data.ec2InterfacesToFix ?? extendedItem.ec2InterfacesToFix,
        rssAdapters: data.rssAdapters ?? extendedItem.rssAdapters,
        recommendedAdapterSettings: data.recommendedAdapterSettings ?? extendedItem.recommendedAdapterSettings,
        tcpOffloadState: data.tcpOffloadState ?? extendedItem.tcpOffloadState,
        // Top-level fallback: some configs (e.g. autosize, thin-provision) only carry `recommended`
        // once at the config-item level rather than repeating it per violationDetails row.
        recommended: (data.recommended as string | undefined) ?? extendedItem.recommended
    };
};
