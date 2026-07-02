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
import { ASSESSMENT_CONFIG_IDS, DBType, OPTIMIZE_PAYLOAD_TYPES, WELL_ARCHITECTED_STATUS } from '../consts';
import mssqlRegistry from './mssqlConfigRegistry.json';
import oracleRegistry from './oracleConfigRegistry.json';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Simple pluralization helper for resource type labels.
 * Handles common English pluralization rules for database resource types.
 * Preserves original casing where appropriate.
 *
 * @param singular - Singular form of the word (e.g., "Volume", "Database", "LUN")
 * @returns Plural form with "Impacted" prefix (e.g., "Impacted volumes", "Impacted LUNs")
 */
export function pluralizeResourceType(singular: string): string {
    const lower = singular.toLowerCase();
    let plural: string;

    // Special cases (preserve specific casing)
    if (lower === 'lun') {
        plural = 'LUNs';
    } else if (lower === 'ec2 instance') {
        plural = 'EC2 instances';
    } else if (lower.endsWith('s') || lower.endsWith('x') || lower.endsWith('ch') || lower.endsWith('sh')) {
        // Words ending in s, x, ch, sh → add 'es'
        plural = `${lower}es`;
    } else if (lower.endsWith('y') && !/[aeiou]y$/.test(lower)) {
        // Words ending in consonant + y → replace y with 'ies'
        plural = `${lower.slice(0, -1)}ies`;
    } else {
        // Default: add 's' (keep lowercase for consistency)
        plural = `${lower}s`;
    }

    return `Impacted ${plural}`;
}

// ============================================================================
// Type Definitions (same shapes as old getWellConfigRegistry.ts)
// ============================================================================

/**
 * Custom height overrides for GetWell card sections.
 * Controls the visual layout of cards on the Well-Architected dashboard.
 * Heights are CSS values (px, %, vh, etc.).
 */
export interface CardHeights {
    /** Height of the recommendation text section (top part of card) */
    recommendationSection: string;
    /** Height of the tag/status section (bottom part of card) */
    tagSection: string;
}

/**
 * Metadata configuration for card display on the GetWell dashboard.
 * Controls labels, counts, and which data fields to display on the card.
 */
export interface CardMetadata {
    /**
     * Display label for impacted resources shown on the card.
     * Should be descriptive and match the finding type.
     *
     * @example "Impacted volumes"
     * @example "Impacted databases"
     * @example "Impacted adapters"
     */
    impactedLabel: string;

    /**
     * Source field name for the count displayed on the card.
     * Determines which property in the API response contains the count.
     *
     * @default 'impactedCount' - most findings use this
     * @example 'totalObjectsInViolation' - used for some findings with different response structure
     */
    countSource?: 'impactedCount' | 'totalObjectsInViolation';

    /**
     * Optional field name for the recommendation text source.
     * If provided, reads recommendation from this field instead of default.
     *
     * @example "recommendationText"
     */
    recommendationSource?: string;
}

/**
 * Configuration for table columns and display in the Optimize Inner Page.
 * Used to dynamically render tables for impacted resources (volumes, databases, adapters, etc.)
 */
export interface ColumnConfig {
    /**
     * Array of column definitions for the table.
     * Each column must have a key (unique identifier) and label (display text).
     */
    columns: Array<{
        /** Unique identifier for the column (used as React key) */
        key: string;
        /** Display label shown in the table header */
        label: string;
        /** Path to access data from the row object (e.g., "objectName", "current.value") */
        accessor?: string;
        /** CSS width value for the column (e.g., "200px", "30%") */
        width?: string;
    }>;

    /**
     * SINGULAR form of the resource type label.
     * Used in the UI for both singular and plural contexts.
     * The plural form is auto-generated using pluralizeResourceType().
     *
     * - Singular context: shown as-is (e.g., "Volume")
     * - Plural context: auto-generated as "Impacted {plural}" (e.g., "Impacted volumes")
     *
     * If not provided, defaults to "Item" / "Impacted items".
     *
     * @example "Volume" → Singular: "Volume", Plural: "Impacted volumes"
     * @example "Database" → Singular: "Database", Plural: "Impacted databases"
     * @example "LUN" → Singular: "LUN", Plural: "Impacted LUNs"
     */
    resourceTypeLabel?: string;

