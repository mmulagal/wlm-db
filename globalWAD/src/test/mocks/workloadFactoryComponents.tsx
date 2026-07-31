import type { ComponentType, ReactNode } from 'react';

const columnStub = (id: string, header: string) => ({ id, header });

export const TableScope = {
    GLOBAL_WAD: 'GLOBAL_WAD',
    FSX_WAD: 'FSX_WAD'
} as const;

export const ResourceColumnId = {
    WORKLOAD: 'workload',
    OPTIMIZATION_STATUS: 'optimizationStatus',
    LAST_ANALYZED: 'lastAnalyzed'
} as const;

export const NotificationType = {
    ERROR: 'error'
} as const;

export const FixRowActionLabel = {
    FIX: 'View and fix',
    REACTIVATE: 'Reactivate'
} as const;

export const OptimizationStatus = {
    OPTIMIZED: 'OPTIMIZED',
    NOT_OPTIMIZED: 'NOT_OPTIMIZED',
    FIX_IN_PROGRESS: 'FIX_IN_PROGRESS',
    NOT_SCANNED: 'NOT_SCANNED',
    NOT_AVAILABLE: 'NOT_AVAILABLE'
} as const;

export const ResourceType = {
    VOLUME: 'VOLUME',
    FILESYSTEM: 'FILESYSTEM',
    BLOCK_DEVICE: 'BLOCK_DEVICE',
    CACHE_RELATIONSHIP: 'CACHE_RELATIONSHIP',
    SVM: 'SVM',
    BACKUP: 'BACKUP',
    SNAPSHOT: 'SNAPSHOT',
    ISCSI_CONNECTION: 'ISCSI_CONNECTION'
} as const;

export const ServiceType = {
    FSX_FOR_ONTAP: 'FSX_FOR_ONTAP',
    CLOUD_VOLUMES_ONTAP: 'CLOUD_VOLUMES_ONTAP',
    GCNV: 'GCNV'
} as const;

export const fileSystemColumn = columnStub('fileSystem', 'File system');
export const lastAnalyzedColumn = columnStub('lastAnalyzed', 'Last analyzed');
export const optimizationStatusColumn = columnStub('optimizationStatus', 'Status');
export const resourceNameColumn = columnStub('name', 'Name');
export const resourceRowActionColumn = (_options?: unknown) => columnStub('actions', 'Actions');

export const ResourceTextCellRenderer = ({ value }: { value: string }) => <span>{value}</span>;

export const KeyValueTable = ({ data, emptyStateText }: { data: unknown[]; emptyStateText?: string }) => (
    <div data-testid="key-value-table">{data.length === 0 ? emptyStateText : data.length}</div>
);

export const WadResourcesTable = ({ dataTestId }: { dataTestId?: string }) => (
    <div data-testid={dataTestId ?? 'wad-resources-table'} />
);

export const DismissConfirmDialog = () => null;

export const useResourceTableActions = () => ({
    resources: [],
    showDismissed: false,
    handleDismissBulk: () => undefined,
    handleReactivateRow: () => undefined,
    dismissedView: false,
    rowMenu: undefined,
    counterLabel: '',
    dismissConfirmCopy: undefined,
    confirmDismiss: () => undefined,
    cancelDismiss: () => undefined,
    isDismissSubmitting: false
});

export const createWadMount = <P extends object>(Component: ComponentType<P>) => Component;

export type ResourceScanRecord = {
    id: string;
    type?: string;
    name?: string;
    workload?: string;
    metadata?: Record<string, unknown>;
    optimizationStatus?: string;
    isDismissed?: boolean;
    parentResource?: {
        id: string;
        type?: string;
        region?: string;
        credentialsIds?: string[];
    };
    subConfig?: string;
};

export type WadElementProps = {
    wadApi: WadApi;
};

export type WadApi = {
    subscribe: (listener: () => void) => () => void;
    getResources: () => ResourceScanRecord[];
    getResource: (id: string) => ResourceScanRecord | undefined;
    getFilters: () => Record<string, unknown>;
    isLoading: () => boolean;
    getTotalCount: () => number;
    getPageInfo: () => { page: number; pageSize: number; pageCount: number; hasNext: boolean; hasPrev: boolean };
    getLocation: () => string;
    updateResource: (payload: { id: string } & Partial<ResourceScanRecord>) => void;
    setFilters: (filters: Record<string, unknown>) => void;
    fetchResources: () => Promise<void>;
    dismiss: (ids: string[]) => Promise<void>;
    reactivate: (ids: string[]) => Promise<void>;
    fix: (targets: unknown[], metadata?: unknown) => Promise<unknown>;
    openFixModal: (resources: ResourceScanRecord[], extra?: unknown) => void;
    closeFixModal: () => void;
    fixModalPayload: { resources: ResourceScanRecord[]; extra?: unknown };
    notify: (payload: { type: string; message: string }) => void;
    navigate: (target: { pathname: string } | string) => void;
    apiRequest: (config: unknown) => Promise<unknown>;
    context: {
        accountId?: string;
        configurationId: string;
        configurationName?: string;
        scope?: {
            serviceType: string;
            credentialsIds: string[];
            regions: string[];
        };
    };
};

export type BulkAction = {
    id: string;
    label: string;
    onClick: (resourceIds: string[]) => void | Promise<void>;
    isDisabled?: boolean;
    tooltip?: string;
};

export type TableColumn<TRow> = {
    id?: string;
    header?: string;
    accessor?: string | keyof TRow | ((row: TRow) => unknown);
    width?: number;
    sort?: { enabled: boolean };
    filter?: { enabled: boolean };
    Renderer?: ComponentType<{ row: TRow }>;
};

export type FixMetadata = Record<string, unknown>;
export type FixTarget = { id: string; subConfig?: string; parentResource?: { id: string; type: string } };
export type FixBulkHandler = (wadApi: WadApi, resources: ResourceScanRecord[]) => void;
export type FixRowHandler = (wadApi: WadApi, resource: ResourceScanRecord) => void;
export type DisableRowSelection = (row: ResourceScanRecord, selectedRows: ResourceScanRecord[]) => boolean;
export type ParentResourceRef = NonNullable<ResourceScanRecord['parentResource']>;

export const noopChildren = ({ children }: { children?: ReactNode }) => <>{children}</>;
