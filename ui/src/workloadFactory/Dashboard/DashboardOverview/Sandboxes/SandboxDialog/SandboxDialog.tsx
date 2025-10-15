import { DsFlashingDotsLoader, DsTypography, Table, useTable, TableTopBar } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import styles from './SandboxDialog.module.scss';
import { GENERAL } from '../../../../../utils/appConstants';
import { INVENTORY_STATUS } from '../../../../../utils/consts';
import { setSelectedSandboxRow } from '../../../../../store/workloadFactory/sandboxSlice';
import { useAppSelector } from '../../../../../store/storeHooks';

const SandboxDialog = ({ tableData }: { tableData: any }) => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const selectedRow = useAppSelector(state => state.sandbox.selectedSandboxRow);

    const ColDefs: ColumnProps[] = [
        {
            id: '1',
            Header: t('databases.dashboard.resource-name'),
            accessor: 'databaseInstanceName',
            width: '200px',
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
            Header: t('databases.dashboard.type'),
            accessor: 'type',
            width: 'auto',
            filterOptions: 'auto',
            renderCell: (cellData: any) => cellData || GENERAL.NOT_AVAILABLE
        },
        {
            id: '3',
            Header: t('databases.dashboard.host-name'),
            accessor: 'databaseHostName',
            width: '200px',
            filterOptions: 'auto',
            renderCell: (cellData: any) => cellData || GENERAL.NOT_AVAILABLE
        },
        {
            id: '4',
            Header: t('databases.dashboard.sandboxes'),
            accessor: 'sandboxCount',
            width: 'auto',
            isSortable: true,
            renderCell: (cellData: any) => cellData || 0
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
        isSorting: true,
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
                dispatch(setSelectedSandboxRow(row));
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tableProps.selectionState, tableData]);

    return (
        <div className={styles.categoryDialogContent}>
            <DsTypography variant="Regular_14">{t('databases.dashboard.sandbox-dialog-text')}</DsTypography>
            <div className={styles.table} style={{ width: '800px' }}>
                <TableTopBar
                    // @ts-ignore
                    tableProps={tableProps}
                    pluralTitle={t('databases.dashboard.resources')}
                    singularTitle={t('databases.dashboard.resource')}
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

export default SandboxDialog;
