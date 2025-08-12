import { TFunction } from 'i18next';
import { Dispatch } from '@reduxjs/toolkit';
import { NavigateFunction } from 'react-router-dom';
import { DBType, WELL_ARCHITECTED_TABS, WLF_TABS } from '../../../../utils/consts';
import { setFSXId, setSelectedWellArchitectTab } from '../../../../store/workloadFactory/getWellOptimizeSlice';
import {
    setBreadCrumbSelectedFrom,
    setSelectedFilterValue,
    setSelectedHeaderTab,
    setSelectedInventoryTab
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

export interface InstanceMenuSelectionParams {
    menuId: string;
    rowData: any;
    dispatch: Dispatch;
    navigate: NavigateFunction;
    handleProtection: (rowData: any) => void;
    handleDialog: (rowData: any) => void;
    optimizeAction: (rowData: any) => void;
}

// Function to get menu options for instances table for MSSQL/PQSQL and database table for Oracle
export const getInstanceTableMenuOptions = (
    rowData: any,
    t: TFunction,
    disableOption: boolean,
    disableMessage: string,
    disableCreateDb: boolean,
    disableCreateDbMsg: string
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
                    disabled: disableOption,
                    infoText: disableMessage
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
                    id: 'protect',
                    displayName: t('databases.instance-table.menu-options.protect'),
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
    optimizeAction
}: InstanceMenuSelectionParams) => {
    switch (rowData.hostType) {
        case DBType.MSSQL:
            switch (menuId) {
                case 'protect':
                    handleProtection(rowData);
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
                    dispatch(setFSXId({ fsxId: rowData?.fsxId, ec2InstanceId: rowData?.ec2InstanceId }));
                    optimizeAction(rowData);
                    break;
                case 'unManage':
                    handleDialog(rowData);
                    break;
                case 'viewDatabaseDashboard':
                    dispatch(setSelectedHeaderTab(WLF_TABS.ORACLE_WELL_ARCHITECTED));
                    dispatch(setSelectedOracleInnerPageTab(WELL_ARCHITECTED_TABS.OVERVIEW));
                    dispatch(setBreadCrumbSelectedFrom(WLF_TABS.INVENTORY));
                    dispatch(setFSXId({ fsxId: rowData?.fsxId, ec2InstanceId: rowData?.ec2InstanceId }));
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
