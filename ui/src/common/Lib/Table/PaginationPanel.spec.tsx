import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

import { PaginationPanel } from './PaginationPanel';

vi.mock('@netapp/icons/ic_link_arrow_expand.svg', () => ({
    ReactComponent: () => <svg data-testid="arrow-icon" />
}));

vi.mock('@netapp/design-system', () => ({
    Typography: ({ children, variant, className }: any) => (
        <span data-testid="typography" data-variant={variant} className={className}>
            {children}
        </span>
    )
}));

const makePagination = (overrides = {}) => ({
    gotoPage: vi.fn(),
    pageCount: 5,
    pageIndex: 0,
    pageRows: [{}, {}, {}, {}, {}],
    ...overrides
});

describe('PaginationPanel', () => {
    it('should be defined', () => {
        expect(PaginationPanel).toBeDefined();
    });

    it('should render without crashing', () => {
        const pagination = makePagination();
        const { container } = render(<PaginationPanel pagination={pagination} pageSize={10} totalRows={50} />);
        expect(container).toBeTruthy();
    });

    it('should show first and last row indices', () => {
        const pagination = makePagination({ pageIndex: 0, pageRows: [{}, {}, {}] });
        const { getByText } = render(<PaginationPanel pagination={pagination} pageSize={10} totalRows={30} />);
        expect(getByText(/1 - 3 of 30/)).toBeTruthy();
    });

    it('should show single item when first equals last', () => {
        const pagination = makePagination({ pageIndex: 0, pageRows: [{}] });
        const { getByText } = render(<PaginationPanel pagination={pagination} pageSize={10} totalRows={1} />);
        expect(getByText(/1 of 1/)).toBeTruthy();
    });

    it('should call gotoPage with pageIndex-1 when prev clicked', () => {
        const gotoPage = vi.fn();
        const pagination = makePagination({ pageIndex: 2, gotoPage });
        const { container } = render(<PaginationPanel pagination={pagination} pageSize={10} totalRows={50} />);
        const buttons = container.querySelectorAll('button');
        fireEvent.click(buttons[0]); // prev button
        expect(gotoPage).toHaveBeenCalledWith(1);
    });

    it('should call gotoPage with pageIndex+1 when next clicked', () => {
        const gotoPage = vi.fn();
        const pagination = makePagination({ pageIndex: 1, gotoPage, pageCount: 5 });
        const { container } = render(<PaginationPanel pagination={pagination} pageSize={10} totalRows={50} />);
        const buttons = container.querySelectorAll('button');
        fireEvent.click(buttons[1]); // next button
        expect(gotoPage).toHaveBeenCalledWith(2);
    });

    it('should disable prev button on first page', () => {
        const pagination = makePagination({ pageIndex: 0 });
        const { container } = render(<PaginationPanel pagination={pagination} pageSize={10} totalRows={50} />);
        const buttons = container.querySelectorAll('button');
        expect(buttons[0].disabled).toBe(true);
    });

    it('should disable next button on last page', () => {
        const pagination = makePagination({ pageIndex: 4, pageCount: 5 });
        const { container } = render(<PaginationPanel pagination={pagination} pageSize={10} totalRows={50} />);
        const buttons = container.querySelectorAll('button');
        expect(buttons[1].disabled).toBe(true);
    });

    it('should display current page number', () => {
        const pagination = makePagination({ pageIndex: 2 });
        const { getByText } = render(<PaginationPanel pagination={pagination} pageSize={10} totalRows={50} />);
        expect(getByText('3')).toBeTruthy(); // pageIndex + 1
    });
});
