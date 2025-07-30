import { TooltipInfo } from '@netapp/design-system';
import { DsFlashingDotsLoader, DsTypography, DsButton } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import styles from './ErrorBarComponent.module.scss';
import { useAppSelector } from '../../../../../../store/storeHooks';

type BarComponentType = {
    color?: string;
    percentage?: number | any;
    width?: string;
    errorCount?: number;
    severity?: string;
    noFilteredData?: boolean;
};

const ErrorBarComponent = ({
    color = '#FDC300',
    percentage = 50,
    width,
    errorCount = 0,
    severity = '',
    noFilteredData = false
}: BarComponentType) => {
    const { t } = useTranslation();
    const { noData, investigationDatesLoading } = useAppSelector(state => state.agenticAI);
    const { errorInvestigationLoading } = useAppSelector(state => state.agenticAI.errorInvestigation);
    const loading = investigationDatesLoading || errorInvestigationLoading;

    const handleProgressBar = () => {
        if (loading || noData || noFilteredData) {
            return (
                <div
                    className={`${styles.progress} ${styles.leftCurveBar} ${styles.rightCurveBar}`}
                    style={{
                        width: `${100}%`,
                        backgroundColor: 'var(--border)'
                    }}
                />
            );
        }
        if (percentage === 100) {
            return (
                <div
                    className={`${styles.progress} ${styles.leftCurveBar} ${styles.rightCurveBar}`}
                    style={{
                        width: `${100}%`,
                        backgroundColor: color
                    }}
                />
            );
        }

        if (percentage === 0) {
            return (
                <div
                    className={`${styles.progress} ${styles.leftCurveBar} ${styles.rightCurveBar}`}
                    style={{
                        width: `${100}%`,
                        backgroundColor: 'var(--border)'
                    }}
                />
            );
        }

        if (percentage !== 0) {
            return (
                <>
                    <div
                        className={`${styles.progress} ${styles.leftCurveBar} ${styles.rightCurveBar}`}
                        style={{
                            width: `${percentage}%`,
                            backgroundColor: color
                        }}
                    />

                    <div
                        className={`${styles.progress} ${styles.rightCurveBar} ${styles.opacityColor}`}
                        style={{
                            width: `${100 - percentage}%`
                        }}
                    />
                </>
            );
        }
        return <div />;
    };

    const severityLabel = () => {
        if (!severity) {
            return t('databases.log-analyzer.n/a');
        }
        if (Number(severity) > 9) {
            return t(`databases.log-analyzer.severity-description.${severity}`);
        }
        return t('databases.log-analyzer.severity-description.0-9');
    };

    const learnMore = () => {
        window.open(
            'https://learn.microsoft.com/en-us/sql/relational-databases/errors-events/database-engine-error-severities?view=sql-server-ver16',
            '_blank',
            'noopener,noreferrer'
        );
    };

    return (
        <div className={styles.barComponent}>
            <div className={styles.rightSection} style={{ width }}>
                <div className={styles.topSection}>
                    <div className={styles.textWithLoading}>
                        <TooltipInfo
                            trigger={loading || noData || noFilteredData ? 'click' : 'hover'}
                            className={loading || noData || noFilteredData ? styles.disabled : ''}
                            delayHide={200}
                            interactive
                        >
                            <div className={styles.severityLabel}>
                                {severityLabel()}
                                <DsButton className={styles.buttonClass} onClick={learnMore} type="link">
                                    {t('databases.dashboard.learn-more')}
                                </DsButton>
                            </div>
                        </TooltipInfo>
                        <DsTypography variant="Semibold_14" style={{ marginLeft: '2px' }}>
                            {t('databases.log-analyzer.severity')}
                        </DsTypography>

                        {(!loading || noData || noFilteredData) && (
                            <DsTypography variant="Semibold_14">{severity ? `: ${severity}` : ''}</DsTypography>
                        )}
                    </div>

                    {loading && !noData && <DsFlashingDotsLoader />}

                    {!loading && noData && noFilteredData && (
                        <DsTypography
                            variant="Regular_14"
                            style={{ marginLeft: '2px', color: 'var(--text-secondary)' }}
                        >
                            {t('databases.log-analyzer.n/a')}
                        </DsTypography>
                    )}

                    {!loading && !noData && !noFilteredData && (
                        <div className={styles.optimizeText}>
                            <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                                {`${errorCount}`}
                            </DsTypography>
                            <DsTypography variant="Regular_13" style={{ lineHeight: 'unset' }}>
                                {t('databases.log-analyzer.errors')}
                            </DsTypography>
                        </div>
                    )}
                </div>

                <div className={styles.getWellBar}>
                    <div className={styles.progressBar}>{handleProgressBar()}</div>
                </div>
            </div>
        </div>
    );
};

export default ErrorBarComponent;
