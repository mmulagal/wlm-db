/**
 * GetWell Configuration Registry
 *
 * Centralized configuration map for GetWell flat structure that determines:
 * - Whether a configuration opens an inner page or dialog
 * - Button text (View vs View & Fix)
 * - Column definitions for inner page tables
 * - Fix support (Continue vs Close button in dialogs)
 *
 * All lookups are keyed by the flat API `id` field (e.g., 'autosize', 'compute-rightsizing')
 */

import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { DBType } from './consts';

// ============================================================================
// CARD HEIGHT CONSTANTS
// ============================================================================

/**
 * Card heights for recommendation and tag sections.
 * Configs with longer recommendation text need taller cards.
 */
export interface CardHeights {
    recommendationSection: string;
    tagSection: string;
}

/**
 * Oracle card height presets for different recommendation text lengths.
 * Used in ORACLE_CONFIG_CARD_HEIGHTS to assign heights to specific configs.
 */
export const ORACLE_CARD_HEIGHTS = {
    // Small height - Basic configurations
    SMALL: {
        recommendationSection: '160px',
        tagSection: '256px'
    },
    // Medium-Small height
    MEDIUM_SMALL: {
        recommendationSection: '170px',
        tagSection: '266px'
    },
    // Medium height
    MEDIUM: {
        recommendationSection: '180px',
        tagSection: '276px'
    },
    // Medium-Large height
    MEDIUM_LARGE: {
        recommendationSection: '190px',
        tagSection: '286px'
    },
    // Large height
    LARGE: {
        recommendationSection: '200px',
        tagSection: '296px'
    },
    // Default/Extra Large height
    DEFAULT: {
        recommendationSection: '210px',
        tagSection: '306px'
    }
} as const;

/**
 * MSSQL card height presets for different recommendation text lengths.
 * Used in MSSQL_CONFIG_CARD_HEIGHTS to assign heights to specific configs.
 */
export const MSSQL_CARD_HEIGHTS = {
    // Extra Small height
    EXTRA_SMALL: {
        recommendationSection: '140px',
        tagSection: '236px'
    },
    // Small height
    SMALL: {
        recommendationSection: '160px',
        tagSection: '256px'
    },
    // Medium height - HA configs
    MEDIUM: {
        recommendationSection: '180px',
        tagSection: '276px'
    },
    // Large height - Tiering configs
    LARGE: {
        recommendationSection: '260px',
        tagSection: '356px'
    },
    // Default height
    DEFAULT: {
        recommendationSection: '260px',
        tagSection: '356px'
    }
} as const;

// ============================================================================
// INNER PAGE vs DIALOG CONFIGURATION
// ============================================================================

/**
 * MSSQL configurations that have inner pages with tables (flat structure).
 * All other MSSQL configs open dialogs.
 *
 * Based on US 1 requirements, these individual flat configs have inner pages:
 */
export const MSSQL_INNER_PAGE_CONFIGS = new Set([
    'performance-tier',
    'log-drive-size',
    'tempdb-drive-size',
    'thin-provision',
    'autosize',
    'autosize-mode',
    'snapshot-copy-reserve',
    'snapshot-autodelete',
    'space-mgmt-try-first',
    'tiering-tco-optimization',
    'os-type',
    'block-device-space-management',
    'mpio-load-balance-policy',
    'ntfs-allocation-unit-size',
    'rss-config',
    'mtu-alignment',
    'snapshot-policy',
    'crr',
    'shared-storage',
    'clone-management',
    'storage-efficiencies',
    // MSSQL file location configs (use nested expandable tables via NestedDynamicInnerTable)
    'data-files-location',
    'log-files-location',
    'tempdb-files-location'
]);

/**
 * Oracle configurations that have inner pages with tables (flat structure).
 * All other Oracle configs open dialogs.
 *
 * Based on US 1 requirements, these individual flat configs have inner pages:
 */
export const ORACLE_INNER_PAGE_CONFIGS = new Set([
    'data-dg-lun-layout',
    'log-dg-lun-layout',
    'fra-dg-lun-layout',
    'oracle-binary-placement',
    'datafiles-placement',
    'controlfiles-placement',
    'redologs-placement',
    'templogs-placement',
    'archive-placement',
    'thin-provision',
    'autosize',
    'autosize-mode',
    'fractional-reserve',
    'snapshot-policy-vol',
    'snapshot-policy', // Alias - Oracle API may return this instead of snapshot-policy-vol
    'snapshot-copy-reserve',
    'snapshot-autodelete',
    'space-mgmt-try-first',
    'tiering-tco-optimization',
    'os-type',
    'block-device-space-management',
    'nfs-rootonly',
    'export-policy',
    'nfs-mount-options-databasefiles',
    'dnfs-configuration-file',
    'dnfs-no-shared-cache',
    'asm-external-redundancy',
    'crr',
    'snapcenter-snapshot',
    'clone-management',
    'storage-efficiencies'
]);

/**
 * Determines if a configuration has an inner page or opens a dialog.
 *
 * @param configId - The flat API config id (e.g., 'autosize', 'compute-rightsizing')
 * @param dbType - Database type (DBType.MSSQL or DBType.ORACLE)
 * @returns true if the config has an inner page, false if it opens a dialog
 */
export const hasInnerPage = (configId: string, dbType: string): boolean => {
    if (dbType === DBType.ORACLE) {
        return ORACLE_INNER_PAGE_CONFIGS.has(configId);
    }
    return MSSQL_INNER_PAGE_CONFIGS.has(configId);
};

// ============================================================================
// BUTTON TEXT CONFIGURATION
// ============================================================================

/**
 * MSSQL configurations that show "View" button (read-only).
 * All others show "View and fix" (actionable).
 */
const MSSQL_VIEW_ONLY_CONFIGS = new Set([
    'data-files-location',
    'log-files-location',
    'tempdb-files-location',
    'host-os-patch',
    'mssql-patch',
    'crr'
]);

/**
 * Oracle configurations that show "View" button (read-only).
 * All others show "View and fix" (actionable).
 */
const ORACLE_VIEW_ONLY_CONFIGS = new Set([
    'oracle-binary-placement',
    'datafiles-placement',
    'controlfiles-placement',
    'redologs-placement',
    'templogs-placement',
    'archive-placement',
    'asm-setup',
    'asm-external-redundancy',
    'asmlib-logical-block-size',
    'afd-logical-block-size',
    'nfs-mount-options-databasefiles',
    'nfs-mount-options-adrhome',
    'nfs-caching-options',
    'dnfs-enabled',
    'dnfs-configuration-file',
    'dnfs-no-shared-cache',
    'multipath-io',
    'swap-space',
    'filesystems-io-options',
    'host-os-patch',
    'oracle-security-patch',
    'crr',
    'snapcenter-snapshot'
]);

/**
 * Gets the button text for a configuration.
 *
 * @param configId - The flat API config id
 * @param dbType - Database type (DBType.MSSQL or DBType.ORACLE)
 * @param status - Optional status (for FILE_SYSTEM_HEADROOM special case: "Over provisioned" or "Under provisioned")
 * @returns Button text: "View and fix" or "View"
 */
export const getButtonText = (configId: string, dbType: string, status?: string): string => {
    // Special case: FILE_SYSTEM_HEADROOM depends on status
    if ((configId === 'file-system-headroom' || configId === 'File system headroom') && status) {
        if (status === 'Over provisioned') {
            return 'View'; // Read-only when over-provisioned
        }
        if (status === 'Under provisioned') {
            return 'View and fix'; // Actionable when under-provisioned
        }
    }

    const viewOnlySet = dbType === DBType.ORACLE ? ORACLE_VIEW_ONLY_CONFIGS : MSSQL_VIEW_ONLY_CONFIGS;

    if (viewOnlySet.has(configId)) {
        return 'View';
    }

    return 'View and fix';
};

// ============================================================================
// FIX SUPPORT CONFIGURATION
// ============================================================================

/**
 * MSSQL configurations that do NOT support automatic fix (Close button only in dialogs).
 */
const MSSQL_UNSUPPORTED_FIX_IDS = new Set([
    'host-os-patch',
    'mssql-patch',
    'drive-letter',
    'data-files-location',
    'log-files-location',
    'tempdb-files-location'
]);

/**
 * Oracle configurations that do NOT support   dialogs).
 */
const ORACLE_UNSUPPORTED_FIX_IDS = new Set([
    'host-os-patch',
    'swap-space',
    'oracle-security-patch',
    'redologs-placement',
    'templogs-placement',
    'archive-placement',
    'datafiles-placement',
    'controlfiles-placement',
    'oracle-binary-placement',
    'multipath-io',
    'filesystems-io-options',
    'asm-setup',
    'asm-external-redundancy',
    'afd-logical-block-size',
    'asmlib-logical-block-size',
    'nfs-mount-options-databasefiles',
    'nfs-mount-options-adrhome',
    'nfs-caching-options',
    'dnfs-enabled',
    'dnfs-configuration-file',
    'dnfs-no-shared-cache',
    'snapcenter-snapshot'
]);

/**
 * Determines if a configuration supports automatic fix.
 *
 * @param configId - The flat API config id
 * @param dbType - Database type (DBType.MSSQL or DBType.ORACLE)
 * @param status - Optional status (for headroom special cases)
 * @param missingPermissions - Optional array of missing permissions (for headroom/sizing)
 * @returns true if fix is supported (Continue button), false for Close button only
 */
export const hasFixSupport = (
    configId: string,
    dbType: string,
    status?: string,
    missingPermissions?: string[]
): boolean => {
    // Special cases for headroom
    if (configId === 'headroom') {
        if (status === 'over-provisioned') {
            return false; // View only, no fix
        }
        if (status === 'under-provisioned' && missingPermissions && missingPermissions.length > 0) {
            return false; // Need permissions first
        }
        // Under-provisioned with permissions OR other statuses
        return dbType === DBType.ORACLE; // Oracle can fix, MSSQL cannot
    }

    // Special cases for log/tempdb drive sizing with missing permissions
    if (
        (configId === 'log-drive-size' || configId === 'tempdb-drive-size') &&
        status === 'under-provisioned' &&
        missingPermissions &&
        missingPermissions.length > 0
    ) {
        return false;
    }

    // Check unsupported fix sets
    const unsupportedSet = dbType === DBType.ORACLE ? ORACLE_UNSUPPORTED_FIX_IDS : MSSQL_UNSUPPORTED_FIX_IDS;
    return !unsupportedSet.has(configId);
};

