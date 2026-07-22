import {
    ResourceColumnId,
    TableScope,
    fileSystemColumn,
    lastAnalyzedColumn,
    optimizationStatusColumn,
    resourceNameColumn,
    type ResourceScanRecord,
    type TableColumn
} from '@tlveng/workload-factory-components';
import { createMetadataFieldColumn } from '../shared/metadataUtils';

enum VolumeColumnId {
    CURRENT = 'current',
    RECOMMENDED = 'recommended',
    SNAPCENTER_CURRENT = 'snapcenterCurrent',
    SNAPCENTER_RECOMMENDED = 'snapcenterRecommended',
    WORKLOAD = 'workload'
}

export enum VolumeEnrichmentField {
    CURRENT = 'current',
    RECOMMENDED = 'recommended',
    WORKLOAD = 'workload'
}

const VOLUME_NAME_HEADER = 'Volume name';

export const volumeNameColumn: TableColumn<ResourceScanRecord> = {
    ...resourceNameColumn,
    header: VOLUME_NAME_HEADER
};

export const volumeCurrentColumn = createMetadataFieldColumn({
    header: 'Current value',
    field: VolumeEnrichmentField.CURRENT,
    id: VolumeColumnId.CURRENT,
    width: 140,
    sort: { enabled: true },
    filter: { enabled: false }
});

export const volumeRecommendedColumn = createMetadataFieldColumn({
    header: 'Recommended value',
    field: VolumeEnrichmentField.RECOMMENDED,
    id: VolumeColumnId.RECOMMENDED,
    width: 140,
    sort: { enabled: true },
    filter: { enabled: false }
});

export const currentSnapcenterSnapshotColumn = createMetadataFieldColumn({
    header: 'Snapshot status',
    field: VolumeEnrichmentField.CURRENT,
    id: VolumeColumnId.SNAPCENTER_CURRENT,
    width: 200,
    sort: { enabled: true },
    filter: { enabled: false }
});

export const recommendedSnapcenterSnapshotColumn = createMetadataFieldColumn({
    header: 'Recommended value',
    field: VolumeEnrichmentField.RECOMMENDED,
    id: VolumeColumnId.SNAPCENTER_RECOMMENDED,
    width: 200,
    sort: { enabled: true },
    filter: { enabled: false }
});

export const volumeWorkloadColumn = createMetadataFieldColumn({
    header: 'Workload',
    field: VolumeEnrichmentField.WORKLOAD,
    id: VolumeColumnId.WORKLOAD,
    width: 110,
    sort: { enabled: true },
    filter: { enabled: true }
});

export const multiComponentVolumeColumns: ReadonlyArray<TableColumn<ResourceScanRecord>> = [
    volumeNameColumn,
    fileSystemColumn,
    optimizationStatusColumn,
    createMetadataFieldColumn({
        header: 'Current value',
        field: VolumeEnrichmentField.CURRENT,
        id: 'volumeMultiComponentCurrent',
        width: 320,
        sort: { enabled: true },
        filter: { enabled: false }
    }),
    createMetadataFieldColumn({
        header: 'Recommended value',
        field: VolumeEnrichmentField.RECOMMENDED,
        id: 'volumeMultiComponentRecommended',
        width: 320,
        sort: { enabled: true },
        filter: { enabled: false }
    }),
    volumeWorkloadColumn,
    lastAnalyzedColumn
];

export const VOLUME_EXTRA_COLUMNS_ANCHOR_ID: string = ResourceColumnId.WORKLOAD;

export const DEFAULT_VOLUME_COLUMNS_BY_SCOPE: Record<TableScope, ReadonlyArray<TableColumn<ResourceScanRecord>>> = {
    [TableScope.GLOBAL_WAD]: [
        volumeNameColumn,
        fileSystemColumn,
        optimizationStatusColumn,
        volumeCurrentColumn,
        volumeRecommendedColumn,
        volumeWorkloadColumn,
        lastAnalyzedColumn
    ],
    [TableScope.FSX_WAD]: [volumeNameColumn]
};
