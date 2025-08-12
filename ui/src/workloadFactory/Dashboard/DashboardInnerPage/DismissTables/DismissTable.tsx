import { ButtonWithDropdown, DsTypography } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';

import { useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import styles from './DismissTables.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import {
    checkBoxHandleDismiss,
    formatDateAssess,
    getSelectedFromSelectionState
} from '../../../../utils/utilityFunctions';
import { setSelectedRowsForDismiss } from '../../../../store/workloadFactory/databaseHomeSlice';
import FirstColumnComponent from '../RenderTables/FirstColumnComponent';
import { CONFIG_STATES, CONFIG_STATES_UI, CONFIG_STATE_ACTIONS } from '../../../../utils/consts';
import { ReactComponent as MenuIcon } from '../../../../assets/menu-icon2.svg';
import { ReactComponent as Success } from '../../../../assets/success.svg';
import { ReactComponent as Warning } from '../../../../assets/warning.svg';
import { ReactComponent as Info } from '../../../../assets/info.svg';
import BulkDismissContainer from '../../../../common/BulkAction/BulkDismissContainer';
import { GENERAL } from '../../../../utils/appConstants';
import { initialDashboardInnerPageOptimizeColState } from '../../../../utils/manageColumnUtils';
import { useTable } from '../../../../common/Lib/Table/useTable';
import { TableTopBar } from '../../../../common/Lib/Table/TableTopBar';
import { Table } from '../../../../common/Lib/Table/Table';
import { checkIfDisableForDismiss, disableDismissCheckBoxForErrCase } from '../../../GetWell/GetWellUtils';

interface StorageTierTableProps {
    handleBulkAction: any;
    handleSingleAction?: any;
    tableData?: any;
    type?: string;
}

