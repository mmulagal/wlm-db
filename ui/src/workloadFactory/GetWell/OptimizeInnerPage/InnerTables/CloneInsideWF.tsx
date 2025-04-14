import { Table, useTable, TableTopBar, DsTypography, ButtonWithDropdown } from '@netapp/design-system';
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

const CloneInsideWF = ({ handleBulkActionForClone }: any) => {
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
            Header: 'Source database',
            accessor: 'sourceDatabase',
            id: '2',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: 'auto'
        },
        {
            Header: 'Source volume',
            accessor: 'sourceVolume',
            id: '3',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: '210px',
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
                    <div
                        className={
                            selectedRowsForOptimizeInnerPage.length > 0
                                ? `${styles.actionContainer} ${styles.actionDisabled}`
                                : styles.actionContainer
                        }
                    >
                        <DsTypography variant="Regular_14" className={styles.actionText}>
                            Optimize
                        </DsTypography>
                        <ButtonWithDropdown
                            variant="icon"
                            isDisabled={selectedRowsForOptimizeInnerPage.length > 0}
                            items={[
                                {
                                    id: 'refresh',
                                    children: 'Refresh',
                                    isDisabled: false,
                                    onClick: () => {
                                        handleBulkActionForClone('Refresh', 'single', rowData);
                                    }
                                },
                                {
                                    id: 'delete',
                                    children: 'Delete',
                                    isDisabled: false,
                                    onClick: () => {
                                        handleBulkActionForClone('Delete', 'single', rowData);
                                    }
                                }
                            ]}
                        >
                            <MenuIcon />
                        </ButtonWithDropdown>
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
                    action2={'Refresh'}
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

export default CloneInsideWF;
