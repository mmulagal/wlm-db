import {
    ResourceColumnId,
    ResourceTextCellRenderer,
    TableScope,
    lastAnalyzedColumn,
    optimizationStatusColumn,
    resourceNameColumn,
    type ResourceScanRecord,
    type TableColumn
} from '@tlveng/workload-factory-components';

export enum FileSystemColumnId {
    FILE_SYSTEM_ID = 'file-system-id',
    REGION = 'region'
}

export const FileSystemIdColumn: TableColumn<ResourceScanRecord> = {
    id: FileSystemColumnId.FILE_SYSTEM_ID,
    header: 'File system ID',
    accessor: 'id',
    width: 200,
    sort: { enabled: true },
    Renderer: ResourceTextCellRenderer
};

// Assumptions: only for file systems the resource and the parent resource are the same. therefore parentResource.region is used.
export const RegionColumn: TableColumn<ResourceScanRecord> = {
    id: FileSystemColumnId.REGION,
    header: 'Region',
    accessor: 'parentResource.region',
    width: 160,
    sort: { enabled: true },
    filter: { enabled: true },
    Renderer: ResourceTextCellRenderer
};

const FILE_SYSTEM_NAME_HEADER = 'File system name';

export const fileSystemNameColumn: TableColumn<ResourceScanRecord> = {
    ...resourceNameColumn,
    header: FILE_SYSTEM_NAME_HEADER
};

export const FILE_SYSTEM_EXTRA_COLUMNS_ANCHOR_ID: string = ResourceColumnId.OPTIMIZATION_STATUS;

export const DEFAULT_FILE_SYSTEM_COLUMNS_BY_SCOPE: Record<
    TableScope,
    ReadonlyArray<TableColumn<ResourceScanRecord>>
> = {
    [TableScope.GLOBAL_WAD]: [
        fileSystemNameColumn,
        FileSystemIdColumn,
        optimizationStatusColumn,
        RegionColumn,
        lastAnalyzedColumn
    ],
    [TableScope.FSX_WAD]: [fileSystemNameColumn, FileSystemIdColumn, RegionColumn]
};