const DismissTable = ({ handleBulkAction, handleSingleAction, tableData, type }: StorageTierTableProps) => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const { selectedRowsForDismiss } = useAppSelector(state => state.databaseHome);
    const { inProgressStateData } = useAppSelector(state => state.getWellOptimize);

    const setStatusIcon = (value: string) => {
        if (value === CONFIG_STATES.ACTIVE) {
            return (
                <div>
                    <Success />
                </div>
            );
        }
        if (value === CONFIG_STATES.ACTIVATING) {
            return (
                <div>
                    <Info />
                </div>
            );
        }
        if (value.includes(CONFIG_STATES.POSTPONED)) {
            return (
                <div>
                    <Warning />
                </div>
            );
        }
        return (
            <div>
                <Warning />
            </div>
        );
    };

    const mapStatus = (value: string, rowData: any) => {
        if (value === CONFIG_STATES.ACTIVE) {
            return CONFIG_STATES_UI.ACTIVE;
        }
        if (value === CONFIG_STATES.POSTPONED) {
            return (
                CONFIG_STATES_UI.POSTPONED +
                (rowData?.configObj?.endTime ? ` until ${formatDateAssess(rowData?.configObj?.endTime)}` : '')
            );
        }
        if (value === CONFIG_STATES.DISMISSED) {
            return CONFIG_STATES_UI.DISMISSED;
        }
        if (value === CONFIG_STATES.ACTIVATING) {
            return GENERAL.ACTIVATING_MESSAGE;
        }
        return GENERAL.NOT_AVAILABLE;
    };

    // Update tableData when offline
    const updatedTableData = useMemo(() => disableDismissCheckBoxForErrCase(tableData, type || ''), [tableData]);

    const TableColDefs: ColumnProps[] = [
        {
            Header: 'SQL Server instance name ',
            accessor: 'serverInstanceName',
            id: '1',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: '320px',
            renderCell: (cellData: any, rowData: any) => <FirstColumnComponent rowData={rowData} />
        },
        {
            Header: 'Host name',
            accessor: 'hostName',
            id: '2',
            width: '200px',
            filterOptions: 'auto'
        },
        {
            Header: 'Analysis state',
            accessor: 'configState',
            id: '3',
            width: '200px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => (
                <div className={styles.configContainer}>
                    {setStatusIcon(cellData)}
                    <DsTypography variant="Regular_14" className={styles.statusText}>
                        {mapStatus(cellData, rowData)}
                    </DsTypography>
                </div>
            )
        },
        {
            id: '4',
            Header: 'AWS credentials',
            accessor: 'credentialName',
            filterOptions: 'auto',
            width: '180px'
        },
        {
            id: '5',
            Header: 'AWS account',
            accessor: 'accountId',
            filterOptions: 'auto',
            width: '180px'
        },
        {
            id: '6',
            Header: 'Region',
            accessor: 'regionName',
            filterOptions: 'auto',
            width: '180px'
        },
        {
            Header: 'Action',
            accessor: '',
            id: '7',
            width: '150px',
            isSticky: true,
            renderCell: (cellData: any, rowData: any) => {
                const { isDisabled, errorMessage } = checkIfDisableForDismiss(rowData, selectedRowsForDismiss);
                return (
                    <div
                        className={
                            selectedRowsForDismiss.length > 0 || isDisabled
                                ? `${styles.actionContainer} ${styles.actionDisabled}`
                                : styles.actionContainer
                        }
                    >
                        <DsTypography variant="Regular_14" className={styles.actionText}>
                            {t('databases.dashboard.update-state')}
                        </DsTypography>
                        <ButtonWithDropdown
                            variant="icon"
                            isDisabled={selectedRowsForDismiss.length > 0 || isDisabled}
                            items={[
                                {
                                    id: 'activate',
                                    children: GENERAL.REACTIVATE,
                                    isDisabled:
                                        rowData?.configState === CONFIG_STATES.ACTIVE ||
                                        rowData?.configState === CONFIG_STATES.ACTIVATING,
                                    onClick: () => {
                                        handleSingleAction(type, rowData, CONFIG_STATE_ACTIONS.ACTIVE);
                                    },
                                    title: GENERAL.REACTIVATE_TOOLTIP,
                                    titleProps: {
                                        placement: 'left'
                                    }
                                },
                                {
                                    id: 'postponeFor30Days',
                                    children: GENERAL.POSTPONE_FOR_30_DAYS,
                                    isDisabled: rowData?.configState.includes(CONFIG_STATES.POSTPONED),
                                    onClick: () => {
                                        handleSingleAction(type, rowData, CONFIG_STATE_ACTIONS.POSTPONED);
                                    },
                                    title: GENERAL.POSTPONED_TOOLTIP,
                                    titleProps: {
                                        placement: 'left'
                                    }
                                },
                                {
                                    id: 'dismiss',
                                    children: GENERAL.DISMISS,
                                    isDisabled: rowData?.configState === CONFIG_STATES.DISMISSED,
                                    onClick: () => {
                                        handleSingleAction(type, rowData, CONFIG_STATE_ACTIONS.DISMISS);
                                    },
                                    title: GENERAL.DISMISS_TOOLTIP,
                                    titleProps: {
                                        placement: 'left'
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
        // @ts-ignore
        manageColumnsProps: false,
        isHorizontalScroll: true,
        isSorting: false,
        columns: TableColDefs,
        rows: updatedTableData || [],
        pageSize: 50,
        selectionType: 'multiple',
        defaultSelectedRows: [],
        isManagedColumns: true,
        initialColumnState: initialDashboardInnerPageOptimizeColState
    });

    useEffect(() => {
        const rowsData = getSelectedFromSelectionState(tableProps.selectionState, updatedTableData);

        dispatch(setSelectedRowsForDismiss(rowsData));

        if (rowsData.length > 0 && inProgressStateData?.[type || '']?.length) {
            checkBoxHandleDismiss(tableProps.selectionState, rowsData, dispatch);
        }
    }, [tableProps.selectionState, inProgressStateData]);

    const handleBulkOperation = (action: string, dialogCheck: boolean) => {
        handleBulkAction(type, selectedRowsForDismiss, action, dialogCheck);
    };

    return (
        <div className={styles.dismissTables}>
            <TableTopBar
                // @ts-ignore
                tableProps={tableProps}
                pluralTitle="Instances"
                singularTitle="Instance"
            />
            {selectedRowsForDismiss.length > 0 && (
                <BulkDismissContainer
                    onClick={(val: any, dialogCheck: boolean) => handleBulkOperation(val, dialogCheck)}
                    rowData={selectedRowsForDismiss?.map((row: any) => row?.configState)}
                />
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

export default DismissTable;
