import { DsTypography, Popover } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { DsButton } from '@tlveng/wlm-ds';
import { useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { ColumnProps, Table } from '../../../common/Lib/Table/Table';
import { TableTopBar } from '../../../common/Lib/Table/TableTopBar';
import { useTable } from '../../../common/Lib/Table/useTable';
import styles from './RegisteredResourcesTable.module.scss';
import { useAppSelector } from '../../../store/storeHooks';
import { getAllAssessmentResources, redirectToGetWellPage } from '../WellArchitectedTabUtils';
import FirstColumnComponent from '../../Dashboard/DashboardInnerPage/RenderTables/FirstColumnComponent';
import { INVENTORY_STATUS } from '../../../utils/consts';
import { formatDateWithTime } from '../../../utils/utilityFunctions';

const RegisteredResourcesTable = () => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const {
        allmssqlHostAssessmentLoading,
        allmssqlHostAssessmentData,
        allOracleHostAssessmentData,
        allOracleHostAssessmentLoading
    } = useAppSelector(state => state.inventoryV2);
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList, showNA } = useAppSelector(
        state => state.headers
    );
    const { inventoryTableData, getDatabaseHosts } = useAppSelector(state => state.inventoryV2);

    const assessmentResourceData: any = useMemo(
        () => getAllAssessmentResources(allmssqlHostAssessmentData, allOracleHostAssessmentData),
        [
            inventoryTableData,
            getDatabaseHosts,
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

    const handleProgressBar = (cellData: number | string) => {
        if (
            cellData !== 0 &&
            // @ts-ignore
            cellData <= 1
        ) {
            return (
                <div className={styles.progressBar}>
                    <div
                        className={`${styles.progress} ${styles.leftCurveBar} ${styles.rightCurveBar}`}
                        style={{
                            width: `${100}%`,
                            backgroundColor: 'var(--chart-disabled)'
                        }}
                    />
                </div>
            );
        }
        if (
            cellData !== 0 &&
            // @ts-ignore
            cellData >= 1
        ) {
            return (
                <div className={styles.progressBar}>
                    <div
                        className={`${styles.progress} ${styles.leftCurveBar}`}
                        style={{
                            width: `${cellData}%`,
                            backgroundColor: 'var(--chart-4)'
                        }}
                    />
                    <div className={styles.separator} />
                    <div
                        className={`${styles.progress} ${styles.rightCurveBar}`}
                        style={{
                            width: `${100 - (Number(cellData) || 0)}%`,
                            backgroundColor: 'var(--chart-disabled)'
                        }}
                    />
                </div>
            );
        }

        if (cellData === 0) {
            return (
                <div className={styles.progressBar}>
                    <div
                        className={`${styles.progress} ${styles.leftCurveBar} ${styles.rightCurveBar}`}
                        style={{
                            width: `${100}%`,
                            backgroundColor: 'var(--chart-disabled)'
                        }}
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
                let isOffline = false;
                if (
                    rowData?.loadingStatus ||
                    rowData?.status === INVENTORY_STATUS.STOPPED ||
                    rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_DOWN
                ) {
                    isOffline = true;
                }

                return (
                    <div className={styles.buttonContainer}>
                        <div />
                        <Popover
                            isAppendedToBody
                            children={
                                <DsTypography variant="Regular_14">
                                    {isOffline
                                        ? t('databases.well-architect.only-online-instances')
                                        : t('databases.well-architected-tab.resource-view-fix-hover-msg')}
                                </DsTypography>
                            }
                            trigger="hover"
                            container={
                                <DsButton
                                    variant="secondary"
                                    isThin
                                    onClick={() => {
                                        redirectToGetWellPage(dispatch, rowData);
                                    }}
                                    isDisabled={isOffline}
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
