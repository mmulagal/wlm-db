import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WellArchitectChart from '../WellArchitectChart';

// Mock chart.js
vi.mock('chart.js', () => ({
    Chart: class MockChart {
        static register = vi.fn();

        constructor() {}

        destroy = vi.fn();

        update = vi.fn();
    },
    registerables: []
}));

vi.mock('@tlveng/wlm-ds', () => ({
    DsTypography: ({ children, variant, className, style }: any) => (
        <span data-testid={`typography-${variant}`} className={className} style={style}>
            {children}
        </span>
    )
}));

vi.mock('@netapp/design-system', () => ({
    DsFlashingDotsLoader: () => <div data-testid="flashing-dots-loader" />
}));

vi.mock('../../../../../utils/CommonStyles.module.scss', () => ({
    default: { notAvailable: 'notAvailable' }
}));

vi.mock('./WellArchitectChart.module.scss', () => ({
    default: {
        inventoryChart: 'inventoryChart',
        'center-text': 'center-text'
    }
}));

describe('WellArchitectChart', () => {
    const defaultProps = {
        color1: '#68C6B3',
        color2: '#E0E0E0',
        data1: 75,
        data2: 25,
        centerText: 'Total score',
        centerValue: '75%'
    };

    it('renders center text', () => {
        render(<WellArchitectChart {...defaultProps} />);
        expect(screen.getByText('Total score')).toBeTruthy();
    });

    it('renders center value', () => {
        render(<WellArchitectChart {...defaultProps} />);
        expect(screen.getByText('75%')).toBeTruthy();
    });

    it('shows loading spinner when loading is true', () => {
        render(<WellArchitectChart {...defaultProps} loading />);
        expect(screen.getByTestId('flashing-dots-loader')).toBeTruthy();
    });

    it('does not show loading spinner when loading is false', () => {
        render(<WellArchitectChart {...defaultProps} loading={false} />);
        expect(screen.queryByTestId('flashing-dots-loader')).toBeNull();
    });

    it('renders canvas element', () => {
        const { container } = render(<WellArchitectChart {...defaultProps} />);
        expect(container.querySelector('canvas')).toBeTruthy();
    });

    it('renders with isDisabled prop', () => {
        render(<WellArchitectChart {...defaultProps} isDisabled />);
        const el = screen.getByText('75%');
        expect(el.className).toContain('notAvailable');
    });

    it('renders without centerValue', () => {
        const { container } = render(
            <WellArchitectChart color1="#fff" color2="#000" data1={50} data2={50} centerText="Total score" />
        );
        expect(container).toBeTruthy();
    });

    it('renders chart container', () => {
        const { container } = render(<WellArchitectChart {...defaultProps} />);
        expect(container.querySelector('#chart-item')).toBeTruthy();
    });
});
