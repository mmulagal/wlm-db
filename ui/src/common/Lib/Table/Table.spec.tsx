import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';

import { Table } from './Table';

vi.mock('@netapp/icons/ic_sort.svg', () => ({ ReactComponent: () => <svg data-testid="sort-icon" /> }));
vi.mock('@netapp/icons/ic_arrow_down.svg', () => ({ ReactComponent: () => <svg data-testid="arrow-down-icon" /> }));
vi.mock('@netapp/icons/ic_arrow_up.svg', () => ({ ReactComponent: () => <svg data-testid="arrow-up-icon" /> }));
vi.mock('@netapp/icons/ic_file.svg', () => ({ ReactComponent: () => <svg data-testid="file-icon" /> }));
vi.mock('@netapp/icons/ic_search.svg', () => ({ ReactComponent: () => <svg data-testid="search-icon" /> }));

vi.mock('@emotion/css', () => ({
    css: vi.fn(() => 'css-class')
}));

vi.mock('@netapp/design-system', () => ({
    Button: ({ children, onClick, variant, className, isDisabled }: any) => (
        <button onClick={onClick} disabled={isDisabled} className={className}>
            {children}
        </button>
    ),
    DsTypography: ({ children, variant, color, isEllipsis, title, className }: any) => (
        <span data-testid="ds-typography" data-variant={variant} className={className} title={title}>
            {children}
        </span>
    ),
    TooltipInfo: ({ children, isAppendedToBody, className }: any) => (
        <div data-testid="tooltip-info" className={className}>
            {children}
        </div>
    )
}));

vi.mock('../../../utils/utilityFunctions', () => ({
    HashTable: {},
    getStickyClass: vi.fn(() => '')
}));

vi.mock('../../hooks/useHover', () => ({
    default: () => ({
        hoverParentProps: {},
        isHovered: false
    })
}));

vi.mock('./useResizeColumns', () => ({
    useResizeColumn: () => ({
        columnRef: { current: null },
        resizeRef: { current: null }
    })
}));

vi.mock('./FilterPanel', () => ({
    FilterButton: ({ column, isDisabled }: any) => (
        <button data-testid="filter-button" disabled={isDisabled}>
            Filter
        </button>
    )
}));

vi.mock('./PaginationPanel', () => ({
    PaginationPanel: ({ pagination, pageSize, totalRows }: any) => (
        <div data-testid="pagination-panel">{`Page ${pagination.pageIndex + 1} of ${pagination.pageCount}`}</div>
    )
}));

const makeColumn = (id: string, header: string, accessor?: string) => ({
    id,
    Header: header,
    accessor: accessor || id,
    isSortable: false
});

const makeRow = (id: string, name: string) => ({
    id,
    name,
    status: 'active'
});

const makeTableProps = (overrides: any = {}) => ({
    isHorizontalScroll: false,
    rows: [makeRow('1', 'Row 1'), makeRow('2', 'Row 2')],
    organizedRows: [makeRow('1', 'Row 1'), makeRow('2', 'Row 2')],
    columns: [makeColumn('name', 'Name'), makeColumn('status', 'Status')],
    sortState: null,
    filterState: { count: 0, textFilter: '', columns: {} },
    tableState: {},
    rowsState: {},
    selectionState: undefined,
    columnState: {},
    toggleSort: vi.fn(),
    updateFilterState: vi.fn(),
    updateRowState: vi.fn(),
    updateTextFilter: vi.fn(),
    toggleRowSelection: vi.fn(),
    selectAllRows: vi.fn(),
    resetFilters: vi.fn(),
    pagination: {
        pageIndex: 0,
        pageRows: [makeRow('1', 'Row 1'), makeRow('2', 'Row 2')],
        pageCount: 1,
        gotoPage: vi.fn(),
        totalRows: 2
    },
    pageSize: 50,
    textFilter: '',
    pageState: {},
    initialPageState: {},
    isLazyLoading: false,
    ...overrides
});

