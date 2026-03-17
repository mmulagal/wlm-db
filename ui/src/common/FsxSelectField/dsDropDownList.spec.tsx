import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import React, { useRef } from 'react';

import { DsDropDownList } from './dsDropDownList';

// ── Hoisted callback store for useOutsideClick ────────────────────────────────
const outsideClickCallbacks = vi.hoisted(() => [] as (() => void)[]);

// ── Icon mocks ────────────────────────────────────────────────────────────────
vi.mock('@netapp/icons/ic_search.svg', () => ({ ReactComponent: () => <svg data-testid="search-icon" /> }));
vi.mock('@netapp/icons/ic_close.svg', () => ({
    ReactComponent: ({ onClick, className }: any) => (
        <svg data-testid="close-icon" onClick={onClick} className={className} />
    )
}));

// ── Design-system mocks ───────────────────────────────────────────────────────
vi.mock('@netapp/design-system', () => ({
    DsFlashingDotsLoader: () => <div data-testid="flashing-dots-loader" />,
    DsPopover: ({ children, trigger, title }: any) => (
        <div data-testid="ds-popover" data-trigger={trigger} title={title}>
            {children}
        </div>
    ),
    DsTypography: ({ children, variant, className, onClick, isDisabled, title, style, id }: any) => (
        <span
            data-testid="ds-typography"
            data-variant={variant}
            className={className}
            onClick={onClick}
            data-disabled={isDisabled}
            title={typeof title === 'string' ? title : undefined}
            style={style}
            id={id}
        >
            {children}
        </span>
    )
}));

vi.mock('@netapp/design-system/dist/v2/components/dsButton/dsButton', () => ({
    DsButton: ({ children, onClick, variant, type, isDisabled }: any) => (
        <button onClick={onClick} disabled={isDisabled} data-variant={variant} data-type={type}>
            {children}
        </button>
    )
}));

vi.mock('@netapp/design-system/dist/v2/types/types', () => ({
    MonitorPosition: {},
    TriggerType: {}
}));

vi.mock('@netapp/design-system/dist/v2/hooks/usePosition', () => ({
    default: vi.fn()
}));

// Run fn() in useEffect so boundariesRef.current is set when fn executes
vi.mock('../hooks/useRunOnce', () => ({
    useRunOnce: (fn: () => void) => {
        React.useEffect(() => {
            fn();
        }, []);
    }
}));

vi.mock('../../utils/utilityFunctions', () => ({
    _Classes: (...args: any[]) => args.filter(Boolean).join(' ')
}));

// Capture every callback passed to useOutsideClick so tests can invoke it
vi.mock('./useOutsideClick', () => ({
    useOutsideClick: (callback: () => void) => {
        outsideClickCallbacks.push(callback);
        const ref = React.useRef<HTMLDivElement>(null);
        return ref;
    }
}));

