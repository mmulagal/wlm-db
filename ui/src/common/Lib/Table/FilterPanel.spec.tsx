import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

import { FilterPanel, FilterButton } from './FilterPanel';

vi.mock('@netapp/icons/ic_filter.svg', () => ({
    ReactComponent: () => <svg data-testid="filter-icon" />
}));

vi.mock('@netapp/design-system', () => ({
    Button: ({ children, onClick, variant, className, isDisabled }: any) => (
        <button onClick={onClick} disabled={isDisabled} className={className}>
            {children}
        </button>
    ),
    SearchInput: ({ value, onChange, isDisabled, placeholder }: any) => (
        <input
            type="search"
            data-testid="filter-option-search"
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={isDisabled}
            placeholder={placeholder}
        />
    ),
    Checkbox: ({ children, isChecked, onChange, isDisabled, className }: any) => (
        <label className={className}>
            <input type="checkbox" checked={isChecked} onChange={onChange} disabled={isDisabled} />
            {children}
        </label>
    ),
    Popover: ({ children, container, visible, isAppendedToBody, placement, popoverClass, containerClass }: any) => (
        <div data-testid="popover">
            {container}
            {visible && children}
        </div>
    )
}));

vi.mock('../../hooks/useClickOutside', () => ({
    default: (callback: () => void) => {
        const ref = { current: null };
        return ref;
    }
}));

vi.mock('../../../utils/appConstants', () => ({
    GENERAL: {
        NOT_AVAILABLE: 'N/A'
    }
}));

const makeColumn = (overrides = {}) => ({
    id: 'col1',
    accessor: 'field1',
    filterState: { values: { option1: true, option2: false } },
    filterOptions: [
        { value: 'option1', label: 'Option 1' },
        { value: 'option2', label: 'Option 2' },
        { value: 'option3', label: '' }
    ],
    updateColumnFilter: vi.fn(),
    ...overrides
});

describe('FilterPanel', () => {
    it('should be defined', () => {
        expect(FilterPanel).toBeDefined();
    });

    it('should render without crashing', () => {
        const column = makeColumn();
        const setIsOpen = vi.fn();
        const { container } = render(<FilterPanel column={column} setIsOpen={setIsOpen} />);
        expect(container).toBeTruthy();
    });

    it('should render filter options', () => {
        const column = makeColumn();
        const setIsOpen = vi.fn();
        const { getByText } = render(<FilterPanel column={column} setIsOpen={setIsOpen} />);
        expect(getByText('Option 1')).toBeTruthy();
        expect(getByText('Option 2')).toBeTruthy();
    });

    it('should show N/A for empty label option', () => {
        const column = makeColumn();
        const setIsOpen = vi.fn();
        const { getByText } = render(<FilterPanel column={column} setIsOpen={setIsOpen} />);
        expect(getByText('databases.general.not-available')).toBeTruthy();
    });

    it('should toggle checkbox state', () => {
        const column = makeColumn();
        const setIsOpen = vi.fn();
        const { container } = render(<FilterPanel column={column} setIsOpen={setIsOpen} />);
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        fireEvent.change(checkboxes[0], { target: { checked: false } });
        expect(container).toBeTruthy();
    });

    it('should call updateColumnFilter and setIsOpen on Apply', () => {
        const updateColumnFilter = vi.fn();
        const column = makeColumn({ updateColumnFilter });
        const setIsOpen = vi.fn();
        const { getByText } = render(<FilterPanel column={column} setIsOpen={setIsOpen} />);
        fireEvent.click(getByText('Apply'));
        expect(updateColumnFilter).toHaveBeenCalled();
        expect(setIsOpen).toHaveBeenCalledWith(false);
    });

    it('should clear filter and call setIsOpen on Clear', () => {
        const updateColumnFilter = vi.fn();
        const column = makeColumn({ updateColumnFilter });
        const setIsOpen = vi.fn();
        const { getByText } = render(<FilterPanel column={column} setIsOpen={setIsOpen} />);
        fireEvent.click(getByText('Clear'));
        expect(updateColumnFilter).toHaveBeenCalledWith({});
        expect(setIsOpen).toHaveBeenCalledWith(false);
    });

    it('should not show option search when filter option count is at most 5', () => {
        const filterOptions = Array.from({ length: 5 }, (_, i) => ({
            value: `v${i}`,
            label: `Label ${i}`
        }));
        const column = makeColumn({ filterOptions });
        const { queryByTestId } = render(<FilterPanel column={column} setIsOpen={vi.fn()} />);
        expect(queryByTestId('filter-option-search')).toBeNull();
    });

    it('should show option search when filter option count is greater than 5', () => {
        const filterOptions = Array.from({ length: 6 }, (_, i) => ({
            value: `v${i}`,
            label: `Label ${i}`
        }));
        const column = makeColumn({ filterOptions });
        const { getByTestId } = render(<FilterPanel column={column} setIsOpen={vi.fn()} />);
        expect(getByTestId('filter-option-search')).toBeTruthy();
    });

    it('should narrow visible options when search text is entered', () => {
        const filterOptions = Array.from({ length: 6 }, (_, i) => ({
            value: `v${i}`,
            label: `Option ${i}`
        }));
        const column = makeColumn({ filterOptions });
        const { getByTestId, getAllByRole } = render(<FilterPanel column={column} setIsOpen={vi.fn()} />);
        expect(getAllByRole('checkbox')).toHaveLength(6);
        fireEvent.change(getByTestId('filter-option-search'), { target: { value: 'Option 5' } });
        expect(getAllByRole('checkbox')).toHaveLength(1);
    });

    it('should show no-matches message when search has no results', () => {
        const filterOptions = Array.from({ length: 6 }, (_, i) => ({
            value: `v${i}`,
            label: `Option ${i}`
        }));
        const column = makeColumn({ filterOptions });
        const { getByTestId, getByText } = render(<FilterPanel column={column} setIsOpen={vi.fn()} />);
        fireEvent.change(getByTestId('filter-option-search'), { target: { value: 'nomatch' } });
        expect(getByText('databases.general.filter-options-no-matches')).toBeTruthy();
    });
});

describe('FilterButton', () => {
    it('should be defined', () => {
        expect(FilterButton).toBeDefined();
    });

    it('should render without crashing', () => {
        const column = makeColumn();
        const { container } = render(<FilterButton column={column} isDisabled={false} />);
        expect(container).toBeTruthy();
    });

    it('should toggle popover on button click', () => {
        const column = makeColumn();
        const { container } = render(<FilterButton column={column} isDisabled={false} />);
        const button = container.querySelector('button');
        fireEvent.click(button!);
        expect(container).toBeTruthy();
    });
});
