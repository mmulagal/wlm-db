import { DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { ReactComponent as WellArchitect } from '../../../assets/well-architect.svg';
import { ReactComponent as Success } from '../../../assets/success.svg';
import styles from './TotalOptimizationScore.module.scss';
import OptimizationChart from './OptimizationChart/OptimizationChart';

import { GENERAL } from '../../../utils/appConstants';

const TotalOptimizationScore = ({ loading, optimizationBreakDown, isAssessmentAvailable }: any) => {
    const { t } = useTranslation();

    return (
        <div className={styles.totalOptimizationScore}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    {t('databases.well-architect.well-architected-score')}
                </DsTypography>
                {loading && <DsFlashingDotsLoader />}
            </div>

            {!loading && Number(optimizationBreakDown?.total?.percent) === 100 && (
                <div className={styles.perfectScore}>
                    <div className={styles.image}>
                        <WellArchitect />
                    </div>
                    <div className={styles.text}>
                        <div className={styles.firstBlock}>
                            <Success />
                            <DsTypography variant="Semibold_16">
                                {t('databases.well-architect.well-architected-instance')}
                            </DsTypography>
                        </div>

                        <div className={styles.secondBlock}>
                            <DsTypography variant="Regular_14" style={{ textAlign: 'center' }}>
                                {t('databases.well-architect.well-architected-issue')}
                            </DsTypography>
                        </div>
                    </div>
                </div>
            )}

            {(loading || Number(optimizationBreakDown?.total?.percent) !== 100) && (
                <div className={styles.mainSection}>
                    <div className={styles.chartSection}>
                        <OptimizationChart hostData={optimizationBreakDown?.total} />
                    </div>

                    <div className={styles.smallTileSection}>
                        <div className={styles.smallTile}>
                            <div className={styles.bottomRow}>
                                <DsTypography variant="Regular_14" isDisabled={!!(!loading && !isAssessmentAvailable)}>
                                    {t('databases.well-architect.non-optimal-critical')}
                                </DsTypography>
                            </div>

                            <div className={styles.separator} style={{ visibility: 'hidden' }} />

                            {loading && <DsFlashingDotsLoader />}
                            {!loading &&
                                (isAssessmentAvailable ? (
                                    <DsTypography variant="Semibold_14">
                                        {optimizationBreakDown?.total?.critical}
                                    </DsTypography>
                                ) : (
                                    <DsTypography variant="Semibold_14" isDisabled>
                                        {GENERAL.NOT_AVAILABLE}
                                    </DsTypography>
                                ))}
                        </div>

                        <div className={styles.horizontalSeparator} />

                        <div className={styles.smallTile}>
                            <div className={styles.bottomRow}>
                                <DsTypography variant="Regular_14" isDisabled={!!(!loading && !isAssessmentAvailable)}>
                                    {t('databases.well-architect.non-optimal-warning')}
                                </DsTypography>
                            </div>

                            <div className={styles.separator} style={{ visibility: 'hidden' }} />

                            {loading && <DsFlashingDotsLoader />}
                            {!loading &&
                                (isAssessmentAvailable ? (
                                    <DsTypography variant="Semibold_14">
                                        {optimizationBreakDown?.total?.warning}
                                    </DsTypography>
                                ) : (
                                    <DsTypography variant="Semibold_14" isDisabled>
                                        {GENERAL.NOT_AVAILABLE}
                                    </DsTypography>
                                ))}
                        </div>

                        <div className={styles.horizontalSeparator} />

                        <div className={styles.smallTile}>
                            <div className={styles.bottomRow}>
                                <DsTypography variant="Regular_14" isDisabled={!!(!loading && !isAssessmentAvailable)}>
                                    {t('databases.well-architect.well-architected-configs')}
                                </DsTypography>
                            </div>

                            <div className={styles.separator} style={{ visibility: 'hidden' }} />

                            {loading && <DsFlashingDotsLoader />}
                            {!loading &&
                                (isAssessmentAvailable ? (
                                    <DsTypography variant="Semibold_14">
                                        {optimizationBreakDown?.total?.optimized}
                                    </DsTypography>
                                ) : (
                                    <DsTypography variant="Semibold_14" isDisabled>
                                        {GENERAL.NOT_AVAILABLE}
                                    </DsTypography>
                                ))}
                        </div>

                        <div className={styles.horizontalSeparator} />

                        <div className={styles.smallTile}>
                            <DsTypography
                                style={{ width: '140px' }}
                                variant="Semibold_14"
                                isDisabled={!!(!loading && !isAssessmentAvailable)}
                            >
                                {t('databases.well-architect.total')}
                            </DsTypography>

                            <div className={styles.separator} style={{ visibility: 'hidden' }} />
                            {loading && <DsFlashingDotsLoader />}
                            {!loading &&
                                (isAssessmentAvailable ? (
                                    <DsTypography variant="Semibold_14">
                                        {optimizationBreakDown?.total?.total}
                                    </DsTypography>
                                ) : (
                                    <DsTypography variant="Semibold_14" isDisabled>
                                        {GENERAL.NOT_AVAILABLE}
                                    </DsTypography>
                                ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TotalOptimizationScore;
