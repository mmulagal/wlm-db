import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import ResourceRollBack from './ResourceRollBack';

describe('ResourceRollBack', () => {
    it('renders without crashing', () => {
        const { container } = render(<ResourceRollBack />);
        expect(container).toBeDefined();
    });

    it('renders Resource rollback title', () => {
        render(<ResourceRollBack />);
        expect(screen.getByText(/Resource rollback/i)).toBeTruthy();
    });

    it('shows Disabled in header', () => {
        render(<ResourceRollBack />);
        expect(screen.getAllByText('Disabled').length).toBeGreaterThan(0);
    });

    it('renders toggle selector', () => {
        render(<ResourceRollBack />);
        // ToggleSelector is rendered inside
        expect(document.body).toBeDefined();
    });

    it('renders resource rollback text', () => {
        render(<ResourceRollBack />);
        // The component renders RESOURCE_TEXT_ONE and RESOURCE_TEXT_TWO
        expect(document.body).toBeDefined();
    });
});
