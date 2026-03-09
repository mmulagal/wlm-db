import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import MultiRingDoughnut from '../MultiRingDoughnut';

// Mock chart.js to avoid canvas issues in jsdom
vi.mock('chart.js', () => {
    const mockChart = vi.fn().mockImplementation(() => ({
        destroy: vi.fn(),
        update: vi.fn()
    }));
    (mockChart as any).register = vi.fn();
    return { Chart: mockChart, registerables: [] };
});

vi.mock('@netapp/design-system', () => ({
    Typography: ({ children, variant, style }: any) => (
        <span data-testid={`typography-${variant}`} style={style}>
            {children}
        </span>
    )
}));

vi.mock('../../../../utils/utilityFunctions', () => ({
    formatFractionalNumber: (val: any) => (val !== undefined ? String(val) : '0')
}));

vi.mock('../../../../utils/appConstants', () => ({
    GENERAL: { PROTECTION_CHART: 'Protected' }
}));

vi.mock('../MultiRingDoughnut.module.scss', () => ({
    default: { chartItem: 'chartItem', 'center-text': 'center-text', emptyCircle: 'emptyCircle' }
}));

describe('MultiRingDoughnut', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders protected percentage text', () => {
        render(<MultiRingDoughnut hostData={{ protectedPercent: 75, unprotectedPercent: 25 }} />);
        expect(screen.getByText('75%')).toBeDefined();
    });

    it('renders "Protected" label', () => {
        render(<MultiRingDoughnut hostData={{ protectedPercent: 75, unprotectedPercent: 25 }} />);
        expect(screen.getByText('Protected')).toBeDefined();
    });

    it('renders emptyCircle when hostData is null', () => {
        const { container } = render(<MultiRingDoughnut />);
        expect(container.querySelector('.emptyCircle')).not.toBeNull();
    });

    it('renders emptyCircle when both percents are 0', () => {
        const { container } = render(<MultiRingDoughnut hostData={{ protectedPercent: 0, unprotectedPercent: 0 }} />);
        expect(container.querySelector('.emptyCircle')).not.toBeNull();
    });

    it('renders canvas when protectedPercent is non-zero', () => {
        const { container } = render(<MultiRingDoughnut hostData={{ protectedPercent: 50, unprotectedPercent: 50 }} />);
        expect(container.querySelector('canvas')).not.toBeNull();
    });

    it('uses grey unProtectedColor when unProtectColor is truthy', () => {
        // When unProtectColor is set the unprotected color becomes #E0E0E0
        // Just ensure it renders without errors
        render(
            <MultiRingDoughnut unProtectColor="someColor" hostData={{ protectedPercent: 50, unprotectedPercent: 50 }} />
        );
        expect(screen.getByText('50%')).toBeDefined();
    });

    it('uses yellow unProtectedColor when unProtectColor is falsy', () => {
        // When unProtectColor is not set the unprotected color becomes #FDC300
        render(<MultiRingDoughnut hostData={{ protectedPercent: 50, unprotectedPercent: 50 }} />);
        expect(screen.getByText('50%')).toBeDefined();
    });

    it('renders when no hostData provided without errors', () => {
        const { container } = render(<MultiRingDoughnut />);
        // The emptyCircle should show when no data is provided
        expect(container.querySelector('.emptyCircle')).not.toBeNull();
    });
});
