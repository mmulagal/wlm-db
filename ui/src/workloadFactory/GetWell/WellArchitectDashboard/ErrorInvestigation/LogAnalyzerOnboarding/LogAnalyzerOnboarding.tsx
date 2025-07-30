import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { DsButton, DsTypography } from '@netapp/design-system';
import { ReactComponent as RefreshIcon } from '@netapp/icons/ic_refresh.svg';
import OnboardingAccordions from '../OnboardingAccordions/OnboardingAccordions';
import ScrollableCard from '../ScrollableCard/ScrollableCard';
import styles from './LogAnalyzerOnboarding.module.scss';
import { setIsAgenticOnboardingActivating } from '../../../../../store/workloadFactory/agenticAISlice';
import { setSelectedWellArchitectTab } from '../../../../../store/workloadFactory/getWellOptimizeSlice';
import { ReactComponent as InfoIcon } from '../../../../../assets/ic_info.svg';
import { WELL_ARCHITECTED_TABS } from '../../../../../utils/consts';

const LogAnalyzerOnboarding = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const activateHandler = () => {
        dispatch(setIsAgenticOnboardingActivating(true));
        dispatch(setSelectedWellArchitectTab(WELL_ARCHITECTED_TABS.ACTIVATING_LOG_ANALYZER));
    };
    return (
        <div className={styles['log-analyzer-onboarding']}>
            <ScrollableCard />

            <div className={styles.sectionTwo}>
                <div className={styles.accordionCardSection}>
                    <div className={styles.topPart}>
                        <DsTypography variant="Semibold_16">
                            {t('databases.log-analyzer.investigation-in-progress')}
                        </DsTypography>
                        <div className={styles.rightPart}>
                            <div className={styles.refreshIcon} onClick={() => {}}>
                                <RefreshIcon />
                            </div>
                            <DsButton onClick={activateHandler} isThin variant="primary">
                                {t('databases.log-analyzer.activate')}
                            </DsButton>
                        </div>
                    </div>
                    <div className={styles.infoSection}>
                        <div>
                            <InfoIcon />
                        </div>
                        <DsTypography variant="Semibold_14">{t('databases.log-analyzer.info-text')}</DsTypography>
                    </div>
                    <OnboardingAccordions />
                </div>
                <div className={styles.legalNoticeSection}>
                    <DsTypography variant="Semibold_16" className={styles.legalNoticeHeading}>
                        {t('databases.log-analyzer.cost-legal-overview')}
                    </DsTypography>
                    <div className={styles.legalNotice}>
                        <div style={{ height: '24px' }} />
                        <div className={styles.legalContentSection}>
                            <div className={styles.sections}>
                                <DsTypography variant="Semibold_14">{t('databases.log-analyzer.cost')}</DsTypography>
                                <DsTypography variant="Regular_14">
                                    {t('databases.log-analyzer.cost-content')}
                                </DsTypography>
                            </div>

                            <div className={styles.sections}>
                                <DsTypography variant="Semibold_14">
                                    {t('databases.log-analyzer.legal-notice')}
                                </DsTypography>
                                <DsTypography variant="Regular_14">
                                    {t('databases.log-analyzer.legal-notice-content-1')}
                                </DsTypography>
                                <DsTypography variant="Regular_14">
                                    {t('databases.log-analyzer.legal-notice-content-2')}
                                </DsTypography>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LogAnalyzerOnboarding;
