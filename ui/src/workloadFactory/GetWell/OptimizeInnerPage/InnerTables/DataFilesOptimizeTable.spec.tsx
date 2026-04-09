import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DataFilesOptimizeTable from './DataFilesOptimizeTable';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

vi.mock('../../../../utils/appConstants', () => ({
    GENERAL: { NOT_AVAILABLE: 'N/A' }
}));

vi.mock('../../GetWellUtils', () => ({
    getWadCellProps: vi.fn(() => ({}))
}));

vi.mock('@netapp/design-system', () => ({
    Table: () => <div data-testid="table" />,
    TableTopBar: ({ singularTitle, pluralTitle }: any) => (
        <div data-testid="table-top-bar">
            <span>{singularTitle}</span>
            <span>{pluralTitle}</span>
        </div>
    ),
    useTable: vi.fn(() => ({ selectionState: {}, tableRef: { current: null } }))
}));

vi.mock('./InnerTable.module.scss', () => ({ default: { 'inner-table': 'inner-table' } }));

const mockLastColDetails = vi.fn(() => ({
    Header: 'Actions',
    accessor: 'actions',
    id: 'actions',
    renderCell: () => <div>Action</div>
}));

describe('DataFilesOptimizeTable', () => {
    const defaultProps = {
        type: 'dataFiles',
        data: {
            objectsInViolation: ['db1', 'db2', 'db3']
        },
        lastColDetails: mockLastColDetails,
        handleBulkAction: vi.fn(),
        isWad: false
    };

    it('renders table', () => {
        render(<DataFilesOptimizeTable {...defaultProps} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders table top bar', () => {
        render(<DataFilesOptimizeTable {...defaultProps} />);
        expect(screen.getByTestId('table-top-bar')).toBeTruthy();
        expect(screen.getByText('Impacted databases')).toBeTruthy();
    });

    it('renders with empty violations', () => {
        render(<DataFilesOptimizeTable {...defaultProps} data={{ objectsInViolation: [] }} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with isWad true', () => {
        render(<DataFilesOptimizeTable {...defaultProps} isWad />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });
});
