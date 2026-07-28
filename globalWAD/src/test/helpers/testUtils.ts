import { vi } from 'vitest';
import {
    OptimizationStatus,
    ResourceType,
    ServiceType,
    type ResourceScanRecord,
    type WadApi
} from '@tlveng/workload-factory-components/wad';

const defaultMockResource = (id: string): ResourceScanRecord => ({
    id,
    type: ResourceType.VOLUME,
    name: id,
    workload: 'generic',
    optimizationStatus: OptimizationStatus.NOT_OPTIMIZED,
    isDismissed: false
});

export const createMockResource = (id: string, overrides: Partial<ResourceScanRecord> = {}): ResourceScanRecord => ({
    ...defaultMockResource(id),
    ...overrides
});

export const createMockWadApi = (overrides: Partial<WadApi> = {}): WadApi => ({
    subscribe: vi.fn().mockReturnValue(vi.fn()),
    getResources: vi.fn().mockReturnValue([]),
    getResource: vi.fn(),
    getFilters: vi.fn().mockReturnValue({}),
    isLoading: vi.fn().mockReturnValue(false),
    getTotalCount: vi.fn().mockReturnValue(0),
    getPageInfo: vi.fn().mockReturnValue({ page: 0, pageSize: 25, pageCount: 1, hasNext: false, hasPrev: false }),
    getLocation: vi.fn().mockReturnValue('/wad'),
    updateResource: vi.fn(),
    setFilters: vi.fn(),
    fetchResources: vi.fn().mockResolvedValue(undefined),
    dismiss: vi.fn().mockResolvedValue(undefined),
    reactivate: vi.fn().mockResolvedValue(undefined),
    fix: vi.fn().mockResolvedValue({ requestId: 'req-1', tasks: [] }),
    openFixModal: vi.fn(),
    closeFixModal: vi.fn(),
    fixModalPayload: {
        resources: [
            createMockResource('resource-1', {
                parentResource: { id: 'fsx-1', region: 'us-east-1', credentialsIds: ['cred-1'], type: 'Volume' }
            })
        ]
    },
    notify: vi.fn(),
    navigate: vi.fn(),
    apiRequest: vi.fn().mockResolvedValue(undefined),
    context: {
        accountId: 'account-1',
        configurationId: 'unknown-config',
        configurationName: 'Test configuration',
        scope: {
            serviceType: ServiceType.FSX_FOR_ONTAP,
            credentialsIds: ['cred-1'],
            regions: ['us-east-1']
        }
    },
    ...overrides
});

export const volumeFixModalProps = (overrides: Record<string, unknown> = {}) => ({
    recommendationName: 'Thin provisioning',
    resources: [createMockResource('vol-1', { metadata: { workload: 'mssql' } })],
    close: vi.fn(),
    credentialId: 'cred-1',
    region: 'us-east-1',
    fsxId: 'fsx-1',
    originPath: '/wad',
    navigate: vi.fn(),
    fix: vi.fn().mockResolvedValue(undefined),
    isFixing: false,
    onFixSuccess: vi.fn(),
    ...overrides
});

export const lunFixModalProps = (overrides: Record<string, unknown> = {}) => ({
    recommendationName: 'OS type',
    resources: [createMockResource('lun-1')],
    close: vi.fn(),
    fix: vi.fn().mockResolvedValue(undefined),
    isFixing: false,
    onFixSuccess: vi.fn(),
    ...overrides
});

export const fileSystemFixModalProps = (overrides: Record<string, unknown> = {}) => ({
    ...volumeFixModalProps(),
    recommendationName: 'Headroom',
    resources: [createMockResource('fs-1', { metadata: { workload: 'oracle' } })],
    ...overrides
});
