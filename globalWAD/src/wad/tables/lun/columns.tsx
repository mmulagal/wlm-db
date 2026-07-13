import {
    ResourceColumnId,
    ResourceTextCellRenderer,
    TableScope,
    fileSystemColumn,
    lastAnalyzedColumn,
    optimizationStatusColumn,
    resourceNameColumn,
    type ResourceScanRecord,
    type TableColumn
} from '@tlveng/workload-factory-components';

enum LunColumnId {
    CURRENT_OS_TYPE = 'currentOsType',
    RECOMMENDED_OS_TYPE = 'recommendedOsType'
}

export enum LunEnrichmentField {
    CURRENT = 'current',
    RECOMMENDED = 'recommended'
}

const LUN_NAME_HEADER = 'LUN name';

export const lunNameColumn: TableColumn<ResourceScanRecord> = {
    ...resourceNameColumn,
    header: LUN_NAME_HEADER
};

export const currentOsTypeColumn: TableColumn<ResourceScanRecord> = {
    header: 'OS type',
    accessor: `metadata.${LunEnrichmentField.CURRENT}`,
    id: LunColumnId.CURRENT_OS_TYPE,
    width: 160,
    sort: { enabled: true },
    filter: { enabled: false },
    Renderer: ResourceTextCellRenderer
};

export const recommendedOsTypeColumn: TableColumn<ResourceScanRecord> = {
    header: 'Recommended value',
    accessor: `metadata.${LunEnrichmentField.RECOMMENDED}`,
    id: LunColumnId.RECOMMENDED_OS_TYPE,
    width: 180,
    sort: { enabled: true },
    filter: { enabled: false },
    Renderer: ResourceTextCellRenderer
};

export const LUN_EXTRA_COLUMNS_ANCHOR_ID: string = ResourceColumnId.OPTIMIZATION_STATUS;

export const DEFAULT_LUN_COLUMNS_BY_SCOPE: Record<TableScope, ReadonlyArray<TableColumn<ResourceScanRecord>>> = {
    [TableScope.GLOBAL_WAD]: [
        lunNameColumn,
        fileSystemColumn,
        optimizationStatusColumn,
        currentOsTypeColumn,
        recommendedOsTypeColumn,
        lastAnalyzedColumn
    ],
    [TableScope.FSX_WAD]: [lunNameColumn]
};
