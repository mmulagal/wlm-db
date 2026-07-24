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
import { DEFAULT_LUN_COLUMNS_BY_SCOPE, LUN_EXTRA_COLUMNS_ANCHOR_ID } from './columns';
import { resolveLunConfiguration } from './configurations';

const BLOCK_DEVICE_RESOURCE_TYPE_NOUN = { singular: 'block device', plural: 'block devices' };

interface LunResourcesTableProps {
    wadApi: WadApi;
    tableScope: TableScope;
}

export const LunResourcesTable = ({ wadApi, tableScope }: LunResourcesTableProps) => {
    const { configurationId } = wadApi.context;
    const configuration = useMemo(() => resolveLunConfiguration(configurationId), [configurationId]);

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
    } = useResourceTableActions({ wadApi, resourceTypeNoun: BLOCK_DEVICE_RESOURCE_TYPE_NOUN });

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

            if (configuration.fixBulk) {
                configuration.fixBulk(wadApi, fixableResources);
            } else {
                wadApi.openFixModal(fixableResources);
            }
        },
        [configuration, resources, wadApi]
    );

    const columns = useMemo<ReadonlyArray<TableColumn<ResourceScanRecord>>>(() => {
        const isFixDisabled = (row: ResourceScanRecord) => row.optimizationStatus !== OptimizationStatus.NOT_OPTIMIZED;
        const baseColumns =
            configuration.columns ??
            spliceExtras(
                DEFAULT_LUN_COLUMNS_BY_SCOPE[tableScope],
                configuration.extraColumns,
                LUN_EXTRA_COLUMNS_ANCHOR_ID
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
                dataTestId={`lun-resources-table-${configurationId}`}
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
