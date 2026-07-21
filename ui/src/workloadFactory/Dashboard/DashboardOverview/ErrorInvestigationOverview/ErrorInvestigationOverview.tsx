import { DsButton, DsFlashingDotsLoader, DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import { Popover, TooltipInfo, useDialog } from '@netapp/design-system';
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
import {
    ACTION_TYPE,
    DBType,
    ERROR_ANALYZER_STATUS,
    INVENTORY_STATUS,
    SEVERITIES,
    WELL_ARCHITECTED_TABS,
    WLF_TABS
} from '../../../../utils/consts';
import ViewErrorInvestigation from './ActivateErrorInvestigation/CategoryDialogComponent/ViewErrorInvestigation';
import { useAppSelector } from '../../../../store/storeHooks';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import {
    createLogAnalyzerActiveInstance,
    createLogAnalyzerNotActiveInstance,
    getErrorInvestigationSummary
} from '../../../DatabaseHomePage/DatabaseHomeUtils';
import store from '../../../../store/store';
import {
    setBreadCrumbSelectedFrom,
    setSelectedHeaderTab,
    setWizardOperationType
} from '../../../../store/workloadFactory/inventoryV2Slice';
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
import { setSelectedOracleInnerPageTab } from '../../../../store/workloadFactory/oracleSlice';

const ErrorInvestigationOverview = () => {
    const { t } = useTranslation();
    const { setDialog, closeDialog } = useDialog();
    const dispatch = useDispatch();
    const { showNA, multiDataLoading } = useAppSelector(state => state.headers);
    const { isGovAccount, aiAnalysisEnabled } = useAppSelector(state => state.auth);
    const { allLogAnalysisLoading, allLogAnalysisOracleLoading, allLogAnalysisData, inventoryTableData } =
        useAppSelector(state => state.inventoryV2);
    const loading = useMemo(
        () => allLogAnalysisLoading || allLogAnalysisOracleLoading || multiDataLoading,
        [allLogAnalysisLoading, allLogAnalysisOracleLoading, multiDataLoading]
    );

    const errInvestigationOverview: any = useMemo(
        () => getErrorInvestigationSummary(allLogAnalysisData),
        [allLogAnalysisData, inventoryTableData]
    );

    // Wait until log analysis data finishes loading before treating emptyState as real.
    // While loading, allLogAnalysisData is empty so emptyState is misleadingly true.
    const isAnalyzeDisabledByAdmin = !loading && errInvestigationOverview?.emptyState && !aiAnalysisEnabled;

    const activeTableRows: any = useMemo(() => {
        const data = createLogAnalyzerActiveInstance(allLogAnalysisData) || [];

        if (data.length > 0) {
            const preferred = new Set([INVENTORY_STATUS.CASE_SENSITIVE_UP, INVENTORY_STATUS.RUNNING]);

            return [...data].sort((a: any, b: any) => {
                const aPref = preferred.has(a?.status);
                const bPref = preferred.has(b?.status);
                if (aPref === bPref) return 0;
                return aPref ? -1 : 1;
            });
        }

        return data;
    }, [allLogAnalysisData, inventoryTableData]);

    const notActiveTableRows: any = useMemo(() => {
        const data = createLogAnalyzerNotActiveInstance(allLogAnalysisData) || [];

        if (data.length > 0) {
            const preferred = new Set([INVENTORY_STATUS.CASE_SENSITIVE_UP, INVENTORY_STATUS.RUNNING]);
            return [...data].sort((a: any, b: any) => {
                const aPref = preferred.has(a?.status);
                const bPref = preferred.has(b?.status);
                if (aPref === bPref) return 0;
                return aPref ? -1 : 1;
            });
        }

        return data;
    }, [allLogAnalysisData, inventoryTableData]);

    const redirectToLogAnalyzerPage = (type: string) => {
        dispatch(setWizardOperationType(ACTION_TYPE.SINGLE));
        const updatedState = store.getState();
        const { selectedErrorInvestigationRow, selectedViewInvestigationRow }: any = updatedState.agenticAI;
        let selectedRowData = null;
        const { isWorkloadFactory } = updatedState.auth;
        if (isWorkloadFactory) {
            dashboardRedirection();
        } else if (
            selectedErrorInvestigationRow?.type === DBType.MSSQL ||
            selectedViewInvestigationRow?.type === DBType.MSSQL
        ) {
            dashboardRedirection('inventory/optimize/mssql');
        } else {
            dashboardRedirection('inventory/optimize/oracle');
        }

        if (type === 'activate') {
            selectedRowData = selectedErrorInvestigationRow;
        } else {
            selectedRowData = selectedViewInvestigationRow;
        }
        if (selectedRowData?.type === DBType.ORACLE) {
            dispatch(setSelectedHeaderTab(WLF_TABS.ORACLE_WELL_ARCHITECTED));
            dispatch(setSelectedOracleInnerPageTab(WELL_ARCHITECTED_TABS.ERROR_INVESTIGATION));
        } else {
            dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE));
            dispatch(setSelectedWellArchitectTab(WELL_ARCHITECTED_TABS.ERROR_INVESTIGATION));
        }

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
            tableData = notActiveTableRows;
        } else {
            tableData = activeTableRows;
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

    const ChartComponent = useMemo(
        () => () =>
            (
                <DatabaseOverviewChart
                    color1="#FE5502"
                    color2="#F7941D"
                    color3="#FDC300"
                    data1={errInvestigationOverview?.severity1}
                    data2={errInvestigationOverview?.severity2}
                    data3={errInvestigationOverview?.severity3}
                    centerText="Errors"
                    centerValue={
                        errInvestigationOverview?.totalEvents ? String(errInvestigationOverview?.totalEvents) : 0
                    }
                    loading={false}
                    isDisabled={loading || showNA}
                />
            ),
        [errInvestigationOverview, loading, showNA]
    );

    return (
        <div className={styles.errorInvestigationOverview}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    {t('databases.dashboard.error-analysis')}
                </DsTypography>

                <div className={styles.rightSection}>
                    {loading && <DsFlashingDotsLoader />}
                    {!loading && !errInvestigationOverview?.emptyState && (
                        <div className={styles.tooltip}>
                            <TooltipInfo>
                                <div className={styles.tooltipContainer}>
                                    <DsTypography variant="Semibold_13">
                                        {t('databases.dashboard.microsoft-sql-server-mapping')}
                                    </DsTypography>
                                    <div className={styles.tableRow}>
                                        <div className={styles.row}>
                                            <DsTypography variant="Semibold_13" className={styles.itemOne}>
                                                {t('databases.dashboard.status')}
                                            </DsTypography>
                                            <DsTypography variant="Semibold_13" className={styles.itemTwo}>
                                                {t('databases.dashboard.severity-level')}
                                            </DsTypography>
                                        </div>

                                        <div className={styles.row}>
                                            <DsTypography variant="Regular_13" className={styles.itemWithoutBorderTop1}>
                                                {t('databases.dashboard.critical')}
                                            </DsTypography>
                                            <DsTypography variant="Regular_13" className={styles.itemWithoutBorderTop2}>
                                                {SEVERITIES.TWENTY_TWENTY_FOUR}
                                            </DsTypography>
                                        </div>

                                        <div className={styles.row}>
                                            <DsTypography variant="Regular_13" className={styles.itemWithoutBorderTop1}>
                                                {t('databases.dashboard.severe')}
                                            </DsTypography>
                                            <DsTypography variant="Regular_13" className={styles.itemWithoutBorderTop2}>
                                                {SEVERITIES.SEVENTEEN_NINETEEN}
                                            </DsTypography>
                                        </div>

                                        <div className={styles.row}>
                                            <DsTypography variant="Regular_13" className={styles.itemWithoutBorderTop1}>
                                                {t('databases.dashboard.important')}
                                            </DsTypography>
                                            <DsTypography variant="Regular_13" className={styles.itemWithoutBorderTop2}>
                                                {SEVERITIES.SIXTEEN}
                                            </DsTypography>
                                        </div>
                                    </div>
                                </div>
                            </TooltipInfo>
                            <DsTypography variant="Regular_14" className={loading || showNA ? styles.disabled : ''}>
                                {t('databases.dashboard.mssql-severity')}
                            </DsTypography>
                        </div>
                    )}
                    <div className={styles.buttonContainer}>
                        {isAnalyzeDisabledByAdmin ? (
                            <Popover
                                trigger="hover"
                                container={
                                    <span>
                                        <DsButton
                                            children="Analyze"
                                            variant="secondary"
                                            isThin
                                            isDisabled
                                            dropDown={{
                                                trigger: 'click',
                                                autoPosition: true,
                                                items: [
                                                    {
                                                        id: 'wlm-db-activate-error-investigation',
                                                        label: t('databases.dashboard.activate-error-investigation'),
                                                        onClick: () => {
                                                            handleClick('activate');
                                                        },
                                                        isDisabled:
                                                            notActiveTableRows?.length === 0 ||
                                                            (!loading && !aiAnalysisEnabled),
                                                        disabledReason:
                                                            !loading && !aiAnalysisEnabled
                                                                ? t('databases.log-analyzer.ai-analysis-disabled')
                                                                : ''
                                                    },
                                                    {
                                                        id: 'wlm-db-view-error-investigation',
                                                        label: t('databases.dashboard.view-error-investigation'),
                                                        onClick: () => {
                                                            handleClick('view');
                                                        },
                                                        isDisabled: activeTableRows?.length === 0
                                                    }
                                                ]
                                            }}
                                        />
                                    </span>
                                }
                            >
                                {t('databases.log-analyzer.ai-analysis-disabled')}
                            </Popover>
                        ) : (
                            <DsButton
                                children="Analyze"
                                variant="secondary"
                                isThin
                                isDisabled={loading || showNA || isGovAccount}
                                dropDown={{
                                    trigger: 'click',
                                    autoPosition: true,
                                    items: [
                                        {
                                            id: 'wlm-db-activate-error-investigation',
                                            label: t('databases.dashboard.activate-error-investigation'),
                                            onClick: () => {
                                                handleClick('activate');
                                            },
                                            isDisabled:
                                                notActiveTableRows?.length === 0 || (!loading && !aiAnalysisEnabled),
                                            disabledReason:
                                                !loading && !aiAnalysisEnabled
                                                    ? t('databases.log-analyzer.ai-analysis-disabled')
                                                    : ''
                                        },
                                        {
                                            id: 'wlm-db-view-error-investigation',
                                            label: t('databases.dashboard.view-error-investigation'),
                                            onClick: () => {
                                                handleClick('view');
                                            },
                                            isDisabled: activeTableRows?.length === 0
                                        }
                                    ]
                                }}
                            />
                        )}
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
                            <ChartComponent />
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
                                        {t('databases.dashboard.important')}
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
                                : `${errInvestigationOverview?.activeResource} out of ${
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
