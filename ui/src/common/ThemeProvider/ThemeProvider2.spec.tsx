import { describe, it, expect, vi } from 'vitest';
import { render, renderHook } from '@testing-library/react';

import ThemeProvider2, { useCurrentTheme } from './ThemeProvider2';

vi.mock('./palette.js', () => ({ default: {} }));
vi.mock('./lightStyles', () => ({ default: () => '--color-primary: #fff; --color-secondary: #000' }));
vi.mock('./darkStyles', () => ({ default: () => '--color-primary: #000; --color-secondary: #fff' }));

describe('ThemeProvider2', () => {
    it('should be defined', () => {
        expect(ThemeProvider2).toBeDefined();
    });

    it('should render children', () => {
        const { getByText } = render(
            <ThemeProvider2 theme="light" isRoot={false}>
                <span>Child content</span>
            </ThemeProvider2>
        );
        expect(getByText('Child content')).toBeTruthy();
    });

    it('should render with light theme', () => {
        const { container } = render(
            <ThemeProvider2 theme="light" isRoot={false}>
                <div>light content</div>
            </ThemeProvider2>
        );
        expect(container).toBeTruthy();
    });

    it('should render with dark theme', () => {
        const { container } = render(
            <ThemeProvider2 theme="dark" isRoot={false}>
                <div>dark content</div>
            </ThemeProvider2>
        );
        expect(container).toBeTruthy();
    });

    it('should render with isRoot=true and inject style tag', () => {
        const { container } = render(
            <ThemeProvider2 theme="light" isRoot>
                <div>root content</div>
            </ThemeProvider2>
        );
        expect(container).toBeTruthy();
    });

    it('should render with unknown theme gracefully', () => {
        const { container } = render(
            <ThemeProvider2 theme="unknown" isRoot={false}>
                <div>unknown</div>
            </ThemeProvider2>
        );
        expect(container).toBeTruthy();
    });

    it('should render with custom className', () => {
        const { container } = render(
            <ThemeProvider2 theme="light" isRoot={false} className="my-class">
                <div>content</div>
            </ThemeProvider2>
        );
        const wrapper = container.querySelector('.my-class');
        expect(wrapper).toBeTruthy();
    });

    it('should render with container prop', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const { unmount } = render(
            <ThemeProvider2 theme="light" isRoot={false} container={container}>
                <div>container content</div>
            </ThemeProvider2>
        );
        unmount();
        document.body.removeChild(container);
    });
});

describe('useCurrentTheme', () => {
    it('should return default empty theme outside ThemeProvider2', () => {
        const { result } = renderHook(() => useCurrentTheme());
        expect(result.current.theme).toBe('');
        expect(result.current.styleString).toBe('');
        expect(result.current.tokens).toEqual({});
    });

    it('should return theme context from ThemeProvider2', () => {
        const wrapper = ({ children }: any) => (
            <ThemeProvider2 theme="light" isRoot={false}>
                {children}
            </ThemeProvider2>
        );
        const { result } = renderHook(() => useCurrentTheme(), { wrapper });
        expect(result.current.theme).toBe('light');
    });
});
