import { Table, useTable, TableTopBar, DsTypography, ButtonWithDropdown } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import styles from './InnerTable.module.scss';

import { useEffect, useMemo, useState } from 'react';
import { GENERAL } from '../../../../utils/appConstants';
import { getSelectedFromSelectionState } from '../../../../utils/utilityFunctions';
import { setSelectedRowsForOptimizeInnerPage } from '../../../../store/workloadFactory/databaseHomeSlice';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../../store/storeHooks';
import { ReactComponent as MenuIcon } from '../../../../assets/menu-icon2.svg';
import BulkCloneContainer from '../../../../common/BulkAction/BulkCloneContainer';
import { ASSESSMENT_CONFIG_NAMES, WLF_TABS } from '../../../../utils/consts';
import { disableOptimizeResourceCheckBoxForOptimizeCase } from '../../GetWellUtils';
import SmallLoader from '../../../../common/SmallLoader/SmallLoader';

const CloneInsideWF = ({ data, handleBulkActionForClone, fromPage }: any) => {
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
            Header: 'Database name',
            accessor: 'cloneDatabaseName',
            id: '1',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: fromPage === WLF_TABS.DASHBOARD ? '216px' : '211px',
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
            width: fromPage === WLF_TABS.DASHBOARD ? '194px' : '211px'
        },
        {
            Header: 'SQL host name',
            accessor: 'hostName',
            id: '3',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: fromPage === WLF_TABS.DASHBOARD ? '168px' : '211px'
        },

        {
            Header: 'Source database',
            accessor: 'sourceDatabaseName',
            id: '4',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: fromPage === WLF_TABS.DASHBOARD ? '178px' : '211px'
        },
        {
            Header: 'Source volume',
            accessor: 'sourceVolumeNamesList',
            id: '5',
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
            id: '6',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: fromPage === WLF_TABS.DASHBOARD ? '134px' : '211px',
            renderCell: (cellData: any) => {
                return (cellData || 0) + ' days';
            }
        },
        {
            Header: '',
            accessor: '',
            id: '8',
            width: fromPage === WLF_TABS.DASHBOARD ? '170px' : '211px',
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
                                                handleBulkActionForClone('Refresh', 'single', [rowData]);
                                            }
                                        },
                                        {
                                            id: 'delete',
                                            children: 'Delete',
                                            isDisabled: false,
                                            onClick: () => {
                                                handleBulkActionForClone('Delete', 'single', [rowData]);
                                            }
                                        }
                                    ]}
                                >
                                    <MenuIcon />
                                </ButtonWithDropdown>
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
            />
            {selectedRowsForOptimizeInnerPage.length > 0 && (
                <BulkCloneContainer
                    action1={'Delete'}
                    action2={'Refresh'}
                    onClick={(val: any) => {
                        handleBulkActionForClone(val, 'bulk', selectedRowsForOptimizeInnerPage);
                    }}
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
