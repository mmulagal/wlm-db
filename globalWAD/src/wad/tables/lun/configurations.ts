import type {
    FixBulkHandler,
    FixRowHandler,
    ResourceScanRecord,
    TableColumn
} from '@tlveng/workload-factory-components/wad';
import { multiComponentLunColumns } from './columns';

interface LunConfiguration {
    columns?: ReadonlyArray<TableColumn<ResourceScanRecord>>;
    extraColumns?: ReadonlyArray<TableColumn<ResourceScanRecord>>;
    supportsBulkFix: boolean;
    supportsRowFix: boolean;
    bulkFixDisabledTooltip?: string;
    fixRow?: FixRowHandler;
    fixBulk?: FixBulkHandler;
}

const DefaultLunConfiguration: LunConfiguration = {
    supportsBulkFix: true,
    supportsRowFix: true
};

const ViewOnlyLunConfiguration: LunConfiguration = {
    supportsBulkFix: false,
    supportsRowFix: true,
    bulkFixDisabledTooltip: "Fix isn't supported for this configuration."
};

export const lunConfigurations: Partial<Record<string, LunConfiguration>> = {
    'wlmdb-os-type': ViewOnlyLunConfiguration,
    'wlmdb-block-device-space-management': {
        ...DefaultLunConfiguration,
        columns: multiComponentLunColumns
    }
};

export const resolveLunConfiguration = (configurationId: string): LunConfiguration =>
    lunConfigurations[configurationId] ?? DefaultLunConfiguration;

export const LunConfigurationIds = new Set<string>(Object.keys(lunConfigurations));

export type { LunConfiguration };