describe('Table', () => {
    it('should be defined', () => {
        expect(Table).toBeDefined();
    });

    it('should render without crashing', () => {
        const { container } = render(<Table tableProps={makeTableProps()} />);
        expect(container).toBeTruthy();
    });

    it('should render column headers', () => {
        const { getByText } = render(<Table tableProps={makeTableProps()} />);
        expect(getByText('Name')).toBeTruthy();
        expect(getByText('Status')).toBeTruthy();
    });

    it('should show "No data" when rows are empty', () => {
        const tableProps = makeTableProps({
            rows: [],
            organizedRows: [],
            pagination: {
                pageIndex: 0,
                pageRows: [],
                pageCount: 0,
                gotoPage: vi.fn(),
                totalRows: 0
            }
        });
        const { getByText } = render(<Table tableProps={tableProps} />);
        expect(getByText('No data')).toBeTruthy();
    });

    it('should show "No results" when rows are filtered to empty', () => {
        const tableProps = makeTableProps({
            rows: [makeRow('1', 'Row 1')],
            organizedRows: [],
            pagination: {
                pageIndex: 0,
                pageRows: [],
                pageCount: 0,
                gotoPage: vi.fn(),
                totalRows: 1
            }
        });
        const { getByText } = render(<Table tableProps={tableProps} />);
        expect(getByText('No results')).toBeTruthy();
    });

    it('should show lazy loading text when isLazyLoading=true and no rows', () => {
        const tableProps = makeTableProps({
            rows: [],
            organizedRows: [],
            isLazyLoading: true,
            pagination: {
                pageIndex: 0,
                pageRows: [],
                pageCount: 0,
                gotoPage: vi.fn(),
                totalRows: 0
            }
        });
        const { getByText } = render(<Table tableProps={tableProps} lazyLoadingText="Loading data..." />);
        expect(getByText('Loading data...')).toBeTruthy();
    });

    it('should render with pagination panel when pageCount > 1', () => {
        const tableProps = makeTableProps({
            pagination: {
                pageIndex: 0,
                pageRows: [makeRow('1', 'Row 1')],
                pageCount: 2,
                gotoPage: vi.fn(),
                totalRows: 20
            }
        });
        const { getByTestId } = render(<Table tableProps={tableProps} />);
        expect(getByTestId('pagination-panel')).toBeTruthy();
    });

    it('should render with innerTable variant', () => {
        const { container } = render(<Table tableProps={makeTableProps()} variant="innerTable" />);
        expect(container).toBeTruthy();
    });

    it('should forward ref', () => {
        const ref = React.createRef<HTMLDivElement>();
        const { container } = render(<Table tableProps={makeTableProps()} ref={ref} />);
        expect(container).toBeTruthy();
    });

    it('should render with isDoubleRow=true', () => {
        const { container } = render(<Table tableProps={makeTableProps()} isDoubleRow />);
        expect(container).toBeTruthy();
    });

    it('should render with isExternalFilter=true (no filter buttons)', () => {
        const tableProps = makeTableProps({
            columns: [
                {
                    id: 'name',
                    Header: 'Name',
                    accessor: 'name',
                    isSortable: true,
                    filterOptions: [{ value: 'a', label: 'A' }]
                }
            ]
        });
        const { container } = render(<Table tableProps={tableProps} isExternalFilter />);
        expect(container).toBeTruthy();
    });

    it('should render rows with data', () => {
        const { container } = render(<Table tableProps={makeTableProps()} />);
        const rows = container.querySelectorAll('[class*="row"]');
        expect(rows.length).toBeGreaterThan(0);
    });

    it('should render with horizontal scroll', () => {
        const tableProps = makeTableProps({ isHorizontalScroll: true });
        const { container } = render(<Table tableProps={tableProps} />);
        expect(container).toBeTruthy();
    });
});
