import { ColumnProps } from '@netapp/design-system/dist/components/Table';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { DsButton, DsToggleSwitch, DsTypography } from '@tlveng/wlm-ds';
import { TooltipInfo } from '@netapp/design-system';
import styles from './RenderTables.module.scss';
import { ReactComponent as ArrowIcon } from '../../../../assets/row_arrow.svg';
import { ReactComponent as Schedule } from '../../../../assets/Schedule.svg';
import {
    ASSESSMENT_CONFIG_NAMES,
    CONFIG_STATE_ACTIONS,
    CONFIG_STATES,
    DBType,
    GETWELL_STATUS,
    WLF_TABS
} from '../../../../utils/consts';
import { checkBoxHandle, expandTableRow, getSelectedFromSelectionState } from '../../../../utils/utilityFunctions';
import { useAppSelector } from '../../../../store/storeHooks';
import RecommendationTable from '../../../GetWell/RecommendationTable/RecommendationTable';
import {
    disableOfflineRows,
    formatAssessmentTableData,
    getConfigStateList,
    mapHostStatusToAssessmentData
} from '../../../DatabaseHomePage/DatabaseHomeUtils';
import TooltipComponent from '../../../../common/TooltipComponent/TooltipComponent';
import { setGwPageLoadInstanceData } from '../../../../store/workloadFactory/getWellOptimizeSlice';
import FirstColumnComponent from './FirstColumnComponent';
import { initialDashboardInnerPageOptimizeColState } from '../../../../utils/manageColumnUtils';
import { useTable } from '../../../../common/Lib/Table/useTable';
import { TableTopBar } from '../../../../common/Lib/Table/TableTopBar';
import { Table } from '../../../../common/Lib/Table/Table';
import { engineTypeBasedResourceStr } from '../../../WellArchitectedTab/WellArchitectedTabUtils';
import { ReactComponent as NotActive } from '../../../../assets/ic_not_active.svg';
import { ReactComponent as Optimized } from '../../../../assets/optimized.svg';
import { ReactComponent as UnderProvisioned } from '../../../../assets/under-provisioned.svg';
import { ReactComponent as InProgress } from '../../../../assets/In Progress.svg';
import { setSelectedRowsForOptimize } from '../../../../store/workloadFactory/databaseHomeSlice';
import BulkCombineActionController from '../../../../common/BulkAction/BulkCombineActionController';
import {
    bulkDismissPostponeDisableCheck,
    calculatePostponeInfo,
    sortOptimizeDashboardInnerTable
} from '../DashboardInnerPageHelper';
import { ButtonWithDropdown } from '../../../../common/ButtonWithDropdown/ButtonWithDropdown';
import {
    disableOptimizeCheckBoxForErrCase,
    disableOptimizeCheckBoxForOptimizeCase,
    isMssqlHaDeployment,
    isWadExcludedConfig
} from '../../../GetWell/GetWellUtils';
import { GENERAL } from '../../../../utils/appConstants';

interface DashboardMultiTableConfigProps {
    configType: string;
    handleSingleDismissPostpone: any;
    handleBulkDismissPostpone: any;
}

