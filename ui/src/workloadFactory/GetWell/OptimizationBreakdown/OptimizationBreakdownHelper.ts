import {
    ASSESSMENT_CONFIG_NAMES,
    CONFIG_STATES,
    DBType,
    WELL_ARCHITECTED_CATEGORY_LABELS,
    WA_FLAG_SKIP
} from '../../../utils/consts';

// Helper function to group configurations by category
export const groupConfigurationsByCategory = (
    configIds: string[],
    assessmentData?: any,
    cardsData?: any,
    databaseType?: string
) => {
    // Group by category and check for fully dismissed categories
    const configsByCategory: { [category: string]: { id: string; displayName: string }[] } = {};

    // Group configs by category
    configIds.forEach(configId => {
        // Direct lookup by ID
        const card = cardsData?.[configId];

        if (card) {
            // For flat API, use card.name; for nested API, use card.mapName
            const displayName = card.name || card.mapName;
            const { category } = card;

            // Only process if category and displayName exist
            if (category && displayName) {
                if (!configsByCategory[category]) {
                    configsByCategory[category] = [];
                }

                configsByCategory[category].push({ id: configId, displayName });
            }
        }
    });

    // Check which categories are fully dismissed
    const fullyDismissedCategories: string[] = [];
    const individualConfigs: string[] = [];

    Object.keys(configsByCategory).forEach(category => {
        // Get all configs in this category from cardsData (API gives us only what should be shown)
        const allConfigsInCategory = Object.keys(cardsData || {}).filter(key => {
            const card = cardsData[key];
            // Skip metadata fields
            if (WA_FLAG_SKIP.includes(key)) return false;
            return card?.category?.toLowerCase() === category.toLowerCase();
        });

        const dismissedConfigsInCategory = configsByCategory[category];

        // If ALL configs in this category are dismissed, it's a fully dismissed category
        if (allConfigsInCategory.length > 0 && dismissedConfigsInCategory.length === allConfigsInCategory.length) {
            // Map category to display label
            const displayLabel =
                WELL_ARCHITECTED_CATEGORY_LABELS[
                    category.toLowerCase() as keyof typeof WELL_ARCHITECTED_CATEGORY_LABELS
                ] || category;
            fullyDismissedCategories.push(displayLabel);
        } else {
            // Otherwise, list individual configs
            dismissedConfigsInCategory.forEach(config => {
                individualConfigs.push(config.displayName);
            });
        }
    });

    return {
        fullyDismissedCategories,
        individualConfigs: {} as { [category: string]: string[] },
        parentConfigurations: [] as string[],
        configurations: individualConfigs,
        flatApiCategories: fullyDismissedCategories
    };
};

// Helper function to generate display text for dismissed configurations
export const generateDisplayText = (
    dismissedIds: string[],
    dismissedOrPostponed: number,
    assessmentData?: any,
    cardsData?: any,
    databaseType?: string
) => {
    if (!dismissedIds?.length) return '';

    // Show categories and configurations dynamically
    const result = groupConfigurationsByCategory(dismissedIds, assessmentData, cardsData, databaseType);
    const categoryCount = result.flatApiCategories?.length || 0;
    const configCount = result.configurations?.length || 0;

    const parts: string[] = [];

    if (categoryCount > 0) {
        parts.push(`${categoryCount} categor${categoryCount > 1 ? 'ies' : 'y'}`);
    }

    if (configCount > 0) {
        parts.push(`${configCount} configuration${configCount > 1 ? 's' : ''}`);
    }

    return parts.length > 0
        ? `Dismissed: ${parts.join(' | ')}`
        : `Dismissed: ${dismissedOrPostponed} Configuration${dismissedOrPostponed > 1 ? 's' : ''}`;
};
