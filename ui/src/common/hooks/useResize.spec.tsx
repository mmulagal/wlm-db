import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useResize from './useResize';

describe('useResize', () => {
    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;

    beforeEach(() => {
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
        Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 768 });
    });

    afterEach(() => {
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: originalInnerWidth });
        Object.defineProperty(window, 'innerHeight', {
            writable: true,
            configurable: true,
            value: originalInnerHeight
        });
    });

    it('should return initial window dimensions', () => {
        const { result } = renderHook(() => useResize());
        expect(result.current.width).toBe(1024);
        expect(result.current.height).toBe(768);
    });

    it('should update dimensions when window is resized', () => {
        const { result } = renderHook(() => useResize());

        act(() => {
            Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1920 });
            Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 1080 });
            window.dispatchEvent(new Event('resize'));
        });

        expect(result.current.width).toBe(1920);
        expect(result.current.height).toBe(1080);
    });

    it('should remove event listener on unmount', () => {
        const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
        const { unmount } = renderHook(() => useResize());
        unmount();
        expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
        removeEventListenerSpy.mockRestore();
    });

    it('should add resize event listener on mount', () => {
        const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
        renderHook(() => useResize());
        expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
        addEventListenerSpy.mockRestore();
    });
});
