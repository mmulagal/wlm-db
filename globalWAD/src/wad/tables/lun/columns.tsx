import {
    ResourceColumnId,
    TableScope,
    fileSystemColumn,
    lastAnalyzedColumn,
    optimizationStatusColumn,
    resourceNameColumn,
    type ResourceScanRecord,
    type TableColumn
} from '@tlveng/workload-factory-components/wad';
import { createMetadataFieldColumn } from '../shared/metadataUtils';

enum LunColumnId {
    CURRENT_OS_TYPE = 'currentOsType',
    RECOMMENDED_OS_TYPE = 'recommendedOsType',
    WORKLOAD = 'workload'
}

export enum LunEnrichmentField {
    CURRENT = 'current',
    RECOMMENDED = 'recommended',
    WORKLOAD = 'workload'
}

export const objectNameColumn: TableColumn<ResourceScanRecord> = {
    ...resourceNameColumn,
    header: 'Object name'
};

export const blockDeviceNameColumn: TableColumn<ResourceScanRecord> = {
    ...resourceNameColumn,
    header: 'Block device name'
};

export const currentOsTypeColumn = createMetadataFieldColumn({
    header: 'Current value',
    field: LunEnrichmentField.CURRENT,
    id: LunColumnId.CURRENT_OS_TYPE,
    width: 140,
    sort: { enabled: true },
    filter: { enabled: false }
});

export const recommendedOsTypeColumn = createMetadataFieldColumn({
    header: 'Recommended value',
    field: LunEnrichmentField.RECOMMENDED,
    id: LunColumnId.RECOMMENDED_OS_TYPE,
    width: 150,
    sort: { enabled: true },
    filter: { enabled: false }
});

export const lunWorkloadColumn = createMetadataFieldColumn({
    header: 'Workload',
    field: LunEnrichmentField.WORKLOAD,
    id: LunColumnId.WORKLOAD,
    width: 110,
    sort: { enabled: true },
    filter: { enabled: true }
});

export const multiComponentLunColumns: ReadonlyArray<TableColumn<ResourceScanRecord>> = [
    objectNameColumn,
    fileSystemColumn,
    optimizationStatusColumn,
    createMetadataFieldColumn({
        header: 'Current value',
        field: LunEnrichmentField.CURRENT,
        id: 'lunMultiComponentCurrent',
        width: 320,
        sort: { enabled: true },
        filter: { enabled: false }
    }),
    createMetadataFieldColumn({
        header: 'Recommended value',
        field: LunEnrichmentField.RECOMMENDED,
        id: 'lunMultiComponentRecommended',
        width: 320,
        sort: { enabled: true },
        filter: { enabled: false }
    }),
    lunWorkloadColumn,
    lastAnalyzedColumn
];

export const LUN_EXTRA_COLUMNS_ANCHOR_ID: string = ResourceColumnId.OPTIMIZATION_STATUS;

export const DEFAULT_LUN_COLUMNS_BY_SCOPE: Record<TableScope, ReadonlyArray<TableColumn<ResourceScanRecord>>> = {
    [TableScope.GLOBAL_WAD]: [
        blockDeviceNameColumn,
        fileSystemColumn,
        optimizationStatusColumn,
        currentOsTypeColumn,
        recommendedOsTypeColumn,
        lunWorkloadColumn,
        lastAnalyzedColumn
    ],
    [TableScope.FSX_WAD]: [blockDeviceNameColumn]
};
