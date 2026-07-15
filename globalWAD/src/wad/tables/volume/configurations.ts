import type {
    FixBulkHandler,
    FixRowHandler,
    ResourceScanRecord,
    TableColumn
} from '@tlveng/workload-factory-components';
import {
    fileSystemColumn,
    lastAnalyzedColumn,
    optimizationStatusColumn
} from '@tlveng/workload-factory-components';
import {
    currentSnapcenterSnapshotColumn,
    multiComponentVolumeColumns,
    recommendedSnapcenterSnapshotColumn,
    volumeNameColumn,
    volumeWorkloadColumn
} from './columns';

interface VolumeConfiguration {
    columns?: ReadonlyArray<TableColumn<ResourceScanRecord>>;
    extraColumns?: ReadonlyArray<TableColumn<ResourceScanRecord>>;
    supportsBulkFix: boolean;
    supportsRowFix: boolean;
    bulkFixDisabledTooltip?: string;
    fixRow?: FixRowHandler;
    fixBulk?: FixBulkHandler;
}

const DefaultVolumeConfiguration: VolumeConfiguration = {
    supportsBulkFix: true,
    supportsRowFix: true
};

const ViewOnlyVolumeConfiguration: VolumeConfiguration = {
    supportsBulkFix: false,
    supportsRowFix: true,
    bulkFixDisabledTooltip: "Fix isn't supported for this configuration.",
    columns: [
        volumeNameColumn,
        fileSystemColumn,
        optimizationStatusColumn,
        currentSnapcenterSnapshotColumn,
        recommendedSnapcenterSnapshotColumn,
        volumeWorkloadColumn,
        lastAnalyzedColumn
    ]
};

export const volumeConfigurations: Partial<Record<string, VolumeConfiguration>> = {
    'wlmdb-thin-provision': DefaultVolumeConfiguration,
    'wlmdb-snapshot-policy': DefaultVolumeConfiguration,
    'wlmdb-snapcenter-snapshot': ViewOnlyVolumeConfiguration,
    'wlmdb-storage-efficiencies': {
        ...DefaultVolumeConfiguration,
        columns: multiComponentVolumeColumns
    },
    'wlmdb-tiering-tco-optimization': {
        ...DefaultVolumeConfiguration,
        columns: multiComponentVolumeColumns
    }
};

export const resolveVolumeConfiguration = (configurationId: string): VolumeConfiguration =>
    volumeConfigurations[configurationId] ?? DefaultVolumeConfiguration;

export const VolumeConfigurationIds = new Set<string>(Object.keys(volumeConfigurations));

export type { VolumeConfiguration };
