import { Table, useTable, TableTopBar, DsTypography, DsButton, Popover } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import styles from './InnerTable.module.scss';

import { useEffect, useMemo } from 'react';
import { GENERAL } from '../../../../utils/appConstants';
import { getSelectedFromSelectionState } from '../../../../utils/utilityFunctions';
import { setSelectedRowsForOptimizeInnerPage } from '../../../../store/workloadFactory/databaseHomeSlice';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../../store/storeHooks';
import BulkCloneContainer from '../../../../common/BulkAction/BulkCloneContainer';
import { ASSESSMENT_CONFIG_NAMES, WLF_TABS } from '../../../../utils/consts';
import { disableOptimizeResourceCheckBoxForOptimizeCase } from '../../GetWellUtils';
import SmallLoader from '../../../../common/SmallLoader/SmallLoader';

const CloneOutsideWF = ({ data, handleBulkActionForClone, fromPage }: any) => {
    const dispatch = useDispatch();
    const { selectedRowsForOptimizeInnerPage } = useAppSelector(state => state.databaseHome);
    const { inProgressResourceOptimizeData } = useAppSelector(state => state.getWellOptimize);

    // Update tableData when selection changes
    const updatedTableData = useMemo(() => {
        if (inProgressResourceOptimizeData?.[ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT]?.length) {
            return disableOptimizeResourceCheckBoxForOptimizeCase(
                data,
                ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT,
                selectedRowsForOptimizeInnerPage
            );
        } else {
            return data;
        }
    }, [selectedRowsForOptimizeInnerPage, data, inProgressResourceOptimizeData]);

    const TableColDefs: ColumnProps[] = [
        {
            Header: 'Clone database name',
            accessor: 'cloneDatabaseName',
            id: '1',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: fromPage === WLF_TABS.DASHBOARD ? '210px' : '210px',
            renderCell: (cellData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            Header: 'SQL instance name',
            accessor: 'serverInstanceName',
            id: '2',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: fromPage === WLF_TABS.DASHBOARD ? '194px' : '210px'
        },
        {
            Header: 'SQL host name',
            accessor: 'hostName',
            id: '3',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: fromPage === WLF_TABS.DASHBOARD ? '168px' : '210px'
        },

        {
            Header: 'Source volume',
            accessor: 'sourceVolumeNamesList',
            id: '4',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: fromPage === WLF_TABS.DASHBOARD ? 'auto' : 'auto',
            renderCell: (cellData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            Header: 'Clone age',
            accessor: 'cloneAge',
            id: '5',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: fromPage === WLF_TABS.DASHBOARD ? '134px' : '210px',
            renderCell: (cellData: any) => {
                return (cellData || 0) + ' days';
            }
        },
        {
            Header: '',
            accessor: '',
            id: '7',
            width: fromPage === WLF_TABS.DASHBOARD ? '200px' : '270px',
            renderCell: (cellData: any, rowData: any) => {
                const isInProgress = inProgressResourceOptimizeData?.[
                    ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT
                ]?.includes(rowData?.id);
                return (
                    <>
                        {isInProgress ? (
                            <div className={styles['optimize-in-progress']}>
                                <SmallLoader />
                                <DsTypography variant="Semibold_14">Fixing</DsTypography>
                            </div>
                        ) : (
                            <div className={styles.buttonContainer}>
                                <div />
                                {selectedRowsForOptimizeInnerPage && selectedRowsForOptimizeInnerPage.length > 0 ? (
                                    <Popover
                                        isAppendedToBody={true}
                                        children={
                                            <DsTypography variant="Regular_14">
                                                Bulk action is enabled on selected rows
                                            </DsTypography>
                                        }
                                        trigger="hover"
                                        container={
                                            <DsButton variant="secondary" isDisabled={true} isThin>
                                                Delete
                                            </DsButton>
                                        }
                                    />
                                ) : (
                                    <DsButton
                                        isThin
                                        variant="secondary"
                                        isDisabled={selectedRowsForOptimizeInnerPage.length > 0}
                                        onClick={() => {
                                            handleBulkActionForClone('Delete', 'single', [rowData]);
                                        }}
                                    >
                                        Delete
                                    </DsButton>
                                )}
                            </div>
                        )}
                    </>
                );
            }
        }
    ];

    const colDefsForInstance = TableColDefs.filter((item: any) => item.id !== '2' && item.id !== '3');

    const tableProps = useTable({
        //@ts-ignore
        manageColumnsProps: false,
        isHorizontalScroll: false,
        isSorting: false,
        columns: fromPage === WLF_TABS.DASHBOARD ? TableColDefs : colDefsForInstance,
        rows: updatedTableData || [],
        pageSize: 50,
        selectionType: 'multiple'
    });

    useEffect(() => {
        const rowsData = getSelectedFromSelectionState(tableProps.selectionState, data);

        dispatch(setSelectedRowsForOptimizeInnerPage(rowsData));
    }, [tableProps.selectionState, data]);

    return (
        <div className={styles['inner-table']}>
            <TableTopBar
                //@ts-ignore
                tableProps={tableProps}
                pluralTitle={`Impacted databases`}
                singularTitle={'Impacted database'}
                subTitle="Clone refreshing is supported only for clones created in Workload Factory."
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