    /**
     * OPTIONAL: Override the auto-generated plural table title.
     * Only use this for special cases where the auto-generated title is not appropriate.
     * When provided, this exact string is used instead of pluralizing resourceTypeLabel.
     *
     * Common use cases:
     * - ASM-specific titles (e.g., "ASM logs disk group LUNs")
     * - Context-specific titles (e.g., "NFS mount options")
     * - Custom groupings that don't follow standard pluralization
     *
     * If not provided, title is auto-generated as "Impacted {resourceTypeLabel}s".
     *
     * @example "ASM logs disk group LUNs" - specific ASM context
     * @example "dNFS shared cache settings" - specific dNFS context
     * @example "NFS mount options" - not a standard resource pluralization
     */
    tableTitle?: string;

    /**
     * Whether to use nested expandable rows for hierarchical data.
     * When true, renders NestedDynamicInnerTable component for parent-child relationships
     * (e.g., databases with their associated volumes).
     *
     * @default false
     */
    useNestedExpandable?: boolean;

    /**
     * Indicates this configuration has nested sub-configurations.
     * Used for findings with multiple levels of impacted resources
     * (e.g., storage efficiencies with LUNs that have volumes).
     *
     * @default false
     */
    hasSubConfigs?: boolean;

    /**
     * Optional data mapping configuration for extracting table data from API responses.
     * Specifies which paths in the response contain the data and optional status filters.
     */
    dataMapping?: {
        /** Array of source paths to extract data from */
        sources: Array<{
            /** JSONPath-like string to locate data in response (e.g., "data.volumes") */
            path: string;
            /** Optional status filter to apply (e.g., "active", "pending") */
            status?: string;
        }>;
    };
}

/**
 * Valid mutation names for optimize/fix API calls.
 * Each mutation corresponds to a specific RTK Query mutation in the API slice.
 */
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

/**
 * Scope of the optimize payload - determines how resources are selected.
 */
export type PayloadScope = 'credential-scoped' | 'bulk';

/**
 * Configuration for optimize/fix API calls.
 * Defines which mutation to invoke, how to construct the payload,
 * and whether bulk operations are supported.
 */
export interface OptimizeApiConfig {
    /**
     * RTK Query mutation name to invoke for this optimization.
     * Must match a mutation defined in the API slice.
     *
     * @see OptimizeApiMutation
     */
    mutation: OptimizeApiMutation;

    /**
     * Scope of the payload sent to the API.
     * - 'credential-scoped': Uses all resources under a credential
     * - 'bulk': Uses only selected resources from the table
     *
     * @example 'bulk' - most findings use bulk selection
     * @example 'credential-scoped' - some findings affect entire credential
     */
    payloadScope: PayloadScope;

    /**
     * Optional API config name used in the payload.
     * Maps to specific backend configuration keys.
     *
     * @example "mtu-alignment", "maxdop-config"
     */
    apiConfigName?: string;

    /**
     * Optional HA (High Availability) URL segment.
     * Used for HA-specific optimizations (e.g., shared-storage, failover-cluster).
     *
     * @example "shared-storage", "failover-cluster"
     */
    haUrlSegment?: string;

    /**
     * Oracle-specific OS type for payload construction.
     * Used only for Oracle operating system optimizations.
     *
     * @see OPTIMIZE_PAYLOAD_TYPES constant
     */
    oracleOsType?: (typeof OPTIMIZE_PAYLOAD_TYPES)[keyof typeof OPTIMIZE_PAYLOAD_TYPES];

    /**
     * Whether configName should be sent as an array in the payload.
     * When true, wraps single configName in array format.
     *
     * @default false
     */
    usesConfigNameArray?: boolean;

    /**
     * Type of status being optimized (for tracking/filtering purposes).
     * Determines which status field to update after optimization.
     *
     * @example "storage", "os", "compute", "ha"
     */
    statusType: string;

    /**
     * Whether this optimization supports bulk fix from the dashboard card.
     * When true, shows "Fix All" button on the dashboard card.
     * When false, requires opening inner page for individual selection.
     *
     * @default false
     */
    supportsDashboardBulk: boolean;
}

/**
 * Types of content sections that can appear in the details dialog.
 * Each type renders differently in the UI.
 */
