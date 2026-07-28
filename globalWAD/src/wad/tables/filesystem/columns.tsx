import {
    ResourceColumnId,
    TableScope,
    lastAnalyzedColumn,
    optimizationStatusColumn,
    resourceNameColumn,
    type ResourceScanRecord,
    type TableColumn
} from '@tlveng/workload-factory-components/wad';
import { createMetadataFieldColumn } from '../shared/metadataUtils';

enum FileSystemColumnId {
    CURRENT = 'current',
    RECOMMENDED = 'recommended',
    WORKLOAD = 'workload'
}

export enum FileSystemEnrichmentField {
    CURRENT = 'current',
    RECOMMENDED = 'recommended',
    WORKLOAD = 'workload'
}

const FILE_SYSTEM_NAME_HEADER = 'File system name';

export const fileSystemNameColumn: TableColumn<ResourceScanRecord> = {
    ...resourceNameColumn,
    header: FILE_SYSTEM_NAME_HEADER
};

export const fileSystemCurrentColumn = createMetadataFieldColumn({
    header: 'Current value',
    field: FileSystemEnrichmentField.CURRENT,
    id: FileSystemColumnId.CURRENT,
    width: 140,
    sort: { enabled: true },
    filter: { enabled: false }
});

export const fileSystemRecommendedColumn = createMetadataFieldColumn({
    header: 'Recommended value',
    field: FileSystemEnrichmentField.RECOMMENDED,
    id: FileSystemColumnId.RECOMMENDED,
    width: 140,
    sort: { enabled: true },
    filter: { enabled: false }
});

export const fileSystemWorkloadColumn = createMetadataFieldColumn({
    header: 'Workload',
    field: FileSystemEnrichmentField.WORKLOAD,
    id: FileSystemColumnId.WORKLOAD,
    width: 110,
    sort: { enabled: true },
    filter: { enabled: true }
});

export const headroomFileSystemColumns: ReadonlyArray<TableColumn<ResourceScanRecord>> = [
    fileSystemNameColumn,
    optimizationStatusColumn,
    fileSystemCurrentColumn,
    fileSystemRecommendedColumn,
    fileSystemWorkloadColumn,
    lastAnalyzedColumn
];

export const FILE_SYSTEM_EXTRA_COLUMNS_ANCHOR_ID: string = ResourceColumnId.WORKLOAD;

export const DEFAULT_FILE_SYSTEM_COLUMNS_BY_SCOPE: Record<
    TableScope,
    ReadonlyArray<TableColumn<ResourceScanRecord>>
> = {
    [TableScope.GLOBAL_WAD]: headroomFileSystemColumns,
    [TableScope.FSX_WAD]: [fileSystemNameColumn]
};
