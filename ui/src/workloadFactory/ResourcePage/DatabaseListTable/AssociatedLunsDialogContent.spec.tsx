import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AssociatedLunsDialogContent from './AssociatedLunsDialogContent';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('@tlveng/wlm-ds', () => ({
    DsTypography: ({ children, variant }: any) => (
        <span data-testid="ds-typography" data-variant={variant}>
            {children}
        </span>
    )
}));

vi.mock('./AssociatedLunsDialogContent.module.scss', () => ({
    default: { associatedLunsTable: 'associatedLunsTable' }
}));

const mockUseTable = vi.fn((args: any) => args);

vi.mock('../../../common/Lib/Table/useTable', () => ({
    useTable: (args: any) => mockUseTable(args)
}));

vi.mock('../../../common/Lib/Table/Table', () => ({
    Table: ({ tableProps }: any) => (
        <div data-testid="table" data-variant="innerTable">
            {(tableProps.rows ?? []).map((row: any, rowIndex: number) => (
                <div data-testid="table-row" key={row.id ?? rowIndex}>
                    {(tableProps.columns ?? []).map((col: any) => (
                        <div data-testid={`cell-${col.id}`} key={col.id}>
                            {col.renderCell
                                ? col.renderCell(row[col.accessor], row, {
                                      updateRowState: () => undefined,
                                      rowsState: {},
                                      isRowHovered: false
                                  })
                                : row[col.accessor]}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    )
}));

const getRowCells = (rowIndex: number, cellId: string) => {
    const rows = screen.getAllByTestId('table-row');
    return within(rows[rowIndex]).getByTestId(`cell-${cellId}`);
};

describe('AssociatedLunsDialogContent', () => {
    beforeEach(() => {
        mockUseTable.mockClear();
    });

    describe('dedupeLuns', () => {
        it('dedupes entries that appear in both dataFiles and logFiles by name', () => {
            render(
                <AssociatedLunsDialogContent
                    luns={{
                        dataFiles: [
                            { name: '/vol/lun1', driveLetter: 'E' },
                            { name: '/vol/lun2', driveLetter: 'F' }
                        ],
                        logFiles: [
                            { name: '/vol/lun1', driveLetter: 'E' },
                            { name: '/vol/lun3', driveLetter: 'G' }
                        ]
                    }}
                />
            );

            const rows = screen.getAllByTestId('table-row');
            expect(rows).toHaveLength(3);
            expect(within(rows[0]).getByText('/vol/lun1')).toBeTruthy();
            expect(within(rows[1]).getByText('/vol/lun2')).toBeTruthy();
            expect(within(rows[2]).getByText('/vol/lun3')).toBeTruthy();
        });

        it('keeps the first occurrence and its driveLetter when duplicate names appear later', () => {
            render(
                <AssociatedLunsDialogContent
                    luns={{
                        dataFiles: [{ name: '/vol/shared', driveLetter: 'E' }],
                        logFiles: [{ name: '/vol/shared', driveLetter: 'Z' }]
                    }}
                />
            );

            expect(screen.getAllByTestId('table-row')).toHaveLength(1);
            expect(within(getRowCells(0, 'drive-letter')).getByText('E')).toBeTruthy();
            expect(within(getRowCells(0, 'lun-path')).getByText('/vol/shared')).toBeTruthy();
        });

        it('skips entries without a name', () => {
            render(
                <AssociatedLunsDialogContent
                    luns={{
                        dataFiles: [
                            { name: '', driveLetter: 'E' },
                            { name: '/vol/lun1', driveLetter: 'F' }
                        ],
                        logFiles: [{ name: '/vol/lun2', driveLetter: 'G' }]
                    }}
                />
            );

            const rows = screen.getAllByTestId('table-row');
            expect(rows).toHaveLength(2);
            expect(within(rows[0]).getByText('/vol/lun1')).toBeTruthy();
            expect(within(rows[1]).getByText('/vol/lun2')).toBeTruthy();
        });

        it('handles a missing logFiles array', () => {
            render(
                <AssociatedLunsDialogContent
                    luns={{
                        dataFiles: [
                            { name: '/vol/lun1', driveLetter: 'E' },
                            { name: '/vol/lun2', driveLetter: 'F' }
                        ]
                    }}
                />
            );

            expect(screen.getAllByTestId('table-row')).toHaveLength(2);
        });

        it('handles a missing dataFiles array', () => {
            render(<AssociatedLunsDialogContent luns={{ logFiles: [{ name: '/vol/log1', driveLetter: 'L' }] }} />);

            const rows = screen.getAllByTestId('table-row');
            expect(rows).toHaveLength(1);
            expect(within(rows[0]).getByText('/vol/log1')).toBeTruthy();
        });
    });

    describe('empty states', () => {
        it('renders no rows when luns is undefined', () => {
            render(<AssociatedLunsDialogContent />);
            expect(screen.queryAllByTestId('table-row')).toHaveLength(0);
            expect(screen.getByTestId('table')).toBeTruthy();
        });

        it('renders no rows when dataFiles and logFiles are both empty', () => {
            render(<AssociatedLunsDialogContent luns={{ dataFiles: [], logFiles: [] }} />);
            expect(screen.queryAllByTestId('table-row')).toHaveLength(0);
        });
    });

    describe('N/A fallback for missing values', () => {
        it('shows the not-available key when driveLetter is missing', () => {
            render(<AssociatedLunsDialogContent luns={{ dataFiles: [{ name: '/vol/lun1' }] }} />);

            expect(within(getRowCells(0, 'drive-letter')).getByText('databases.general.not-available')).toBeTruthy();
            expect(within(getRowCells(0, 'lun-path')).getByText('/vol/lun1')).toBeTruthy();
        });

        it('shows the not-available key when driveLetter is an empty string', () => {
            render(<AssociatedLunsDialogContent luns={{ dataFiles: [{ name: '/vol/lun1', driveLetter: '' }] }} />);

            expect(within(getRowCells(0, 'drive-letter')).getByText('databases.general.not-available')).toBeTruthy();
        });

        it('renders the driveLetter when present instead of the not-available fallback', () => {
            render(<AssociatedLunsDialogContent luns={{ dataFiles: [{ name: '/vol/lun1', driveLetter: 'E' }] }} />);

            expect(within(getRowCells(0, 'drive-letter')).getByText('E')).toBeTruthy();
            expect(within(getRowCells(0, 'drive-letter')).queryByText('databases.general.not-available')).toBeNull();
        });
    });

    describe('table configuration', () => {
        it('configures columns with sortable drive-letter and lun-path', () => {
            render(<AssociatedLunsDialogContent luns={{ dataFiles: [{ name: '/vol/lun1', driveLetter: 'E' }] }} />);

            expect(mockUseTable).toHaveBeenCalledTimes(1);
            const [args] = mockUseTable.mock.calls[0];
            expect(args.selectionType).toBe('none');
            expect(args.columns.map((c: any) => c.id)).toEqual(['drive-letter', 'lun-path']);
            expect(args.columns.every((c: any) => c.isSortable === true)).toBe(true);
            expect(args.rows).toEqual([{ id: '/vol/lun1', name: '/vol/lun1', driveLetter: 'E' }]);
        });
    });
});
