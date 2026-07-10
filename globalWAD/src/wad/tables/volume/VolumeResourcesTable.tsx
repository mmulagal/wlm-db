import { useCallback, useMemo } from 'react';
import {
    DismissConfirmDialog,
    FixRowActionLabel,
    ResourceColumnId,
    TableScope,
    WadResourcesTable,
    resourceRowActionColumn,
    useResourceTableActions,
    type BulkAction,
    type ResourceScanRecord,
    type TableColumn,
    type WadApi
} from '@tlveng/workload-factory-components';
import { createFixBulkAction } from '../shared/bulkActions';
import { spliceExtras } from '../shared/columns';
import { DEFAULT_VOLUME_COLUMNS_BY_SCOPE, VOLUME_EXTRA_COLUMNS_ANCHOR_ID } from './columns';
import { resolveVolumeConfiguration } from './configurations';

const VOLUME_RESOURCE_TYPE_NOUN = { singular: 'volume', plural: 'volumes' };

interface VolumeResourcesTableProps {
    wadApi: WadApi;
    tableScope: TableScope;
}

export const VolumeResourcesTable = ({ wadApi, tableScope }: VolumeResourcesTableProps) => {
    const { configurationId } = wadApi.context;
    const configuration = useMemo(() => resolveVolumeConfiguration(configurationId), [configurationId]);

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
    } = useResourceTableActions({ wadApi, resourceTypeNoun: VOLUME_RESOURCE_TYPE_NOUN });

    const handleFixRow = useCallback(
        (resource: ResourceScanRecord) =>
            configuration.fixRow ? configuration.fixRow(wadApi, resource) : wadApi.openFixModal([resource]),
        [configuration.fixRow, wadApi]
    );

    const handleFixBulk = useCallback(
        (resourceIds: string[]) => {
            const selectedResources = resources.filter(resource => resourceIds.includes(resource.id));
            if (!selectedResources.length) return;
            configuration.fixBulk
                ? configuration.fixBulk(wadApi, selectedResources)
                : wadApi.openFixModal(selectedResources);
        },
        [configuration.fixBulk, resources, wadApi]
    );

    const columns = useMemo<ReadonlyArray<TableColumn<ResourceScanRecord>>>(() => {
        const baseColumns =
            configuration.columns ??
            spliceExtras(
                DEFAULT_VOLUME_COLUMNS_BY_SCOPE[tableScope],
                configuration.extraColumns,
                VOLUME_EXTRA_COLUMNS_ANCHOR_ID
            );
        const ctaColumn = resourceRowActionColumn(
            showDismissed
                ? { label: FixRowActionLabel.REACTIVATE, onClick: handleReactivateRow }
                : { label: FixRowActionLabel.FIX, onClick: handleFixRow }
        );
        return [...spliceExtras(baseColumns, [], ResourceColumnId.LAST_ANALYZED), ctaColumn];
    }, [
        configuration.columns,
        configuration.extraColumns,
        tableScope,
        showDismissed,
        handleFixRow,
        handleReactivateRow
    ]);

    const bulkActions = useMemo<BulkAction[]>(() => {
        if (showDismissed) return [];
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
                dataTestId={`volume-resources-table-${configurationId}`}
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
