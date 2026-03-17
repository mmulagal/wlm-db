import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDelayedError } from './useDelayedError';

describe('useDelayedError', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should return empty string when errorStr is falsy', () => {
        const { result } = renderHook(() => useDelayedError(null));
        expect(result.current).toBe('');
    });

    it('should return empty string when errorStr is undefined', () => {
        const { result } = renderHook(() => useDelayedError(undefined));
        expect(result.current).toBe('');
    });

    it('should return undefined immediately when errorStr is truthy (before timeout)', () => {
        const { result } = renderHook(() => useDelayedError('Some error'));
        // errorStr is truthy, error state starts as undefined before the timeout
        expect(result.current).toBeUndefined();
    });

    it('should return the error string after 1000ms delay', () => {
        const { result } = renderHook(() => useDelayedError('Some error'));

        act(() => {
            vi.advanceTimersByTime(1000);
        });

        expect(result.current).toBe('Some error');
    });

    it('should reset to undefined when a new error is set', () => {
        const { result, rerender } = renderHook(({ err }) => useDelayedError(err), {
            initialProps: { err: 'First error' }
        });

        act(() => {
            vi.advanceTimersByTime(1000);
        });
        expect(result.current).toBe('First error');

        rerender({ err: 'Second error' });
        // Should reset to undefined while timeout is pending
        expect(result.current).toBeUndefined();

        act(() => {
            vi.advanceTimersByTime(1000);
        });
        expect(result.current).toBe('Second error');
    });

    it('should return empty string when errorStr switches from truthy to falsy', () => {
        const { result, rerender } = renderHook(({ err }) => useDelayedError(err), {
            initialProps: { err: 'Error' as any }
        });

        act(() => {
            vi.advanceTimersByTime(1000);
        });

        rerender({ err: null as any });
        expect(result.current).toBe('');
    });
});
