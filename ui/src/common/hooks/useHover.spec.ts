import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useHover from './useHover';

describe('useHover', () => {
    it('should return isHovered as false initially', () => {
        const { result } = renderHook(() => useHover());
        expect(result.current.isHovered).toBe(false);
    });

    it('should return hoverParentProps with onMouseEnter and onMouseLeave', () => {
        const { result } = renderHook(() => useHover());
        expect(typeof result.current.hoverParentProps.onMouseEnter).toBe('function');
        expect(typeof result.current.hoverParentProps.onMouseLeave).toBe('function');
    });

    it('should set isHovered to true when onMouseEnter is called', () => {
        const { result } = renderHook(() => useHover());

        act(() => {
            result.current.hoverParentProps.onMouseEnter();
        });

        expect(result.current.isHovered).toBe(true);
    });

    it('should set isHovered to false when onMouseLeave is called', () => {
        const { result } = renderHook(() => useHover());

        act(() => {
            result.current.hoverParentProps.onMouseEnter();
        });
        expect(result.current.isHovered).toBe(true);

        act(() => {
            result.current.hoverParentProps.onMouseLeave();
        });
        expect(result.current.isHovered).toBe(false);
    });

    it('should return memoized values', () => {
        const { result, rerender } = renderHook(() => useHover());
        const firstResult = result.current;
        rerender();
        expect(result.current).toBe(firstResult);
    });
});
