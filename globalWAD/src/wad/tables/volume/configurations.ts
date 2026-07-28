import type {
    FixBulkHandler,
    FixRowHandler,
    ResourceScanRecord,
    TableColumn
} from '@tlveng/workload-factory-components/wad';
import { fileSystemColumn, lastAnalyzedColumn, optimizationStatusColumn } from '@tlveng/workload-factory-components/wad';
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
    /** When false, the fix modal can open without FSx parentResource context (guidance-only modals). */
    requiresFsxContext?: boolean;
    bulkFixDisabledTooltip?: string;
    restrictBulkSelectionToSameWorkload?: boolean;
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
    requiresFsxContext: false,
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
    'wlmdb-snapshot-policy': {
        ...DefaultVolumeConfiguration,
        restrictBulkSelectionToSameWorkload: true
    },
    'wlmdb-snapcenter-snapshot': ViewOnlyVolumeConfiguration,
    'wlmdb-storage-efficiencies': {
        ...DefaultVolumeConfiguration,
        columns: multiComponentVolumeColumns,
        restrictBulkSelectionToSameWorkload: true
    },
    'wlmdb-tiering-tco-optimization': {
        ...DefaultVolumeConfiguration,
        columns: multiComponentVolumeColumns,
        restrictBulkSelectionToSameWorkload: true
    }
};

export const resolveVolumeConfiguration = (configurationId: string): VolumeConfiguration =>
    volumeConfigurations[configurationId] ?? DefaultVolumeConfiguration;

export const VolumeConfigurationIds = new Set<string>(Object.keys(volumeConfigurations));

export type { VolumeConfiguration };
