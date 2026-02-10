import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore, createSlice } from '@reduxjs/toolkit';
import SelectedVolumeSummary from './SelectedVolumeSummary';

vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, variant, style }: any) => <span data-variant={variant}>{children}</span>,
    DsFlashingDotsLoader: () => <span data-testid="loader">loading...</span>,
    Table: ({ tableProps, variant }: any) => (
        <div data-testid="table" data-variant={variant}>
            {tableProps?.columns?.map((col: any, i: number) => (
                <div key={i} data-testid={`col-${col.Header}`}>{col.Header}</div>
            ))}
            {tableProps?.rows?.map((row: any, i: number) => (
                <div key={i} data-testid={`row-${i}`}>{row.details}</div>
            ))}
        </div>
    ),
    useTable: (props: any) => props
}));

vi.mock('@netapp/design-system/dist/components/Table', () => ({
    ColumnProps: {}
}));

vi.mock('./SelectedVolumeSummary.module.scss', () => ({
    default: { selectedVolumeSummary: 'selectedVolumeSummary', instanceTable: 'instanceTable' }
}));

vi.mock('../../../../utils/appConstants', () => ({
    GENERAL: {
        ES_TOTAL_VOLUMES: 'Total volumes',
        ES_TOTAL_STORAGE_AMOUNT: 'Total storage amount',
        ES_TOTAL_PROVISIONED_IOPS: 'Total provisioned IOPS',
        ES_TOTAL_THROUGHPUT_MBPS: 'Total throughput MB/s',
        ES_DETAILS: 'Details',
        SUMMARY_TEXT: 'Summary of the selected volumes by volume type:',
        NOT_AVAILABLE: 'n/a'
    }
}));

vi.mock('../../../../utils/utilityFunctions', () => ({
    formatSizeTwoPrecision: (val: any) => `${val} GiB`
}));

vi.mock('../savingsUtil', () => ({
    mergeAoagVolumesList: (listA: any[], listB: any[]) => {
        const result: any[] = [];
        if (listA) result.push(...listA);
        if (listB) result.push(...listB);
        return result;
    }
}));

const makeStore = (overrides: any = {}) => {
    const slice = createSlice({
        name: 'exploreSavings',
        initialState: {
            selectedHostDetails: {},
            selectedPartnerHostDetails: {},
            getPartnerHostDetailsLoading: false,
            ...overrides
        },
        reducers: {}
    });
    return configureStore({ reducer: { exploreSavings: slice.reducer } });
};