const DashboardMultiTableConfig = ({
    configType,
    handleSingleDismissPostpone,
    handleBulkDismissPostpone
}: DashboardMultiTableConfigProps) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [showDismissed, setShowDismissed] = useState(false);

    const { allmssqlHostAssessmentData, allOracleHostAssessmentData, inventoryTableData, getDatabaseHosts } =
        useAppSelector(state => state.inventoryV2);
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = useAppSelector(state => state.headers);
    const { credentialData } = useAppSelector(state => state.headers.getCredentials);
    const { regionsData } = useAppSelector(state => state.headers.getRegions);
    const { configEngineType, inProgressStateData, inProgressOptimizationData } = useAppSelector(
        state => state.getWellOptimize
    );
    const { selectedRowsForOptimize } = useAppSelector(state => state.databaseHome);

    const tableData = useMemo(() => {
        let ontapConfigAssessmentData: any = [];
        const uniqueResourceList: Array<string> = [];
        let assessmentRows = null;
        if (configEngineType === DBType.ORACLE) {
            assessmentRows = allOracleHostAssessmentData;
        } else {
            assessmentRows = allmssqlHostAssessmentData;
        }
        assessmentRows?.map((hostData: any) => {
            if (
                (!hostData?.isWad && !headerSelectedMultiCredIdsList.includes(hostData?.credentialId)) ||
                (!hostData?.isWad && !headerSelectedMultiRegionIdsList.includes(hostData?.regionId)) ||
                uniqueResourceList.includes(hostData?.databaseHostId)
            ) {
                return;
            }
            uniqueResourceList.push(hostData?.databaseHostId);

            const matchingCredEntry =
                credentialData && credentialData?.find(entry => entry.credentialsId === hostData?.credentialId);

            const matchingRegionEntry =
                regionsData && regionsData?.regions?.find(entry => entry.regionCode === hostData?.regionId);

            hostData?.instancesAssessment?.map((instanceData: any) => {
                if (!instanceData?.error && instanceData?.assessments?.lastAssessmentTimestamp) {
                    let mergedData: any = [];
                    let mergedDismissedData: any = [];
                    if (configType === ASSESSMENT_CONFIG_NAMES.ONTAP_CAPS) {
                        const lunsData = instanceData?.assessments?.storage?.configuration?.luns;
                        const volData = instanceData?.assessments?.storage?.configuration?.volumes;
                        mergedData = [
                            ...(lunsData?.map((item: any) => ({ ...item, type: 'lun', id: item?.name })) || []),
                            ...(volData?.map((item: any) => ({ ...item, type: 'volume', id: item?.name })) || [])
                        ];
                        mergedDismissedData = [
                            ...(instanceData?.assessments?.dismissedConfigurations?.storage?.configuration?.luns || []),
                            ...(instanceData?.assessments?.dismissedConfigurations?.storage?.configuration?.volumes ||
                                [])
                        ];
                    } else if (configType === ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM) {
                        mergedData = [
                            ...(instanceData?.assessments?.storage?.configuration?.os?.map((item: any) => ({
                                ...item,
                                type: 'os',
                                id: item?.name
                            })) || [])
                        ];
                        mergedDismissedData = [
                            ...(instanceData?.assessments?.dismissedConfigurations?.storage?.configuration?.os || [])
                        ];
                    } else if (configType === ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY) {
                        mergedData = [
                            ...(instanceData?.assessments?.highAvailability?.map((item: any) => ({
                                ...item,
                                id: item?.name
                            })) || [])
                        ];
                        mergedDismissedData =
                            instanceData?.assessments?.dismissedConfigurations?.highAvailability || [];
                    }

                    if (
                        configType === ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY &&
                        !isMssqlHaDeployment(instanceData?.assessments?.deploymentType)
                    ) {
                        return;
                    }

                    // Skip WAD-excluded configurations for WAD (offline assessment) instances
                    if (isWadExcludedConfig(configType, hostData?.isWad, configEngineType)) {
                        return;
                    }

                    const errorCase =
                        (instanceData?.assessments?.storage?.configuration?.luns?.[0]?.errorMessage &&
                            instanceData?.assessments?.storage?.configuration?.volumes?.[0]?.errorMessage) ||
                        instanceData?.assessments?.storage?.errorMessage;

                    const fullData = formatAssessmentTableData(mergedData, mergedDismissedData, configEngineType);
                    const notOptimized = fullData.filter(
                        (item: any) =>
                            item.status !== GETWELL_STATUS.OPTIMIZED &&
                            !item?.errorMessage &&
                            (item.configState === CONFIG_STATES.ACTIVE || item.configState === CONFIG_STATES.ACTIVATING)
                    );

                    const totalRows = fullData.filter(
                        (item: any) =>
                            !item?.errorMessage &&
                            (item.configState === CONFIG_STATES.ACTIVE || item.configState === CONFIG_STATES.ACTIVATING)
                    );

                    let assessmentStatus = '';

                    if (!errorCase) {
                        if (notOptimized?.length === 0 && mergedData.length > 0) {
                            assessmentStatus = GETWELL_STATUS.OPTIMIZED;
                        } else if (notOptimized?.length > 0) {
                            assessmentStatus = GETWELL_STATUS.NOT_OPTIMIZED;
                        }
                    }

                    ontapConfigAssessmentData.push({
                        id: `${hostData?.databaseHostId}_${instanceData?.databaseInstanceId}`,
                        credentialId: hostData?.credentialId,
                        regionId: hostData?.regionId,
                        databaseHostId: hostData?.databaseHostId,
                        instanceId: instanceData?.databaseInstanceId,
                        serverInstanceName: instanceData?.databaseInstanceName,
                        configuration: !errorCase ? `${notOptimized.length} out of ${totalRows.length}` : '0 out of 0',
                        hostName: hostData?.databaseHostName,
                        fullData,
                        credentialName: matchingCredEntry?.name,
                        regionName: matchingRegionEntry?.regionName,
                        accountId: matchingCredEntry?.providerAccountId,
                        assessmentStatus,
                        configStateList: getConfigStateList(
                            mergedData,
                            mergedDismissedData,
                            configEngineType,
                            fullData
                        ),
                        instanceAssessments: instanceData?.assessments,
                        isWad: hostData?.isWad
                    });
                }
            });
        });
        ontapConfigAssessmentData = sortOptimizeDashboardInnerTable(ontapConfigAssessmentData);

        const tableRows = mapHostStatusToAssessmentData(
            inventoryTableData,
            ontapConfigAssessmentData,
            getDatabaseHosts?.fullHostDataLoading || getDatabaseHosts?.databaseHostsLoading
        );
        return disableOfflineRows(tableRows);
    }, [
        allmssqlHostAssessmentData,
        allOracleHostAssessmentData,
        inventoryTableData,
        getDatabaseHosts,
        headerSelectedMultiCredIdsList,
        headerSelectedMultiRegionIdsList
    ]);

    // Update tableData when selection changes
    const updatedTableData = useMemo(() => {
        if (inProgressOptimizationData?.[configType]?.length) {
            return disableOptimizeCheckBoxForOptimizeCase(tableData, configType, selectedRowsForOptimize, t);
        }
        return disableOptimizeCheckBoxForErrCase(tableData, configType, t);
    }, [selectedRowsForOptimize, tableData, inProgressOptimizationData, configType]);

    // Calculate counts and filtered data
    const { filteredData, dismissedCount, nonDismissedCount, totalCount, isToggleDisabled } = useMemo(() => {
        const total = updatedTableData?.length || 0;
        const dismissed =
            updatedTableData?.filter(
                (row: any) =>
                    row.configStateList.includes(CONFIG_STATES.DISMISSED) ||
                    row.configStateList.includes(CONFIG_STATES.POSTPONED)
            )?.length || 0;
        const nonDismissed =
            updatedTableData?.filter(
                (row: any) =>
                    row.configStateList?.length === 0 ||
                    row.configStateList.includes(CONFIG_STATES.ACTIVE) ||
                    row.configStateList.includes(CONFIG_STATES.ACTIVATING)
            )?.length || 0;

        const filtered = showDismissed
            ? updatedTableData?.filter(
                  (row: any) =>
                      row.configStateList.includes(CONFIG_STATES.DISMISSED) ||
                      row.configStateList.includes(CONFIG_STATES.POSTPONED)
              ) || []
            : updatedTableData?.filter(
                  (row: any) =>
                      row.configStateList?.length === 0 ||
                      row.configStateList.includes(CONFIG_STATES.ACTIVE) ||
                      row.configStateList.includes(CONFIG_STATES.ACTIVATING)
              ) || [];

        return {
            filteredData: filtered,
            dismissedCount: dismissed,
            nonDismissedCount: nonDismissed,
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
    }, [dismissedCount, nonDismissedCount, totalCount, showDismissed, isToggleDisabled]);

    // Reset toggle to false when there are no dismissed items
    useEffect(() => {
        if (isToggleDisabled && showDismissed) {
            setShowDismissed(false);
        }
    }, [isToggleDisabled]);

    const handleStateOperation = (operationType: string) => {
        handleBulkDismissPostpone(configType, selectedRowsForOptimize, operationType, configEngineType);
    };

    const handleToggle = (checked: boolean) => {
        setShowDismissed(checked);
        // Clear selection when toggling
        checkBoxHandle(tableProps.selectionState, selectedRowsForOptimize, dispatch);
    };

    // Determine if dismiss/postpone buttons should be disabled (for optimized rows)
    const { isDismissDisabled, dismissDisableMsg, isPostponeDisabled, postponeDisableMsg } =
        bulkDismissPostponeDisableCheck(selectedRowsForOptimize, t);

    const lastColDetails = () => ({
        id: '8',
        Header: '',
        accessor: '',
        isSticky: true,
        width: showDismissed ? '486px' : '250px',
        renderCell: (cellData: any, rowData: any, { updateRowState, rowsState }: any) => {
            const currentRowState = rowsState[rowData.id];
            const hasPostpone =
                rowData?.configStateList?.length === 1 && rowData?.configStateList.includes(CONFIG_STATES.POSTPONED);
            const startTime = rowData?.configObj?.startTime || rowData?.fullData?.[0]?.dismissedObj?.startTime;
            const endTime = rowData?.configObj?.endTime || rowData?.fullData?.[0]?.dismissedObj?.endTime;
            const isWadRow = rowData?.isWad;
            const wadDisabledMessage =
                configEngineType === DBType.ORACLE
                    ? t('databases.wad.tab-disabled-message-oracle')
                    : t('databases.wad.tab-disabled-message');

            return (
                <div className={styles.menuContainer}>
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
                    ) : !showDismissed ? (
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
                    ) : (
                        <div className={styles.reactiveButtonContainer}>
                            <div className={styles.postpone}>
                                {hasPostpone && (
                                    <div className={styles.postponeContainer}>
                                        <div>
                                            <Schedule />
                                        </div>
                                        <DsTypography variant="Regular_14">
                                            {t('databases.well-architect.postponed-for-30-days')}
                                        </DsTypography>
                                        {endTime &&
                                            startTime &&
                                            (() => {
                                                const postponeInfo = calculatePostponeInfo({ startTime, endTime });
                                                return postponeInfo ? (
                                                    <TooltipInfo isAppendedToBody>
                                                        <DsTypography variant="Regular_13">
                                                            {t('databases.well-architect.postpone-date')}{' '}
                                                            {postponeInfo.postponeDate}.
                                                        </DsTypography>
                                                        <DsTypography variant="Regular_13">
                                                            {postponeInfo.daysLeft}{' '}
                                                            {t('databases.well-architect.days-left')}
                                                        </DsTypography>
                                                    </TooltipInfo>
                                                ) : null;
                                            })()}
                                    </div>
                                )}
                                {!hasPostpone && <div style={{ width: '204px' }} />}
                            </div>
                            <div>
                                <DsButton
                                    isThin
                                    variant="secondary"
                                    isDisabled={selectedRowsForOptimize?.length > 0}
                                    onClick={() => {
                                        handleSingleDismissPostpone(
                                            rowData,
                                            configType,
                                            CONFIG_STATE_ACTIONS.ACTIVE,
                                            configEngineType
                                        );
                                    }}
                                >
                                    {t('databases.well-architect.reactivate')}
                                </DsButton>
                            </div>
                        </div>
                    )}
                    {!rowData?.cellProps?.isDisabled && (
                        <div className={styles.arrow}>
                            <ArrowIcon
                                className={currentRowState?.isExpanded ? styles['arrow-down'] : ''}
                                onClick={(e: any) => {
                                    e.stopPropagation();
                                    expandTableRow(updateRowState, rowData, currentRowState, rowsState);
                                }}
                            />
                        </div>
                    )}
                    {rowData?.cellProps?.isDisabled && (
                        <div className={styles.arrow}>
                            <TooltipComponent
                                title={rowData?.cellProps?.selectionProps?.title}
                                placement="bottom"
                                width="278px"
                                height="30px"
                            >
                                <ArrowIcon className={styles['arrow-disable']} />
                            </TooltipComponent>
                        </div>
                    )}
                </div>
            );
        }
    });

    const TableColDefs: ColumnProps[] = [
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
            width: '266px',
            renderCell: (cellData: any, rowData: any) => <FirstColumnComponent rowData={rowData} />
        },
        {
            Header: `${t('databases.well-architect.dashboard-table-headers.well-architected-status')}`,
            accessor: 'assessmentStatus',
            id: '9',
            width: '220px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                const isDisable =
                    showDismissed ||
                    (rowData?.configStateList?.length === 1 &&
                        rowData?.configStateList[0] === CONFIG_STATES.ACTIVATING);
                if (isDisable || !rowData?.configStateList.includes(CONFIG_STATES.ACTIVE)) {
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
            Header: `${t('databases.well-architect.dashboard-table-headers.host-name')}`,
            accessor: 'hostName',
            id: '2',
            width: '200px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                const isDisable =
                    showDismissed ||
                    (rowData?.configStateList?.length === 1 &&
                        rowData?.configStateList[0] === CONFIG_STATES.ACTIVATING);
                return (
                    <DsTypography variant="Regular_14" className={isDisable ? styles.disabled : ''}>
                        {cellData}
                    </DsTypography>
                );
            }
        },
        {
            Header: `${t('databases.well-architect.dashboard-table-headers.not-optimized-configuration')}`,
            accessor: 'configuration',
            id: '3',
            width: '200px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                const isDisable =
                    showDismissed ||
                    (rowData?.configStateList?.length === 1 &&
                        rowData?.configStateList[0] === CONFIG_STATES.ACTIVATING);
                if (isDisable) {
                    return (
                        <DsTypography variant="Regular_14" className={isDisable ? styles.disabled : ''}>
                            {t('databases.general.not-available-table-columns')}
                        </DsTypography>
                    );
                }
                return (
                    <DsTypography variant="Regular_14" className={isDisable ? styles.disabled : ''}>
                        {cellData || t('databases.general.not-available-table-columns')}
                    </DsTypography>
                );
            }
        },
        {
            id: '4',
            Header: `${t('databases.well-architect.dashboard-table-headers.aws-credentials')}`,
            accessor: 'credentialName',
            filterOptions: 'auto',
            width: '180px',
            renderCell: (cellData: string, rowData: any) => {
                const isDisable =
                    showDismissed ||
                    (rowData?.configStateList?.length === 1 &&
                        rowData?.configStateList[0] === CONFIG_STATES.ACTIVATING);
                return (
                    <DsTypography variant="Regular_14" className={isDisable ? styles.disabled : ''}>
                        {cellData || t('databases.general.not-available-table-columns')}
                    </DsTypography>
                );
            }
        },
        {
            id: '5',
            Header: `${t('databases.well-architect.dashboard-table-headers.aws-account')}`,
            accessor: 'accountId',
            filterOptions: 'auto',
            width: '180px',
            renderCell: (cellData: string, rowData: any) => {
                const isDisable =
                    showDismissed ||
                    (rowData?.configStateList?.length === 1 &&
                        rowData?.configStateList[0] === CONFIG_STATES.ACTIVATING);
                return (
                    <DsTypography variant="Regular_14" className={isDisable ? styles.disabled : ''}>
                        {cellData || t('databases.general.not-available-table-columns')}
                    </DsTypography>
                );
            }
        },
        {
            id: '6',
            Header: `${t('databases.well-architect.dashboard-table-headers.region')}`,
            accessor: 'regionName',
            filterOptions: 'auto',
            width: '180px',
            renderCell: (cellData: string, rowData: any) => {
                const isDisable =
                    showDismissed ||
                    (rowData?.configStateList?.length === 1 &&
                        rowData?.configStateList[0] === CONFIG_STATES.ACTIVATING);
                return (
                    <DsTypography variant="Regular_14" className={isDisable ? styles.disabled : ''}>
                        {cellData || t('databases.general.not-available-table-columns')}
                    </DsTypography>
                );
            }
        },
        lastColDetails()
    ];

    const [scrollPos, setScrollPos] = useState(0);

    useEffect(() => {
        const root = divRef.current;
        if (!root) return;

        let outerScrollEl = root.querySelector<HTMLElement>("[class*='horizontal-scroll']");
        let innerScrollEl = root.querySelector<HTMLElement>(
            "[class*='expanded-row-section'] [class*='horizontal-scroll']"
        );

        const onOuterScroll = () => {
            if (!innerScrollEl || !innerScrollEl.isConnected) {
                innerScrollEl = root.querySelector<HTMLElement>(
                    "[class*='expanded-row-section'] [class*='horizontal-scroll']"
                );
            }
            if (outerScrollEl && innerScrollEl) {
                innerScrollEl.scrollLeft = outerScrollEl.scrollLeft;
                setScrollPos(outerScrollEl.scrollLeft);
            }
        };

        const attachListeners = () => {
            requestAnimationFrame(() => {
                const latestOuter = root.querySelector<HTMLElement>("[class*='horizontal-scroll']");
                const latestInner = root.querySelector<HTMLElement>(
                    "[class*='expanded-row-section'] [class*='horizontal-scroll']"
                );

                if (outerScrollEl && latestOuter && outerScrollEl !== latestOuter) {
                    outerScrollEl.removeEventListener('scroll', onOuterScroll);
                }
                outerScrollEl = latestOuter || outerScrollEl;
                innerScrollEl = latestInner || innerScrollEl;

                if (outerScrollEl) {
                    outerScrollEl.addEventListener('scroll', onOuterScroll, { passive: true });

                    if (innerScrollEl) {
                        innerScrollEl.scrollLeft = outerScrollEl.scrollLeft;
                    }
                }
            });
        };

        attachListeners();

        const observer = new MutationObserver(() => {
            const maybeOuter = root.querySelector<HTMLElement>("[class*='horizontal-scroll']");
            const maybeInner = root.querySelector<HTMLElement>(
                "[class*='expanded-row-section'] [class*='horizontal-scroll']"
            );

            if (maybeOuter && maybeOuter !== outerScrollEl) {
                if (outerScrollEl) outerScrollEl.removeEventListener('scroll', onOuterScroll);
                outerScrollEl = maybeOuter;
                outerScrollEl.addEventListener('scroll', onOuterScroll, { passive: true });
            }

            if (maybeInner && maybeInner !== innerScrollEl) {
                innerScrollEl = maybeInner;
                onOuterScroll();
            }
        });
        observer.observe(root, { childList: true, subtree: true });

        return () => {
            if (outerScrollEl) outerScrollEl.removeEventListener('scroll', onOuterScroll);
            observer.disconnect();
        };
    }, [filteredData, showDismissed]);
    const divRef = useRef<HTMLDivElement>(null);

    const ExpandedRow = useCallback(
        ({ rowData }: any) => {
            dispatch(
                setGwPageLoadInstanceData({
                    hostname: rowData?.hostName,
                    resourceId: rowData?.databaseHostId,
                    instanceId: rowData?.instanceId,
                    instanceName: rowData?.serverInstanceName,
                    credId: rowData?.credentialId,
                    regionId: rowData?.regionId,
                    storageType: rowData?.sqlServerDeploymentType
                })
            );
            return (
                <RecommendationTable
                    tableData={rowData?.fullData}
                    isLoading={false}
                    optimizePrintState={false}
                    from={WLF_TABS.DASHBOARD}
                    hostId={rowData?.databaseHostId}
                    instanceId={rowData?.instanceId}
                    engineType={configEngineType}
                    showDismissedConfigurations={showDismissed}
                    setShowDismissedConfigurations={setShowDismissed}
                    dashboardInstanceData={rowData}
                    divWidth={divRef.current ? divRef.current.offsetWidth : 0}
                />
            );
        },
        [showDismissed, setShowDismissed]
    );

    const tableComponentProps = {
        ExpandedRow,
        lazyLoadingText: 'Loading'
    };

    const tableProps = useTable({
        // @ts-ignore
        selectAllProps: false,
        // @ts-ignore
        manageColumnsProps: false,
        isHorizontalScroll: true,
        isSorting: false,
        columns: TableColDefs,
        rows: filteredData || [],
        selectionType: 'multiple',
        defaultSelectedRows: [],
        pageSize: 50,
        isManagedColumns: true,
        initialColumnState: initialDashboardInnerPageOptimizeColState
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
        <div className={styles.renderTable} ref={divRef}>
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
                    onClick={() => {}}
                    handleStateOperation={handleStateOperation}
                    showDismissed={showDismissed}
                    isFixDisabled
                    fixDisableMsg=""
                    hideFixButton
                    isDismissDisabled={isDismissDisabled}
                    dismissDisableMsg={dismissDisableMsg}
                    isPostponeDisabled={isPostponeDisabled}
                    postponeDisableMsg={postponeDisableMsg}
                />
            )}
            <Table
                // @ts-ignore
                tableProps={tableProps}
                {...tableComponentProps}
                isDoubleRow
            />
        </div>
    );
};

export default DashboardMultiTableConfig;
