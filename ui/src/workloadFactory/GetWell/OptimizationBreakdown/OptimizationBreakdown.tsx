import { DsFlashingDotsLoader, DsTypography, TooltipInfo } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { ReactComponent as Storage } from '../../../assets/Storage.svg';
import { ReactComponent as Applications } from '../../../assets/Application.svg';
import { ReactComponent as Resiliency } from '../../../assets/Resiliency.svg';
import { ReactComponent as Cloning } from '../../../assets/Cloning.svg';
import { ReactComponent as Compute } from '../../../assets/Compute.svg';
import styles from './OptimizationBreakdown.module.scss';
import OptimizeComponent from '../OptimizeComponent/OptimizeComponent';
import { useAppSelector } from '../../../store/storeHooks';
import { GENERAL } from '../../../utils/appConstants';
import { groupConfigurationsByCategory, generateDisplayText } from './OptimizationBreakdownHelper';
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

        const result = groupConfigurationsByCategory(
            optimizationBreakDown.total.dismissedIds,
            driftAssessmentData,
            cardData,
            engineType
        );

        // Show categories and configurations dynamically
        const { flatApiCategories = [], configurations = [] } = result;

        // If no data to show, return null
        if (flatApiCategories.length === 0 && configurations.length === 0) {
            return null;
        }

        return (
            <div>
                {flatApiCategories.length > 0 && (
                    <>
                        <DsTypography variant="Semibold_14" className={styles.dismissTooltipHeader}>
                            {t('databases.well-architect.category')}
                        </DsTypography>
                        <DsTypography variant="Regular_14" className={styles.tooltipConfigText}>
                            {flatApiCategories.join(' | ')}
                        </DsTypography>
                    </>
                )}

                {configurations.length > 0 && (
                    <>
                        {flatApiCategories.length > 0 && <div className={styles.tooltipDivider} />}
                        <DsTypography variant="Semibold_14" className={styles.dismissTooltipHeader}>
                            {t('databases.well-architect.configuration')}
                        </DsTypography>
                        <DsTypography variant="Regular_14" className={styles.tooltipConfigText}>
                            {configurations.join(' | ')}
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
                        value={loading ? 0 : optimizationBreakDown?.storage?.percent || 0}
                        data={optimizationBreakDown?.storage}
                        text="Storage"
                        image={<Storage />}
                        isComingSoon={false}
                        allConfigurationsDismissed={allConfigurationsDismissed}
                        isDisabled={(optimizationBreakDown?.storage?.total ?? 0) === 0}
                    />
                    <OptimizeComponent
                        value={loading ? 0 : optimizationBreakDown?.compute?.percent || 0}
                        data={optimizationBreakDown?.compute}
                        text="Compute"
                        image={<Compute />}
                        isComingSoon={false}
                        allConfigurationsDismissed={allConfigurationsDismissed}
                        isDisabled={(optimizationBreakDown?.compute?.total ?? 0) === 0}
                    />
                    <OptimizeComponent
                        value={loading ? 0 : optimizationBreakDown?.application?.percent || 0}
                        data={optimizationBreakDown?.application}
                        text={
                            engineType === DBType.ORACLE
                                ? t('databases.well-architect.application-oracle-server')
                                : GENERAL.APPLICATION
                        }
                        image={<Applications />}
                        isComingSoon={false}
                        allConfigurationsDismissed={allConfigurationsDismissed}
                        isDisabled={(optimizationBreakDown?.application?.total ?? 0) === 0}
                    />
                </div>

                <div className={styles.rightSide}>
                    <OptimizeComponent
                        value={loading ? 0 : optimizationBreakDown?.resiliency?.percent || 0}
                        data={optimizationBreakDown?.resiliency}
                        text="Resiliency"
                        image={<Resiliency />}
                        isComingSoon={false}
                        allConfigurationsDismissed={allConfigurationsDismissed}
                        isDisabled={(optimizationBreakDown?.resiliency?.total ?? 0) === 0}
                    />
                    <OptimizeComponent
                        value={loading ? 0 : optimizationBreakDown?.cloning?.percent || 0}
                        data={optimizationBreakDown?.cloning}
                        text="Cloning"
                        image={<Cloning />}
                        isComingSoon={false}
                        allConfigurationsDismissed={allConfigurationsDismissed}
                        isDisabled={(optimizationBreakDown?.cloning?.total ?? 0) === 0}
                    />
                </div>
            </div>
        </div>
    );
};

export default OptimizationBreakdown;
