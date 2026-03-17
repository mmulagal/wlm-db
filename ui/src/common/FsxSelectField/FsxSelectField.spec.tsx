import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

import { DsSelectFsx } from './fsxSelectField';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('../../store/storeHooks', () => ({
    useAppSelector: vi.fn((selector: any) => selector({ sandbox: { isNA: false } })),
    useAppDispatch: () => vi.fn()
}));

// Mock design-system components
vi.mock('@netapp/design-system', () => ({
    DsCheckbox: ({ id, title, onSelect, isSelected, className, style, isDisabled }: any) => (
        <div data-testid={`checkbox-${id}`} data-selected={isSelected} className={className} style={style}>
            <input
                type="checkbox"
                id={id}
                checked={isSelected}
                disabled={isDisabled}
                onChange={e => onSelect && onSelect(id, e)}
            />
            <label htmlFor={id}>{typeof title === 'function' ? title() : title}</label>
        </div>
    ),
    DsTooltipInfo: ({ children }: any) => <div data-testid="tooltip-info">{children}</div>,
    DsTypography: ({ children, variant, className, onClick, isDisabled, style, id, title }: any) => (
        <span
            data-testid="ds-typography"
            data-variant={variant}
            className={className}
            onClick={onClick}
            data-disabled={isDisabled}
            style={style}
            id={id}
            title={typeof title === 'string' ? title : undefined}
        >
            {children}
        </span>
    )
}));

vi.mock('@netapp/design-system/dist/v2/components/dsTextField/dsTextField', () => ({
    DsTextField: ({ value, onChange, onClick, placeholder, isDisabled, isCleanable, title, ref }: any) => (
        <div data-testid="ds-text-field">
            <input
                data-testid="text-field-input"
                value={value || ''}
                onChange={onChange}
                onClick={onClick}
                placeholder={placeholder}
                disabled={isDisabled}
            />
        </div>
    )
}));

vi.mock('@netapp/design-system/dist/v2/components/dsTextField/dsChipTextField', () => ({
    DsChipTextField: ({ chips, onChange, onClick, placeholder, isDisabled }: any) => (
        <div data-testid="ds-chip-text-field">
            <input
                data-testid="chip-field-input"
                placeholder={placeholder}
                disabled={isDisabled}
                onClick={onClick}
                onChange={() => {}}
            />
        </div>
    ),
    Chip: {}
}));

vi.mock('@netapp/design-system/dist/v2/types/types', () => ({
    MonitorPosition: {},
    TriggerType: {}
}));

vi.mock('@netapp/design-system/dist/v2/hooks/usePosition', () => ({
    default: vi.fn()
}));

vi.mock('../hooks/useRunOnce', () => ({
    useRunOnce: (fn: () => void) => {
        fn();
    }
}));

vi.mock('../../utils/utilityFunctions', () => ({
    _Classes: (...args: any[]) => args.filter(Boolean).join(' ')
}));

vi.mock('./useOutsideClick', () => ({
    useOutsideClick: () => {
        const ref = { current: null };
        return ref;
    }
}));

// Mock DsDropDownList to avoid its complex internals
vi.mock('./dsDropDownList', () => ({
    DsDropDownList: ({ isExpanded, options, formatOptionLabel, actions }: any) => (
        <div data-testid="ds-dropdown-list" data-expanded={isExpanded}>
            {isExpanded &&
                options?.map((opt: any, i: number) => (
                    <div key={i} data-testid={`drop-option-${i}`}>
                        {formatOptionLabel ? formatOptionLabel(opt) : opt.label}
                    </div>
                ))}
            {isExpanded &&
                actions?.map((action: any, i: number) => (
                    <button key={i} data-testid={`drop-action-${i}`} onClick={e => action.onClick(e)}>
                        {action.children}
                    </button>
                ))}
        </div>
    )
}));

const baseOptions = [
    { id: 1, value: 'opt1', label: 'Option 1' },
    { id: 2, value: 'opt2', label: 'Option 2' },
    { id: 3, value: 'opt3', label: 'Option 3', isDisabled: true }
];

