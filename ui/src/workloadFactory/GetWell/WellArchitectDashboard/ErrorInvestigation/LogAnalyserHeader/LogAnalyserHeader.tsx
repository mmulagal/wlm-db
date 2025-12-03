import { DsFlashingDotsLoader, DsTypography } from '@tlveng/wlm-ds';
import { DsButton, TooltipInfo, useDialog } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { useEffect, useState } from 'react';
import { ReactComponent as UniqueError } from '../../../../../assets/unique-errors.svg';
import { ReactComponent as Bullet } from '../../../../../assets/ic_bullet.svg';
import styles from './LogAnalyserHeader.module.scss';
import { useAppSelector } from '../../../../../store/storeHooks';
import { useLazyGetSubTaskListQuery, useScanErrorInvestigationMutation } from '../../../../../utils/apiService';
import { WLF_TABS } from '../../../../../utils/consts';
import { handleLogAnalyzerJob, logAnalyzerScanUpdate } from '../ErrorInvestigationUtility';
import { uniqueHostRow } from '../../../../InventoryV2/InventoryUtilsV2';
import DialogComponent from '../../../../../common/Dialog/DialogComponent';
import AnalyzeCustomTimeframe from './AnalyzeCustomTimeframe/AnalyzeCustomTimeframe';

interface LogAnalyserHeaderProps {
    uniqueErrors: number;
    totalErrors: number;
    lastScan: string;
}

const LogAnalyserHeader = ({ headerData, dbType }: { headerData: LogAnalyserHeaderProps; dbType: string }) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { setDialog, closeDialog } = useDialog();

    const [instKey, setInstKey] = useState('');

    const { credIdFromJM, regionFromJM, landingFrom } = useAppSelector(state => state.getWellOptimize);
    const { selectedResourceId, selectedDatabaseInstance, selectedGwInstanceCredId, selectedGwInstanceRegionId } =
        useAppSelector(state => state.getWellOptimize);
    const {
        selectedCustomAnalysisTimeFrameUnit,
        selectedCustomAnalysisTime,
        durationCustomAnalysis,
        startCustomAnalysisTime
    } = useAppSelector(state => state.agenticAI);
    const { errorInvestigationLoading } = useAppSelector(state => state.agenticAI.errorInvestigation);
    const { investigationDatesLoading, noData } = useAppSelector(state => state.agenticAI);
    const { scanInProgress } = useAppSelector(state => state.agenticAI);
    const loading = errorInvestigationLoading || investigationDatesLoading;

    const [scanErrorInvestigation] = useScanErrorInvestigationMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();

    useEffect(() => {
        const credId = landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM;
        const regionId = landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM;
        const key = uniqueHostRow(`${selectedResourceId}_${selectedDatabaseInstance}`, credId, regionId);
        setInstKey(key);
    }, [scanInProgress]);

    const handleScan = (type: string) => {
        const credId = landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM;
        const regionId = landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM;
        const key = uniqueHostRow(`${selectedResourceId}_${selectedDatabaseInstance}`, credId, regionId);
        logAnalyzerScanUpdate(key, true, dispatch);

        let newPayload = {};
        if (type === 'custom') {
            const startTimeDate =
                startCustomAnalysisTime &&
                startCustomAnalysisTime.toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                });

            const dateTimeString = `${startTimeDate} ${selectedCustomAnalysisTime?.label} ${selectedCustomAnalysisTimeFrameUnit?.label}`;

            const localDate = new Date(dateTimeString);

            const timestamp = Date.UTC(
                localDate.getFullYear(),
                localDate.getMonth(),
                localDate.getDate(),
                localDate.getHours(),
                localDate.getMinutes(),
                localDate.getSeconds(),
                localDate.getMilliseconds()
            );

            newPayload = {
                logsAnalyzerFromTimestamp: timestamp,
                logsWindowDuration: durationCustomAnalysis
            };
        } else {
            newPayload = {};
        }
        scanErrorInvestigation({
            credentialId: credId,
            regionId,
            databaseHostId: selectedResourceId,
            instanceId: selectedDatabaseInstance,
            payload: newPayload,
            dbType
        }).then((res: any) => {
            handleLogAnalyzerJob(dispatch, res, getJobDetailApi, t, false, key, null, dbType);
        });
    };

    // function to invoke dialog for custom timeframe
    const handleCustomTimeframe = () => {
        setDialog(
            <DialogComponent
                header={t('databases.log-analyzer.analyze-now-custom-timeframe')}
                content={<AnalyzeCustomTimeframe />}
                primaryButton={t('databases.log-analyzer.start')}
                secondaryButton={t('databases.log-analyzer.cancel')}
                callback={() => {
                    handleScan('custom');
                }}
                closeCallback={() => {
                    closeDialog();
                }}
            />
        );
    };

    return (
        <div className={styles.logHeader}>
            <div className={styles.cardContent}>
                {/* image */}
                <div className={`${styles.column} ${styles.columnImage}`}>
                    <UniqueError />
                </div>
                <div className={`${styles.column} `}>
                    {loading ? (
                        <div className={styles.loadingClass}>
                            <DsFlashingDotsLoader />
                        </div>
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
                        <div className={styles.loadingClass}>
                            <DsFlashingDotsLoader />
                        </div>
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

                <div className={`${styles.column} `} style={{ borderRight: 'none', flex: '1 1 450px' }}>
                    <div className={styles.lastContainer}>
                        {scanInProgress?.[instKey] && (
                            <div className={styles.inProgressContainer}>
                                <DsFlashingDotsLoader />
                                <DsTypography variant="Regular_14">{t('databases.log-analyzer.new-scan')}</DsTypography>
                            </div>
                        )}
                        {!scanInProgress?.[instKey] && (
                            <div className={styles.tooltipContainer}>
                                <TooltipInfo>
                                    <div className={styles.mainSection}>
                                        <DsTypography variant="Semibold_13">
                                            {t('databases.log-analyzer.scan-details')}
                                        </DsTypography>
                                        <div className={styles.row}>
                                            <div>
                                                <Bullet />
                                            </div>
                                            <DsTypography variant="Regular_13">
                                                {t('databases.log-analyzer.display-activity')}
                                            </DsTypography>
                                        </div>
                                        <div className={styles.row}>
                                            <div>
                                                <Bullet />
                                            </div>
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

                        {/* <DsButton
                            variant="Default"
                            isThin
                            type="button"
                            isDisabled={loading || scanInProgress?.[instKey]}
                            onClick={handleScan}
                            data-testid="wlm-db-error-investigation-investigate-now-button"
                        >
                            {t('databases.log-analyzer.scan-now')}
                        </DsButton> */}

                        <DsButton
                            children={t('databases.log-analyzer.scan-now')}
                            variant="primary"
                            isDisabled={loading || scanInProgress?.[instKey]}
                            isThin
                            dropDown={{
                                trigger: 'click',
                                autoPosition: true,
                                items: [
                                    {
                                        id: 'wlm-db-last-24-hours',
                                        label: 'last 24 hours',
                                        onClick: () => {
                                            handleScan('manual');
                                        }
                                    },
                                    {
                                        id: 'wlm-db-custom-timeframe',
                                        label: 'Custom timeframe',
                                        onClick: () => {
                                            handleCustomTimeframe();
                                        }
                                    }
                                ]
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LogAnalyserHeader;