// ============================================================================
// COLUMN DEFINITIONS FOR INNER PAGE TABLES
// ============================================================================

export interface ColumnConfig {
    columns: Array<{
        key: string;
        label: string;
        accessor?: string;
        width?: string;
    }>;
    resourceTypeLabel?: string;
    tableTitle?: string;
    useNestedExpandable?: boolean; // For data/log/tempdb files that use expandable nested structure
    // When true, each row's `current`/`recommended` columns are derived from the config's nested
    // sub-configs (row.violatedConfigs + data.configDetails) via buildSubConfigValues().
    hasSubConfigs?: boolean;
}

/**
 * MSSQL-specific card height overrides for configs that need custom heights.
 * Most MSSQL configs use the default height (160px/256px).
 * Only configs with exceptionally long recommendation text are listed here.
 */
export const MSSQL_CONFIG_CARD_HEIGHTS: Record<string, CardHeights> = {
    // RSS has very long, detailed recommendation text
    'rss-config': {
        recommendationSection: '450px',
        tagSection: '546px'
    },

    // MSSQL configs with moderately longer recommendation text
    'log-drive-size': {
        recommendationSection: '228px',
        tagSection: '324px'
    },
    'tempdb-drive-size': {
        recommendationSection: '228px',
        tagSection: '324px'
    },

    // MSSQL configs with slightly longer text
    'mtu-alignment': {
        recommendationSection: '208px',
        tagSection: '304px'
    },
    'data-files-location': {
        recommendationSection: '208px',
        tagSection: '304px'
    },
    'log-files-location': {
        recommendationSection: '208px',
        tagSection: '304px'
    },
    'tempdb-files-location': {
        recommendationSection: '208px',
        tagSection: '304px'
    },

    // MSSQL - Storage tier and scheduled snapshot (Extra Small)
    'performance-tier': MSSQL_CARD_HEIGHTS.EXTRA_SMALL,
    'snapshot-policy': MSSQL_CARD_HEIGHTS.EXTRA_SMALL,

    // MSSQL - Clone management (smallest)
    'clone-management': {
        recommendationSection: '120px',
        tagSection: '216px'
    },

    // MSSQL - Shared configs with MSSQL-specific heights (Small - 160px/256px)
    'thin-provision': MSSQL_CARD_HEIGHTS.SMALL,
    'snapshot-copy-reserve': MSSQL_CARD_HEIGHTS.SMALL,
    'fractional-reserve': MSSQL_CARD_HEIGHTS.SMALL,
    'space-mgmt-try-first': MSSQL_CARD_HEIGHTS.SMALL,
    'os-type': MSSQL_CARD_HEIGHTS.SMALL,
    'space-reservation-enabled': MSSQL_CARD_HEIGHTS.SMALL,
    'space-allocation-allocated': MSSQL_CARD_HEIGHTS.SMALL
};

/**
 * Oracle-specific card height overrides for configs that need custom heights.
 * Most Oracle configs use the default height (160px/256px).
 * Only configs with exceptionally long recommendation text are listed here.
 */
export const ORACLE_CONFIG_CARD_HEIGHTS: Record<string, CardHeights> = {
    // Oracle - Long recommendation text (moderately longer)
    'archive-placement': {
        recommendationSection: '228px',
        tagSection: '324px'
    },
    'redologs-placement': {
        recommendationSection: '228px',
        tagSection: '324px'
    },

    // Oracle - Medium-long text
    'templogs-placement': {
        recommendationSection: '208px',
        tagSection: '304px'
    },
    'controlfiles-placement': {
        recommendationSection: '208px',
        tagSection: '304px'
    },

    // Oracle - Binary and datafiles (slightly larger than small)
    'oracle-binary-placement': {
        recommendationSection: '164px',
        tagSection: '260px'
    },
    'datafiles-placement': {
        recommendationSection: '164px',
        tagSection: '260px'
    },

    // Oracle - ASM layouts (compact)
    'data-dg-lun-layout': {
        recommendationSection: '134px',
        tagSection: '230px'
    },
    'log-dg-lun-layout': {
        recommendationSection: '134px',
        tagSection: '230px'
    },
    'fra-dg-lun-layout': {
        recommendationSection: '134px',
        tagSection: '230px'
    },
    'archivelog-dg-lun-layout': {
        recommendationSection: '134px',
        tagSection: '230px'
    },

    // Oracle - Shared configs with Oracle-specific heights (Small - 160px/256px)
    'thin-provision': ORACLE_CARD_HEIGHTS.SMALL,
    'snapshot-copy-reserve': ORACLE_CARD_HEIGHTS.SMALL,
    'fractional-reserve': ORACLE_CARD_HEIGHTS.SMALL,
    'space-mgmt-try-first': ORACLE_CARD_HEIGHTS.SMALL,
    'os-type': ORACLE_CARD_HEIGHTS.SMALL,
    'space-reservation-enabled': ORACLE_CARD_HEIGHTS.SMALL,
    'space-allocation-allocated': ORACLE_CARD_HEIGHTS.SMALL,
    'nfs-rootonly': ORACLE_CARD_HEIGHTS.SMALL,
    'export-policy': ORACLE_CARD_HEIGHTS.SMALL,

    // Oracle - Medium-Small height configs (170px/266px)
    'host-utilities': ORACLE_CARD_HEIGHTS.MEDIUM_SMALL,
    'iscsi-replacement-timeout': ORACLE_CARD_HEIGHTS.MEDIUM_SMALL,
    'multipath-friendly-names': ORACLE_CARD_HEIGHTS.MEDIUM_SMALL,
    'multipath-io-sessions': ORACLE_CARD_HEIGHTS.MEDIUM_SMALL,
    'kernel-parameters': ORACLE_CARD_HEIGHTS.MEDIUM_SMALL,
    'nfs-mount-options-databasefiles': ORACLE_CARD_HEIGHTS.MEDIUM_SMALL,
    'nfs-mount-options-adrhome': ORACLE_CARD_HEIGHTS.MEDIUM_SMALL,
    'nfs-caching-options': ORACLE_CARD_HEIGHTS.MEDIUM_SMALL,
    'nfsv4-domain-name': ORACLE_CARD_HEIGHTS.MEDIUM_SMALL,

    // Oracle - Medium height configs (180px/276px)
    'asm-external-redundancy': ORACLE_CARD_HEIGHTS.MEDIUM,
    'dnfs-configuration-file': ORACLE_CARD_HEIGHTS.MEDIUM,
    'dnfs-no-shared-cache': ORACLE_CARD_HEIGHTS.MEDIUM,

    // Oracle - Medium-Large height configs (190px/286px)
    'multipath-io': ORACLE_CARD_HEIGHTS.MEDIUM_LARGE,
    selinux: ORACLE_CARD_HEIGHTS.MEDIUM_LARGE,

    // Oracle - Large height configs (200px/296px)
    'multipath-configuration': ORACLE_CARD_HEIGHTS.LARGE
};

/**
 * Default card heights for configs not listed in CONFIG_CARD_HEIGHTS.
 */
export const DEFAULT_CARD_HEIGHTS: CardHeights = {
    recommendationSection: '160px',
    tagSection: '256px'
};

// ============================================================================
// CARD METADATA CONFIGURATION (for OptimizeCard display)
// ============================================================================

/**
 * Card metadata defines how config cards display:
 * - impactedLabel: Label for the impacted count (e.g., 'Impacted volumes', 'Impacted databases')
 * - countSource: Where to get the count from ('impactedCount' or 'totalObjectsInViolation')
 * - recommendationSource: Path to recommendation text in data object
 */
export interface CardMetadata {
    impactedLabel: string;
    countSource?: 'impactedCount' | 'totalObjectsInViolation';
    recommendationSource?: string; // Path like 'recommendationText' or 'recommendation.description'
}

/**
 * Card metadata overrides for configs that need custom labels or data sources.
 * Most configs use the default (generic 'Impacted objects').
 */
