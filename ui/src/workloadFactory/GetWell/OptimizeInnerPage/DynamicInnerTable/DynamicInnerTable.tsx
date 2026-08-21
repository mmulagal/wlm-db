/**
 * DynamicInnerTable - Generic Table Component for ALL GetWell Inner Pages
 *
 * Replaces all individual table components (StorageTierOptimizeTable, LogDriveSizeOptimizeTable, etc.)
 * Renders tables dynamically based on column configuration from the registry.
 * Supports bulk actions, selection, and WAD (offline assessment) styling.
 */

import { Table, useTable, TableTopBar, DsButton, Popover, DsTypography } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import styles from '../InnerTables/InnerTable.module.scss';
import { checkBoxHandle, getSelectedFromSelectionState } from '../../../../utils/utilityFunctions';
import { setSelectedRowsForOptimizeInnerPage } from '../../../../store/workloadFactory/databaseHomeSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import BulkActionContainer from '../../../../common/BulkAction/BulkActionContainer';
import { getWadCellProps } from '../../GetWellUtils';
import { ReactComponent as TooltipIcon } from '../../../../assets/tooltipGrey.svg';
import {
    buildSubConfigValues,
    ColumnConfig,
    pluralizeResourceType,
    getConfigEntry
} from '../../../../utils/configRegistry';
import {
    ASSESSMENT_COLUMN_KEYS,
    ASSESSMENT_CONFIG_IDS,
    DBType,
    GETWELL_STATUS,
    RSS_COLUMN_KEYS,
    PATCH_SCAN_FIELD,
    WIZARD_TYPE
} from '../../../../utils/consts';
import { normalizeResourceTypeCasing } from '../../../../utils/resourceUtils';
import { useGetMissingPatchAssessmentDataQuery } from '../../../../utils/apiService';
import { getTableLazyLoadingComponentProps } from '../../../../common/Lib/Table/tableLazyLoadingProps';

interface DynamicInnerTableProps {
    configId: string;
    data: any;
    columnConfig?: ColumnConfig;
    engineType: string;
    isWad?: boolean;
    canOptimize?: boolean;
    isViewOnly?: boolean;
    handleBulkAction: () => void;
    handleRowFix?: (rowData: any) => void;
    crrPrefetchLoading?: boolean;
    optimizingInstanceData?: boolean;
}

