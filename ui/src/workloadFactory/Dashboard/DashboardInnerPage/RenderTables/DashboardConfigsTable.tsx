import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { DsToggleSwitch } from '@tlveng/wlm-ds';
import { Button, DsTypography, useDialog } from '@netapp/design-system';
import { TFunction } from 'i18next';
import styles from './RenderTables.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { ReactComponent as NotActive } from '../../../../assets/ic_not_active.svg';
import { ReactComponent as Optimized } from '../../../../assets/optimized.svg';
import { ReactComponent as UnderProvisioned } from '../../../../assets/under-provisioned.svg';
import { ReactComponent as InProgress } from '../../../../assets/In Progress.svg';
import {
    filterDatabaseRowsForNonAsm,
    mapHostStatusToAssessmentData
} from '../../../DatabaseHomePage/DatabaseHomeUtils';
import { checkBoxHandle, getSelectedFromSelectionState } from '../../../../utils/utilityFunctions';
import { setSelectedRowsForOptimize } from '../../../../store/workloadFactory/databaseHomeSlice';
import {
    ASSESSMENT_CONFIG_NAMES,
    CONFIG_STATE_ACTIONS,
    CONFIG_STATES,
    DBType,
    FSXN_STORAGE_PROTOCOLS,
    GETWELL_STATUS,
    GETWELL_VALUES
} from '../../../../utils/consts';
import {
    disableOptimizeCheckBoxForErrCase,
    disableOptimizeCheckBoxForOptimizeCase,
    isConfigSkippedForAoag,
    isWadExcludedConfig
} from '../../../GetWell/GetWellUtils';
import { initialDashboardInnerPageOptimizeColState } from '../../../../utils/manageColumnUtils';
import { useTable } from '../../../../common/Lib/Table/useTable';
import { TableTopBar } from '../../../../common/Lib/Table/TableTopBar';
import { Table } from '../../../../common/Lib/Table/Table';
import { ButtonWithDropdown } from '../../../../common/ButtonWithDropdown/ButtonWithDropdown';
import FirstColumnComponent from './FirstColumnComponent';
import BulkCombineActionController from '../../../../common/BulkAction/BulkCombineActionController';
import { GwSqlServerInstanceInterface, RSSConfigAdapterInterface } from '../../../../utils/types/getWellTypes';
import {
    bulkDismissPostponeDisableCheck,
    bulkFixDisableCheck,
    sortOptimizeDashboardInnerTable
} from '../DashboardInnerPageHelper';
import { engineTypeBasedResourceStr } from '../../../WellArchitectedTab/WellArchitectedTabUtils';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import TooltipComponent from '../../../../common/TooltipComponent/TooltipComponent';
import ImpactedResourceDialog from './ImpactedResourceDialog/ImpactedResourceDialog';
import { GENERAL } from '../../../../utils/appConstants';

interface ConfigTableRowData {
    totalObjectsAssessed?: number;
    totalObjectsInViolation?: number;
    configState?: string;
    configurationName?: string;
    name?: string;
    [key: string]: any;
}

type HandleImpactedResourceDialog = (rowData: ConfigTableRowData) => void;

interface DashboardConfigsTableProps {
    configType: string;
    lastColDetails: any;
    handleBulkAction: any;
    handleSingleDismissPostpone: any;
    handleBulkDismissPostpone: any;
}

/**
 * DashConfigsTable - Unified table component for dashboard configurations
 *
 * This component consolidates all dashboard table configurations into a single, reusable component.
 * It eliminates code duplication and provides a consistent interface for all assessment configurations.
 *
 * How to add a new configuration:
 * 1. Add a new entry to CONFIG_MAPPING with:
 *    - assessmentPath: Array path to the assessment data (e.g., ['storage', 'sizing'])
 *    - configName: Name of the configuration in assessments
 *    - dismissConfigName: Name used in dismissedConfigurations
 *    - isFixSupported: Boolean flag to indicate if fix functionality is supported (default: true)
 *    - dataMapping: Function to extract specific data fields
 *    - customColumns: Array of column definitions specific to this config
 *
 * 2. Update DashboardInnerPage renderTable() to use DashConfigsTable for the new config
 *
 * 3. Add translation keys for any new column headers
 *
 * Example:
 * [ASSESSMENT_CONFIG_NAMES.NEW_CONFIG]: {
 *   assessmentPath: ['category', 'subcategory'],
 *   configName: 'config-name',
 *   dismissConfigName: 'config-name',
 *   isFixSupported: true, // Set to false to show "Coming Soon" and disable fix button
 *   dataMapping: (obj, instanceData) => ({
 *     customField: obj?.value
 *   }),
 *   customColumns: [{
 *     Header: 'translation.key',
 *     accessor: 'customField',
 *     id: '4',
 *     width: '200px'
 *   }]
 * }
 */

const renderCountWithView = (
    configNameOverride: string,
    cellData: string,
    rowData: ConfigTableRowData,
    t: TFunction,
    handleImpactedResourceDialog: HandleImpactedResourceDialog
) => {
    const count = Number(cellData) || 0;
    return (
        <div className={CommonStyles.impactedDrivesCell}>
            {cellData != null && String(cellData) !== ''
                ? cellData
                : t('databases.general.not-available-table-columns')}
            {count > 0 && (
                <Button
                    variant="text"
                    onClick={() =>
                        handleImpactedResourceDialog({
                            ...rowData,
                            configurationName: configNameOverride
                        })
                    }
                >
                    {t('databases.dashboard.view')}
                </Button>
            )}
        </div>
    );
};

