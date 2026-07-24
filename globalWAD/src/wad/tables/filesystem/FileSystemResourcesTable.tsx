import { useCallback, useMemo } from 'react';
import {
    DismissConfirmDialog,
    FixRowActionLabel,
    NotificationType,
    OptimizationStatus,
    ResourceColumnId,
    TableScope,
    WadResourcesTable,
    useResourceTableActions,
    type BulkAction,
    type DisableRowSelection,
    type ResourceScanRecord,
    type TableColumn,
    type WadApi
} from '@tlveng/workload-factory-components';
import {
    createFixBulkAction,
    filterNeedsOptimizationResources,
    NO_NEEDS_OPTIMIZATION_BULK_FIX_ERROR
} from '../shared/bulkActions';
import { spliceExtras, stickyResourceRowActionColumn } from '../shared/columns';
import {
    hasMixedWorkloads,
    MIXED_WORKLOAD_BULK_FIX_ERROR,
    MIXED_WORKLOAD_ROW_TOOLTIP,
    readResourceWorkloadType
} from '../shared/metadataUtils';
import { DEFAULT_FILE_SYSTEM_COLUMNS_BY_SCOPE, FILE_SYSTEM_EXTRA_COLUMNS_ANCHOR_ID } from './columns';
import { resolveFileSystemConfiguration } from './configurations';

const FILE_SYSTEM_RESOURCE_TYPE_NOUN = { singular: 'file system', plural: 'file systems' };

interface FileSystemResourcesTableProps {
    wadApi: WadApi;
    tableScope: TableScope;
}

export const FileSystemResourcesTable = ({ wadApi, tableScope }: FileSystemResourcesTableProps) => {
    const { configurationId } = wadApi.context;
    const configuration = useMemo(() => resolveFileSystemConfiguration(configurationId), [configurationId]);

    const {
        resources,
        showDismissed,
        handleDismissBulk,
        handleReactivateRow,
        dismissedView,
        counterLabel,
        dismissConfirmCopy,
        confirmDismiss,
        cancelDismiss,
        isDismissSubmitting
    } = useResourceTableActions({ wadApi, resourceTypeNoun: FILE_SYSTEM_RESOURCE_TYPE_NOUN });

    const handleFixRow = useCallback(
        (resource: ResourceScanRecord) =>
            configuration.fixRow ? configuration.fixRow(wadApi, resource) : wadApi.openFixModal([resource]),
        [configuration, wadApi]
    );

    const handleFixBulk = useCallback(
        (resourceIds: string[]) => {
            const selectedResources = resources.filter(resource => resourceIds.includes(resource.id));
            if (!selectedResources.length) {
                return;
            }

            const fixableResources = filterNeedsOptimizationResources(selectedResources);
            if (!fixableResources.length) {
                wadApi.notify({
                    type: NotificationType.ERROR,
                    message: NO_NEEDS_OPTIMIZATION_BULK_FIX_ERROR
                });
                return;
            }

            if (configuration.restrictBulkSelectionToSameWorkload && hasMixedWorkloads(fixableResources)) {
                wadApi.notify({
                    type: NotificationType.ERROR,
                    message: MIXED_WORKLOAD_BULK_FIX_ERROR
                });
                return;
            }

            if (configuration.fixBulk) {
                configuration.fixBulk(wadApi, fixableResources);
            } else {
                wadApi.openFixModal(fixableResources);
            }
        },
        [configuration, resources, wadApi]
    );

    const disableRowSelection = useCallback<DisableRowSelection>(
        (row, selectedRows) => {
            if (!configuration.restrictBulkSelectionToSameWorkload || selectedRows.length === 0) {
                return undefined;
            }

            const selectedWorkloadType = readResourceWorkloadType(selectedRows[0]);
            if (readResourceWorkloadType(row) === selectedWorkloadType) {
                return undefined;
            }

            return MIXED_WORKLOAD_ROW_TOOLTIP;
        },
        [configuration.restrictBulkSelectionToSameWorkload]
    );

    const columns = useMemo<ReadonlyArray<TableColumn<ResourceScanRecord>>>(() => {
        const isFixDisabled = (row: ResourceScanRecord) => row.optimizationStatus !== OptimizationStatus.NOT_OPTIMIZED;
        const baseColumns =
            configuration.columns ??
            spliceExtras(
                DEFAULT_FILE_SYSTEM_COLUMNS_BY_SCOPE[tableScope],
                configuration.extraColumns,
                FILE_SYSTEM_EXTRA_COLUMNS_ANCHOR_ID
            );

        if (showDismissed) {
            return [
                ...spliceExtras(baseColumns, [], ResourceColumnId.LAST_ANALYZED),
                stickyResourceRowActionColumn({
                    label: FixRowActionLabel.REACTIVATE,
                    onClick: handleReactivateRow
                })
            ];
        }

        if (!configuration.supportsRowFix) {
            return spliceExtras(baseColumns, [], ResourceColumnId.LAST_ANALYZED);
        }

        return [
            ...spliceExtras(baseColumns, [], ResourceColumnId.LAST_ANALYZED),
            stickyResourceRowActionColumn({
                label: FixRowActionLabel.FIX,
                onClick: handleFixRow,
                isDisabled: isFixDisabled
            })
        ];
    }, [
        configuration.columns,
        configuration.extraColumns,
        configuration.supportsRowFix,
        tableScope,
        showDismissed,
        handleFixRow,
        handleReactivateRow
    ]);

    const bulkActions = useMemo<BulkAction[]>(() => {
        if (showDismissed || !configuration.supportsBulkFix) {
            return [];
        }
        return [
            createFixBulkAction(handleFixBulk, {
                isDisabled: !configuration.supportsBulkFix,
                ...(configuration.bulkFixDisabledTooltip !== undefined && {
                    tooltip: configuration.bulkFixDisabledTooltip
                })
            })
        ];
    }, [configuration.supportsBulkFix, configuration.bulkFixDisabledTooltip, showDismissed, handleFixBulk]);

    return (
        <>
            <WadResourcesTable
                wadApi={wadApi}
                onDismiss={handleDismissBulk}
                dismissedView={dismissedView}
                columns={columns}
                bulkActions={bulkActions}
                counterLabel={counterLabel}
                disableRowSelection={disableRowSelection}
                dataTestId={`file-system-resources-table-${configurationId}`}
            />
            {dismissConfirmCopy && (
                <DismissConfirmDialog
                    header={dismissConfirmCopy.header}
                    description={dismissConfirmCopy.description}
                    onConfirm={confirmDismiss}
                    onClose={cancelDismiss}
                    isSubmitting={isDismissSubmitting}
                />
            )}
        </>
    );
};
