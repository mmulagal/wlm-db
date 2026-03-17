import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { ButtonWithDropdown, ButtonWithDropdownProps } from './ButtonWithDropdown';

// Mock react-dom so createPortal renders inline instead of to document.body
vi.mock('react-dom', async importOriginal => {
    const actual = await importOriginal<typeof import('react-dom')>();
    return {
        ...actual,
        createPortal: (children: React.ReactNode) => children
    };
});

// Mock SCSS
vi.mock('./ButtonWithDropdown.module.scss', () => ({
    default: {
        base: 'base',
        'is-icon-variant': 'is-icon-variant',
        'is-small': 'is-small',
        'has-icon': 'has-icon',
        'is-text-variant': 'is-text-variant',
        'has-cursor': 'has-cursor',
        'is-active': 'is-active',
        'dropdown-icon-container': 'dropdown-icon-container',
        'dropdown-icon': 'dropdown-icon',
        'dropdown-container': 'dropdown-container',
        'dropdown-container-item': 'dropdown-container-item',
        disabled: 'disabled'
    }
}));

// Mock the arrow icon SVG
vi.mock('@netapp/icons/ic_dropdown_arrow_down.svg', () => ({
    ReactComponent: () => <svg data-testid="arrow-icon" />
}));

// Mock useButtonDropdown so we can control isDropdownActive
const mockOnItemClick = vi.fn();
const mockSetButtonRef = vi.fn();
const mockDropdownProps = { className: 'dropdown-container', 'data-testid': 'dropdown-portal' };

const mockUseButtonDropdown = vi.fn().mockReturnValue({
    isDropdownActive: false,
    setButtonRef: mockSetButtonRef,
    dropdownProps: mockDropdownProps,
    onItemClick: mockOnItemClick
});

vi.mock('./useButtonDropdown', () => ({
    default: (...args: any[]) => mockUseButtonDropdown(...args)
}));

const defaultItems: ButtonWithDropdownProps['items'] = [
    { children: 'Item 1', onClick: vi.fn() },
    { children: 'Item 2', onClick: vi.fn() }
];