// Configuration mapping for different assessment types
const CONFIG_MAPPING: Record<string, any> = {
    [ASSESSMENT_CONFIG_NAMES.STORAGE_TIER]: {
        assessmentPath: ['storage', 'sizing'],
        configName: 'performance-tier',
        dismissConfigName: 'performance-tier',
        isFixSupported: true,
        dataMapping: (obj: any) => ({
            current: obj?.current,
            totalObjectsAssessed: obj?.totalObjectsAssessed,
            totalObjectsInViolation: obj?.totalObjectsInViolation,
            violationDetails: obj?.violationDetails || [],
            configurationName: 'performance-tier'
        }),
        customColumns: [
            {
                Header: 'databases.well-architect.dashboard-table-headers.impacted-volumes',
                accessor: 'totalObjectsInViolation',
                id: '4',
                width: '220px',
                renderCell: (
                    cellData: string,
                    rowData: ConfigTableRowData,
                    t: TFunction,
                    handleImpactedResourceDialog: HandleImpactedResourceDialog
                ) => (
                    <div className={CommonStyles.impactedDrivesCell}>
                        {rowData?.totalObjectsInViolation || 0} out of {rowData?.totalObjectsAssessed || 0}
                        {(rowData?.totalObjectsInViolation ?? 0) > 0 && (
                            <Button variant="text" onClick={() => handleImpactedResourceDialog(rowData)}>
                                {t('databases.dashboard.view')}
                            </Button>
                        )}
                    </div>
                )
            }
        ]
    },
    [ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM]: {
        assessmentPath: ['storage', 'sizing'],
        configName: 'headroom',
        dismissConfigName: 'headroom',
        isFixSupported: true,
        dataMapping: (obj: any) => ({
            fileSystemHeadroom: obj?.current,
            totalObjectsAssessed: obj?.totalObjectsAssessed,
            totalObjectsInViolation: obj?.totalObjectsInViolation
        }),
        customColumns: [
            {
                Header: 'databases.well-architect.dashboard-table-headers.file-system-headroom',
                accessor: 'fileSystemHeadroom',
                id: '4',
                width: '200px',
                renderCell: (cellData: string, rowData: ConfigTableRowData, t: TFunction) =>
                    cellData || t('databases.general.not-available-table-columns')
            }
        ]
    },
    [ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE]: {
        assessmentPath: ['storage', 'sizing'],
        configName: 'log-drive-size',
        dismissConfigName: 'log-drive-size',
        isFixSupported: true,
        dataMapping: (obj: any) => ({
            percentDataDriveSize: obj?.current,
            totalObjectsAssessed: obj?.totalObjectsAssessed,
            totalObjectsInViolation: obj?.totalObjectsInViolation,
            sizingViolations: obj?.sizingViolations || {},
            configurationName: 'log-drive-size'
        }),
        customColumns: [
            {
                Header: 'databases.well-architect.dashboard-table-headers.impacted-drives',
                accessor: 'totalObjectsInViolation',
                id: '4',
                width: '200px',
                renderCell: (
                    cellData: string,
                    rowData: ConfigTableRowData,
                    t: TFunction,
                    handleImpactedResourceDialog: HandleImpactedResourceDialog
                ) => (
                    <div className={CommonStyles.impactedDrivesCell}>
                        {rowData?.totalObjectsInViolation || 0} out of {rowData?.totalObjectsAssessed || 0}
                        {(rowData?.totalObjectsInViolation ?? 0) > 0 && (
                            <Button variant="text" onClick={() => handleImpactedResourceDialog(rowData)}>
                                {t('databases.dashboard.view')}
                            </Button>
                        )}
                    </div>
                )
            }
        ]
    },
    [ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE]: {
        assessmentPath: ['storage', 'sizing'],
        configName: 'tempdb-drive-size',
        dismissConfigName: 'tempdb-drive-size',
        isFixSupported: true,
        dataMapping: (obj: any) => ({
            percentDataDriveSize: obj?.current,
            totalObjectsAssessed: obj?.totalObjectsAssessed,
            totalObjectsInViolation: obj?.totalObjectsInViolation
        }),
        customColumns: [
            {
                Header: 'databases.well-architect.dashboard-table-headers.percentage-of-data-drive-size',
                accessor: 'percentDataDriveSize',
                id: '4',
                width: '200px',
                renderCell: (cellData: string, rowData: ConfigTableRowData, t: TFunction) =>
                    cellData || t('databases.general.not-available-table-columns')
            }
        ]
    },
    [ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF]: {
        assessmentPath: ['storage', 'layout'],
        configName: 'data-files-location',
        dismissConfigName: 'data-files-location',
        dataMapping: (obj: any) => ({
            userDataFiles: obj?.current,
            totalObjectsAssessed: obj?.totalObjectsAssessed,
            totalObjectsInViolation: obj?.totalObjectsInViolation,
            objectsInViolation: obj?.objectsInViolation || [],
            configurationName: 'data-files-location'
        }),
        isFixSupported: false, // Fix is not supported for OS patch configurations
        customColumns: [
            {
                Header: 'databases.well-architect.dashboard-table-headers.impacted-databases',
                accessor: 'totalObjectsInViolation',
                id: '4',
                width: '200px',
                renderCell: (
                    cellData: string,
                    rowData: ConfigTableRowData,
                    t: TFunction,
                    handleImpactedResourceDialog: HandleImpactedResourceDialog
                ) => (
                    <div className={CommonStyles.impactedDrivesCell}>
                        {rowData?.totalObjectsInViolation || 0} out of {rowData?.totalObjectsAssessed || 0}
                        {(rowData?.totalObjectsInViolation ?? 0) > 0 && (
                            <Button variant="text" onClick={() => handleImpactedResourceDialog(rowData)}>
                                {t('databases.dashboard.view')}
                            </Button>
                        )}
                    </div>
                )
            }
        ]
    },
    [ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF]: {
        assessmentPath: ['storage', 'layout'],
        configName: 'log-files-location',
        dismissConfigName: 'log-files-location',
        dataMapping: (obj: any) => ({
            userDataFiles: obj?.current,
            totalObjectsAssessed: obj?.totalObjectsAssessed,
            totalObjectsInViolation: obj?.totalObjectsInViolation,
            objectsInViolation: obj?.objectsInViolation || [],
            configurationName: 'log-files-location'
        }),
        isFixSupported: false, // Fix is not supported for OS patch configurations
        customColumns: [
            {
                Header: 'databases.well-architect.dashboard-table-headers.impacted-databases',
                accessor: 'totalObjectsInViolation',
                id: '4',
                width: '200px',
                renderCell: (
                    cellData: string,
                    rowData: ConfigTableRowData,
                    t: TFunction,
                    handleImpactedResourceDialog: HandleImpactedResourceDialog
                ) => (
                    <div className={CommonStyles.impactedDrivesCell}>
                        {rowData?.totalObjectsInViolation || 0} out of {rowData?.totalObjectsAssessed || 0}
                        {(rowData?.totalObjectsInViolation ?? 0) > 0 && (
                            <Button variant="text" onClick={() => handleImpactedResourceDialog(rowData)}>
                                {t('databases.dashboard.view')}
                            </Button>
                        )}
                    </div>
                )
            }
        ]
    },
    [ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT]: {
        assessmentPath: ['storage', 'layout'],
        configName: 'tempdb-files-location',
        dismissConfigName: 'tempdb-files-location',
        dataMapping: (obj: any) => ({
            tempDBPlacement: obj?.current,
            totalObjectsAssessed: obj?.totalObjectsAssessed,
            totalObjectsInViolation: obj?.totalObjectsInViolation
        }),
        isFixSupported: false, // Fix is not supported for OS patch configurations
        customColumns: [
            {
                Header: 'databases.well-architect.dashboard-table-headers.tempdb-placement',
                accessor: 'tempDBPlacement',
                id: '4',
                width: '200px',
                renderCell: (cellData: string, rowData: ConfigTableRowData, t: TFunction) =>
                    cellData || t('databases.general.not-available-table-columns')
            }
        ]
    },
    [ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING]: {
        assessmentPath: [], // Empty array means direct access to instanceData?.assessments?.compute
        configName: 'compute', // Direct property name
        dismissConfigName: 'compute', // Direct property name
        dataMapping: (obj: any) => ({
            findingReasons: `${obj?.objectsInViolation?.length || 0} Findings`,
            recommendationOptions: obj?.recommendationOptions,
            isMissingPermissions: obj?.errorMessage?.includes('is not authorized to perform: ') || false
        }),
        isFixSupported: true,
        customColumns: [
            {
                Header: 'databases.well-architect.dashboard-table-headers.finding-reasons',
                accessor: 'findingReasons',
                id: '4',
                width: '200px',
                renderCell: (cellData: string, rowData: ConfigTableRowData, t: TFunction) =>
                    cellData || t('databases.general.not-available-table-columns')
            }
        ]
    },
    [ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH]: {
        assessmentPath: [], // Empty array means direct access to instanceData?.assessments?.hostOsPatch
        configName: 'hostOsPatch', // Direct property name
        dismissConfigName: 'hostOsPatch', // Direct property name
        isFixSupported: false, // Fix is not supported for OS patch configurations
        dataMapping: (obj: any) => ({
            current: `${obj?.objectsInViolation?.length || 0}`,
            missingPatchList: obj?.ec2InstancesToPatch || []
        }),
        customColumns: [
            {
                Header: 'databases.well-architect.dashboard-table-headers.missing-patches',
                accessor: 'current',
                id: '4',
                width: '200px',
                renderCell: (
                    cellData: string,
                    rowData: ConfigTableRowData,
                    t: TFunction,
                    handleImpactedResourceDialog: HandleImpactedResourceDialog
                ) =>
                    renderCountWithView(
                        ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH,
                        cellData,
                        rowData,
                        t,
                        handleImpactedResourceDialog
                    )
            }
        ]
    },
    [ASSESSMENT_CONFIG_NAMES.RSS_CONFIGURATION]: {
        assessmentPath: [], // Empty array means direct access to instanceData?.assessments?.rssConfig
        configName: 'rssConfig', // Direct property name
        dismissConfigName: 'rssConfig', // Direct property name
        dataMapping: (obj: any) => {
            let nonOptimizedAdapters = 0;
            obj?.rssAdapters?.map((adapter: RSSConfigAdapterInterface) => {
                if (!adapter?.rssEnabled) {
                    nonOptimizedAdapters++;
                } else if (
                    adapter?.rssProfile !== obj?.recommendedAdapterSettings?.recommendedRssProfile ||
                    adapter?.baseProcessorNumber !== obj?.recommendedAdapterSettings?.recommendedBaseProcessorNumber ||
                    adapter?.numberOfReceiveQueues !== obj?.recommendedAdapterSettings?.recommendedReceiveQueues
                ) {
                    nonOptimizedAdapters++;
                }
            });
            return {
                totalObjectsAssessed: obj?.rssAdapters?.length || 0,
                totalObjectsInViolation: nonOptimizedAdapters,
                networkAdapters: obj?.rssAdapters?.map((adapter: any) => adapter?.adapterName)
            };
        },
        isFixSupported: true,
        customColumns: [
            {
                Header: 'databases.well-architect.dashboard-table-headers.impacted-network-adapters',
                accessor: 'totalObjectsInViolation',
                id: '4',
                width: '200px',
                renderCell: (cellData: string, rowData: ConfigTableRowData, t: TFunction) =>
                    `${rowData?.totalObjectsInViolation || 0} out of ${rowData?.totalObjectsAssessed || 0}`
            }
        ]
    },
    [ASSESSMENT_CONFIG_NAMES.MTU]: {
        assessmentPath: [], // Empty array means direct access to instanceData?.assessments?.mtuAlignment
        configName: 'mtuAlignment', // Direct property name
        dismissConfigName: 'mtuAlignment', // Direct property name
        dataMapping: (obj: any, instanceData: any) => ({
            current: obj?.current,
            totalObjectsAssessed: obj?.totalObjectsAssessed || 0,
            totalObjectsInViolation: obj?.totalObjectsInViolation || 0,
            objectsInViolation: obj?.objectsInViolation || [instanceData?.databaseInstanceId]
        }),
        isFixSupported: true,
        customColumns: [
            {
                Header: 'databases.well-architect.dashboard-table-headers.network-interface',
                accessor: 'totalObjectsInViolation',
                id: '4',
                width: '200px',
                renderCell: (cellData: string, rowData: ConfigTableRowData, t: TFunction) =>
                    `${rowData?.totalObjectsInViolation || 0} out of ${rowData?.totalObjectsAssessed || 0}`
            }
        ]
    },
    [ASSESSMENT_CONFIG_NAMES.LICENSE]: {
        assessmentPath: [], // Empty array means direct access to instanceData?.assessments?.license
        configName: 'license', // Direct property name
        dismissConfigName: 'license', // Direct property name
        dataMapping: (obj: any, instanceData: any) => {
            let licenseVal = '';
            const instance = obj?.sqlServerInstances?.find(
                (instance: GwSqlServerInstanceInterface) =>
                    instance?.sqlServerInstance === instanceData?.databaseInstanceName
            );
            const selectedDatabaseLicense = instance?.sqlServerEdition || '';
            if (selectedDatabaseLicense.includes('Standard')) {
                licenseVal = 'Standard';
            } else if (selectedDatabaseLicense.includes('Enterprise')) {
                licenseVal = 'Enterprise';
            } else if (selectedDatabaseLicense.includes('Developer')) {
                licenseVal = 'Developer';
            } else {
                licenseVal = selectedDatabaseLicense;
            }
            return {
                current: licenseVal
            };
        },
        isFixSupported: false,
        customColumns: [
            {
                Header: 'databases.well-architect.dashboard-table-headers.license-edition',
                accessor: 'current',
                id: '4',
                width: '200px',
                renderCell: (cellData: string, rowData: ConfigTableRowData, t: TFunction) =>
                    cellData || t('databases.general.not-available-table-columns')
            }
        ]
    },
    [ASSESSMENT_CONFIG_NAMES.MICROSOFT_SQL_SERVER_PATCH]: {
        assessmentPath: [], // Empty array means direct access to instanceData?.assessments?.mssqlPatch
        configName: 'mssqlPatch', // Direct property name
        dismissConfigName: 'mssqlPatch', // Direct property name
        isFixSupported: false, // Fix is not supported for SQL Server patch configurations
        dataMapping: (obj: any) => {
            let totalPatches = 0;
            obj?.missingPatchesInEc2Instances?.forEach(
                (perInstance: { criticalMissingPatchesCount: any; importantMissingPatchesCount: any }) => {
                    totalPatches += perInstance?.criticalMissingPatchesCount || 0;
                    totalPatches += perInstance?.importantMissingPatchesCount || 0;
                }
            );
            return {
                current: totalPatches,
                missingPatchList: obj?.missingPatchesInEc2Instances || []
            };
        },
        customColumns: [
            {
                Header: 'databases.well-architect.dashboard-table-headers.missing-patches',
                accessor: 'current',
                id: '4',
                width: '200px',
                renderCell: (
                    cellData: string,
                    rowData: ConfigTableRowData,
                    t: TFunction,
                    handleImpactedResourceDialog: HandleImpactedResourceDialog
                ) =>
                    renderCountWithView(
                        ASSESSMENT_CONFIG_NAMES.MICROSOFT_SQL_SERVER_PATCH,
                        cellData,
                        rowData,
                        t,
                        handleImpactedResourceDialog
                    )
            }
        ]
    },
    [ASSESSMENT_CONFIG_NAMES.MAXDOP]: {
        assessmentPath: [], // Empty array means direct access to instanceData?.assessments?.maxdop
        configName: 'maxDOP', // Direct property name
        dismissConfigName: 'maxDOP', // Direct property name
        dataMapping: (obj: any) => ({
            current: obj?.current,
            totalObjectsAssessed: obj?.totalObjectsAssessed || 0,
            totalObjectsInViolation: obj?.totalObjectsInViolation || 0
        }),
        isFixSupported: true,
        customColumns: [
            {
                Header: 'databases.well-architect.dashboard-table-headers.maxdop-value',
                accessor: 'current',
                id: '4',
                width: '200px',
                renderCell: (cellData: string, rowData: ConfigTableRowData, t: TFunction) =>
                    cellData || t('databases.general.not-available-table-columns')
            }
        ]
    },
    [ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT]: {
        assessmentPath: [], // Nested path navigation
        configName: 'snapshotPolicy', // Configuration name
        dismissConfigName: 'snapshotPolicy', // Dismissed configuration name
        dataMapping: (obj: any) => ({
            current: obj?.current,
            totalObjectsAssessed: obj?.totalObjectsAssessed || 0,
            totalObjectsInViolation: obj?.totalObjectsInViolation || 0,
            objectsInViolation: obj?.objectsInViolation || [],
            configurationName: 'snapshot-policy'
        }),
        isFixSupported: true,
        customColumns: [
            {
                Header: 'databases.well-architect.dashboard-table-headers.impacted-volumes',
                accessor: 'totalObjectsInViolation',
                id: '4',
                width: '200px',
                renderCell: (
                    cellData: string,
                    rowData: ConfigTableRowData,
                    t: TFunction,
                    handleImpactedResourceDialog: HandleImpactedResourceDialog
                ) => (
                    <div className={CommonStyles.impactedDrivesCell}>
                        {rowData?.totalObjectsInViolation || 0} out of {rowData?.totalObjectsAssessed || 0}
                        {(rowData?.totalObjectsInViolation ?? 0) > 0 && (
                            <Button variant="text" onClick={() => handleImpactedResourceDialog(rowData)}>
                                {t('databases.dashboard.view')}
                            </Button>
                        )}
                    </div>
                )
            }
        ]
    },
    [ASSESSMENT_CONFIG_NAMES.CRR]: {
        assessmentPath: [], // Nested path navigation
        configName: 'crr', // Configuration name
        dismissConfigName: 'crr', // Dismissed configuration name
        dataMapping: (obj: any) => ({
            current: obj?.current,
            totalObjectsAssessed: obj?.totalObjectsAssessed || 0,
            totalObjectsInViolation: obj?.totalObjectsInViolation || 0,
            objectsInViolation: obj?.objectsInViolation || [],
            configurationName: 'crr'
        }),
        isFixSupported: false,
        customColumns: [
            {
                Header: 'databases.well-architect.dashboard-table-headers.impacted-volumes',
                accessor: 'totalObjectsInViolation',
                id: '4',
                width: '200px',
                renderCell: (
                    cellData: string,
                    rowData: ConfigTableRowData,
                    t: TFunction,
                    handleImpactedResourceDialog: HandleImpactedResourceDialog
                ) => (
                    <div className={CommonStyles.impactedDrivesCell}>
                        {rowData?.totalObjectsInViolation || 0} out of {rowData?.totalObjectsAssessed || 0}
                        {(rowData?.totalObjectsInViolation ?? 0) > 0 && (
                            <Button variant="text" onClick={() => handleImpactedResourceDialog(rowData)}>
                                {t('databases.dashboard.view')}
                            </Button>
                        )}
                    </div>
                )
            }
        ]
    },
    [ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS]: {
        assessmentPath: [], // Nested path navigation
        configName: 'awsBackup', // Configuration name
        dismissConfigName: 'awsBackup', // Dismissed configuration name
        dataMapping: (obj: any) => ({
            current: obj?.current,
            totalObjectsAssessed: obj?.totalObjectsAssessed || 0,
            totalObjectsInViolation: obj?.totalObjectsInViolation || 0,
            objectsInViolation: obj?.objectsInViolation || [],
            configurationName: 'backup-configuration'
        }),
        isFixSupported: true,
        customColumns: [
            {
                Header: 'databases.well-architect.dashboard-table-headers.impacted-file-systems',
                accessor: 'totalObjectsInViolation',
                id: '4',
                width: '200px',
                renderCell: (
                    cellData: string,
                    rowData: ConfigTableRowData,
                    t: TFunction,
                    handleImpactedResourceDialog: HandleImpactedResourceDialog
                ) => (
                    <div className={CommonStyles.impactedDrivesCell}>
                        {rowData?.totalObjectsInViolation || 0} out of {rowData?.totalObjectsAssessed || 0}
                        {(rowData?.totalObjectsInViolation ?? 0) > 0 && (
                            <Button variant="text" onClick={() => handleImpactedResourceDialog(rowData)}>
                                {t('databases.dashboard.view')}
                            </Button>
                        )}
                    </div>
                )
            }
        ]
    },
    [ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT]: {
        assessmentPath: [],
        configName: 'clone', // Configuration name
        dismissConfigName: 'clone', // Dismissed configuration name
        dataMapping: (obj: any) => ({
            current: obj?.current,
            totalObjectsAssessed: obj?.totalObjectsAssessed || 0,
            totalObjectsInViolation: obj?.totalObjectsInViolation || 0,
            violations: obj?.violations,
            cloneDetails: obj?.cloneDetails,
            objectsInViolation: obj?.objectsInViolation,
            tags: obj?.tags,
            severity: obj?.severity
        }),
        isFixSupported: true,
        customColumns: [
            {
                Header: 'databases.well-architect.dashboard-table-headers.impacted-databases',
                accessor: 'totalObjectsInViolation',
                id: '4',
                width: '200px',
                renderCell: (cellData: string, rowData: ConfigTableRowData, t: TFunction) =>
                    `${rowData?.totalObjectsInViolation || 0} out of ${rowData?.totalObjectsAssessed || 0}`
            }
        ]
    }
};

