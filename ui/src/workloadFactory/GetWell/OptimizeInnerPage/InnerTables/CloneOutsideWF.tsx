import { Table, useTable, TableTopBar, DsTypography, ButtonWithDropdown, DsButton } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import styles from './InnerTable.module.scss';

import { useEffect } from 'react';
import { GENERAL } from '../../../../utils/appConstants';
import { getSelectedFromSelectionState } from '../../../../utils/utilityFunctions';
import { setSelectedRowsForOptimizeInnerPage } from '../../../../store/workloadFactory/databaseHomeSlice';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../../store/storeHooks';

import { ReactComponent as MenuIcon } from '../../../../assets/menu-icon2.svg';
import BulkCloneContainer from '../../../../common/BulkAction/BulkCloneContainer';

const CloneOutsideWF = ({ handleBulkActionForClone }: any) => {
    const dispatch = useDispatch();
    const { selectedRowsForOptimizeInnerPage } = useAppSelector(state => state.databaseHome);

    const tableData = [
        {
            databaseName: 'Database 1',
            sourceDatabase: 'SQL-Managed-Host-ProdMSSQLSERVER',
            sourceVolume: 'Volume_1',
            cloneAge: '0 days',
            size: '0.00 GB',
            id: '1'
        },
        {
            databaseName: 'Database 2',
            sourceDatabase: 'SQL-Managed-Host-ProdMSSQLSERVER',
            sourceVolume: 'Volume_1',
            cloneAge: '10 days',
            size: '0.00 GB',
            id: '2'
        },
        {
            databaseName: 'Database 3',
            sourceDatabase: 'SQL-Managed-Host-ProdMSSQLSERVER',
            sourceVolume: 'Volume_1',
            cloneAge: '5 days',
            size: '0.00 GB',
            id: '3'
        }
    ];

    const TableColDefs: ColumnProps[] = [
        {
            Header: 'Database name',
            accessor: 'databaseName',
            id: '1',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: '210px',
            renderCell: (cellData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },

        {
            Header: 'Source volume',
            accessor: 'sourceVolume',
            id: '3',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: 'auto',
            renderCell: (cellData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            Header: 'Clone age',
            accessor: 'cloneAge',
            id: '4',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: '210px',
            renderCell: (cellData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            Header: 'Size',
            accessor: 'size',
            id: '5',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: '210px',
            renderCell: (cellData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            Header: '',
            accessor: '',
            id: '6',
            width: '220px',
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <div className={styles.buttonContainer}>
                        <div />
                        <DsButton
                            isThin
                            variant="secondary"
                            isDisabled={selectedRowsForOptimizeInnerPage.length > 0}
                            onClick={() => {
                                handleBulkActionForClone('Delete', 'single', rowData);
                            }}
                        >
                            Delete
                        </DsButton>
                    </div>
                );
            }
        }
    ];

    const tableProps = useTable({
        //@ts-ignore
        manageColumnsProps: false,
        isHorizontalScroll: false,
        isSorting: false,
        columns: TableColDefs,
        rows: tableData || [],
        pageSize: 50,
        selectionType: 'multiple'
    });

    useEffect(() => {
        const rowsData = getSelectedFromSelectionState(tableProps.selectionState, tableData);

        dispatch(setSelectedRowsForOptimizeInnerPage(rowsData));
    }, [tableProps.selectionState]);

    return (
        <div className={styles['inner-table']}>
            <TableTopBar
                //@ts-ignore
                tableProps={tableProps}
                pluralTitle={`Impacted clones`}
                singularTitle={'Impacted clone'}
            />
            {selectedRowsForOptimizeInnerPage.length > 0 && (
                <BulkCloneContainer
                    action1={'Delete'}
                    onClick={(val: any) => handleBulkActionForClone(val, 'bulk', selectedRowsForOptimizeInnerPage)}
                />
            )}
            <Table
                //@ts-ignore
                tableProps={tableProps}
                isDoubleRow={true}
            />
        </div>
    );
};

export default CloneOutsideWF;
