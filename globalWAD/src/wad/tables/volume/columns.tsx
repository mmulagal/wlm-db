import {
    ResourceColumnId,
    ResourceTextCellRenderer,
    TableScope,
    createWorkloadColumn,
    fileSystemColumn,
    lastAnalyzedColumn,
    optimizationStatusColumn,
    resourceNameColumn,
    type ResourceScanRecord,
    type TableColumn
} from '@tlveng/workload-factory-components';

enum VolumeColumnId {
    CURRENT = 'current',
    RECOMMENDED = 'recommended'
}

export enum VolumeEnrichmentField {
    CURRENT = 'current',
    RECOMMENDED = 'recommended'
}

const VOLUME_NAME_HEADER = 'Volume name';
const VOLUME_WORKLOAD_POPOVER_TEXT =
    'The volume workload definition by Workload Factory or Automatic workload assignment.';

export const volumeNameColumn: TableColumn<ResourceScanRecord> = {
    ...resourceNameColumn,
    header: VOLUME_NAME_HEADER
};

export const volumeWorkloadColumn = createWorkloadColumn(VOLUME_WORKLOAD_POPOVER_TEXT);

export const currentThinProvisioningColumn: TableColumn<ResourceScanRecord> = {
    header: 'Current',
    accessor: `metadata.${VolumeEnrichmentField.CURRENT}`,
    id: VolumeColumnId.CURRENT,
    width: 140,
    sort: { enabled: true },
    filter: { enabled: false },
    Renderer: ResourceTextCellRenderer
};

export const recommendedThinProvisioningColumn: TableColumn<ResourceScanRecord> = {
    header: 'Recommended',
    accessor: `metadata.${VolumeEnrichmentField.RECOMMENDED}`,
    id: VolumeColumnId.RECOMMENDED,
    width: 140,
    sort: { enabled: true },
    filter: { enabled: false },
    Renderer: ResourceTextCellRenderer
};

export const VOLUME_EXTRA_COLUMNS_ANCHOR_ID: string = ResourceColumnId.WORKLOAD;

export const DEFAULT_VOLUME_COLUMNS_BY_SCOPE: Record<TableScope, ReadonlyArray<TableColumn<ResourceScanRecord>>> = {
    [TableScope.GLOBAL_WAD]: [
        volumeNameColumn,
        fileSystemColumn,
        optimizationStatusColumn,
        currentThinProvisioningColumn,
        recommendedThinProvisioningColumn,
        lastAnalyzedColumn
    ],
    [TableScope.FSX_WAD]: [volumeNameColumn]
};