const PLACEMENT_CONFIGS_WITH_VIEW = new Set([
    'oracle-binary-placement',
    'datafiles-placement',
    'controlfiles-placement',
    'redologs-placement',
    'templogs-placement',
    'archive-placement'
]);

// Helper function to create Oracle placement configuration
const createOraclePlacementConfig = (configName: string, isFixSupported: boolean) => ({
    assessmentPath: ['storage', 'layout'],
    configName,
    dismissConfigName: configName,
    dataMapping: (obj: any) => ({
        current: obj?.current,
        totalObjectsAssessed: obj?.totalObjectsAssessed,
        totalObjectsInViolation: obj?.totalObjectsInViolation,
        objectsInViolation: obj?.objectsInViolation || [],
        violationDetails: obj?.violationDetails || []
    }),
    isFixSupported, // Fix is not supported for Oracle placement configurations
    customColumns: [
        {
            Header: 'databases.well-architect.dashboard-table-headers.impacted-volumes',
            accessor: 'totalObjectsInViolation',
            id: '4',
            width: '220px',
            renderCell: (
                cellData: string,
                rowData: ConfigTableRowData,
                t: TFunction,
                handleImpactedResourceDialog: HandleImpactedResourceDialog
            ) => {
                if (PLACEMENT_CONFIGS_WITH_VIEW.has(configName)) {
                    const newObj = { ...rowData, name: configName };
                    return (
                        <div className={CommonStyles.impactedDrivesCell}>
                            {rowData?.totalObjectsInViolation || 0} out of {rowData?.totalObjectsAssessed || 0}
                            {(rowData?.totalObjectsInViolation ?? 0) > 0 && (
                                <Button variant="text" onClick={() => handleImpactedResourceDialog(newObj)}>
                                    {t('databases.dashboard.view')}
                                </Button>
                            )}
                        </div>
                    );
                }
                return `${rowData?.totalObjectsInViolation || 0} out of ${rowData?.totalObjectsAssessed || 0}`;
            }
        }
    ]
});

