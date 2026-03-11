import { DsFlashingDotsLoader, DsTypography, TooltipInfo } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { ReactComponent as Storage } from '../../../assets/Storage.svg';
import { ReactComponent as Applications } from '../../../assets/Application.svg';
import { ReactComponent as Resiliency } from '../../../assets/Resiliency.svg';
import { ReactComponent as Cloning } from '../../../assets/Cloning.svg';
import { ReactComponent as Compute } from '../../../assets/Compute.svg';
import { ReactComponent as ComingSoon } from '../../../assets/comingSoon2.svg';
import styles from './OptimizationBreakdown.module.scss';
import OptimizeComponent from '../OptimizeComponent/OptimizeComponent';
import { useAppSelector } from '../../../store/storeHooks';
import { GENERAL } from '../../../utils/appConstants';
import { getCategoryData } from '../GetWellUtils';
import {
    getTechnicalKeyToDisplayNameMapping,
    getOracleTechnicalKeyToDisplayNameMapping,
    groupConfigurationsByCategory,
    generateDisplayText
} from './OptimizationBreakdownHelper';
import { getDynamicOracleCategoryData } from '../../Oracle/OracleResourcePages/OracleWellArchitectDashboard/OracleWellArchitectedUtils';
import { DBType } from '../../../utils/consts';

