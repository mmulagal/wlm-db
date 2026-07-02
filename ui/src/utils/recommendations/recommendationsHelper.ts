/**
 * Recommendation Text Helper
 *
 * This file provides static recommendation text for MSSQL and Oracle configurations.
 * Since the API team cannot provide all recommendation details, we maintain them in UI.
 *
 * Usage:
 * - Import getRecommendation() to get full recommendation object for a specific configuration
 * - Pass configurationId and dbType (DBType.MSSQL or DBType.ORACLE)
 */

import mssqlRecommendations from './mssqlRecommendations.json';
import oracleRecommendations from './oracleRecommendations.json';
import { DBType } from '../consts';

interface DescriptionItem {
    title: string;
    description: string;
}

interface DescriptionRssConfig {
    first?: string;
    second?: string;
    points?: string[];
    last?: string;
}

interface RecommendationData {
    name: string;
    title?: string;
    description?: string;
    descriptionList?: DescriptionItem[];
    descriptionRssConfig?: DescriptionRssConfig;
    info?: string;
    valuesHeading?: string;
    values?: string[];
}

type RecommendationsMap = Record<string, RecommendationData>;

/**
 * Get full recommendation object for a specific configuration
 * @param configurationId - The configuration ID (e.g., 'thin-provision', 'compute-rightsizing')
 * @param dbType - Database type (DBType.MSSQL or DBType.ORACLE)
 * @returns Full recommendation object with title, description or descriptionList, info, valuesHeading, and values
 */
export const getRecommendation = (
    configurationId: string,
    dbType: string = DBType.MSSQL
): RecommendationData | undefined => {
    if (!configurationId) return undefined;

    const recommendations: RecommendationsMap =
        dbType === DBType.ORACLE
            ? (oracleRecommendations as RecommendationsMap)
            : (mssqlRecommendations as RecommendationsMap);

    return recommendations[configurationId];
};

/**
 * Get recommendation text/description only for a specific configuration
 * @param configurationId - The configuration ID (e.g., 'storage-tier', 'compute-rightsizing')
 * @param dbType - Database type (DBType.MSSQL or DBType.ORACLE)
 * @returns Recommendation text or undefined if not found
 * @note For structured recommendations with descriptionList, this returns the first description
 */
export const getRecommendationText = (configurationId: string, dbType: string = DBType.MSSQL): string | undefined => {
    const recommendation = getRecommendation(configurationId, dbType);
    if (!recommendation) return undefined;

    // Return description if present, otherwise first item from descriptionList
    if (recommendation.description) return recommendation.description;
    if (recommendation.descriptionList && recommendation.descriptionList.length > 0) {
        return recommendation.descriptionList[0].description;
    }
    return undefined;
};

/**
 * Get recommendation data (name + text) for a specific configuration
 * Alias for getRecommendation() - both functions return the same full recommendation object
 * @param configurationId - The configuration ID
 * @param dbType - Database type (DBType.MSSQL or DBType.ORACLE)
 * @returns Recommendation data object or undefined if not found
 */
export const getRecommendationData = (
    configurationId: string,
    dbType: string = DBType.MSSQL
): RecommendationData | undefined => getRecommendation(configurationId, dbType);

/**
 * Get all recommendations for a database type
 * @param dbType - Database type (DBType.MSSQL or DBType.ORACLE)
 * @returns Map of all recommendations
 */
export const getAllRecommendations = (dbType: string = DBType.MSSQL): RecommendationsMap =>
    dbType === DBType.ORACLE
        ? (oracleRecommendations as RecommendationsMap)
        : (mssqlRecommendations as RecommendationsMap);

/**
 * Check if a recommendation exists for a configuration
 * @param configurationId - The configuration ID
 * @param dbType - Database type (DBType.MSSQL or DBType.ORACLE)
 * @returns true if recommendation exists
 */
export const hasRecommendation = (configurationId: string, dbType: string = DBType.MSSQL): boolean =>
    getRecommendation(configurationId, dbType) !== undefined;

export default {
    getRecommendation,
    getRecommendationText,
    getRecommendationData,
    getAllRecommendations,
    hasRecommendation
};