export const CONFIG_CARD_METADATA: Record<string, CardMetadata> = {
    // Oracle storage placement configs
    'oracle-binary-placement': {
        impactedLabel: 'Impacted volumes',
        countSource: 'impactedCount',
        recommendationSource: 'recommendationText'
    },
    'archive-placement': {
        impactedLabel: 'Impacted volumes',
        countSource: 'impactedCount',
        recommendationSource: 'recommendationText'
    },
    'redologs-placement': {
        impactedLabel: 'Impacted volumes',
        countSource: 'impactedCount',
        recommendationSource: 'recommendationText'
    },
    'templogs-placement': {
        impactedLabel: 'Impacted volumes',
        countSource: 'impactedCount',
        recommendationSource: 'recommendationText'
    },
    'controlfiles-placement': {
        impactedLabel: 'Impacted volumes',
        countSource: 'impactedCount',
        recommendationSource: 'recommendationText'
    },
    'datafiles-placement': {
        impactedLabel: 'Impacted volumes',
        countSource: 'impactedCount',
        recommendationSource: 'recommendationText'
    },

    // Oracle ASM layouts
    'data-dg-lun-layout': {
        impactedLabel: 'Impacted disk groups',
        countSource: 'impactedCount',
        recommendationSource: 'recommendationText'
    },
    'log-dg-lun-layout': {
        impactedLabel: 'Impacted disk groups',
        countSource: 'impactedCount',
        recommendationSource: 'recommendationText'
    },
    'fra-dg-lun-layout': {
        impactedLabel: 'Impacted disk groups',
        countSource: 'impactedCount',
        recommendationSource: 'recommendationText'
    },
    'archivelog-dg-lun-layout': {
        impactedLabel: 'Impacted disk groups',
        countSource: 'impactedCount',
        recommendationSource: 'recommendationText'
    },

    // MSSQL configs
    'performance-tier': {
        impactedLabel: 'Impacted volumes',
        countSource: 'impactedCount',
        recommendationSource: 'recommendationText'
    },
    'log-drive-size': {
        impactedLabel: 'Impacted drives',
        countSource: 'impactedCount',
        recommendationSource: 'recommendationText'
    },
    'tempdb-drive-size': {
        impactedLabel: 'Impacted drives',
        countSource: 'impactedCount',
        recommendationSource: 'recommendationText'
    },
    'data-files-location': {
        impactedLabel: 'Impacted databases',
        countSource: 'impactedCount',
        recommendationSource: 'recommendation.description'
    },
    'log-files-location': {
        impactedLabel: 'Impacted databases',
        countSource: 'impactedCount',
        recommendationSource: 'recommendation.description'
    },
    'tempdb-files-location': {
        impactedLabel: 'Impacted databases',
        countSource: 'impactedCount',
        recommendationSource: 'recommendation.description'
    },
    'rss-config': {
        impactedLabel: 'Impacted network adapters',
        countSource: 'impactedCount',
        recommendationSource: 'recommendation.descriptionRssConfig'
    },
    'mtu-alignment': {
        impactedLabel: 'Impacted network interfaces',
        countSource: 'impactedCount',
        recommendationSource: 'recommendationText'
    },
    'snapshot-policy': {
        impactedLabel: 'Impacted volumes',
        countSource: 'impactedCount',
        recommendationSource: 'recommendationText'
    },
    crr: {
        impactedLabel: 'Impacted volumes',
        countSource: 'impactedCount',
        recommendationSource: 'recommendationText'
    },
    'snapcenter-snapshot': {
        impactedLabel: 'Impacted volumes',
        countSource: 'impactedCount',
        recommendationSource: 'recommendationText'
    },
    'clone-management': {
        impactedLabel: 'Impacted databases',
        countSource: 'impactedCount',
        recommendationSource: 'recommendation.description'
    },
    'file-system-headroom': {
        impactedLabel: 'Impacted databases',
        countSource: 'impactedCount',
        recommendationSource: 'recommendationText'
    },

    // Multipath/Host configs (Oracle/MSSQL)
    'mpio-load-balance-policy': {
        impactedLabel: 'Impacted drives',
        countSource: 'totalObjectsInViolation'
    },
    'multipath-io-sessions': {
        impactedLabel: 'Impacted volumes',
        countSource: 'totalObjectsInViolation'
    },

    // Oracle filesystem configs
    'filesystems-io-options': {
        impactedLabel: 'Impacted databases',
        countSource: 'totalObjectsInViolation'
    },
    'multipath-readcount': {
        impactedLabel: 'Impacted databases',
        countSource: 'totalObjectsInViolation'
    },

    // MSSQL HA configs
    'heartbeat-settings': {
        impactedLabel: 'Impacted heartbeat settings',
        countSource: 'totalObjectsInViolation'
    },
    'cluster-quorum': {
        impactedLabel: 'Impacted clusters',
        countSource: 'totalObjectsInViolation'
    },
    'sql-server-service': {
        impactedLabel: 'Impacted SQL instances',
        countSource: 'totalObjectsInViolation'
    },
    'shared-storage': {
        impactedLabel: 'Impacted LUNs',
        countSource: 'totalObjectsInViolation'
    },

    // LUN configs
    'os-type': {
        impactedLabel: 'Impacted LUNs',
        countSource: 'totalObjectsInViolation'
    },
    'space-reservation-enabled': {
        impactedLabel: 'Impacted LUNs',
        countSource: 'totalObjectsInViolation'
    },
    'space-allocation-allocated': {
        impactedLabel: 'Impacted LUNs',
        countSource: 'totalObjectsInViolation'
    }
};

/**
 * Default card metadata for configs not listed in CONFIG_CARD_METADATA.
 */
export const DEFAULT_CARD_METADATA: CardMetadata = {
    impactedLabel: 'Impacted objects',
    countSource: 'totalObjectsInViolation'
};

/**
 * Column definitions for inner page tables, keyed by config ID.
 * Used by DynamicOptimizeInnerPage to render tables dynamically.
 */
