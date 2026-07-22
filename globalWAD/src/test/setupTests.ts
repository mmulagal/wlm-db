import '@testing-library/jest-dom';
import { vi } from 'vitest';

Object.defineProperty(window, 'getComputedStyle', {
    value: () => ({
        getPropertyValue: () => ''
    })
});

globalThis.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn()
}));

globalThis.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
    root: null,
    rootMargin: '',
    thresholds: [],
    takeRecords: vi.fn()
}));
