import { DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import styles from './ErrorCards.module.scss';
import { eiSeverityMappingOracle } from '../UniqueErrorsSeverity/UniqueErrorsSeverity';

type ErrorCardProps = {
    errorCode?: string;
    errorMessage?: string;
    severity?: string;
    errorCount?: number;
    filteredCount?: number;
    isSelected?: boolean;
    onClick?: () => void;
    tags?: string[];
};

const ErrorCards = ({
    errorCode,
    errorMessage,
    severity,
    errorCount,
    filteredCount,
    isSelected = false,
    onClick,
    tags
}: ErrorCardProps) => {
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
            <div className={styles.errorCardTopSection}>
                <div className={styles.item}>
                    <DsTypography variant="Regular_14">{t('databases.log-analyzer.error-code')}:</DsTypography>
                    <DsTypography
                        variant="Semibold_14"
                        className={styles.textWrap}
                        title={errorCode || t('databases.log-analyzer.n/a')}
                    >
                        {errorCode || t('databases.log-analyzer.n/a')}
                    </DsTypography>
                </div>

                <div className={styles.item}>
                    <DsTypography variant="Regular_14">{t('databases.log-analyzer.severity')}:</DsTypography>
                    <DsTypography variant="Semibold_14">
                        {eiSeverityMappingOracle?.[severity || ''] || severity || t('databases.log-analyzer.n/a')}
                    </DsTypography>
                </div>

                <div className={styles.item}>
                    <DsTypography variant="Regular_14">{t('databases.log-analyzer.error-count')}:</DsTypography>
                    <DsTypography variant="Semibold_14">
                        {' '}
                        {(filteredCount && errorCount && errorCount > filteredCount
                            ? `${filteredCount}/${errorCount}`
                            : errorCount) || t('databases.log-analyzer.n/a')}
                    </DsTypography>
                </div>
            </div>

            <div className={styles.errorMessage}>
                <DsTypography variant="Semibold_14" title={errorMessage}>
                    {errorMessage || t('databases.log-analyzer.n/a')}
                </DsTypography>
            </div>

            <div className={styles.tagSection}>
                <DsTypography variant="Regular_14" className={styles.tagHeading}>
                    {t('databases.log-analyzer.tags')}:
                </DsTypography>

                {tags && tags.length > 0 ? (
                    tags.map((tag, index) => (
                        <DsTypography key={index} variant="Semibold_13" className={styles.tag}>
                            {tag}
                        </DsTypography>
                    ))
                ) : (
                    <DsTypography variant="Semibold_13" className={styles.tag}>
                        {t('databases.log-analyzer.n/a')}
                    </DsTypography>
                )}
            </div>
        </div>
    );
};

export default ErrorCards;
