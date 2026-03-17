import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useInterval } from './useInterval';

describe('useInterval', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should call callback on each interval tick', () => {
        const callback = vi.fn();
        renderHook(() => useInterval(callback, 1000));

        vi.advanceTimersByTime(1000);
        expect(callback).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(1000);
        expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should not set interval when delay is null', () => {
        const callback = vi.fn();
        renderHook(() => useInterval(callback, null as any));

        vi.advanceTimersByTime(5000);
        expect(callback).not.toHaveBeenCalled();
    });

    it('should use latest callback reference', () => {
        const callback1 = vi.fn();
        const callback2 = vi.fn();

        const { rerender } = renderHook(({ cb }) => useInterval(cb, 1000), {
            initialProps: { cb: callback1 }
        });

        rerender({ cb: callback2 });

        vi.advanceTimersByTime(1000);
        expect(callback1).not.toHaveBeenCalled();
        expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should clear interval on unmount', () => {
        const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
        const callback = vi.fn();
        const { unmount } = renderHook(() => useInterval(callback, 500));
        unmount();
        expect(clearIntervalSpy).toHaveBeenCalled();
        clearIntervalSpy.mockRestore();
    });

    it('should restart interval when delay changes', () => {
        const callback = vi.fn();
        const { rerender } = renderHook(({ delay }) => useInterval(callback, delay), {
            initialProps: { delay: 1000 }
        });

        vi.advanceTimersByTime(500);
        rerender({ delay: 200 });
        vi.advanceTimersByTime(200);
        expect(callback).toHaveBeenCalledTimes(1);
    });
});
