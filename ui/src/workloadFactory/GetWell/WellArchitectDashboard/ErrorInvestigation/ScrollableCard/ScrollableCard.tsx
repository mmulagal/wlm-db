import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DsTypography } from '@tlveng/wlm-ds';
import { ReactComponent as OnboardingIllustration } from '../../../../../assets/Onbording illustration.svg';
import { ReactComponent as OnboardingIllustration2 } from '../../../../../assets/onboarding2.svg';
import styles from './ScrollableCard.module.scss';

const ScrollableCard = () => {
    const { t } = useTranslation();
    const [activeSlide, setActiveSlide] = useState(0); // 0 for first, 1 for second
    return (
        <div className={styles.scrollableCard2}>
            {activeSlide === 0 && (
                <div className={styles.rightSection}>
                    <div className={styles.topSection}>
                        <OnboardingIllustration />
                    </div>
                    <div className={styles.middleSection}>
                        <DsTypography variant="Semibold_16">
                            {t('databases.log-analyzer.first-card-heading')}
                        </DsTypography>
                        <div className={styles.textSection}>
                            <DsTypography variant="Regular_14">
                                {t('databases.log-analyzer.first-card-heading-text')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.log-analyzer.first-card-point-1-heading')}
                            </DsTypography>
                        </div>
                    </div>
                </div>
            )}

            {activeSlide === 1 && (
                <div className={styles.rightSection}>
                    <div className={styles.secondaryTopSection}>
                        <OnboardingIllustration2 />
                        <div className={styles.rightSection}>
                            <DsTypography variant="Semibold_16">
                                {t('databases.log-analyzer.second-card-heading')}
                            </DsTypography>
                            <DsTypography variant="Semibold_16">
                                {' '}
                                {t('databases.log-analyzer.second-card-heading-text')}
                            </DsTypography>
                        </div>
                    </div>

                    <div className={styles.rightSideContainer}>
                        <div className={styles.secondaryMiddleSection}>
                            <div className={styles.column}>
                                <div className={styles.contentArea}>
                                    <DsTypography variant="Semibold_16">
                                        {t('databases.log-analyzer.second-card-point-2-heading')}
                                    </DsTypography>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.log-analyzer.second-card-point-2-text')}
                                    </DsTypography>
                                </div>

                                <div className={styles.contentArea}>
                                    <DsTypography variant="Semibold_16">
                                        {t('databases.log-analyzer.second-card-point-3-heading')}
                                    </DsTypography>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.log-analyzer.second-card-point-3-text')}
                                    </DsTypography>
                                </div>
                            </div>

                            <div className={styles.column}>
                                <div className={styles.contentArea}>
                                    <DsTypography variant="Semibold_16">
                                        {t('databases.log-analyzer.second-card-point-1-heading')}
                                    </DsTypography>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.log-analyzer.second-card-point-1-text')}
                                    </DsTypography>
                                </div>

                                <div className={styles.contentArea}>
                                    <DsTypography variant="Semibold_16">
                                        {t('databases.log-analyzer.second-card-point-4-heading')}
                                    </DsTypography>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.log-analyzer.second-card-point-4-text')}
                                    </DsTypography>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className={styles.bottomSection}>
                {[0, 1].map(index => (
                    <div
                        key={index}
                        className={styles.firstTab}
                        onClick={() => setActiveSlide(index)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                setActiveSlide(index);
                            }
                        }}
                        role="button"
                        tabIndex={0}
                        style={{ cursor: 'pointer' }}
                        aria-pressed={activeSlide === index}
                        aria-label={`Go to slide ${index + 1}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="30" height="2" viewBox="0 0 30 2" fill="none">
                            <rect width="30" height="2" rx="1" fill={activeSlide === index ? '#404040' : '#a7a7a7'} />
                        </svg>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ScrollableCard;
