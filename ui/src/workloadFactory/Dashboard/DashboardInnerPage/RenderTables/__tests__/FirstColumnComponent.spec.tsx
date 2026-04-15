import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FirstColumnComponent from '../FirstColumnComponent';
import { GENERAL } from '../../../../../utils/appConstants';
import { INVENTORY_STATUS } from '../../../../../utils/consts';

vi.mock('@netapp/design-system', () => ({
    DsFlashingDotsLoader: () => <div data-testid="flashing-dots-loader" />,
    DsTypography: ({ children, variant, className }: any) => (
        <span data-testid={`typography-${variant}`} className={className}>
            {children}
        </span>
    )
}));

vi.mock('./RenderTables.module.scss', () => ({
    default: {
        renderTable: 'renderTable',
        statusContainer: 'statusContainer',
        statusIcon: 'statusIcon',
        circle: 'circle',
        online: 'online',
        offline: 'offline',
        unknown: 'unknown',
        disabled: 'disabled'
    }
}));

vi.mock('../../../../../common/InventoryStatusIndicator/InventoryStatusIndicator', () => ({
    default: ({ status, loading }: any) => {
        if (loading) return <div data-testid="flashing-dots-loader" />;
        if (status === 'Up' || status === 'Running') return <span>Online</span>;
        if (status === 'Stopped' || status === 'Down') return <span>Offline</span>;
        if (status === 'UNKNOWN') return <span>UNKNOWN</span>;
        return <span>Unknown</span>;
    }
}));

describe('FirstColumnComponent', () => {
    it('renders server instance name', () => {
        const rowData = { serverInstanceName: 'MyServer', status: 'Up' };
        render(<FirstColumnComponent rowData={rowData} />);
        expect(screen.getByText('MyServer')).toBeTruthy();
    });

    it('renders N/A when no serverInstanceName', () => {
        const rowData = { status: INVENTORY_STATUS.CASE_SENSITIVE_UP };
        render(<FirstColumnComponent rowData={rowData} />);
        expect(screen.getByText(GENERAL.NOT_AVAILABLE)).toBeTruthy();
    });

    it('shows loading indicator when loadingStatus is true', () => {
        const rowData = { serverInstanceName: 'Server1', loadingStatus: true };
        render(<FirstColumnComponent rowData={rowData} />);
        expect(screen.getByTestId('flashing-dots-loader')).toBeTruthy();
    });

    it('does not show status container when loadingStatus is true', () => {
        const rowData = { serverInstanceName: 'Server1', loadingStatus: true };
        render(<FirstColumnComponent rowData={rowData} />);
        expect(screen.queryByText('Online')).toBeNull();
    });

    it('shows Online status when status is Up', () => {
        const rowData = { serverInstanceName: 'Server1', status: INVENTORY_STATUS.CASE_SENSITIVE_UP };
        render(<FirstColumnComponent rowData={rowData} />);
        expect(screen.getByText('Online')).toBeTruthy();
    });

    it('shows Offline status when status is STOPPED', () => {
        const rowData = { serverInstanceName: 'Server1', status: INVENTORY_STATUS.STOPPED };
        render(<FirstColumnComponent rowData={rowData} />);
        expect(screen.getByText('Offline')).toBeTruthy();
    });

    it('shows Offline status when status is Down', () => {
        const rowData = { serverInstanceName: 'Server1', status: INVENTORY_STATUS.CASE_SENSITIVE_DOWN };
        render(<FirstColumnComponent rowData={rowData} />);
        expect(screen.getByText('Offline')).toBeTruthy();
    });

    it('shows UNKNOWN status when status is UNKNOWN', () => {
        const rowData = { serverInstanceName: 'Server1', status: INVENTORY_STATUS.UNKNOWN };
        render(<FirstColumnComponent rowData={rowData} />);
        expect(screen.getByText(INVENTORY_STATUS.UNKNOWN)).toBeTruthy();
    });

    it('shows flashing dots when no status and loading is true', () => {
        const rowData = { serverInstanceName: 'Server1', loading: true };
        render(<FirstColumnComponent rowData={rowData} />);
        expect(screen.getByTestId('flashing-dots-loader')).toBeTruthy();
    });

    it('shows Unknown text when no status and not loading', () => {
        const rowData = { serverInstanceName: 'Server1' };
        render(<FirstColumnComponent rowData={rowData} />);
        expect(screen.getByText('Unknown')).toBeTruthy();
    });

    it('renders with showDismissed prop', () => {
        const rowData = { serverInstanceName: 'Server1', status: INVENTORY_STATUS.CASE_SENSITIVE_UP };
        render(<FirstColumnComponent rowData={rowData} showDismissed />);
        expect(screen.getByText('Server1')).toBeTruthy();
    });

    it('shows Online when status is RUNNING', () => {
        const rowData = { serverInstanceName: 'Server1', status: INVENTORY_STATUS.RUNNING };
        render(<FirstColumnComponent rowData={rowData} />);
        expect(screen.getByText('Online')).toBeTruthy();
    });
});
