import { MSSQL_GOLDEN_CONFIG } from '../operations/continuous-optimization/mssql/golden-config';
import ORACLE_GOLDEN_CONFIG from '../operations/continuous-optimization/oracle/golden-config';

interface ParameterCategoryMap {
    type: string;
    subType: string;
}

/**
 * Generates a map of parameter names to their type and subType from MSSQL golden config
 */
function generateMsSqlParameterCategoryMap(): Map<string, ParameterCategoryMap> {
    const parameterMap = new Map<string, ParameterCategoryMap>();
    MSSQL_GOLDEN_CONFIG.forEach(entry => {
        const key = entry.parameter ?? entry.id;
        if (key && entry.type && entry.subType) {
            parameterMap.set(key, { type: entry.type, subType: entry.subType });
        }
    });
    return parameterMap;
}

/**
 * Generates a map of parameter names to their type and subType from Oracle golden config
 */
function generateOracleParameterCategoryMap(): Map<string, ParameterCategoryMap> {
    const parameterMap = new Map<string, ParameterCategoryMap>();
    ORACLE_GOLDEN_CONFIG.forEach(entry => {
        const key = entry.id;
        if (key && entry.type && entry.subType) {
            parameterMap.set(key, { type: entry.type, subType: entry.subType });
        }
    });
    return parameterMap;
}

/**
 * Combines both MSSQL and Oracle parameter category maps into a single map.
 * MSSQL entries take precedence when keys collide.
 */
function generateCombinedParameterCategoryMaps(): Map<string, ParameterCategoryMap> {
    const combinedMap = new Map<string, ParameterCategoryMap>();

    generateMsSqlParameterCategoryMap().forEach((value, key) => {
        combinedMap.set(key, value);
    });

    generateOracleParameterCategoryMap().forEach((value, key) => {
        if (!combinedMap.has(key)) {
            combinedMap.set(key, value);
        }
    });

    return combinedMap;
}

function generateFocusWidgetNameMap(): Map<string, string> {
    const focusWidgetMap = new Map<string, string>();
    [...ORACLE_GOLDEN_CONFIG, ...MSSQL_GOLDEN_CONFIG].forEach(entry => {
        if (entry.recommendation) {
            const key = entry.id;
            focusWidgetMap.set(key, entry.recommendation);
        }
    });
    return focusWidgetMap;
}

export {
    generateCombinedParameterCategoryMaps,
    ParameterCategoryMap,
    generateMsSqlParameterCategoryMap,
    generateOracleParameterCategoryMap,
    generateFocusWidgetNameMap
};