// Helper function to create Oracle storage sizing configuration
const createOracleStorageSizingConfig = (
    configName: string,
    dismissConfigName: string,
    headerKey: string,
    accessor: string,
    isFixSupported: boolean = false
) => ({
    assessmentPath: ['storage', 'sizing'],
    configName,
    dismissConfigName,
    isFixSupported, // Fix support can be enabled for specific Oracle storage sizing configurations
    dataMapping: (obj: any) => ({
        [accessor]: obj?.current,
        totalObjectsAssessed: obj?.totalObjectsAssessed,
        totalObjectsInViolation: obj?.totalObjectsInViolation
    }),
    customColumns: [
        {
            Header: headerKey,
            accessor,
            id: '4',
            width: '200px',
            renderCell: (cellData: string, rowData: ConfigTableRowData, t: TFunction) =>
                cellData || t('databases.general.not-available-table-columns')
        }
    ]
});

// Oracle placement configurations mapping
const oraclePlacementConfigs = {
    [ASSESSMENT_CONFIG_NAMES.ORACLE_BINARY_PLACEMENT]: createOraclePlacementConfig('oracle-binary-placement', false),
    [ASSESSMENT_CONFIG_NAMES.DATAFILES_PLACEMENT]: createOraclePlacementConfig('datafiles-placement', false),
    [ASSESSMENT_CONFIG_NAMES.CONTROLFILES_PLACEMENT]: createOraclePlacementConfig('controlfiles-placement', false),
    [ASSESSMENT_CONFIG_NAMES.REDO_LOGS_PLACEMENT]: createOraclePlacementConfig('redologs-placement', false),
    [ASSESSMENT_CONFIG_NAMES.TEMP_LOGS_PLACEMENT]: createOraclePlacementConfig('templogs-placement', false),
    [ASSESSMENT_CONFIG_NAMES.ARCHIVE_PLACEMENT]: createOraclePlacementConfig('archive-placement', false),
    [ASSESSMENT_CONFIG_NAMES.DATA_DG_LUN_LAYOUT]: createOraclePlacementConfig('data-dg-lun-layout', true),
    [ASSESSMENT_CONFIG_NAMES.LOG_DG_LUN_LAYOUT]: createOraclePlacementConfig('redolog-dg-lun-layout', true),
    [ASSESSMENT_CONFIG_NAMES.FRA_DG_LUN_LAYOUT]: createOraclePlacementConfig('fra-dg-lun-layout', true),
    [ASSESSMENT_CONFIG_NAMES.ARCHIVELOG_DG_LUN_LAYOUT]: createOraclePlacementConfig('archivelog-dg-lun-layout', true)
};