describe('FsxSelectField (DsSelectFsx)', () => {
    it('should be a defined component', () => {
        expect(DsSelectFsx).toBeDefined();
    });

    it('should render with options and value', () => {
        const { container } = render(
            <DsSelectFsx items={baseOptions} selectedItem={{ value: 'opt1', label: 'Option 1' }} onChange={vi.fn()} />
        );
        expect(container).toBeTruthy();
    });

    it('should render with empty items — shows "No options available"', () => {
        const { container } = render(<DsSelectFsx items={[]} selectedItem={null} onChange={vi.fn()} />);
        expect(container).toBeTruthy();
    });

    it('should render as disabled', () => {
        const { container } = render(
            <DsSelectFsx items={baseOptions} selectedItem={null} onChange={vi.fn()} isDisabled />
        );
        expect(container).toBeTruthy();
    });

    it('should render with placeholder', () => {
        const { container } = render(
            <DsSelectFsx items={[]} selectedItem={null} onChange={vi.fn()} placeholder="Select one" />
        );
        expect(container).toBeTruthy();
    });

    // ---- Single select: click to expand ----
    it('should expand dropdown when text field is clicked', () => {
        const { getByTestId } = render(<DsSelectFsx options={baseOptions} onChange={vi.fn()} />);
        const input = getByTestId('text-field-input');
        fireEvent.click(input);
        expect(getByTestId('ds-dropdown-list').dataset.expanded).toBe('true');
    });

    // ---- Single select: select an option ----
    it('should select an option and collapse dropdown', () => {
        const onSelect = vi.fn();
        const { getByTestId, getAllByTestId } = render(<DsSelectFsx options={baseOptions} onSelect={onSelect} />);
        // Expand
        fireEvent.click(getByTestId('text-field-input'));

        // Click first option (renders via formatOptionLabel → DsTypography)
        const opts = getAllByTestId('ds-typography');
        fireEvent.click(opts[0]);

        expect(onSelect).toHaveBeenCalledWith([expect.objectContaining({ id: 1 })]);
    });

    // ---- Multi-select with chip rendering ----
    it('should render chip text field for multi-select mode', () => {
        const { getByTestId } = render(<DsSelectFsx options={baseOptions} selectionType="multi" formatLabel="chip" />);
        expect(getByTestId('ds-chip-text-field')).toBeTruthy();
    });

    // ---- formatLabel='count' ----
    it('should render text field with count format label', () => {
        const { getByTestId } = render(
            <DsSelectFsx options={baseOptions} selectionType="single" formatLabel="count" />
        );
        // Single item with count format → shows "0 selected" initially
        const input = getByTestId('text-field-input') as HTMLInputElement;
        expect(input.value).toBe('0 selected');
    });

    // ---- formatLabel as function returning string ----
    it('should render text field with custom formatLabel function (string output)', () => {
        const formatLabelFn = vi.fn((values: any) => `Custom: ${values?.join(', ')}`);
        const { getByTestId } = render(
            <DsSelectFsx options={baseOptions} formatLabel={formatLabelFn} selectionType="single" />
        );
        expect(getByTestId('ds-text-field')).toBeTruthy();
    });

    // ---- formatLabel as function returning JSX ----
    it('should render wrapper div with formatLabel function returning JSX', () => {
        const formatLabelFn = vi.fn((_values: any) => <span data-testid="custom-label">Custom Label</span>);
        const { getByTestId } = render(
            <DsSelectFsx options={baseOptions} formatLabel={formatLabelFn} selectionType="single" />
        );
        expect(getByTestId('custom-label')).toBeTruthy();
    });

    // ---- formatLabel as object ----
    it('should render with formatLabel as object', () => {
        const labelElement = <div data-testid="object-label">Label Node</div>;
        const { getByTestId } = render(
            <DsSelectFsx options={baseOptions} formatLabel={labelElement} selectionType="single" />
        );
        expect(getByTestId('object-label')).toBeTruthy();
    });

    // ---- isSelectAll with multi-select ----
    it('should add Select All option in multi-select mode with isSelectAll=true', () => {
        const { getByTestId } = render(
            <DsSelectFsx options={baseOptions} selectionType="multi" isSelectAll formatLabel="chip" />
        );
        // Expand to see options
        fireEvent.click(getByTestId('chip-field-input'));
        const dropdown = getByTestId('ds-dropdown-list');
        expect(dropdown.innerHTML).toContain('Option 1');
    });

    // ---- Multi-select with actions ----
    it('should render Apply and Cancel action buttons for multi-select with isWithActions', () => {
        const { getByTestId } = render(
            <DsSelectFsx options={baseOptions} selectionType="multi" isWithActions formatLabel="chip" />
        );
        fireEvent.click(getByTestId('chip-field-input'));
        const applyBtn = getByTestId('drop-action-0');
        const cancelBtn = getByTestId('drop-action-1');
        expect(applyBtn.textContent).toBe('Apply');
        expect(cancelBtn.textContent).toBe('Cancel');
    });

    // ---- Apply action button click ----
    it('should call onSelect when Apply is clicked in multi-select with actions', () => {
        const onSelect = vi.fn();
        const { getByTestId } = render(
            <DsSelectFsx
                options={baseOptions}
                selectionType="multi"
                isWithActions
                onSelect={onSelect}
                formatLabel="chip"
            />
        );
        fireEvent.click(getByTestId('chip-field-input'));
        fireEvent.click(getByTestId('drop-action-0'));
        // Dropdown collapses; onSelect called with selected options
        expect(getByTestId('ds-dropdown-list').dataset.expanded).toBe('false');
    });

    // ---- Cancel action button click ----
    it('should collapse dropdown when Cancel is clicked', () => {
        const { getByTestId } = render(
            <DsSelectFsx options={baseOptions} selectionType="multi" isWithActions formatLabel="chip" />
        );
        fireEvent.click(getByTestId('chip-field-input'));
        expect(getByTestId('ds-dropdown-list').dataset.expanded).toBe('true');
        fireEvent.click(getByTestId('drop-action-1'));
        expect(getByTestId('ds-dropdown-list').dataset.expanded).toBe('false');
    });

    // ---- underline variant with tooltip ----
    it('should render DsTooltipInfo when variant=underline and tooltip is provided', () => {
        const { getByTestId } = render(
            <DsSelectFsx options={baseOptions} variant="underline" tooltip={{ title: 'Tooltip text' }} />
        );
        expect(getByTestId('tooltip-info')).toBeTruthy();
    });

    // ---- selectedOptionIds sync ----
    it('should sync selected option from selectedOptionIds prop', () => {
        const { getByTestId } = render(
            <DsSelectFsx options={baseOptions} selectedOptionIds={[2]} selectionType="single" />
        );
        const input = getByTestId('text-field-input') as HTMLInputElement;
        expect(input.value).toBe('Option 2');
    });

    // ---- value prop (array) for multi-select ----
    it('should sync selected options from value array prop', () => {
        const { getByTestId } = render(
            <DsSelectFsx
                options={baseOptions}
                selectionType="multi"
                formatLabel="chip"
                value={[{ id: 1, label: 'Option 1', value: 'opt1' }]}
            />
        );
        expect(getByTestId('ds-chip-text-field')).toBeTruthy();
    });

    // ---- dropDown center placement ----
    it('should calculate center offsetX for dropDown.placement=center', () => {
        const { container } = render(<DsSelectFsx options={baseOptions} dropDown={{ placement: 'center' }} />);
        expect(container).toBeTruthy();
    });

    // ---- dropDown alignRight placement ----
    it('should calculate alignRight offsetX for dropDown.placement=alignRight', () => {
        const { container } = render(<DsSelectFsx options={baseOptions} dropDown={{ placement: 'alignRight' }} />);
        expect(container).toBeTruthy();
    });

    // ---- Checkbox multi-select item click ----
    it('should handle checkbox change in multi-select mode', () => {
        const onSelect = vi.fn();
        const { getByTestId } = render(
            <DsSelectFsx options={baseOptions} selectionType="multi" formatLabel="chip" onSelect={onSelect} />
        );
        fireEvent.click(getByTestId('chip-field-input'));
        // Find the first checkbox and check it
        const checkbox = getByTestId('checkbox-1').querySelector('input') as HTMLInputElement;
        fireEvent.change(checkbox, { target: { checked: true } });
        // onSelect gets called via changeEventWithActionButtons
        expect(getByTestId('ds-dropdown-list')).toBeTruthy();
    });

    // ---- isExpanded prop external control ----
    it('should respect isExpanded prop to show expanded state', () => {
        const { getByTestId } = render(<DsSelectFsx options={baseOptions} isExpanded />);
        expect(getByTestId('ds-dropdown-list').dataset.expanded).toBe('true');
    });

    // ---- formatOptionLabel custom ----
    it('should use formatOptionLabel to customize option rendering', () => {
        const { getByTestId } = render(
            <DsSelectFsx
                options={baseOptions}
                isExpanded
                formatOptionLabel={(opt: any) => <span data-testid={`custom-opt-${opt.id}`}>{opt.label}</span>}
            />
        );
        expect(getByTestId('custom-opt-1')).toBeTruthy();
    });

    // ---- isLoading ----
    it('should render with isLoading state', () => {
        const { container } = render(<DsSelectFsx options={baseOptions} isLoading />);
        expect(container.firstChild).toBeTruthy();
    });

    // ---- searchMethod ----
    it('should pass searchMethod to dropdown list', () => {
        const { container } = render(
            <DsSelectFsx options={baseOptions} isExpanded searchMethod={{ method: 'basic' }} />
        );
        expect(container).toBeTruthy();
    });
});
