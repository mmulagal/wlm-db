import { ASSESSMENT_CONFIG_NAMES, CONFIG_NAME_TO_ID_MAPPING } from '../../../../utils/consts';
import { getConfigIdsByLinkedGroup } from '../../../../utils/configRegistry';
import { AssessmentResponseInterface } from '../../../../utils/types/getWellTypes';

/** Recommended value that indicates the layout config should be excluded from dependency warnings */
const EXCLUDED_RECOMMENDED = 'multiplexed-copies-on-two-or-more-volumes';

/**
 * Oracle Storage Layout parent configurations.
 * These 3 configs affect ONTAP sub-configuration recommendations.
 */
export const ORACLE_LAYOUT_CONFIGS: string[] = [
    ASSESSMENT_CONFIG_NAMES.DATAFILES_PLACEMENT,
    ASSESSMENT_CONFIG_NAMES.REDO_LOGS_PLACEMENT,
    ASSESSMENT_CONFIG_NAMES.ARCHIVE_PLACEMENT
];

/** Oracle Storage Layout parent configurations (kebab-case IDs, derived from unified registry) */
const ORACLE_LAYOUT_CONFIG_IDS: string[] = getConfigIdsByLinkedGroup('layout');

export const ORACLE_ONTAP_CONFIGS: string[] = [
    ASSESSMENT_CONFIG_NAMES.TIERING_POLICY,
    ASSESSMENT_CONFIG_NAMES.TIERING_MINIMUM_COOLING_DAYS,
    ASSESSMENT_CONFIG_NAMES.COMPRESSION,
    ASSESSMENT_CONFIG_NAMES.DEDUPLICATION,
    ASSESSMENT_CONFIG_NAMES.COMPACTION
];

/** Oracle ONTAP sub-config IDs (kebab-case, derived from unified registry) */
const ORACLE_ONTAP_CONFIG_IDS: string[] = getConfigIdsByLinkedGroup('ontap');

/** Returns true if the given config name or ID is a storage layout parent config */
export const isLayoutConfig = (configName: string): boolean =>
    ORACLE_LAYOUT_CONFIGS.includes(configName) || ORACLE_LAYOUT_CONFIG_IDS.includes(configName);

/** Returns true if the given config name or ID is an ONTAP sub-config */
export const isOntapConfig = (configName: string): boolean =>
    ORACLE_ONTAP_CONFIGS.includes(configName) || ORACLE_ONTAP_CONFIG_IDS.includes(configName);

/** Returns true if the config is any linked config (layout or ONTAP) */
export const isLinkedConfig = (configName: string): boolean => isLayoutConfig(configName) || isOntapConfig(configName);

/**
 * For a layout config, returns the ONTAP sub-configs.
 * For an ONTAP config, returns the layout parent configs.
 */
export const getLinkedConfigNames = (configName: string): string[] => {
    if (isLayoutConfig(configName)) {
        return ORACLE_ONTAP_CONFIGS;
    }
    if (isOntapConfig(configName)) {
        return ORACLE_LAYOUT_CONFIGS;
    }
    return [];
};

/** Returns layout config names that have 'not-optimized' status for a given ONTAP sub-config */
export const getFilteredLinkedConfigNames = (
    configName: string,
    driftAssessmentData: AssessmentResponseInterface | null
): string[] => {
    if (!isOntapConfig(configName)) {
        return getLinkedConfigNames(configName);
    }

    const layoutData = driftAssessmentData?.storage?.layout || [];
    const oracleLayoutMap = CONFIG_NAME_TO_ID_MAPPING.ORACLE_STORAGE_LAYOUT_MAP as Record<string, string>;

    return ORACLE_LAYOUT_CONFIGS.filter(layoutConfig => {
        const layoutId = oracleLayoutMap[layoutConfig];
        const assessmentItem = layoutData.find((item: any) => item.name === layoutId);

        if (!assessmentItem?.status) return false;

        if (layoutConfig === ASSESSMENT_CONFIG_NAMES.REDO_LOGS_PLACEMENT) {
            return assessmentItem.status === 'not-optimized' && assessmentItem.recommended !== EXCLUDED_RECOMMENDED;
        }
        return assessmentItem.status === 'not-optimized';
    });
};
