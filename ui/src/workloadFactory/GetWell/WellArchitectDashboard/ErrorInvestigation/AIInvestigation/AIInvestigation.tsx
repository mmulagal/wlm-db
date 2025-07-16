import { useTranslation } from 'react-i18next';
import { DsTypography } from '@tlveng/wlm-ds';
import { ReactComponent as InfoIcon } from '@netapp/icons/ic_info.svg';
import { ReactComponent as AIInvestigationIcon } from '../../../../../assets/ai-investigation.svg';
import { ReactComponent as Bullet } from '../../../../../assets/ic_bullet.svg';
import styles from './AIInvestigation.module.scss';
import SeparatorComponent from '../../../../../common/SeparatorComponent/SeparatorComponent';
import ErrorCountChart from '../ErrorCountChart/ErrorCountChart';
import { formatTime } from '../../../../../utils/utilityFunctions';
import { ErrorInvestigationGetApiResponse } from '../../../../../utils/types/agenticAITypes';

const AIInvestigation = ({
    selectedErrorData,
    startTime,
    endTime
}: {
    selectedErrorData: ErrorInvestigationGetApiResponse | null;
    startTime: number;
    endTime: number;
}) => {
    const markedNumbers = ['03:00', '10:00', '12:00', '18:00'];
    const { t } = useTranslation();

    return (
        <div className={styles.investigation}>
            <div className={styles.headerSection}>
                <AIInvestigationIcon />
                <div className={styles.rightHeaderSection}>
                    <DsTypography variant="Semibold_14">{t('databases.log-analyzer.ai-investigation')}</DsTypography>
                    <DsTypography variant="Semibold_13" className={styles.tag}>
                        {t('databases.log-analyzer.error-code')}: {selectedErrorData?.errorCode}
                    </DsTypography>
                </div>
            </div>

            <SeparatorComponent variant="horizontal" />

            <div className={styles.sectionOne}>
                <div className={styles.errorInfoRow}>
                    <DsTypography variant="Semibold_14">
                        {t('databases.log-analyzer.error-count')}:{' '}
                        {selectedErrorData?.totalFilteredCount &&
                        selectedErrorData?.totalFilteredCount < selectedErrorData?.count
                            ? `${selectedErrorData?.totalFilteredCount}/${selectedErrorData?.count}`
                            : `${selectedErrorData?.count}`}
                    </DsTypography>
                    <div className={styles.errorInfoRight}>
                        {selectedErrorData?.totalFilteredCount &&
                        selectedErrorData?.totalFilteredCount >= selectedErrorData?.count ? (
                            <>
                                <DsTypography variant="Regular_13">
                                    {t('databases.log-analyzer.first-occurrence')}:{' '}
                                    {selectedErrorData?.firstOccurrence
                                        ? formatTime(selectedErrorData?.firstOccurrence)
                                        : ''}
                                </DsTypography>
                                <DsTypography variant="Regular_13">
                                    {t('databases.log-analyzer.last-occurrence')}:{' '}
                                    {selectedErrorData?.lastOccurrence
                                        ? formatTime(selectedErrorData?.lastOccurrence)
                                        : ''}
                                </DsTypography>
                            </>
                        ) : (
                            <div className={styles.setSVG}>
                                <InfoIcon />
                                <DsTypography variant="Regular_13">
                                    {t('databases.log-analyzer.timeframe-is-filtered')}
                                </DsTypography>
                            </div>
                        )}
                    </div>
                </div>
                <ErrorCountChart startTime={startTime} endTime={endTime} markedNumbers={markedNumbers} />
            </div>

            <div className={styles.sectionTwo}>
                <div className={styles.individualSection}>
                    <DsTypography variant="Semibold_14">
                        {t('databases.log-analyzer.original-error-message')}
                    </DsTypography>
                    <DsTypography variant="Regular_14" className={styles.contentSection}>
                        {selectedErrorData?.error}
                    </DsTypography>
                </div>

                <div className={styles.individualSection}>
                    <DsTypography variant="Semibold_14">{t('databases.log-analyzer.explanation')}</DsTypography>
                    <DsTypography variant="Regular_14" className={styles.contentSection}>
                        {selectedErrorData?.cause}
                    </DsTypography>
                </div>
            </div>

            <div className={styles.sectionThree}>
                <DsTypography variant="Semibold_14">{t('databases.log-analyzer.remediation')}</DsTypography>
                <div className={styles.contentSection}>
                    {selectedErrorData?.remediation?.map(item => (
                        <div className={styles.bulletSection}>
                            <Bullet />
                            <DsTypography variant="Regular_14" className={styles.bulletText}>
                                {item}
                            </DsTypography>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AIInvestigation;
