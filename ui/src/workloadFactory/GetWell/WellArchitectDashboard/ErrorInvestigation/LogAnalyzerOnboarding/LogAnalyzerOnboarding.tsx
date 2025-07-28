import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { DsButton, DsTypography } from '@netapp/design-system';
import { ReactComponent as RefreshIcon } from '@netapp/icons/ic_refresh.svg';
import OnboardingAccordions from '../OnboardingAccordions/OnboardingAccordions';
import ScrollableCard from '../ScrollableCard/ScrollableCard';
import styles from './LogAnalyzerOnboarding.module.scss';
import { setIsAgenticOnboardingActivating } from '../../../../../store/workloadFactory/agenticAISlice';
import { setSelectedWellArchitectTab } from '../../../../../store/workloadFactory/getWellOptimizeSlice';
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
                    <OnboardingAccordions />
                </div>
                <div className={styles.legalNoticeSection} />
            </div>
        </div>
    );
};

export default LogAnalyzerOnboarding;
