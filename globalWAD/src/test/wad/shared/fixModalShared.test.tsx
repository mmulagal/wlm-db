import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import {
    PlaceholderFixModal,
    UnsupportedConfigurationNotice,
    UnsupportedTableNotice
} from '@wad/shared/fixModalShared';
import { FixModalRouterTestIds, FixPageRouterTestIds, PlaceholderFixModalTestIds } from '@wad/shared/fixModalTestIds';

describe('fixModalShared', () => {
    it('renders unsupported configuration notice', () => {
        render(<UnsupportedConfigurationNotice configurationId="unknown-config" />);

        expect(screen.getByTestId(FixModalRouterTestIds.unsupported)).toBeInTheDocument();
        expect(screen.getByText(/unknown-config/)).toBeInTheDocument();
    });

    it('renders unsupported table notice', () => {
        render(<UnsupportedTableNotice configurationId="unknown-config" />);

        expect(screen.getByTestId(FixPageRouterTestIds.unsupported)).toBeInTheDocument();
        expect(screen.getByText(/unknown-config/)).toBeInTheDocument();
    });

    it('calls onClose from placeholder fix modal', () => {
        const onClose = vi.fn();
        render(<PlaceholderFixModal onClose={onClose} />);

        fireEvent.click(screen.getByTestId(PlaceholderFixModalTestIds.cancelButton));
        expect(onClose).toHaveBeenCalledOnce();
    });
});