// Oracle storage sizing configurations mapping
const oracleStorageSizingConfigs = {
    [ASSESSMENT_CONFIG_NAMES.SWAP_SPACE]: createOracleStorageSizingConfig(
        'swap-space',
        'swap-space',
        'databases.well-architect.dashboard-table-headers.swap-space',
        'swapSpace'
    )
};

// Oracle-specific FILE_SYSTEM_HEADROOM configuration
const oracleFileSystemHeadroomConfig = createOracleStorageSizingConfig(
    'headroom',
    'headroom',
    'databases.well-architect.dashboard-table-headers.file-system-headroom',
    'fileSystemHeadroom',
    true // Enable fix support for Oracle file system headroom
);

// Helper function to create Oracle host OS patch configuration
const createOracleHostOsPatchConfig = () => ({
    assessmentPath: [],
    configName: 'hostOsPatch',
    dismissConfigName: 'hostOsPatch',
    isFixSupported: false, // Fix is not supported for Oracle OS patch configurations
    dataMapping: (obj: any) => ({
        current: `${obj?.objectsInViolation?.length || 0}`,
        missingPatchList: obj?.ec2InstancesToPatch || []
    }),
    customColumns: [
        {
            Header: 'databases.well-architect.dashboard-table-headers.missing-patches',
            accessor: 'current',
            id: '4',
            width: '200px',
            renderCell: (
                cellData: string,
                rowData: ConfigTableRowData,
                t: TFunction,
                handleImpactedResourceDialog: HandleImpactedResourceDialog
            ) =>
                renderCountWithView(
                    ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH,
                    cellData,
                    rowData,
                    t,
                    handleImpactedResourceDialog
                )
        }
    ]
});

// Oracle COMPUTE configurations mapping
const oracleComputeConfigs = {
    [ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH]: createOracleHostOsPatchConfig()
};

const createOracleSecurityPatchConfig = () => ({
    assessmentPath: [],
    configName: 'oracleSecurityPatch',
    dismissConfigName: 'oracleSecurityPatch',
    isFixSupported: false,
    dataMapping: (obj: any) => {
        let totalMissing = 0;
        obj?.missingPatchDetails?.forEach((detail: any) => {
            totalMissing += detail?.missingPatchesCount || 0;
        });
        return {
            current: `${totalMissing}`,
            missingPatchList: obj?.missingPatchDetails || []
        };
    },
    customColumns: [
        {
            Header: 'databases.well-architect.dashboard-table-headers.missing-patches',
            accessor: 'current',
            id: '4',
            width: '200px',
            renderCell: (
                cellData: string,
                rowData: ConfigTableRowData,
                t: TFunction,
                handleImpactedResourceDialog: HandleImpactedResourceDialog
            ) =>
                renderCountWithView(
                    ASSESSMENT_CONFIG_NAMES.ORACLE_SECURITY_PATCH,
                    cellData,
                    rowData,
                    t,
                    handleImpactedResourceDialog
                )
        }
    ]
});

// Oracle APPLICATION configurations mapping
const oracleApplicationConfigs = {
    [ASSESSMENT_CONFIG_NAMES.ORACLE_SECURITY_PATCH]: createOracleSecurityPatchConfig()
};

// Merge all configurations
const FULL_CONFIG_MAPPING = {
    ...CONFIG_MAPPING,
    ...oraclePlacementConfigs,
    ...oracleStorageSizingConfigs,
    ...oracleComputeConfigs,
    ...oracleApplicationConfigs
};

