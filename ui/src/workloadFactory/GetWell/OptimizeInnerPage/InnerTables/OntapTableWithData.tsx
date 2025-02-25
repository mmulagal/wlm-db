import { Table, useTable, TableTopBar } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import styles from './InnerTable.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { useEffect, useMemo } from 'react';
import { getSelectedFromSelectionState } from '../../../../utils/utilityFunctions';
import { setSelectedRowsForOptimizeInnerPage } from '../../../../store/workloadFactory/databaseHomeSlice';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../../store/storeHooks';
import BulkActionContainer from '../../../Dashboard/DashboardInnerPage/RenderTables/BulkActionContainer';
import { useState } from 'react';

const OntapTableWithData = ({ type, data, lastColDetails, handleBulkAction }: any) => {
    const dispatch = useDispatch();
    const { selectedRowsForOptimizeInnerPage } = useAppSelector(state => state.databaseHome);

    const [colName, setColName] = useState('Volume name');
    const [tableHeader, setTableHeader] = useState('Volume');

    const tableData = useMemo(() => {
        let id = 0;
        if (data?.type === 'volume') {
            setColName('Volume name');
            setTableHeader('Volume');
        } else if (data?.type === 'lun') {
            setColName('LUN name');
            setTableHeader('LUN');
        }
        return data?.violationDetails?.map((row: any) => ({
            ...row,
            id: String(id++),
            name: row?.objectName,
            value: row?.value,
            cellProps: { ...row.cellProps, isDisabled: true }
        }));
    }, [data]);

    const TableColDefs: ColumnProps[] = [
        {
            Header: colName,
            accessor: 'name',
            id: '1',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: '481px',
            renderCell: (cellData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            Header: type,
            accessor: 'value',
            id: '2',
            width: '481px',
            filterOptions: 'auto',
            renderCell: (cellData: string) => {
                let value = cellData;
                if (type === 'Snapshot copy reserve') {
                    value = `${cellData}%`;
                }
                return value || GENERAL.NOT_AVAILABLE;
            }
        },

        lastColDetails(type, {})
    ];

    const tableProps = useTable({
        //@ts-ignore
        manageColumnsProps: false,
        isHorizontalScroll: false,
        isSorting: false,
        columns: TableColDefs,
        rows: tableData || [],
        pageSize: 50,
        selectionType: 'multiple',
        defaultSelectedRows: tableData.map((item: any) => item.id)
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
                //@ts-ignore
                tableProps={tableProps}
                pluralTitle={`Impacted ${tableHeader}s`}
                singularTitle={`Impacted ${tableHeader}`}
            />
            {selectedRowsForOptimizeInnerPage.length > 0 && <BulkActionContainer onClick={handleBulkAction} />}
            <Table
                //@ts-ignore
                tableProps={tableProps}
                isDoubleRow={true}
                key={Date.now()}
            />
        </div>
    );
};

export default OntapTableWithData;
