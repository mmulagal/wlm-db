import type {
    FixBulkHandler,
    FixRowHandler,
    ResourceScanRecord,
    TableColumn
} from '@tlveng/workload-factory-components';

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

export const volumeConfigurations: Partial<Record<string, VolumeConfiguration>> = {
    'wlmdb-thin-provision': DefaultVolumeConfiguration
};

export const resolveVolumeConfiguration = (configurationId: string): VolumeConfiguration =>
    volumeConfigurations[configurationId] ?? DefaultVolumeConfiguration;

export const VolumeConfigurationIds = new Set<string>(Object.keys(volumeConfigurations));

export type { VolumeConfiguration };
