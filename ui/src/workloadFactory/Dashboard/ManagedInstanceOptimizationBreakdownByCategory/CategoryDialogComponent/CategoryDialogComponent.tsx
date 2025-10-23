import { DsFlashingDotsLoader, DsTypography, Table, useTable, TableTopBar } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import styles from './CategoryDialogComponent.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { setSelectedAssessmentRow } from '../../../../store/workloadFactory/databaseHomeSlice';
import { INVENTORY_STATUS } from '../../../../utils/consts';
import { GENERAL } from '../../../../utils/appConstants';

const CategoryDialogComponent = ({ tableData }: { tableData: any }) => {
    const dispatch = useDispatch();
    const selectedRow = useAppSelector(state => state.databaseHome.selectedAssessmentRow);
    const { t } = useTranslation();

    const ColDefs: ColumnProps[] = [
        {
            id: '1',
            Header: t('databases.dashboard.resource-name'),
            accessor: 'databaseInstanceName',
            width: 'auto',
            filterOptions: 'auto',
            renderCell: (cellData: any, rowData: any) => {
                const name = rowData?.databaseInstanceName;
                return (
                    <div>
                        <DsTypography variant="Semibold_14">{name || GENERAL.NOT_AVAILABLE}</DsTypography>
                        {rowData?.loadingStatus && <DsFlashingDotsLoader />}
                        {!rowData?.loadingStatus && (
                            <div className={styles.firstColText}>
                                {(rowData?.status === INVENTORY_STATUS.RUNNING ||
                                    rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP) && (
                                    <div className={`${styles.statusIcon} ${styles.circle} ${styles.online}`} />
                                )}
                                {(rowData?.status === INVENTORY_STATUS.STOPPED ||
                                    rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_DOWN) && (
                                    <div className={`${styles.statusIcon} ${styles.circle} ${styles.offline}`} />
                                )}
                                {rowData?.status === INVENTORY_STATUS.UNKNOWN && (
                                    <div className={`${styles.statusIcon} ${styles.circle} ${styles.unknown}`} />
                                )}
                                <DsTypography variant="Regular_13">
                                    {rowData?.status === INVENTORY_STATUS.RUNNING ||
                                    rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP
                                        ? INVENTORY_STATUS.ONLINE
                                        : rowData?.status === INVENTORY_STATUS.STOPPED ||
                                          rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_DOWN
                                        ? INVENTORY_STATUS.OFFLINE
                                        : rowData?.status}
                                    {!rowData?.status && rowData?.loading && <DsFlashingDotsLoader />}
                                    {!rowData?.status && !rowData?.loading && 'Unknown'}
                                </DsTypography>
                            </div>
                        )}
                    </div>
                );
            }
        },
        {
            id: '2',
            Header: t('databases.dashboard.engine-type'),
            accessor: 'type',
            width: 'auto',
            filterOptions: 'auto',
            renderCell: (cellData: any) => cellData || GENERAL.NOT_AVAILABLE
        },
        {
            id: '3',
            Header: t('databases.dashboard.hostname'),
            accessor: 'hostName',
            width: '20%',
            filterOptions: 'auto',
            renderCell: (cellData: any) => cellData || GENERAL.NOT_AVAILABLE
        },
        {
            id: '4',
            Header: t('databases.dashboard.optimization-score'),
            accessor: 'score',
            width: '20%',
            isSortable: true,
            renderCell: (cellData: any) => cellData || GENERAL.NOT_AVAILABLE
        }
    ];

    const firstEnabledRow = () => {
        const enabledRow = tableData?.find((row: any) => row?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP);
        if (enabledRow) {
            return enabledRow?.id;
        }
        return null;
    };

    const tableProps = useTable({
        // @ts-ignore
        selectAllProps: false,
        // @ts-ignore
        manageColumnsProps: false,
        defaultSelectedRows: selectedRow ? [selectedRow.id] : [firstEnabledRow()],
        isSorting: false,
        selectionType: 'singular',
        columns: ColDefs,
        rows: tableData,
        isHorizontalScroll: false,
        isVerticalScroll: true,
        isLazyLoading: false
    });

    useEffect(() => {
        const rowNumber: any = Object.keys(tableProps?.selectionState?.rows || {})?.[0];
        if (rowNumber && rowNumber !== '0') {
            const row = tableData?.find((row: any) => String(row?.id) === rowNumber);
            if (row) {
                dispatch(setSelectedAssessmentRow(row));
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tableProps.selectionState]);

    return (
        <div className={styles.categoryDialogContent}>
            <DsTypography variant="Regular_14">{t('databases.dashboard.category-dialog-component')}</DsTypography>
            <div className={styles.table}>
                <TableTopBar
                    // @ts-ignore
                    tableProps={tableProps}
                    pluralTitle={t('databases.well-architect.not-optimized-resources')}
                    singularTitle={t('databases.well-architect.not-optimized-resource')}
                />
                <Table
                    // @ts-ignore
                    tableProps={tableProps}
                    isDoubleRow
                />
            </div>
        </div>
    );
};

export default CategoryDialogComponent;
