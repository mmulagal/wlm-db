import React from 'react';
import { TFunction } from 'i18next';
import { Dispatch } from '@reduxjs/toolkit';
import { NavigateFunction } from 'react-router-dom';
import { TooltipInfo } from '@netapp/design-system';
import { DsFlashingDotsLoader, DsTypography } from '@tlveng/wlm-ds';
import {
    DATABASE_DEPLOYMENT_MODE,
    DBType,
    DETECT_HOST_VAR,
    ERROR_ANALYZER_STATUS,
    INVENTORY_STATUS,
    INVENTORY_TABLE_STATUS,
    SQL_DEPLOYMENT_MODE,
    STORAGE_TYPES,
    WELL_ARCHITECTED_TABS,
    WLF_TABS
} from '../../../../utils/consts';
import {
    setFSXId,
    setGwPageLoadInstanceData,
    setLandingFrom,
    setSelectedWellArchitectTab
} from '../../../../store/workloadFactory/getWellOptimizeSlice';
import {
    resetWorkloadFactoryResourceData,
    setSelectedHostname,
    setSelectedResourcePageHostData
} from '../../../../store/workloadFactory/workloadFactoryResourceSlice';
import {
    addOfflineMssqlHostAssessmentData,
    setBreadCrumbSelectedFrom,
    setInventoryTableData,
    setOfflineMssqlHostAssessmentLoading,
    setRegisterHostType,
    setSelectedFilterValue,
    setSelectedHeaderTab,
    setSelectedInventoryTab,
    setWizardOperationType
} from '../../../../store/workloadFactory/inventoryV2Slice';
import { formatOfflineAssessmentToInventoryData } from '../../InventoryUtilsV2';
import store from '../../../../store/store';
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
    setNotActiveOracleDatabasesView,
    setNotActiveSQLInstancesView,
    setNotOptimizedOracleDatabaseView,
    setNotOptimizedSQLInstancesView,
    setNotRegisteredOracleDatabasesView,
    setNotRegisteredSQLView
} from '../../../../store/workloadFactory/inventorybannerSlice';
import { createSandboxNavigation, formatDateWithTime } from '../../../../utils/utilityFunctions';
import { ReactComponent as NotActiveNotificationIcon } from '../../../../assets/NotActiveNotificationIcon.svg';
import { ReactComponent as Bullet } from '../../../../assets/ic_bullet.svg';
import tooltipStyles from './InstanceTableHelper.module.scss';
import { resetEiData } from '../../../../store/workloadFactory/agenticAISlice';

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
                    id: 'pgsql-unManage',
                    displayName: 'Deregister'
                }
            ];
        case DBType.ORACLE:
            return [
                {
                    id: 'oracle-optimize',
                    displayName: t('databases.databases-table.oracle.menu-options.well-architected'),
                    disabled: disableOption,
                    infoText: disableMessage
                },
                {
                    id: 'oracle-investigateErrors',
                    displayName: t('databases.databases-table.oracle.menu-options.investigate-errors'),
                    disabled: !isBedRockAvailable || disableOption,
                    infoText: !isBedRockAvailable
                        ? t('databases.log-analyzer.bedrock-in-region-not-supported')
                        : disableMessage
                },
                {
                    id: 'oracle-viewDatabaseDashboard',
                    displayName: t('databases.databases-table.oracle.menu-options.manage-database'),
                    disabled: disableOption,
                    infoText: disableMessage,
                    subMenu: [
                        {
                            id: 'oracle-viewDatabaseDashboard',
                            displayName: t('databases.databases-table.oracle.menu-options.database-dashboard'),
                            disabled: disableOption,
                            infoText: disableMessage
                        }
                    ]
                },
                {
                    id: 'oracle-unManage',
                    displayName: t('databases.databases-table.oracle.menu-options.deregister')
                }
            ];
        case DBType.MSSQL:
            return [
                {
                    id: 'mssql-optimize',
                    displayName: t('databases.instance-table.menu-options.well-architected'),
                    disabled: disableOption,
                    infoText: disableMessage
                },
                {
                    id: 'mssql-investigateErrors',
                    displayName: t('databases.instance-table.menu-options.investigate-errors'),
                    disabled: !isBedRockAvailable || disableOption,
                    infoText: !isBedRockAvailable
                        ? t('databases.log-analyzer.bedrock-in-region-not-supported')
                        : disableMessage
                },
                {
                    id: 'mssql-viewInstance',
                    displayName: t('databases.instance-table.menu-options.manage-instance'),
                    disabled: disableOption,
                    infoText: disableMessage,
                    subMenu: [
                        {
                            id: 'mssql-viewInstance',
                            displayName: t('databases.instance-table.menu-options.instance-dashboard'),
                            disabled: disableOption,
                            infoText: disableMessage
                        },
                        {
                            id: 'mssql-viewDatabases',
                            displayName: t('databases.instance-table.menu-options.view-databases'),
                            disabled: disableOption,
                            infoText: disableMessage
                        },
                        {
                            id: 'mssql-createUserDb',
                            displayName: t('databases.instance-table.menu-options.create-database'),
                            disabled: disableOption || disableCreateDb,
                            infoText: disableMessage || disableCreateDbMsg
                        },
                        {
                            id: 'mssql-createSandbox',
                            displayName: t('databases.instance-table.menu-options.create-sandbox'),
                            disabled: disableOption,
                            infoText: disableMessage
                        }
                    ]
                },
                {
                    id: rowData?.isProtected ? 'mssql-editProtection' : 'mssql-protect',
                    displayName: rowData?.isProtected
                        ? t('databases.instance-table.menu-options.edit-protection')
                        : t('databases.instance-table.menu-options.protect'),
                    disabled: disableOption || !rowData?.fsxId || !rowData?.hostRow?.nodeIpAddress,
                    infoText: disableMessage
                },
                {
                    id: 'mssql-unManage',
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
    dispatch(setRegisterHostType(rowData.hostType));
    switch (rowData.hostType) {
        case DBType.MSSQL:
            switch (menuId) {
                case 'mssql-protect':
                    handleProtection(rowData);
                    break;
                case 'mssql-editProtection':
                    handleEditProtection(rowData);
                    break;
                case 'mssql-optimize':
                case 'mssql-investigateErrors':
                case 'mssql-viewInstance':
                    dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE));
                    dispatch(selectedTabSelection(WLF_TABS.OPTIMIZE));
                    dispatch(setBreadCrumbSelectedFrom(WLF_TABS.INVENTORY));
                    dispatch(setFSXId({ fsxId: rowData?.fsxId, ec2InstanceId: rowData?.ec2InstanceId }));
                    if (menuId === 'mssql-optimize') {
                        dispatch(setSelectedWellArchitectTab(WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS));
                    } else if (menuId === 'mssql-investigateErrors') {
                        dispatch(setSelectedWellArchitectTab(WELL_ARCHITECTED_TABS.ERROR_INVESTIGATION));
                    } else if (menuId === 'mssql-viewInstance') {
                        dispatch(setSelectedWellArchitectTab(WELL_ARCHITECTED_TABS.OVERVIEW));
                    }
                    optimizeAction(rowData);
                    break;
                case 'mssql-viewDatabases':
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
                case 'mssql-createUserDb':
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
                case 'mssql-createSandbox':
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
                    createSandboxNavigation(navigate);
                    break;
                case 'mssql-unManage':
                    handleDialog(rowData);
                    break;
                default:
                    break;
            }
            break;
        case DBType.ORACLE:
            switch (menuId) {
                case 'oracle-investigateErrors':
                    dispatch(setSelectedHeaderTab(WLF_TABS.ORACLE_WELL_ARCHITECTED));
                    dispatch(setBreadCrumbSelectedFrom(WLF_TABS.INVENTORY));
                    dispatch(setSelectedOracleInnerPageTab(WELL_ARCHITECTED_TABS.ERROR_INVESTIGATION));
                    dispatch(
                        setFSXId({
                            fsxId: rowData?.fsxId,
                            ec2InstanceId: rowData?.ec2InstanceId,
                            isInstanceStorageAsmManaged: rowData?.isInstanceStorageAsmManaged
                        })
                    );
                    optimizeAction(rowData);
                    break;
                case 'oracle-optimize':
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
                case 'oracle-unManage':
                    handleDialog(rowData);
                    break;
                case 'oracle-viewDatabaseDashboard':
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
            if (menuId === 'pgsql-unManage') {
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
            return {
                title: 'Databases',
                exportToCsvFileName: `DatabaseTable-${new Date(Date.now()).toLocaleString()}.csv`,
                buttonText: t('databases.register-flow.register-multiple-databases')
            };
        case DBType.POSTGRESQL:
            return {
                title: 'Instances',
                exportToCsvFileName: `InstanceTable-${new Date(Date.now()).toLocaleString()}.csv`,
                buttonText: t('databases.register-flow.register-multiple-instances')
            };
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
    notActiveOracleDatabasesView: boolean,
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
        } else if (notActiveOracleDatabasesView && selectedHostType === DBType.ORACLE) {
            // First reset all existing filters to match the original behavior
            tableProps.resetFilters();
            // Then apply the Not active filter (column '14' with value 'Not active')
            tableProps.updateFilterState({
                id: '17',
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
            // Reset the notActiveOracleDatabasesView flag
            dispatch(setNotActiveOracleDatabasesView(false));
        }
    }
};

export const logAnalyzerStatusCol = (styles: any, t: any, rowData: any, cellData: string) => {
    // If the computed display value is "Not active", show with tooltip
    if (cellData === ERROR_ANALYZER_STATUS.ACTIVE) {
        return (
            <div className={styles.naContainer}>
                <div>
                    <TooltipInfo className={styles['tooltip-icon']} trigger="hover">
                        <div className={styles.tooltipContent}>
                            <DsTypography variant="Regular_14">
                                {t('databases.log-analyzer.last-scan-date')}:{' '}
                                {formatDateWithTime(rowData?.logAnalyzer?.lastScan)}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.log-analyzer.detected-errors1')}:{' '}
                                {rowData?.logAnalyzer?.errorCount !== 0
                                    ? `${rowData?.logAnalyzer?.errorCount} ${t(
                                          'databases.log-analyzer.detected-errors2'
                                      )}`
                                    : t('databases.log-analyzer.no-errors')}
                            </DsTypography>
                        </div>
                    </TooltipInfo>
                </div>

                <DsTypography variant="Regular_14">{cellData}</DsTypography>
            </div>
        );
    }
    if (cellData === ERROR_ANALYZER_STATUS.NOT_ACTIVE) {
        return (
            <div className={styles.naContainer}>
                <NotActiveNotificationIcon />
                <DsTypography variant="Regular_14">{cellData}</DsTypography>
            </div>
        );
    }
    if (cellData === ERROR_ANALYZER_STATUS.RUNNING) {
        return (
            <div className={styles.naContainer}>
                <div>
                    <TooltipInfo className={styles['tooltip-icon']} trigger="hover">
                        <div className={styles.tooltipContent}>
                            <DsTypography variant="Regular_14">
                                {t('databases.log-analyzer.status-investigating')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.log-analyzer.running-status')}
                            </DsTypography>
                        </div>
                    </TooltipInfo>
                </div>

                <DsTypography variant="Regular_14">{ERROR_ANALYZER_STATUS.ACTIVE}</DsTypography>
            </div>
        );
    }
    if (!rowData?.logAnalyzer?.lastScan && rowData?.logAnalyzer?.loading) {
        return <DsFlashingDotsLoader />;
    }
    return (
        <div className={styles.statusCol}>
            <DsTypography variant="Regular_14">{cellData}</DsTypography>
        </div>
    );
};

/**
 * Result from isInstanceActionDisabled function
 */
export interface InstanceDisabledResult {
    isDisabled: boolean;
    disableMsg: string;
    tooltipWidth?: string;
    tooltipHeight?: string;
}

/**
 * Determines if an instance row should have its actions (menu/register/select) disabled
 *
 * Used by:
 * - disableMenu in manageColumnsProps (for menu/register button)
 * - isRowSelectableForBulkRegister (for bulk selection checkbox)
 * - getDisabledSelectionTooltip (for tooltip message)
 *
 * @param rowData - The instance row data
 * @param selectedHostType - Current database type filter (MSSQL, Oracle, PGSQL)
 * @param t - i18next translation function
 * @returns Object containing isDisabled flag and reason message
 */
export const isInstanceActionDisabled = (
    rowData: any,
    selectedHostType: string,
    t: TFunction
): InstanceDisabledResult => {
    // Already managed instances don't need to be disabled for existing actions
    // but they cannot be selected for bulk registration
    if (rowData?.statusColText === INVENTORY_STATUS.MANAGED) {
        return {
            isDisabled: false,
            disableMsg: ''
        };
    }

    // Check host offline status
    if (rowData?.status === INVENTORY_STATUS.OFFLINE) {
        return {
            isDisabled: true,
            disableMsg: t('databases.bulk-register.host-down'),
            tooltipWidth: '120px',
            tooltipHeight: '33px'
        };
    }

    // Check SSM status
    if (rowData?.ssmState === INVENTORY_STATUS.OFFLINE) {
        return {
            isDisabled: true,
            disableMsg: t('databases.bulk-register.ssm-down'),
            tooltipWidth: '250px',
            tooltipHeight: '50px'
        };
    }

    // Check instance running status
    if (rowData?.status?.toLowerCase() === INVENTORY_STATUS.DOWN) {
        return {
            isDisabled: true,
            disableMsg:
                selectedHostType === DBType.ORACLE
                    ? t('databases.register-flow.oracle-server-instance-down')
                    : t('databases.register-flow.sql-server-instance-down'),
            tooltipWidth: '220px',
            tooltipHeight: '33px'
        };
    }

    // Check detect option flags - only disable if detectOption is set AND has a disable message
    if (
        (rowData?.detectOption === DETECT_HOST_VAR.DISABLE || rowData?.detectOption === DETECT_HOST_VAR.HIDE) &&
        rowData?.detectOptionDisableMsg
    ) {
        return {
            isDisabled: true,
            disableMsg: rowData?.detectOptionDisableMsg,
            tooltipWidth: '250px',
            tooltipHeight: '33px'
        };
    }

    // Check FSx/ONTAP storage requirement for unmanaged instances
    if (
        rowData?.statusColText === INVENTORY_STATUS.UNMANAGED &&
        rowData?.fileSystemType !== STORAGE_TYPES.FSX_FOR_ONTAP &&
        !rowData?.fsxId
    ) {
        return {
            isDisabled: true,
            disableMsg:
                selectedHostType === DBType.ORACLE
                    ? t('databases.bulk-register.fsxn-manage-supported-oracle')
                    : t('databases.bulk-register.fsxn-manage-supported'),
            tooltipWidth: '340px',
            tooltipHeight: '50px'
        };
    }

    // Check AOAG deployment type for unmanaged instances
    if (
        rowData?.serverInstallationMode === DATABASE_DEPLOYMENT_MODE.AOAG &&
        rowData?.statusColText === INVENTORY_STATUS.UNMANAGED
    ) {
        return {
            isDisabled: true,
            disableMsg: t('databases.bulk-register.aoag-manage-disable'),
            tooltipWidth: '320px',
            tooltipHeight: '50px'
        };
    }

    // Check WAD (offline assessment) rows without credentials - cannot register without credentials
    if (rowData?.isWad && (!rowData?.credentialId || !rowData?.regionId)) {
        return {
            isDisabled: true,
            disableMsg: t('databases.wad.register-disabled-no-credentials'),
            tooltipWidth: '280px',
            tooltipHeight: '50px'
        };
    }

    return {
        isDisabled: false,
        disableMsg: ''
    };
};

/**
 * Check if a row has a valid deployment type for bulk registration.
 * For MSSQL: Only Standalone and FCI (Failover Cluster Instances) are allowed.
 * For Oracle: Standalone and Data Guard are allowed, but cannot be mixed.
 *
 * @param rowData - The instance row data
 * @param selectedHostType - Current database type filter
 * @returns Object with isValid flag and reason if invalid
 */
export const isValidDeploymentForBulk = (
    rowData: any,
    selectedHostType: string
): { isValid: boolean; reason?: string } => {
    const deploymentModel = rowData?.serverInstallationMode?.toLowerCase() || '';

    if (selectedHostType === DBType.MSSQL) {
        // AOAG is not supported for bulk registration
        const isAOAG =
            deploymentModel.includes(SQL_DEPLOYMENT_MODE.AOAG) ||
            rowData?.serverInstallationMode === DATABASE_DEPLOYMENT_MODE.AOAG ||
            rowData?.serverInstallationMode === 'AOAG' ||
            deploymentModel === 'aoag';
        if (isAOAG) {
            return { isValid: false, reason: 'aoag' };
        }
    }

    return { isValid: true };
};

/**
 * Check if an Oracle row is a Standalone deployment
 * @param rowData - The Oracle database row data
 * @returns true if the row is a Standalone deployment
 */
export const isOracleStandalone = (rowData: any): boolean => {
    const deploymentModel = rowData?.serverInstallationMode?.toLowerCase() || '';
    return deploymentModel === DATABASE_DEPLOYMENT_MODE.STANDALONE.toLowerCase();
};

/**
 * Check if an Oracle row is a Data Guard deployment
 * @param rowData - The Oracle database row data
 * @returns true if the row is a Data Guard deployment
 */
export const isOracleDataGuard = (rowData: any): boolean => {
    const deploymentModel = rowData?.serverInstallationMode?.toLowerCase() || '';
    return deploymentModel === DATABASE_DEPLOYMENT_MODE.DATAGUARD.toLowerCase();
};

/**
 * Check if an Oracle row is in the connectedInstances list of any selected Data Guard row
 * @param rowData - The row to check
 * @param selectedRows - Currently selected rows
 * @returns true if the row is connected to any selected Data Guard instance
 */
export const isOracleRowConnectedToSelected = (rowData: any, selectedRows: any[]): boolean => {
    if (!selectedRows || selectedRows.length === 0) return false;

    // Get all connectedInstances from selected Data Guard rows
    for (const selectedRow of selectedRows) {
        if (!isOracleDataGuard(selectedRow)) continue;

        const connectedInstances = selectedRow?.connectedInstances || [];
        // Check if rowData matches any connected instance
        const isConnected = connectedInstances.some(
            (connected: any) =>
                connected.databaseInstanceName === rowData.databaseInstanceName &&
                connected.credentialId === rowData.credentialId &&
                connected.regionId === rowData.regionId &&
                connected.ec2InstanceId === rowData.ec2InstanceId
        );
        if (isConnected) return true;
    }
    return false;
};

/**
 * Check if an Oracle row can be selected based on existing selections.
 * Rules:
 * - If any Standalone is selected, Data Guard rows should be disabled
 * - If any Data Guard is selected, only rows in connectedInstances of selected rows should be enabled
 *
 * @param rowData - The row to check for selection compatibility
 * @param selectedRows - Currently selected rows
 * @param t - i18next translation function
 * @returns Object with isSelectable flag and reason if not selectable
 */
export const getOracleSelectionCompatibility = (
    rowData: any,
    selectedRows: any[],
    t: TFunction
): { isSelectable: boolean; reason: string } => {
    // No selection yet - allow all
    if (!selectedRows || selectedRows.length === 0) {
        return { isSelectable: true, reason: '' };
    }

    // Check if any selected row is Standalone
    const hasStandaloneSelected = selectedRows.some(row => isOracleStandalone(row));
    // Check if any selected row is Data Guard
    const hasDataGuardSelected = selectedRows.some(row => isOracleDataGuard(row));

    const isRowStandalone = isOracleStandalone(rowData);
    const isRowDataGuard = isOracleDataGuard(rowData);

    // Rule 1: If any Standalone is selected, Data Guard rows should be disabled
    if (hasStandaloneSelected && isRowDataGuard) {
        return {
            isSelectable: false,
            reason: t('databases.bulk-register.dataguard-disabled-standalone-selected')
        };
    }

    // Rule 2: If any Data Guard is selected
    if (hasDataGuardSelected) {
        // Standalone rows should be disabled
        if (isRowStandalone) {
            return {
                isSelectable: false,
                reason: t('databases.bulk-register.standalone-disabled-dataguard-selected')
            };
        }

        // Data Guard rows: only allow if connected to a selected row
        if (isRowDataGuard) {
            // Check if this row is already selected (allow it to remain selected)
            const isAlreadySelected = selectedRows.some(
                (selected: any) =>
                    selected.databaseInstanceName === rowData.databaseInstanceName &&
                    selected.credentialId === rowData.credentialId &&
                    selected.regionId === rowData.regionId &&
                    selected.ec2InstanceId === rowData.ec2InstanceId
            );
            if (isAlreadySelected) {
                return { isSelectable: true, reason: '' };
            }

            // Check if this row is in connectedInstances of any selected row
            if (!isOracleRowConnectedToSelected(rowData, selectedRows)) {
                return {
                    isSelectable: false,
                    reason: t('databases.bulk-register.dataguard-not-connected')
                };
            }
        }
    }

    return { isSelectable: true, reason: '' };
};

/**
 * Check if an instance can be selected for bulk registration.
 * This should align with the Register button's enable/disable state from manageActionCol.
 *
 * @param rowData - The instance row data
 * @param selectedHostType - Current database type filter
 * @param t - i18next translation function
 * @param selectedRows - Optional: Currently selected rows (used for Oracle Standalone/Data Guard logic)
 * @returns true if the row can be selected for bulk registration
 */
export const isRowSelectableForBulkRegister = (
    rowData: any,
    selectedHostType: string,
    t: TFunction,
    selectedRows?: any[]
): boolean => {
    // Only allow bulk selection for MSSQL and Oracle
    if (selectedHostType !== DBType.MSSQL && selectedHostType !== DBType.ORACLE) return false;

    // Only unregistered instances can be selected (UNMANAGED or UNDETECTED)
    // This aligns with manageActionCol which shows "Register" for non-MANAGED status
    if (
        rowData?.statusColText !== INVENTORY_STATUS.UNMANAGED &&
        rowData?.statusColText !== INVENTORY_STATUS.UNDETECTED
    ) {
        return false;
    }

    // Check deployment type - only Standalone and FCI allowed for MSSQL
    const { isValid } = isValidDeploymentForBulk(rowData, selectedHostType);
    if (!isValid) return false;

    // Use the shared disable logic
    const { isDisabled } = isInstanceActionDisabled(rowData, selectedHostType, t);
    if (isDisabled) return false;

    // For Oracle: Apply Standalone/Data Guard selection compatibility rules
    if (selectedHostType === DBType.ORACLE && selectedRows && selectedRows.length > 0) {
        const { isSelectable } = getOracleSelectionCompatibility(rowData, selectedRows, t);
        if (!isSelectable) return false;
    }

    return true;
};

/**
 * Get tooltip message for disabled bulk selection checkbox.
 * Uses isInstanceActionDisabled as the base check plus additional bulk-specific messages.
 *
 * @param rowData - The instance row data
 * @param selectedHostType - Current database type filter
 * @param t - i18next translation function
 * @param selectedRows - Optional: Currently selected rows (used for Oracle Standalone/Data Guard logic)
 * @returns Tooltip message for why selection is disabled (string or JSX for AOAG/DataGuard)
 */
export const getDisabledSelectionTooltip = (
    rowData: any,
    selectedHostType: string,
    t: TFunction,
    selectedRows?: any[]
): string | React.ReactNode => {
    // Already managed - specific bulk registration message
    if (rowData?.statusColText === INVENTORY_STATUS.MANAGED) {
        return t('databases.bulk-register.already-registered');
    }

    // Check deployment type validity
    const { isValid, reason } = isValidDeploymentForBulk(rowData, selectedHostType);
    const deploymentModel = rowData?.serverInstallationMode?.toLowerCase() || '';
    const isAoag =
        deploymentModel.includes(SQL_DEPLOYMENT_MODE.AOAG) ||
        rowData?.serverInstallationMode === DATABASE_DEPLOYMENT_MODE.AOAG ||
        rowData?.serverInstallationMode === 'AOAG';
    // Check AOAG (specific bulk registration message with bullet points)
    if ((!isValid && reason === 'aoag') || isAoag) {
        return (
            <div className={tooltipStyles.aoagTooltip}>
                <div className={tooltipStyles.bulletList}>
                    <div className={tooltipStyles.bulletRow}>
                        <Bullet />
                        <DsTypography variant="Regular_13">
                            {t('databases.bulk-register.aoag-tooltip-bullet1')}
                        </DsTypography>
                    </div>
                    <div className={tooltipStyles.bulletRow}>
                        <Bullet />
                        <DsTypography variant="Regular_13">
                            {t('databases.bulk-register.aoag-tooltip-bullet2')}
                        </DsTypography>
                    </div>
                </div>
            </div>
        );
    }

    // For Oracle: Check Standalone/Data Guard selection compatibility
    if (selectedHostType === DBType.ORACLE && selectedRows && selectedRows.length > 0) {
        const { isSelectable, reason: oracleReason } = getOracleSelectionCompatibility(rowData, selectedRows, t);
        if (!isSelectable && oracleReason) {
            return oracleReason;
        }
    }

    // Use the shared disable logic for other cases
    const { disableMsg } = isInstanceActionDisabled(rowData, selectedHostType, t);
    return disableMsg;
};

/**
 * Maximum number of instances that can be selected for bulk registration
 */
export const MAX_BULK_REGISTER_SELECTION = 10;

/**
 * Checks if header checkbox should be enabled for bulk selection.
 * Conditions:
 * 1. Visible rows count must be <= 10
 * 2. ALL visible rows must be unregistered (UNMANAGED or UNDETECTED)
 * 3. ALL visible rows must be Standalone or FCI deployment (no AOAG)
 * 4. For Oracle: Visible rows must be compatible with already selected rows (Standalone/Data Guard rules)
 *
 * @param visibleRows - Array of currently visible/filtered rows
 * @param selectedHostType - Current database type filter
 * @param t - i18next translation function
 * @param selectedRows - Optional: Currently selected rows (used for Oracle Standalone/Data Guard logic)
 * @returns Object with isEnabled flag and reason if disabled
 */
export const shouldEnableHeaderCheckbox = (
    visibleRows: any[],
    selectedHostType: string,
    t: TFunction,
    selectedRows?: any[]
): { isEnabled: boolean; disableReason: string } => {
    // Only allow bulk selection for MSSQL and Oracle
    if (selectedHostType !== DBType.MSSQL && selectedHostType !== DBType.ORACLE) {
        return {
            isEnabled: false,
            disableReason: t('databases.bulk-register.not-supported-for-engine')
        };
    }

    // No rows to select
    if (!visibleRows || visibleRows.length === 0) {
        return {
            isEnabled: false,
            disableReason:
                selectedHostType === DBType.ORACLE
                    ? t('databases.bulk-register.select-header-disabled-oracle')
                    : t('databases.bulk-register.select-header-disabled')
        };
    }

    // For Oracle: When Data Guard row(s) are selected, enable bulk if only Data Guard rows are enabled
    if (selectedHostType === DBType.ORACLE && selectedRows && selectedRows.length > 0) {
        const hasDataGuardSelected = selectedRows.some(row => isOracleDataGuard(row));
        if (hasDataGuardSelected) {
            // When Data Guard is selected, check if there are any selectable Data Guard rows
            // (connected to the selected Data Guard instances)
            const selectableDataGuardRows = visibleRows.filter(row => {
                if (!isOracleDataGuard(row)) return false;
                const { isSelectable } = getOracleSelectionCompatibility(row, selectedRows, t);
                return isSelectable;
            });
            // Enable header checkbox if there are selectable Data Guard rows
            if (selectableDataGuardRows.length > 0 && selectableDataGuardRows.length < MAX_BULK_REGISTER_SELECTION) {
                return { isEnabled: true, disableReason: '' };
            }
        }
    }

    // For Oracle: Check if visible rows have mixed deployment types (Standalone and Data Guard)
    if (selectedHostType === DBType.ORACLE) {
        const hasStandalone = visibleRows.some(row => isOracleStandalone(row));
        const hasDataGuard = visibleRows.some(row => isOracleDataGuard(row));
        if (hasStandalone && hasDataGuard) {
            return {
                isEnabled: false,
                disableReason: t('databases.bulk-register.select-header-disabled-oracle')
            };
        }
    }

    // Check if visible rows exceed limit
    if (visibleRows.length > MAX_BULK_REGISTER_SELECTION) {
        return {
            isEnabled: false,
            disableReason: t('databases.bulk-register.too-many-visible-rows', { max: MAX_BULK_REGISTER_SELECTION })
        };
    }

    // Check if ANY visible row is already registered
    const hasRegisteredRows = visibleRows.some(
        row =>
            row?.statusColText === INVENTORY_STATUS.MANAGED ||
            row?.managementStatus === INVENTORY_STATUS.REGISTERED ||
            row?.managementStatus === INVENTORY_STATUS.IN_PROGRESS
    );
    if (hasRegisteredRows) {
        return {
            isEnabled: false,
            disableReason:
                selectedHostType === DBType.ORACLE
                    ? t('databases.bulk-register.select-header-disabled-oracle')
                    : t('databases.bulk-register.select-header-disabled')
        };
    }

    // Check if ANY visible row has unsupported deployment type (AOAG)
    const hasInvalidDeployment = visibleRows.some(row => {
        const { isValid } = isValidDeploymentForBulk(row, selectedHostType);
        return !isValid;
    });
    if (hasInvalidDeployment) {
        return {
            isEnabled: false,
            disableReason:
                selectedHostType === DBType.ORACLE
                    ? t('databases.bulk-register.select-header-disabled-oracle')
                    : t('databases.bulk-register.select-header-disabled')
        };
    }

    // Check if all rows are selectable (using existing logic with selected rows for Oracle)
    const selectableRows = visibleRows.filter(row =>
        isRowSelectableForBulkRegister(row, selectedHostType, t, selectedRows)
    );
    if (selectableRows.length === 0) {
        return {
            isEnabled: false,
            disableReason:
                selectedHostType === DBType.ORACLE
                    ? t('databases.bulk-register.select-header-disabled-oracle')
                    : t('databases.bulk-register.select-header-disabled')
        };
    }

    return { isEnabled: true, disableReason: '' };
};

/**
 * Refreshes the offline WAD assessment data after upload completes.
 * This function fetches all offline assessment data with pagination
 * and updates the inventory table data same as WADApis.tsx.
 *
 * @param getAllOfflineAssessmentAPI - The lazy query function from useLazyGetAllOfflineMssqlHostsAssessmentDataQuery
 * @param dispatch - Redux dispatch function
 * @param assessmentData - Accumulated assessment data from previous calls (for pagination)
 * @param nextToken - Pagination token for next batch of data
 */
export const refreshOfflineAssessmentData = async (
    getAllOfflineAssessmentAPI: any,
    dispatch: Dispatch,
    assessmentData: any[],
    nextToken: string | null
) => {
    try {
        dispatch(setOfflineMssqlHostAssessmentLoading(true));

        const result: any = await getAllOfflineAssessmentAPI({
            credentialId: null,
            regionId: null,
            nextToken
        });

        if (result && !result?.error && result?.data) {
            const newAssessmentData = [
                ...assessmentData,
                ...(Array.isArray(result?.data?.items)
                    ? result.data.items.map((assessment: any) => ({
                          ...assessment,
                          isWad: true // Mark as WAD (offline) data
                      }))
                    : [])
            ];

            if (result?.data?.nextToken) {
                // Continue fetching with pagination
                refreshOfflineAssessmentData(
                    getAllOfflineAssessmentAPI,
                    dispatch,
                    newAssessmentData,
                    result?.data?.nextToken
                );
            } else {
                // All data fetched, update store
                dispatch(setOfflineMssqlHostAssessmentLoading(false));
                dispatch(addOfflineMssqlHostAssessmentData(newAssessmentData));

                // Format and merge with existing inventory data
                const currentInventoryTableData = store.getState().inventoryV2.inventoryTableData || {};
                const formattedOfflineData = formatOfflineAssessmentToInventoryData(newAssessmentData);
                const mergedInventoryData = {
                    ...currentInventoryTableData,
                    ...formattedOfflineData
                };
                dispatch(setInventoryTableData(mergedInventoryData));
            }
        } else {
            dispatch(setOfflineMssqlHostAssessmentLoading(false));
            if (assessmentData.length > 0) {
                dispatch(addOfflineMssqlHostAssessmentData(assessmentData));

                // Format and merge with existing inventory data
                const currentInventoryTableData = store.getState().inventoryV2.inventoryTableData || {};
                const formattedOfflineData = formatOfflineAssessmentToInventoryData(assessmentData);
                const mergedInventoryData = {
                    ...currentInventoryTableData,
                    ...formattedOfflineData
                };
                dispatch(setInventoryTableData(mergedInventoryData));
            }
        }
    } catch (error) {
        dispatch(setOfflineMssqlHostAssessmentLoading(false));
        if (assessmentData.length > 0) {
            dispatch(addOfflineMssqlHostAssessmentData(assessmentData));
        }
    }
};

/**
 * Handler for WAD (offline assessment) optimize action.
 * Sets isWad flag and navigates to the Well-Architected page.
 * The offline assessment API is called in GetWellApi.tsx based on isWad flag.
 *
 * @param rowData - The instance row data
 * @param dispatch - Redux dispatch function
 */
export const handleWadOptimizeAction = (rowData: any, dispatch: Dispatch) => {
    // Get databaseHostId and instanceId from rowData
    const databaseHostId = rowData?.databaseHostId || rowData?.hostRow?.id || rowData?.hostRow?.resourceId;
    const instanceId = rowData?.databaseInstanceId;
    const credentialId = rowData?.credentialId || rowData?.hostRow?.credentialId;
    const regionId = rowData?.regionId || rowData?.hostRow?.regionId;

    // Navigate to Well-Architected page (same as mssql-optimize)
    dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE));
    dispatch(selectedTabSelection(WLF_TABS.OPTIMIZE));
    dispatch(setBreadCrumbSelectedFrom(WLF_TABS.INVENTORY));
    dispatch(setFSXId({ fsxId: rowData?.fsxId, ec2InstanceId: rowData?.ec2InstanceId }));
    dispatch(setSelectedWellArchitectTab(WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS));
    dispatch(setLandingFrom(WLF_TABS.INVENTORY));

    // Set page load instance data with isWad: true
    // GetWellApi.tsx will call the offline assessment API based on this flag
    dispatch(
        setGwPageLoadInstanceData({
            hostname: rowData?.name || rowData?.hostRow?.name,
            resourceId: databaseHostId,
            instanceId,
            instanceName: rowData?.databaseInstanceName,
            credId: credentialId,
            regionId,
            storageType: rowData?.sqlServerDeploymentType,
            isWad: true
        })
    );

    // For overview and database
    dispatch(resetWorkloadFactoryResourceData());
    dispatch(setSelectedHostname(rowData?.name || rowData?.hostRow?.name));
    dispatch(
        setSelectedResourcePageHostData({
            resourceId: databaseHostId,
            databaseInstanceId: instanceId,
            databaseInstanceName: rowData?.databaseInstanceName,
            credentialId,
            regionId
        })
    );
    dispatch(resetEiData({}));
};
