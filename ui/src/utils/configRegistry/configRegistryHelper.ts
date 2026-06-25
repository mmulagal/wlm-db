/**
 * Unified Config Registry Helper
 *
 * Single source of truth for all GetWell configId metadata.
 * Replaces the scattered Sets/Records/Maps in the old getWellConfigRegistry.ts.
 *
 * Pattern: two static JSON registries (MSSQL / Oracle) + typed accessor functions,
 * following the same approach as recommendations/recommendationsHelper.ts.
 */

import { t } from 'i18next';
import { ASSESSMENT_CONFIG_IDS, DBType, WELL_ARCHITECTED_STATUS } from '../consts';
import mssqlRegistry from './mssqlConfigRegistry.json';
import oracleRegistry from './oracleConfigRegistry.json';

// ============================================================================
// Type Definitions (same shapes as old getWellConfigRegistry.ts)
// ============================================================================

export interface CardHeights {
    recommendationSection: string;
    tagSection: string;
}

export interface CardMetadata {
    impactedLabel: string;
    countSource?: 'impactedCount' | 'totalObjectsInViolation';
    recommendationSource?: string;
}

export interface ColumnConfig {
    columns: Array<{
        key: string;
        label: string;
        accessor?: string;
        width?: string;
    }>;
    resourceTypeLabel?: string;
    tableTitle?: string;
    useNestedExpandable?: boolean;
    hasSubConfigs?: boolean;
}

export type OptimizeApiMutation =
    | 'optimizeStorageConfig'
    | 'optimizeOracleStorageConfig'
    | 'optimizeOracleStorageLayoutAsm'
    | 'optimizeOracleOperatingSystem'
    | 'optimizeOperatingSystemForBulk'
    | 'optimizeStorageSizingForBulk'
    | 'optimizeStorageTierForBulk'
    | 'optimizeComputeConfigForBulk'
    | 'optimizeMaxdopConfigForBulk'
    | 'optimizeMTUConfigForBulk'
    | 'optimizeResiliency'
    | 'optimizeAwsBackup'
    | 'optimizeCloneCleanup'
    | 'optimizeHAMssql';

export type PayloadScope = 'credential-scoped' | 'bulk';

export interface OptimizeApiConfig {
    mutation: OptimizeApiMutation;
    payloadScope: PayloadScope;
    apiConfigName?: string;
    haUrlSegment?: string;
    oracleOsType?: 'storage-operating-system' | 'compute-host-os' | 'storage-sizing' | 'aws-backup' | 'clone';
    usesConfigNameArray?: boolean;
    statusType: string;
    supportsDashboardBulk: boolean;
}

export type DialogSectionType = 'text' | 'bullets' | 'numberedSteps' | 'codeBox' | 'permissions' | 'table' | 'select';

export interface DialogSectionDef {
    heading: string;
    type: DialogSectionType;
    content?: string;
    items?: string[];
    params?: Record<string, string>;
    hideWhenWad?: boolean;
    style?: { width?: string };
}

export interface DialogContentConfig {
    sections: DialogSectionDef[];
    features?: {
        showOntapConfigCodeBox?: boolean;
        showLinkedConfigBanner?: boolean;
        showPatchTable?: boolean;
        showInstanceSelector?: boolean;
        showCustomBackupUI?: boolean;
        patchField?: string;
    };
    wellArchitectedConfig?: string | string[];
    notes?: {
        type: 'standard' | 'os' | 'failover' | 'clusterQuorum' | 'driveLetter' | 'custom';
        content?: string;
        items?: string[];
    };
    conditionalOverrides?: Array<{
        when: { field: string; equals: string };
        sections: DialogSectionDef[];
        notes?: DialogContentConfig['notes'];
    }>;
}

export interface ConfigEntry {
    hasInnerPage: boolean;
    viewOnly: boolean;
    fixSupported: boolean;
    cardHeights?: CardHeights;
    cardMetadata?: CardMetadata;
    columns?: ColumnConfig;
    optimizeApi?: OptimizeApiConfig;
    dialogContent?: DialogContentConfig;
    linkedConfigGroup?: 'layout' | 'ontap';
    statusDependentFix?: boolean;
}

