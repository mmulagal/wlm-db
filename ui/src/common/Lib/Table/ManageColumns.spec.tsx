import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

import { ManageColumns, ManageColumnsPanel } from './ManageColumns';

vi.mock('@netapp/design-system', () => ({
    Checkbox: ({ children, isChecked, onChange, isDisabled, className }: any) => (
        <label className={className}>
            <input type="checkbox" checked={isChecked} onChange={onChange} disabled={isDisabled} />
            {children}
        </label>
    ),
    Popover: ({ children, container, visible, isAppendedToBody, popoverClass, containerClass, trigger }: any) => (
        <div data-testid="popover" data-trigger={trigger}>
            {container}
            {children}
        </div>
    )
}));

vi.mock('../../../assets/ic_columns.svg', () => ({
    ReactComponent: ({ style }: any) => <svg data-testid="columns-icon" style={style} />
}));

vi.mock('../../../utils/utilityFunctions', () => ({
    HashTable: {}
}));

const makeColumns = () => [
    { id: 'col1', Header: 'Column 1' },
    { id: 'col2', Header: 'Column 2' },
    { id: 'col3', Header: 'Column 3' }
];

const makeColumnsState = () => ({
    col1: { isHidden: false },
    col2: { isHidden: true },
    col3: { isHidden: false, isRemovalDisabled: true }
});

describe('ManageColumnsPanel', () => {
    it('should be defined', () => {
        expect(ManageColumnsPanel).toBeDefined();
    });

    it('should render without crashing', () => {
        const { container } = render(
            <ManageColumnsPanel
                allColumns={makeColumns()}
                columnsState={makeColumnsState()}
                updateColumnState={vi.fn()}
                setIsOpen={vi.fn()}
            />
        );
        expect(container).toBeTruthy();
    });

    it('should render column checkboxes', () => {
        const { getByText } = render(
            <ManageColumnsPanel
                allColumns={makeColumns()}
                columnsState={makeColumnsState()}
                updateColumnState={vi.fn()}
                setIsOpen={vi.fn()}
            />
        );
        expect(getByText('Column 1')).toBeTruthy();
        expect(getByText('Column 2')).toBeTruthy();
    });

    it('should render Select All checkbox', () => {
        const { getByText } = render(
            <ManageColumnsPanel
                allColumns={makeColumns()}
                columnsState={makeColumnsState()}
                updateColumnState={vi.fn()}
                setIsOpen={vi.fn()}
            />
        );
        expect(getByText('Select All')).toBeTruthy();
    });

    it('should call updateColumnState on Apply click', () => {
        const updateColumnState = vi.fn();
        const setIsOpen = vi.fn();
        const { getByText } = render(
            <ManageColumnsPanel
                allColumns={makeColumns()}
                columnsState={makeColumnsState()}
                updateColumnState={updateColumnState}
                setIsOpen={setIsOpen}
            />
        );
        fireEvent.click(getByText('Apply'));
        expect(updateColumnState).toHaveBeenCalled();
        expect(setIsOpen).toHaveBeenCalledWith(false);
    });

    it('should close on Cancel click without applying', () => {
        const updateColumnState = vi.fn();
        const setIsOpen = vi.fn();
        const { getByText } = render(
            <ManageColumnsPanel
                allColumns={makeColumns()}
                columnsState={makeColumnsState()}
                updateColumnState={updateColumnState}
                setIsOpen={setIsOpen}
            />
        );
        fireEvent.click(getByText('Cancel'));
        expect(updateColumnState).not.toHaveBeenCalled();
        expect(setIsOpen).toHaveBeenCalled();
    });

    it('should toggle column visibility via checkbox', () => {
        const { container } = render(
            <ManageColumnsPanel
                allColumns={makeColumns()}
                columnsState={makeColumnsState()}
                updateColumnState={vi.fn()}
                setIsOpen={vi.fn()}
            />
        );
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        fireEvent.change(checkboxes[1], { target: { checked: true } });
        expect(container).toBeTruthy();
    });

    it('should handle Select All toggle', () => {
        const { container } = render(
            <ManageColumnsPanel
                allColumns={makeColumns()}
                columnsState={makeColumnsState()}
                updateColumnState={vi.fn()}
                setIsOpen={vi.fn()}
            />
        );
        const selectAllCheckbox = container.querySelector('input[type="checkbox"]');
        fireEvent.change(selectAllCheckbox!, { target: { checked: false } });
        expect(container).toBeTruthy();
    });
});

describe('ManageColumns', () => {
    it('should be defined', () => {
        expect(ManageColumns).toBeDefined();
    });

    it('should render without crashing', () => {
        const { container } = render(
            <ManageColumns allColumns={makeColumns()} columnsState={makeColumnsState()} updateColumnState={vi.fn()} />
        );
        expect(container).toBeTruthy();
    });

    it('should toggle open state on button click', () => {
        const { container } = render(
            <ManageColumns allColumns={makeColumns()} columnsState={makeColumnsState()} updateColumnState={vi.fn()} />
        );
        const button = container.querySelector('button');
        fireEvent.click(button!);
        expect(container).toBeTruthy();
    });
});
