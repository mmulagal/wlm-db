import { DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import styles from './UniqueErrorsSeverity.module.scss';
import ErrorBarComponent from './ErrorBarComponent/ErrorBarComponent';

const UniqueErrorsSeverity = ({
    uniqueErrBySeverity
}: {
    uniqueErrBySeverity: Array<{ severity: string; count: number }>;
}) => {
    const { t } = useTranslation();
    const totalCount = uniqueErrBySeverity.reduce((sum, err) => sum + err.count, 0) || 1;
    return (
        <div className={styles.uniqueErrors}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    {t('databases.log-analyzer.unique-errors-severity')}
                </DsTypography>
            </div>

            <div className={styles.mainSection}>
                {uniqueErrBySeverity.map(error => (
                    <ErrorBarComponent
                        key={error.severity}
                        percentage={(error.count / totalCount) * 100}
                        errorCount={error.count}
                        severity={error.severity}
                    />
                ))}
            </div>
        </div>
    );
};

export default UniqueErrorsSeverity;