// ============================================================================
// Registry access
// ============================================================================

type RegistryMap = Record<string, ConfigEntry>;

const registries: Record<string, RegistryMap> = {
    [DBType.ORACLE]: oracleRegistry as unknown as RegistryMap,
    [DBType.MSSQL]: mssqlRegistry as unknown as RegistryMap
};

const getRegistry = (dbType: string): RegistryMap => registries[dbType] || (mssqlRegistry as unknown as RegistryMap);

/** Retrieve the full config entry for a given configId and engine type. */
export const getConfigEntry = (configId: string, dbType: string): ConfigEntry | undefined =>
    getRegistry(dbType)[configId];

// ============================================================================
// Defaults
// ============================================================================

const DEFAULT_CARD_HEIGHTS: CardHeights = {
    recommendationSection: '160px',
    tagSection: '256px'
};

const DEFAULT_CARD_METADATA: CardMetadata = {
    impactedLabel: 'Impacted objects',
    countSource: 'totalObjectsInViolation'
};

// ============================================================================
// Accessor functions (same signatures as old getWellConfigRegistry.ts)
// ============================================================================

/** Whether a config opens an inner page (true) or a dialog (false). */
export const hasInnerPage = (configId: string, dbType: string): boolean =>
    getRegistry(dbType)[configId]?.hasInnerPage ?? false;

/**
 * Button text for a config card.
 * Special case: file-system-headroom / headroom depends on status.
 */
export const getButtonText = (configId: string, dbType: string, status?: string): string => {
    // Normalize status to lowercase and replace spaces with hyphens
    const normalizedStatus = status?.toLowerCase().replace(/\s+/g, '-');

    if (
        (configId === ASSESSMENT_CONFIG_IDS.FILE_SYSTEM_HEADROOM ||
            configId === ASSESSMENT_CONFIG_IDS.FILE_SYSTEM_HEADROOM_MSSQL) &&
        normalizedStatus
    ) {
        if (normalizedStatus === WELL_ARCHITECTED_STATUS.OVER_PROVISIONED) return t('databases.general.view');
        if (normalizedStatus === WELL_ARCHITECTED_STATUS.UNDER_PROVISIONED) return t('databases.general.view-and-fix');
    }

    const entry = getRegistry(dbType)[configId];
    return entry?.viewOnly ? t('databases.general.view') : t('databases.general.view-and-fix');
};

/** True when a config's button should say "View" (read-only, no fix). */
export const isViewOnlyConfig = (configId: string, dbType: string): boolean =>
    getRegistry(dbType)[configId]?.viewOnly ?? false;

/**
 * Whether automatic fix is supported for a config.
 * Preserves runtime special-case logic for headroom, log-drive-size, tempdb-drive-size.
 */
export const hasFixSupport = (
    configId: string,
    dbType: string,
    status?: string,
    missingPermissions?: string[]
): boolean => {
    // Normalize status to lowercase and replace spaces with hyphens
    const normalizedStatus = status?.toLowerCase().replace(/\s+/g, '-');

    if (configId === 'headroom' || configId === 'file-system-headroom') {
        // Over-provisioned headroom cannot be fixed
        if (normalizedStatus === 'over-provisioned') return false;
        // Under-provisioned headroom with missing permissions cannot be fixed
        if (normalizedStatus === 'under-provisioned' && missingPermissions && missingPermissions.length > 0)
            return false;
        // For Oracle, headroom is fixable
        // For MSSQL, check registry entry
        if (dbType === DBType.ORACLE) return true;
    }

    if (
        (configId === 'log-drive-size' || configId === 'tempdb-drive-size') &&
        normalizedStatus === 'under-provisioned' &&
        missingPermissions &&
        missingPermissions.length > 0
    ) {
        return false;
    }

    const entry = getRegistry(dbType)[configId];
    return entry?.fixSupported ?? true;
};

