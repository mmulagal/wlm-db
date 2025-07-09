import { DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import styles from './ErrorCards.module.scss';

type ErrorCardProps = {
    errorCode?: string;
    errorMessage?: string;
    severity?: string;
    errorCount?: number;
    isSelected?: boolean;
    onClick?: () => void;
};

const ErrorCards = ({ errorCode, errorMessage, severity, errorCount, isSelected = false, onClick }: ErrorCardProps) => {
    const { t } = useTranslation();
    return (
        <div
            className={`${styles.errorCards} ${isSelected ? styles.selected : ''}`}
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyDown={e => {
                if (onClick && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onClick();
                }
            }}
        >
            <DsTypography variant="Semibold_13" className={styles.tag}>
                {t('databases.log-analyzer.error-code')}: {errorCode}
            </DsTypography>

            <div className={styles.errorMessage}>
                <DsTypography variant="Semibold_14" title={errorMessage}>
                    {errorMessage}
                </DsTypography>
            </div>

            <div className={styles.severitySection}>
                <DsTypography variant="Regular_14" className={styles.severity}>
                    {t('databases.log-analyzer.severity')}: {severity}
                </DsTypography>
                <DsTypography variant="Regular_14" className={styles.severity}>
                    {t('databases.log-analyzer.error-count')}: {errorCount}
                </DsTypography>
            </div>
        </div>
    );
};

export default ErrorCards;
