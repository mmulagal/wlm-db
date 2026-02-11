import { Table, useTable, TableTopBar, DsTypography, Popover } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import styles from './InnerTable.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { getSelectedFromSelectionState } from '../../../../utils/utilityFunctions';
import { setSelectedRowsForOptimizeInnerPage } from '../../../../store/workloadFactory/databaseHomeSlice';
import { ReactComponent as TooltipIcon } from '../../../../assets/tooltipGrey.svg';
import { useAppSelector } from '../../../../store/storeHooks';
import BulkActionContainer from '../../../../common/BulkAction/BulkActionContainer';
import { getWadCellProps } from '../../GetWellUtils';

const RSSOptimizeTable = ({ type, data, lastColDetails, handleBulkAction, isWad = false }: any) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { selectedRowsForOptimizeInnerPage } = useAppSelector(state => state.databaseHome);
    const tableData = useMemo(() => {
        let id = 0;
        return data?.notOptimizedAdapters?.map((row: any) => ({
            ...row,
            cellProps: getWadCellProps(isWad, t, { ...row.cellProps, isDisabled: false }),
            id: String(id++)
        }));
    }, [data, isWad, t]);

    const TableColDefs: ColumnProps[] = [
        {
            Header: 'Network adapter name',
            accessor: 'adapterName',
            id: '1',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: '219px',
            renderCell: (cellData: any, rowData: any) => cellData || GENERAL.NOT_AVAILABLE
        },

        {
            Header: 'TCP offloading',
            accessor: 'tcpOffloadStateStatus',
            id: '3',
            width: '174px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => (
                <div className={styles.rssCell}>
                    <Popover
                        popoverClass=""
                        children={rowData?.tcpOffloadState}
                        trigger="hover"
                        container={<TooltipIcon />}
                    />
                    <DsTypography variant="Regular_13" className={`${styles.colText}`}>
                        {cellData || GENERAL.NOT_AVAILABLE}
                    </DsTypography>
                </div>
            )
        },
        {
            Header: 'Receive queues',
            accessor: 'receiveQueuesStatus',
            id: '4',
            width: '174px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => (
                <div className={styles.rssCell}>
                    <Popover
                        popoverClass=""
                        children={rowData?.numberOfReceiveQueues}
                        trigger="hover"
                        container={<TooltipIcon />}
                    />
                    <DsTypography variant="Regular_13" className={`${styles.colText}`}>
                        {cellData || GENERAL.NOT_AVAILABLE}
                    </DsTypography>
                </div>
            )
        },
        {
            Header: 'RSS profile',
            accessor: 'rssProfileStatus',
            id: '5',
            width: '150px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => (
                <div className={styles.rssCell}>
                    <Popover
                        popoverClass=""
                        children={rowData?.rssProfile}
                        trigger="hover"
                        container={<TooltipIcon />}
                    />
                    <DsTypography variant="Regular_13" className={`${styles.colText}`}>
                        {cellData || GENERAL.NOT_AVAILABLE}
                    </DsTypography>
                </div>
            )
        },
        {
            Header: 'RSS status',
            accessor: 'rssEnabledStatus',
            id: '6',
            width: '150px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => (
                <div className={styles.rssCell}>
                    <Popover
                        popoverClass=""
                        children={rowData?.rssEnabled}
                        trigger="hover"
                        container={<TooltipIcon />}
                    />
                    <DsTypography variant="Regular_13" className={`${styles.colText}`}>
                        {cellData || GENERAL.NOT_AVAILABLE}
                    </DsTypography>
                </div>
            )
        },
        {
            Header: 'Base processor',
            accessor: 'baseProcessorNumberStatus',
            id: '7',
            width: 'auto',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => (
                <div className={styles.rssCell}>
                    <Popover
                        popoverClass=""
                        children={rowData?.baseProcessorNumber}
                        trigger="hover"
                        container={<TooltipIcon />}
                    />
                    <DsTypography variant="Regular_13" className={`${styles.colText}`}>
                        {cellData || GENERAL.NOT_AVAILABLE}
                    </DsTypography>
                </div>
            )
        },
        lastColDetails(type, {}, '222px')
    ];

    const tableProps = useTable({
        // @ts-ignore
        manageColumnsProps: false,
        isHorizontalScroll: false,
        isSorting: false,
        columns: TableColDefs,
        rows: tableData || [],
        pageSize: 50,
        selectionType: 'multiple',
        defaultSelectedRows: []
    });

    useEffect(() => {
        const rowsData = getSelectedFromSelectionState(tableProps.selectionState, tableData);

        dispatch(setSelectedRowsForOptimizeInnerPage(rowsData));

        // if (rowsData.length > 0 && inProgressOptimizationData?.[ASSESSMENT_CONFIG_NAMES.STORAGE_TIER]?.length) {
        //     checkBoxHandle(tableProps.selectionState, rowsData, disptach);
        // }
    }, [tableProps.selectionState]);

    return (
        <div className={styles['inner-table']}>
            <TableTopBar
                // @ts-ignore
                tableProps={tableProps}
                pluralTitle="Impacted network adapters"
                singularTitle="Impacted network adapter"
            />
            {selectedRowsForOptimizeInnerPage.length > 0 && (
                <BulkActionContainer action={GENERAL.OPTIMIZE} onClick={handleBulkAction} />
            )}
            <Table
                // @ts-ignore
                tableProps={tableProps}
                isDoubleRow
                key={Date.now()}
            />
        </div>
    );
};

export default RSSOptimizeTable;
