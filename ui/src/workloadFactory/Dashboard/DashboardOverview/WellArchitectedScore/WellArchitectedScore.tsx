import { DsButton, DsFlashingDotsLoader, DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import { useDialog } from '@netapp/design-system';
import { useMemo } from 'react';
import { useDispatch } from 'react-redux';
import styles from './WellArchitectedScore.module.scss';
import WellArchitectChart from './WellArchitectChart/WellArchitectChart';
import SeparatorComponent from '../../../../common/SeparatorComponent/SeparatorComponent';
import { useAppSelector } from '../../../../store/storeHooks';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import {
    getAssessmentHostListGroupedByCategory,
    getManagedOptimizationSummary
} from '../../../DatabaseHomePage/DatabaseHomeUtils';
import { sortListOfDict } from '../../../../utils/utilityFunctions';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import CategoryDialogComponent from '../../ManagedInstanceOptimizationBreakdownByCategory/CategoryDialogComponent/CategoryDialogComponent';
import { GENERAL } from '../../../../utils/appConstants';
import { selectedTabSelection, setSelectedAssessmentRow } from '../../../../store/workloadFactory/databaseHomeSlice';
import { setBreadCrumbSelectedFrom, setSelectedHeaderTab } from '../../../../store/workloadFactory/inventoryV2Slice';
import {
    setFSXId,
    setGwPageLoadInstanceData,
    setLandingFrom,
    setSelectedWellArchitectTab
} from '../../../../store/workloadFactory/getWellOptimizeSlice';
import store from '../../../../store/store';
import {
    setSelectedHostname,
    setSelectedResourcePageHostData
} from '../../../../store/workloadFactory/workloadFactoryResourceSlice';
import { DBType, INVENTORY_STATUS, WELL_ARCHITECTED_TABS, WLF_TABS } from '../../../../utils/consts';
import { setSelectedOracleInnerPageTab } from '../../../../store/workloadFactory/oracleSlice';

const WellArchitectedScore = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { setDialog, closeDialog } = useDialog();
    const {
        allmssqlHostAssessmentLoading,
        allmssqlHostAssessmentData,
        allOracleHostAssessmentData,
        allOracleHostAssessmentLoading
    } = useAppSelector(state => state.inventoryV2);
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList, multiDataLoading, showNA } =
        useAppSelector(state => state.headers);

    const instanceOptimizationSummary = useMemo(
        () => getManagedOptimizationSummary(allmssqlHostAssessmentData, allOracleHostAssessmentData),
        [
            allmssqlHostAssessmentData,
            allOracleHostAssessmentData,
            headerSelectedMultiCredIdsList,
            headerSelectedMultiRegionIdsList
        ]
    );

    const loading = useMemo(
        () => allmssqlHostAssessmentLoading || allOracleHostAssessmentLoading || multiDataLoading,
        [allmssqlHostAssessmentLoading, allOracleHostAssessmentLoading, multiDataLoading]
    );

    const ChartComponent = useMemo(
        () => () =>
            (
                <WellArchitectChart
                    color1="#68C6B3"
                    color2="#E0E0E0"
                    data1={showNA ? 0 : instanceOptimizationSummary?.optimizedPercent}
                    data2={showNA ? 100 : 100 - instanceOptimizationSummary?.optimizedPercent}
                    centerText="Total score"
                    centerValue={
                        showNA
                            ? t('databases.general.not-available')
                            : `${instanceOptimizationSummary?.optimizedPercent || 0}%`
                    }
                    loading={loading}
                    isDisabled={showNA}
                />
            ),
        [instanceOptimizationSummary, loading, showNA]
    );

    const redirectToGetWellPage = () => {
        const updatedState = store.getState();
        const { selectedAssessmentRow }: any = updatedState.databaseHome;
        if (selectedAssessmentRow?.type === DBType.ORACLE) {
            dispatch(setSelectedHeaderTab(WLF_TABS.ORACLE_WELL_ARCHITECTED));
            dispatch(setSelectedOracleInnerPageTab(WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS));
        } else {
            dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE));
            dispatch(setSelectedWellArchitectTab(WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS));
        }

        dispatch(selectedTabSelection(WLF_TABS.OPTIMIZE));
        dispatch(setBreadCrumbSelectedFrom(WLF_TABS.DASHBOARD));

        dispatch(setLandingFrom(WLF_TABS.INVENTORY));
        dispatch(
            setGwPageLoadInstanceData({
                hostname: selectedAssessmentRow?.hostName,
                resourceId: selectedAssessmentRow?.databaseHostId,
                instanceId: selectedAssessmentRow?.instanceId,
                instanceName: selectedAssessmentRow?.databaseInstanceName,
                credId: selectedAssessmentRow?.credentialId,
                regionId: selectedAssessmentRow?.regionId,
                storageType: selectedAssessmentRow?.sqlServerDeploymentType
            })
        );

        dispatch(setSelectedHostname(selectedAssessmentRow?.hostName));

        dispatch(
            setSelectedResourcePageHostData({
                resourceId: selectedAssessmentRow?.databaseHostId,
                databaseInstanceId: selectedAssessmentRow?.instanceId,
                databaseInstanceName: selectedAssessmentRow?.databaseInstanceName,
                credentialId: selectedAssessmentRow?.credentialId,
                regionId: selectedAssessmentRow?.regionId
            })
        );
        dispatch(
            setFSXId({
                fsxId: selectedAssessmentRow?.fsxId,
                ec2InstanceId: selectedAssessmentRow?.ec2InstanceId
            })
        );

        setTimeout(() => {
            dispatch(setSelectedAssessmentRow(null));
        }, 5);
    };

    const handleClick = () => {
        const tableData = sortListOfDict(
            getAssessmentHostListGroupedByCategory(allmssqlHostAssessmentData, allOracleHostAssessmentData) || [],
            'status',
            false
        );
        const isOnlineInstance = tableData.some((item: any) => item?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP);
        setDialog(
            <DialogComponent
                header={t('databases.dashboard.instance-well-arch-score')}
                content={<CategoryDialogComponent tableData={tableData} />}
                primaryButton={GENERAL.CONTINUE}
                secondaryButton={GENERAL.CANCEL}
                callback={() => {
                    redirectToGetWellPage();
                }}
                closeCallback={() => {
                    closeDialog();
                    dispatch(setSelectedAssessmentRow(null));
                }}
                customClass={styles.dialog}
                primaryButtonDisabled={!tableData || tableData.length === 0 || !isOnlineInstance}
                testId="wlm-db-not optimize-instance-continue-button"
            />
        );
    };
    return (
        <div className={styles.wellArchitectedScore}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    {t('databases.dashboard.well-architected-score')}
                </DsTypography>

                <div className={styles.rightSection}>
                    {loading && <DsFlashingDotsLoader />}
                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isDisabled={loading || showNA}
                            data-testid="wlm-db-optimize-instances-by-category"
                            isThin
                            onClick={() => handleClick()}
                        >
                            {t('databases.dashboard.investigate')}
                        </DsButton>
                    </div>
                </div>
            </div>

            <div className={styles.mainSection}>
                <div className={styles.chartContainer}>
                    <ChartComponent />
                </div>

                <div className={styles.textSection}>
                    <SeparatorComponent variant="horizontal" />
                    <div className={styles.row}>
                        <DsTypography variant="Regular_14" className={showNA ? CommonStyles.notAvailable : ''}>
                            {t('databases.dashboard.well-architected-configurations')}
                        </DsTypography>

                        <div className={styles.rightSection}>
                            {loading && <DsFlashingDotsLoader />}
                            <DsTypography variant="Semibold_16" className={showNA ? CommonStyles.notAvailable : ''}>
                                {showNA
                                    ? t('databases.general.not-available')
                                    : instanceOptimizationSummary?.optimizedInstances}
                            </DsTypography>
                        </div>
                    </div>

                    <SeparatorComponent variant="horizontal" />
                    <div className={styles.row}>
                        <DsTypography variant="Regular_14" className={showNA ? CommonStyles.notAvailable : ''}>
                            {t('databases.dashboard.non-optimal-config-critical')}
                        </DsTypography>
                        <div className={styles.rightSection}>
                            {loading && <DsFlashingDotsLoader />}
                            <DsTypography variant="Semibold_16" className={showNA ? CommonStyles.notAvailable : ''}>
                                {showNA
                                    ? t('databases.general.not-available')
                                    : String(instanceOptimizationSummary?.criticalNotOptimizedInstances)}
                            </DsTypography>
                        </div>
                    </div>

                    <SeparatorComponent variant="horizontal" />
                    <div className={styles.row}>
                        <DsTypography variant="Regular_14" className={showNA ? CommonStyles.notAvailable : ''}>
                            {t('databases.dashboard.non-optimal-config-warning')}
                        </DsTypography>
                        <div className={styles.rightSection}>
                            {loading && <DsFlashingDotsLoader />}
                            <DsTypography variant="Semibold_16" className={showNA ? CommonStyles.notAvailable : ''}>
                                {showNA
                                    ? t('databases.general.not-available')
                                    : String(instanceOptimizationSummary?.warningNotOptimizedInstances)}
                            </DsTypography>
                        </div>
                    </div>

                    <SeparatorComponent variant="horizontal" />
                    <div className={styles.row}>
                        <DsTypography variant="Semibold_14" className={showNA ? CommonStyles.notAvailable : ''}>
                            {t('databases.dashboard.total')}
                        </DsTypography>
                        <div className={styles.rightSection}>
                            {loading && <DsFlashingDotsLoader />}
                            <DsTypography variant="Semibold_16" className={showNA ? CommonStyles.notAvailable : ''}>
                                {showNA
                                    ? t('databases.general.not-available')
                                    : instanceOptimizationSummary?.totalInstances}
                            </DsTypography>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WellArchitectedScore;
