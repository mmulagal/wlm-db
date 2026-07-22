import { describe, it, expect, vi } from 'vitest';

import type { WadFixModalProps } from '@wad/fix-modals/shared/WadFixModalProps';

describe('WadFixModalProps', () => {
    it('accepts the expected fix modal prop shape', () => {
        const props: WadFixModalProps = {
            recommendationName: 'Headroom',
            resources: [],
            close: vi.fn(),
            credentialId: 'cred-1',
            region: 'us-east-1',
            fsxId: 'fsx-1',
            originPath: '/wad',
            navigate: vi.fn(),
            fix: vi.fn().mockResolvedValue(undefined),
            isFixing: false
        };

        expect(props.recommendationName).toBe('Headroom');
    });
});
