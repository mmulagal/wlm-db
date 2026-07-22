import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { FixModalRouter } from '@wad/FixModalRouter';
import { FixModalRouterTestIds } from '@wad/shared/fixModalTestIds';
import { createMockWadApi } from '@test/helpers/testUtils';

describe('FixModalRouter', () => {
    it('shows unsupported notice for unknown configuration ids', () => {
        render(<FixModalRouter wadApi={createMockWadApi()} />);

        expect(screen.getByTestId(FixModalRouterTestIds.unsupported)).toBeInTheDocument();
    });

    it('renders the volume fix modal wrapper for volume configuration ids', () => {
        render(<FixModalRouter wadApi={createMockWadApi({ context: { configurationId: 'wlmdb-thin-provision' } })} />);

        expect(screen.getByTestId('wlmdb-thin-provisioning-fix-modal')).toBeInTheDocument();
    });
});
