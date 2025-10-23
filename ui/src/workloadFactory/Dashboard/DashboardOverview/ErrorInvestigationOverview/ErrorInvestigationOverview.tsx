import { DsButton, DsFlashingDotsLoader, DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import { useDialog } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { useMemo } from 'react';
import styles from './ErrorInvestigationOverview.module.scss';
import DatabaseOverviewChart from '../DatabaseOverviewChart/DatabaseOverviewChart';
import Square from '../../../../common/Square/Square';
import ActivateErrorInvestigation from './ActivateErrorInvestigation/CategoryDialogComponent/ActivateErrorInvestigation';
import { GENERAL } from '../../../../utils/appConstants';
import {
    resetEiData,
    setLogAnalyzerState,
    setSelectedErrorInvestigationRow,
    setSelectedViewErrorInvestigationRow
} from '../../../../store/workloadFactory/agenticAISlice';
import { ReactComponent as ErrorInvestigateSmall } from '../../../../assets/ErrorInvestigationSmallImage.svg';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import { ERROR_ANALYZER_STATUS, INVENTORY_STATUS, WELL_ARCHITECTED_TABS, WLF_TABS } from '../../../../utils/consts';
import ViewErrorInvestigation from './ActivateErrorInvestigation/CategoryDialogComponent/ViewErrorInvestigation';
import { useAppSelector } from '../../../../store/storeHooks';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import {
    createLogAnalyzerActiveInstance,
    createLogAnalyzerNotActiveInstance,
    getErrorInvestigationSummary
} from '../../../DatabaseHomePage/DatabaseHomeUtils';
import store from '../../../../store/store';
import { setBreadCrumbSelectedFrom, setSelectedHeaderTab } from '../../../../store/workloadFactory/inventoryV2Slice';
import {
    setFSXId,
    setGwPageLoadInstanceData,
    setLandingFrom,
    setSelectedWellArchitectTab
} from '../../../../store/workloadFactory/getWellOptimizeSlice';
import { selectedTabSelection } from '../../../../store/workloadFactory/databaseHomeSlice';
import {
    setSelectedHostname,
    setSelectedResourcePageHostData
} from '../../../../store/workloadFactory/workloadFactoryResourceSlice';
import { dashboardRedirection } from '../../../../utils/utilityFunctions';

const ErrorInvestigationOverview = () => {
    const { t } = useTranslation();
    const { setDialog, closeDialog } = useDialog();
    const dispatch = useDispatch();
    const { showNA, multiDataLoading } = useAppSelector(state => state.headers);
    const { allLogAnalysisLoading, allLogAnalysisData, inventoryTableData } = useAppSelector(
        state => state.inventoryV2
    );
    const loading = useMemo(() => allLogAnalysisLoading || multiDataLoading, [allLogAnalysisLoading, multiDataLoading]);

    const errInvestigationOverview: any = useMemo(
        () => getErrorInvestigationSummary(allLogAnalysisData),
        [allLogAnalysisData, inventoryTableData]
    );

    const redirectToLogAnalyzerPage = (type: string) => {
        const updatedState = store.getState();
        const { selectedErrorInvestigationRow, selectedViewInvestigationRow }: any = updatedState.agenticAI;
        let selectedRowData = null;
        dashboardRedirection();
        if (type === 'activate') {
            selectedRowData = selectedErrorInvestigationRow;
        } else {
            selectedRowData = selectedViewInvestigationRow;
        }
        dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE));
        dispatch(setSelectedWellArchitectTab(WELL_ARCHITECTED_TABS.ERROR_INVESTIGATION));

        dispatch(selectedTabSelection(WLF_TABS.OPTIMIZE));
        dispatch(setBreadCrumbSelectedFrom(WLF_TABS.DASHBOARD));

        dispatch(setLandingFrom(WLF_TABS.INVENTORY));
        dispatch(
            setGwPageLoadInstanceData({
                hostname: selectedRowData?.databaseHostName,
                resourceId: selectedRowData?.databaseHostId,
                instanceId: selectedRowData?.databaseInstanceId,
                instanceName: selectedRowData?.databaseInstanceName,
                credId: selectedRowData?.credentialId,
                regionId: selectedRowData?.regionId,
                storageType: selectedRowData?.sqlServerDeploymentType
            })
        );

        dispatch(setSelectedHostname(selectedRowData?.databaseHostName));

        dispatch(
            setSelectedResourcePageHostData({
                resourceId: selectedRowData?.databaseHostId,
                databaseInstanceId: selectedRowData?.databaseInstanceId,
                databaseInstanceName: selectedRowData?.databaseInstanceName,
                credentialId: selectedRowData?.credentialId,
                regionId: selectedRowData?.regionId
            })
        );
        dispatch(
            setFSXId({
                fsxId: selectedRowData?.fsxId,
                ec2InstanceId: selectedRowData?.ec2InstanceId
            })
        );

        dispatch(resetEiData({}));
        dispatch(setLogAnalyzerState(selectedRowData?.logAnalyzer?.status || ERROR_ANALYZER_STATUS.NOT_ACTIVE));

        setTimeout(() => {
            dispatch(setSelectedErrorInvestigationRow(null));
            dispatch(setSelectedViewErrorInvestigationRow(null));
        }, 5);
    };

    const handleClick = (type: string) => {
        let tableData: any = [];
        if (type === 'activate') {
            tableData = createLogAnalyzerNotActiveInstance(allLogAnalysisData);
        } else {
            tableData = createLogAnalyzerActiveInstance(allLogAnalysisData);
        }
        const isOnlineInstance = tableData.some((item: any) => item?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP);
        setDialog(
            <DialogComponent
                header={
                    type === 'activate'
                        ? t('databases.dashboard.activate-error-investigation')
                        : t('databases.dashboard.view-error-investigation')
                }
                content={
                    type === 'activate' ? (
                        <ActivateErrorInvestigation tableData={tableData} />
                    ) : (
                        <ViewErrorInvestigation tableData={tableData} />
                    )
                }
                primaryButton={GENERAL.CONTINUE}
                secondaryButton={GENERAL.CANCEL}
                callback={() => {
                    redirectToLogAnalyzerPage(type);
                }}
                closeCallback={() => {
                    closeDialog();
                    if (type === 'activate') {
                        dispatch(setSelectedErrorInvestigationRow(null));
                    } else {
                        dispatch(setSelectedViewErrorInvestigationRow(null));
                    }
                }}
                customClass={styles.dialog}
                primaryButtonDisabled={!tableData || tableData.length === 0 || !isOnlineInstance}
                testId="wlm-db-activate-error-investigation-dialog"
            />
        );
    };

    return (
        <div className={styles.errorInvestigationOverview}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    {t('databases.dashboard.error-analysis')}
                </DsTypography>

                <div className={styles.rightSection}>
                    {loading && <DsFlashingDotsLoader />}
                    <div className={styles.buttonContainer}>
                        <DsButton
                            children="Analyze"
                            variant="secondary"
                            isThin
                            isDisabled={loading || showNA}
                            dropDown={{
                                trigger: 'click',
                                autoPosition: true,
                                items: [
                                    {
                                        id: 'wlm-db-activate-error-investigation',
                                        label: t('databases.dashboard.activate-error-investigation'),
                                        onClick: () => {
                                            handleClick('activate');
                                        }
                                    },
                                    {
                                        id: 'wlm-db-view-error-investigation',
                                        label: t('databases.dashboard.view-error-investigation'),
                                        onClick: () => {
                                            handleClick('view');
                                        }
                                    }
                                ]
                            }}
                        />
                    </div>
                </div>
            </div>

            {errInvestigationOverview?.emptyState && (
                <div className={styles.emptyState}>
                    <div>
                        <ErrorInvestigateSmall />
                    </div>

                    <div className={styles.rightSection}>
                        <DsTypography variant="Semibold_16">{t('databases.dashboard.log-analyzer')}</DsTypography>
                        <DsTypography variant="Regular_14">{t('databases.dashboard.error-analysis-text')}</DsTypography>
                    </div>
                </div>
            )}

            {!errInvestigationOverview?.emptyState && (
                <div className={styles.mainSection}>
                    <div className={styles.sectionOne}>
                        <div className={styles.chartContainer}>
                            <DatabaseOverviewChart
                                color1="#FE5502"
                                color2="#F7941D"
                                color3="#FDC300"
                                data1={errInvestigationOverview?.severity1}
                                data2={errInvestigationOverview?.severity2}
                                data3={errInvestigationOverview?.severity3}
                                centerText="Errors"
                                centerValue={String(errInvestigationOverview?.totalEvents)}
                                loading={false}
                                isDisabled={loading || showNA}
                            />
                        </div>

                        <div className={styles.fullBlock}>
                            <div className={styles.block}>
                                <div className={styles.rightSection}>
                                    <DsTypography
                                        style={{ lineHeight: 'unset' }}
                                        variant="Regular_24"
                                        className={showNA ? CommonStyles.notAvailable : ''}
                                    >
                                        {showNA
                                            ? t('databases.general.not-available')
                                            : errInvestigationOverview?.severity1}
                                    </DsTypography>
                                    {loading && <DsFlashingDotsLoader />}
                                </div>

                                <div className={styles.bottomRow}>
                                    <Square width="8px" height="8px" background="var(--chart-8)" />
                                    <DsTypography
                                        className={showNA ? CommonStyles.notAvailable : ''}
                                        variant="Regular_14"
                                    >
                                        {t('databases.dashboard.critical')}
                                    </DsTypography>
                                </div>
                            </div>

                            <div className={styles.block} style={{ paddingLeft: '24px' }}>
                                <div className={styles.rightSection}>
                                    <DsTypography
                                        style={{ lineHeight: 'unset' }}
                                        variant="Regular_24"
                                        className={showNA ? CommonStyles.notAvailable : ''}
                                    >
                                        {showNA
                                            ? t('databases.general.not-available')
                                            : errInvestigationOverview?.severity2}
                                    </DsTypography>
                                    {loading && <DsFlashingDotsLoader />}
                                </div>
                                <div className={styles.bottomRow}>
                                    <Square width="8px" height="8px" background="var(--chart-7)" />
                                    <DsTypography
                                        className={showNA ? CommonStyles.notAvailable : ''}
                                        variant="Regular_14"
                                    >
                                        {t('databases.dashboard.severe')}
                                    </DsTypography>
                                </div>
                            </div>

                            <div className={styles.block} style={{ borderRight: 'none', paddingLeft: '24px' }}>
                                <div className={styles.rightSection}>
                                    <DsTypography
                                        style={{ lineHeight: 'unset' }}
                                        variant="Regular_24"
                                        className={showNA ? CommonStyles.notAvailable : ''}
                                    >
                                        {showNA
                                            ? t('databases.general.not-available')
                                            : errInvestigationOverview?.severity3}
                                    </DsTypography>
                                    {loading && <DsFlashingDotsLoader />}
                                </div>
                                <div className={styles.bottomRow}>
                                    <Square width="8px" height="8px" background="var(--chart-6)" />
                                    <DsTypography
                                        className={showNA ? CommonStyles.notAvailable : ''}
                                        variant="Regular_14"
                                    >
                                        {t('databases.dashboard.warning')}
                                    </DsTypography>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className={styles.sectionTwo}>
                        <DsTypography variant="Semibold_14">{t('databases.dashboard.activation')}:</DsTypography>
                        <DsTypography className={showNA ? CommonStyles.notAvailable : ''} variant="Regular_14">
                            {showNA
                                ? t('databases.general.not-available')
                                : `${errInvestigationOverview?.activeResource} of ${
                                      errInvestigationOverview?.totalResource
                                  } ${t('databases.dashboard.resource-active-msg')}`}
                        </DsTypography>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ErrorInvestigationOverview;
