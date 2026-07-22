import { vi } from 'vitest';
import type { ResourceScanRecord, WadApi } from '@tlveng/workload-factory-components';

export const createMockResource = (id: string, overrides: Partial<ResourceScanRecord> = {}): ResourceScanRecord => ({
    id,
    ...overrides
});

export const createMockWadApi = (overrides: Partial<WadApi> = {}): WadApi => ({
    context: { configurationId: 'unknown-config', configurationName: 'Test configuration' },
    fixModalPayload: {
        resources: [
            createMockResource('resource-1', {
                parentResource: { id: 'fsx-1', region: 'us-east-1', credentialsIds: ['cred-1'], type: 'Volume' }
            })
        ]
    },
    closeFixModal: vi.fn(),
    fix: vi.fn().mockResolvedValue(undefined),
    fetchResources: vi.fn().mockResolvedValue(undefined),
    navigate: vi.fn(),
    getLocation: vi.fn().mockReturnValue('/wad'),
    notify: vi.fn(),
    openFixModal: vi.fn(),
    getResource: vi.fn(),
    updateResource: vi.fn(),
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
