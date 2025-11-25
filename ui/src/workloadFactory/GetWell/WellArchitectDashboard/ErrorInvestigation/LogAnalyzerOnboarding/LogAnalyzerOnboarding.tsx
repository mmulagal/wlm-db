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
    useGetLogAnalyzerPreReqOracleMutation,
    useLazyGetSubTaskListQuery,
    useScanErrorInvestigationMutation
} from '../../../../../utils/apiService';
import { DBType, ERROR_ANALYZER_STATUS, WLF_TABS } from '../../../../../utils/consts';
import {
    handleLogAnalyzerJob,
    logAnalyzerScanUpdate,
    runInvestigationPreReqApiCall
} from '../ErrorInvestigationUtility';
import store from '../../../../../store/store';
import { addAllLogAnalysisData } from '../../../../../store/workloadFactory/inventoryV2Slice';
import { uniqueHostRow } from '../../../../InventoryV2/InventoryUtilsV2';

const LogAnalyzerOnboarding = ({ dbType }: { dbType: string }) => {
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
            dbType,
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
                                onClick={activateHandler}
                                isThin
                                variant="primary"
                                isDisabled={!isActive || preReqLoading}
                                data-testid="wlm-db-mssql-log-analyzer-activate-button"
                            >
                                {t('databases.log-analyzer.activate')}
                            </DsButton>
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
