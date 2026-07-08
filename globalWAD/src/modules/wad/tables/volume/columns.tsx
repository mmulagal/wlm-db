import {
    ResourceCapacityCellRenderer,
    ResourceColumnId,
    TableScope,
    createWorkloadColumn,
    fileSystemColumn,
    lastAnalyzedColumn,
    optimizationStatusColumn,
    resourceNameColumn,
    withEnrichmentLoader,
    type ResourceScanRecord,
    type TableColumn
} from '@tlveng/workload-factory-components';

enum VolumeColumnId {
    SIZE = 'size'
}

export enum VolumeEnrichmentField {
    SIZE = 'sizeInBytes'
}

const VOLUME_NAME_HEADER = 'Volume name';
const VOLUME_WORKLOAD_POPOVER_TEXT =
    'The volume workload definition by Workload Factory or Automatic workload assignment.';

export const volumeNameColumn: TableColumn<ResourceScanRecord> = {
    ...resourceNameColumn,
    header: VOLUME_NAME_HEADER
};

export const volumeWorkloadColumn = createWorkloadColumn(VOLUME_WORKLOAD_POPOVER_TEXT);

export const volumeSizeColumn: TableColumn<ResourceScanRecord> = {
    header: 'Size',
    accessor: `metadata.${VolumeEnrichmentField.SIZE}`,
    id: VolumeColumnId.SIZE,
    width: 140,
    sort: { enabled: true },
    filter: { enabled: false },
    Renderer: withEnrichmentLoader(ResourceCapacityCellRenderer, VolumeEnrichmentField.SIZE)
};

export const VOLUME_EXTRA_COLUMNS_ANCHOR_ID: string = ResourceColumnId.WORKLOAD;

export const DEFAULT_VOLUME_COLUMNS_BY_SCOPE: Record<TableScope, ReadonlyArray<TableColumn<ResourceScanRecord>>> = {
    [TableScope.GLOBAL_WAD]: [
        volumeNameColumn,
        fileSystemColumn,
        optimizationStatusColumn,
        volumeSizeColumn,
        lastAnalyzedColumn
    ],
    [TableScope.FSX_WAD]: [volumeNameColumn]
};
