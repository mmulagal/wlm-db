import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useTable, getFilterOptions } from './useTable';

vi.mock('@emotion/css', () => ({
    css: vi.fn((strings: any, ...vals: any[]) => 'css-class')
}));

vi.mock('@netapp/design-system', () => ({
    Checkbox: ({ isChecked, onChange, isDisabled, variant, isPartial, menuOptions, children }: any) => (
        <input
            type="checkbox"
            data-testid="checkbox"
            checked={isChecked}
            onChange={onChange}
            disabled={isDisabled}
            data-variant={variant}
        />
    )
}));

vi.mock('../../../utils/utilityFunctions', () => ({
    getStickyClass: vi.fn(() => 'sticky-class'),
    HashTable: {}
}));

vi.mock('../../hooks/useRunOnceWhenTruthy', () => ({
    default: (fn: () => void, condition: boolean) => {
        if (condition) fn();
    }
}));

const makeColumns = () => [
    { id: 'name', accessor: 'name', Header: 'Name', isSortable: true },
    { id: 'status', accessor: 'status', Header: 'Status' },
    { id: 'count', accessor: 'count', Header: 'Count' }
];

const makeRows = () => [
    { id: '1', name: 'Alice', status: 'active', count: 10 },
    { id: '2', name: 'Bob', status: 'inactive', count: 5 },
    { id: '3', name: 'Charlie', status: 'active', count: 15 }
];

describe('useTable', () => {
    it('should be defined', () => {
        expect(useTable).toBeDefined();
    });

    it('should return required properties', () => {
        const { result } = renderHook(() =>
            useTable({
                isSorting: false,
                columns: makeColumns(),
                rows: makeRows() as any,
                pageSize: 10
            })
        );

        expect(result.current).toHaveProperty('rows');
        expect(result.current).toHaveProperty('organizedRows');
        expect(result.current).toHaveProperty('columns');
        expect(result.current).toHaveProperty('filterState');
        expect(result.current).toHaveProperty('sortState');
        expect(result.current).toHaveProperty('updateTextFilter');
        expect(result.current).toHaveProperty('resetFilters');
        expect(result.current).toHaveProperty('pagination');
    });

    it('should return all rows', () => {
        const { result } = renderHook(() =>
            useTable({
                isSorting: false,
                columns: makeColumns(),
                rows: makeRows() as any,
                pageSize: 10
            })
        );
        expect(result.current.rows.length).toBe(3);
    });

    it('should update text filter', () => {
        const { result } = renderHook(() =>
            useTable({
                isSorting: false,
                columns: makeColumns(),
                rows: makeRows() as any,
                pageSize: 10
            })
        );

        act(() => {
            result.current.updateTextFilter('alice');
        });

        expect(result.current.organizedRows.length).toBe(1);
        expect((result.current.organizedRows[0] as any).name).toBe('Alice');
    });

    it('should reset filters', () => {
        const { result } = renderHook(() =>
            useTable({
                isSorting: false,
                columns: makeColumns(),
                rows: makeRows() as any,
                pageSize: 10
            })
        );

        act(() => {
            result.current.updateTextFilter('alice');
        });
        expect(result.current.organizedRows.length).toBe(1);

        act(() => {
            result.current.resetFilters();
        });
        expect(result.current.organizedRows.length).toBe(3);
    });

    it('should toggle sort', () => {
        const { result } = renderHook(() =>
            useTable({
                isSorting: false,
                columns: makeColumns(),
                rows: makeRows() as any,
                pageSize: 10
            })
        );

        act(() => {
            result.current.toggleSort({ id: 'name' });
        });

        expect(result.current.sortState?.column).toBe('name');
        expect(result.current.sortState?.sortOrder).toBe('asc');
    });

    it('should toggle row selection for MULTIPLE selection type', () => {
        const { result } = renderHook(() =>
            useTable({
                isSorting: false,
                columns: makeColumns(),
                rows: makeRows() as any,
                selectionType: 'multiple',
                pageSize: 10
            })
        );

        act(() => {
            result.current.toggleRowSelection('1')(true);
        });

        expect(result.current.selectionState?.rows['1']).toBe(true);
        expect(result.current.selectionState?.count).toBe(1);
    });

    it('should support pagination', () => {
        const rows = Array.from({ length: 25 }, (_, i) => ({
            id: String(i),
            name: `Row ${i}`,
            status: 'active',
            count: i
        }));

        const { result } = renderHook(() =>
            useTable({
                isSorting: false,
                columns: makeColumns(),
                rows: rows as any,
                pageSize: 10
            })
        );

        expect(result.current.pagination).toBeTruthy();
        expect(result.current.pagination?.pageCount).toBe(3);
    });

    it('should handle isManagedColumns', () => {
        const { result } = renderHook(() =>
            useTable({
                isSorting: false,
                columns: makeColumns(),
                rows: makeRows() as any,
                pageSize: 10,
                isManagedColumns: true
            })
        );

        // Extra manage columns column appended
        expect(result.current.columns.length).toBeGreaterThan(makeColumns().length);
    });

    it('should handle isSorting=true (first column auto sorted)', () => {
        const { result } = renderHook(() =>
            useTable({
                isSorting: true,
                columns: makeColumns(),
                rows: makeRows() as any,
                pageSize: 10
            })
        );

        expect(result.current.sortState?.column).toBeTruthy();
    });

    it('should handle selectRows (select all)', () => {
        const { result } = renderHook(() =>
            useTable({
                isSorting: false,
                columns: makeColumns(),
                rows: makeRows() as any,
                selectionType: 'multiple',
                pageSize: 10
            })
        );

        act(() => {
            result.current.selectRows(makeRows() as any, true);
        });

        expect(result.current.selectionState?.count).toBeGreaterThan(0);
    });

    it('should handle updateFilterState', () => {
        const { result } = renderHook(() =>
            useTable({
                isSorting: false,
                columns: makeColumns(),
                rows: makeRows() as any,
                pageSize: 10
            })
        );

        act(() => {
            result.current.updateFilterState({
                id: 'status',
                values: { active: true }
            });
        });

        expect(result.current.filterState.count).toBe(1);
    });
});

describe('getFilterOptions', () => {
    it('should be defined', () => {
        expect(getFilterOptions).toBeDefined();
    });

    it('should return undefined for empty data', () => {
        const column = { id: 'status', accessor: 'status', Header: 'Status' };
        expect(getFilterOptions([], column)).toBeUndefined();
    });

    it('should return unique filter options', () => {
        const rows = [
            { id: '1', status: 'active' },
            { id: '2', status: 'inactive' },
            { id: '3', status: 'active' }
        ];
        const column = { id: 'status', accessor: 'status', Header: 'Status' };
        const options = getFilterOptions(rows as any, column as any);
        expect(options?.length).toBe(2);
    });

    it('should use renderFilterPanelLabel when provided', () => {
        const rows = [{ id: '1', status: 'active' }];
        const column = {
            id: 'status',
            accessor: 'status',
            Header: 'Status',
            renderFilterPanelLabel: (val: string) => `Status: ${val}`
        };
        const options = getFilterOptions(rows as any, column as any);
        expect(options?.[0].label).toBe('Status: active');
    });
});
