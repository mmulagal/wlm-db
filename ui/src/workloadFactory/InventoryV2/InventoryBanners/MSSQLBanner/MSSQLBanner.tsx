import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DsTypography } from '@tlveng/wlm-ds';
import { ReactComponent as WellArchitectMSSQL } from '../../../../assets/Well-Architected-MSSQL.svg';
import { ReactComponent as LogAnalyzer } from '../../../../assets/log_analyzer_banner.svg';
import { ReactComponent as InstanceRegistration } from '../../../../assets/instance-registration-distribution.svg';
import { ReactComponent as InstanceWellArchitected } from '../../../../assets/instance-well-architected.svg';
import { ReactComponent as InstanceLogAnalyzer } from '../../../../assets/instance-log-analyzer.svg';
import { ReactComponent as CarousalLeft } from '../../../../assets/Carousel Arrow left.svg';
import { ReactComponent as CarousalRight } from '../../../../assets/Carousel Arrow right.svg';
import styles from './MSSQLBanner.module.scss';

import BannerCard from '../BannerCard/BannerCard';
import { useAppSelector } from '../../../../store/storeHooks';
import { DBType, INVENTORY_BANNER_FILTER_OPTIONS } from '../../../../utils/consts';
import { calculateDbBannerCounts } from '../../InventoryUtilsV2';

const MSSQLBanner = ({ loading }: { loading: boolean }) => {
    const { t } = useTranslation();
    const [activeSlide, setActiveSlide] = useState(0); // 0 for first, 1 for second
    const { instanceTableRows } = useAppSelector(state => state.inventoryV2);

    // Auto-rotate slides every 8 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            setActiveSlide(prev => (prev === 0 ? 1 : 0));
        }, 8000);

        return () => clearInterval(interval);
    }, []);

    const filteredCount = useMemo(() => calculateDbBannerCounts(instanceTableRows, DBType.MSSQL), [instanceTableRows]);

    return (
        <div className={styles.scrollableCard2}>
            {activeSlide === 0 && (
                <div className={styles.rightSection}>
                    <div className={styles.imageTextSection}>
                        <div
                            onClick={() => setActiveSlide(1)}
                            className={styles.carousalClass}
                            style={{ cursor: 'pointer' }}
                        >
                            <CarousalLeft />
                        </div>
                        <div className={styles.topSection}>
                            <div className={styles.upperSection}>
                                <WellArchitectMSSQL />
                                <div className={styles.upperRightSection}>
                                    <DsTypography variant="Semibold_16">
                                        {t('databases.banner.well-architected')}
                                    </DsTypography>
                                    <DsTypography variant="Semibold_16">
                                        {t('databases.banner.microsoft-sql-server')}
                                    </DsTypography>
                                </div>
                            </div>

                            <DsTypography variant="Regular_14">
                                {t('databases.banner.microsoft-sql-server-content')}
                            </DsTypography>
                        </div>
                    </div>

                    <div className={styles.mainSection}>
                        <div className={styles.bannerSection}>
                            <BannerCard
                                Image={InstanceRegistration}
                                topText={t('databases.banner.instance-registration')}
                                text2={t('databases.banner.registered-instances')}
                                text3={t('databases.banner.not-registered-instances')}
                                value1={filteredCount?.registeredRows}
                                value2={filteredCount?.notRegisteredRows}
                                viewFilterOption={INVENTORY_BANNER_FILTER_OPTIONS.NOT_REGISTERED_INSTANCES}
                                loading={loading}
                            />

                            <BannerCard
                                Image={InstanceWellArchitected}
                                topText={t('databases.banner.well-architected-instance-status')}
                                text2={t('databases.banner.well-architected-instances')}
                                text3={t('databases.banner.not-optimized-instances')}
                                value1={filteredCount?.wellArchitectedRows}
                                value2={filteredCount?.notOptimizedRows}
                                viewFilterOption={INVENTORY_BANNER_FILTER_OPTIONS.NOT_OPTIMIZED_INSTANCE_SQL}
                                loading={loading}
                            />
                        </div>

                        <div onClick={() => setActiveSlide(1)} style={{ cursor: 'pointer' }}>
                            <CarousalRight />
                        </div>
                    </div>
                </div>
            )}

            {activeSlide === 1 && (
                <div className={styles.rightSection}>
                    <div className={styles.imageTextSection}>
                        <div
                            onClick={() => setActiveSlide(0)}
                            className={styles.carousalClass}
                            style={{ cursor: 'pointer' }}
                        >
                            <CarousalLeft />
                        </div>
                        <div className={styles.topSection}>
                            <div className={styles.upperSection}>
                                <LogAnalyzer />
                                <div className={styles.upperRightSection}>
                                    <DsTypography variant="Semibold_16">
                                        {t('databases.banner.microsoft-sql-server')}
                                    </DsTypography>
                                    <DsTypography variant="Semibold_16">
                                        {t('databases.banner.error-analysis')}
                                    </DsTypography>
                                </div>
                            </div>

                            <DsTypography variant="Regular_14">
                                {t('databases.banner.log-analyzer-content')}
                            </DsTypography>
                        </div>
                    </div>

                    <div className={styles.mainSection}>
                        <div className={styles.bannerSection}>
                            <BannerCard
                                Image={InstanceRegistration}
                                topText={t('databases.banner.instance-registration')}
                                text2={t('databases.banner.registered-instances')}
                                text3={t('databases.banner.not-registered-instances')}
                                value1={filteredCount?.registeredRows}
                                value2={filteredCount?.notRegisteredRows}
                                viewFilterOption={INVENTORY_BANNER_FILTER_OPTIONS.NOT_REGISTERED_INSTANCES}
                                loading={loading}
                            />

                            <BannerCard
                                Image={InstanceLogAnalyzer}
                                topText={t('databases.banner.log-analyzer-instance-status')}
                                text2={t('databases.banner.activated-instances')}
                                text3={t('databases.banner.not-active-instances')}
                                value1={filteredCount?.activatedRows}
                                value2={filteredCount?.notActivatedRows}
                                viewFilterOption={INVENTORY_BANNER_FILTER_OPTIONS.NOT_ACTIVE_INSTANCES}
                                loading={loading}
                            />
                        </div>

                        <div onClick={() => setActiveSlide(0)} style={{ cursor: 'pointer' }}>
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

export default MSSQLBanner;
