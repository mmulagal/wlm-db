import { Table, useTable, TableTopBar, DsButton } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import styles from './InnerTable.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { checkBoxHandle, getSelectedFromSelectionState } from '../../../../utils/utilityFunctions';
import { setSelectedRowsForOptimizeInnerPage } from '../../../../store/workloadFactory/databaseHomeSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import BulkActionContainer from '../../../../common/BulkAction/BulkActionContainer';
import { ASSESSMENT_CONFIG_NAMES, DBType } from '../../../../utils/consts';

const OntapTableWithData = ({ type, data, lastColDetails, handleBulkAction, engineType = DBType.ORACLE }: any) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { selectedRowsForOptimizeInnerPage } = useAppSelector(state => state.databaseHome);
    const { inProgressOptimizationData } = useAppSelector(state => state.getWellOptimize);

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
            value: row?.value
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
            width: 'auto',
            renderCell: (cellData: any) => cellData || GENERAL.NOT_AVAILABLE
        },
        {
            Header: type,
            accessor: 'value',
            id: '2',
            width: 'auto',
            filterOptions: 'auto',
            renderCell: (cellData: string) => {
                let value = cellData;
                if (type === 'Snapshot copy reserve') {
                    value = `${cellData}%`;
                }
                return value || GENERAL.NOT_AVAILABLE;
            }
        },

        // Conditional column for Oracle
        ...(engineType === DBType.ORACLE
            ? [
                  {
                      Header: t('databases.well-architect.recommended-value'),
                      accessor: 'recommended',
                      id: '3',
                      isSortable: false,
                      filterOptions: 'auto',
                      isSticky: false,
                      width: 'auto',
                      renderCell: (cellData: any) => cellData || GENERAL.NOT_AVAILABLE
                  }
              ]
            : []),

        lastColDetails(type, {})
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

        if (rowsData.length > 0 && inProgressOptimizationData?.[ASSESSMENT_CONFIG_NAMES.ONTAP]?.length) {
            checkBoxHandle(tableProps.selectionState, rowsData, dispatch);
        }
    }, [tableProps.selectionState, inProgressOptimizationData]);

    return (
        <div className={styles['inner-table']}>
            <TableTopBar
                // @ts-ignore
                tableProps={tableProps}
                pluralTitle={`Impacted ${tableHeader}s`}
                singularTitle={`Impacted ${tableHeader}`}
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

export default OntapTableWithData;
