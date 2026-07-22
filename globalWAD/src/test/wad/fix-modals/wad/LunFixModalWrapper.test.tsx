import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { LunFixModalWrapper } from '@wad/fix-modals/wad/LunFixModalWrapper';
import { FixModalRouterTestIds } from '@wad/shared/fixModalTestIds';
import { createMockWadApi } from '@test/helpers/testUtils';

describe('LunFixModalWrapper', () => {
    it('renders the mapped fix modal for known lun configurations', () => {
        render(<LunFixModalWrapper wadApi={createMockWadApi({ context: { configurationId: 'wlmdb-os-type' } })} />);

        expect(screen.getByTestId('wlmdb-os-type-fix-modal')).toBeInTheDocument();
    });

    it('shows unsupported notice for unknown lun configurations', () => {
        render(<LunFixModalWrapper wadApi={createMockWadApi()} />);

        expect(screen.getByTestId(FixModalRouterTestIds.unsupported)).toBeInTheDocument();
    });
});
