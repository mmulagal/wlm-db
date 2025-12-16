import { describe, it, expect, vi } from 'vitest';
import { ButtonWithDropdown, ButtonWithDropdownProps } from './ButtonWithDropdown';

const mockItems: ButtonWithDropdownProps['items'] = [
    { children: 'Item 1', onClick: vi.fn() },
    { children: 'Item 2', onClick: vi.fn() },
    { children: 'Item 3', onClick: vi.fn() }
];

describe('ButtonWithDropdown', () => {
    it('should accept items prop', () => {
        const component = <ButtonWithDropdown items={mockItems}>Test</ButtonWithDropdown>;
        expect(component.props.items).toEqual(mockItems);
    });

    it('should accept children prop', () => {
        const component = <ButtonWithDropdown items={mockItems}>Test Button</ButtonWithDropdown>;
        expect(component.props.children).toBe('Test Button');
    });

    it('should accept variant props', () => {
        const component = (
            <ButtonWithDropdown items={mockItems} variant="primary">
                Button
            </ButtonWithDropdown>
        );
        expect(component.props.variant).toBe('primary');
    });

    it('should accept placement props', () => {
        const component = (
            <ButtonWithDropdown items={mockItems} placement="bottom">
                Button
            </ButtonWithDropdown>
        );
        expect(component.props.placement).toBe('bottom');
    });

    it('should accept isActive prop', () => {
        const component = (
            <ButtonWithDropdown items={mockItems} isActive>
                Button
            </ButtonWithDropdown>
        );
        expect(component.props.isActive).toBe(true);
    });

    it('should accept disabled prop', () => {
        const component = (
            <ButtonWithDropdown items={mockItems} disabled>
                Button
            </ButtonWithDropdown>
        );
        expect(component.props.disabled).toBe(true);
    });

    it('should accept isDisabled prop', () => {
        const component = (
            <ButtonWithDropdown items={mockItems} isDisabled>
                Button
            </ButtonWithDropdown>
        );
        expect(component.props.isDisabled).toBe(true);
    });

    it('should accept isLoading prop', () => {
        const component = (
            <ButtonWithDropdown items={mockItems} isLoading>
                Button
            </ButtonWithDropdown>
        );
        expect(component.props.isLoading).toBe(true);
    });

    it('should accept className prop', () => {
        const component = (
            <ButtonWithDropdown items={mockItems} className="custom">
                Button
            </ButtonWithDropdown>
        );
        expect(component.props.className).toBe('custom');
    });

    it('should accept trigger prop', () => {
        const component = (
            <ButtonWithDropdown items={mockItems} trigger="hover">
                Button
            </ButtonWithDropdown>
        );
        expect(component.props.trigger).toBe('hover');
    });

    it('should accept nested items', () => {
        const nestedItems: ButtonWithDropdownProps['items'] = [
            {
                children: 'Parent',
                items: [{ children: 'Child 1' }, { children: 'Child 2' }]
            }
        ];
        const component = <ButtonWithDropdown items={nestedItems}>Button</ButtonWithDropdown>;
        expect(component.props.items[0].items).toHaveLength(2);
    });

    it('should accept dropdownConfig prop', () => {
        const config = { placement: 'right' as const, trigger: 'hover' as const };
        const component = (
            <ButtonWithDropdown items={mockItems} dropdownConfig={config}>
                Button
            </ButtonWithDropdown>
        );
        expect(component.props.dropdownConfig).toEqual(config);
    });
});
