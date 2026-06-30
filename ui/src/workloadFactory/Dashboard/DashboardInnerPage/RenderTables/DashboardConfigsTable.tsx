import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { DsToggleSwitch } from '@tlveng/wlm-ds';
import { Button, DsTypography, useDialog } from '@netapp/design-system';
import styles from './RenderTables.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { ReactComponent as NotActive } from '../../../../assets/ic_not_active.svg';
import { ReactComponent as Optimized } from '../../../../assets/optimized.svg';
import { ReactComponent as UnderProvisioned } from '../../../../assets/under-provisioned.svg';
import { ReactComponent as InProgress } from '../../../../assets/In Progress.svg';
import {
    filterDatabaseRowsForNonAsm,
    mapHostStatusToAssessmentData,
    shouldSkipDatabaseHost
} from '../../../DatabaseHomePage/DatabaseHomeUtils';
import { checkBoxHandle, formatDateWithTime, getSelectedFromSelectionState } from '../../../../utils/utilityFunctions';
import { setSelectedRowsForOptimize } from '../../../../store/workloadFactory/databaseHomeSlice';
import {
    CONFIG_STATE_ACTIONS,
    CONFIG_STATES,
    DBType,
    FSXN_STORAGE_PROTOCOLS,
    GETWELL_STATUS,
    GETWELL_VALUES
} from '../../../../utils/consts';
import {
    disableOptimizeCheckBoxForErrCase,
    disableOptimizeCheckBoxForOptimizeCase
} from '../../../GetWell/GetWellUtils';
import { initialDashboardInnerPageOptimizeColState } from '../../../../utils/manageColumnUtils';
import { useTable } from '../../../../common/Lib/Table/useTable';
import { TableTopBar } from '../../../../common/Lib/Table/TableTopBar';
import { Table } from '../../../../common/Lib/Table/Table';
import { ButtonWithDropdown } from '../../../../common/ButtonWithDropdown/ButtonWithDropdown';
import FirstColumnComponent from './FirstColumnComponent';
import BulkCombineActionController from '../../../../common/BulkAction/BulkCombineActionController';
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
import {
    getAssessmentById,
    getDismissedConfig,
    getLastAssessmentTimestamp,
    hasAssessmentTimestamp,
    isWadExcludedAssessmentConfigId,
    resolveConfigDisplayName
} from '../../../WellArchitectedTab/assessmentFormatUtils';
import { ORACLE_ISCSI_ONLY_CONFIG_IDS, resolveDashboardTableConfig } from './dashboardTableConfigOverrides';
import { getOptimizeApiConfig } from '../../../../utils/configRegistry';

