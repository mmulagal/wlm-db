import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import SizePopover from './SizePopover';

vi.mock('../../../../utils/utilityFunctions', () => ({
    formatFractionalNumber: vi.fn((n: number, decimals: number) => n.toFixed(decimals))
}));

const makeStore = () =>
    configureStore({
        reducer: {
            auth: () => ({})
        }
    });

describe('SizePopover', () => {
    const mockData = {
        data: 512.5,
        log: 128.25,
        tempdb: 64.75,
        quorum: 10.0,
        buffer: 20.0,
        total: 735.5
    };

    const renderPopover = (data: any, wizardType: string) => {
        const store = makeStore();
        return render(<Provider store={store}>{SizePopover(data, wizardType)}</Provider>);
    };

    it('renders data size', () => {
        renderPopover(mockData, 'mssql');
        expect(screen.getByText(/Data/)).toBeTruthy();
        expect(screen.getByText('512.50 GiB')).toBeTruthy();
    });

    it('renders log size', () => {
        renderPopover(mockData, 'mssql');
        expect(screen.getByText(/Log/)).toBeTruthy();
        expect(screen.getByText('128.25 GiB')).toBeTruthy();
    });

    it('renders tempdb size for mssql wizard type', () => {
        renderPopover(mockData, 'mssql');
        expect(screen.getByText(/Tempdb/)).toBeTruthy();
        expect(screen.getByText('64.75 GiB')).toBeTruthy();
    });

    it('does not render tempdb for non-mssql wizard type', () => {
        renderPopover(mockData, 'pgsql');
        expect(screen.queryByText(/Tempdb/)).not.toBeInTheDocument();
    });

    it('renders quorum size', () => {
        renderPopover(mockData, 'mssql');
        expect(screen.getByText(/Quorum/)).toBeTruthy();
        expect(screen.getByText('10.00 GiB')).toBeTruthy();
    });

    it('renders buffer size', () => {
        renderPopover(mockData, 'mssql');
        expect(screen.getByText(/Headroom/)).toBeTruthy();
        expect(screen.getByText('20.00 GiB')).toBeTruthy();
    });

    it('renders total size', () => {
        renderPopover(mockData, 'mssql');
        expect(screen.getByText(/Total/)).toBeTruthy();
        expect(screen.getByText('735.50 GiB')).toBeTruthy();
    });

    it('renders with zero values', () => {
        const emptyData = { data: 0, log: 0, tempdb: 0, quorum: 0, buffer: 0, total: 0 };
        renderPopover(emptyData, 'mssql');
        expect(screen.getAllByText('0.00 GiB').length).toBeGreaterThan(0);
    });

    it('renders without tempdb for pgsql type', () => {
        renderPopover(mockData, 'pgsql');
        const allGib = screen.getAllByText(/GiB/);
        // data, log, quorum, buffer, total = 5 items (no tempdb)
        expect(allGib.length).toBe(5);
    });

    it('renders with mssql type having tempdb', () => {
        renderPopover(mockData, 'mssql');
        const allGib = screen.getAllByText(/GiB/);
        // data, log, tempdb, quorum, buffer, total = 6 items
        expect(allGib.length).toBe(6);
    });
});
