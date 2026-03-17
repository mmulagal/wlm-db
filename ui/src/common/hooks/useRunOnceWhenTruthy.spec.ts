import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import useRunOnceWhenTruthy from './useRunOnceWhenTruthy';

describe('useRunOnceWhenTruthy', () => {
    it('should not call callback when condition is false', () => {
        const callback = vi.fn();
        renderHook(() => useRunOnceWhenTruthy(callback, false));
        expect(callback).not.toHaveBeenCalled();
    });

    it('should call callback when condition is true', () => {
        const callback = vi.fn();
        renderHook(() => useRunOnceWhenTruthy(callback, true));
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should call callback only once even when re-rendered with condition true', () => {
        const callback = vi.fn();
        const { rerender } = renderHook(({ condition }) => useRunOnceWhenTruthy(callback, condition), {
            initialProps: { condition: true }
        });
        rerender({ condition: true });
        rerender({ condition: true });
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should not call callback when condition changes from true to false', () => {
        const callback = vi.fn();
        const { rerender } = renderHook(({ condition }) => useRunOnceWhenTruthy(callback, condition), {
            initialProps: { condition: true }
        });
        expect(callback).toHaveBeenCalledTimes(1);
        rerender({ condition: false });
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should not call callback again after condition flips back to true', () => {
        const callback = vi.fn();
        const { rerender } = renderHook(({ condition }) => useRunOnceWhenTruthy(callback, condition), {
            initialProps: { condition: false }
        });
        expect(callback).not.toHaveBeenCalled();
        rerender({ condition: true });
        expect(callback).toHaveBeenCalledTimes(1);
        rerender({ condition: false });
        rerender({ condition: true });
        expect(callback).toHaveBeenCalledTimes(1);
    });
});
