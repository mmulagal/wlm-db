import { DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import styles from './UniqueErrorsSeverity.module.scss';
import ErrorBarComponent from './ErrorBarComponent/ErrorBarComponent';
import { useAppSelector } from '../../../../../store/storeHooks';

export const eiSeverityMappingOracle: Record<string, string> = {
    CRITICAL: 'Critical',
    SEVERE: 'Severe',
    IMPORTANT: 'Important'
};

const UniqueErrorsSeverity = ({
    uniqueErrBySeverity,
    dbType
}: {
    uniqueErrBySeverity: Array<{ severity: string; count: number }>;
    dbType: string;
}) => {
    const { t } = useTranslation();
    const { noData, investigationDatesLoading } = useAppSelector(state => state.agenticAI);
    const { errorInvestigationLoading } = useAppSelector(state => state.agenticAI.errorInvestigation);
    const loading = investigationDatesLoading || errorInvestigationLoading;

    const totalCount = uniqueErrBySeverity.reduce((sum, err) => sum + err.count, 0) || 1;
    return (
        <div className={styles.uniqueErrors}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    {t('databases.log-analyzer.unique-errors-severity')}
                </DsTypography>
            </div>

            <div className={styles.mainSection}>
                {loading || noData || uniqueErrBySeverity?.length === 0
                    ? Array.from({ length: 5 }, (_, index) => (
                          <ErrorBarComponent key={index} percentage={0} noFilteredData dbType={dbType} />
                      ))
                    : uniqueErrBySeverity.map(error => {
                          const errorVal = eiSeverityMappingOracle?.[error.severity] || error.severity;
                          if (errorVal && errorVal !== 'undefined') {
                              return (
                                  <ErrorBarComponent
                                      key={errorVal}
                                      percentage={(error.count / totalCount) * 100}
                                      errorCount={error.count}
                                      severity={errorVal}
                                      dbType={dbType}
                                  />
                              );
                          }
                          return null;
                      })}
            </div>
        </div>
    );
};

export default UniqueErrorsSeverity;
