import { Table, useTable, TableTopBar, ButtonWithDropdown, DsTypography } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';

import styles from './DismissTables.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { useEffect } from 'react';
import { formatDateAssess, getSelectedFromSelectionState } from '../../../../utils/utilityFunctions';
import { useDispatch } from 'react-redux';
import { setSelectedRowsForDismiss } from '../../../../store/workloadFactory/databaseHomeSlice';
import FirstColumnComponent from '../RenderTables/FirstColumnComponent';
import { CONFIG_STATES, CONFIG_STATES_UI } from '../../../../utils/consts';
import { ReactComponent as MenuIcon } from '../../../../assets/menu-icon2.svg';
import { ReactComponent as Success } from '../../../../assets/success.svg';
import { ReactComponent as Warning } from '../../../../assets/warning.svg';
import BulkDismissContainer from '../../../../common/BulkAction/BulkDismissContainer';
import { GENERAL } from '../../../../utils/appConstants';

interface StorageTierTableProps {
    handleBulkAction: any;
    handleSingleAction?: any;
    tableData?: any;
    type?: string;
}

const DismissTable = ({ handleBulkAction, handleSingleAction, tableData, type }: StorageTierTableProps) => {
    const dispatch = useDispatch();
    const { selectedRowsForDismiss } = useAppSelector(state => state.databaseHome);

    // // Update tableData when selection changes
    // const updatedTableData = useMemo(() => {
    //     if (inProgressOptimizationData?.[type]?.length) {
    //         return disableOptimizeCheckBoxForOptimizeCase(
    //             tableData,
    //             type,
    //             selectedRowsForDismiss
    //         );
    //     } else {
    //         return disableOptimizeCheckBoxForErrCase(tableData, type);
    //     }
    // }, [selectedRowsForDismiss, tableData, inProgressOptimizationData]);

    const setStatusIcon = (value: string) => {
        if (value === CONFIG_STATES.ACTIVE) {
            return <Success />;
        } else if (value.includes(CONFIG_STATES.POSTPONED)) {
            return <Warning />;
        } else {
            return <Warning />;
        }
    };

    const mapStatus = (value: string, rowData: any) => {
        if (value === CONFIG_STATES.ACTIVE) {
            return CONFIG_STATES_UI.ACTIVE;
        } else if (value === CONFIG_STATES.POSTPONED) {
            return CONFIG_STATES_UI.POSTPONED + ' untill ' + formatDateAssess(rowData?.configObj?.endTime);
        } else if (value === CONFIG_STATES.DISMISSED) {
            return CONFIG_STATES_UI.DISMISSED;
        } else {
            return GENERAL.NOT_AVAILABLE;
        }
    };

    const TableColDefs: ColumnProps[] = [
        {
            Header: 'SQL Server instance name ',
            accessor: 'serverInstanceName',
            id: '1',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: '320px',
            renderCell: (cellData: any, rowData: any) => {
                return <FirstColumnComponent rowData={rowData} />;
            }
        },
        {
            Header: 'Host name',
            accessor: 'hostName',
            id: '2',
            width: '403px',
            filterOptions: 'auto'
        },
        {
            Header: 'Configuration state',
            accessor: 'configState',
            id: '3',
            width: '320px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                return (
                    <div className={styles.configContainer}>
                        {setStatusIcon(cellData)}
                        <DsTypography variant="Regular_14" className={styles.statusText}>
                            {mapStatus(cellData, rowData)}
                        </DsTypography>
                    </div>
                );
            }
        },
        {
            Header: 'Action',
            accessor: '',
            id: '4',
            width: '220px',
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <div
                        className={
                            selectedRowsForDismiss.length > 0
                                ? `${styles.actionContainer} ${styles.actionDisabled}`
                                : styles.actionContainer
                        }
                    >
                        <DsTypography variant="Regular_14" className={styles.actionText}>
                            Set status
                        </DsTypography>
                        <ButtonWithDropdown
                            variant="icon"
                            isDisabled={selectedRowsForDismiss.length > 0}
                            items={[
                                {
                                    id: 'activate',
                                    children: 'Activate',
                                    isDisabled: rowData?.configState === CONFIG_STATES.ACTIVE,
                                    onClick: () => {
                                        handleSingleAction(type, rowData, 'activate');
                                    }
                                },
                                {
                                    id: 'postponeFor30Days',
                                    children: 'Postpone for 30 days',
                                    isDisabled: rowData?.configState.includes(CONFIG_STATES.POSTPONED),
                                    onClick: () => {
                                        handleSingleAction(type, rowData, 'postponeFor30Days');
                                    }
                                },
                                {
                                    id: 'dismiss',
                                    children: 'Dismiss',
                                    isDisabled: rowData?.configState === CONFIG_STATES.DISMISSED,
                                    onClick: () => {
                                        handleSingleAction(type, rowData, 'dismiss');
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
        selectionType: 'multiple',
        defaultSelectedRows: []
    });

    useEffect(() => {
        const rowsData = getSelectedFromSelectionState(tableProps.selectionState, tableData);

        dispatch(setSelectedRowsForDismiss(rowsData));

        // if (rowsData.length > 0 && inProgressOptimizationData?.[ASSESSMENT_CONFIG_NAMES.STORAGE_TIER]?.length) {
        //     checkBoxHandle(tableProps.selectionState, rowsData, dispatch);
        // }
    }, [tableProps.selectionState]);

    const handleBulkOperation = (val: string) => {
        handleBulkAction(type, selectedRowsForDismiss);
    };
    return (
        <div className={styles.dismissTables}>
            <TableTopBar
                //@ts-ignore
                tableProps={tableProps}
                pluralTitle={`Instances`}
                singularTitle={'Instance'}
            />
            {selectedRowsForDismiss.length > 0 && (
                <BulkDismissContainer
                    onClick={(val: any) => handleBulkOperation(val)}
                    rowData={selectedRowsForDismiss.map((row: any) => row?.configState)}
                />
            )}
            <Table
                //@ts-ignore
                tableProps={tableProps}
                isDoubleRow={true}
                key={Date.now()}
            />
        </div>
    );
};

export default DismissTable;
