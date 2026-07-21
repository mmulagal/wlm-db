import { useCallback, useMemo } from 'react';
import {
    DismissConfirmDialog,
    FixRowActionLabel,
    OptimizationStatus,
    ResourceColumnId,
    TableScope,
    WadResourcesTable,
    resourceRowActionColumn,
    useResourceTableActions,
    type BulkAction,
    type ResourceScanRecord,
    type TableColumn,
    type WadApi
} from '@tlveng/workload-factory-components/wad';
import { createFixBulkAction } from '../shared/bulkActions';
import { spliceExtras } from '../shared/columns';
import { DEFAULT_LUN_COLUMNS_BY_SCOPE, LUN_EXTRA_COLUMNS_ANCHOR_ID } from './columns';
import { resolveLunConfiguration } from './configurations';

const LUN_RESOURCE_TYPE_NOUN = { singular: 'LUN', plural: 'LUNs' };

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
        rowMenu,
        counterLabel,
        dismissConfirmCopy,
        confirmDismiss,
        cancelDismiss,
        isDismissSubmitting
    } = useResourceTableActions({ wadApi, resourceTypeNoun: LUN_RESOURCE_TYPE_NOUN });

    const handleFixRow = useCallback(
        (resource: ResourceScanRecord) =>
            configuration.fixRow ? configuration.fixRow(wadApi, resource) : wadApi.openFixModal([resource]),
        [configuration, wadApi]
    );

    const handleFixBulk = useCallback(
        (resourceIds: string[]) => {
            const selectedResources = resources.filter(resource => resourceIds.includes(resource.id));
            if (!selectedResources.length) return;
            if (configuration.fixBulk) {
                configuration.fixBulk(wadApi, selectedResources);
            } else {
                wadApi.openFixModal(selectedResources);
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
                resourceRowActionColumn({
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
            resourceRowActionColumn({
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
        if (showDismissed || !configuration.supportsBulkFix) return [];
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
                rowMenu={rowMenu}
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
