import { TFunction } from 'i18next';
import { Dispatch } from '@reduxjs/toolkit';
import { NavigateFunction } from 'react-router-dom';
import {
    DBType,
    ERROR_ANALYZER_STATUS,
    INVENTORY_STATUS,
    INVENTORY_TABLE_STATUS,
    WELL_ARCHITECTED_TABS,
    WLF_TABS
} from '../../../../utils/consts';
import { setFSXId, setSelectedWellArchitectTab } from '../../../../store/workloadFactory/getWellOptimizeSlice';
import {
    setBreadCrumbSelectedFrom,
    setSelectedFilterValue,
    setSelectedHeaderTab,
    setSelectedInventoryTab,
    setWizardOperationType
} from '../../../../store/workloadFactory/inventoryV2Slice';
import { selectedTabSelection } from '../../../../store/workloadFactory/databaseHomeSlice';
import { updateResourceId } from '../../../../store/authSlice';
import { setSelectedCsData, setSelectedSandboxHeaderValue } from '../../../../store/workloadFactory/createSandboxSlice';
import {
    addInitialDBCreateData,
    initialCreateNewUserState,
    setCdbPageData
} from '../../../../store/workloadFactory/createNewDBSlice';
import { setSelectedOracleInnerPageTab } from '../../../../store/workloadFactory/oracleSlice';
import {
    setNotActiveSQLInstancesView,
    setNotOptimizedOracleDatabaseView,
    setNotOptimizedSQLInstancesView,
    setNotRegisteredOracleDatabasesView,
    setNotRegisteredSQLView
} from '../../../../store/workloadFactory/inventorybannerSlice';

export interface InstanceMenuSelectionParams {
    menuId: string;
    rowData: any;
    dispatch: Dispatch;
    navigate: NavigateFunction;
    handleProtection: (rowData: any) => void;
    handleDialog: (rowData: any) => void;
    optimizeAction: (rowData: any) => void;
    handleEditProtection: (rowData: any) => void;
}

// Function to get menu options for instances table for MSSQL/PQSQL and database table for Oracle
export const getInstanceTableMenuOptions = (
    rowData: any,
    t: TFunction,
    disableOption: boolean,
    disableMessage: string,
    disableCreateDb: boolean,
    disableCreateDbMsg: string,
    isBedRockAvailable: boolean
) => {
    switch (rowData.hostType) {
        case DBType.POSTGRESQL:
            return [
                {
                    id: 'unManage',
                    displayName: 'Deregister'
                }
            ];
        case DBType.ORACLE:
            return [
                {
                    id: 'optimize',
                    displayName: t('databases.databases-table.oracle.menu-options.well-architected'),
                    disabled: disableOption,
                    infoText: disableMessage
                },
                {
                    id: 'viewDatabaseDashboard',
                    displayName: t('databases.databases-table.oracle.menu-options.manage-database'),
                    disabled: disableOption,
                    infoText: disableMessage,
                    subMenu: [
                        {
                            id: 'viewDatabaseDashboard',
                            displayName: t('databases.databases-table.oracle.menu-options.database-dashboard'),
                            disabled: disableOption,
                            infoText: disableMessage
                        }
                    ]
                },
                {
                    id: 'unManage',
                    displayName: t('databases.databases-table.oracle.menu-options.deregister')
                }
            ];
        case DBType.MSSQL:
            return [
                {
                    id: 'optimize',
                    displayName: t('databases.instance-table.menu-options.well-architected'),
                    disabled: disableOption,
                    infoText: disableMessage
                },
                {
                    id: 'investigateErrors',
                    displayName: t('databases.instance-table.menu-options.investigate-errors'),
                    disabled: !isBedRockAvailable || disableOption,
                    infoText: !isBedRockAvailable
                        ? t('databases.log-analyzer.bedrock-in-region-not-supported')
                        : disableMessage
                },
                {
                    id: 'viewInstance',
                    displayName: t('databases.instance-table.menu-options.manage-instance'),
                    disabled: disableOption,
                    infoText: disableMessage,
                    subMenu: [
                        {
                            id: 'viewInstance',
                            displayName: t('databases.instance-table.menu-options.instance-dashboard'),
                            disabled: disableOption,
                            infoText: disableMessage
                        },
                        {
                            id: 'viewDatabases',
                            displayName: t('databases.instance-table.menu-options.view-databases'),
                            disabled: disableOption,
                            infoText: disableMessage
                        },
                        {
                            id: 'createUserDb',
                            displayName: t('databases.instance-table.menu-options.create-database'),
                            disabled: disableOption || disableCreateDb,
                            infoText: disableMessage || disableCreateDbMsg
                        },
                        {
                            id: 'createSandbox',
                            displayName: t('databases.instance-table.menu-options.create-sandbox'),
                            disabled: disableOption,
                            infoText: disableMessage
                        }
                    ]
                },
                {
                    id: rowData?.isProtected ? 'editProtection' : 'protect',
                    displayName: rowData?.isProtected
                        ? t('databases.instance-table.menu-options.edit-protection')
                        : t('databases.instance-table.menu-options.protect'),
                    disabled: disableOption || !rowData?.fsxId || !rowData?.hostRow?.nodeIpAddress,
                    infoText: disableMessage
                },
                {
                    id: 'unManage',
                    displayName: t('databases.instance-table.menu-options.deregister')
                }
            ];
        default:
            return [];
    }
};

