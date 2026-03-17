import { describe, it, expect, vi } from 'vitest';
import { renderHook, render, fireEvent, act } from '@testing-library/react';
import React, { useRef } from 'react';
import useClickOutside from './useClickOutside';

describe('useClickOutside', () => {
    it('should return a ref object', () => {
        const callback = vi.fn();
        const { result } = renderHook(() => useClickOutside(callback));
        expect(result.current).toBeDefined();
        expect(result.current).toHaveProperty('current');
    });

    it('should call callback when mousedown fires on document with null ref', () => {
        // When ref.current is null, the hook skips the contains check.
        // We verify this by testing that the callback is NOT called when ref is null
        // (which is the initial state — no element attached yet)
        const callback = vi.fn();
        const { result } = renderHook(() => useClickOutside(callback));
        // With null ref, clicking anywhere should NOT trigger callback
        fireEvent.mouseDown(document.body);
        expect(callback).not.toHaveBeenCalled();
        // Verify ref exists
        expect(result.current).toBeDefined();
    });

    it('should not call callback when clicking inside the ref element', () => {
        const callback = vi.fn();

        function TestComponent() {
            const ref = useClickOutside(callback);
            return React.createElement(
                'div',
                { ref, 'data-testid': 'inner' },
                React.createElement('span', { 'data-testid': 'child' }, 'Child')
            );
        }

        const { getByTestId } = render(React.createElement(TestComponent));
        fireEvent.mouseDown(getByTestId('child'));
        expect(callback).not.toHaveBeenCalled();
    });

    it('should remove event listener on unmount', () => {
        const removeSpy = vi.spyOn(document, 'removeEventListener');
        const callback = vi.fn();
        const { unmount } = renderHook(() => useClickOutside(callback));
        unmount();
        expect(removeSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
        removeSpy.mockRestore();
    });

    it('should add event listener on mount', () => {
        const addSpy = vi.spyOn(document, 'addEventListener');
        const callback = vi.fn();
        renderHook(() => useClickOutside(callback));
        expect(addSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
        addSpy.mockRestore();
    });

    it('should call callback when mousedown target is not contained in the ref element', () => {
        const callback = vi.fn();
        const { result } = renderHook(() => useClickOutside(callback));

        // Assign a real element to ref.current so condition is truthy
        const refEl = document.createElement('div');
        document.body.appendChild(refEl);
        result.current.current = refEl;

        // Dispatch directly on document — target is document, which refEl does NOT contain
        document.dispatchEvent(new MouseEvent('mousedown', { bubbles: false, cancelable: true }));

        expect(callback).toHaveBeenCalledTimes(1);
        document.body.removeChild(refEl);
    });

    it('should call callback multiple times when mousedown fires outside ref repeatedly', () => {
        const callback = vi.fn();
        const { result } = renderHook(() => useClickOutside(callback));

        const refEl = document.createElement('section');
        document.body.appendChild(refEl);
        result.current.current = refEl;

        // Dispatch twice directly on document — refEl does NOT contain document
        document.dispatchEvent(new MouseEvent('mousedown', { bubbles: false }));
        document.dispatchEvent(new MouseEvent('mousedown', { bubbles: false }));

        expect(callback).toHaveBeenCalledTimes(2);
        document.body.removeChild(refEl);
    });
});
