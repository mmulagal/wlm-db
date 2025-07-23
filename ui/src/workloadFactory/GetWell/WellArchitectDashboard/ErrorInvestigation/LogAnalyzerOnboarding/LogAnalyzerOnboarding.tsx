import OnboardingAccordions from '../OnboardingAccordions/OnboardingAccordions';
import ScrollableCard from '../ScrollableCard/ScrollableCard';
import styles from './LogAnalyzerOnboarding.module.scss';

const LogAnalyzerOnboarding = () => {
    return (
        <div className={styles['log-analyzer-onboarding']}>
            <ScrollableCard />

            <div className={styles.sectionTwo}>
                <div className={styles.accordionCardSection}>
                    <OnboardingAccordions />
                </div>
                <div className={styles.legalNoticeSection}></div>
            </div>
        </div>
    );
};

export default LogAnalyzerOnboarding;
