import { createElement } from 'react';
import type {
    FixBulkHandler,
    FixRowHandler,
    ResourceScanRecord,
    TableColumn
} from '@tlveng/workload-factory-components';

const PotentialSnapshotsRenderer = ({ row }: { row: ResourceScanRecord }) => {
    const snapshots = row.metadata?.snapshots;
    const count = Array.isArray(snapshots) ? snapshots.length : 0;
    return createElement('span', null, count);
};

const PotentialSnapshotsColumn: TableColumn<ResourceScanRecord> = {
    id: 'potential-snapshots',
    header: 'Potential snapshots to delete',
    accessor: 'metadata.snapshots',
    width: 240,
    sort: { enabled: false },
    Renderer: PotentialSnapshotsRenderer
};

interface VolumeConfiguration {
    columns?: ReadonlyArray<TableColumn<ResourceScanRecord>>;
    extraColumns?: ReadonlyArray<TableColumn<ResourceScanRecord>>;
    supportsBulkFix: boolean;
    bulkFixDisabledTooltip?: string;
    fixRow?: FixRowHandler;
    fixBulk?: FixBulkHandler;
}

const DefaultVolumeConfiguration: VolumeConfiguration = {
    supportsBulkFix: true
};

const NoBulkFixVolumeConfiguration: VolumeConfiguration = {
    supportsBulkFix: false,
    bulkFixDisabledTooltip:
        "Bulk fix isn't supported for this recommendation. Open each row individually to apply the fix."
};

export const volumeConfigurations: Partial<Record<string, VolumeConfiguration>> = {
    'update-volume-snapshot-policy': DefaultVolumeConfiguration,
    'volume-replication': DefaultVolumeConfiguration,
    'update-tiering-policy': DefaultVolumeConfiguration,
    'update-volume-storage-efficiency': DefaultVolumeConfiguration,
    'update-volume-long-term-retention': DefaultVolumeConfiguration,
    'update-volume-ransomware-protection': DefaultVolumeConfiguration,
    'update-volume-file-capacity': NoBulkFixVolumeConfiguration,
    'update-volume-capacity-utilization': NoBulkFixVolumeConfiguration,
    'remove-unauthorized-access-to-iscsi-volume': DefaultVolumeConfiguration,
    'delete-unnecessary-snapshots': {
        extraColumns: [PotentialSnapshotsColumn],
        supportsBulkFix: false,
        bulkFixDisabledTooltip:
            "Bulk fix isn't supported for snapshot cleanup. Open each row individually to apply the fix."
    },
    'fsx:volume-rebalance': DefaultVolumeConfiguration,
    'fsx:flexcache-optimize-size': NoBulkFixVolumeConfiguration,
    'inactive-nas-volumes': DefaultVolumeConfiguration,
    'cfg-003': DefaultVolumeConfiguration
};

export const resolveVolumeConfiguration = (configurationId: string): VolumeConfiguration =>
    volumeConfigurations[configurationId] ?? DefaultVolumeConfiguration;

export const VolumeConfigurationIds = new Set<string>(Object.keys(volumeConfigurations));

export type { VolumeConfiguration };