export const CONFIG_COLUMN_MAP: Record<string, ColumnConfig> = {
    // Storage tier (MSSQL)
    'performance-tier': {
        columns: [
            { key: 'objectName', label: 'Volume name', accessor: 'objectName' },
            { key: 'value', label: 'SSD storage tier', accessor: 'value' },
            { key: 'objectType', label: 'Object type', accessor: 'objectType', width: '200px' }
        ],
        resourceTypeLabel: 'Volume',
        tableTitle: 'Impacted volumes'
    },

    // RSS config (MSSQL)
    'rss-config': {
        columns: [
            { key: 'objectName', label: 'Network adapter name', accessor: 'objectName' },
            { key: 'rss', label: 'RSS', accessor: 'rss' },
            { key: 'queues', label: 'Number of receive queues', accessor: 'queues' },
            { key: 'profile', label: 'RSS profile', accessor: 'profile' },
            { key: 'baseProcessor', label: 'Base processor number', accessor: 'baseProcessor' }
        ],
        tableTitle: 'Impacted adapters'
    },

    // MTU alignment (MSSQL)
    'mtu-alignment': {
        columns: [
            { key: 'objectName', label: 'Network adapter name', accessor: 'objectName' },
            { key: 'value', label: 'MTU size', accessor: 'value' },
            { key: 'expected', label: 'Expected MTU', accessor: 'expected' }
        ],
        tableTitle: 'Impacted adapters'
    },

    // MSSQL nested expandable tables (data/log/tempdb file locations)
    'data-files-location': {
        columns: [
            { key: 'databaseName', label: 'Database name', accessor: 'databaseName', width: '18%' },
            { key: 'driveDisplay', label: 'Drive name', accessor: 'driveDisplay', width: '12%' },
            { key: 'lunPathDisplay', label: 'LUN path', accessor: 'lunPathDisplay', width: '45%' }
        ],
        tableTitle: 'Impacted databases',
        useNestedExpandable: true
    },
    'log-files-location': {
        columns: [
            { key: 'databaseName', label: 'Database name', accessor: 'databaseName', width: '18%' },
            { key: 'driveDisplay', label: 'Drive name', accessor: 'driveDisplay', width: '12%' },
            { key: 'lunPathDisplay', label: 'LUN path', accessor: 'lunPathDisplay', width: '45%' }
        ],
        tableTitle: 'Impacted databases',
        useNestedExpandable: true
    },
    'tempdb-files-location': {
        columns: [
            { key: 'databaseName', label: 'Database name', accessor: 'databaseName', width: '18%' },
            { key: 'driveDisplay', label: 'Drive name', accessor: 'driveDisplay', width: '12%' },
            { key: 'lunPathDisplay', label: 'LUN path', accessor: 'lunPathDisplay', width: '45%' }
        ],
        tableTitle: 'Impacted databases',
        useNestedExpandable: true
    },

    // Oracle storage layout configs
    'datafiles-placement': {
        columns: [
            { key: 'objectName', label: 'Volume name', accessor: 'objectName' },
            { key: 'mountPoint', label: 'Mount point', accessor: 'mountPoint' },
            { key: 'protocol', label: 'Protocol', accessor: 'protocol' }
        ],
        tableTitle: 'Data files placement'
    },

    'redologs-placement': {
        columns: [
            { key: 'objectName', label: 'Volume name', accessor: 'objectName' },
            { key: 'mountPoint', label: 'Mount point', accessor: 'mountPoint' },
            { key: 'protocol', label: 'Protocol', accessor: 'protocol' }
        ],
        tableTitle: 'Redo logs placement'
    },

    // Oracle ASM disk groups
    'data-dg-lun-layout': {
        columns: [
            { key: 'objectName', label: 'Disk group name', accessor: 'objectName' },
            { key: 'value', label: 'Number of LUNs', accessor: 'value' },
            { key: 'recommended', label: 'Recommended', accessor: 'recommended' }
        ],
        tableTitle: 'ASM data disk group LUNs'
    },

    'log-dg-lun-layout': {
        columns: [
            { key: 'objectName', label: 'Disk group name', accessor: 'objectName' },
            { key: 'value', label: 'Number of LUNs', accessor: 'value' },
            { key: 'recommended', label: 'Recommended', accessor: 'recommended' }
        ],
        tableTitle: 'ASM logs disk group LUNs'
    },

    'fra-dg-lun-layout': {
        columns: [
            { key: 'objectName', label: 'Disk group name', accessor: 'objectName' },
            { key: 'value', label: 'Number of LUNs', accessor: 'value' },
            { key: 'recommended', label: 'Recommended', accessor: 'recommended' }
        ],
        tableTitle: 'ASM FRA disk group LUNs'
    },

    // Shared storage (MSSQL HA)
    'shared-storage': {
        columns: [
            { key: 'objectName', label: 'Volume name', accessor: 'objectName' },
            { key: 'value', label: 'Current value', accessor: 'value' },
            { key: 'objectType', label: 'Object type', accessor: 'objectType' }
        ],
        tableTitle: 'Impacted volumes'
    },

    // Clone management
    'clone-management': {
        columns: [
            { key: 'cloneName', label: 'Clone name', accessor: 'cloneName' },
            { key: 'sourceDatabase', label: 'Source database', accessor: 'sourceDatabase' },
            { key: 'creationTime', label: 'Creation time', accessor: 'creationTime' },
            { key: 'divergence', label: 'Divergence %', accessor: 'divergence' },
            { key: 'size', label: 'Size', accessor: 'size' }
        ],
        tableTitle: 'Database clones'
    },

    // CRR
    crr: {
        columns: [
            { key: 'objectName', label: 'File system', accessor: 'objectName' },
            { key: 'status', label: 'Replication status', accessor: 'status' }
        ],
        tableTitle: 'File systems'
    },

    // ONTAP configs that show ONLY Volume name (MSSQL uses OntapTable, Oracle uses OntapTable with recommended column)
    'thin-provision': {
        columns: [{ key: 'objectName', label: 'Volume name', accessor: 'objectName' }],
        resourceTypeLabel: 'Volume',
        tableTitle: 'Impacted volumes'
    },
    autosize: {
        columns: [{ key: 'objectName', label: 'Volume name', accessor: 'objectName' }],
        resourceTypeLabel: 'Volume',
        tableTitle: 'Impacted volumes'
    },
    'snapshot-autodelete': {
        columns: [{ key: 'objectName', label: 'Volume name', accessor: 'objectName' }],
        resourceTypeLabel: 'Volume',
        tableTitle: 'Impacted volumes'
    },
    'space-mgmt-try-first': {
        columns: [{ key: 'objectName', label: 'Volume name', accessor: 'objectName' }],
        resourceTypeLabel: 'Volume',
        tableTitle: 'Impacted volumes'
    },
    'storage-efficiencies': {
        columns: [
            { key: 'objectName', label: 'Volume name', accessor: 'objectName' },
            { key: 'current', label: 'Current', accessor: 'current' },
            { key: 'recommended', label: 'Recommended', accessor: 'recommended' }
        ],
        resourceTypeLabel: 'Volume',
        tableTitle: 'Impacted volumes',
        hasSubConfigs: true
    },
    'block-device-space-management': {
        columns: [
            { key: 'objectName', label: 'Object name', accessor: 'objectName' },
            { key: 'current', label: 'Current', accessor: 'current' },
            { key: 'recommended', label: 'Recommended', accessor: 'recommended' }
        ],
        resourceTypeLabel: 'Lun',
        tableTitle: 'Impacted luns',
        hasSubConfigs: true
    },
    'nfs-rootonly': {
        columns: [{ key: 'objectName', label: 'Volume name', accessor: 'objectName' }],
        resourceTypeLabel: 'Volume',
        tableTitle: 'Impacted volumes'
    },
    'export-policy': {
        columns: [{ key: 'objectName', label: 'Volume name', accessor: 'objectName' }],
        resourceTypeLabel: 'Volume',
        tableTitle: 'Impacted volumes'
    },

    // ONTAP configs that show Volume name + VALUE column (MSSQL uses OntapTableWithData)
    'autosize-mode': {
        columns: [
            { key: 'objectName', label: 'Volume name', accessor: 'objectName' },
            { key: 'value', label: 'Autosize-mode', accessor: 'value' }
        ],
        resourceTypeLabel: 'Volume',
        tableTitle: 'Impacted volumes'
    },
    'snapshot-copy-reserve': {
        columns: [
            { key: 'objectName', label: 'Volume name', accessor: 'objectName' },
            { key: 'value', label: 'Snapshot copy reserve', accessor: 'value' }
        ],
        resourceTypeLabel: 'Volume',
        tableTitle: 'Impacted volumes'
    },
    'tiering-tco-optimization': {
        columns: [
            { key: 'objectName', label: 'Volume name', accessor: 'objectName' },
            { key: 'current', label: 'Current', accessor: 'current' },
            { key: 'recommended', label: 'Recommended', accessor: 'recommended' }
        ],
        resourceTypeLabel: 'Volume',
        tableTitle: 'Impacted volumes',
        hasSubConfigs: true
    },
    'os-type': {
        columns: [
            { key: 'objectName', label: 'Volume name', accessor: 'objectName' },
            { key: 'value', label: 'OS type', accessor: 'value' }
        ],
        resourceTypeLabel: 'Volume',
        tableTitle: 'Impacted volumes'
    },

    // Snapshot policy / Scheduled local snapshot (MSSQL)
    'snapshot-policy': {
        columns: [{ key: 'objectName', label: 'Volume name', accessor: 'objectName' }],
        resourceTypeLabel: 'Volume',
        tableTitle: 'Impacted volumes'
    },

    // Oracle snapshot policy volume
    'snapshot-policy-vol': {
        columns: [
            { key: 'objectName', label: 'Volume name', accessor: 'objectName' },
            { key: 'value', label: 'Current value', accessor: 'value' },
            { key: 'objectType', label: 'Object type', accessor: 'objectType', width: '200px' }
        ],
        resourceTypeLabel: 'Volume',
        tableTitle: 'Impacted volumes'
    },

    // MPIO load balance policy (MSSQL)
    'mpio-load-balance-policy': {
        columns: [
            { key: 'objectName', label: 'Volume name', accessor: 'objectName' },
            { key: 'value', label: 'Current value', accessor: 'value' },
            { key: 'objectType', label: 'Object type', accessor: 'objectType', width: '200px' }
        ],
        resourceTypeLabel: 'Volume',
        tableTitle: 'Impacted volumes'
    },

    // NTFS allocation unit size (MSSQL)
    'ntfs-allocation-unit-size': {
        columns: [
            { key: 'objectName', label: 'Drive', accessor: 'objectName' },
            { key: 'value', label: 'Allocation unit size', accessor: 'value' },
            { key: 'expected', label: 'Expected', accessor: 'expected' }
        ],
        tableTitle: 'Impacted drives'
    },

    // MSSQL drive sizing
    'log-drive-size': {
        columns: [
            { key: 'objectName', label: 'Drive', accessor: 'objectName' },
            { key: 'value', label: 'Current size', accessor: 'value' },
            { key: 'recommended', label: 'Recommended size', accessor: 'recommended' },
            { key: 'status', label: 'Status', accessor: 'status' }
        ],
        tableTitle: 'Impacted drives'
    },
    'tempdb-drive-size': {
        columns: [
            { key: 'objectName', label: 'Drive', accessor: 'objectName' },
            { key: 'value', label: 'Current size', accessor: 'value' },
            { key: 'recommended', label: 'Recommended size', accessor: 'recommended' },
            { key: 'status', label: 'Status', accessor: 'status' }
        ],
        tableTitle: 'Impacted drives'
    },

    // NOTE: data-files-location, log-files-location, and tempdb-files-location
    // use special expandable nested table structure with DataFilesOptimizeTable,
    // LogFilesOptimizeTable, and TempDbFilesOptimizeTable components.
    // They are not migrated to DynamicInnerTable yet - they use legacy routing.
    // Columns: Database name | Drive name | LUN path | (expandable chevron)

    // Oracle storage layout configs (additional)
    'oracle-binary-placement': {
        columns: [
            { key: 'objectName', label: 'Volume name', accessor: 'objectName' },
            { key: 'mountPoint', label: 'Mount point', accessor: 'mountPoint' },
            { key: 'protocol', label: 'Protocol', accessor: 'protocol' }
        ],
        tableTitle: 'Oracle binary placement'
    },
    'controlfiles-placement': {
        columns: [
            { key: 'objectName', label: 'Volume name', accessor: 'objectName' },
            { key: 'mountPoint', label: 'Mount point', accessor: 'mountPoint' },
            { key: 'protocol', label: 'Protocol', accessor: 'protocol' }
        ],
        tableTitle: 'Control files placement'
    },
    'templogs-placement': {
        columns: [
            { key: 'objectName', label: 'Volume name', accessor: 'objectName' },
            { key: 'mountPoint', label: 'Mount point', accessor: 'mountPoint' },
            { key: 'protocol', label: 'Protocol', accessor: 'protocol' }
        ],
        tableTitle: 'Temp logs placement'
    },
    'archive-placement': {
        columns: [
            { key: 'objectName', label: 'Volume name', accessor: 'objectName' },
            { key: 'mountPoint', label: 'Mount point', accessor: 'mountPoint' },
            { key: 'protocol', label: 'Protocol', accessor: 'protocol' }
        ],
        tableTitle: 'Archive placement'
    },

    // Oracle NFS/dNFS configs
    'nfs-mount-options-databasefiles': {
        columns: [
            { key: 'objectName', label: 'Mount point', accessor: 'objectName' },
            { key: 'value', label: 'Current options', accessor: 'value' },
            { key: 'recommended', label: 'Recommended', accessor: 'recommended' }
        ],
        tableTitle: 'NFS mount options'
    },
    'dnfs-configuration-file': {
        columns: [
            { key: 'objectName', label: 'Configuration file', accessor: 'objectName' },
            { key: 'value', label: 'Status', accessor: 'value' }
        ],
        tableTitle: 'dNFS configuration'
    },
    'dnfs-no-shared-cache': {
        columns: [
            { key: 'objectName', label: 'Parameter', accessor: 'objectName' },
            { key: 'value', label: 'Current value', accessor: 'value' },
            { key: 'recommended', label: 'Recommended', accessor: 'recommended' }
        ],
        tableTitle: 'dNFS shared cache settings'
    },

    // ASM external redundancy (Oracle)
    'asm-external-redundancy': {
        columns: [
            { key: 'objectName', label: 'Disk group name', accessor: 'objectName' },
            { key: 'value', label: 'Current redundancy', accessor: 'value' },
            { key: 'recommended', label: 'Recommended', accessor: 'recommended' }
        ],
        tableTitle: 'ASM disk groups'
    },

    // Snapcenter snapshot (Oracle)
    'snapcenter-snapshot': {
        columns: [
            { key: 'objectName', label: 'Volume name', accessor: 'objectName' },
            { key: 'value', label: 'Snapshot status', accessor: 'value' }
        ],
        tableTitle: 'Impacted volumes'
    }
};

/**
 * Gets column configuration for a given config ID.
 * Returns undefined if no specific column config exists (generic fallback will be used).
 *
 * @param configId - The flat API config id
 * @returns Column configuration or undefined
 */
export const getColumnConfig = (configId: string): ColumnConfig | undefined => CONFIG_COLUMN_MAP[configId];

/**
 * Builds the `current` and `recommended` display strings for a config whose findings are nested
 * sub-configs (e.g. storage-efficiencies: compression/deduplication/compaction).
 *
 * - The full list of sub-configs comes from `configDetails`.
 * - Recommended value per sub-config: `configDetails[].recommended`, falling back to
 *   `recommendedByDataCategory[row.dataCategory]` when a single `recommended` is not provided.
 * - Current value per sub-config: `row.violatedConfigs[].current` matched by name; if a sub-config
 *   is not in violation (or has no current value) it is shown as its recommended value.
 *
 * @returns e.g. { current: 'compression=adaptive, deduplication=none, compaction=none', recommended: '...' }
 */
export const buildSubConfigValues = (
    row: any,
    configDetails: Array<any> = []
): { current: string; recommended: string } => {
    const currentByName = new Map<string, string>((row?.violatedConfigs || []).map((c: any) => [c.name, c.current]));
    const dataCategory: string | undefined = row?.dataCategory;

    const entries = configDetails.map((cfg: any) => {
        const recommended =
            cfg.recommended || (dataCategory ? cfg.recommendedByDataCategory?.[dataCategory] : undefined) || '';
        const current = currentByName.get(cfg.name) || recommended;
        return { name: cfg.name, current, recommended };
    });

    return {
        current: entries.map(e => `${e.name}=${e.current}`).join(', '),
        recommended: entries.map(e => `${e.name}=${e.recommended}`).join(', ')
    };
};

/**
 * Gets card heights for a given config ID based on database type.
 * Returns config-specific heights if defined, otherwise returns default heights.
 * Configs with longer recommendation text require taller cards.
 *
 * @param configId - The flat API config id
 * @param dbType - Database type (DBType.MSSQL or DBType.ORACLE)
 * @returns Card heights (recommendationSection and tagSection)
 */
export const getCardHeights = (configId: string, dbType: string): CardHeights => {
    const configMap = dbType === DBType.ORACLE ? ORACLE_CONFIG_CARD_HEIGHTS : MSSQL_CONFIG_CARD_HEIGHTS;
    return configMap[configId] || DEFAULT_CARD_HEIGHTS;
};

