import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import LineChart from '../LineChart';

const mockChartInstance = {
    destroy: vi.fn(),
    update: vi.fn()
};

vi.mock('chart.js', () => {
    const mockChart = vi.fn().mockImplementation(() => mockChartInstance);
    (mockChart as any).register = vi.fn();
    return { Chart: mockChart, registerables: [] };
});

vi.mock('../../../../assets/empty table message.svg', () => ({
    ReactComponent: () => <svg data-testid="no-data-svg" />
}));

vi.mock('../../../../utils/utilityFunctions', () => ({
    getShiftedHoursList: (list: string[]) => list,
    lastSevenDays: [new Date('2025-01-01'), new Date('2025-01-02')],
    last14Days: [new Date('2025-01-01'), new Date('2025-01-07')],
    last30Days: [new Date('2025-01-01'), new Date('2025-01-30')]
}));

vi.mock('../LineChart.module.scss', () => ({ default: { lineChart: 'lineChart', noData: 'noData' } }));
vi.mock('../../../../utils/CommonStyles.module.scss', () => ({ default: { notAvailable: 'notAvailable' } }));

const makeStore = (darkTheme = false) =>
    configureStore({
        reducer: {
            auth: (state = { features: { active: { 'Platform.BlueXP/DarkTheme': darkTheme } } }) => state
        }
    });

const renderComponent = (props: any = {}, darkTheme = false) =>
    render(
        <Provider store={makeStore(darkTheme)}>
            <LineChart
                startColor="#000"
                endColor="#fff"
                selectedTimeFrame="Last 7 days"
                timelineData={null}
                {...props}
            />
        </Provider>
    );

describe('LineChart', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Provide a mock canvas context
        HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
            createLinearGradient: vi.fn().mockReturnValue({
                addColorStop: vi.fn()
            }),
            canvas: { width: 336, height: 131 }
        }) as any;
    });

    it('renders a canvas element', () => {
        const { container } = renderComponent();
        expect(container.querySelector('canvas')).not.toBeNull();
    });

    it('shows no-data svg when completed array is empty', () => {
        renderComponent({ timelineData: { completed: [], failed: [], warning: [] } });
        expect(screen.getByTestId('no-data-svg')).toBeDefined();
    });

    it('renders canvas when timelineData is null', () => {
        const { container } = renderComponent({ timelineData: null });
        // canvas always renders; no-data shows when completed is empty array
        expect(container.querySelector('canvas')).not.toBeNull();
    });

    it('applies notAvailable class when showNA=true', () => {
        const { container } = renderComponent({ showNA: true });
        expect(container.querySelector('.notAvailable')).not.toBeNull();
    });

    it('applies grayscale filter to canvas when showNA=true', () => {
        const { container } = renderComponent({ showNA: true });
        const canvas = container.querySelector('canvas') as HTMLElement;
        expect(canvas?.style.filter).toContain('grayscale');
    });

    it('does not apply grayscale filter when showNA=false', () => {
        const { container } = renderComponent({ showNA: false });
        const canvas = container.querySelector('canvas') as HTMLElement;
        expect(canvas?.style.filter || '').not.toContain('grayscale');
    });

    it('renders with Last 14 days timeframe', () => {
        const { container } = renderComponent({ selectedTimeFrame: 'Last 14 days' });
        expect(container.querySelector('canvas')).not.toBeNull();
    });

    it('renders with Last 30 days timeframe', () => {
        const { container } = renderComponent({ selectedTimeFrame: 'Last 30 days' });
        expect(container.querySelector('canvas')).not.toBeNull();
    });

    it('renders with Last 24 hours timeframe', () => {
        const { container } = renderComponent({ selectedTimeFrame: 'Last 24 hours' });
        expect(container.querySelector('canvas')).not.toBeNull();
    });

    it('renders with all timeline data provided', () => {
        const { container } = renderComponent({
            timelineData: {
                completed: [1, 2, 3],
                failed: [0, 1, 0],
                warning: [0, 0, 1]
            }
        });
        expect(container.querySelector('canvas')).not.toBeNull();
    });
});
