import { useTranslation } from 'react-i18next';
import { DsTypography } from '@tlveng/wlm-ds';
import { ReactComponent as InfoIcon } from '@netapp/icons/ic_info.svg';
import { ReactComponent as AIInvestigationIcon } from '../../../../../assets/instance-log-analyzer.svg';
import { ReactComponent as Bullet } from '../../../../../assets/ic_bullet.svg';
import styles from './AIInvestigation.module.scss';
import SeparatorComponent from '../../../../../common/SeparatorComponent/SeparatorComponent';
import ErrorCountChart from '../ErrorCountChart/ErrorCountChart';
import { formatTime } from '../../../../../utils/utilityFunctions';
import { ErrorInvestigationGetApiResponse } from '../../../../../utils/types/agenticAITypes';
import { eiSeverityMappingOracle } from '../UniqueErrorsSeverity/UniqueErrorsSeverity';

const AIInvestigation = ({
    selectedErrorData,
    startTime,
    endTime
}: {
    selectedErrorData: ErrorInvestigationGetApiResponse | null;
    startTime: number;
    endTime: number;
}) => {
    const { t } = useTranslation();

    return (
        <div className={styles.investigation}>
            <div className={styles.headerSection}>
                <AIInvestigationIcon />
                <div className={styles.rightHeaderSection}>
                    <DsTypography variant="Semibold_14">{t('databases.log-analyzer.ai-investigation')}</DsTypography>

                    <div className={styles.bottomHeaderSection}>
                        <div className={styles.item}>
                            <DsTypography variant="Regular_14">{t('databases.log-analyzer.error-code')}:</DsTypography>
                            <DsTypography variant="Semibold_14">
                                {selectedErrorData?.errorCode || t('databases.log-analyzer.n/a')}
                            </DsTypography>
                        </div>

                        <SeparatorComponent variant="vertical" height="20px" />

                        <div className={styles.item}>
                            <DsTypography variant="Regular_14">{t('databases.log-analyzer.severity')}:</DsTypography>
                            <DsTypography variant="Semibold_14">
                                {eiSeverityMappingOracle?.[selectedErrorData?.severity || ''] ||
                                    selectedErrorData?.severity ||
                                    t('databases.log-analyzer.n/a')}
                            </DsTypography>
                        </div>

                        <SeparatorComponent variant="vertical" height="20px" />

                        <div className={styles.tagsSection}>
                            <DsTypography variant="Regular_14">{t('databases.log-analyzer.tags')}:</DsTypography>

                            {selectedErrorData?.tags && selectedErrorData.tags.length > 0 ? (
                                selectedErrorData.tags.map((tag: string, index: number) => (
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
                <ErrorCountChart
                    startTime={startTime}
                    endTime={endTime}
                    hourlyErrorCounts={selectedErrorData?.hourlyErrorCounts || []}
                />
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
                    {selectedErrorData?.remediation?.map((item: string, index: number) => (
                        <div key={index} className={styles.bulletSection}>
                            <div>
                                <Bullet />
                            </div>
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
