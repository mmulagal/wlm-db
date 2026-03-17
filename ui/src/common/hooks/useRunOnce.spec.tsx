import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRunOnce } from './useRunOnce';

describe('useRunOnce', () => {
    it('should call callback exactly once on mount', () => {
        const callback = vi.fn();
        renderHook(() => useRunOnce(callback));
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should not call callback again on re-render', () => {
        const callback = vi.fn();
        const { rerender } = renderHook(() => useRunOnce(callback));
        rerender();
        rerender();
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should call the provided callback function', () => {
        let called = false;
        renderHook(() =>
            useRunOnce(() => {
                called = true;
            })
        );
        expect(called).toBe(true);
    });
});
