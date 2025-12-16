import MSSQL_GOLDEN_CONFIG from '../operations/continuous-optimization/mssql/golden-config';
import ORACLE_GOLDEN_CONFIG from '../operations/continuous-optimization/oracle/golden-config';

interface ParameterCategoryMap {
    category: string;
    subCategory: string;
}

interface ConfigItem {
    name?: string;
    parameter?: string;
    category: string;
    subCategory: string;
    [key: string]: unknown;
}

interface ConfigObject {
    category: string;
    subCategory: string;
    [key: string]: unknown;
}

/**
 * Generates a map of parameter names to their category and subcategory from MSSQL golden config
 * @returns Map where key is parameter name and value is {category, subCategory}
 */
function generateMsSqlParameterCategoryMap(): Map<string, ParameterCategoryMap> {
    const parameterMap = new Map<string, ParameterCategoryMap>();

    // Process configuration items inside GOLDEN_CONFIG.configuration
    Object.entries(MSSQL_GOLDEN_CONFIG.configuration).forEach(([, value]: [string, unknown]) => {
        // Handle array configurations (volume, lun, os)
        if (Array.isArray(value)) {
            value.forEach((item: unknown) => {
                const configItem = item as ConfigItem;
                // MSSQL uses parameter field
                if (configItem.parameter && configItem.category && configItem.subCategory) {
                    parameterMap.set(configItem.parameter, {
                        category: configItem.category,
                        subCategory: configItem.subCategory
                    });
                }
            });
        }
    });

    // Process top-level configuration items (cloning, hostOsPatch, license, maxdop, etc.)
    Object.entries(MSSQL_GOLDEN_CONFIG).forEach(([key, value]: [string, unknown]) => {
        // Skip the 'configuration' key as we've already processed it
        if (key === 'configuration') {
            return;
        }

        // Handle array configurations (sizing, etc.)
        if (Array.isArray(value)) {
            value.forEach((item: unknown) => {
                const configItem = item as ConfigItem;
                // MSSQL uses parameter field
                if (configItem.parameter && configItem.category && configItem.subCategory) {
                    parameterMap.set(configItem.parameter, {
                        category: configItem.category,
                        subCategory: configItem.subCategory
                    });
                }
            });
        }
        // Handle object configurations (cloning, hostOsPatch, license, maxdop, etc.)
        else if (
            typeof value === 'object' &&
            value !== null &&
            (value as ConfigObject).category &&
            (value as ConfigObject).subCategory
        ) {
            const configObj = value as ConfigObject;
            parameterMap.set(key, {
                category: configObj.category as string,
                subCategory: configObj.subCategory as string
            });
        }
    });

    return parameterMap;
}

/**
 * Generates a map of parameter names to their category and subcategory from Oracle golden config
 * @returns Map where key is parameter name and value is {category, subCategory}
 */
function generateOracleParameterCategoryMap(): Map<string, ParameterCategoryMap> {
    const parameterMap = new Map<string, ParameterCategoryMap>();

    // Process configuration items inside GOLDEN_CONFIG.configuration
    Object.entries(ORACLE_GOLDEN_CONFIG.configuration).forEach(([, value]: [string, unknown]) => {
        // Handle array configurations (volume, lun, os, etc.)
        if (Array.isArray(value)) {
            value.forEach((item: unknown) => {
                const configItem = item as ConfigItem;
                if (configItem.name && configItem.category && configItem.subCategory) {
                    parameterMap.set(configItem.name, {
                        category: configItem.category,
                        subCategory: configItem.subCategory
                    });
                }
            });
        }
    });

    // Process top-level configuration items
    Object.entries(ORACLE_GOLDEN_CONFIG).forEach(([key, value]: [string, unknown]) => {
        // Skip the 'configuration' key as we've already processed it
        if (key === 'configuration') {
            return;
        }

        // Handle array configurations (sizing, etc.)
        if (Array.isArray(value)) {
            value.forEach((item: unknown) => {
                const configItem = item as ConfigItem;
                if (configItem.name && configItem.category && configItem.subCategory) {
                    parameterMap.set(configItem.name, {
                        category: configItem.category,
                        subCategory: configItem.subCategory
                    });
                }
            });
        }
        // Handle object configurations
        else if (
            typeof value === 'object' &&
            value !== null &&
            (value as ConfigObject).category &&
            (value as ConfigObject).subCategory
        ) {
            const configObj = value as ConfigObject;
            parameterMap.set(key, {
                category: configObj.category as string,
                subCategory: configObj.subCategory as string
            });
        }
    });

    return parameterMap;
}

/**
 * Combines both MSSQL and Oracle parameter category maps into a single map
 * Keeps both MSSQL and Oracle entries without overwriting
 * @returns Map where key is parameter name and value is {category, subCategory}
 */
function generateCombinedParameterCategoryMaps(): Map<string, ParameterCategoryMap> {
    const combinedMap = new Map<string, ParameterCategoryMap>();

    // Add all MSSQL parameters
    const mssqlMap = generateMsSqlParameterCategoryMap();
    mssqlMap.forEach((value, key) => {
        combinedMap.set(key, value);
    });

    // Add all Oracle parameters (only add if key doesn't already exist to preserve MSSQL values)
    const oracleMap = generateOracleParameterCategoryMap();
    oracleMap.forEach((value, key) => {
        if (!combinedMap.has(key)) {
            combinedMap.set(key, value);
        }
    });

    return combinedMap;
}

export {
    generateCombinedParameterCategoryMaps,
    ParameterCategoryMap,
    generateMsSqlParameterCategoryMap,
    generateOracleParameterCategoryMap
};
