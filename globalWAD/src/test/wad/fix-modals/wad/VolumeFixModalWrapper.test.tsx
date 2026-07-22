import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { VolumeFixModalWrapper } from '@wad/fix-modals/wad/VolumeFixModalWrapper';
import { FixModalRouterTestIds, PlaceholderFixModalTestIds } from '@wad/shared/fixModalTestIds';
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

    it('renders snapcenter guidance modal without FSx parent context', () => {
        render(
            <VolumeFixModalWrapper
                wadApi={createMockWadApi({
                    context: {
                        configurationId: 'wlmdb-snapcenter-snapshot',
                        configurationName: 'Application-consistent snapshots'
                    },
                    fixModalPayload: {
                        resources: [{ id: 'vol-1', metadata: { workload: 'mssql' } }]
                    }
                })}
            />
        );

        expect(screen.getByTestId('wlmdb-snapcenter-snapshot-fix-modal')).toBeInTheDocument();
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
