import { DsTypography, Popover } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { DsButton } from '@tlveng/wlm-ds';
import { useMemo, type CSSProperties } from 'react';
import { useDispatch } from 'react-redux';
import { ColumnProps, Table } from '../../../common/Lib/Table/Table';
import { TableTopBar } from '../../../common/Lib/Table/TableTopBar';
import { useTable } from '../../../common/Lib/Table/useTable';
import styles from './RegisteredResourcesTable.module.scss';
import { useAppSelector } from '../../../store/storeHooks';
import { getAllAssessmentResources, redirectToGetWellPage } from '../WellArchitectedTabUtils';
import FirstColumnComponent from '../../Dashboard/DashboardInnerPage/RenderTables/FirstColumnComponent';
import {
    DBType,
    INVENTORY_STATUS,
    WELL_ARCHITECTED_TABS,
    WELL_ARCH_ASSESSMENT_FLOW,
    WLF_TABS
} from '../../../utils/consts';
import { formatDateWithTime } from '../../../utils/utilityFunctions';
import {
    getCanViewAndFix,
    getViewAndFixDisableMsg,
    handleOracleWadOptimizeAction,
    handleUnregisteredOracleOptimizeAction,
    handleUnregisteredOptimizeAction,
    handleWadOptimizeAction
} from '../../InventoryV2/InventoryTablesComponent/InstancesTable/InstanceTableHelper';
import { resolveWellArchAssessmentFlow } from '../../InventoryV2/InventoryUtilsV2';
import { setBreadCrumbSelectedFrom, setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { setSelectedWellArchitectTab } from '../../../store/workloadFactory/getWellOptimizeSlice';
import { setSelectedOracleInnerPageTab } from '../../../store/workloadFactory/oracleSlice';
import { selectedTabSelection } from '../../../store/workloadFactory/databaseHomeSlice';

const RegisteredResourcesTable = () => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const {
        allmssqlHostAssessmentLoading,
        allmssqlHostAssessmentData,
        allOracleHostAssessmentData,
        allOracleHostAssessmentLoading
    } = useAppSelector(state => state.inventoryV2);
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = useAppSelector(state => state.headers);
    const { inventoryTableData, getDatabaseHosts, getOracleDatabaseHosts } = useAppSelector(state => state.inventoryV2);

    const assessmentResourceData: any = useMemo(
        () => getAllAssessmentResources(allmssqlHostAssessmentData, allOracleHostAssessmentData),
        [
            inventoryTableData,
            getDatabaseHosts,
            getOracleDatabaseHosts,
            allmssqlHostAssessmentData,
            allOracleHostAssessmentData,
            headerSelectedMultiCredIdsList,
            headerSelectedMultiRegionIdsList
        ]
    );

    const loading = useMemo(
        () => allmssqlHostAssessmentLoading || allOracleHostAssessmentLoading,
        [allmssqlHostAssessmentLoading, allOracleHostAssessmentLoading]
    );

    const setWellArchHeaderFromTab = (rowData: any) => {
        dispatch(selectedTabSelection(WLF_TABS.OPTIMIZE));
        dispatch(setBreadCrumbSelectedFrom(WLF_TABS.WELL_ARCHITECTED_TAB));
        if (rowData?.type === DBType.ORACLE) {
            dispatch(setSelectedHeaderTab(WLF_TABS.ORACLE_WELL_ARCHITECTED_FROM_WELL_ARCHITECTED_TAB));
            dispatch(setSelectedOracleInnerPageTab(WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS));
        } else {
            dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE_FROM_WELL_ARCHITECTED_TAB));
            dispatch(setSelectedWellArchitectTab(WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS));
        }
    };

    const handleViewAndFixClick = (rowData: any) => {
        const flow = resolveWellArchAssessmentFlow({ rowData, inventoryTableData });

        if (flow === WELL_ARCH_ASSESSMENT_FLOW.WAD) {
            if (rowData?.type === DBType.ORACLE) {
                handleOracleWadOptimizeAction(
                    {
                        ...rowData,
                        databaseInstanceId: rowData?.instanceId,
                        databaseInstanceName: rowData?.serverInstanceName,
                        name: rowData?.hostName
                    },
                    dispatch
                );
            } else {
                handleWadOptimizeAction(
                    {
                        ...rowData,
                        databaseInstanceId: rowData?.instanceId,
                        databaseInstanceName: rowData?.serverInstanceName,
                        sqlServerInstance: rowData?.serverInstanceName
                    },
                    dispatch
                );
            }
            setWellArchHeaderFromTab(rowData);
            return;
        }

        if (flow === WELL_ARCH_ASSESSMENT_FLOW.UNREGISTERED) {
            if (rowData?.type === DBType.ORACLE) {
                handleUnregisteredOracleOptimizeAction(
                    {
                        ...rowData,
                        databaseInstanceName: rowData?.serverInstanceName,
                        oracleInstance: rowData?.serverInstanceName,
                        ec2InstanceId: rowData?.ec2InstanceId || rowData?.databaseHostId
                    },
                    dispatch
                );
            } else {
                handleUnregisteredOptimizeAction(
                    {
                        ...rowData,
                        databaseInstanceName: rowData?.serverInstanceName,
                        sqlServerInstance: rowData?.serverInstanceName,
                        ec2InstanceId: rowData?.ec2InstanceId || rowData?.databaseHostId
                    },
                    dispatch
                );
            }
            setWellArchHeaderFromTab(rowData);
            return;
        }

        redirectToGetWellPage(dispatch, rowData);
    };

    const progressWidthStyle = (width: number | string): CSSProperties =>
        ({ '--progress-width': `${width}%` } as CSSProperties);

    const handleProgressBar = (cellData: number | string) => {
        if (cellData !== 0 && (cellData as number) <= 1) {
            return (
                <div className={styles.progressBar}>
                    <div
                        className={`${styles.progress} ${styles.leftCurveBar} ${styles.rightCurveBar} ${styles.progressFull}`}
                    />
                </div>
            );
        }
        if (cellData !== 0 && (cellData as number) >= 1) {
            const score = Number(cellData) || 0;
            return (
                <div className={styles.progressBar}>
                    <div
                        className={`${styles.progress} ${styles.leftCurveBar} ${styles.progressFilled}`}
                        style={progressWidthStyle(score)}
                    />
                    <div className={styles.separator} />
                    <div
                        className={`${styles.progress} ${styles.rightCurveBar} ${styles.progressRemainder}`}
                        style={progressWidthStyle(100 - score)}
                    />
                </div>
            );
        }
        if (cellData === 0) {
            return (
                <div className={styles.progressBar}>
                    <div
                        className={`${styles.progress} ${styles.leftCurveBar} ${styles.rightCurveBar} ${styles.progressFull}`}
                    />
                </div>
            );
        }
    };

    const TableColDefs: ColumnProps[] = [
        {
            Header: t('databases.well-architected-tab.resource-name'),
            accessor: 'serverInstanceName',
            id: '1',
            isSortable: true,
            width: '320px',
            renderCell: (cellData: any, rowData: any) => (
                <FirstColumnComponent rowData={rowData} showDismissed={false} />
            )
        },
        {
            Header: t('databases.well-architected-tab.engine-type'),
            accessor: 'type',
            id: '2',
            width: '220px',
            filterOptions: 'auto'
        },
        {
            Header: t('databases.well-architected-tab.collection-time'),
            accessor: 'lastAssessmentTimestamp',
            id: '3',
            width: '250px',
            filterOptions: 'auto',
            renderFilterPanelLabel: (value: string) => formatDateWithTime(value),
            renderCell: (cellData: any, rowData: any) => (
                <div>
                    <DsTypography variant="Regular_14">{cellData ? formatDateWithTime(cellData) : ''}</DsTypography>
                    {rowData?.isWad && (
                        <DsTypography variant="Regular_13">{t('databases.inventory.one-time-assessment')}</DsTypography>
                    )}
                </div>
            )
        },
        {
            Header: t('databases.well-architected-tab.hostname'),
            accessor: 'hostName',
            id: '4',
            width: '220px',
            filterOptions: 'auto',
            isSortable: true
        },
        {
            Header: t('databases.well-architected-tab.optimization-score'),
            accessor: 'scoreForSorting',
            id: '5',
            width: '347px',
            isSortable: true,
            renderCell: (cellData: string) => (
                <div className={styles.barContainer}>
                    {handleProgressBar(cellData)}
                    <div className={styles.scoreText}>
                        <DsTypography variant="Semibold_14">{cellData}</DsTypography>
                        <DsTypography variant="Semibold_14">%</DsTypography>
                    </div>
                </div>
            )
        },
        {
            Header: '',
            accessor: '',
            id: '6',
            width: '248px',
            isSortable: false,
            renderCell: (_: any, rowData: any) => {
                const isOffline =
                    rowData?.loadingStatus ||
                    rowData?.status === INVENTORY_STATUS.STOPPED ||
                    rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_DOWN;
                const canViewAndFix = getCanViewAndFix(rowData);
                const viewAndFixDisableMsg = getViewAndFixDisableMsg(rowData, canViewAndFix, t);
                const isDisabled = isOffline || !!viewAndFixDisableMsg;

                return (
                    <div className={styles.buttonContainer}>
                        <div />
                        <Popover
                            isAppendedToBody
                            children={
                                <DsTypography variant="Regular_14">
                                    {isOffline
                                        ? t('databases.well-architect.only-online-instances')
                                        : viewAndFixDisableMsg ||
                                          t('databases.well-architected-tab.resource-view-fix-hover-msg')}
                                </DsTypography>
                            }
                            trigger="hover"
                            container={
                                <DsButton
                                    variant="secondary"
                                    isThin
                                    onClick={() => {
                                        if (!isDisabled) {
                                            handleViewAndFixClick(rowData);
                                        }
                                    }}
                                    isDisabled={isDisabled}
                                >
                                    {t('databases.general.view-and-fix')}
                                </DsButton>
                            }
                        />
                    </div>
                );
            }
        }
    ];

    const tableProps = useTable({
        // @ts-ignore
        manageColumnsProps: false,
        isHorizontalScroll: true,
        isSorting: false,
        columns: TableColDefs,
        rows: assessmentResourceData || [],
        pageSize: 50,
        selectionType: 'none',
        isLazyLoading: loading
    });
    return (
        <div className={styles['registered-resources']}>
            <TableTopBar
                // @ts-ignore
                tableProps={tableProps}
                pluralTitle={t('databases.well-architected-tab.registered-resources')}
                singularTitle={t('databases.well-architected-tab.registered-resource')}
            />
            <Table
                // @ts-ignore
                tableProps={tableProps}
                isDoubleRow
            />
        </div>
    );
};

export default RegisteredResourcesTable;
