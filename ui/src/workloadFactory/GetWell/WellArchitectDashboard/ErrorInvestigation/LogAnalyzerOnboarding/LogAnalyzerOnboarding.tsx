import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useDialog } from '@netapp/design-system';
import { ReactComponent as RefreshIcon } from '@netapp/icons/ic_refresh.svg';
import { useEffect, useState } from 'react';
import { DsButton, DsTypography } from '@tlveng/wlm-ds';
import OnboardingAccordions from '../OnboardingAccordions/OnboardingAccordions';
import ScrollableCard from '../ScrollableCard/ScrollableCard';
import styles from './LogAnalyzerOnboarding.module.scss';
import {
    setLogAnalyzerPreReqData,
    setLogAnalyzerPreReqLoading,
    setLogAnalyzerState
} from '../../../../../store/workloadFactory/agenticAISlice';
import { ReactComponent as InfoIcon } from '../../../../../assets/ic_info.svg';
import LogAnalyzerOnboardingAPI from './LogAnalyzerOnboardingAPI';
import { useAppSelector } from '../../../../../store/storeHooks';
import {
    useGetLogAnalyzerPreReqMutation,
    useGetLogAnalyzerPreReqOracleMutation,
    useLazyGetSubTaskListQuery,
    useScanErrorInvestigationMutation
} from '../../../../../utils/apiService';
import { DBType, ERROR_ANALYZER_STATUS, FROM_DIALOG, WLF_TABS } from '../../../../../utils/consts';
import {
    handleLogAnalyzerJob,
    logAnalyzerScanUpdate,
    runInvestigationPreReqApiCall
} from '../ErrorInvestigationUtility';
import store from '../../../../../store/store';
import { addAllLogAnalysisData } from '../../../../../store/workloadFactory/inventoryV2Slice';
import { uniqueHostRow } from '../../../../InventoryV2/InventoryUtilsV2';
import DialogComponent from '../../../../../common/Dialog/DialogComponent';
import AnalyzeCustomTimeframe from '../LogAnalyserHeader/AnalyzeCustomTimeframe/AnalyzeCustomTimeframe';