describe('ButtonWithDropdown', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseButtonDropdown.mockReturnValue({
            isDropdownActive: false,
            setButtonRef: mockSetButtonRef,
            dropdownProps: mockDropdownProps,
            onItemClick: mockOnItemClick
        });
    });

    describe('basic rendering', () => {
        it('renders children correctly', () => {
            render(<ButtonWithDropdown items={defaultItems}>Click Me</ButtonWithDropdown>);
            expect(screen.getByText('Click Me')).toBeTruthy();
        });

        it('renders the arrow icon when variant is not icon', () => {
            render(<ButtonWithDropdown items={defaultItems}>Button</ButtonWithDropdown>);
            expect(screen.getByTestId('arrow-icon')).toBeTruthy();
        });

        it('does NOT render the arrow icon when variant is icon', () => {
            render(
                <ButtonWithDropdown items={defaultItems} variant="icon">
                    Button
                </ButtonWithDropdown>
            );
            expect(screen.queryByTestId('arrow-icon')).toBeNull();
        });

        it('does not render portal when isDropdownActive is false', () => {
            render(<ButtonWithDropdown items={defaultItems}>Button</ButtonWithDropdown>);
            expect(screen.queryByTestId('dropdown-portal')).toBeNull();
        });
    });

    describe('dropdown portal rendering', () => {
        beforeEach(() => {
            mockUseButtonDropdown.mockReturnValue({
                isDropdownActive: true,
                setButtonRef: mockSetButtonRef,
                dropdownProps: { ...mockDropdownProps, 'data-testid': 'dropdown-portal' },
                onItemClick: mockOnItemClick
            });
        });

        it('renders portal with dropdown when isDropdownActive is true', () => {
            render(<ButtonWithDropdown items={defaultItems}>Button</ButtonWithDropdown>);
            expect(screen.getByTestId('dropdown-portal')).toBeTruthy();
        });

        it('renders each item in the dropdown', () => {
            render(<ButtonWithDropdown items={defaultItems}>Button</ButtonWithDropdown>);
            expect(screen.getByText('Item 1')).toBeTruthy();
            expect(screen.getByText('Item 2')).toBeTruthy();
        });

        it('calls onItemClick and item onClick when a dropdown item is clicked', () => {
            const itemOnClick = vi.fn();
            const items: ButtonWithDropdownProps['items'] = [{ children: 'Clickable', onClick: itemOnClick }];
            render(<ButtonWithDropdown items={items}>Button</ButtonWithDropdown>);
            fireEvent.click(screen.getByText('Clickable'));
            expect(mockOnItemClick).toHaveBeenCalledTimes(1);
            expect(itemOnClick).toHaveBeenCalledTimes(1);
        });

        it('calls onItemClick even when item has no onClick handler', () => {
            const items: ButtonWithDropdownProps['items'] = [{ children: 'No Handler' }];
            render(<ButtonWithDropdown items={items}>Button</ButtonWithDropdown>);
            fireEvent.click(screen.getByText('No Handler'));
            expect(mockOnItemClick).toHaveBeenCalledTimes(1);
        });

        it('renders disabled item with disabled class when isDisabled', () => {
            const items: ButtonWithDropdownProps['items'] = [{ children: 'Disabled Item', isDisabled: true }];
            render(<ButtonWithDropdown items={items}>Button</ButtonWithDropdown>);
            const itemEl = screen.getByText('Disabled Item').closest('button');
            expect(itemEl?.className).toContain('disabled');
        });

        it('renders disabled item with disabled class when disabled prop', () => {
            const items: ButtonWithDropdownProps['items'] = [{ children: 'Dis Item', disabled: true }];
            render(<ButtonWithDropdown items={items}>Button</ButtonWithDropdown>);
            const itemEl = screen.getByText('Dis Item').closest('button');
            expect(itemEl?.className).toContain('disabled');
        });

        it('renders item with has-icon class when icon prop is set', () => {
            const TestIcon = () => <svg />;
            const items: ButtonWithDropdownProps['items'] = [{ children: 'Icon Item', icon: TestIcon as any }];
            render(<ButtonWithDropdown items={items}>Button</ButtonWithDropdown>);
            const itemEl = screen.getByText('Icon Item').closest('button');
            expect(itemEl?.className).toContain('has-icon');
        });

        it('renders nested items using ButtonWithDropdown recursively', () => {
            const nestedItems: ButtonWithDropdownProps['items'] = [
                {
                    children: 'Parent Item',
                    items: [{ children: 'Child 1' }, { children: 'Child 2' }]
                }
            ];
            render(<ButtonWithDropdown items={nestedItems}>Button</ButtonWithDropdown>);
            expect(screen.getByText('Parent Item')).toBeTruthy();
        });
    });

    describe('disabled state (_isDisabled logic)', () => {
        it('passes isDisabled=true when isDisabled prop is set', () => {
            render(
                <ButtonWithDropdown items={defaultItems} isDisabled>
                    Button
                </ButtonWithDropdown>
            );
            expect(mockUseButtonDropdown).toHaveBeenCalledWith(expect.objectContaining({ isDisabled: true }));
        });

        it('passes isDisabled=true when disabled prop is set', () => {
            render(
                <ButtonWithDropdown items={defaultItems} disabled>
                    Button
                </ButtonWithDropdown>
            );
            expect(mockUseButtonDropdown).toHaveBeenCalledWith(expect.objectContaining({ isDisabled: true }));
        });

        it('passes isDisabled=true when isLoading prop is set', () => {
            render(
                <ButtonWithDropdown items={defaultItems} isLoading>
                    Button
                </ButtonWithDropdown>
            );
            expect(mockUseButtonDropdown).toHaveBeenCalledWith(expect.objectContaining({ isDisabled: true }));
        });

        it('passes isDisabled as falsy when no disable props are set', () => {
            render(<ButtonWithDropdown items={defaultItems}>Button</ButtonWithDropdown>);
            const callArg = mockUseButtonDropdown.mock.calls[0][0];
            expect(callArg.isDisabled).toBeFalsy();
        });
    });

    describe('placement logic', () => {
        it('uses provided placement when specified', () => {
            render(
                <ButtonWithDropdown items={defaultItems} placement="bottom-end">
                    Button
                </ButtonWithDropdown>
            );
            expect(mockUseButtonDropdown).toHaveBeenCalledWith(expect.objectContaining({ placement: 'bottom-end' }));
        });

        it('uses "bottom" placement for icon variant when no placement provided', () => {
            render(
                <ButtonWithDropdown items={defaultItems} variant="icon">
                    Button
                </ButtonWithDropdown>
            );
            expect(mockUseButtonDropdown).toHaveBeenCalledWith(expect.objectContaining({ placement: 'bottom' }));
        });

        it('defaults to "bottom-start" when no placement and non-icon variant', () => {
            render(<ButtonWithDropdown items={defaultItems}>Button</ButtonWithDropdown>);
            expect(mockUseButtonDropdown).toHaveBeenCalledWith(expect.objectContaining({ placement: 'bottom-start' }));
        });
    });

    describe('variant class names', () => {
        it('adds is-icon-variant class for icon variant', () => {
            const { container } = render(
                <ButtonWithDropdown items={defaultItems} variant="icon">
                    B
                </ButtonWithDropdown>
            );
            expect(container.querySelector('.is-icon-variant')).toBeTruthy();
        });

        it('adds is-text-variant class for text variant', () => {
            const { container } = render(
                <ButtonWithDropdown items={defaultItems} variant="text">
                    B
                </ButtonWithDropdown>
            );
            expect(container.querySelector('.is-text-variant')).toBeTruthy();
        });

        it('adds has-cursor class when not disabled', () => {
            const { container } = render(<ButtonWithDropdown items={defaultItems}>B</ButtonWithDropdown>);
            expect(container.querySelector('.has-cursor')).toBeTruthy();
        });

        it('adds is-active class when isDropdownActive is true', () => {
            mockUseButtonDropdown.mockReturnValue({
                isDropdownActive: true,
                setButtonRef: mockSetButtonRef,
                dropdownProps: mockDropdownProps,
                onItemClick: mockOnItemClick
            });
            const { container } = render(<ButtonWithDropdown items={defaultItems}>B</ButtonWithDropdown>);
            expect(container.querySelector('.is-active')).toBeTruthy();
        });

        it('passes custom className', () => {
            const { container } = render(
                <ButtonWithDropdown items={defaultItems} className="my-custom">
                    B
                </ButtonWithDropdown>
            );
            expect(container.querySelector('.my-custom')).toBeTruthy();
        });
    });

    describe('dropdownConfig and trigger', () => {
        it('passes dropdownConfig props to useButtonDropdown', () => {
            const dropdownConfig = { placement: 'bottom-end' as const, trigger: 'hover' as const };
            render(
                <ButtonWithDropdown items={defaultItems} dropdownConfig={dropdownConfig}>
                    Button
                </ButtonWithDropdown>
            );
            expect(mockUseButtonDropdown).toHaveBeenCalledWith(
                expect.objectContaining({ placement: 'bottom-end', trigger: 'hover' })
            );
        });

        it('passes trigger prop to useButtonDropdown', () => {
            render(
                <ButtonWithDropdown items={defaultItems} trigger="hover">
                    Button
                </ButtonWithDropdown>
            );
            expect(mockUseButtonDropdown).toHaveBeenCalledWith(expect.objectContaining({ trigger: 'hover' }));
        });

        it('defaults trigger to click', () => {
            render(<ButtonWithDropdown items={defaultItems}>Button</ButtonWithDropdown>);
            expect(mockUseButtonDropdown).toHaveBeenCalledWith(expect.objectContaining({ trigger: 'click' }));
        });
    });
});