const DynamicInnerTable = ({
    configId,
    data,
    columnConfig,
    engineType,
    isWad = false,
    canOptimize = true,
    isViewOnly = false,
    handleBulkAction,
    handleRowFix,
    crrPrefetchLoading = false,
    optimizingInstanceData = false
}: DynamicInnerTableProps) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { selectedRowsForOptimizeInnerPage } = useAppSelector((state: any) => state.databaseHome);
    const {
        inProgressOptimizationData,
        selectedResourceId,
        selectedGwInstanceCredId,
        selectedGwInstanceRegionId,
        selectedDatabaseInstance,
        driftAssessmentData
    } = useAppSelector((state: any) => state.getWellOptimize);

    // Check if this is a patch config and get patch field/columns from registry
    const configEntry = useMemo(() => {
        if (!configId) return undefined;
        return getConfigEntry(configId, engineType);
    }, [configId, engineType]);

    const isPatchConfig = configEntry?.dialogContent?.features?.showPatchTable ?? false;

    // Bulk-only configs: rows are pre-selected, checkboxes locked, and fixed via bulk action only (no per-row Fix button)
    const isBulkOnlyConfig =
        (configId === ASSESSMENT_CONFIG_IDS.MULTIPATH_IO_SESSIONS && engineType === DBType.ORACLE) ||
        (configId === ASSESSMENT_CONFIG_IDS.MULTIPATH_CONFIGURATION && engineType === DBType.ORACLE) ||
        (configId === ASSESSMENT_CONFIG_IDS.DNFS_CONFIGURATION_FILE && engineType === DBType.ORACLE) ||
        (configId === ASSESSMENT_CONFIG_IDS.MPIO_ISCSI_COUNT && engineType === DBType.MSSQL);

    const patchField = useMemo(() => {
        if (!configEntry?.dialogContent?.features?.showPatchTable) return '';
        return (configEntry?.dialogContent?.features as any)?.patchField || '';
    }, [configEntry]);

    const patchColumns = useMemo(() => {
        if (!configEntry?.dialogContent?.features?.showPatchTable) return [];
        return (configEntry?.dialogContent?.features as any)?.patchColumns || [];
    }, [configEntry]);

    // Fetch patch data for patch configs
    const hasIds = Boolean(
        selectedGwInstanceCredId && selectedGwInstanceRegionId && selectedResourceId && selectedDatabaseInstance
    );

    const { data: missingPatchResponse, isFetching: isPatchDataLoading } = useGetMissingPatchAssessmentDataQuery(
        {
            dbType: engineType === DBType.ORACLE ? WIZARD_TYPE.ORACLE : WIZARD_TYPE.MSSQL,
            credentialId: selectedGwInstanceCredId,
            regionId: selectedGwInstanceRegionId,
            databaseHostId: selectedResourceId,
            instanceId: selectedDatabaseInstance,
            field: PATCH_SCAN_FIELD[patchField as keyof typeof PATCH_SCAN_FIELD]
        },
        { skip: !isPatchConfig || !hasIds || !patchField }
    );

    // Transform API data to table rows
    // Returns empty array when:
    // 1. data.errorMessage exists (assessment hasn't run or failed)
    // 2. violationDetails/objectsInViolation are empty (no violations found)
    // 3. Custom dataMapping sources return no data
    const tableData = useMemo(() => {
        // Handle patch configs separately
        if (isPatchConfig) {
            // While loading, return empty array - table will show loading state via isLazyLoading
            if (isPatchDataLoading) {
                return [];
            }

            if (missingPatchResponse) {
                const instances =
                    (
                        missingPatchResponse as {
                            ec2InstancesToPatch?: Array<{
                                ec2InstanceName?: string;
                                missingPatchDetails?: Record<string, unknown>[];
                            }>;
                        }
                    )?.ec2InstancesToPatch ?? [];

                return instances.flatMap((inst, instIdx) =>
                    (inst?.missingPatchDetails ?? []).map((patch: any, patchIdx) => {
                        const mappedPatch: any = {
                            ...patch,
                            instanceName: inst?.ec2InstanceName,
                            id: `${instIdx}-${patchIdx}`
                        };

                        // Oracle OS patch requires field mapping
                        if (configId === ASSESSMENT_CONFIG_IDS.OPERATING_SYSTEM_PATCH && engineType === DBType.ORACLE) {
                            mappedPatch.component = patch.classification;
                            mappedPatch.packageName = patch.title;
                            mappedPatch.updateType = patch.state;
                        }

                        return mappedPatch;
                    })
                );
            }

            // No data available yet
            return [];
        }

        // Early return if errorMessage exists - show empty table with no data state
        if (data?.errorMessage) {
            return [];
        }

        let id = 0;
        const addRowMeta = (row: any) => {
            const baseProps = { ...row, id: String(id++), cellProps: getWadCellProps(isWad, t) };

            // Bulk-only configs (e.g. Oracle multipath-io-sessions/multipath-configuration, MSSQL mpio-iscsi-count):
            // disable checkboxes so they remain checked and cannot be deselected
            if (isBulkOnlyConfig) {
                baseProps.cellProps = {
                    ...baseProps.cellProps,
                    isDisabled: true
                };
            }

            // For log-drive-size and tempdb-drive-size: disable checkboxes for over-provisioned and shared/ignored drives
            if (
                (configId === ASSESSMENT_CONFIG_IDS.LOG_DRIVE_SIZE ||
                    configId === ASSESSMENT_CONFIG_IDS.TEMPDB_DRIVE_SIZE) &&
                row.status
            ) {
                const translatedOverProvisioned = t('databases.well-architect.over-provisioned');
                const translatedSharedDrive = t('databases.well-architect.shared-drive');

                const isOverProvisioned = row.status === translatedOverProvisioned;
                const isSharedDrive = row.status === translatedSharedDrive;

                if (isOverProvisioned || isSharedDrive) {
                    baseProps.cellProps = {
                        ...baseProps.cellProps,
                        isDisabled: true,
                        selectionProps: {
                            title: isOverProvisioned
                                ? configId === ASSESSMENT_CONFIG_IDS.LOG_DRIVE_SIZE
                                    ? t('databases.well-architect.log-drive-over-provisioned-error')
                                    : t('databases.well-architect.tempdb-drive-over-provisioned-error')
                                : t('databases.well-architect.not-optimized-shared-drive')
                        }
                    };
                }
            }

            return baseProps;
        };

        // Handle custom data mapping (read from alternate paths)
        if (columnConfig?.dataMapping?.sources) {
            return columnConfig.dataMapping.sources.flatMap(({ path, status }) => {
                const sourceData = path.split('.').reduce((obj: any, key) => obj?.[key], data);
                if (!Array.isArray(sourceData)) return [];
                return sourceData.map((item: any) =>
                    addRowMeta({
                        // Handle both object items and primitive (string) items
                        ...(typeof item === 'object' ? item : { objectName: item }),
                        // Only inject top-level recommended if the row doesn't have one
                        ...((typeof item !== 'object' || !item.recommended) && { recommended: data?.recommended }),
                        ...(status && { status: t(status) }),
                        // For RSS config, include top-level settings
                        ...(configId === ASSESSMENT_CONFIG_IDS.RSS_CONFIGURATION && {
                            tcpOffloadState: data?.tcpOffloadState,
                            recommendedAdapterSettings: data?.recommendedAdapterSettings
                        })
                    })
                );
            });
        }

        // Aggregate all violationDetails into a single row (e.g. tcp-advanced-options)
        // Used when the API returns one row per parameter but UI should show them combined
        if (columnConfig?.combineRows && data?.violationDetails?.length) {
            const firstViolation =
                Array.isArray(data?.objectsInViolation) && data.objectsInViolation.length > 0
                    ? data.objectsInViolation[0]
                    : '';
            const objectName = typeof firstViolation === 'string' ? firstViolation : '';
            const current = data.violationDetails.map((r: any) => `${r.objectName}=${r.value ?? ''}`).join(', ');
            const recommended = data.violationDetails
                // Fall back to the top-level recommended value (e.g. mpio-iscsi-count) when a
                // row doesn't have its own per-row recommended value
                .map((r: any) => `${r.objectName}=${r.recommended ?? data.recommended ?? ''}`)
                .join(', ');
            const combineMetadataFields = columnConfig?.injectMetadataFields
                ? (driftAssessmentData as any)?.metadata ?? {}
                : {};
            return [addRowMeta({ objectName, value: current, current, recommended, ...combineMetadataFields })];
        }

        // Default: violationDetails
        if (data?.violationDetails?.length) {
            // Top-level recommended and current values are the same for all rows in many configs
            const topRecommended = data?.recommended;
            const topCurrent = data?.current;
            // cluster-quorum: API returns parameter names (e.g. "DynamicQuorum") in violationDetails.objectName
            // but the UI should display the cluster name from objectsInViolation[rowIndex] instead.
            // objectsInViolation is only read for cluster-quorum to avoid unnecessary array access for other configs.
            const isClusterQuorum = configId === ASSESSMENT_CONFIG_IDS.CLUSTER_QUORUM;
            const objectsInViolation: any[] = isClusterQuorum ? data?.objectsInViolation || [] : [];
            const overrideObjectNameFromViolations =
                isClusterQuorum &&
                columnConfig?.objectNameSource === ASSESSMENT_COLUMN_KEYS.OBJECT_NAME_SOURCE_OBJECTS_IN_VIOLATION;
            // Metadata fields (e.g. databaseHostName) injected per-row when the registry requests it
            const metadataFields = columnConfig?.injectMetadataFields
                ? (driftAssessmentData as any)?.metadata ?? {}
                : {};

            return data.violationDetails.map((row: any, index: number) =>
                addRowMeta({
                    ...row,
                    // Inject top-level metadata fields (e.g. databaseHostName) when configured
                    ...metadataFields,
                    // cluster-quorum: replace objectName with cluster name from objectsInViolation[index];
                    // configName preserves the original violationDetails objectName (e.g. "DynamicQuorum")
                    // for the Configuration name column. Only applied when objectsInViolation[index] is a string.
                    ...(overrideObjectNameFromViolations &&
                        typeof objectsInViolation[index] === 'string' && {
                            objectName: objectsInViolation[index],
                            configName: row.objectName
                        }),
                    // Inject top-level current value if the row doesn't have value or current
                    ...(!row.value &&
                        !row.current &&
                        topCurrent !== undefined && { value: topCurrent, current: topCurrent }),
                    // Inject top-level recommended if the row itself doesn't have one
                    recommended: row.recommended ?? topRecommended,
                    ...(columnConfig?.hasSubConfigs ? buildSubConfigValues(row, data?.configDetails) : {})
                })
            );
        }

        // Fallback: objectsInViolation
        // Handle both string[] and object[] cases (e.g., {ontapVolumeName, ontapVolumeUuid})
        if (data?.objectsInViolation?.length) {
            const topCurrent = data?.current;
            const topRecommended = data?.recommended;

            return data.objectsInViolation.map((item: any) => {
                // If item is a string, use it as objectName
                if (typeof item === 'string') {
                    return addRowMeta({
                        objectName: item,
                        // Inject both 'value' and 'current' fields to cover all column accessor cases
                        ...(topCurrent !== undefined && { value: String(topCurrent), current: String(topCurrent) }),
                        ...(topRecommended !== undefined && { recommended: String(topRecommended) })
                    });
                }
                // If item is an object, extract ontapVolumeName
                const objectName = item.ontapVolumeName || JSON.stringify(item);
                return addRowMeta({ ...item, objectName });
            });
        }

        // Return empty array - table will show "no data" state
        return [];
    }, [
        data,
        isWad,
        t,
        columnConfig,
        configId,
        isPatchConfig,
        missingPatchResponse,
        patchField,
        engineType,
        isPatchDataLoading,
        driftAssessmentData
    ]);

    // Build column definitions dynamically from registry
    const TableColDefs: ColumnProps[] = useMemo(() => {
        // Handle patch configs with custom column definitions
        if (isPatchConfig && patchColumns.length > 0) {
            const dataColumns: ColumnProps[] = patchColumns.map((col: any, index: number) => ({
                Header: t(col.header),
                accessor: col.accessor,
                id: String(index + 1),
                isSortable: false,
                filterOptions: 'auto' as const,
                isSticky: index === 0, // First column is sticky
                width: index === 1 ? 'auto' : col.width,
                minWidth: col.width,
                maxWidth: col.width
            }));

            // Add action button column if handleRowFix is provided
            if (handleRowFix) {
                const buttonLabel = t('databases.well-architect.fix');

                const actionColumn: ColumnProps = {
                    Header: '',
                    accessor: 'action',
                    id: String(dataColumns.length + 1),
                    isSortable: false,
                    isSticky: true,
                    width: '230px',
                    renderCell: (_cellData: any, rowData: any) => (
                        <div className={styles.buttonContainer}>
                            <div />
                            <DsButton isThin variant="secondary" onClick={() => handleRowFix(rowData)}>
                                {buttonLabel}
                            </DsButton>
                        </div>
                    )
                };

                dataColumns.push(actionColumn);
            }

            return dataColumns;
        }

        // For non-patch configs, columnConfig is required
        if (!columnConfig) return [];

        const dataColumns: ColumnProps[] = columnConfig.columns.map((col: any, index: number) => ({
            Header: col.label,
            accessor: col.accessor || col.key,
            id: String(index + 1),
            isSortable: false,
            filterOptions: 'auto' as const,
            isSticky: index === 0, // First column is sticky
            width: col.width || 'auto',
            renderCell: (cellData: any, rowData: any) => {
                // snapshot-copy-reserve shows percentage
                if (col.key === 'value' && configId === ASSESSMENT_CONFIG_IDS.SNAPSHOT_COPY_RESERVE) {
                    return cellData != null ? `${cellData}%` : t('databases.general.unavailable');
                }

                if (col.key === 'rss' && typeof cellData === 'boolean') {
                    return cellData ? 'Enabled' : 'Disabled';
                }

                // Percentage values (divergence, drive size percentage)
                if ((col.key === 'divergence' || col.key === 'sizePercentToDataDrive') && cellData != null) {
                    return `${cellData}%`;
                }

                // Databases array - join with comma
                if (col.key === 'databases' && Array.isArray(cellData)) {
                    return cellData.join(', ') || t('databases.general.unavailable');
                }

                // RSS status columns (Network Adapter Settings)
                // First column (adapter name) shows plain text, other columns show Optimized/Not Optimized with tooltip
                if (configId === ASSESSMENT_CONFIG_IDS.RSS_CONFIGURATION && index > 0) {
                    const recommended = rowData?.recommendedAdapterSettings;
                    let isOptimized = false;
                    let tooltipValue = cellData;

                    // Determine if optimized based on column key
                    switch (col.key) {
                        case RSS_COLUMN_KEYS.TCP_OFFLOADING:
                            isOptimized = rowData?.tcpOffloadState === 'Disabled';
                            tooltipValue = rowData?.tcpOffloadState || cellData;
                            break;
                        case RSS_COLUMN_KEYS.NUMBER_OF_RECEIVE_QUEUES:
                            isOptimized = cellData === recommended?.recommendedReceiveQueues;
                            break;
                        case RSS_COLUMN_KEYS.RSS_PROFILE:
                            isOptimized = cellData === recommended?.recommendedRssProfile;
                            break;
                        case RSS_COLUMN_KEYS.RSS_ENABLED:
                            isOptimized = cellData === true;
                            tooltipValue = cellData ? 'Enabled' : 'Disabled';
                            break;
                        case RSS_COLUMN_KEYS.BASE_PROCESSOR_NUMBER:
                            isOptimized = cellData === recommended?.recommendedBaseProcessorNumber;
                            break;
                    }

                    const statusText = isOptimized ? GETWELL_STATUS.OPTIMIZED : GETWELL_STATUS.NOT_OPTIMIZED;
                    return (
                        <div className={styles.rssCell}>
                            <Popover
                                popoverClass=""
                                children={String(tooltipValue)}
                                trigger="hover"
                                container={<TooltipIcon />}
                            />
                            <DsTypography variant="Regular_13">{statusText}</DsTypography>
                        </div>
                    );
                }

                // Handle objects (convert to string) - prevents React "invalid object type" errors
                if (cellData && typeof cellData === 'object' && !Array.isArray(cellData)) {
                    return cellData.ontapVolumeName || JSON.stringify(cellData);
                }

                return cellData || t('databases.general.unavailable');
            }
        }));

        // Add action button column: "Fix" for fixable configs, "View" for view-only configs
        const showFixButton = canOptimize && handleRowFix;
        const showViewButton = !canOptimize && isViewOnly && handleRowFix;
        // CRR for MSSQL: show disabled Fix button (not View)
        const isCrrMssql = configId === ASSESSMENT_CONFIG_IDS.CRR && engineType === DBType.MSSQL;
        // CRR for Oracle: show enabled Fix button (special case for inner page)
        const isCrrOracle = configId === ASSESSMENT_CONFIG_IDS.CRR && engineType === DBType.ORACLE;
        // Bulk-only configs: no per-row fix button (rows are pre-selected and fixed via bulk action)
        if (!isBulkOnlyConfig && (showFixButton || showViewButton || isCrrMssql || isCrrOracle) && handleRowFix) {
            const buttonLabel = t('databases.well-architect.fix');

            const actionColumn = {
                Header: '',
                accessor: 'action',
                id: String(dataColumns.length + 1),
                isSortable: false,
                isSticky: true,
                width: '230px',
                renderCell: (cellData: any, rowData: any) => {
                    // Check if row is disabled (for log/tempdb drive sizing with over-provisioned or shared drives)
                    const isRowDisabled = rowData?.cellProps?.isDisabled;
                    const disabledTooltip = rowData?.cellProps?.selectionProps?.title;

                    // CRR MSSQL: always show disabled Fix button with tooltip
                    if (isCrrMssql) {
                        return (
                            <div className={styles.buttonContainer}>
                                <div />
                                <Popover
                                    isAppendedToBody
                                    children={
                                        <DsTypography variant="Regular_14">
                                            {t('databases.well-architect.fix-disabled')}
                                        </DsTypography>
                                    }
                                    trigger="hover"
                                    container={
                                        <DsButton variant="secondary" isDisabled isThin>
                                            {buttonLabel}
                                        </DsButton>
                                    }
                                />
                            </div>
                        );
                    }

                    // CRR Oracle: always show enabled Continue button (no bulk selection or other disabling logic)
                    if (isCrrOracle) {
                        const isCrrPrefetchLoading = crrPrefetchLoading;
                        const isOptimizing = optimizingInstanceData;
                        const isAnyLoading = isCrrPrefetchLoading || isOptimizing;

                        return (
                            <div className={styles.buttonContainer}>
                                <div />
                                <DsButton
                                    isThin
                                    variant="secondary"
                                    onClick={() => handleRowFix(rowData)}
                                    isDisabled={isAnyLoading}
                                >
                                    {buttonLabel}
                                </DsButton>
                            </div>
                        );
                    }

                    if (
                        showFixButton &&
                        selectedRowsForOptimizeInnerPage &&
                        selectedRowsForOptimizeInnerPage.length > 0
                    ) {
                        return (
                            <div className={styles.buttonContainer}>
                                <div />
                                <Popover
                                    isAppendedToBody
                                    children={
                                        <DsTypography variant="Regular_14">
                                            {t('databases.well-architect.bulk-action-enabled-on-selected')}
                                        </DsTypography>
                                    }
                                    trigger="hover"
                                    delayHide={200}
                                    interactive
                                    container={
                                        <DsButton variant="secondary" isDisabled isThin>
                                            {buttonLabel}
                                        </DsButton>
                                    }
                                />
                            </div>
                        );
                    }

                    // If row is disabled (over-provisioned or shared drive), show disabled button with tooltip
                    if (showFixButton && isRowDisabled && disabledTooltip) {
                        return (
                            <div className={styles.buttonContainer}>
                                <div />
                                <Popover
                                    isAppendedToBody
                                    children={<DsTypography variant="Regular_14">{disabledTooltip}</DsTypography>}
                                    trigger="hover"
                                    container={
                                        <DsButton variant="secondary" isDisabled isThin>
                                            {buttonLabel}
                                        </DsButton>
                                    }
                                />
                            </div>
                        );
                    }

                    // Disable button when:
                    // 1. CRR prefetch is loading (fetching FSx details and links before opening dialog)
                    // 2. OR optimization is in progress (Continue clicked in any optimize dialog)
                    const isCrrPrefetchLoading = crrPrefetchLoading && configId === ASSESSMENT_CONFIG_IDS.CRR;
                    const isOptimizing = optimizingInstanceData;
                    const isAnyLoading = isCrrPrefetchLoading || isOptimizing;

                    return (
                        <div className={styles.buttonContainer}>
                            <div />
                            <DsButton
                                isThin
                                variant="secondary"
                                onClick={() => handleRowFix(rowData)}
                                isDisabled={isAnyLoading}
                            >
                                {buttonLabel}
                            </DsButton>
                        </div>
                    );
                }
            } as unknown as ColumnProps;
            dataColumns.push(actionColumn);
        }

        return dataColumns;
    }, [
        columnConfig,
        configId,
        engineType,
        canOptimize,
        isViewOnly,
        handleRowFix,
        selectedRowsForOptimizeInnerPage,
        t,
        crrPrefetchLoading,
        optimizingInstanceData,
        isPatchConfig,
        patchColumns
    ]);

    // Table props
    const tableProps = useTable({
        // @ts-ignore
        manageColumnsProps: false,
        isHorizontalScroll: false,
        isSorting: false,
        columns: TableColDefs,
        rows: tableData || [],
        pageSize: 50,
        selectionType: isPatchConfig ? 'none' : canOptimize ? 'multiple' : 'none',
        defaultSelectedRows: isBulkOnlyConfig ? tableData.map(row => row.id) : [],
        isLazyLoading: isPatchConfig ? isPatchDataLoading : undefined
    });

    // Handle row selection
    useEffect(() => {
        if (!canOptimize || isPatchConfig) return;

        const rowsData = getSelectedFromSelectionState(tableProps.selectionState, tableData);
        dispatch(setSelectedRowsForOptimizeInnerPage(rowsData));

        if (rowsData.length > 0 && inProgressOptimizationData?.[configId]?.length) {
            checkBoxHandle(tableProps.selectionState, rowsData, dispatch);
        }
    }, [
        tableProps.selectionState,
        canOptimize,
        isPatchConfig,
        configId,
        inProgressOptimizationData,
        tableData,
        dispatch
    ]);

    // Determine table titles
    // For patch configs, use impactedLabel from registry cardMetadata (e.g. "Impacted missing patches")
    // which is already defined consistently for both MSSQL and Oracle patch configs.
    const resourceTypeLabel = isPatchConfig
        ? configEntry?.cardMetadata?.impactedLabel || 'Missing patch'
        : columnConfig?.resourceTypeLabel || 'Item';
    const tableTitle = isPatchConfig
        ? configEntry?.cardMetadata?.impactedLabel || 'Impacted missing patches'
        : columnConfig?.tableTitle || pluralizeResourceType(resourceTypeLabel);

    // If tableTitle starts with "Impacted", create singular form using the resourceTypeLabel
    // e.g., tableTitle: "Impacted volumes", resourceTypeLabel: "Volume" -> "Impacted volume"
    // normalizeResourceTypeCasing restores acronyms (EC2, LUN) after lowercasing the first letter
    const createSingularImpactedLabel = (resourceType: string): string =>
        `Impacted ${normalizeResourceTypeCasing(resourceType.charAt(0).toLowerCase() + resourceType.slice(1))}`;

    const customTableTitle = columnConfig?.tableTitle;
    let singularTitle: string;
    if (tableTitle.startsWith('Impacted ')) {
        singularTitle =
            customTableTitle && !customTableTitle.trimEnd().endsWith('s')
                ? customTableTitle
                : createSingularImpactedLabel(resourceTypeLabel);
    } else {
        singularTitle = resourceTypeLabel;
    }

    const tableComponentProps = getTableLazyLoadingComponentProps(t('databases.general.loading'));

    return (
        <div className={styles['inner-table']}>
            <TableTopBar
                // @ts-ignore
                tableProps={tableProps}
                pluralTitle={tableTitle}
                singularTitle={singularTitle}
            />
            {!isPatchConfig &&
                canOptimize &&
                selectedRowsForOptimizeInnerPage.length > 0 &&
                !optimizingInstanceData && (
                    <BulkActionContainer action={t('databases.well-architect.fix')} onClick={handleBulkAction} />
                )}
            <Table
                // @ts-ignore
                tableProps={tableProps}
                // @ts-ignore
                lazyLoadingText={tableComponentProps.lazyLoadingText}
                isDoubleRow
                key={Date.now()}
            />
        </div>
    );
};

export default DynamicInnerTable;
