import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';

import ThemeProvider from './ThemeProvider';

vi.mock('./palette.js', () => ({ default: {} }));
vi.mock('./lightStyles.js', () => ({ default: () => '--color-primary: #fff; --color-secondary: #000' }));
vi.mock('./darkStyles.js', () => ({ default: () => '--color-primary: #000; --color-secondary: #fff' }));

describe('ThemeProvider', () => {
    it('should be defined', () => {
        expect(ThemeProvider).toBeDefined();
    });

    it('should render children', () => {
        const { getByText } = render(
            <ThemeProvider theme="light" isRoot={false}>
                <span>Child content</span>
            </ThemeProvider>
        );
        expect(getByText('Child content')).toBeTruthy();
    });

    it('should render with light theme', () => {
        const { container } = render(
            <ThemeProvider theme="light" isRoot={false}>
                <div>light theme</div>
            </ThemeProvider>
        );
        expect(container).toBeTruthy();
    });

    it('should render with dark theme', () => {
        const { container } = render(
            <ThemeProvider theme="dark" isRoot={false}>
                <div>dark theme</div>
            </ThemeProvider>
        );
        expect(container).toBeTruthy();
    });

    it('should render with isRoot=true', () => {
        const { container } = render(
            <ThemeProvider theme="light" isRoot>
                <div>root theme</div>
            </ThemeProvider>
        );
        expect(container).toBeTruthy();
    });

    it('should render with custom className', () => {
        const { container } = render(
            <ThemeProvider theme="light" isRoot={false} className="custom-class">
                <div>content</div>
            </ThemeProvider>
        );
        const wrapper = container.querySelector('.custom-class');
        expect(wrapper).toBeTruthy();
    });

    it('should render with unknown theme gracefully', () => {
        const { container } = render(
            <ThemeProvider theme="unknown" isRoot={false}>
                <div>unknown theme</div>
            </ThemeProvider>
        );
        expect(container).toBeTruthy();
    });
});
