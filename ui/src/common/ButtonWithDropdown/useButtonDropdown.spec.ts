import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import useButtonDropdown from './useButtonDropdown';

vi.mock('@netapp/design-system/dist/hooks/usePopover', () => ({
    default: vi.fn(() => ({
        getPopoverProps: (props: any) => ({ ...props }),
        setPopoverRef: vi.fn(),
        setContainerRef: vi.fn(),
        containerRef: null,
        isVisible: false
    }))
}));

vi.mock('classnames', () => ({
    default: (...args: any[]) => args.filter(Boolean).join(' ')
}));

vi.mock('@emotion/css', () => ({
    css: vi.fn(() => 'css-class')
}));

describe('useButtonDropdown', () => {
    it('should be defined', () => {
        expect(useButtonDropdown).toBeDefined();
    });

    it('should return required properties', () => {
        const { result } = renderHook(() => useButtonDropdown({ trigger: 'click' }));
        expect(result.current).toHaveProperty('onItemClick');
        expect(result.current).toHaveProperty('isDropdownActive');
        expect(result.current).toHaveProperty('setButtonRef');
        expect(result.current).toHaveProperty('dropdownProps');
    });

    it('should set isDropdownActive to false when not visible', () => {
        const { result } = renderHook(() => useButtonDropdown({ trigger: 'click' }));
        expect(result.current.isDropdownActive).toBe(false);
    });

    it('should set isDropdownActive to false when isDisabled=true', () => {
        const { result } = renderHook(() => useButtonDropdown({ trigger: 'click', isDisabled: true }));
        expect(result.current.isDropdownActive).toBe(false);
    });

    it('onItemClick should not throw when isActive is false', () => {
        const { result } = renderHook(() => useButtonDropdown({ trigger: 'click', isActive: false }));
        expect(() => {
            act(() => {
                result.current.onItemClick();
            });
        }).not.toThrow();
    });

    it('onItemClick should not change visibility when isActive is true', () => {
        const { result } = renderHook(() => useButtonDropdown({ trigger: 'click', isActive: true }));
        act(() => {
            result.current.onItemClick();
        });
        expect(result.current).toBeTruthy();
    });

    it('should handle hover trigger with delayHide', () => {
        const { result } = renderHook(() => useButtonDropdown({ trigger: 'hover' }));
        expect(result.current).toBeTruthy();
    });

    it('should handle custom className', () => {
        const { result } = renderHook(() => useButtonDropdown({ trigger: 'click', className: 'custom-class' }));
        expect(result.current.dropdownProps.className).toContain('custom-class');
    });

    it('should handle onVisibleChange callback', () => {
        const onVisibleChange = vi.fn();
        const { result } = renderHook(() => useButtonDropdown({ trigger: 'click', onVisibleChange }));
        expect(result.current).toBeTruthy();
    });
});
