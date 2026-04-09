import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CRROptimizeTable from './CRROptimizeTable';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

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

describe('CRROptimizeTable', () => {
    const defaultProps = {
        type: 'crr',
        data: {
            objectsInViolation: [
                { ontapVolumeName: 'vol1', fsxVolumeId: 'fsx-001' },
                { ontapVolumeName: 'vol2', fsxVolumeId: 'fsx-002' }
            ]
        },
        lastColDetails: mockLastColDetails,
        handleBulkAction: vi.fn(),
        isWad: false
    };

    it('renders table', () => {
        render(<CRROptimizeTable {...defaultProps} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders table top bar with volume titles', () => {
        render(<CRROptimizeTable {...defaultProps} />);
        expect(screen.getByTestId('table-top-bar')).toBeTruthy();
    });

    it('renders with string objects in violation', () => {
        render(<CRROptimizeTable {...defaultProps} data={{ objectsInViolation: ['vol1', 'vol2'] }} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with empty data', () => {
        render(<CRROptimizeTable {...defaultProps} data={{ objectsInViolation: [] }} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with isWad true', () => {
        render(<CRROptimizeTable {...defaultProps} isWad />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });
});
