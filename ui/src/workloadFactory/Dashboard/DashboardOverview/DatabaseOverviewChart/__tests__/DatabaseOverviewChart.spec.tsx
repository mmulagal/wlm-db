import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DatabaseOverviewChart from '../DatabaseOverviewChart';

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
    DsFlashingDotsLoader: () => <div data-testid="flashing-dots-loader" />
}));

vi.mock('@tlveng/wlm-ds', () => ({
    DsTypography: ({ children, variant, className, style }: any) => (
        <span data-testid={`typography-${variant}`} className={className} style={style}>
            {children}
        </span>
    )
}));

vi.mock('../../../../utils/CommonStyles.module.scss', () => ({
    default: { notAvailable: 'notAvailable' }
}));

vi.mock('./DatabaseOverviewChart.module.scss', () => ({
    default: {
        chart: 'chart',
        'center-text': 'center-text'
    }
}));

describe('DatabaseOverviewChart', () => {
    const defaultProps = {
        color1: '#0BAFFC',
        color2: '#A815F3',
        color3: '#68C6B3',
        data1: 5,
        data2: 3,
        data3: 2,
        centerText: 'Resources',
        centerValue: '10'
    };

    it('renders center text', () => {
        render(<DatabaseOverviewChart {...defaultProps} />);
        expect(screen.getByText('Resources')).toBeTruthy();
    });

    it('renders center value', () => {
        render(<DatabaseOverviewChart {...defaultProps} />);
        expect(screen.getByText('10')).toBeTruthy();
    });

    it('shows loading spinner when loading is true', () => {
        render(<DatabaseOverviewChart {...defaultProps} loading />);
        expect(screen.getByTestId('flashing-dots-loader')).toBeTruthy();
    });

    it('does not show loading spinner when loading is false', () => {
        render(<DatabaseOverviewChart {...defaultProps} loading={false} />);
        expect(screen.queryByTestId('flashing-dots-loader')).toBeNull();
    });

    it('renders canvas element', () => {
        const { container } = render(<DatabaseOverviewChart {...defaultProps} />);
        expect(container.querySelector('canvas')).toBeTruthy();
    });

    it('renders chart container', () => {
        const { container } = render(<DatabaseOverviewChart {...defaultProps} />);
        expect(container.querySelector('#chart-item')).toBeTruthy();
    });

    it('renders with isDisabled prop and applies class', () => {
        render(<DatabaseOverviewChart {...defaultProps} isDisabled />);
        const el = screen.getByText('10');
        expect(el.className).toContain('notAvailable');
    });

    it('renders without centerValue', () => {
        const { container } = render(
            <DatabaseOverviewChart
                color1="#fff"
                color2="#000"
                color3="#ccc"
                data1={1}
                data2={2}
                data3={3}
                centerText="Total"
            />
        );
        expect(container).toBeTruthy();
    });
});
