import { Table, useTable, TableTopBar, ButtonWithDropdown, DsTypography } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';

import styles from './DismissTables.module.scss';
import { ReactComponent as BtnIcon } from '@netapp/icons/ic_bell.svg';
import { GENERAL } from '../../../../utils/appConstants';
import { useAppSelector } from '../../../../store/storeHooks';
import { useEffect, useMemo } from 'react';
import { isOptimized, mapHostStatusToAssessmentData } from '../../../DatabaseHomePage/DatabaseHomeUtils';
import { checkBoxHandle, getSelectedFromSelectionState } from '../../../../utils/utilityFunctions';
import { useDispatch } from 'react-redux';
import {
    setSelectedRowsForDismiss,
    setSelectedRowsForOptimize
} from '../../../../store/workloadFactory/databaseHomeSlice';
import FirstColumnComponent from '../RenderTables/FirstColumnCoponent';
import { ASSESSMENT_CONFIG_NAMES, GETWELL_VALUES } from '../../../../utils/consts';
import {
    disableOptimizeCheckBoxForErrCase,
    disableOptimizeCheckBoxForOptimizeCase
} from '../../../GetWell/GetWellUtils';
import BulkActionContainer from '../../../../common/BulkAction/BulkActionContainer';
import { ReactComponent as MenuIcon } from '../../../../assets/menu-icon2.svg';
import { ReactComponent as Success } from '../../../../assets/success.svg';
import { ReactComponent as Warning } from '../../../../assets/warning.svg';
import BulkDismissContainer from '../../../../common/BulkAction/BulkDismissContainer';

interface StorageTierTableProps {
    handleBulkAction: any;
    handleSingleAction?: any;
}

const StorageTierDismissTable = ({ handleBulkAction, handleSingleAction }: StorageTierTableProps) => {
    const dispatch = useDispatch();
    const { allmssqlHostAssessmentData, inventoryTableData, getDatabaseHosts } = useAppSelector(
        state => state.inventoryV2
    );

    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = useAppSelector(state => state.headers);
    const { selectedRowsForDismiss } = useAppSelector(state => state.databaseHome);
    const { inProgressOptimizationData, inProgressHostData } = useAppSelector(state => state.getWellOptimize);

    const tableData = useMemo(() => {
        let storageTierAssessmentData: any = [];
        let uniqueResourceList: Array<string> = [];
        allmssqlHostAssessmentData?.map((hostData: any) => {
            if (
                !headerSelectedMultiCredIdsList.includes(hostData?.credentialId) ||
                !headerSelectedMultiRegionIdsList.includes(hostData?.regionId) ||
                uniqueResourceList.includes(hostData?.databaseHostId)
            ) {
                return;
            }
            uniqueResourceList.push(hostData?.databaseHostId);

            hostData?.instancesAssessment?.map((instanceData: any, index: number) => {
                if (!instanceData?.error) {
                    const performanceTierObj = instanceData?.assessments?.storage?.sizing?.find(
                        (item: any) => item.name === 'performance-tier'
                    );
                    const isStorageTierOptimized = isOptimized(performanceTierObj?.status);
                    if (!isStorageTierOptimized) {
                        storageTierAssessmentData.push({
                            credentialId: hostData?.credentialId,
                            regionId: hostData?.regionId,
                            databaseHostId: hostData?.databaseHostId,
                            instanceId: instanceData?.databaseInstanceId,
                            serverInstanceName: instanceData?.databaseInstanceName,
                            performanceTier: performanceTierObj?.current,
                            totalObjectsAssessed: performanceTierObj?.totalObjectsAssessed,
                            totalObjectsInViolation: performanceTierObj?.totalObjectsInViolation,
                            id: hostData?.databaseHostId + '_' + instanceData?.databaseInstanceId,
                            hostName: hostData?.databaseHostName,
                            assessmentStatus: GETWELL_VALUES[performanceTierObj?.status],
                            data: instanceData,
                            configState:
                                index === 0 ? 'Active' : index === 1 ? 'Postponed until 10 April 2025' : 'Dismissed'
                        });
                    }
                }
            });
        });
        return mapHostStatusToAssessmentData(
            inventoryTableData,
            storageTierAssessmentData,
            getDatabaseHosts?.fullHostDataLoading || getDatabaseHosts?.databaseHostsLoading
        );
    }, [
        allmssqlHostAssessmentData,
        inventoryTableData,
        getDatabaseHosts,
        headerSelectedMultiCredIdsList,
        headerSelectedMultiRegionIdsList
    ]);

    // Update tableData when selection changes
    const updatedTableData = useMemo(() => {
        if (inProgressOptimizationData?.[ASSESSMENT_CONFIG_NAMES.STORAGE_TIER]?.length) {
            return disableOptimizeCheckBoxForOptimizeCase(
                tableData,
                ASSESSMENT_CONFIG_NAMES.STORAGE_TIER,
                selectedRowsForDismiss
            );
        } else {
            return disableOptimizeCheckBoxForErrCase(tableData, ASSESSMENT_CONFIG_NAMES.STORAGE_TIER);
        }
    }, [selectedRowsForDismiss, tableData, inProgressOptimizationData]);

    const setStatusIcon = (value: string) => {
        if (value === 'Active') {
            return <Success />;
        } else if (value.includes('Postponed')) {
            return <Warning />;
        } else {
            return <Warning />;
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
                            {cellData}
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
                            icon={BtnIcon}
                            variant="icon"
                            isDisabled={selectedRowsForDismiss.length > 0}
                            items={[
                                {
                                    id: 'activate',
                                    children: 'Activate',
                                    isDisabled: rowData?.configState === 'Active',
                                    onClick: () => {
                                        handleSingleAction(ASSESSMENT_CONFIG_NAMES.STORAGE_TIER, rowData, 'activate');
                                    }
                                },
                                {
                                    id: 'postponeFor30Days',
                                    children: 'Postpone for 30 days',
                                    isDisabled: rowData?.configState.includes('Postponed'),
                                    onClick: () => {
                                        handleSingleAction(
                                            ASSESSMENT_CONFIG_NAMES.STORAGE_TIER,
                                            rowData,
                                            'postponeFor30Days'
                                        );
                                    }
                                },
                                {
                                    id: 'dismiss',
                                    children: 'Dismiss',
                                    isDisabled: rowData?.configState === 'Dismissed',
                                    onClick: () => {
                                        handleSingleAction(ASSESSMENT_CONFIG_NAMES.STORAGE_TIER, rowData, 'dismiss');
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
        rows: updatedTableData || [],
        pageSize: 50,
        selectionType: 'multiple',
        defaultSelectedRows: []
    });

    useEffect(() => {
        const rowsData = getSelectedFromSelectionState(tableProps.selectionState, updatedTableData);

        dispatch(setSelectedRowsForDismiss(rowsData));

        if (rowsData.length > 0 && inProgressOptimizationData?.[ASSESSMENT_CONFIG_NAMES.STORAGE_TIER]?.length) {
            checkBoxHandle(tableProps.selectionState, rowsData, dispatch);
        }
    }, [tableProps.selectionState, inProgressOptimizationData]);

    const handleBulkOperation = (val: string) => {
        console.log(val);
        handleBulkAction(ASSESSMENT_CONFIG_NAMES.STORAGE_TIER, selectedRowsForDismiss);
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

export default StorageTierDismissTable;