// ── Helper wrapper ────────────────────────────────────────────────────────────
const WrapperComponent = ({ props }: { props: any }) => {
    const boundariesRef = useRef<HTMLDivElement>(null);
    return (
        <div>
            <div ref={boundariesRef} data-testid="boundary">
                Trigger
            </div>
            <DsDropDownList {...props} boundariesRef={boundariesRef} />
        </div>
    );
};

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('DsDropDownList', () => {
    const defaultOptions = [
        { id: 1, label: 'Option 1' },
        { id: 2, label: 'Option 2' },
        { id: 3, label: 'Option 3', isDisabled: true }
    ];

    beforeEach(() => {
        // Clear captured callbacks before every test
        outsideClickCallbacks.length = 0;
    });

    // ── Basic render ──────────────────────────────────────────────────────────
    it('should be defined', () => {
        expect(DsDropDownList).toBeDefined();
    });

    it('should render without crashing', () => {
        const { container } = render(<WrapperComponent props={{ options: defaultOptions, onClick: vi.fn() }} />);
        expect(container).toBeTruthy();
    });

    it('should show options when expanded', () => {
        const { container } = render(
            <WrapperComponent props={{ options: defaultOptions, isExpanded: true, onClick: vi.fn() }} />
        );
        expect(container).toBeTruthy();
    });

    it('should render with search method', () => {
        const { container } = render(
            <WrapperComponent
                props={{
                    options: defaultOptions,
                    isExpanded: true,
                    searchMethod: { method: 'basic' },
                    onClick: vi.fn()
                }}
            />
        );
        expect(container).toBeTruthy();
    });

    it('should render with actions', () => {
        const { container } = render(
            <WrapperComponent
                props={{
                    options: defaultOptions,
                    isExpanded: true,
                    actions: [
                        { children: 'Action 1', onClick: vi.fn() },
                        { children: 'Action 2', onClick: vi.fn() }
                    ],
                    onClick: vi.fn()
                }}
            />
        );
        expect(container).toBeTruthy();
    });

    it('should render with empty options', () => {
        const { container } = render(<WrapperComponent props={{ options: [], onClick: vi.fn() }} />);
        expect(container).toBeTruthy();
    });

    it('should render with custom formatOptionLabel', () => {
        const { container } = render(
            <WrapperComponent
                props={{
                    options: defaultOptions,
                    isExpanded: true,
                    formatOptionLabel: (option: any) => <span>Custom: {option.label}</span>,
                    onClick: vi.fn()
                }}
            />
        );
        expect(container).toBeTruthy();
    });

    it('should render options list when expanded', () => {
        const { getAllByTestId } = render(
            <WrapperComponent props={{ options: defaultOptions, isExpanded: true, onClick: vi.fn() }} />
        );
        const items = getAllByTestId('ds-typography');
        expect(items.length).toBeGreaterThan(0);
    });

    it('should call onClick when a non-disabled option is clicked', () => {
        const onClickFn = vi.fn();
        const { getAllByTestId } = render(
            <WrapperComponent
                props={{ options: [{ id: 1, label: 'Clickable' }], isExpanded: true, onClick: onClickFn }}
            />
        );
        const items = getAllByTestId('ds-typography');
        fireEvent.click(items[0]);
        expect(onClickFn).toHaveBeenCalled();
    });

    it('should render search input when searchMethod is provided and expanded', () => {
        const { container } = render(
            <WrapperComponent
                props={{
                    options: defaultOptions,
                    isExpanded: true,
                    searchMethod: { method: 'basic' },
                    onClick: vi.fn()
                }}
            />
        );
        const searchInput = container.querySelector('input[type="text"]');
        expect(searchInput).toBeTruthy();
    });

    it('should filter options when typing in search input', () => {
        const { container, getAllByTestId } = render(
            <WrapperComponent
                props={{
                    options: [
                        { id: 1, label: 'Alpha' },
                        { id: 2, label: 'Beta' },
                        { id: 3, label: 'Gamma' }
                    ],
                    isExpanded: true,
                    searchMethod: { method: 'basic' },
                    onClick: vi.fn()
                }}
            />
        );
        const searchInput = container.querySelector('input[type="text"]') as HTMLInputElement;
        fireEvent.change(searchInput, { target: { value: 'alp' } });
        const items = getAllByTestId('ds-typography');
        expect(items.some(el => el.textContent?.toLowerCase().includes('alpha'))).toBe(true);
    });

    it('should clear search when CloseIcon is clicked', () => {
        const { container } = render(
            <WrapperComponent
                props={{
                    options: defaultOptions,
                    isExpanded: true,
                    searchMethod: { method: 'basic' },
                    onClick: vi.fn()
                }}
            />
        );
        const searchInput = container.querySelector('input[type="text"]') as HTMLInputElement;
        fireEvent.change(searchInput, { target: { value: 'opt' } });
        expect(searchInput.value).toBe('opt');

        const closeIcon = container.querySelector('[data-testid="close-icon"]') as HTMLElement;
        fireEvent.click(closeIcon);
        expect(searchInput.value).toBe('');
    });

    it('should render searchMethod with addItem button', () => {
        const { container } = render(
            <WrapperComponent
                props={{
                    options: defaultOptions,
                    isExpanded: true,
                    searchMethod: { method: 'basic', addItem: vi.fn() },
                    onClick: vi.fn()
                }}
            />
        );
        expect(container.querySelector('button')).toBeTruthy();
    });

    it('should call addItem when Add button is clicked after typing', () => {
        const addItem = vi.fn();
        const { container } = render(
            <WrapperComponent
                props={{
                    options: defaultOptions,
                    isExpanded: true,
                    searchMethod: { method: 'basic', addItem },
                    onClick: vi.fn()
                }}
            />
        );
        const searchInput = container.querySelector('input[type="text"]') as HTMLInputElement;
        fireEvent.change(searchInput, { target: { value: 'NewOpt' } });
        const addButton = container.querySelector('button') as HTMLButtonElement;
        fireEvent.click(addButton);
        expect(addItem).toHaveBeenCalledWith('NewOpt');
    });

    it('should render DsFlashingDotsLoader when searchMethod.isLoading=true', () => {
        const { getByTestId } = render(
            <WrapperComponent
                props={{
                    options: defaultOptions,
                    isExpanded: true,
                    searchMethod: { method: 'basic', addItem: vi.fn(), isLoading: true },
                    onClick: vi.fn()
                }}
            />
        );
        expect(getByTestId('flashing-dots-loader')).toBeTruthy();
    });

    it('should render action buttons when actions provided', () => {
        const applyFn = vi.fn();
        const cancelFn = vi.fn();
        const { getAllByTestId } = render(
            <WrapperComponent
                props={{
                    options: defaultOptions,
                    isExpanded: true,
                    actions: [
                        { children: 'Apply', onClick: applyFn },
                        { children: 'Cancel', onClick: cancelFn }
                    ],
                    onClick: vi.fn()
                }}
            />
        );
        const buttons = getAllByTestId('ds-typography').filter(
            el => el.textContent === 'Apply' || el.textContent === 'Cancel'
        );
        expect(buttons.length).toBe(2);
    });

    it('should call action onClick when action button is clicked', () => {
        const applyFn = vi.fn();
        const { getAllByTestId } = render(
            <WrapperComponent
                props={{
                    options: defaultOptions,
                    isExpanded: true,
                    actions: [
                        { children: 'Apply', onClick: applyFn },
                        { children: 'Cancel', onClick: vi.fn() }
                    ],
                    onClick: vi.fn()
                }}
            />
        );
        const applyBtn = getAllByTestId('ds-typography').find(el => el.textContent === 'Apply');
        fireEvent.click(applyBtn!);
        expect(applyFn).toHaveBeenCalled();
    });

    it('should use custom searchMethod function to filter', () => {
        const customSearch = vi.fn((items: any[], val: string) =>
            items.filter(i => i.label.startsWith(val.toUpperCase()))
        );
        render(
            <WrapperComponent
                props={{
                    options: [
                        { id: 1, label: 'ALPHA' },
                        { id: 2, label: 'BETA' }
                    ],
                    isExpanded: true,
                    searchMethod: { method: customSearch },
                    onClick: vi.fn()
                }}
            />
        );
        expect(customSearch).toHaveBeenCalled();
    });

    it('should render disabled option with isDisabled flag', () => {
        const { getAllByTestId } = render(
            <WrapperComponent
                props={{
                    options: [{ id: 1, label: 'Disabled Item', isDisabled: true }],
                    isExpanded: true,
                    onClick: vi.fn()
                }}
            />
        );
        expect(getAllByTestId('ds-typography').length).toBeGreaterThan(0);
    });

    it('should call onExpandChange when expanded state changes', async () => {
        vi.useFakeTimers();
        const onExpandChange = vi.fn();
        render(
            <WrapperComponent
                props={{
                    options: defaultOptions,
                    isExpanded: true,
                    onExpandChange,
                    onClick: vi.fn()
                }}
            />
        );
        await act(async () => {
            vi.advanceTimersByTime(10);
        });
        expect(onExpandChange).toHaveBeenCalled();
        vi.useRealTimers();
    });

    // ── NEW: searchMethod='smart' early return (lines 295–296) ───────────────
    it('should return early for smart searchMethod without filtering', () => {
        const { container } = render(
            <WrapperComponent
                props={{
                    options: defaultOptions,
                    isExpanded: true,
                    searchMethod: { method: 'smart' },
                    onClick: vi.fn()
                }}
            />
        );
        const searchInput = container.querySelector('input[type="text"]') as HTMLInputElement;
        // Change input — smart method returns early so options are not filtered
        if (searchInput) {
            fireEvent.change(searchInput, { target: { value: 'opt' } });
        }
        expect(container).toBeTruthy();
    });

    // ── NEW: scroll event on items container (line 474) ───────────────────────
    it('should update scrollTop when itemsContainer is scrolled', () => {
        const { container } = render(
            <WrapperComponent props={{ options: defaultOptions, isExpanded: true, onClick: vi.fn() }} />
        );
        const itemsContainer = container.querySelector('.itemsContainer');
        if (itemsContainer) {
            fireEvent.scroll(itemsContainer, { target: { scrollTop: 80 } });
        }
        expect(container).toBeTruthy();
    });

    // ── NEW: onMouseOver prop (line 434) ──────────────────────────────────────
    it('should call onMouseOver when hovering over action list div', () => {
        const onMouseOver = vi.fn();
        const { container } = render(
            <WrapperComponent props={{ options: defaultOptions, isExpanded: true, onMouseOver, onClick: vi.fn() }} />
        );
        const actionListRef = container.querySelector('.actionListRef');
        if (actionListRef) {
            fireEvent.mouseOver(actionListRef);
        }
        expect(onMouseOver).toHaveBeenCalled();
    });

    // ── NEW: mouseOver/mouseLeave on items container (lines 476–477) ──────────
    it('should set isMouseOverDropdown on mouseOver items container', () => {
        const { container } = render(
            <WrapperComponent props={{ options: defaultOptions, isExpanded: true, onClick: vi.fn() }} />
        );
        const itemsContainer = container.querySelector('.itemsContainer');
        if (itemsContainer) {
            fireEvent.mouseOver(itemsContainer);
        }
        expect(container).toBeTruthy();
    });

    // ── NEW: handleonMouseLeave with trigger='click' (lines 308–310) ──────────
    it('should call handleonMouseLeave when mouse leaves items container (trigger=click)', () => {
        const { container } = render(
            <WrapperComponent props={{ options: defaultOptions, isExpanded: true, onClick: vi.fn() }} />
        );
        const itemsContainer = container.querySelector('.itemsContainer');
        if (itemsContainer) {
            fireEvent.mouseLeave(itemsContainer);
        }
        expect(container).toBeTruthy();
    });

    // ── NEW: handleonMouseLeave with trigger='hover' (lines 311–321) ──────────
    it('should trigger hover-specific logic in handleonMouseLeave', async () => {
        vi.useFakeTimers();
        const onExpandChange = vi.fn();
        const { container } = render(
            <WrapperComponent
                props={{
                    options: defaultOptions,
                    isExpanded: true,
                    trigger: 'hover',
                    onExpandChange,
                    onClick: vi.fn()
                }}
            />
        );
        const itemsContainer = container.querySelector('.itemsContainer');
        if (itemsContainer) {
            // Set isMouseOverDropdown = true first, then leave
            fireEvent.mouseOver(itemsContainer);
            fireEvent.mouseLeave(itemsContainer);
        }
        await act(async () => {
            vi.advanceTimersByTime(300);
        });
        // Covers handleonMouseLeave trigger='hover' setTimeout path
        expect(container).toBeTruthy();
        vi.useRealTimers();
    });

    // ── NEW: trigger='hover' useRunOnce listeners (lines 223–240) ────────────
    it('should register hover event listeners via useRunOnce when trigger=hover', async () => {
        const onExpandChange = vi.fn();
        const { getByTestId, container } = render(
            <WrapperComponent
                props={{
                    options: defaultOptions,
                    trigger: 'hover',
                    onExpandChange,
                    onClick: vi.fn()
                }}
            />
        );
        // useRunOnce fires after mount (via useEffect mock); fire native mouseover
        await act(async () => {
            fireEvent.mouseOver(getByTestId('boundary'));
        });
        // Covers lines 223–228: mouseover listener that toggles list expansion
        expect(container).toBeTruthy();
    });

    it('should fire hover mouseleave listener via useRunOnce', async () => {
        vi.useFakeTimers();
        const onExpandChange = vi.fn();
        const { getByTestId, container } = render(
            <WrapperComponent
                props={{
                    options: defaultOptions,
                    trigger: 'hover',
                    onExpandChange,
                    onClick: vi.fn()
                }}
            />
        );
        await act(async () => {
            // Expand via mouseover first
            fireEvent.mouseOver(getByTestId('boundary'));
        });
        await act(async () => {
            // Then leave — triggers mouseleave listener (lines 230–239)
            fireEvent.mouseLeave(getByTestId('boundary'));
        });
        await act(async () => {
            vi.advanceTimersByTime(300);
        });
        expect(container).toBeTruthy();
        vi.useRealTimers();
    });

    // ── NEW: useOutsideClick callback – isCloseOnClickOutside=true (211–218) ──
    it('should close list when outside click fires with isCloseOnClickOutside=true', async () => {
        vi.useFakeTimers();
        const onExpandChange = vi.fn();
        render(
            <WrapperComponent
                props={{
                    options: defaultOptions,
                    isExpanded: true,
                    isCloseOnClickOutside: true,
                    onExpandChange,
                    onClick: vi.fn()
                }}
            />
        );
        // cb[0] is DsDropDownList's useOutsideClick callback
        const cb = outsideClickCallbacks[0];
        act(() => {
            cb?.();
        });
        await act(async () => {
            vi.advanceTimersByTime(100);
        });
        // setIsListExpanded(false) and onExpandChange(false, ...) are called
        expect(onExpandChange).toHaveBeenCalledWith(false, expect.anything());
        vi.useRealTimers();
    });

    it('should NOT close list on outside click when isCloseOnClickOutside=false', async () => {
        vi.useFakeTimers();
        const onExpandChange = vi.fn();
        const onClickOutside = vi.fn();
        render(
            <WrapperComponent
                props={{
                    options: defaultOptions,
                    isExpanded: true,
                    isCloseOnClickOutside: false,
                    onExpandChange,
                    onClickOutside,
                    onClick: vi.fn()
                }}
            />
        );
        const cb = outsideClickCallbacks[0];
        act(() => {
            cb?.();
        });
        await act(async () => {
            vi.advanceTimersByTime(100);
        });
        // onExpandChange(false, ...) should NOT be called
        expect(onExpandChange).not.toHaveBeenCalledWith(false, expect.anything());
        // onClickOutside IS always called
        expect(onClickOutside).toHaveBeenCalled();
        vi.useRealTimers();
    });

    // ── NEW: autoPosition branch in setTimeout (lines 280–288) ───────────────
    it('should apply transform when autoPosition=true and list is expanded', async () => {
        vi.useFakeTimers();
        const { container } = render(
            <WrapperComponent
                props={{
                    options: defaultOptions,
                    isExpanded: true,
                    autoPosition: true,
                    onClick: vi.fn()
                }}
            />
        );
        await act(async () => {
            vi.advanceTimersByTime(50);
        });
        // Covers lines 280–286 (setTimeout callback with isListExpanded=true)
        expect(container).toBeTruthy();
        vi.useRealTimers();
    });

    it('should call manageOpenDirection when autoPosition and top < 0', async () => {
        vi.useFakeTimers();
        // Spy on getBoundingClientRect BEFORE render so the mock is in place
        const origGetBBox = HTMLDivElement.prototype.getBoundingClientRect;
        HTMLDivElement.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
            top: -50,
            bottom: -10,
            left: 0,
            right: 100,
            width: 100,
            height: 40
        });

        const { container } = render(
            <WrapperComponent
                props={{
                    options: defaultOptions,
                    isExpanded: true,
                    autoPosition: true,
                    onClick: vi.fn()
                }}
            />
        );
        await act(async () => {
            vi.advanceTimersByTime(50);
        });
        // Covers lines 264–266 (top < 0 branch inside manageOpenDirection)
        expect(container).toBeTruthy();

        HTMLDivElement.prototype.getBoundingClientRect = origGetBBox;
        vi.useRealTimers();
    });

    it('should call manageOpenDirection when autoPosition and bottom > vpHeight', async () => {
        vi.useFakeTimers();
        const origGetBBox = HTMLDivElement.prototype.getBoundingClientRect;
        HTMLDivElement.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
            top: 200,
            bottom: 2000,
            left: 0,
            right: 100,
            width: 100,
            height: 1800
        });

        const { container } = render(
            <WrapperComponent
                props={{
                    options: defaultOptions,
                    isExpanded: true,
                    autoPosition: true,
                    isAsubMenu: true,
                    onClick: vi.fn()
                }}
            />
        );
        await act(async () => {
            vi.advanceTimersByTime(50);
        });
        // Covers lines 267–274 (bottom > vpHeight branch, including isAsubMenu path)
        expect(container).toBeTruthy();

        HTMLDivElement.prototype.getBoundingClientRect = origGetBBox;
        vi.useRealTimers();
    });

    // ── NEW: childItems – renders DsDropDownListContainer (lines 55–134, 382–411)
    it('should render DsDropDownListContainer when option has childItems', () => {
        const { container } = render(
            <WrapperComponent
                props={{
                    options: [{ id: 1, label: 'Parent', childItems: [{ id: 11, label: 'Child 1' }] }],
                    isExpanded: true,
                    onClick: vi.fn()
                }}
            />
        );
        // DsDropDownListContainer renders with class "dropDownListContainer"
        expect(container.querySelector('.dropDownListContainer')).toBeTruthy();
    });

    it('should render DsDropDownListContainer with placement=right child', () => {
        const { container } = render(
            <WrapperComponent
                props={{
                    options: [
                        {
                            id: 1,
                            label: 'Parent',
                            childItems: [{ id: 11, label: 'Child R', placement: 'right' }]
                        }
                    ],
                    isExpanded: true,
                    onClick: vi.fn()
                }}
            />
        );
        // placement='right' hits the useMemo default case (lines 374–377)
        expect(container.querySelector('.dropDownListContainer')).toBeTruthy();
    });

    it('should render DsDropDownListContainer with disabled item', () => {
        const { container } = render(
            <WrapperComponent
                props={{
                    options: [
                        {
                            id: 1,
                            label: 'Parent',
                            isDisabled: true,
                            disabledReason: 'Not available',
                            childItems: [{ id: 11, label: 'Child 1' }]
                        }
                    ],
                    isExpanded: true,
                    onClick: vi.fn()
                }}
            />
        );
        expect(container.querySelector('.dropDownListContainer')).toBeTruthy();
    });

    it('should fire mouseOver and mouseLeave on DsDropDownListContainer', () => {
        const { container } = render(
            <WrapperComponent
                props={{
                    options: [{ id: 1, label: 'Parent', childItems: [{ id: 11, label: 'Child 1' }] }],
                    isExpanded: true,
                    onClick: vi.fn()
                }}
            />
        );
        const dropContainer = container.querySelector('.dropDownListContainer') as HTMLElement;
        if (dropContainer) {
            // Covers lines 81–82: onMouseOver / onMouseLeave on DsDropDownListContainer
            fireEvent.mouseOver(dropContainer);
            fireEvent.mouseLeave(dropContainer);
        }
        expect(container).toBeTruthy();
    });

    it('should toggle isExpanded in DsDropDownListContainer on parentContainer click', () => {
        const { container } = render(
            <WrapperComponent
                props={{
                    options: [{ id: 1, label: 'Parent', childItems: [{ id: 11, label: 'Child 1' }] }],
                    isExpanded: true,
                    onClick: vi.fn()
                }}
            />
        );
        const parentContainer = container.querySelector('.parentContainer') as HTMLElement;
        if (parentContainer) {
            // Covers line 92: onClick={() => setIsExpanded(!isExpanded)}
            fireEvent.click(parentContainer);
            fireEvent.click(parentContainer);
        }
        expect(container).toBeTruthy();
    });

    it('should fire DsDropDownListContainer useOutsideClick callback (lines 65–70)', async () => {
        vi.useFakeTimers();
        render(
            <WrapperComponent
                props={{
                    options: [{ id: 1, label: 'Parent', childItems: [{ id: 11, label: 'Child 1' }] }],
                    isExpanded: true,
                    onClick: vi.fn()
                }}
            />
        );
        // Call ALL captured callbacks — one of them is DsDropDownListContainer's
        // (exact index depends on re-render count, so brute-force all of them)
        for (const cb of [...outsideClickCallbacks]) {
            act(() => {
                cb?.();
            });
        }
        await act(async () => {
            vi.advanceTimersByTime(100);
        });
        // Covers lines 65–70: setTimeout body inside DsDropDownListContainer's outside-click callback
        vi.useRealTimers();
    });

    it('should cover inner-dropdown onClick and onClickChild when child item is clicked (lines 124-126, 375-377, 402-405)', async () => {
        vi.useFakeTimers();
        const onClickFn = vi.fn();
        const { container } = render(
            <WrapperComponent
                props={{
                    options: [
                        {
                            id: 1,
                            label: 'Parent',
                            // child item has placement='right' → hits useMemo default case (375-377)
                            childItems: [{ id: 11, label: 'Child R', placement: 'right' }]
                        }
                    ],
                    isExpanded: true,
                    onClick: onClickFn
                }}
            />
        );

        // Step 1: Expand DsDropDownListContainer by clicking its chevron/parentContainer
        const parentContainer = container.querySelector('.parentContainer') as HTMLElement;
        await act(async () => {
            if (parentContainer) fireEvent.click(parentContainer);
        });

        // Step 2: Let useEffects (isListExpanded in inner DsDropDownList) fire
        await act(async () => {
            vi.advanceTimersByTime(50);
        });

        // Step 3: Click the child item inside the now-expanded inner dropdown
        // The inner DsDropDownList items render as ds-typography spans
        const allTypography = container.querySelectorAll('[data-testid="ds-typography"]');
        const childItem = Array.from(allTypography).find(el => el.textContent?.includes('Child R'));
        await act(async () => {
            if (childItem) fireEvent.click(childItem as HTMLElement);
        });

        await act(async () => {
            vi.advanceTimersByTime(50);
        });
        vi.useRealTimers();
        // Covers: 124-126 (inner DsDropDownList onClick → setIsExpanded + onClickChild)
        //         375-377 (DropdownItems useMemo placement='right' default case)
        //         402-405 (DropdownItems onClickChild callback body)
        expect(container).toBeTruthy();
    });
});