const LogAnalyzerOnboarding = ({ dbType }: { dbType: string }) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { setDialog, closeDialog } = useDialog();

    const [isActive, setIsActive] = useState(false);

    const { credIdFromJM, regionFromJM, landingFrom } = useAppSelector(state => state.getWellOptimize);

    const { selectedResourceId, selectedDatabaseInstance, selectedGwInstanceCredId, selectedGwInstanceRegionId } =
        useAppSelector(state => state.getWellOptimize);

    const { data, loading } = useAppSelector(state => state.agenticAI.logAnalyzerPricing);

    const { data: preReqData, loading: preReqLoading } = useAppSelector(state => state.agenticAI.logAnalyzerPreReq);

    useEffect(() => {
        if (preReqData) {
            if (dbType === DBType.ORACLE) {
                setIsActive(
                    preReqData?.bedrockPreRequisites?.ready &&
                        preReqData?.networkingPreRequisites?.ready &&
                        preReqData?.credentialsPreRequisites?.ready &&
                        preReqData?.instanceProfilePreRequisites?.ready &&
                        (preReqData?.oraclePermissionsPreRequisites?.ready || false)
                );
            } else {
                setIsActive(
                    preReqData?.bedrockPreRequisites?.ready &&
                        preReqData?.networkingPreRequisites?.ready &&
                        preReqData?.credentialsPreRequisites?.ready &&
                        preReqData?.instanceProfilePreRequisites?.ready
                );
            }
        }
    }, [preReqData]);

    LogAnalyzerOnboardingAPI({ dbType });

    const [getLogAnalyzerPreReqApi] = useGetLogAnalyzerPreReqMutation();
    const [getLogAnalyzerPreReqOracleApi] = useGetLogAnalyzerPreReqOracleMutation();
    const [scanErrorInvestigation] = useScanErrorInvestigationMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();

    const activateHandler = (type: string) => {
        dispatch(setLogAnalyzerState(ERROR_ANALYZER_STATUS.RUNNING));
        const credId = landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM;
        const regionId = landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM;
        const key = uniqueHostRow(`${selectedResourceId}_${selectedDatabaseInstance}`, credId, regionId);
        const state = store.getState();
        logAnalyzerScanUpdate(key, true, dispatch);
        let newPayload = {};
        if (type === 'custom') {
            const startTimeDate =
                state?.agenticAI?.startCustomAnalysisTime &&
                state?.agenticAI?.startCustomAnalysisTime.toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                });

            const dateTimeString = `${startTimeDate} ${state?.agenticAI?.selectedCustomAnalysisTime?.label} ${state?.agenticAI?.selectedCustomAnalysisTimeFrameUnit?.label}`;

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
                logsWindowDuration: state?.agenticAI?.durationCustomAnalysis
            };
        } else {
            newPayload = {};
        }
        scanErrorInvestigation({
            credentialId: credId,
            regionId,
            databaseHostId: selectedResourceId,
            instanceId: selectedDatabaseInstance,
            dbType,
            payload: newPayload
        }).then((res: any) => {
            const newObj = {
                credentialId: credId,
                databaseHostId: selectedResourceId,
                databaseInstanceId: selectedDatabaseInstance || '',
                id: '',
                regionId,
                status: ERROR_ANALYZER_STATUS.RUNNING,
                latestReport: {
                    creationTime: 0,
                    jobId: res.data?.jobId || '',
                    errorCount: 0,
                    severityCounts: {
                        important: 0,
                        critical: 0,
                        severe: 0
                    }
                },
                dbType
            };
            const state = store.getState();
            const { allLogAnalysisData } = state.inventoryV2;
            dispatch(addAllLogAnalysisData([...allLogAnalysisData, newObj]));
            handleLogAnalyzerJob(dispatch, res, getJobDetailApi, t, true, key, newObj, dbType);
        });
    };

    const runInvestigationPreReqApi = async () => {
        const commonParams = {
            credentialId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM,
            regionId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM
        };
        runInvestigationPreReqApiCall(
            dbType,
            commonParams,
            selectedResourceId,
            selectedDatabaseInstance,
            dispatch,
            getLogAnalyzerPreReqOracleApi,
            getLogAnalyzerPreReqApi
        );
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
                    activateHandler('custom');
                }}
                closeCallback={() => {
                    closeDialog();
                }}
                dialogFrom={FROM_DIALOG.CUSTOM_TIMEFRAME}
            />
        );
    };

    return (
        <div className={styles['log-analyzer-onboarding']}>
            <ScrollableCard dbType={dbType} />

            <div className={styles.sectionTwo}>
                <div className={styles.accordionCardSection}>
                    <div className={styles.topPart}>
                        <DsTypography variant="Semibold_16">
                            {t('databases.log-analyzer.investigation-in-progress')}
                        </DsTypography>
                        <div className={styles.rightPart}>
                            <div
                                className={styles.refreshIcon}
                                onClick={() => {
                                    runInvestigationPreReqApi();
                                }}
                            >
                                <RefreshIcon />
                            </div>

                            <DsButton
                                children={t('databases.log-analyzer.scan-now')}
                                variant="primary"
                                isDisabled={!isActive || preReqLoading}
                                isThin
                                dropDown={{
                                    trigger: 'click',
                                    autoPosition: true,
                                    items: [
                                        {
                                            id: 'wlm-db-last-24-hours',
                                            label: 'Last 24 hours',
                                            onClick: () => {
                                                activateHandler('manual');
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
                    <div className={styles.infoSection}>
                        <div>
                            <InfoIcon />
                        </div>
                        <DsTypography variant="Semibold_14">
                            {dbType === DBType.ORACLE
                                ? t('databases.log-analyzer.info-text-oracle')
                                : t('databases.log-analyzer.info-text')}
                        </DsTypography>
                    </div>
                    <OnboardingAccordions dbType={dbType} />
                </div>
                <div className={styles.legalNoticeSection}>
                    <div className={styles.legalNoticeHeading} />
                    <div className={styles.legalNoticeBlock}>
                        <div className={styles.legalContentSection}>
                            <div className={styles.sections}>
                                <DsTypography variant="Semibold_14">{t('databases.log-analyzer.cost')}</DsTypography>
                                <DsTypography variant="Regular_14">
                                    {t('databases.log-analyzer.cost-content')}
                                </DsTypography>
                            </div>
                        </div>
                        <div className={styles.legalContentSection}>
                            <div className={styles.sections}>
                                <DsTypography variant="Semibold_14">
                                    {t('databases.log-analyzer.legal-notice')}
                                </DsTypography>
                                <DsTypography variant="Regular_14">
                                    {t('databases.log-analyzer.legal-notice-content-1')}
                                </DsTypography>
                                <DsTypography variant="Regular_14">
                                    {dbType === DBType.ORACLE
                                        ? t('databases.log-analyzer.legal-notice-content-2-oracle')
                                        : t('databases.log-analyzer.legal-notice-content-2')}
                                </DsTypography>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LogAnalyzerOnboarding;
