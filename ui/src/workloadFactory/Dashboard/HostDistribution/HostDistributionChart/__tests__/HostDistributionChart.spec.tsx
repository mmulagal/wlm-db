import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import HostDistributionChart from '../HostDistributionChart';

vi.mock('chart.js', () => ({
    Chart: class MockChart {
        static register = vi.fn();

        constructor() {}

        destroy = vi.fn();

        update = vi.fn();
    },
    registerables: []
}));

vi.mock('@netapp/design-system', () => ({
    DsFlashingDotsLoader: () => <div data-testid="flashing-dots-loader" />,
    Typography: ({ children, variant, className, style }: any) => (
        <span data-testid={`typography-${variant}`} className={className} style={style}>
            {children}
        </span>
    )
}));

vi.mock('../../../../utils/CommonStyles.module.scss', () => ({
    default: { notAvailable: 'notAvailable' }
}));

vi.mock('./HostDistributionChart.module.scss', () => ({
    default: {
        inventoryChart: 'inventoryChart',
        'center-text': 'center-text'
    }
}));

describe('HostDistributionChart', () => {
    const defaultProps = {
        color1: '#0BAFFC',
        color2: '#E0E0E0',
        data1: 7,
        data2: 3,
        centerText: 'Hosts',
        centerValue: '10'
    };

    it('renders center text', () => {
        render(<HostDistributionChart {...defaultProps} />);
        expect(screen.getByText('Hosts')).toBeTruthy();
    });

    it('renders center value', () => {
        render(<HostDistributionChart {...defaultProps} />);
        expect(screen.getByText('10')).toBeTruthy();
    });

    it('shows loading spinner when loading is true', () => {
        render(<HostDistributionChart {...defaultProps} loading />);
        expect(screen.getByTestId('flashing-dots-loader')).toBeTruthy();
    });

    it('does not show loading spinner when loading is false', () => {
        render(<HostDistributionChart {...defaultProps} loading={false} />);
        expect(screen.queryByTestId('flashing-dots-loader')).toBeNull();
    });

    it('renders canvas element', () => {
        const { container } = render(<HostDistributionChart {...defaultProps} />);
        expect(container.querySelector('canvas')).toBeTruthy();
    });

    it('renders chart container', () => {
        const { container } = render(<HostDistributionChart {...defaultProps} />);
        expect(container.querySelector('#chart-item')).toBeTruthy();
    });

    it('renders with isDisabled applies notAvailable class to centerValue', () => {
        render(<HostDistributionChart {...defaultProps} isDisabled />);
        const el = screen.getByText('10');
        expect(el.className).toContain('notAvailable');
    });

    it('renders without centerValue', () => {
        const { container } = render(
            <HostDistributionChart color1="#fff" color2="#000" data1={5} data2={5} centerText="Distribution" />
        );
        expect(container).toBeTruthy();
    });
});