/** Card heights for a config. Returns config-specific or default. */
export const getCardHeights = (configId: string, dbType: string): CardHeights => {
    const entry = getRegistry(dbType)[configId];
    return entry?.cardHeights || DEFAULT_CARD_HEIGHTS;
};

/** Card metadata (impacted label, count source, recommendation source). */
export const getCardMetadata = (configId: string): CardMetadata => {
    // Card metadata is engine-agnostic in the old registry; try both
    const mssqlEntry = (mssqlRegistry as unknown as RegistryMap)[configId];
    const oracleEntry = (oracleRegistry as unknown as RegistryMap)[configId];
    return mssqlEntry?.cardMetadata || oracleEntry?.cardMetadata || DEFAULT_CARD_METADATA;
};

/** Column config for inner page tables. Undefined for dialog-only configs. */
export const getColumnConfig = (configId: string): ColumnConfig | undefined => {
    // Columns are engine-agnostic in the old registry; try both
    const mssqlEntry = (mssqlRegistry as unknown as RegistryMap)[configId];
    const oracleEntry = (oracleRegistry as unknown as RegistryMap)[configId];
    return mssqlEntry?.columns || oracleEntry?.columns;
};

/**
 * Builds `current` and `recommended` display strings for configs with nested sub-configs
 * (e.g. storage-efficiencies: compression/deduplication/compaction).
 */
export const buildSubConfigValues = (
    row: any,
    configDetails: Array<any> = []
): { current: string; recommended: string } => {
    const currentByName = new Map<string, string>((row?.violatedConfigs || []).map((c: any) => [c.id, c.current]));
    const dataCategory: string | undefined = row?.dataCategory;

    const entries = configDetails.map((cfg: any) => {
        const recommended =
            cfg.recommended || (dataCategory ? cfg.recommendedByDataCategory?.[dataCategory] : undefined) || '';
        const current = currentByName.get(cfg.id) || recommended;
        return { name: cfg.id, current, recommended };
    });

    return {
        current: entries.map(e => `${e.name}=${e.current}`).join(', '),
        recommended: entries.map(e => `${e.name}=${e.recommended}`).join(', ')
    };
};

/** Optimize API config for a configId + engine type. */
export const getOptimizeApiConfig = (configId: string, engineType: string): OptimizeApiConfig | undefined => {
    const registry =
        engineType === DBType.ORACLE
            ? (oracleRegistry as unknown as RegistryMap)
            : (mssqlRegistry as unknown as RegistryMap);
    return registry[configId]?.optimizeApi;
};

// Clone cleanup dialogs are keyed by action string, not configId
const CLONE_CLEANUP_DIALOGS: Record<string, DialogContentConfig> = {
    'Clone cleanup Delete': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.clone-delete-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.clone-delete-what-will-happen',
                hideWhenWad: true
            }
        ],
        notes: { type: 'standard' }
    },
    'Clone cleanup Refresh': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.clone-refresh-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.clone-refresh-what-will-happen',
                hideWhenWad: true
            }
        ],
        notes: { type: 'standard' }
    }
};

/** Dialog content config for a configId + engine type. Falls back to clone cleanup dialogs. */
export const getDialogContentConfig = (configId: string, engineType: string): DialogContentConfig | undefined => {
    let normalizedEngine = engineType;
    if (engineType === DBType.ORACLE) normalizedEngine = DBType.ORACLE;
    else if (engineType === DBType.MSSQL) normalizedEngine = DBType.MSSQL;
    const registry = getRegistry(normalizedEngine);
    return registry[configId]?.dialogContent || CLONE_CLEANUP_DIALOGS[configId];
};

// ============================================================================
// Linked config helpers (Oracle config dependencies)
// ============================================================================

/** Returns all configIds that belong to a given linked config group. */
export const getConfigIdsByLinkedGroup = (group: 'layout' | 'ontap'): string[] => {
    const registry = oracleRegistry as unknown as RegistryMap;
    return Object.entries(registry)
        .filter(([, entry]) => entry.linkedConfigGroup === group)
        .map(([id]) => id);
};
