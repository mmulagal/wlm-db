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

const LUN_NAME_HEADER = 'LUN name';

export const lunNameColumn: TableColumn<ResourceScanRecord> = {
    ...resourceNameColumn,
    header: LUN_NAME_HEADER
};

export const currentOsTypeColumn = createMetadataFieldColumn({
    header: 'OS type',
    field: LunEnrichmentField.CURRENT,
    id: LunColumnId.CURRENT_OS_TYPE,
    width: 140,
    sort: { enabled: true },
    filter: { enabled: false }
});

export const recommendedOsTypeColumn = createMetadataFieldColumn({
    header: 'Recommended',
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
    lunNameColumn,
    fileSystemColumn,
    optimizationStatusColumn,
    createMetadataFieldColumn({
        header: 'Current',
        field: LunEnrichmentField.CURRENT,
        id: 'lunMultiComponentCurrent',
        width: 320,
        sort: { enabled: true },
        filter: { enabled: false }
    }),
    createMetadataFieldColumn({
        header: 'Recommended',
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
        lunNameColumn,
        fileSystemColumn,
        optimizationStatusColumn,
        currentOsTypeColumn,
        recommendedOsTypeColumn,
        lunWorkloadColumn,
        lastAnalyzedColumn
    ],
    [TableScope.FSX_WAD]: [lunNameColumn]
};