export type DialogSectionType =
    | 'text' // Simple paragraph text
    | 'bullets' // Bulleted list
    | 'numberedSteps' // Numbered steps (1., 2., 3.)
    | 'numberedStepsWithCode' // Numbered steps with inline code snippets
    | 'numberedList' // Numbered list with sub-items
    | 'codeBox' // Syntax-highlighted code block
    | 'permissions' // IAM permissions list (special formatting)
    | 'table' // Data table
    | 'select'; // Dropdown selector

/**
 * Definition of a single content section in the details dialog.
 * Sections are rendered sequentially in the dialog.
 */
export interface DialogSectionDef {
    /**
     * Optional heading/title for this section.
     * Displayed prominently above the section content.
     * Should be a translation key from i18n.
     */
    heading?: string;

    /**
     * Type of content to render for this section.
     * @see DialogSectionType
     */
    type: DialogSectionType;

    /**
     * Main content text or translation key.
     * For 'text' and 'codeBox' types, this is the full content.
     * For other types, may reference i18n key.
     */
    content?: string;

    /**
     * Array of items for list-based section types.
     * Used by 'bullets', 'numberedSteps', 'numberedList', 'permissions'.
     * Each item should be a string or translation key.
     */
    items?: string[];

    /**
     * Optional parameters for dynamic content interpolation.
     * Used to replace placeholders in i18n strings.
     *
     * @example { dbName: 'mydb', count: '5' }
     */
    params?: Record<string, string>;

    /**
     * Whether to hide this section when viewing WAD (offline assessment) data.
     * When true, section only appears for live/continuous assessments.
     *
     * @default false
     */
    hideWhenWad?: boolean;

    /**
     * Optional inline styles for the section container.
     */
    style?: { width?: string };
}

/**
 * Configuration for the details dialog content.
 * Defines all sections, features, notes, and conditional content
 * shown when user clicks "View details" on a finding card.
 */
export interface DialogContentConfig {
    /**
     * Array of content sections to display in the dialog.
     * Sections render in order from top to bottom.
     *
     * @see DialogSectionDef
     */
    sections: DialogSectionDef[];

    /**
     * Optional special features to enable in the dialog.
     * Controls display of special UI components and tables.
     */
    features?: {
        /** Show ONTAP configuration code box with ONTAP CLI commands */
        showOntapConfigCodeBox?: boolean;
        /** Show banner for linked configuration groups (layout/ontap) */
        showLinkedConfigBanner?: boolean;
        /** Show banner for linked configuration groups in dialog only (overrides showLinkedConfigBanner for dialog) */
        showLinkedConfigBannerInDialog?: boolean;
        /** Show patch installation table (for OS patch findings) */
        showPatchTable?: boolean;
        /** Show instance selector dropdown */
        showInstanceSelector?: boolean;
        /** Show custom AWS Backup UI */
        showCustomBackupUI?: boolean;
        /** Field name for patch data in API response */
        patchField?: string;
        /** Column configuration for patch table */
        patchColumns?: Array<{
            header: string;
            accessor: string;
            width: string;
        }>;
    };

    /**
     * Well-Architected config name(s) for linking to AWS documentation.
     * Can be single string or array for multiple config references.
     *
     * @example "storage-tier-alignment"
     * @example ["config-1", "config-2"]
     */
    wellArchitectedConfig?: string | string[];

    /**
     * Optional sections to show after patch installation completes.
     * Only used for patch-related findings.
     */
    postPatchSections?: DialogSectionDef[];

    /**
     * Optional notes/warnings to display at the bottom of the dialog.
     * Different note types have different icons and styling.
     */
    notes?: {
        /** Note type determines icon and formatting */
        type: 'standard' | 'os' | 'failover' | 'clusterQuorum' | 'driveLetter' | 'custom';
        /** Main note content (translation key or text) */
        content?: string;
        /** Array of note items for multi-point notes */
        items?: string[];
    };

    /**
     * Conditional content overrides based on finding data.
     * Allows showing different sections/notes based on field values.
     *
     * @example Show different instructions for Windows vs Linux
     */
    conditionalOverrides?: Array<{
        /** Condition to match */
        when: {
            /** Field name to check */
            field: string;
            /** Value to match */
            equals: string;
        };
        /** Sections to show when condition matches */
        sections: DialogSectionDef[];
        /** Notes to show when condition matches */
        notes?: DialogContentConfig['notes'];
    }>;
}

