import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DsTypography } from '@tlveng/wlm-ds';
import { ReactComponent as OracleTCO } from '../../../assets/OracleTCO.svg';
import { ReactComponent as DownloadIcon } from '../../../assets/Download-icon.svg';
import { ReactComponent as Play } from '../../../assets/Play.svg';
import { ReactComponent as Upload } from '../../../assets/Upload.svg';
import { ReactComponent as Onprem } from '../../../assets/Onprem.svg';

import { ReactComponent as CarousalLeft } from '../../../assets/Carousel Arrow left.svg';
import { ReactComponent as CarousalRight } from '../../../assets/Carousel Arrow right.svg';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import styles from './TCOBanner.module.scss';
import { useAppSelector } from '../../../store/storeHooks';
import { DBType } from '../../../utils/consts';

const TCOBanner = () => {
    const { t } = useTranslation();
    const { selectedTCOHostType } = useAppSelector(state => state.exploreSavings);
    const [activeSlide, setActiveSlide] = useState(0); // 0 for first, 1 for second

    // Auto-rotate slides every 8 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            setActiveSlide(prev => (prev === 0 ? 1 : 0));
        }, 8000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className={styles.scrollableCard2}>
            {activeSlide === 0 && (
                <div className={styles.rightSection}>
                    <div className={styles.imageTextSection}>
                        <div onClick={() => setActiveSlide(1)} className={CommonStyles.carousalClass}>
                            <CarousalLeft />
                        </div>
                        <div className={styles.topImageSection}>
                            <div className={styles.upperSection}>
                                <OracleTCO />
                            </div>
                        </div>
                    </div>

                    <div className={styles.mainSection}>
                        <div className={styles.leftSection}>
                            <DsTypography variant="Semibold_16">
                                {selectedTCOHostType === DBType.ORACLE
                                    ? t('databases.explore-savings.tco-oracle-banner-slide-one-heading')
                                    : t('databases.explore-savings.tco-mssql-banner-slide-one-heading')}
                            </DsTypography>

                            <DsTypography variant="Regular_16">
                                {selectedTCOHostType === DBType.ORACLE
                                    ? t('databases.explore-savings.tco-oracle-banner-slide-one-content')
                                    : t('databases.explore-savings.tco-mssql-banner-slide-one-content')}
                            </DsTypography>
                        </div>

                        <div onClick={() => setActiveSlide(1)} className={CommonStyles.carousalClass}>
                            <CarousalRight />
                        </div>
                    </div>
                </div>
            )}

            {activeSlide === 1 && (
                <div className={styles.rightSection}>
                    <div className={styles.mainRightSection}>
                        <div onClick={() => setActiveSlide(0)} className={CommonStyles.carousalClass}>
                            <CarousalLeft />
                        </div>
                        <div className={styles.textSection}>
                            <DsTypography variant="Semibold_16">
                                {selectedTCOHostType === DBType.ORACLE
                                    ? t('databases.explore-savings.tco-oracle-banner-slide-two-heading')
                                    : t('databases.explore-savings.tco-mssql-banner-slide-two-heading')}
                            </DsTypography>

                            <div className={styles.stepSection}>
                                <div className={styles.columnSection}>
                                    <div className={styles.itemSection}>
                                        <DownloadIcon />
                                        <div className={styles.itemText}>
                                            <DsTypography variant="Semibold_14">Step 1</DsTypography>
                                            <DsTypography variant="Regular_14">
                                                {t(
                                                    'databases.explore-savings.tco-oracle-banner-slide-two-content-step-1'
                                                )}
                                            </DsTypography>
                                        </div>
                                    </div>

                                    <div className={styles.itemSection}>
                                        <Play />
                                        <div className={styles.itemText}>
                                            <DsTypography variant="Semibold_14">Step 2</DsTypography>
                                            <DsTypography variant="Regular_14">
                                                {selectedTCOHostType === DBType.ORACLE
                                                    ? t(
                                                          'databases.explore-savings.tco-oracle-banner-slide-two-content-step-2'
                                                      )
                                                    : t(
                                                          'databases.explore-savings.tco-mssql-banner-slide-two-content-step-2'
                                                      )}
                                            </DsTypography>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.columnSection}>
                                    <div className={styles.itemSection}>
                                        <Upload />
                                        <div className={styles.itemText}>
                                            <DsTypography variant="Semibold_14">Step 3</DsTypography>
                                            <DsTypography variant="Regular_14">
                                                {t(
                                                    'databases.explore-savings.tco-oracle-banner-slide-two-content-step-4'
                                                )}
                                            </DsTypography>
                                        </div>
                                    </div>
                                    <div className={styles.itemSection}>
                                        <Onprem />
                                        <div className={styles.itemText}>
                                            <DsTypography variant="Semibold_14">Step 4</DsTypography>
                                            <DsTypography variant="Regular_14">
                                                {selectedTCOHostType === DBType.ORACLE
                                                    ? t(
                                                          'databases.explore-savings.tco-oracle-banner-slide-two-content-step-5'
                                                      )
                                                    : t(
                                                          'databases.explore-savings.tco-mssql-banner-slide-two-content-step-5'
                                                      )}
                                            </DsTypography>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div onClick={() => setActiveSlide(0)} className={CommonStyles.carousalClass}>
                            <CarousalRight />
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

export default TCOBanner;
