import { DsFlashingDotsLoader, DsTypography } from '@tlveng/wlm-ds';
import { DsButton, TooltipInfo } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { useEffect } from 'react';
import { ReactComponent as UniqueError } from '../../../../../assets/unique-errors.svg';
import { ReactComponent as Bullet } from '../../../../../assets/ic_bullet.svg';
import styles from './LogAnalyserHeader.module.scss';
import { useAppSelector } from '../../../../../store/storeHooks';
import { useLazyGetSubTaskListQuery, useScanErrorInvestigationMutation } from '../../../../../utils/apiService';
import {
    setEiRefreshPage,
    setScanInProgress,
    setScanStatus,
    setStopErrorInvestigationScan
} from '../../../../../store/workloadFactory/agenticAISlice';
import { JOB_MONITORING_STATUS, LOG_ANALYZER_POLLING_INTERVAL, WLF_TABS } from '../../../../../utils/consts';
import { addNotification, NOTIFICATION_TYPES } from '../../../../../store/notificationSlice';
import store from '../../../../../store/store';

interface LogAnalyserHeaderProps {
    uniqueErrors: number;
    totalErrors: number;
    lastScan: string;
}

const LogAnalyserHeader = ({ headerData }: { headerData: LogAnalyserHeaderProps }) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();

    const { credIdFromJM, regionFromJM, landingFrom } = useAppSelector(state => state.getWellOptimize);
    const { selectedResourceId, selectedDatabaseInstance, selectedGwInstanceCredId, selectedGwInstanceRegionId } =
        useAppSelector(state => state.getWellOptimize);
    const { errorInvestigationLoading } = useAppSelector(state => state.agenticAI.errorInvestigation);
    const { investigationDatesLoading, noData } = useAppSelector(state => state.agenticAI);
    const { scanInProgress, stopErrorInvestigationScan } = useAppSelector(state => state.agenticAI.scanStatus);
    const loading = errorInvestigationLoading || investigationDatesLoading;

    const [scanErrorInvestigation] = useScanErrorInvestigationMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();

    useEffect(() => {
        if (stopErrorInvestigationScan) {
            dispatch(setScanInProgress(false));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stopErrorInvestigationScan]);

    const handleScan = () => {
        dispatch(setScanInProgress(true));
        scanErrorInvestigation({
            credentialId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM,
            regionId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM,
            databaseHostId: selectedResourceId,
            instanceId: selectedDatabaseInstance,
            payload: {}
        }).then((res: any) => {
            const jobId = res?.data?.jobId;
            const state = store.getState();
            const { stopErrorInvestigationScan: stopScan } = state.agenticAI.scanStatus;
            if (stopScan) {
                dispatch(setScanStatus({ stopScan: false, inProgress: false }));
            } else if (jobId) {
                const jobInterval = setInterval(() => {
                    getJobDetailApi({
                        id: jobId
                    }).then((jobRes: any) => {
                        const status = jobRes?.data?.status;
                        const state1 = store.getState();
                        const { stopErrorInvestigationScan: stopScan1 } = state1.agenticAI.scanStatus;
                        if (stopScan1) {
                            clearInterval(jobInterval);
                            dispatch(setScanStatus({ stopScan: false, inProgress: false }));
                        } else if (
                            status === JOB_MONITORING_STATUS.COMPLETED ||
                            status === JOB_MONITORING_STATUS.WARNING
                        ) {
                            dispatch(setScanInProgress(false));
                            clearInterval(jobInterval);
                            if (!stopScan1) {
                                dispatch(setEiRefreshPage(true));
                                dispatch(setStopErrorInvestigationScan(false));
                            }
                        } else if (status === JOB_MONITORING_STATUS.FAILED) {
                            dispatch(setScanInProgress(false));
                            clearInterval(jobInterval);
                            dispatch(
                                addNotification({
                                    notificationType: NOTIFICATION_TYPES.ERROR,
                                    message: jobRes?.data?.error || t('databases.log-analyzer.scan-failed')
                                })
                            );
                        }
                    });
                }, LOG_ANALYZER_POLLING_INTERVAL);
            } else {
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.ERROR,
                        message: t('databases.log-analyzer.scan-trigger-error')
                    })
                );
                dispatch(setScanInProgress(false));
            }
        });
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
                        {scanInProgress && (
                            <div className={styles.inProgressContainer}>
                                <DsFlashingDotsLoader />
                                <DsTypography variant="Regular_14">{t('databases.log-analyzer.new-scan')}</DsTypography>
                                {/* Will discuss in UX review to exclude this */}
                                {/* <DsButton type="text" onClick={() => dispatch(setStopErrorInvestigationScan(true))}>
                                    {t('databases.log-analyzer.stop-scan')}
                                </DsButton> */}
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

                        <DsButton
                            variant="Default"
                            isThin
                            type="button"
                            isDisabled={loading || scanInProgress}
                            onClick={handleScan}
                        >
                            {t('databases.log-analyzer.scan-now')}
                        </DsButton>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LogAnalyserHeader;