const OptimizationBreakdown = ({
    allConfigurationsDismissed,
    engineType = DBType.MSSQL
}: {
    allConfigurationsDismissed?: boolean;
    engineType?: string;
}) => {
    const { t } = useTranslation();
    const loading = useAppSelector(state => state.getWellOptimize.optimizePageLoading);
    const { optimizationBreakDown, driftAssessmentData, cardData } = useAppSelector(state => state.getWellOptimize);

    const renderTooltipContent = () => {
        if (!optimizationBreakDown?.total?.dismissedIds?.length) return null;

        const {
            fullyDismissedCategories,
            fullyDismissedSubCategories,
            individualConfigs,
            parentConfigurations,
            subConfigurations
        } = groupConfigurationsByCategory(
            optimizationBreakDown.total.dismissedIds,
            driftAssessmentData,
            cardData,
            engineType
        );

        const categoryData =
            engineType === DBType.ORACLE ? getDynamicOracleCategoryData(driftAssessmentData) : getCategoryData();
        const technicalKeyToDisplayName =
            engineType === DBType.ORACLE
                ? getOracleTechnicalKeyToDisplayNameMapping()
                : getTechnicalKeyToDisplayNameMapping();

        // Collect all sub-categories (from fully dismissed categories and standalone dismissed sub-categories)
        const allSubCategories = [
            // Sub-categories from fully dismissed categories
            ...fullyDismissedCategories
                .map(category => {
                    const subCategories = Object.keys(categoryData)
                        .filter(configKey => categoryData[configKey as keyof typeof categoryData].category === category)
                        .map(configKey => categoryData[configKey as keyof typeof categoryData].subCategory);
                    return [...new Set(subCategories)];
                })
                .flat(),
            // Standalone fully dismissed sub-categories
            ...Object.keys(fullyDismissedSubCategories)
        ];

        // Collect ALL configurations from all sources (avoid duplicates)
        const configurationSources = [
            // Configurations from fully dismissed categories
            ...fullyDismissedCategories
                .map(category => {
                    const configsInCategory = Object.keys(categoryData).filter(
                        configKey => categoryData[configKey as keyof typeof categoryData].category === category
                    );
                    return configsInCategory.map(configKey => technicalKeyToDisplayName[configKey] || configKey);
                })
                .flat(),
            // Configurations from fully dismissed sub-categories
            ...Object.entries(fullyDismissedSubCategories)
                .map(([subCategory, data]) => data.configs)
                .flat(),
            // Individual configurations from different sub-categories
            ...Object.entries(individualConfigs)
                .map(([category, subCategories]) =>
                    Object.entries(subCategories)
                        .map(([subCategory, configs]) => configs)
                        .flat()
                )
                .flat(),
            // Parent configurations (ONTAP, OS, HA) - only if not already included above
            ...parentConfigurations.filter(parentConfig => {
                // Check if this parent config is already included in category/subcategory dismissals
                const technicalKey = Object.keys(categoryData).find(
                    key => technicalKeyToDisplayName[key] === parentConfig
                );
                if (!technicalKey) return true; // Include if we can't find the mapping

                const configData = categoryData[technicalKey as keyof typeof categoryData];
                if (!configData) return true;

                // Don't include if the category is fully dismissed
                if (fullyDismissedCategories.includes(configData.category)) return false;

                // Don't include if the subcategory is fully dismissed
                if (fullyDismissedSubCategories[configData.subCategory]) return false;

                // Don't include if it's in individual configs
                const individualConfigsForCategory = individualConfigs[configData.category];
                if (individualConfigsForCategory?.[configData.subCategory]?.includes(parentConfig)) return false;

                return true;
            })
        ];

        // Remove duplicates from all configurations
        const allConfigurations = [...new Set(configurationSources)];

        return (
            <div>
                {/* Categories Section */}
                {fullyDismissedCategories.length > 0 && (
                    <>
                        <DsTypography variant="Semibold_14" className={styles.dismissTooltipHeader}>
                            {t('databases.well-architect.category')}
                        </DsTypography>
                        <DsTypography variant="Regular_14" className={styles.tooltipConfigText}>
                            {fullyDismissedCategories.join(' | ')}
                        </DsTypography>
                    </>
                )}

                {/* Sub-categories Section */}
                {allSubCategories.length > 0 && (
                    <>
                        {fullyDismissedCategories.length > 0 && <div className={styles.tooltipDivider} />}
                        <DsTypography variant="Semibold_14" className={styles.dismissTooltipHeader}>
                            {t('databases.well-architect.sub-category')}
                        </DsTypography>
                        <DsTypography variant="Regular_14" className={styles.tooltipConfigText}>
                            {[...new Set(allSubCategories)].join(' | ')}
                        </DsTypography>
                    </>
                )}

                {/* Single Configurations Section - consolidates ALL configurations */}
                {allConfigurations.length > 0 && (
                    <>
                        {(fullyDismissedCategories.length > 0 || allSubCategories.length > 0) && (
                            <div className={styles.tooltipDivider} />
                        )}
                        <DsTypography variant="Semibold_14" className={styles.dismissTooltipHeader}>
                            {t('databases.well-architect.configuration')}
                        </DsTypography>
                        <DsTypography variant="Regular_14" className={styles.tooltipConfigText}>
                            {allConfigurations.join(' | ')}
                        </DsTypography>
                    </>
                )}

                {/* Sub-configurations under parent configurations */}
                {subConfigurations.length > 0 && (
                    <>
                        <div className={styles.tooltipDivider} />
                        <DsTypography variant="Semibold_14" className={styles.dismissTooltipHeader}>
                            {t('databases.well-architect.sub-configuration')}
                        </DsTypography>
                        <DsTypography variant="Regular_14" className={styles.tooltipConfigText}>
                            {subConfigurations.join(' | ')}
                        </DsTypography>
                    </>
                )}
            </div>
        );
    };

    return (
        <div className={styles.optimizationBreakdown}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    {t('databases.well-architect.optimization-breakdown-category-heading')}
                </DsTypography>
                <div className={styles.headerRight}>
                    {optimizationBreakDown?.total?.dismissedOrPostponed != null &&
                        optimizationBreakDown.total.dismissedOrPostponed > 0 && (
                            <div className={styles.dismissedInfo}>
                                <TooltipInfo className={styles.tooltipIcon}>{renderTooltipContent()}</TooltipInfo>
                                <DsTypography variant="Regular_14" className={styles.dismissedText}>
                                    {generateDisplayText(
                                        optimizationBreakDown.total.dismissedIds || [],
                                        optimizationBreakDown.total.dismissedOrPostponed,
                                        driftAssessmentData,
                                        cardData,
                                        engineType
                                    )}
                                </DsTypography>
                            </div>
                        )}
                    {loading && <DsFlashingDotsLoader />}
                </div>
            </div>

            <div className={styles.mainSection}>
                <div className={styles.leftSide}>
                    <OptimizeComponent
                        value={optimizationBreakDown?.storage?.percent || 0}
                        data={optimizationBreakDown?.storage}
                        text="Storage"
                        image={<Storage />}
                        isComingSoon={false}
                        allConfigurationsDismissed={allConfigurationsDismissed}
                        isDisabled={(optimizationBreakDown?.storage?.total ?? 0) === 0}
                    />
                    <OptimizeComponent
                        value={optimizationBreakDown?.compute?.percent || 0}
                        data={optimizationBreakDown?.compute}
                        text="Compute"
                        image={<Compute />}
                        isComingSoon={false}
                        allConfigurationsDismissed={allConfigurationsDismissed}
                        isDisabled={(optimizationBreakDown?.compute?.total ?? 0) === 0}
                    />
                    <OptimizeComponent
                        value={
                            engineType === DBType.ORACLE ? (
                                <ComingSoon />
                            ) : (
                                optimizationBreakDown?.application?.percent || 0
                            )
                        }
                        data={engineType === DBType.ORACLE ? undefined : optimizationBreakDown?.application}
                        text={
                            engineType === DBType.ORACLE
                                ? t('databases.well-architect.application-oracle-server')
                                : GENERAL.APPLICATION
                        }
                        image={<Applications />}
                        isComingSoon={engineType === DBType.ORACLE}
                        allConfigurationsDismissed={
                            engineType === DBType.ORACLE ? undefined : allConfigurationsDismissed
                        }
                        isDisabled={
                            engineType !== DBType.ORACLE && (optimizationBreakDown?.application?.total ?? 0) === 0
                        }
                    />
                </div>

                <div className={styles.rightSide}>
                    <OptimizeComponent
                        value={optimizationBreakDown?.resiliency?.percent || 0}
                        data={optimizationBreakDown?.resiliency}
                        text="Resiliency"
                        image={<Resiliency />}
                        isComingSoon={false}
                        allConfigurationsDismissed={allConfigurationsDismissed}
                        isDisabled={(optimizationBreakDown?.resiliency?.total ?? 0) === 0}
                    />
                    <OptimizeComponent
                        value={
                            engineType === DBType.ORACLE ? <ComingSoon /> : optimizationBreakDown?.cloning?.percent || 0
                        }
                        data={engineType === DBType.ORACLE ? undefined : optimizationBreakDown?.cloning}
                        text="Cloning"
                        image={<Cloning />}
                        isComingSoon={engineType === DBType.ORACLE}
                        allConfigurationsDismissed={
                            engineType === DBType.ORACLE ? undefined : allConfigurationsDismissed
                        }
                        isDisabled={engineType !== DBType.ORACLE && (optimizationBreakDown?.cloning?.total ?? 0) === 0}
                    />
                </div>
            </div>
        </div>
    );
};

export default OptimizationBreakdown;
