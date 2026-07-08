import type {
    FixBulkHandler,
    FixRowHandler,
    ResourceScanRecord,
    TableColumn
} from '@tlveng/workload-factory-components';

interface FileSystemConfiguration {
    columns?: ReadonlyArray<TableColumn<ResourceScanRecord>>;
    extraColumns?: ReadonlyArray<TableColumn<ResourceScanRecord>>;
    supportsBulkFix: boolean;
    bulkFixDisabledTooltip?: string;
    fixRow?: FixRowHandler;
    fixBulk?: FixBulkHandler;
}

const DefaultFileSystemConfiguration: FileSystemConfiguration = {
    supportsBulkFix: true
};

export const fileSystemConfigurations: Partial<Record<string, FileSystemConfiguration>> = {
    'update-automatic-capacity-management': { supportsBulkFix: true },
    'update-ssd-capacity': DefaultFileSystemConfiguration,
    'fsx:flex-volume-rebalance': DefaultFileSystemConfiguration,
    'schedule-volume-backups': DefaultFileSystemConfiguration,
    'decrease-ssd-capacity': DefaultFileSystemConfiguration
};

export const resolveFileSystemConfiguration = (configurationId: string): FileSystemConfiguration =>
    fileSystemConfigurations[configurationId] ?? DefaultFileSystemConfiguration;

export const FileSystemConfigurationIds = new Set<string>(Object.keys(fileSystemConfigurations));

export type { FileSystemConfiguration };