// Function to handle menu actions for instances table for MSSQL/PQSQL and database table for Oracle
export const handleInstanceMenuSelection = ({
    menuId,
    rowData,
    dispatch,
    navigate,
    handleProtection,
    handleDialog,
    optimizeAction,
    handleEditProtection
}: InstanceMenuSelectionParams) => {
    // resetting wizard operation type to single once out of bulk
    dispatch(setWizardOperationType('single'));
    switch (rowData.hostType) {
        case DBType.MSSQL:
            switch (menuId) {
                case 'protect':
                    handleProtection(rowData);
                    break;
                case 'editProtection':
                    handleEditProtection(rowData);
                    break;
                case 'optimize':
                case 'investigateErrors':
                case 'viewInstance':
                    dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE));
                    dispatch(selectedTabSelection(WLF_TABS.OPTIMIZE));
                    dispatch(setBreadCrumbSelectedFrom(WLF_TABS.INVENTORY));
                    dispatch(setFSXId({ fsxId: rowData?.fsxId, ec2InstanceId: rowData?.ec2InstanceId }));
                    if (menuId === 'optimize') {
                        dispatch(setSelectedWellArchitectTab(WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS));
                    } else if (menuId === 'investigateErrors') {
                        dispatch(setSelectedWellArchitectTab(WELL_ARCHITECTED_TABS.ERROR_INVESTIGATION));
                    } else if (menuId === 'viewInstance') {
                        dispatch(setSelectedWellArchitectTab(WELL_ARCHITECTED_TABS.OVERVIEW));
                    }
                    optimizeAction(rowData);
                    break;
                case 'viewDatabases':
                    dispatch(setSelectedInventoryTab('Databases'));
                    dispatch(
                        setSelectedFilterValue({
                            flag: true,
                            value: {
                                hostName: rowData?.name,
                                instanceName: rowData?.databaseInstanceName,
                                credentialName: rowData?.credentialName,
                                regionName: rowData?.regionName
                            },
                            filterType: 'multi'
                        })
                    );
                    break;
                case 'createUserDb':
                    dispatch(addInitialDBCreateData(initialCreateNewUserState));
                    dispatch(updateResourceId(rowData?.resourceId));
                    dispatch(
                        setCdbPageData({
                            dbHostName: rowData?.name,
                            instanceId: rowData?.databaseInstanceId,
                            instanceName: rowData?.databaseInstanceName,
                            cdbCredId: rowData?.credentialId,
                            cdbRegionId: rowData?.regionId
                        })
                    );
                    navigate('../create-new-user');
                    break;
                case 'createSandbox':
                    dispatch(
                        setSelectedSandboxHeaderValue({
                            credId: rowData?.credentialId,
                            regionId: rowData?.regionId
                        })
                    );
                    dispatch(
                        setSelectedCsData({
                            host: rowData?.name,
                            instance: rowData?.databaseInstanceName,
                            database: null
                        })
                    );
                    navigate('../create-new-sandbox');
                    break;
                case 'unManage':
                    handleDialog(rowData);
                    break;
                default:
                    break;
            }
            break;
        case DBType.ORACLE:
            switch (menuId) {
                case 'optimize':
                    dispatch(setSelectedHeaderTab(WLF_TABS.ORACLE_WELL_ARCHITECTED));
                    dispatch(setSelectedOracleInnerPageTab(WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS));
                    dispatch(setBreadCrumbSelectedFrom(WLF_TABS.INVENTORY));
                    dispatch(
                        setFSXId({
                            fsxId: rowData?.fsxId,
                            ec2InstanceId: rowData?.ec2InstanceId,
                            isInstanceStorageAsmManaged: rowData?.isInstanceStorageAsmManaged
                        })
                    );
                    optimizeAction(rowData);
                    break;
                case 'unManage':
                    handleDialog(rowData);
                    break;
                case 'viewDatabaseDashboard':
                    dispatch(setSelectedHeaderTab(WLF_TABS.ORACLE_WELL_ARCHITECTED));
                    dispatch(setSelectedOracleInnerPageTab(WELL_ARCHITECTED_TABS.OVERVIEW));
                    dispatch(setBreadCrumbSelectedFrom(WLF_TABS.INVENTORY));
                    dispatch(
                        setFSXId({
                            fsxId: rowData?.fsxId,
                            ec2InstanceId: rowData?.ec2InstanceId,
                            isInstanceStorageAsmManaged: rowData?.isInstanceStorageAsmManaged
                        })
                    );
                    optimizeAction(rowData);
                    break;
                default:
                    break;
            }
            break;
        case DBType.POSTGRESQL:
            if (menuId === 'unManage') {
                handleDialog(rowData);
            }
            break;
        default:
            break;
    }
};