const DashboardConfigsTable = ({
    configType,
    lastColDetails,
    handleBulkAction,
    handleSingleDismissPostpone,
    handleBulkDismissPostpone
}: DashboardConfigsTableProps) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [showDismissed, setShowDismissed] = useState(false);

    const { allmssqlHostAssessmentData, allOracleHostAssessmentData, inventoryTableData, getDatabaseHosts } =
        useAppSelector(state => state.inventoryV2);
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = useAppSelector(state => state.headers);
    const { selectedRowsForOptimize } = useAppSelector(state => state.databaseHome);
    const { inProgressOptimizationData, inProgressHostData, inProgressStateData, configEngineType } = useAppSelector(
        state => state.getWellOptimize
    );
    const { credentialData } = useAppSelector(state => state.headers.getCredentials);
    const { regionsData } = useAppSelector(state => state.headers.getRegions);

    let config;
    if (configType === ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM && configEngineType === DBType.ORACLE) {
        config = oracleFileSystemHeadroomConfig;
    } else {
        config = FULL_CONFIG_MAPPING[configType];
    }

    if (!config) {
        return null;
    }

    const tableData = useMemo(() => {
        let assessmentData: any = [];
        const uniqueResourceList: Array<string> = [];

        const engineTypeAssessmentData =
            configEngineType === DBType.ORACLE ? allOracleHostAssessmentData : allmssqlHostAssessmentData;

        engineTypeAssessmentData?.map((hostData: any) => {
            if (
                (!hostData?.isWad && !headerSelectedMultiCredIdsList.includes(hostData?.credentialId)) ||
                (!hostData?.isWad && !headerSelectedMultiRegionIdsList.includes(hostData?.regionId)) ||
                uniqueResourceList.includes(hostData?.databaseHostId)
            ) {
                return;
            }
            uniqueResourceList.push(hostData?.databaseHostId);

            hostData?.instancesAssessment?.map((instanceData: any) => {
                if (!instanceData?.error && instanceData?.assessments?.lastAssessmentTimestamp) {
                    let configObj;
                    let configStateObj;

                    // Handle direct access vs nested path navigation
                    if (config.assessmentPath.length === 0) {
                        // Direct access (e.g., compute rightsizing)
                        configObj = instanceData?.assessments?.[config.configName];
                        configStateObj = instanceData?.assessments?.dismissedConfigurations?.[config.dismissConfigName];
                    } else {
                        // Nested path navigation (e.g., storage configurations)
                        let assessmentObj = instanceData?.assessments;
                        for (const path of config.assessmentPath) {
                            assessmentObj = assessmentObj?.[path];
                        }
                        configObj = assessmentObj?.find((item: any) => item.name === config.configName);

                        // Get dismissed configuration
                        let dismissedConfigObj = instanceData?.assessments?.dismissedConfigurations;
                        for (const path of config.assessmentPath) {
                            dismissedConfigObj = dismissedConfigObj?.[path];
                        }
                        configStateObj = dismissedConfigObj?.find(
                            (item: any) => item?.configurationName === config.dismissConfigName
                        );
                    }

                    const matchingCredEntry =
                        credentialData && credentialData?.find(entry => entry.credentialsId === hostData?.credentialId);
                    const matchingRegionEntry =
                        regionsData && regionsData?.regions?.find(entry => entry.regionCode === hostData?.regionId);

                    // Use custom data mapping function
                    const customData = config.dataMapping(configObj, instanceData);

                    // Filter Oracle ASM-related configurations
                    if (!filterDatabaseRowsForNonAsm(config.configName, instanceData?.assessments)) {
                        return;
                    }

                    // Skip configurations not supported for AOAG deployments (e.g., License)
                    if (isConfigSkippedForAoag(configType, instanceData?.assessments?.deploymentType)) {
                        return;
                    }

                    // Skip WAD-excluded configurations for WAD (offline assessment) instances
                    if (isWadExcludedConfig(configType, hostData?.isWad, configEngineType)) {
                        return;
                    }

                    assessmentData.push({
                        credentialId: hostData?.credentialId,
                        configState: configStateObj?.configState,
                        regionId: hostData?.regionId,
                        databaseHostId: hostData?.databaseHostId,
                        instanceId: instanceData?.databaseInstanceId,
                        serverInstanceName: instanceData?.databaseInstanceName,
                        id: `${hostData?.databaseHostId}_${instanceData?.databaseInstanceId}`,
                        hostName: hostData?.databaseHostName,
                        assessmentStatus: GETWELL_VALUES[configObj?.status] || '',
                        data: instanceData,
                        configObj: configStateObj,
                        credentialName: matchingCredEntry?.name,
                        regionName: matchingRegionEntry?.regionName,
                        accountId: matchingCredEntry?.providerAccountId,
                        isWad: hostData?.isWad,
                        ...customData
                    });
                }
            });
        });

        assessmentData = sortOptimizeDashboardInnerTable(assessmentData);

        return mapHostStatusToAssessmentData(
            inventoryTableData,
            assessmentData,
            getDatabaseHosts?.fullHostDataLoading || getDatabaseHosts?.databaseHostsLoading
        );
    }, [
        allmssqlHostAssessmentData,
        allOracleHostAssessmentData,
        inventoryTableData,
        getDatabaseHosts,
        headerSelectedMultiCredIdsList,
        headerSelectedMultiRegionIdsList,
        config
    ]);

    // Update tableData when selection changes
    const updatedTableData = useMemo(() => {
        if (inProgressOptimizationData?.[configType]?.length) {
            return disableOptimizeCheckBoxForOptimizeCase(tableData, configType, selectedRowsForOptimize, t);
        }
        return disableOptimizeCheckBoxForErrCase(tableData, configType, t);
    }, [selectedRowsForOptimize, tableData, inProgressOptimizationData, configType]);

    // Calculate counts and filtered data
    const { filteredData, dismissedCount, totalCount, isToggleDisabled } = useMemo(() => {
        const total = updatedTableData?.length || 0;
        const dismissed =
            updatedTableData?.filter(
                (row: any) => row.configState === CONFIG_STATES.DISMISSED || row.configState === CONFIG_STATES.POSTPONED
            )?.length || 0;
        const nonDismissed = total - dismissed;

        const filtered = showDismissed
            ? updatedTableData?.filter(
                  (row: any) =>
                      row.configState === CONFIG_STATES.DISMISSED || row.configState === CONFIG_STATES.POSTPONED
              ) || []
            : updatedTableData?.filter(
                  (row: any) =>
                      row.configState !== CONFIG_STATES.DISMISSED && row.configState !== CONFIG_STATES.POSTPONED
              ) || [];

        return {
            filteredData: filtered,
            dismissedCount: dismissed,
            totalCount: total,
            isToggleDisabled: dismissed === 0
        };
    }, [updatedTableData, showDismissed]);

    // Generate title based on current state
    const { pluralTitle, singularTitle } = useMemo(() => {
        if (isToggleDisabled) {
            return {
                pluralTitle: `${engineTypeBasedResourceStr(
                    configEngineType,
                    t('databases.well-architect.instances'),
                    t('databases.well-architect.databases')
                )} (${totalCount})`,
                singularTitle: `${engineTypeBasedResourceStr(
                    configEngineType,
                    t('databases.well-architect.instance'),
                    t('databases.well-architect.database')
                )} (${totalCount})`
            };
        }

        if (showDismissed) {
            return {
                pluralTitle: `${engineTypeBasedResourceStr(
                    configEngineType,
                    t('databases.well-architect.dismissed-instances'),
                    t('databases.well-architect.dismissed-databases')
                )} (${dismissedCount}/${totalCount})`,
                singularTitle: `${engineTypeBasedResourceStr(
                    configEngineType,
                    t('databases.well-architect.dismissed-instance'),
                    t('databases.well-architect.dismissed-database')
                )} (${dismissedCount}/${totalCount})`
            };
        }
        const nonDismissedCount = totalCount - dismissedCount;
        return {
            pluralTitle: `${engineTypeBasedResourceStr(
                configEngineType,
                t('databases.well-architect.instances'),
                t('databases.well-architect.databases')
            )} (${nonDismissedCount}/${totalCount})`,
            singularTitle: `${engineTypeBasedResourceStr(
                configEngineType,
                t('databases.well-architect.instance'),
                t('databases.well-architect.database')
            )} (${nonDismissedCount}/${totalCount})`
        };
    }, [dismissedCount, totalCount, showDismissed, isToggleDisabled]);

    // Reset toggle to false when there are no dismissed items
    useEffect(() => {
        if (isToggleDisabled && showDismissed) {
            setShowDismissed(false);
        }
    }, [isToggleDisabled]);

    const handleBulkOperation = () => {
        handleBulkAction(configType, selectedRowsForOptimize);
    };

    const handleStateOperation = (operationType: string) => {
        handleBulkDismissPostpone(configType, selectedRowsForOptimize, operationType, configEngineType);
    };

    const handleToggle = (checked: boolean) => {
        setShowDismissed(checked);
        // Clear selection when toggling
        checkBoxHandle(tableProps.selectionState, selectedRowsForOptimize, dispatch);
    };

    // Check if fix is not supported for this configuration type
    const isFixNotSupported = config.isFixSupported === false;

    // Determine if fix button should be enabled based on selected rows and configuration support
    const { isFixDisabled, fixDisableMsg } = bulkFixDisableCheck(
        configType,
        isFixNotSupported,
        selectedRowsForOptimize,
        t,
        configEngineType
    );

    // Determine if dismiss/postpone buttons should be disabled (for optimized rows)
    const { isDismissDisabled, dismissDisableMsg, isPostponeDisabled, postponeDisableMsg } =
        bulkDismissPostponeDisableCheck(selectedRowsForOptimize, t);

    const { setDialog } = useDialog();

    const handleImpactedResourceDialog: HandleImpactedResourceDialog = rowData => {
        const viewColumnHeader = config?.customColumns?.[0]?.Header;
        const headerText = viewColumnHeader ? t(viewColumnHeader) : t('databases.well-architect.impacted-resources');
        setDialog(
            <DialogComponent
                header={headerText}
                content={<ImpactedResourceDialog data={rowData} />}
                primaryButton={GENERAL.CLOSE}
                callback={() => {}}
            />
        );
    };

    // Build dynamic columns
    const TableColDefs: ColumnProps[] = [
        // Standard columns that are common across all configs
        {
            Header: `${engineTypeBasedResourceStr(
                configEngineType,
                t('databases.well-architect.dashboard-table-headers.sql-server-instance-name'),
                t('databases.well-architect.dashboard-table-headers.oracle-database-name')
            )}`,
            accessor: 'serverInstanceName',
            id: '1',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: '280px',
            renderCell: (cellData: any, rowData: any) => (
                <FirstColumnComponent rowData={rowData} showDismissed={false} />
            )
        },
        {
            Header: `${t('databases.well-architect.dashboard-table-headers.well-architected-status')}`,
            accessor: 'assessmentStatus',
            id: '2',
            width: '260px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                const isDisable = showDismissed || rowData?.configState === CONFIG_STATES.ACTIVATING;
                if (
                    rowData?.configState === CONFIG_STATES.DISMISSED ||
                    rowData?.configState === CONFIG_STATES.POSTPONED ||
                    rowData?.configState === CONFIG_STATES.ACTIVATING
                ) {
                    return (
                        <div className={isDisable ? styles.disabled : ''}>
                            {t('databases.general.not-available-table-columns')}
                        </div>
                    );
                }
                if (cellData === GETWELL_STATUS.OPTIMIZED) {
                    return (
                        <div className={styles.statusContainer}>
                            <Optimized />
                            <DsTypography variant="Regular_14" className={isDisable ? styles.disabled : ''}>
                                {cellData}
                            </DsTypography>
                        </div>
                    );
                }
                if (cellData === GETWELL_STATUS.NOT_OPTIMIZED) {
                    return (
                        <div className={styles.statusContainer}>
                            <NotActive />
                            <DsTypography variant="Regular_14" className={isDisable ? styles.disabled : ''}>
                                {cellData}
                            </DsTypography>
                        </div>
                    );
                }
                if (cellData === GETWELL_STATUS.UNDER_PROVISIONED) {
                    return (
                        <div className={styles.statusContainer}>
                            <UnderProvisioned />
                            <DsTypography variant="Regular_14" className={isDisable ? styles.disabled : ''}>
                                {cellData}
                            </DsTypography>
                        </div>
                    );
                }
                if (cellData === GETWELL_STATUS.OVER_PROVISIONED) {
                    return (
                        <div className={styles.statusContainer}>
                            <div style={{ transform: 'rotate(180deg)' }}>
                                <UnderProvisioned />
                            </div>
                            <DsTypography variant="Regular_14" className={isDisable ? styles.disabled : ''}>
                                {cellData}
                            </DsTypography>
                        </div>
                    );
                }
                if (cellData === GETWELL_STATUS.OPTIMIZING || cellData === GETWELL_STATUS.ANALYZING) {
                    return <InProgress />;
                }
                return (
                    <div className={isDisable ? styles.disabled : ''}>
                        {cellData || t('databases.general.not-available-table-columns')}
                    </div>
                );
            }
        },
        {
            Header: `${t('databases.well-architect.dashboard-table-headers.host-name')}`,
            accessor: 'hostName',
            id: '3',
            width: '220px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                const isDisable = showDismissed || rowData?.configState === CONFIG_STATES.ACTIVATING;
                return <div className={isDisable ? styles.disabled : ''}>{cellData}</div>;
            }
        },
        // Custom columns specific to each config type
        ...config.customColumns.map((col: any) => ({
            ...col,
            Header: t(col.Header),
            filterOptions: 'auto',
            renderCell: col.renderCell
                ? (cellData: any, rowData: any) => {
                      const isDisable = showDismissed || rowData?.configState === CONFIG_STATES.ACTIVATING;
                      // Check if the row is dismissed or postponed
                      if (
                          rowData?.configState === CONFIG_STATES.DISMISSED ||
                          rowData?.configState === CONFIG_STATES.POSTPONED ||
                          rowData?.configState === CONFIG_STATES.ACTIVATING
                      ) {
                          return (
                              <div className={isDisable ? styles.disabled : ''}>
                                  {t('databases.general.not-available-table-columns')}
                              </div>
                          );
                      }
                      return col.renderCell(cellData, rowData, t, handleImpactedResourceDialog);
                  }
                : undefined
        })),
        // Standard credential and region columns
        {
            id: '5',
            Header: `${t('databases.well-architect.dashboard-table-headers.aws-credentials')}`,
            accessor: 'credentialName',
            filterOptions: 'auto',
            width: '220px',
            renderCell: (cellData: string, rowData: any) => {
                const isDisable = showDismissed || rowData?.configState === CONFIG_STATES.ACTIVATING;
                return (
                    <div className={isDisable ? styles.disabled : ''}>
                        {cellData || t('databases.general.not-available')}
                    </div>
                );
            }
        },
        {
            id: '6',
            Header: `${t('databases.well-architect.dashboard-table-headers.aws-account')}`,
            accessor: 'accountId',
            filterOptions: 'auto',
            width: '180px',
            renderCell: (cellData: string, rowData: any) => {
                const isDisable = showDismissed || rowData?.configState === CONFIG_STATES.ACTIVATING;
                return (
                    <div className={isDisable ? styles.disabled : ''}>
                        {cellData || t('databases.general.not-available')}
                    </div>
                );
            }
        },
        {
            id: '7',
            Header: `${t('databases.well-architect.dashboard-table-headers.region')}`,
            accessor: 'regionName',
            filterOptions: 'auto',
            width: '180px',
            renderCell: (cellData: string, rowData: any) => {
                const isDisable = showDismissed || rowData?.configState === CONFIG_STATES.ACTIVATING;
                return (
                    <div className={isDisable ? styles.disabled : ''}>
                        {cellData || t('databases.general.not-available')}
                    </div>
                );
            }
        },
        // Last column with actions
        lastColDetails(
            configType,
            {},
            inProgressOptimizationData,
            inProgressHostData,
            showDismissed,
            config.isFixSupported
        )
    ];

    const tableProps = useTable({
        isManagedColumns: true,
        initialColumnState: initialDashboardInnerPageOptimizeColState,
        isHorizontalScroll: true,
        isSorting: false,
        columns: TableColDefs,
        rows: filteredData || [],
        pageSize: 50,
        selectionType: 'multiple',
        defaultSelectedRows: [],
        manageColumnsProps: {
            renderCell: (cellData: any, rowData: any) => {
                // Hide menu for dismissed items
                if (
                    showDismissed &&
                    (rowData?.configState === CONFIG_STATES.DISMISSED ||
                        rowData?.configState === CONFIG_STATES.POSTPONED)
                ) {
                    return null;
                }

                const isWadRow = rowData?.isWad === true;
                const wadDisabledMessage =
                    configEngineType === DBType.ORACLE
                        ? t('databases.wad.tab-disabled-message-oracle')
                        : t('databases.wad.tab-disabled-message');

                return (
                    <>
                        {selectedRowsForOptimize?.length > 0 || isWadRow ? (
                            <TooltipComponent
                                placement="left"
                                title={isWadRow ? wadDisabledMessage : ''}
                                width="280px"
                                height="auto"
                            >
                                <div className={styles.menuPointerDisabled}>
                                    <span className={styles.menuPointer}>...</span>
                                </div>
                            </TooltipComponent>
                        ) : (
                            <div className={styles.jobMenuPopover}>
                                <ButtonWithDropdown
                                    variant="icon"
                                    isDisabled={selectedRowsForOptimize?.length > 0}
                                    items={[
                                        {
                                            id: 'dismiss',
                                            children: `${t('databases.well-architect.dismiss-text')}`,
                                            onClick: () => {
                                                handleSingleDismissPostpone(
                                                    rowData,
                                                    configType,
                                                    CONFIG_STATE_ACTIONS.DISMISS,
                                                    configEngineType
                                                );
                                            }
                                        },
                                        {
                                            id: 'postpone',
                                            children: `${t('databases.well-architect.postpone-for-30-days')}`,
                                            onClick: () => {
                                                handleSingleDismissPostpone(
                                                    rowData,
                                                    configType,
                                                    CONFIG_STATE_ACTIONS.POSTPONED,
                                                    configEngineType
                                                );
                                            }
                                        }
                                    ]}
                                >
                                    <div className={styles.menuIcon}>
                                        <span className={styles.menuPointer}>...</span>
                                    </div>
                                </ButtonWithDropdown>
                            </div>
                        )}
                    </>
                );
            }
        }
    });

    // Dynamic title that considers both toggle and table filters
    const { finalPluralTitle, finalSingularTitle } = useMemo(() => {
        const actualFilteredCount = tableProps?.organizedRows?.length || 0;
        const hasTableFilters = tableProps?.filterState?.count > 0 || tableProps?.filterState?.textFilter;

        if (hasTableFilters) {
            // When table filters are active, show actual filtered count
            return {
                finalPluralTitle: `${engineTypeBasedResourceStr(
                    configEngineType,
                    t('databases.well-architect.instances'),
                    t('databases.well-architect.databases')
                )} (${actualFilteredCount}/${totalCount})`,
                finalSingularTitle: `${engineTypeBasedResourceStr(
                    configEngineType,
                    t('databases.well-architect.instance'),
                    t('databases.well-architect.database')
                )} (${actualFilteredCount}/${totalCount})`
            };
        }
        // When no table filters, use the original toggle-based titles
        return {
            finalPluralTitle: pluralTitle,
            finalSingularTitle: singularTitle
        };
    }, [tableProps?.organizedRows?.length, tableProps?.filterState, pluralTitle, singularTitle, totalCount]);

    useEffect(() => {
        const rowsData = getSelectedFromSelectionState(tableProps.selectionState, updatedTableData);
        dispatch(setSelectedRowsForOptimize(rowsData));

        if (
            rowsData.length > 0 &&
            (inProgressOptimizationData?.[configType]?.length || inProgressStateData?.[configType]?.length)
        ) {
            checkBoxHandle(tableProps.selectionState, rowsData, dispatch);
        }
    }, [tableProps.selectionState, inProgressOptimizationData, inProgressStateData, configType]);

    return (
        <div className={styles.renderTable}>
            <TableTopBar
                // @ts-ignore
                tableProps={tableProps}
                pluralTitle={finalPluralTitle}
                singularTitle={finalSingularTitle}
                hideCount
                actionsRight={
                    <div className={styles.toggle}>
                        <DsToggleSwitch
                            onChange={handleToggle}
                            title={engineTypeBasedResourceStr(
                                configEngineType,
                                t('databases.well-architect.dismissed-instances'),
                                t('databases.well-architect.dismissed-databases')
                            )}
                            isDisabled={isToggleDisabled}
                            value={showDismissed}
                        />
                    </div>
                }
            />
            {selectedRowsForOptimize.length > 0 && (
                <BulkCombineActionController
                    action={t('databases.well-architect.fix')}
                    onClick={handleBulkOperation}
                    handleStateOperation={handleStateOperation}
                    showDismissed={showDismissed}
                    isFixDisabled={isFixDisabled}
                    fixDisableMsg={fixDisableMsg}
                    isDismissDisabled={isDismissDisabled}
                    dismissDisableMsg={dismissDisableMsg}
                    isPostponeDisabled={isPostponeDisabled}
                    postponeDisableMsg={postponeDisableMsg}
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

export default DashboardConfigsTable;
