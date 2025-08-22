import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { ReactComponent as RefreshIcon } from '@netapp/icons/ic_refresh.svg';
import { useEffect, useState } from 'react';
import { DsButton, DsFlashingDotsLoader, DsTypography } from '@tlveng/wlm-ds';
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
    useLazyGetSubTaskListQuery,
    useScanErrorInvestigationMutation
} from '../../../../../utils/apiService';
import { ERROR_ANALYZER_STATUS, WLF_TABS } from '../../../../../utils/consts';
import { handleLogAnalyzerJob, logAnalyzerScanUpdate } from '../ErrorInvestigationUtility';
import store from '../../../../../store/store';
import { addAllLogAnalysisData } from '../../../../../store/workloadFactory/inventoryV2Slice';
import { uniqueHostRow } from '../../../../InventoryV2/InventoryUtilsV2';

const LogAnalyzerOnboarding = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();

    const [isActive, setIsActive] = useState(false);

    const { credIdFromJM, regionFromJM, landingFrom } = useAppSelector(state => state.getWellOptimize);

    const { selectedResourceId, selectedDatabaseInstance, selectedGwInstanceCredId, selectedGwInstanceRegionId } =
        useAppSelector(state => state.getWellOptimize);

    const { data, loading } = useAppSelector(state => state.agenticAI.logAnalyzerPricing);
    const { data: preReqData, loading: preReqLoading } = useAppSelector(state => state.agenticAI.logAnalyzerPreReq);

    useEffect(() => {
        if (preReqData) {
            setIsActive(
                preReqData?.bedrockPreRequisites?.ready &&
                    preReqData?.networkingPreRequisites?.ready &&
                    preReqData?.credentialsPreRequisites?.ready &&
                    preReqData?.instanceProfilePreRequisites?.ready
            );
        }
    }, [preReqData]);

    LogAnalyzerOnboardingAPI();

    const [getLogAnalyzerPreReqApi] = useGetLogAnalyzerPreReqMutation();
    const [scanErrorInvestigation] = useScanErrorInvestigationMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();

    const activateHandler = () => {
        dispatch(setLogAnalyzerState(ERROR_ANALYZER_STATUS.RUNNING));
        const credId = landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM;
        const regionId = landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM;
        const key = uniqueHostRow(`${selectedResourceId}_${selectedDatabaseInstance}`, credId, regionId);
        logAnalyzerScanUpdate(key, true, dispatch);
        scanErrorInvestigation({
            credentialId: credId,
            regionId,
            databaseHostId: selectedResourceId,
            instanceId: selectedDatabaseInstance,
            payload: {}
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
                    errorCount: 0
                }
            };
            const state = store.getState();
            const { allLogAnalysisData } = state.inventoryV2;
            dispatch(addAllLogAnalysisData([...allLogAnalysisData, newObj]));
            handleLogAnalyzerJob(dispatch, res, getJobDetailApi, t, true, key, newObj);
        });
    };

    const runInvestigationPreReqApi = async () => {
        try {
            dispatch(setLogAnalyzerPreReqLoading(true));
            const result: { data?: any; error?: any } = await getLogAnalyzerPreReqApi({
                credentialId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM,
                regionId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM,
                type: 'databaseHostId',
                typeId: selectedResourceId
            });
            if (result && !result?.error && result?.data?.items?.length > 0 && !result?.data?.items[0]?.errorMessage) {
                dispatch(setLogAnalyzerPreReqData(result?.data?.items[0]));
            } else {
                dispatch(setLogAnalyzerPreReqData(null));
            }
        } catch (error) {
            dispatch(setLogAnalyzerPreReqData(null));
        } finally {
            dispatch(setLogAnalyzerPreReqLoading(false));
        }
    };

    return (
        <div className={styles['log-analyzer-onboarding']}>
            <ScrollableCard />

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
                                onClick={activateHandler}
                                isThin
                                variant="primary"
                                isDisabled={!isActive || preReqLoading}
                            >
                                {t('databases.log-analyzer.activate')}
                            </DsButton>
                        </div>
                    </div>
                    <div className={styles.infoSection}>
                        <div>
                            <InfoIcon />
                        </div>
                        <DsTypography variant="Semibold_14">{t('databases.log-analyzer.info-text')}</DsTypography>
                    </div>
                    <OnboardingAccordions />
                </div>
                <div className={styles.legalNoticeSection}>
                    <div className={styles.legalNoticeHeading} />
                    <div className={styles.legalNotice}>
                        <div style={{ height: '24px' }} />
                        <div className={styles.legalContentSection}>
                            <div className={styles.sections}>
                                <DsTypography variant="Semibold_14">{t('databases.log-analyzer.cost')}</DsTypography>
                                <DsTypography variant="Regular_14">
                                    {t('databases.log-analyzer.cost-content')}
                                </DsTypography>
                            </div>

                            <div className={styles.sections}>
                                <DsTypography variant="Semibold_14">
                                    {t('databases.log-analyzer.legal-notice')}
                                </DsTypography>
                                <DsTypography variant="Regular_14">
                                    {t('databases.log-analyzer.legal-notice-content-1')}
                                </DsTypography>
                                <DsTypography variant="Regular_14">
                                    {t('databases.log-analyzer.legal-notice-content-2')}
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