/**
 * Gets card metadata for a given config ID.
 * Returns config-specific metadata if defined, otherwise returns default metadata.
 * Defines labels and data sources for card display.
 *
 * @param configId - The flat API config id
 * @returns Card metadata (impactedLabel, countSource, recommendationSource)
 */
export const getCardMetadata = (configId: string): CardMetadata =>
    CONFIG_CARD_METADATA[configId] || DEFAULT_CARD_METADATA;

// ============================================================================
// DIALOG CONTENT CONFIGURATION (Data-driven dialog rendering)
// ============================================================================

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

/**
 * Resolves the dialog content config for a given configId and engineType.
 * Tries engine-specific key first (e.g. 'oracle:thin-provision'), then generic key.
 */
export const getDialogContentConfig = (configId: string, engineType: string): DialogContentConfig | undefined => {
    // Normalize engine type to lowercase for map lookup
    const normalizedEngine =
        engineType === DBType.ORACLE ? 'oracle' : engineType === DBType.MSSQL ? 'mssql' : engineType.toLowerCase();
    const engineKey = `${normalizedEngine}:${configId}`;
    return DIALOG_CONTENT_MAP[engineKey] || DIALOG_CONTENT_MAP[configId];
};

/**
 * Dialog content map keyed by config ID or engine:configId.
 * Each entry describes what sections to render and which features to enable.
 * DynamicDialogContent iterates sections[] and renders them using helpers.
 */