interface DashboardConfigsTableProps {
    configType: string;
    lastColDetails: any;
    handleBulkAction: any;
    handleSingleDismissPostpone: any;
    handleBulkDismissPostpone: any;
}

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

    const config = useMemo(
        () => resolveDashboardTableConfig(configType, configEngineType),
        [configType, configEngineType]
    );

    const tableData = useMemo(() => {
        let assessmentData: any = [];
        const uniqueResourceList: Array<string> = [];

        const engineTypeAssessmentData =
            configEngineType === DBType.ORACLE ? allOracleHostAssessmentData : allmssqlHostAssessmentData;

        engineTypeAssessmentData?.map((hostData: any) => {
            if (
                shouldSkipDatabaseHost(
                    hostData,
                    headerSelectedMultiCredIdsList,
                    headerSelectedMultiRegionIdsList,
                    uniqueResourceList
                )
            ) {
                return;
            }

            hostData?.instancesAssessment?.map((instanceData: any) => {
                const instanceAssessments = instanceData?.assessments;
                if (instanceData?.error || !hasAssessmentTimestamp(instanceAssessments)) {
                    return;
                }

                const configObj = getAssessmentById(instanceAssessments, config.configId);
                if (!configObj) {
                    return;
                }
                const configStateObj = getDismissedConfig(instanceAssessments, config.dismissConfigName);

                const matchingCredEntry =
                    credentialData && credentialData?.find(entry => entry.credentialsId === hostData?.credentialId);
                const matchingRegionEntry =
                    regionsData && regionsData?.regions?.find(entry => entry.regionCode === hostData?.regionId);

                const customData = config.dataMapping(configObj, instanceData);

                if (!filterDatabaseRowsForNonAsm(config.configName, instanceAssessments)) {
                    return;
                }

                if (
                    ORACLE_ISCSI_ONLY_CONFIG_IDS.has(configType) &&
                    instanceAssessments?.storageProtocol !== FSXN_STORAGE_PROTOCOLS.ISCSI
                ) {
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
                    lastAssessmentTimestamp: getLastAssessmentTimestamp(instanceAssessments),
                    assessmentStatus: GETWELL_VALUES[configObj?.status] || '',
                    data: instanceData,
                    configObj: configStateObj,
                    credentialName: matchingCredEntry?.name,
                    regionName: matchingRegionEntry?.regionName,
                    accountId: matchingCredEntry?.providerAccountId,
                    isWad: hostData?.isWad,
                    ...customData
                });
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
        config,
        configType,
        configEngineType,
        credentialData,
        regionsData
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
    const supportsDashboardBulkFix =
        getOptimizeApiConfig(config.configId, configEngineType)?.supportsDashboardBulk ?? true;

    // Determine if fix button should be enabled based on selected rows and configuration support
    const { isFixDisabled, fixDisableMsg } = bulkFixDisableCheck(
        configType,
        isFixNotSupported,
        selectedRowsForOptimize,
        t,
        configEngineType,
        supportsDashboardBulkFix
    );

    // Determine if dismiss/postpone buttons should be disabled (for optimized rows)
    const { isDismissDisabled, dismissDisableMsg, isPostponeDisabled, postponeDisableMsg } =
        bulkDismissPostponeDisableCheck(selectedRowsForOptimize, t);

    const { setDialog } = useDialog();

    const handleImpactedResourceDialog: HandleImpactedResourceDialog = rowData => {
        const viewColumnHeader = config?.customColumns?.[0]?.Header as string | undefined;
        setDialog(
            <DialogComponent
                header={viewColumnHeader ? t(viewColumnHeader) : t('databases.well-architect.impacted-resources')}
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
                    <DsTypography variant="Regular_14" className={isDisable ? styles.disabled : ''}>
                        {cellData || t('databases.general.not-available-table-columns')}
                    </DsTypography>
                );
            }
        },
        {
            Header: `${t('databases.well-architected-tab.collection-time')}`,
            accessor: 'lastAssessmentTimestamp',
            id: '10',
            width: '250px',
            filterOptions: 'auto',
            renderFilterPanelLabel: (value: string) => formatDateWithTime(value),
            renderCell: (cellData: string, rowData: any) => {
                const isDisable = showDismissed || rowData?.configState === CONFIG_STATES.ACTIVATING;
                return (
                    <div>
                        <DsTypography variant="Regular_14" className={isDisable ? styles.disabled : ''}>
                            {cellData ? formatDateWithTime(cellData) : ''}
                        </DsTypography>
                        {rowData?.isWad && (
                            <DsTypography variant="Regular_13" className={isDisable ? styles.disabled : ''}>
                                {t('databases.inventory.one-time-assessment')}
                            </DsTypography>
                        )}
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
                return (
                    <DsTypography variant="Regular_14" className={isDisable ? styles.disabled : ''}>
                        {cellData}
                    </DsTypography>
                );
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
                              <DsTypography variant="Regular_14" className={isDisable ? styles.disabled : ''}>
                                  {t('databases.general.not-available-table-columns')}
                              </DsTypography>
                          );
                      }
                      return (
                          <DsTypography variant="Regular_14" className={isDisable ? styles.disabled : ''}>
                              {col.renderCell(cellData, rowData, t, handleImpactedResourceDialog)}
                          </DsTypography>
                      );
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
                    <DsTypography variant="Regular_14" className={isDisable ? styles.disabled : ''}>
                        {cellData || t('databases.general.not-available')}
                    </DsTypography>
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
                    <DsTypography variant="Regular_14" className={isDisable ? styles.disabled : ''}>
                        {cellData || t('databases.general.not-available')}
                    </DsTypography>
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
                    <DsTypography variant="Regular_14" className={isDisable ? styles.disabled : ''}>
                        {cellData || t('databases.general.not-available')}
                    </DsTypography>
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