/**
 * Complete configuration entry for a GetWell finding (configId).
 * Each finding in the Well-Architected Assessment has a config entry that controls
 * its UI behavior, card display, inner page table, fix/optimize actions, and dialog content.
 *
 * @example
 * {
 *   "hasInnerPage": true,
 *   "viewOnly": false,
 *   "fixSupported": true,
 *   "cardHeights": { "recommendationSection": "200px", "tagSection": "300px" },
 *   "cardMetadata": { "impactedLabel": "Impacted volumes", "countSource": "impactedCount" },
 *   "columns": { "columns": [...], "resourceTypeLabel": "Volume" },
 *   "optimizeApi": { "mutation": "optimizeStorageConfig", "payloadScope": "bulk" },
 *   "dialogContent": { "sections": [...] }
 * }
 */
export interface ConfigEntry {
    /**
     * Whether this finding has a dedicated inner page with detailed table view.
     * When true, clicking the card opens OptimizeInnerPage with impacted resources table.
     * When false, the card is view-only and opens a simple dialog with details.
     *
     * @example true - storage-tier-alignment (opens table of impacted volumes)
     * @example false - simple informational findings
     */
    hasInnerPage: boolean;

    /**
     * Whether this finding is view-only (no fix/optimize action available).
     * View-only findings display information but cannot be remediated through UI.
     *
     * @example true - informational findings, manual remediation required
     * @example false - findings with automated fix support
     */
    viewOnly: boolean;

    /**
     * Whether the fix/optimize action is supported for this finding.
     * When true, shows "Fix" button and allows bulk optimization.
     * Must be false if viewOnly is true.
     *
     * @example true - storage config optimizations, patch installations
     * @example false - view-only findings, informational items
     */
    fixSupported: boolean;

    /**
     * Explicitly marks that optimize/fix action is not available.
     * Used for findings that should show UI but have no remediation path yet.
     *
     * @default undefined (optimize available if fixSupported=true)
     */
    optimizeNotAvailable?: boolean;

    /**
     * Custom heights for the card sections on the GetWell dashboard.
     * Controls the visual layout of recommendation and tag sections.
     * If not provided, uses default heights from the card component.
     *
     * @see CardHeights interface
     */
    cardHeights?: CardHeights;

    /**
     * Metadata for card display - labels, counts, and recommendation text sources.
     * Controls what text appears on the card and where data comes from.
     *
     * @see CardMetadata interface
     */
    cardMetadata?: CardMetadata;

    /**
     * Column configuration for the inner page table (when hasInnerPage=true).
     * Defines table structure, columns, resource type labels, and data mapping.
     * Required if hasInnerPage=true.
     *
     * @see ColumnConfig interface
     */
    columns?: ColumnConfig;

    /**
     * API configuration for fix/optimize actions.
     * Specifies which mutation to call, payload scope (single/bulk/both),
     * and how to construct the request payload.
     * Required if fixSupported=true.
     *
     * @see OptimizeApiConfig interface
     */
    optimizeApi?: OptimizeApiConfig;

    /**
     * Configuration for the details dialog that opens when clicking "View details".
     * Defines sections (text, code, tables, patches), notes, and conditional overrides.
     *
     * @see DialogContentConfig interface
     */
    dialogContent?: DialogContentConfig;

    /**
     * Groups related findings together for coordinated fixes.
     * Findings in the same linkedConfigGroup can be fixed together.
     *
     * @example 'layout' - storage layout findings that must be fixed together
     * @example 'ontap' - ONTAP-specific configurations
     */
    linkedConfigGroup?: 'layout' | 'ontap';

    /**
     * Whether the fix button state depends on the finding status.
     * When true, fix is only enabled for specific statuses (e.g., not for 'compliant').
     * Used for findings where fixing an already-compliant item doesn't make sense.
     *
     * @default false
     */
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

/** True when optimization is not available for this config (button shows N/A with tooltip). */
export const isOptimizeNotAvailable = (configId: string, dbType: string): boolean =>
    getRegistry(dbType)[configId]?.optimizeNotAvailable ?? false;

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

