import { DsFlashingDotsLoader, DsTypography } from '@tlveng/wlm-ds';
import { DsButton, TooltipInfo } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { ReactComponent as UniqueError } from '../../../../../assets/unique-errors.svg';
import { ReactComponent as Bullet } from '../../../../../assets/ic_bullet.svg';
import styles from './LogAnalyserHeader.module.scss';

const LogAnalyserHeader = () => {
    const { t } = useTranslation();
    const loading = false;
    const na = false;
    const inProgress = false;
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
                            variant={na ? 'Regular_14' : 'Regular_32'}
                            className={na ? styles.disabled : styles.titleText}
                            style={{ paddingRight: '8px', lineHeight: 'unset' }}
                        >
                            {na ? 'N/A' : '150'}
                        </DsTypography>
                    )}
                    <DsTypography
                        variant="Regular_14"
                        className={na ? `${styles.label} ${styles.disabled}` : styles.label}
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
                            variant={na ? 'Regular_14' : 'Regular_32'}
                            className={styles.titleText}
                            style={{ paddingRight: '8px', lineHeight: 'unset' }}
                        >
                            {na ? 'N/A' : '12,000'}
                        </DsTypography>
                    )}
                    <DsTypography
                        variant="Regular_14"
                        className={na ? `${styles.label} ${styles.disabled}` : styles.label}
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
                            className={styles.titleText}
                            style={{ paddingRight: '8px', lineHeight: 'unset' }}
                        >
                            {na ? 'N/A' : 'June 25, 2025 11:40'}
                        </DsTypography>
                    )}
                    <DsTypography
                        variant="Regular_14"
                        className={na ? `${styles.label} ${styles.disabled}` : styles.label}
                        style={{ position: 'relative', top: '6px' }}
                    >
                        {t('databases.log-analyzer.last-scan')}
                    </DsTypography>
                </div>

                <div className={`${styles.column} `} style={{ borderRight: 'none', flex: '1 1 450px' }}>
                    <div className={styles.lastContainer}>
                        {inProgress && (
                            <div className={styles.inProgressContainer}>
                                <DsFlashingDotsLoader />
                                <DsTypography variant="Regular_14">{t('databases.log-analyzer.new-scan')}</DsTypography>
                                <DsButton type="text">{t('databases.log-analyzer.stop-scan')}</DsButton>
                            </div>
                        )}
                        {!inProgress && (
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
                                    className={na || loading ? ` ${styles.disabled}` : ''}
                                >
                                    {t('databases.log-analyzer.scan-details')}
                                </DsTypography>
                            </div>
                        )}

                        <DsButton variant="Default" isThin type="button">
                            {t('databases.log-analyzer.scan-now')}
                        </DsButton>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LogAnalyserHeader;