export const DIALOG_CONTENT_MAP: Record<string, DialogContentConfig> = {
    // ========================================================================
    // MSSQL ONTAP CONFIGS (thin-provision, autosize, etc.)
    // ========================================================================
    'mssql:thin-provision': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.autosize-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.autosize-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true },
        notes: { type: 'standard' }
    },
    'mssql:autosize': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.autosize-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.autosize-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true },
        notes: { type: 'standard' }
    },
    'mssql:autosize-mode': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.autosize-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.autosize-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true },
        notes: { type: 'standard' }
    },
    'mssql:fractional-reserve': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.autosize-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.autosize-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true },
        notes: { type: 'standard' }
    },
    'mssql:snapshot-autodelete': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.autosize-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.autosize-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true },
        notes: { type: 'standard' }
    },
    'mssql:space-mgmt-try-first': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.autosize-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.autosize-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true },
        notes: { type: 'standard' }
    },
    'mssql:tiering-tco-optimization': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.mssql-tiering-tco-optimization-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.mssql-tiering-tco-optimization-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: false },
        notes: { type: 'standard' }
    },
    'mssql:snapshot-copy-reserve': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.autosize-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.autosize-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true },
        notes: {
            type: 'custom',
            items: [
                'databases.well-architect.failover-cluster-note1',
                'databases.well-architect.snapshot-copy-reserve-aoag-note',
                'databases.well-architect.failover-cluster-note2'
            ]
        }
    },
    'mssql:snapshot-policy': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.autosize-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.autosize-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true },
        notes: { type: 'standard' }
    },
    'mssql:storage-efficiencies': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.mssql-storage-efficiencies-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.mssql-storage-efficiencies-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: false },
        notes: { type: 'standard' }
    },
    'mssql:deduplication': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.autosize-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.autosize-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true },
        notes: { type: 'standard' }
    },
    'mssql:compaction': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.autosize-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.autosize-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true },
        notes: { type: 'standard' }
    },
    'mssql:os-type': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.os-type-space-allocation-reservation-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.os-type-space-allocation-reservation-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true },
        notes: { type: 'standard' }
    },
    'mssql:space-reservation-enabled': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.os-type-space-allocation-reservation-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.os-type-space-allocation-reservation-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true },
        notes: { type: 'standard' }
    },
    'mssql:space-allocation-allocated': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.os-type-space-allocation-reservation-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.os-type-space-allocation-reservation-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true },
        notes: { type: 'standard' }
    },
    'mssql:block-device-space-management': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.mssql-block-device-space-management-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.mssql-block-device-space-management-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: false },
        notes: { type: 'standard' }
    },

    // ========================================================================
    // MSSQL MULTIPATH / MPIO
    // ========================================================================
    'mssql:mpio-enabled': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.mpio-status-policy-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.mpio-status-policy-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true },
        notes: { type: 'os' }
    },
    'mssql:mpio-load-balance-policy': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.mpio-status-policy-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.mpio-status-policy-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true },
        notes: { type: 'os' }
    },
    'mssql:mpio-timeout': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.mpio-timeout-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.mpio-timeout-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true },
        notes: { type: 'custom', content: 'databases.well-architect.note1' }
    },
    'mssql:mpio-iscsi-count': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.mpio-session-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.mpio-session-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true },
        notes: { type: 'standard' }
    },

    // ========================================================================
    // MSSQL NTFS / RSS / MTU
    // ========================================================================
    'mssql:ntfs-allocation-unit-size': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.ntfs-allocation-action-summary1'
            },
            {
                heading: 'databases.well-architect.downtime-warning',
                type: 'text',
                content: 'databases.well-architect.ntfs-allocation-downtime-warning-content'
            },
            {
                heading: 'databases.well-architect.optimization-steps',
                type: 'bullets',
                items: [
                    'databases.well-architect.ntfs-allocation-optimization-steps1',
                    'databases.well-architect.ntfs-allocation-optimization-steps2',
                    'databases.well-architect.ntfs-allocation-optimization-steps3',
                    'databases.well-architect.ntfs-allocation-optimization-steps4',
                    'databases.well-architect.ntfs-allocation-optimization-steps5'
                ],
                style: { width: '712px' }
            }
        ]
    },
    'mssql:rss-config': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.rss-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'bullets',
                items: [
                    'databases.well-architect.rss-what-will-happen-content1',
                    'databases.well-architect.rss-what-will-happen-content2',
                    'databases.well-architect.rss-what-will-happen-content3',
                    'databases.well-architect.rss-what-will-happen-content4',
                    'databases.well-architect.rss-what-will-happen-content5'
                ],
                hideWhenWad: true,
                style: { width: '712px' }
            }
        ],
        notes: { type: 'failover' }
    },
    'mssql:mtu-alignment': {
        sections: [
            {
                heading: 'databases.well-architect.mtu-alignment-action-summary-heading',
                type: 'text',
                content: 'databases.well-architect.mtu-alignment-action-summary'
            },
            {
                heading: 'databases.well-architect.mtu-alignment-what-will-happen-heading',
                type: 'text',
                content: 'databases.well-architect.mtu-alignment-what-will-happen1',
                style: { width: '712px' }
            }
        ],
        notes: {
            type: 'custom',
            items: ['databases.well-architect.mtu-alignment-note1', 'databases.well-architect.mtu-alignment-note2']
        }
    },

    // ========================================================================
    // MSSQL MAXDOP
    // ========================================================================
    'mssql:maxdop': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.maxdop-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.maxdop-what-will-happen',
                hideWhenWad: true
            }
        ],
        notes: { type: 'standard' }
    },

    // ========================================================================
    // MSSQL PATCHES
    // ========================================================================
    'mssql:mssql-patch': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.mssql-patch-action-summary'
            }
        ],
        features: { showPatchTable: true, patchField: 'MSSQL_PATCH' }
    },
    'mssql:host-os-patch': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.os-patch-action-summary'
            }
        ],
        features: { showPatchTable: true, patchField: 'OS_PATCH' }
    },

    // ========================================================================
    // MSSQL HEADROOM (conditional based on status)
    // ========================================================================
    'mssql:headroom': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.file-system-headroom-with-permission'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.file-system-headroom-with-permission-content',
                hideWhenWad: true
            }
        ],
        notes: { type: 'standard' },
        conditionalOverrides: [
            {
                when: { field: 'status', equals: 'over-provisioned' },
                sections: [
                    {
                        heading: 'databases.well-architect.action-summary',
                        type: 'text',
                        content: 'databases.well-architect.mssql-headroom-over-provisioned-action-summary'
                    },
                    {
                        heading: 'databases.well-architect.mssql-headroom-over-provisioned-percentages',
                        type: 'bullets',
                        items: [
                            'databases.well-architect.mssql-headroom-over-provisioned-under',
                            'databases.well-architect.mssql-headroom-over-provisioned-optimized',
                            'databases.well-architect.mssql-headroom-over-provisioned-over'
                        ],
                        style: { width: '712px' }
                    },
                    {
                        heading: 'databases.well-architect.what-will-happen',
                        type: 'text',
                        content: 'databases.well-architect.mssql-headroom-over-provisioned-what-will-happen',
                        hideWhenWad: true
                    },
                    {
                        heading: 'databases.well-architect.optimization-steps',
                        type: 'numberedSteps',
                        items: [
                            'databases.well-architect.mssql-headroom-over-provisioned-step1',
                            'databases.well-architect.mssql-headroom-over-provisioned-step2',
                            'databases.well-architect.mssql-headroom-over-provisioned-step3',
                            'databases.well-architect.mssql-headroom-over-provisioned-step4',
                            'databases.well-architect.mssql-headroom-over-provisioned-step5',
                            'databases.well-architect.mssql-headroom-over-provisioned-step6',
                            'databases.well-architect.mssql-headroom-over-provisioned-step7'
                        ],
                        style: { width: '712px' }
                    }
                ]
            },
            {
                when: { field: 'hasMissingPermissions', equals: 'true' },
                sections: [
                    {
                        heading: 'databases.well-architect.action-summary',
                        type: 'text',
                        content: 'databases.well-architect.file-system-headroom-action-summary'
                    },
                    {
                        heading: 'databases.well-architect.action-required',
                        type: 'text',
                        content: 'databases.well-architect.file-system-headroom-choose-option1',
                        style: { width: '712px' }
                    },
                    {
                        heading: 'databases.well-architect.file-system-headroom-option1-content',
                        type: 'permissions',
                        content: 'databases.well-architect.drive-size-and-headroom-action-content1',
                        style: { width: '712px' }
                    },
                    {
                        heading: 'databases.well-architect.file-system-headroom-option2',
                        type: 'numberedSteps',
                        items: [
                            'databases.well-architect.file-system-headroom-option2-content2',
                            'databases.well-architect.file-system-headroom-option2-content3',
                            'databases.well-architect.file-system-headroom-option2-content4',
                            'databases.well-architect.file-system-headroom-option2-content5'
                        ],
                        style: { width: '712px' }
                    }
                ]
            }
        ]
    },

    // MSSQL log drive / tempdb drive sizing
    'mssql:log-drive-size': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.log-drive-size-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'bullets',
                items: ['databases.well-architect.log-drive-size-what-will-happen'],
                hideWhenWad: true
            }
        ],
        notes: { type: 'standard' },
        conditionalOverrides: [
            {
                when: { field: 'hasMissingPermissions', equals: 'true' },
                sections: [
                    {
                        heading: 'databases.well-architect.action-summary',
                        type: 'text',
                        content: 'databases.well-architect.drive-size-and-headroom-action-content1'
                    },
                    {
                        heading: 'databases.well-architect.action-required',
                        type: 'permissions',
                        content: 'databases.well-architect.drive-size-and-headroom-action-content1',
                        style: { width: '712px' }
                    }
                ]
            }
        ]
    },
    'mssql:tempdb-drive-size': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.tempdb-drive-size-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'bullets',
                items: ['databases.well-architect.tempdb-drive-size-what-will-happen'],
                hideWhenWad: true
            }
        ],
        notes: { type: 'standard' },
        conditionalOverrides: [
            {
                when: { field: 'hasMissingPermissions', equals: 'true' },
                sections: [
                    {
                        heading: 'databases.well-architect.action-summary',
                        type: 'text',
                        content: 'databases.well-architect.drive-size-and-headroom-action-content1'
                    },
                    {
                        heading: 'databases.well-architect.action-required',
                        type: 'permissions',
                        content: 'databases.well-architect.drive-size-and-headroom-action-content1',
                        style: { width: '712px' }
                    }
                ]
            }
        ]
    },

    // ========================================================================
    // MSSQL HA / FAILOVER CLUSTER CONFIGS
    // ========================================================================
    'mssql:shared-storage': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.failover-cluster-action-summary'
            },
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.shared-storage-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.shared-storage-what-will-happen',
                hideWhenWad: true
            }
        ],
        notes: { type: 'failover' }
    },
    'mssql:drive-letter': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.failover-cluster-action-summary'
            },
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.drive-letter-action-summary1'
            },
            { heading: '', type: 'text', content: 'databases.well-architect.drive-letter-action-summary2' }
        ],
        features: { showOntapConfigCodeBox: true },
        notes: { type: 'driveLetter' }
    },
    'mssql:heartbeat-settings': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.failover-cluster-action-summary'
            },
            { heading: '', type: 'text', content: 'databases.well-architect.heartbeat-setting-action-summary1' },
            { heading: '', type: 'text', content: 'databases.well-architect.heartbeat-setting-action-summary2' },
            { heading: '', type: 'text', content: 'databases.well-architect.heartbeat-setting-action-summary3' },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'bullets',
                items: [
                    'databases.well-architect.heartbeat-setting-what-will-happen-content1',
                    'databases.well-architect.heartbeat-setting-what-will-happen-content2',
                    'databases.well-architect.heartbeat-setting-what-will-happen-content3',
                    'databases.well-architect.heartbeat-setting-what-will-happen-content4',
                    'databases.well-architect.heartbeat-setting-what-will-happen-content5',
                    'databases.well-architect.heartbeat-setting-what-will-happen-content6'
                ],
                hideWhenWad: true
            }
        ],
        notes: { type: 'failover' }
    },
    'mssql:cluster-quorum': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.failover-cluster-action-summary'
            },
            { heading: '', type: 'text', content: 'databases.well-architect.cluster-quorum-action-summary' },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.cluster-quorum-what-will-happen',
                hideWhenWad: true
            }
        ],
        notes: { type: 'clusterQuorum' }
    },
    'mssql:sql-server-service': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.sql-server-configuration-action-summary1'
            },
            { heading: '', type: 'text', content: 'databases.well-architect.sql-server-configuration-action-summary2' },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.sql-server-configuration-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true },
        notes: { type: 'clusterQuorum' }
    },

    // ========================================================================
    // MSSQL COMPUTE RIGHTSIZING (interactive - instance selector)
    // ========================================================================
    'mssql:compute-rightsizing': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.compute-rightsizing-action-summary'
            }
        ],
        features: { showInstanceSelector: true },
        notes: { type: 'failover' }
    },

    // MSSQL scheduled snapshots / backups
    'mssql:snapshot-local': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.snapshot-local-action-summary'
            }
        ],
        features: { showPatchTable: true, patchField: 'SNAPSHOT_LOCAL' }
    },
    'mssql:scheduled-fsx-backup': {
        sections: [],
        features: { showCustomBackupUI: true }
    },

    // ========================================================================
    // ORACLE ONTAP CONFIGS (all use linked config banner)
    // ========================================================================
    'oracle:thin-provision': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-thin-provisioning-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.oracle-thin-provisioning-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true, showLinkedConfigBanner: true },
        notes: { type: 'standard' }
    },
    'oracle:autosize': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-autosize-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.oracle-autosize-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true, showLinkedConfigBanner: true },
        notes: { type: 'standard' }
    },
    'oracle:autosize-mode': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-autosize-mode-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.oracle-autosize-mode-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true, showLinkedConfigBanner: true },
        notes: { type: 'standard' }
    },
    'oracle:fractional-reserve': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-fractional-reserve-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.oracle-fractional-reserve-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true, showLinkedConfigBanner: true },
        notes: { type: 'standard' }
    },
    'oracle:snapshot-policy': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-snapshot-policy-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.oracle-snapshot-policy-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true, showLinkedConfigBanner: true },
        notes: { type: 'standard' }
    },
    'oracle:snapshot-copy-reserve': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-snapshot-copy-reserve-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.oracle-snapshot-copy-reserve-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true, showLinkedConfigBanner: true },
        notes: { type: 'standard' }
    },
    'oracle:snapshot-autodelete': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-snapshot-autodelete-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.oracle-snapshot-autodelete-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true, showLinkedConfigBanner: true },
        notes: { type: 'standard' }
    },
    'oracle:space-mgmt-try-first': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-space-mgmt-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.oracle-space-mgmt-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true, showLinkedConfigBanner: true },
        notes: { type: 'standard' }
    },
    'oracle:tiering-tco-optimization': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-tiering-tco-optimization-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.oracle-tiering-tco-optimization-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: false, showLinkedConfigBanner: true },
        notes: { type: 'standard' }
    },
    'oracle:compaction': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-compaction-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.oracle-compaction-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true, showLinkedConfigBanner: true },
        notes: { type: 'standard' }
    },
    'oracle:deduplication': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-deduplication-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.oracle-deduplication-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true, showLinkedConfigBanner: true },
        notes: { type: 'standard' }
    },
    'oracle:storage-efficiencies': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-storage-efficiencies-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.oracle-storage-efficiencies-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: false, showLinkedConfigBanner: true },
        notes: { type: 'standard' }
    },
    'oracle:os-type': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-os-type-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.oracle-os-type-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true, showLinkedConfigBanner: true },
        notes: { type: 'standard' }
    },
    'oracle:space-reservation-enabled': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-space-reservation-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.oracle-space-reservation-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true, showLinkedConfigBanner: true },
        notes: { type: 'standard' }
    },
    'oracle:space-allocation-allocated': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-space-allocation-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.oracle-space-allocation-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true, showLinkedConfigBanner: true },
        notes: { type: 'standard' }
    },
    'oracle:block-device-space-management': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-block-device-space-management-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.oracle-block-device-space-management-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: false, showLinkedConfigBanner: true },
        notes: { type: 'standard' }
    },
    'oracle:nfs-rootonly': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-nfs-rootonly-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.oracle-nfs-rootonly-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true, showLinkedConfigBanner: true },
        notes: { type: 'custom', content: 'databases.well-architect.oracle-nfs-root-only-note' }
    },
    'oracle:export-policy': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-export-policy-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.oracle-export-policy-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true, showLinkedConfigBanner: true },
        notes: { type: 'standard' }
    },

    // ========================================================================
    // ORACLE OS / STORAGE CONFIG DIALOGS
    // ========================================================================
    'oracle:multipath-io': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-multipath-io-action-summary'
            },
            {
                heading: 'databases.well-architect.optimization-steps',
                type: 'numberedSteps',
                items: [
                    'databases.well-architect.oracle-multipath-io-optimization-step1',
                    'databases.well-architect.oracle-multipath-io-optimization-step2',
                    'databases.well-architect.oracle-multipath-io-optimization-step3',
                    'databases.well-architect.oracle-multipath-io-optimization-step4',
                    'databases.well-architect.oracle-multipath-io-optimization-step5'
                ]
            }
        ],
        notes: { type: 'custom', content: 'databases.well-architect.oracle-multipath-io-note' }
    },
    'oracle:host-utilities': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-host-utility-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.oracle-host-utility-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true },
        notes: { type: 'standard' }
    },
    'oracle:selinux': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-selinux-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.oracle-selinux-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true },
        notes: { type: 'standard' }
    },
    'oracle:iscsi-replacement-timeout': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-iscsi-replacement-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.oracle-iscsi-replacement-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true },
        notes: { type: 'standard' }
    },
    'oracle:multipath-friendly-names': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-multipath-friendly-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.oracle-multipath-friendly-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true },
        notes: { type: 'standard' }
    },
    'oracle:multipath-io-sessions': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-multipath-io-sessions-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.oracle-multipath-io-sessions-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true },
        notes: { type: 'standard' }
    },
    'oracle:multipath-configuration': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-multipath-config-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.oracle-multipath-config-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true },
        notes: { type: 'standard' }
    },
    'oracle:kernel-parameters': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-kernel-parameters-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.oracle-kernel-parameters-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true },
        notes: { type: 'standard' }
    },
    'oracle:asm-setup': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-asm-setup-action-summary'
            },
            {
                heading: 'databases.well-architect.optimization-steps',
                type: 'numberedSteps',
                items: [
                    'databases.well-architect.oracle-asm-setup-optimization-step1',
                    'databases.well-architect.oracle-asm-setup-optimization-step2',
                    'databases.well-architect.oracle-asm-setup-optimization-step3',
                    'databases.well-architect.oracle-asm-setup-optimization-step4',
                    'databases.well-architect.oracle-asm-setup-optimization-step5',
                    'databases.well-architect.oracle-asm-setup-optimization-step6',
                    'databases.well-architect.oracle-asm-setup-optimization-step7',
                    'databases.well-architect.oracle-asm-setup-optimization-step8',
                    'databases.well-architect.oracle-asm-setup-optimization-step9'
                ]
            }
        ],
        notes: { type: 'custom', content: 'databases.well-architect.oracle-asm-setup-note' }
    },
    'oracle:asm-external-redundancy': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-asm-external-redundancy-action-summary'
            },
            {
                heading: 'databases.well-architect.optimization-steps',
                type: 'numberedSteps',
                items: [
                    'databases.well-architect.oracle-asm-external-redundancy-optimization-step1',
                    'databases.well-architect.oracle-asm-external-redundancy-optimization-step2',
                    'databases.well-architect.oracle-asm-external-redundancy-optimization-step3',
                    'databases.well-architect.oracle-asm-external-redundancy-optimization-step4',
                    'databases.well-architect.oracle-asm-external-redundancy-optimization-step5',
                    'databases.well-architect.oracle-asm-external-redundancy-optimization-step6',
                    'databases.well-architect.oracle-asm-external-redundancy-optimization-step7',
                    'databases.well-architect.oracle-asm-external-redundancy-optimization-step8'
                ]
            }
        ],
        notes: { type: 'custom', content: 'databases.well-architect.oracle-afd-logical-block-size-note' }
    },
    'oracle:afd-logical-block-size': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-afd-logical-block-size-action-summary'
            },
            {
                heading: 'databases.well-architect.optimization-steps',
                type: 'numberedSteps',
                items: [
                    'databases.well-architect.oracle-asm-adf-optimization-step1',
                    'databases.well-architect.oracle-asm-adf-optimization-step2',
                    'databases.well-architect.oracle-asm-adf-optimization-step3',
                    'databases.well-architect.oracle-asm-adf-optimization-step4',
                    'databases.well-architect.oracle-asm-adf-optimization-step5',
                    'databases.well-architect.oracle-asm-adf-optimization-step6'
                ]
            }
        ],
        notes: { type: 'custom', content: 'databases.well-architect.oracle-afd-logical-block-size-note' }
    },
    'oracle:asmlib-logical-block-size': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-asmlib-logical-block-size-action-summary'
            },
            {
                heading: 'databases.well-architect.optimization-steps',
                type: 'numberedSteps',
                items: [
                    'databases.well-architect.oracle-asm-adf-optimization-step1',
                    'databases.well-architect.oracle-asm-adf-optimization-step2',
                    'databases.well-architect.oracle-asm-lib-optimization-step3',
                    'databases.well-architect.oracle-asm-lib-optimization-step4',
                    'databases.well-architect.oracle-asm-lib-optimization-step5',
                    'databases.well-architect.oracle-asm-adf-optimization-step6'
                ]
            }
        ],
        notes: { type: 'custom', content: 'databases.well-architect.oracle-afd-logical-block-size-note' }
    },
    'oracle:nfs-mount-options-databasefiles': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-nfs-mount-options-dbfiles-action-summary'
            },
            {
                heading: 'databases.well-architect.optimization-steps',
                type: 'numberedSteps',
                items: [
                    'databases.well-architect.oracle-nfs-mount-options-dbfiles-step1',
                    'databases.well-architect.oracle-nfs-mount-options-dbfiles-step2',
                    'databases.well-architect.oracle-nfs-mount-options-dbfiles-step3',
                    'databases.well-architect.oracle-nfs-mount-options-dbfiles-step4'
                ]
            }
        ],
        notes: { type: 'custom', content: 'databases.well-architect.oracle-nfs-mount-options-dbfiles-note' }
    },
    'oracle:nfs-mount-options-adrhome': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-nfs-mount-options-adrhome-action-summary'
            },
            {
                heading: 'databases.well-architect.optimization-steps',
                type: 'numberedSteps',
                items: [
                    'databases.well-architect.oracle-nfs-mount-options-adrhome-step1',
                    'databases.well-architect.oracle-nfs-mount-options-adrhome-step2',
                    'databases.well-architect.oracle-nfs-mount-options-adrhome-step3',
                    'databases.well-architect.oracle-nfs-mount-options-adrhome-step4'
                ]
            }
        ],
        notes: { type: 'custom', content: 'databases.well-architect.oracle-nfs-mount-options-adrhome-note' }
    },
    'oracle:nfsv4-domain-name': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-nfsv4-domain-name-action-summary'
            },
            {
                heading: 'databases.well-architect.user-action-required',
                type: 'text',
                content: 'databases.well-architect.oracle-nfsv4-domain-name-user-action-required'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.oracle-nfsv4-domain-name-what-will-happen',
                hideWhenWad: true
            }
        ],
        notes: { type: 'custom', content: 'databases.well-architect.oracle-nfsv4-domain-name-note' }
    },
    'oracle:nfs-caching-options': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-nfs-caching-options-action-summary'
            },
            {
                heading: 'databases.well-architect.optimization-steps',
                type: 'numberedSteps',
                items: [
                    'databases.well-architect.oracle-nfs-caching-optimization-step-1',
                    'databases.well-architect.oracle-nfs-caching-optimization-step-2',
                    'databases.well-architect.oracle-nfs-caching-optimization-step-3',
                    'databases.well-architect.oracle-nfs-caching-optimization-step-4'
                ]
            }
        ],
        notes: { type: 'custom', content: 'databases.well-architect.oracle-nfs-caching-options-note' }
    },
    'oracle:dnfs-enablement': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.dnfs-enablement-action-summary'
            },
            {
                heading: 'databases.well-architect.optimization-steps',
                type: 'numberedSteps',
                items: [
                    'databases.well-architect.dnfs-enablement-optimization-step-1',
                    'databases.well-architect.dnfs-enablement-optimization-step-2',
                    'databases.well-architect.dnfs-enablement-optimization-step-3',
                    'databases.well-architect.dnfs-enablement-optimization-step-4'
                ]
            }
        ],
        notes: { type: 'custom', content: 'databases.well-architect.dnfs-enablement-note' }
    },
    'oracle:dnfs-configuration-file': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.dnfs-config-file-action-summary'
            },
            {
                heading: 'databases.well-architect.optimization-steps',
                type: 'numberedSteps',
                items: [
                    'databases.well-architect.dnfs-config-file-optimization-step-1',
                    'databases.well-architect.dnfs-config-file-optimization-step-2'
                ]
            }
        ],
        notes: { type: 'custom', content: 'databases.well-architect.dnfs-config-file-note' }
    },
    'oracle:dnfs-no-shared-cache': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.dnfs-no-shared-cache-action-summary'
            },
            {
                heading: 'databases.well-architect.optimization-steps',
                type: 'numberedSteps',
                items: [
                    'databases.well-architect.dnfs-no-shared-cache-optimization-step-1',
                    'databases.well-architect.dnfs-no-shared-cache-optimization-step-2',
                    'databases.well-architect.dnfs-no-shared-cache-optimization-step-3',
                    'databases.well-architect.dnfs-no-shared-cache-optimization-step-4'
                ]
            }
        ],
        notes: { type: 'custom', content: 'databases.well-architect.dnfs-no-shared-cache-note' }
    },

    // ========================================================================
    // ORACLE STORAGE LAYOUT
    // ========================================================================
    'oracle:redologs-placement': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.redologs-placement-action-summary'
            },
            {
                heading: 'databases.well-architect.notes',
                type: 'text',
                content: 'databases.well-architect.oracle-storagelayout-note1'
            },
            {
                heading: 'databases.well-architect.optimization-steps',
                type: 'text',
                content: 'databases.well-architect.redologs-placement-optimization-step1'
            },
            {
                heading: 'databases.well-architect.redo-logs-placement-step1',
                type: 'numberedSteps',
                items: [
                    'databases.well-architect.redo-logs-placement-step1-options1',
                    'databases.well-architect.redo-logs-placement-step1-options2',
                    'databases.well-architect.redo-logs-placement-step1-options3'
                ]
            }
        ]
    },
    'oracle:templogs-placement': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.temp-placement-action-summary'
            },
            {
                heading: 'databases.well-architect.notes',
                type: 'text',
                content: 'databases.well-architect.oracle-storagelayout-note1'
            },
            {
                heading: 'databases.well-architect.temp-placement-step1',
                type: 'numberedSteps',
                items: [
                    'databases.well-architect.temp-placement-step1-options1',
                    'databases.well-architect.temp-placement-step1-options2',
                    'databases.well-architect.temp-placement-step1-options3',
                    'databases.well-architect.temp-placement-step1-options4',
                    'databases.well-architect.temp-placement-step1-options5',
                    'databases.well-architect.temp-placement-step1-options6'
                ]
            }
        ]
    },
    'oracle:archive-placement': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.archive-placement-action-summary'
            },
            {
                heading: 'databases.well-architect.notes',
                type: 'text',
                content: 'databases.well-architect.oracle-storagelayout-note1'
            },
            {
                heading: 'databases.well-architect.optimization-steps',
                type: 'text',
                content: 'databases.well-architect.redologs-placement-optimization-step1'
            },
            {
                heading: 'databases.well-architect.archive-placement-step1',
                type: 'numberedSteps',
                items: [
                    'databases.well-architect.archive-placement-step1-options1',
                    'databases.well-architect.archive-placement-step1-options2',
                    'databases.well-architect.archive-placement-step1-options3',
                    'databases.well-architect.archive-placement-step1-options4',
                    'databases.well-architect.archive-placement-step1-options5',
                    'databases.well-architect.archive-placement-step1-options6'
                ]
            }
        ]
    },
    'oracle:datafiles-placement': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.datafile-placement-action-summary'
            },
            {
                heading: 'databases.well-architect.notes',
                type: 'text',
                content: 'databases.well-architect.oracle-storagelayout-note1'
            },
            {
                heading: 'databases.well-architect.optimization-steps',
                type: 'text',
                content: 'databases.well-architect.data-control-file-optimization-step1'
            },
            {
                heading: 'databases.well-architect.datafiles-optimization-step1',
                type: 'numberedSteps',
                items: [
                    'databases.well-architect.datafiles-optimization-step1-options1',
                    'databases.well-architect.datafiles-optimization-step1-options2',
                    'databases.well-architect.datafiles-optimization-step1-options3',
                    'databases.well-architect.datafiles-optimization-step1-options4',
                    'databases.well-architect.datafiles-optimization-step1-options5'
                ]
            }
        ]
    },
    'oracle:controlfiles-placement': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.controlfile-placement-action-summary'
            },
            {
                heading: 'databases.well-architect.notes',
                type: 'text',
                content: 'databases.well-architect.oracle-storagelayout-note1'
            },
            {
                heading: 'databases.well-architect.optimization-steps',
                type: 'text',
                content: 'databases.well-architect.data-control-file-optimization-step1'
            },
            {
                heading: 'databases.well-architect.controlfiles-optimization-step1',
                type: 'numberedSteps',
                items: [
                    'databases.well-architect.controlfiles-optimization-step1-options1',
                    'databases.well-architect.controlfiles-optimization-step1-options2',
                    'databases.well-architect.controlfiles-optimization-step1-options3',
                    'databases.well-architect.controlfiles-optimization-step1-options4',
                    'databases.well-architect.controlfiles-optimization-step1-options5'
                ]
            }
        ]
    },
    'oracle:oracle-binary-placement': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-binary-action-summary'
            },
            {
                heading: 'databases.well-architect.notes',
                type: 'text',
                content: 'databases.well-architect.oracle-storagelayout-note1'
            },
            {
                heading: 'databases.well-architect.optimization-steps',
                type: 'numberedSteps',
                items: [
                    'databases.well-architect.oracle-binary-optimization-step1',
                    'databases.well-architect.oracle-binary-optimization-step2',
                    'databases.well-architect.oracle-binary-optimization-step3',
                    'databases.well-architect.oracle-binary-optimization-step4',
                    'databases.well-architect.oracle-binary-optimization-step5',
                    'databases.well-architect.oracle-binary-optimization-step6',
                    'databases.well-architect.oracle-binary-optimization-step7',
                    'databases.well-architect.oracle-binary-optimization-step8',
                    'databases.well-architect.oracle-binary-optimization-step9'
                ]
            }
        ]
    },
    'oracle:data-dg-lun-layout': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-data-dg-lun-layout-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.oracle-data-dg-lun-layout-what-will-happen',
                hideWhenWad: true
            }
        ],
        notes: { type: 'standard' }
    },
    'oracle:log-dg-lun-layout': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-log-dg-lun-layout-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.oracle-log-dg-lun-layout-what-will-happen',
                hideWhenWad: true
            }
        ],
        notes: { type: 'standard' }
    },
    'oracle:fra-dg-lun-layout': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-fra-dg-lun-layout-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.oracle-fra-dg-lun-layout-what-will-happen',
                hideWhenWad: true
            }
        ],
        notes: { type: 'standard' }
    },

    // ========================================================================
    // ORACLE STORAGE SIZING
    // ========================================================================
    'oracle:headroom': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.file-system-headroom-with-permission'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.file-system-headroom-with-permission-content',
                hideWhenWad: true
            }
        ],
        notes: { type: 'standard' },
        conditionalOverrides: [
            {
                when: { field: 'status', equals: 'over-provisioned' },
                sections: [
                    {
                        heading: 'databases.well-architect.action-summary',
                        type: 'text',
                        content: 'databases.well-architect.oracle-filesystem-headroom-action-summary'
                    },
                    {
                        heading: 'databases.well-architect.oracle-filesystem-headroom-action-summary-heading',
                        type: 'bullets',
                        items: [
                            'databases.well-architect.oracle-filesystem-headroom-action-summary-bullet1',
                            'databases.well-architect.oracle-filesystem-headroom-action-summary-bullet2',
                            'databases.well-architect.oracle-filesystem-headroom-action-summary-bullet3'
                        ]
                    },
                    {
                        heading: 'databases.well-architect.what-will-happen',
                        type: 'text',
                        content: 'databases.well-architect.oracle-filesystem-headroom-what-will-happen',
                        hideWhenWad: true
                    },
                    {
                        heading: 'databases.well-architect.optimization-steps',
                        type: 'text',
                        content: 'databases.well-architect.oracle-filesystem-headroom-optimization-steps'
                    },
                    {
                        heading: '',
                        type: 'numberedSteps',
                        items: [
                            'databases.well-architect.oracle-filesystem-headroom-optimization-step1',
                            'databases.well-architect.oracle-filesystem-headroom-optimization-step2',
                            'databases.well-architect.oracle-filesystem-headroom-optimization-step3',
                            'databases.well-architect.oracle-filesystem-headroom-optimization-step4',
                            'databases.well-architect.oracle-filesystem-headroom-optimization-step5',
                            'databases.well-architect.oracle-filesystem-headroom-optimization-step6',
                            'databases.well-architect.oracle-filesystem-headroom-optimization-step7'
                        ]
                    }
                ]
            },
            {
                when: { field: 'hasMissingPermissions', equals: 'true' },
                sections: [
                    {
                        heading: 'databases.well-architect.action-summary',
                        type: 'text',
                        content:
                            'databases.well-architect.oracle-file-system-headroom-missing-permissions-action-summary'
                    },
                    {
                        heading: 'databases.well-architect.action-required',
                        type: 'text',
                        content:
                            'databases.well-architect.oracle-file-system-headroom-missing-permissions-action-required',
                        style: { width: '712px' }
                    },
                    {
                        heading: 'databases.well-architect.oracle-file-system-headroom-option1',
                        type: 'permissions',
                        content: 'databases.well-architect.oracle-file-system-headroom-option1-description',
                        style: { width: '712px' }
                    },
                    {
                        heading: 'databases.well-architect.oracle-file-system-headroom-option2',
                        type: 'numberedSteps',
                        items: [
                            'databases.well-architect.oracle-file-system-headroom-option2-step1',
                            'databases.well-architect.oracle-file-system-headroom-option2-step2',
                            'databases.well-architect.oracle-file-system-headroom-option2-step3',
                            'databases.well-architect.oracle-file-system-headroom-option2-step4'
                        ],
                        style: { width: '712px' }
                    }
                ]
            }
        ]
    },
    'oracle:swap-space': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-swap-space-action-summary'
            },
            {
                heading: 'databases.well-architect.oracle-swap-space-action-summary-heading',
                type: 'bullets',
                items: [
                    'databases.well-architect.oracle-swap-space-action-summary-bullet1',
                    'databases.well-architect.oracle-swap-space-action-summary-bullet2',
                    'databases.well-architect.oracle-swap-space-action-summary-bullet3'
                ]
            },
            {
                heading: 'databases.well-architect.optimization-steps',
                type: 'numberedSteps',
                items: [
                    'databases.well-architect.oracle-swap-space-optimization-step1',
                    'databases.well-architect.oracle-swap-space-optimization-step2',
                    'databases.well-architect.oracle-swap-space-optimization-step3',
                    'databases.well-architect.oracle-swap-space-optimization-step4',
                    'databases.well-architect.oracle-swap-space-optimization-step5'
                ]
            }
        ],
        notes: { type: 'custom', content: 'databases.well-architect.oracle-swap-space-note' }
    },

    // ========================================================================
    // ORACLE COMPUTE
    // ========================================================================
    'oracle:transparent-hugepages': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-transparent-hugepages-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.oracle-transparent-hugepages-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true },
        notes: { type: 'standard' }
    },
    'oracle:tcp-advanced-options': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-tcp-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.oracle-tcp-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true },
        notes: { type: 'standard' }
    },
    'oracle:filesystems-io-options': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-filesystem-io-options-action-summary'
            },
            {
                heading: 'databases.well-architect.optimization-steps',
                type: 'numberedSteps',
                items: [
                    'databases.well-architect.oracle-filesystem-io-options-optimization-step1',
                    'databases.well-architect.oracle-filesystem-io-options-optimization-step2',
                    'databases.well-architect.oracle-filesystem-io-options-optimization-step3'
                ]
            }
        ],
        notes: { type: 'custom', content: 'databases.well-architect.oracle-multipath-io-note' }
    },
    'oracle:multiblock-readcount': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-multiblock-readcount-action-summary'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'text',
                content: 'databases.well-architect.oracle-multiblock-readcount-what-will-happen',
                hideWhenWad: true
            }
        ],
        features: { showOntapConfigCodeBox: true },
        notes: { type: 'standard' }
    },
    'oracle:host-os-patch': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-os-patch-action-summary'
            }
        ],
        features: { showPatchTable: true, patchField: 'HOST_OS_PATCH' }
    },

    // ========================================================================
    // ORACLE APPLICATION (Security Patches)
    // ========================================================================
    'oracle:oracle-security-patch': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-critical-patch-action-summary'
            }
        ],
        features: { showPatchTable: true, patchField: 'ORACLE_SECURITY_PATCH' }
    },

    // ========================================================================
    // ORACLE RESILIENCY
    // ========================================================================
    'oracle:crr': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-crr-action-summary'
            },
            {
                heading: 'databases.well-architect.oracle-crr-about-links',
                type: 'text',
                content: 'databases.well-architect.oracle-crr-about-links-description'
            },
            {
                heading: 'databases.well-architect.what-will-happen',
                type: 'numberedSteps',
                items: [
                    'databases.well-architect.oracle-crr-what-will-happen-step1',
                    'databases.well-architect.oracle-crr-what-will-happen-step4',
                    'databases.well-architect.oracle-crr-what-will-happen-step5',
                    'databases.well-architect.oracle-crr-what-will-happen-step6',
                    'databases.well-architect.oracle-crr-what-will-happen-step7',
                    'databases.well-architect.oracle-crr-what-will-happen-step8'
                ]
            }
        ],
        notes: {
            type: 'custom',
            items: [
                'databases.well-architect.oracle-crr-notes-bullet1',
                'databases.well-architect.oracle-crr-notes-bullet2',
                'databases.well-architect.oracle-crr-notes-bullet3',
                'databases.well-architect.oracle-crr-select-continue'
            ]
        }
    },
    'oracle:snapcenter-snapshot': {
        sections: [
            {
                heading: 'databases.well-architect.action-summary',
                type: 'text',
                content: 'databases.well-architect.oracle-snapcenter-action-summary'
            },
            {
                heading: 'databases.well-architect.optimization-steps',
                type: 'numberedSteps',
                items: [
                    'databases.well-architect.oracle-snapcenter-step1',
                    'databases.well-architect.oracle-snapcenter-step2',
                    'databases.well-architect.oracle-snapcenter-step3',
                    'databases.well-architect.oracle-snapcenter-step4',
                    'databases.well-architect.oracle-snapcenter-step5',
                    'databases.well-architect.oracle-snapcenter-step6'
                ]
            }
        ],
        notes: { type: 'custom', content: 'databases.well-architect.oracle-snapcenter-notes' }
    },
    'oracle:backup-configuration': {
        sections: [],
        features: { showCustomBackupUI: true }
    }
};
