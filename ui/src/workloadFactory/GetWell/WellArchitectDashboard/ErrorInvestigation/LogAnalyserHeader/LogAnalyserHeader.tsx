import { DsFlashingDotsLoader, DsTypography } from '@tlveng/wlm-ds';
import { DsButton, TooltipInfo } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { ReactComponent as UniqueError } from '../../../../../assets/unique-errors.svg';
import { ReactComponent as Bullet } from '../../../../../assets/ic_bullet.svg';
import styles from './LogAnalyserHeader.module.scss';
import { useAppSelector } from '../../../../../store/storeHooks';

interface LogAnalyserHeaderProps {
    uniqueErrors: number;
    totalErrors: number;
    lastScan: string;
}

const LogAnalyserHeader = ({ headerData }: { headerData: LogAnalyserHeaderProps }) => {
    const { t } = useTranslation();

    const { errorInvestigationLoading } = useAppSelector(state => state.agenticAI.errorInvestigation);
    const { investigationDatesLoading, scanInProgress, noData } = useAppSelector(state => state.agenticAI);
    const loading = errorInvestigationLoading || investigationDatesLoading;

    return (
        <div className={styles.logHeader}>
            <div className={styles.cardContent}>
                {/* image */}
                <div className={`${styles.column} ${styles.columnImage}`}>
                    <UniqueError />
                </div>
                <div className={`${styles.column} `}>
                    {loading ? (
                        <DsFlashingDotsLoader />
                    ) : (
                        <DsTypography
                            variant={noData ? 'Regular_14' : 'Regular_32'}
                            className={noData ? styles.disabled : styles.titleText}
                            style={{ paddingRight: '8px', lineHeight: 'unset' }}
                        >
                            {noData ? t('databases.log-analyzer.n/a') : headerData.uniqueErrors}
                        </DsTypography>
                    )}
                    <DsTypography
                        variant="Regular_14"
                        className={noData ? `${styles.label} ${styles.disabled}` : styles.label}
                    >
                        {t('databases.log-analyzer.unique-errors')}
                    </DsTypography>
                </div>
                {/* section 2 */}
                <div className={`${styles.column} `}>
                    {loading ? (
                        <DsFlashingDotsLoader />
                    ) : (
                        <DsTypography
                            variant={noData ? 'Regular_14' : 'Regular_32'}
                            className={noData ? styles.disabled : styles.titleText}
                            style={{ paddingRight: '8px', lineHeight: 'unset' }}
                        >
                            {noData ? t('databases.log-analyzer.n/a') : headerData.totalErrors}
                        </DsTypography>
                    )}
                    <DsTypography
                        variant="Regular_14"
                        className={noData ? `${styles.label} ${styles.disabled}` : styles.label}
                    >
                        {t('databases.log-analyzer.total-errors')}
                    </DsTypography>
                </div>

                <div className={`${styles.column} `}>
                    {loading ? (
                        <DsFlashingDotsLoader />
                    ) : (
                        <DsTypography
                            variant="Regular_14"
                            className={noData ? styles.disabled : styles.titleText}
                            style={{ paddingRight: '8px', lineHeight: 'unset' }}
                        >
                            {noData
                                ? t('databases.log-analyzer.n/a')
                                : headerData?.lastScan || t('databases.log-analyzer.n/a')}
                        </DsTypography>
                    )}
                    <DsTypography
                        variant="Regular_14"
                        className={noData ? `${styles.label} ${styles.disabled}` : styles.label}
                        style={{ position: 'relative', top: '6px' }}
                    >
                        {t('databases.log-analyzer.last-scan')}
                    </DsTypography>
                </div>

                <div className={`${styles.column} `} style={{ borderRight: 'none', flex: '1 1 450px' }}>
                    <div className={styles.lastContainer}>
                        {scanInProgress && (
                            <div className={styles.inProgressContainer}>
                                <DsFlashingDotsLoader />
                                <DsTypography variant="Regular_14">{t('databases.log-analyzer.new-scan')}</DsTypography>
                                <DsButton type="text">{t('databases.log-analyzer.stop-scan')}</DsButton>
                            </div>
                        )}
                        {!scanInProgress && (
                            <div className={styles.tooltipContainer}>
                                <TooltipInfo>
                                    <div className={styles.mainSection}>
                                        <DsTypography variant="Semibold_13">
                                            {t('databases.log-analyzer.scan-details')}
                                        </DsTypography>
                                        <div className={styles.row}>
                                            <Bullet />
                                            <DsTypography variant="Regular_13">
                                                {t('databases.log-analyzer.display-activity')}
                                            </DsTypography>
                                        </div>
                                        <div className={styles.row}>
                                            <Bullet />
                                            <DsTypography variant="Regular_13">
                                                {t('databases.log-analyzer.include-errors')}
                                            </DsTypography>
                                        </div>
                                        <div />
                                    </div>
                                </TooltipInfo>
                                <DsTypography
                                    variant="Semibold_14"
                                    className={noData || loading ? ` ${styles.disabled}` : ''}
                                >
                                    {t('databases.log-analyzer.scan-details')}
                                </DsTypography>
                            </div>
                        )}

                        <DsButton variant="Default" isThin type="button" isDisabled={loading || scanInProgress}>
                            {t('databases.log-analyzer.scan-now')}
                        </DsButton>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LogAnalyserHeader;
