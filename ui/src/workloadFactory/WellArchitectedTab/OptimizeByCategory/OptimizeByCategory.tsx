import { DsButton, DsFlashingDotsLoader, DsTypography, useDialog } from '@netapp/design-system';
import { useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { ReactComponent as Storage } from '../../../assets/Storage.svg';
import { ReactComponent as Applications } from '../../../assets/Application.svg';
import { ReactComponent as Resiliency } from '../../../assets/Resiliency.svg';
import { ReactComponent as Cloning } from '../../../assets/Cloning.svg';
import { ReactComponent as Compute } from '../../../assets/Compute.svg';
import styles from './OptimizeByCategory.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { useAppSelector } from '../../../store/storeHooks';
import { getAssessmentGroupedByCategory } from '../../DatabaseHomePage/DatabaseHomeUtils';
import { GENERAL } from '../../../utils/appConstants';

const OptimizeByCategory = () => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const {
        allmssqlHostAssessmentData,
        allmssqlHostAssessmentLoading,
        allOracleHostAssessmentData,
        allOracleHostAssessmentLoading
    } = useAppSelector(state => state.inventoryV2);
    const categoryData = useMemo(
        () => getAssessmentGroupedByCategory(allmssqlHostAssessmentData, allOracleHostAssessmentData),
        [allmssqlHostAssessmentData, allOracleHostAssessmentData]
    );
    const { showNA } = useAppSelector(state => state.headers);

    const loading = useMemo(
        () => allmssqlHostAssessmentLoading || allOracleHostAssessmentLoading,
        [allmssqlHostAssessmentLoading, allOracleHostAssessmentLoading]
    );

    return (
        <div className={`${styles.optimizeByCategory} ${showNA ? CommonStyles.notAvailable : ''}`}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    {GENERAL.WELL_ARCHITECTED_BREAKDOWN_BY_CATEGORY}
                </DsTypography>

                <div className={styles.rightSection}>{loading && <DsFlashingDotsLoader />}</div>
            </div>

            <div className={styles.mainSection}>
                <div className={styles.topSection}>
                    <div className={styles.tile1}>
                        <div className={styles.section1}>
                            <Storage />
                        </div>
                        <div className={styles.section2}>
                            <div className={styles.valueArea}>
                                <DsTypography
                                    variant={showNA ? 'Regular_14' : 'Regular_20'}
                                    className={showNA ? CommonStyles.notAvailable : ''}
                                >
                                    {showNA
                                        ? t('databases.general.not-available')
                                        : `${Math.round(
                                              ((categoryData.mssqlStorage + categoryData.oracleStorage || 0) /
                                                  (categoryData.mssqlTotal + categoryData.oracleTotal || 1)) *
                                                  100
                                          )}%`}
                                </DsTypography>
                                {loading && <DsFlashingDotsLoader />}
                            </div>

                            <DsTypography variant="Regular_14" className={showNA ? CommonStyles.notAvailable : ''}>
                                {GENERAL.STORAGE}
                            </DsTypography>
                        </div>
                        <div className={styles.section3} />
                    </div>
                    <div className={styles.tile1}>
                        <div className={styles.section1}>
                            <Compute />
                        </div>
                        <div className={styles.section2}>
                            <div className={styles.valueArea}>
                                <DsTypography
                                    variant={showNA ? 'Regular_14' : 'Regular_20'}
                                    className={showNA ? CommonStyles.notAvailable : ''}
                                >
                                    {showNA
                                        ? t('databases.general.not-available')
                                        : `${Math.round(
                                              ((categoryData.compute || 0) / (categoryData.mssqlTotal || 1)) * 100
                                          )}%`}
                                </DsTypography>
                                {loading && <DsFlashingDotsLoader />}
                            </div>
                            <DsTypography variant="Regular_14" className={showNA ? CommonStyles.notAvailable : ''}>
                                {GENERAL.COMPUTE}
                            </DsTypography>
                        </div>
                        <div className={styles.section3} />
                    </div>
                    <div className={styles.tile2}>
                        <div className={styles.section1}>
                            <Applications />
                        </div>
                        <div className={styles.section2}>
                            <div className={styles.valueArea}>
                                <DsTypography
                                    variant={showNA ? 'Regular_14' : 'Regular_20'}
                                    className={showNA ? CommonStyles.notAvailable : ''}
                                >
                                    {showNA
                                        ? t('databases.general.not-available')
                                        : `${Math.round(
                                              ((categoryData.application || 0) / (categoryData.mssqlTotal || 1)) * 100
                                          )}%`}
                                </DsTypography>
                                {loading && <DsFlashingDotsLoader />}
                            </div>
                            <DsTypography variant="Regular_14" className={showNA ? CommonStyles.notAvailable : ''}>
                                {t('databases.well-architected-tab.application')}
                            </DsTypography>
                        </div>
                    </div>
                </div>

                <div className={styles.optimizeSeparator} />

                <div className={styles.topSection}>
                    <div className={styles.tile1}>
                        <div className={styles.section1}>
                            <Resiliency />
                        </div>
                        <div className={styles.section2}>
                            <div className={styles.valueArea}>
                                <DsTypography
                                    variant={showNA ? 'Regular_14' : 'Regular_20'}
                                    className={showNA ? CommonStyles.notAvailable : ''}
                                >
                                    {showNA
                                        ? t('databases.general.not-available')
                                        : `${Math.round(
                                              ((categoryData.resiliency || 0) / (categoryData.mssqlTotal || 1)) * 100
                                          )}%`}
                                </DsTypography>
                                {loading && <DsFlashingDotsLoader />}
                            </div>
                            <DsTypography variant="Regular_14" className={showNA ? CommonStyles.notAvailable : ''}>
                                {GENERAL.RESILIENCY}
                            </DsTypography>
                        </div>
                        <div className={styles.section3} />
                    </div>
                    <div className={styles.tile1}>
                        <div className={styles.section1}>
                            <Cloning />
                        </div>
                        <div className={styles.section2}>
                            <div className={styles.valueArea}>
                                <DsTypography
                                    variant={showNA ? 'Regular_14' : 'Regular_20'}
                                    className={showNA ? CommonStyles.notAvailable : ''}
                                >
                                    {showNA
                                        ? t('databases.general.not-available')
                                        : `${Math.round(
                                              ((categoryData.cloning || 0) / (categoryData.mssqlTotal || 1)) * 100
                                          )}%`}
                                </DsTypography>
                                {loading && <DsFlashingDotsLoader />}
                            </div>
                            <DsTypography variant="Regular_14" className={showNA ? CommonStyles.notAvailable : ''}>
                                {GENERAL.CLONING}
                            </DsTypography>
                        </div>
                        <div className={styles.section3} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OptimizeByCategory;
