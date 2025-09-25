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

const OptimizationBreakdown = ({ allConfigurationsDismissed }: { allConfigurationsDismissed?: boolean }) => {
    const { t } = useTranslation();
    const loading = useAppSelector(state => state.getWellOptimize.optimizePageLoading);
    const optimizationBreakDown = useAppSelector(state => state.getWellOptimize.optimizationBreakDown);

    const renderTooltipContent = () => {
        if (!optimizationBreakDown?.total?.dismissedIds?.length) return null;

        const dismissedConfigText = t('databases.well-architect.dismiss.dismissed-configuration-tooltip-header');
        const configIds = optimizationBreakDown.total.dismissedIds;

        return (
            <>
                <DsTypography variant="Semibold_14" className={styles.dismissTooltipHeader}>
                    {dismissedConfigText}
                </DsTypography>
                {configIds.map((id, index) => (
                    <div key={index}>{id}</div>
                ))}
            </>
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
                                    Dismissed: {optimizationBreakDown.total.dismissedOrPostponed} Configuration
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
                    />
                    <OptimizeComponent
                        value={optimizationBreakDown?.compute?.percent || 0}
                        data={optimizationBreakDown?.compute}
                        text="Compute"
                        image={<Compute />}
                        isComingSoon={false}
                        allConfigurationsDismissed={allConfigurationsDismissed}
                    />
                    <OptimizeComponent
                        value={optimizationBreakDown?.application?.percent || 0}
                        data={optimizationBreakDown?.application}
                        text={GENERAL.APPLICATION}
                        image={<Applications />}
                        isComingSoon={false}
                        allConfigurationsDismissed={allConfigurationsDismissed}
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
                    />
                    <OptimizeComponent
                        value={optimizationBreakDown?.cloning?.percent || 0}
                        data={optimizationBreakDown?.cloning}
                        text="Cloning"
                        image={<Cloning />}
                        isComingSoon={false}
                        allConfigurationsDismissed={allConfigurationsDismissed}
                    />
                </div>
            </div>
        </div>
    );
};

export default OptimizationBreakdown;
