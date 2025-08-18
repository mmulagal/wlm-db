// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock browser APIs that are not available in Node.js testing environment
Object.defineProperty(window, 'getComputedStyle', {
    value: () => ({
        getPropertyValue: () => ''
    })
});

// Mock document.body if needed
Object.defineProperty(document, 'body', {
    value: document.createElement('body'),
    writable: true
});

// Additional mocks for design system components
global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn()
}));

global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
    root: null,
    rootMargin: '',
    thresholds: [],
    takeRecords: vi.fn()
}));
