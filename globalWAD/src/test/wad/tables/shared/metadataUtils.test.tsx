import { describe, it, expect } from 'vitest';

import {
    getComponentMetadataValue,
    hasMixedWorkloads,
    normalizeWorkloadType,
    WorkloadType
} from '@wad/tables/shared/metadataUtils';
import { createMockResource } from '@test/helpers/testUtils';

describe('metadataUtils', () => {
    it('reads flat metadata values', () => {
        expect(getComponentMetadataValue({ current: 'enabled' }, 'current')).toBe('enabled');
    });

    it('formats multi-component metadata values', () => {
        expect(
            getComponentMetadataValue(
                {
                    components: [
                        { parameter: 'dedupe', current: 'none', recommended: 'inline' },
                        { parameter: 'compression', current: 'adaptive', recommended: 'adaptive' }
                    ]
                },
                'current'
            )
        ).toBe('dedupe=none, compression=adaptive');
    });

    it('normalizes workload types', () => {
        expect(normalizeWorkloadType(' MSSQL ')).toBe(WorkloadType.MSSQL);
        expect(normalizeWorkloadType('unknown')).toBeUndefined();
    });

    it('detects mixed workloads across resources', () => {
        expect(
            hasMixedWorkloads([
                createMockResource('a', { metadata: { workload: 'mssql' } }),
                createMockResource('b', { metadata: { workload: 'oracle' } })
            ])
        ).toBe(true);
    });
});
