import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

import { TableTopBar, exportToCsv } from './TableTopBar';

vi.mock('@netapp/icons/ic_download.svg', () => ({
    ReactComponent: () => <svg data-testid="export-icon" />
}));

vi.mock('@netapp/design-system', () => ({
    Button: ({ children, onClick, variant, className, isDisabled, title }: any) => (
        <button onClick={onClick} disabled={isDisabled} className={className} title={title}>
            {children}
        </button>
    ),
    DsFlashingDotsLoader: ({ className }: any) => <div data-testid="flashing-dots-loader" className={className} />,
    SearchInput: ({ value, onChange, isDisabled }: any) => (
        <input
            data-testid="search-input"
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            disabled={isDisabled}
        />
    ),
    TooltipInfo: ({ children, isAppendedToBody }: any) => <div data-testid="tooltip-info">{children}</div>,
    Typography: ({ children, variant, className, isEllipsis, color, title }: any) => (
        <span data-testid="typography" data-variant={variant} className={className} title={title}>
            {children}
        </span>
    )
}));

vi.mock('../../../utils/utilityFunctions', () => ({
    HashTable: {}
}));

vi.mock('@json2csv/plainjs', () => ({
    Parser: vi.fn().mockImplementation(() => ({
        parse: vi.fn().mockReturnValue('col1,col2\nval1,val2')
    }))
}));

const makeTableProps = (overrides = {}) => ({
    organizedRows: [
        { id: 1, name: 'Row 1' },
        { id: 2, name: 'Row 2' }
    ],
    rows: [{ id: 1 }, { id: 2 }, { id: 3 }],
    columns: [
        { id: 'name', accessor: 'name', Header: 'Name' },
        { id: 'id', accessor: 'id', Header: 'ID' }
    ],
    updateTextFilter: vi.fn(),
    filterState: { count: 0, textFilter: '' },
    resetFilters: vi.fn(),
    selectionState: null,
    isLazyLoading: false,
    ...overrides
});

describe('TableTopBar', () => {
    it('should be defined', () => {
        expect(TableTopBar).toBeDefined();
    });

    it('should render without crashing', () => {
        const { container } = render(
            <TableTopBar tableProps={makeTableProps()} singularTitle="Item" pluralTitle="Items" />
        );
        expect(container).toBeTruthy();
    });

    it('should show plural title with multiple rows', () => {
        const { getByText } = render(
            <TableTopBar tableProps={makeTableProps()} singularTitle="Item" pluralTitle="Items" />
        );
        expect(getByText('Items')).toBeTruthy();
    });

    it('should show singular title with one row', () => {
        const tableProps = makeTableProps({
            rows: [{ id: 1 }],
            organizedRows: [{ id: 1 }]
        });
        const { getByText } = render(<TableTopBar tableProps={tableProps} singularTitle="Item" pluralTitle="Items" />);
        expect(getByText('Item')).toBeTruthy();
    });

    it('should show search input', () => {
        const { getByTestId } = render(
            <TableTopBar tableProps={makeTableProps()} singularTitle="Item" pluralTitle="Items" />
        );
        expect(getByTestId('search-input')).toBeTruthy();
    });

    it('should call updateTextFilter when searching', () => {
        const updateTextFilter = vi.fn();
        const tableProps = makeTableProps({ updateTextFilter });
        const { getByTestId } = render(
            <TableTopBar tableProps={tableProps} singularTitle="Item" pluralTitle="Items" />
        );
        fireEvent.change(getByTestId('search-input'), { target: { value: 'test' } });
        expect(updateTextFilter).toHaveBeenCalledWith('test');
    });

    it('should render export button when exportToCsvOptions provided', () => {
        const { container } = render(
            <TableTopBar
                tableProps={makeTableProps()}
                singularTitle="Item"
                pluralTitle="Items"
                exportToCsvOptions={{ fileName: 'test.csv' }}
            />
        );
        const exportButton = container.querySelector('[title="Export to CSV"]');
        expect(exportButton).toBeTruthy();
    });

    it('should show lazy loading indicator', () => {
        const tableProps = makeTableProps({ isLazyLoading: true });
        const { getByTestId } = render(
            <TableTopBar
                tableProps={tableProps}
                singularTitle="Item"
                pluralTitle="Items"
                lazyLoadingText="Loading..."
            />
        );
        expect(getByTestId('flashing-dots-loader')).toBeTruthy();
    });

    it('should show filter text when filters are active', () => {
        const tableProps = makeTableProps({
            filterState: { count: 2, textFilter: 'search' }
        });
        const { container } = render(<TableTopBar tableProps={tableProps} singularTitle="Item" pluralTitle="Items" />);
        expect(container).toBeTruthy();
    });

    it('should show info tooltip when info prop provided', () => {
        const { getByTestId } = render(
            <TableTopBar
                tableProps={makeTableProps()}
                singularTitle="Item"
                pluralTitle="Items"
                info={<span>Tooltip info</span>}
            />
        );
        expect(getByTestId('tooltip-info')).toBeTruthy();
    });

    it('should show selection text when selectionState is set', () => {
        const tableProps = makeTableProps({
            selectionState: { count: 2 }
        });
        const { container } = render(<TableTopBar tableProps={tableProps} singularTitle="Item" pluralTitle="Items" />);
        expect(container).toBeTruthy();
    });

    it('should render left component when provided', () => {
        const { getByText } = render(
            <TableTopBar
                tableProps={makeTableProps()}
                singularTitle="Item"
                pluralTitle="Items"
                LeftComponent={<div>Left Content</div>}
            />
        );
        expect(getByText('Left Content')).toBeTruthy();
    });

    it('should hide count when hideCount is true', () => {
        const { container } = render(
            <TableTopBar tableProps={makeTableProps()} singularTitle="Item" pluralTitle="Items" hideCount />
        );
        expect(container).toBeTruthy();
    });
});

describe('exportToCsv', () => {
    it('should be defined', () => {
        expect(exportToCsv).toBeDefined();
    });

    it('should not throw when called', () => {
        const createElement = vi.spyOn(document, 'createElement');
        const mockElement = {
            setAttribute: vi.fn(),
            click: vi.fn(),
            style: { display: '' }
        };
        createElement.mockReturnValue(mockElement as any);
        const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockElement as any);
        const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockElement as any);

        const tableProps = makeTableProps();
        expect(() => exportToCsv({ fileName: 'test.csv' }, tableProps as any)).not.toThrow();

        createElement.mockRestore();
        appendChildSpy.mockRestore();
        removeChildSpy.mockRestore();
    });
});