    // Storage capacity configs (headroom, log-drive-size, tempdb-drive-size) have special fix rules
    // These configs can be over-provisioned or under-provisioned and have conditional fix support
    const storageCapacityConfigs: string[] = [
        ASSESSMENT_CONFIG_IDS.FILE_SYSTEM_HEADROOM,
        ASSESSMENT_CONFIG_IDS.FILE_SYSTEM_HEADROOM_MSSQL,
        ASSESSMENT_CONFIG_IDS.LOG_DRIVE_SIZE,
        ASSESSMENT_CONFIG_IDS.TEMPDB_DRIVE_SIZE
    ];

    if (storageCapacityConfigs.includes(configId)) {
        // Over-provisioned storage capacity configs cannot be fixed
        if (normalizedStatus === WELL_ARCHITECTED_STATUS.OVER_PROVISIONED) return false;
        // Under-provisioned with missing permissions cannot be fixed
        if (
            normalizedStatus === WELL_ARCHITECTED_STATUS.UNDER_PROVISIONED &&
            missingPermissions &&
            missingPermissions.length > 0
        )
            return false;
        // For Oracle headroom, it's fixable (if not over-provisioned or missing permissions)
        // For MSSQL, check registry entry
        if (
            dbType === DBType.ORACLE &&
            (configId === ASSESSMENT_CONFIG_IDS.FILE_SYSTEM_HEADROOM ||
                configId === ASSESSMENT_CONFIG_IDS.FILE_SYSTEM_HEADROOM_MSSQL)
        )
            return true;
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
export const getCardMetadata = (configId: string, dbType?: string): CardMetadata => {
    // Try to get card metadata from the appropriate registry
    const mssqlEntry = (mssqlRegistry as unknown as RegistryMap)[configId];
    const oracleEntry = (oracleRegistry as unknown as RegistryMap)[configId];
    const cardMetadata = mssqlEntry?.cardMetadata || oracleEntry?.cardMetadata;

    // If cardMetadata exists, return it
    if (cardMetadata) {
        return cardMetadata;
    }

    // Fallback: try to derive impactedLabel from columns.resourceTypeLabel if available
    const columnConfig = getColumnConfig(configId, dbType);
    if (columnConfig?.resourceTypeLabel) {
        return {
            impactedLabel: pluralizeResourceType(columnConfig.resourceTypeLabel),
            countSource: 'totalObjectsInViolation'
        };
    }

    // Ultimate fallback: default metadata
    return DEFAULT_CARD_METADATA;
};

/** Column config for inner page tables. Undefined for dialog-only configs. */
export const getColumnConfig = (configId: string, dbType?: string): ColumnConfig | undefined => {
    if (dbType) {
        return getRegistry(dbType)[configId]?.columns;
    }
    // Fallback for backward compatibility: try both registries
    const mssqlEntry = (mssqlRegistry as unknown as RegistryMap)[configId];
    const oracleEntry = (oracleRegistry as unknown as RegistryMap)[configId];
    return mssqlEntry?.columns || oracleEntry?.columns;
};

/**
 * Builds `current` and `recommended` display strings for configs with nested sub-configs
 * (e.g. storage-efficiencies: compression/deduplication/compaction).
 */

const getSubConfigKey = (entry: { id?: string; name?: string }): string => entry.id ?? entry.name ?? '';

export const buildSubConfigValues = (
    row: any,
    configDetails: Array<any> = []
): { current: string; recommended: string } => {
    const currentByName = new Map<string, string>(
        (row?.violatedConfigs || [])
            .map((c: any) => [getSubConfigKey(c), c.current] as [string, unknown])
            .filter(([key]: [string, unknown]) => key !== '')
    );
    const dataCategory: string | undefined = row?.dataCategory;

    const entries = configDetails
        .map((cfg: any) => {
            const subConfigKey = getSubConfigKey(cfg);
            const recommended =
                cfg.recommended || (dataCategory ? cfg.recommendedByDataCategory?.[dataCategory] : undefined) || '';
            const current = currentByName.get(subConfigKey) || recommended;
            return { name: subConfigKey, current, recommended };
        })
        .filter(entry => entry.name !== '');

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
