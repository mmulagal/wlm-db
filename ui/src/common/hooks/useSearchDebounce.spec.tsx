import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSearchDebounce } from './useSearchDebounce';

describe('useSearchDebounce', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should return initial values of null', () => {
        const { result } = renderHook(() => useSearchDebounce());
        const [search] = result.current;
        expect(search).toBeNull();
    });

    it('should return a setter function as second element', () => {
        const { result } = renderHook(() => useSearchDebounce());
        const [, setSearchQuery] = result.current;
        expect(typeof setSearchQuery).toBe('function');
    });

    it('should not update search before delay', () => {
        const { result } = renderHook(() => useSearchDebounce(500));
        const [, setSearchQuery] = result.current;

        act(() => {
            setSearchQuery('hello');
        });

        const [search] = result.current;
        expect(search).toBeNull();
    });

    it('should update search after the delay', () => {
        const { result } = renderHook(() => useSearchDebounce(500));

        act(() => {
            result.current[1]('hello');
        });

        act(() => {
            vi.advanceTimersByTime(500);
        });

        expect(result.current[0]).toBe('hello');
    });

    it('should use default delay of 500ms when no delay is provided', () => {
        const { result } = renderHook(() => useSearchDebounce());

        act(() => {
            result.current[1]('world');
        });

        act(() => {
            vi.advanceTimersByTime(499);
        });
        expect(result.current[0]).toBeNull();

        act(() => {
            vi.advanceTimersByTime(1);
        });
        expect(result.current[0]).toBe('world');
    });

    it('should debounce multiple rapid updates', () => {
        const { result } = renderHook(() => useSearchDebounce(300));

        act(() => {
            result.current[1]('a');
        });
        act(() => {
            vi.advanceTimersByTime(100);
        });
        act(() => {
            result.current[1]('ab');
        });
        act(() => {
            vi.advanceTimersByTime(100);
        });
        act(() => {
            result.current[1]('abc');
        });

        act(() => {
            vi.advanceTimersByTime(300);
        });

        expect(result.current[0]).toBe('abc');
    });

    it('should clear timeout on cleanup', () => {
        const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
        const { unmount } = renderHook(() => useSearchDebounce(500));
        unmount();
        expect(clearTimeoutSpy).toHaveBeenCalled();
        clearTimeoutSpy.mockRestore();
    });
});
