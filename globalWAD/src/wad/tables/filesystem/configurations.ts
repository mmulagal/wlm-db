import type {
    FixBulkHandler,
    FixRowHandler,
    ResourceScanRecord,
    TableColumn
} from '@tlveng/workload-factory-components';
import { headroomFileSystemColumns } from './columns';

interface FileSystemConfiguration {
    columns?: ReadonlyArray<TableColumn<ResourceScanRecord>>;
    extraColumns?: ReadonlyArray<TableColumn<ResourceScanRecord>>;
    supportsBulkFix: boolean;
    supportsRowFix: boolean;
    bulkFixDisabledTooltip?: string;
    restrictBulkSelectionToSameWorkload?: boolean;
    fixRow?: FixRowHandler;
    fixBulk?: FixBulkHandler;
}

const DefaultFileSystemConfiguration: FileSystemConfiguration = {
    supportsBulkFix: true,
    supportsRowFix: true
};

export const fileSystemConfigurations: Partial<Record<string, FileSystemConfiguration>> = {
    'wlmdb-headroom': {
        ...DefaultFileSystemConfiguration,
        columns: headroomFileSystemColumns,
        restrictBulkSelectionToSameWorkload: true
    }
};

export const resolveFileSystemConfiguration = (configurationId: string): FileSystemConfiguration =>
    fileSystemConfigurations[configurationId] ?? DefaultFileSystemConfiguration;

export const FileSystemConfigurationIds = new Set<string>(Object.keys(fileSystemConfigurations));

export type { FileSystemConfiguration };
