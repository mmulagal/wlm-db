import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { VolumeFixModalWrapper } from '@wad/fix-modals/wad/VolumeFixModalWrapper';
import { FixModalRouterTestIds } from '@wad/shared/fixModalTestIds';
import { PlaceholderFixModalTestIds } from '@wad/shared/fixModalTestIds';
import { createMockWadApi } from '@test/helpers/testUtils';

describe('VolumeFixModalWrapper', () => {
    it('shows unsupported notice when parent credentials are missing', () => {
        render(
            <VolumeFixModalWrapper
                wadApi={createMockWadApi({
                    context: { configurationId: 'wlmdb-thin-provision' },
                    fixModalPayload: { resources: [{ id: 'vol-1' }] }
                })}
            />
        );

        expect(screen.getByTestId(FixModalRouterTestIds.unsupported)).toBeInTheDocument();
    });

    it('renders the mapped fix modal for known volume configurations', () => {
        render(
            <VolumeFixModalWrapper
                wadApi={createMockWadApi({ context: { configurationId: 'wlmdb-thin-provision' } })}
            />
        );

        expect(screen.getByTestId('wlmdb-thin-provisioning-fix-modal')).toBeInTheDocument();
    });

    it('falls back to placeholder modal for unmapped volume configurations', () => {
        render(
            <VolumeFixModalWrapper
                wadApi={createMockWadApi({ context: { configurationId: 'wlmdb-unknown-volume' } })}
            />
        );

        expect(screen.getByTestId(PlaceholderFixModalTestIds.modal)).toBeInTheDocument();
    });
});