describe('SelectedVolumeSummary', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders summary text', () => {
        const { container } = render(<Provider store={makeStore()}><SelectedVolumeSummary /></Provider>);
        expect(container.textContent).toContain('Summary of the selected volumes by volume type:');
    });

    it('renders table component', () => {
        render(<Provider store={makeStore()}><SelectedVolumeSummary /></Provider>);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('shows loading state rows when selectedHostDetails is loading', () => {
        const store = makeStore({
            selectedHostDetails: { loading: true }
        });
        render(<Provider store={store}><SelectedVolumeSummary /></Provider>);
        expect(screen.getByTestId('row-0').textContent).toBe('Total volumes');
        expect(screen.getByTestId('row-1').textContent).toBe('Total storage amount');
        expect(screen.getByTestId('row-2').textContent).toBe('Total provisioned IOPS');
        expect(screen.getByTestId('row-3').textContent).toBe('Total throughput MB/s');
    });

    it('shows loading state when getPartnerHostDetailsLoading is true', () => {
        const store = makeStore({
            getPartnerHostDetailsLoading: true
        });
        render(<Provider store={store}><SelectedVolumeSummary /></Provider>);
        // Loading state uses getLoadingStateData columns
        expect(screen.getByTestId('col-Details')).toBeTruthy();
    });

    it('renders with host prop using host ebsResourceInfo', async () => {
        const host = {
            ec2InstanceId: 'i-123',
            credentialId: 'cred-1',
            regionId: 'us-east-1',
            loading: false,
            ebsResourceInfo: [
                { id: 1, volumeType: 'gp3', size: 100, iops: 3000, throughput: 125 },
                { id: 2, volumeType: 'gp3', size: 200, iops: 6000, throughput: 250 }
            ]
        };
        const store = makeStore({ selectedHostDetails: {} });
        render(<Provider store={store}><SelectedVolumeSummary host={host} /></Provider>);

        await act(() => { vi.advanceTimersByTime(10); });

        expect(screen.getByTestId('col-gp3')).toBeTruthy();
    });

    it('renders without host prop using merged volumes from selectedHostDetails and selectedPartnerHostDetails', async () => {
        const store = makeStore({
            selectedHostDetails: {
                loading: false,
                ebsResourceInfo: [{ id: 1, volumeType: 'gp2', size: 50, iops: 0, throughput: 0 }]
            },
            selectedPartnerHostDetails: {
                ebsResourceInfo: [{ id: 2, volumeType: 'io1', size: 100, iops: 1000, throughput: 500 }]
            }
        });
        render(<Provider store={store}><SelectedVolumeSummary /></Provider>);

        await act(() => { vi.advanceTimersByTime(10); });

        expect(screen.getByTestId('col-gp2')).toBeTruthy();
        expect(screen.getByTestId('col-io1')).toBeTruthy();
    });

    it('uses selectedHostDetails when host matches selected host ids', async () => {
        const host = {
            ec2InstanceId: 'i-123',
            credentialId: 'cred-1',
            regionId: 'us-east-1',
            loading: false,
            ebsResourceInfo: [{ id: 1, volumeType: 'gp3', size: 50, iops: 3000, throughput: 125 }]
        };
        const store = makeStore({
            selectedHostDetails: {
                ec2InstanceId: 'i-123',
                credentialId: 'cred-1',
                regionId: 'us-east-1',
                loading: false,
                ebsResourceInfo: [
                    { id: 1, volumeType: 'gp3', size: 100, iops: 5000, throughput: 200 },
                    { id: 2, volumeType: 'io2', size: 200, iops: 10000, throughput: 500 }
                ]
            }
        });
        render(<Provider store={store}><SelectedVolumeSummary host={host} /></Provider>);

        await act(() => { vi.advanceTimersByTime(10); });

        // selectedHostDetails has gp3 + io2 since it's the most up-to-date
        expect(screen.getByTestId('col-gp3')).toBeTruthy();
        expect(screen.getByTestId('col-io2')).toBeTruthy();
    });

    it('renders Details column header', () => {
        const store = makeStore({
            selectedHostDetails: {
                loading: false,
                ebsResourceInfo: [{ id: 1, volumeType: 'gp2', size: 50, iops: 0, throughput: 0 }]
            }
        });
        render(<Provider store={store}><SelectedVolumeSummary /></Provider>);
        expect(screen.getByTestId('col-Details')).toBeTruthy();
    });

    it('handles empty ebsResourceInfo gracefully', async () => {
        const store = makeStore({
            selectedHostDetails: { loading: false, ebsResourceInfo: [] }
        });
        render(<Provider store={store}><SelectedVolumeSummary /></Provider>);

        await act(() => { vi.advanceTimersByTime(10); });

        expect(screen.getByTestId('table')).toBeTruthy();
        expect(screen.getByTestId('col-Details')).toBeTruthy();
    });

    it('handles undefined ebsResourceInfo when no host prop', async () => {
        const store = makeStore({
            selectedHostDetails: { loading: false },
            selectedPartnerHostDetails: {}
        });
        render(<Provider store={store}><SelectedVolumeSummary /></Provider>);

        await act(() => { vi.advanceTimersByTime(10); });

        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('aggregates multiple volumes of the same type', async () => {
        const host = {
            ec2InstanceId: 'i-agg',
            credentialId: 'cred-agg',
            regionId: 'us-west-2',
            loading: false,
            ebsResourceInfo: [
                { id: 1, volumeType: 'gp3', size: 100, iops: 3000, throughput: 125 },
                { id: 2, volumeType: 'gp3', size: 200, iops: 6000, throughput: 250 },
                { id: 3, volumeType: 'io1', size: 500, iops: 10000, throughput: 0 }
            ]
        };
        const store = makeStore({ selectedHostDetails: {} });
        render(<Provider store={store}><SelectedVolumeSummary host={host} /></Provider>);

        await act(() => { vi.advanceTimersByTime(10); });

        expect(screen.getByTestId('col-gp3')).toBeTruthy();
        expect(screen.getByTestId('col-io1')).toBeTruthy();
    });

    it('sets table variant to innerTable', () => {
        render(<Provider store={makeStore()}><SelectedVolumeSummary /></Provider>);
        expect(screen.getByTestId('table')).toHaveAttribute('data-variant', 'innerTable');
    });
});
