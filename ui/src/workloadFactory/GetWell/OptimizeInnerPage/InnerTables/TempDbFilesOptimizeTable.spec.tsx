import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TempDbFilesOptimizeTable from './TempDbFilesOptimizeTable';

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

describe('TempDbFilesOptimizeTable', () => {
    const defaultProps = {
        type: 'tempDbFiles',
        data: {
            objectsInViolation: ['tempdb']
        },
        lastColDetails: mockLastColDetails,
        isWad: false
    };

    it('renders table', () => {
        render(<TempDbFilesOptimizeTable {...defaultProps} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders table top bar with i18n titles', () => {
        render(<TempDbFilesOptimizeTable {...defaultProps} />);
        expect(screen.getByTestId('table-top-bar')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.impacted-databases')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.impacted-database')).toBeTruthy();
    });

    it('renders with empty violations', () => {
        render(<TempDbFilesOptimizeTable {...defaultProps} data={{ objectsInViolation: [] }} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with violationDetails containing additionalInfo', () => {
        const data = {
            objectsInViolation: ['tempdb'],
            violationDetails: [
                {
                    objectName: 'placement',
                    value: 'tempdb',
                    objectType: 'Database',
                    additionalInfo: { lunPath: '/vol/tempdb/lun1', driveLetter: 'T:' }
                },
                {
                    objectName: 'placement',
                    value: 'tempdb',
                    objectType: 'Database',
                    additionalInfo: { lunPath: '/vol/tempdb/lun2', driveLetter: 'U:' }
                }
            ]
        };
        render(<TempDbFilesOptimizeTable {...defaultProps} data={data} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with isWad true', () => {
        render(<TempDbFilesOptimizeTable {...defaultProps} isWad />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });
});
