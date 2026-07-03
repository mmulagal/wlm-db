import { ASSESSMENT_CONFIG_NAMES } from '../../../../utils/consts';
import { getConfigIdsByLinkedGroup } from '../../../../utils/configRegistry';

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
    ASSESSMENT_CONFIG_NAMES.TIERING_TCO_OPTIMIZATION,
    ASSESSMENT_CONFIG_NAMES.STORAGE_EFFICIENCIES
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
