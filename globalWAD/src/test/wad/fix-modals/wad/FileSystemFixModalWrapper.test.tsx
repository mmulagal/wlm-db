import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { FileSystemFixModalWrapper } from '@wad/fix-modals/wad/FileSystemFixModalWrapper';
import { FixModalRouterTestIds, PlaceholderFixModalTestIds } from '@wad/shared/fixModalTestIds';
import { createMockWadApi } from '@test/helpers/testUtils';

describe('FileSystemFixModalWrapper', () => {
    it('shows unsupported notice when parent credentials are missing', () => {
        render(
            <FileSystemFixModalWrapper
                wadApi={createMockWadApi({
                    context: { configurationId: 'wlmdb-headroom' },
                    fixModalPayload: { resources: [{ id: 'fs-1' }] }
                })}
            />
        );

        expect(screen.getByTestId(FixModalRouterTestIds.unsupported)).toBeInTheDocument();
    });

    it('renders the mapped fix modal for headroom configuration', () => {
        render(
            <FileSystemFixModalWrapper wadApi={createMockWadApi({ context: { configurationId: 'wlmdb-headroom' } })} />
        );

        expect(screen.getByTestId('wlmdb-headroom-fix-modal')).toBeInTheDocument();
    });

    it('falls back to placeholder modal for unmapped file system configurations', () => {
        render(
            <FileSystemFixModalWrapper
                wadApi={createMockWadApi({ context: { configurationId: 'wlmdb-unknown-fs' } })}
            />
        );

        expect(screen.getByTestId(PlaceholderFixModalTestIds.modal)).toBeInTheDocument();
    });
});
