import { DsFlashingDotsLoader, DsTypography, Table, useTable, TableTopBar } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import styles from './ActivateErrorInvestigation.module.scss';
import { useAppSelector } from '../../../../../../store/storeHooks';
import { INVENTORY_STATUS } from '../../../../../../utils/consts';
import { setSelectedErrorInvestigationRow } from '../../../../../../store/workloadFactory/agenticAISlice';
import InventoryStatusIndicator from '../../../../../../common/InventoryStatusIndicator/InventoryStatusIndicator';

const ActivateErrorInvestigation = ({ tableData }: { tableData: any }) => {
    const dispatch = useDispatch();
    const { selectedErrorInvestigationRow } = useAppSelector(state => state.agenticAI);
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
                        <DsTypography variant="Semibold_14">
                            {name || t('databases.general.not-available-table-columns')}
                        </DsTypography>
                        {rowData?.loadingStatus && <DsFlashingDotsLoader />}
                        {!rowData?.loadingStatus && (
                            <div className={styles.firstColText}>
                                <InventoryStatusIndicator status={rowData?.status} loading={rowData?.loading} />
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
            renderCell: (cellData: any) => cellData || t('databases.general.not-available-table-columns')
        },
        {
            id: '3',
            Header: t('databases.dashboard.host-name'),
            accessor: 'databaseHostName',
            width: 'auto',
            filterOptions: 'auto',
            renderCell: (cellData: any) => cellData || t('databases.general.not-available-table-columns')
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
        defaultSelectedRows: selectedErrorInvestigationRow ? [selectedErrorInvestigationRow.id] : [firstEnabledRow()],
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
                dispatch(setSelectedErrorInvestigationRow(row));
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tableProps.selectionState]);

    return (
        <div className={styles.categoryDialogContent}>
            <DsTypography variant="Regular_14">{t('databases.dashboard.activation-dialog-text')}</DsTypography>
            <div className={styles.table}>
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

export default ActivateErrorInvestigation;