export const getInstableTableTopMenuOptions = (
    engineType: string,
    t: TFunction
): { title: string; exportToCsvFileName: string; buttonText: string } => {
    switch (engineType) {
        case DBType.MSSQL:
            return {
                title: 'Instances',
                exportToCsvFileName: `InstanceTable-${new Date(Date.now()).toLocaleString()}.csv`,
                buttonText: t('databases.register-flow.register-multiple-instances')
            };
        case DBType.ORACLE:
        default:
            return {
                title: 'Databases',
                exportToCsvFileName: `DatabaseTable-${new Date(Date.now()).toLocaleString()}.csv`,
                buttonText: t('databases.register-flow.register-multiple-databases')
            };
    }
};

export const inventoryBannerFilterUpdates = (
    tableProps: any,
    notRegisteredSQLView: boolean,
    notActiveSQLInstancesView: boolean,
    notOptimizedSQLInstancesView: boolean,
    notRegisteredOracleDatabasesView: boolean,
    notOptimizedOracleDatabaseView: boolean,
    updatedTableData: any,
    selectedHostType: string,
    dispatch: any
) => {
    if (tableProps.updateFilterState && tableProps.resetFilters) {
        if (notRegisteredSQLView && selectedHostType === DBType.MSSQL) {
            // First reset all existing filters to match the original behavior
            tableProps.resetFilters();
            // Then apply the Not registered filter (column '4' with value 'Not registered')
            tableProps.updateFilterState({
                id: '4',
                values: {
                    [INVENTORY_STATUS.NOT_REGISTERED]: true
                }
            });
            // Reset the notRegisteredSQLView flag
            dispatch(setNotRegisteredSQLView(false));
        } else if (notActiveSQLInstancesView && selectedHostType === DBType.MSSQL) {
            // First reset all existing filters to match the original behavior
            tableProps.resetFilters();
            // Then apply the Not active filter (column '14' with value 'Not active')
            tableProps.updateFilterState({
                id: '14',
                values: {
                    [ERROR_ANALYZER_STATUS.NOT_ACTIVE]: true
                }
            });
            tableProps.updateFilterState({
                id: '4',
                values: {
                    [INVENTORY_STATUS.REGISTERED]: true
                }
            });
            // Reset the notActiveSQLInstancesView flag
            dispatch(setNotActiveSQLInstancesView(false));
        } else if (notOptimizedSQLInstancesView && selectedHostType === DBType.MSSQL) {
            // First reset all existing filters to match the original behavior
            tableProps.resetFilters();
            // Then apply the Not optimized filter (column '3' with values containing 'issue')
            // Get all unique values from the table data that contain "issue" or "issues"
            const optimizationIssueValues: { [key: string]: boolean } = {};
            updatedTableData?.forEach((row: any) => {
                const optimizationValue = row.optimizationStatus;
                if (
                    optimizationValue &&
                    (optimizationValue.toLowerCase().includes('issue') ||
                        optimizationValue.toLowerCase().includes('recommendation') ||
                        optimizationValue.includes(INVENTORY_TABLE_STATUS.NOT_ANALYZED))
                ) {
                    optimizationIssueValues[optimizationValue] = true;
                }
            });

            tableProps.updateFilterState({
                id: '3',
                values: optimizationIssueValues
            });
            tableProps.updateFilterState({
                id: '4',
                values: {
                    [INVENTORY_STATUS.REGISTERED]: true
                }
            });
            // Reset the notOptimizedSQLInstancesView flag
            dispatch(setNotOptimizedSQLInstancesView(false));
        } else if (notRegisteredOracleDatabasesView && selectedHostType === DBType.ORACLE) {
            // First reset all existing filters to match the original behavior
            tableProps.resetFilters();
            // Then apply the Not registered filter for Oracle (column '4' with value 'Not registered')
            tableProps.updateFilterState({
                id: '4',
                values: {
                    [INVENTORY_STATUS.NOT_REGISTERED]: true
                }
            });
            // Reset the notRegisteredOracleDatabasesView flag
            dispatch(setNotRegisteredOracleDatabasesView(false));
        } else if (notOptimizedOracleDatabaseView && selectedHostType === DBType.ORACLE) {
            // First reset all existing filters to match the original behavior
            tableProps.resetFilters();
            // Then apply the Not optimized filter (column '3' with values containing 'issue')
            // Get all unique values from the table data that contain "issue" or "issues"
            const optimizationIssueValues: { [key: string]: boolean } = {};
            updatedTableData?.forEach((row: any) => {
                const optimizationValue = row.optimizationStatus;
                if (
                    optimizationValue &&
                    (optimizationValue.toLowerCase().includes('issue') ||
                        optimizationValue.toLowerCase().includes('recommendation') ||
                        optimizationValue.includes(INVENTORY_TABLE_STATUS.NOT_ANALYZED))
                ) {
                    optimizationIssueValues[optimizationValue] = true;
                }
            });
            // Then apply the Not optimized filter for Oracle (column '3' with values containing 'issue')
            tableProps.updateFilterState({
                id: '5',
                values: optimizationIssueValues
            });
            // Then apply the Not registered filter for Oracle (column '4' with value 'Not registered')
            tableProps.updateFilterState({
                id: '4',
                values: {
                    [INVENTORY_STATUS.REGISTERED]: true
                }
            });
            // Reset the notRegisteredOracleDatabasesView flag
            dispatch(setNotOptimizedOracleDatabaseView(false));
        }
    }
};
