import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import JobDoughnutChart from '../JobDoughnutChart';

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

vi.mock('../../../../utils/appConstants', () => ({
    GENERAL: { JOB_STATUS_JOBS: 'Jobs' }
}));

vi.mock('../JobDoughnutchart.module.scss', () => ({
    default: { jobChart: 'jobChart', 'center-text': 'center-text', emptyCircle: 'emptyCircle' }
}));

describe('JobDoughnutChart', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders job count when jobsSummaryData is provided', () => {
        render(<JobDoughnutChart jobsSummaryData={{ totalJobs: 42 }} jobsSummaryLoading={false} />);
        expect(screen.getByText('42')).toBeDefined();
    });

    it('renders 0 when no jobsSummaryData', () => {
        render(<JobDoughnutChart jobsSummaryData={null} jobsSummaryLoading={false} />);
        expect(screen.getByText('0')).toBeDefined();
    });

    it('renders "Jobs" label', () => {
        render(<JobDoughnutChart jobsSummaryData={{ totalJobs: 5 }} jobsSummaryLoading={false} />);
        expect(screen.getByText('Jobs')).toBeDefined();
    });

    it('renders emptyCircle when loading', () => {
        const { container } = render(<JobDoughnutChart jobsSummaryData={{ totalJobs: 5 }} jobsSummaryLoading />);
        expect(container.querySelector('.emptyCircle')).not.toBeNull();
    });

    it('renders emptyCircle when totalJobs is 0', () => {
        const { container } = render(
            <JobDoughnutChart jobsSummaryData={{ totalJobs: 0 }} jobsSummaryLoading={false} />
        );
        expect(container.querySelector('.emptyCircle')).not.toBeNull();
    });

    it('renders emptyCircle when jobsSummaryData is null', () => {
        const { container } = render(<JobDoughnutChart jobsSummaryData={null} jobsSummaryLoading={false} />);
        expect(container.querySelector('.emptyCircle')).not.toBeNull();
    });

    it('renders canvas when data exists and not loading', () => {
        const { container } = render(
            <JobDoughnutChart
                jobsSummaryData={{
                    totalJobs: 10,
                    completedPercent: 60,
                    failedPercent: 20,
                    inProgressPercent: 10,
                    warning: 10
                }}
                jobsSummaryLoading={false}
            />
        );
        expect(container.querySelector('canvas')).not.toBeNull();
    });
});
