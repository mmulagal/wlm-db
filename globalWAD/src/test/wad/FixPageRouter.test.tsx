import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { FixPageRouter } from '@wad/FixPageRouter';
import { FixPageRouterTestIds } from '@wad/shared/fixModalTestIds';
import { createMockWadApi } from '@test/helpers/testUtils';

describe('FixPageRouter', () => {
    it('shows unsupported notice for unknown configuration ids', () => {
        render(<FixPageRouter wadApi={createMockWadApi()} />);

        expect(screen.getByTestId(FixPageRouterTestIds.unsupported)).toBeInTheDocument();
    });

    it('renders the volume resources table for volume configuration ids', () => {
        render(
            <FixPageRouter
                wadApi={createMockWadApi({ context: { configurationId: 'wlmdb-thin-provision' } })}
            />
        );

        expect(screen.getByTestId('volume-resources-table-wlmdb-thin-provision')).toBeInTheDocument();
    });
});
