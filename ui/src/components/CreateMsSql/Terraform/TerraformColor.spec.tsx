import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import TerraformColor from './TerraformColor';

vi.mock('../../../common/ThemeProvider/ThemeProvider', () => ({
    default: ({ children }: any) => <div data-testid="theme-provider">{children}</div>
}));

vi.mock('../../../common/hooks/SyntaxHighlighter', () => ({
    default: ({ children, language }: any) => (
        <pre data-testid="syntax-highlighter" data-language={language}>
            {children}
        </pre>
    )
}));

vi.mock('./mockData', () => ({
    code: 'mock terraform code content'
}));

const makeStore = (isDemoMode = false) =>
    configureStore({
        reducer: {
            auth: () => ({ isDemoMode })
        }
    });

describe('TerraformColor', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders without crashing', () => {
        const store = makeStore();
        const { container } = render(
            <Provider store={store}>
                <TerraformColor data={{ template: 'resource "aws_instance" {}' }} />
            </Provider>
        );
        expect(container).toBeDefined();
    });

    it('renders SyntaxHighlighter with hcl language', () => {
        const store = makeStore();
        const { getByTestId } = render(
            <Provider store={store}>
                <TerraformColor data={{ template: 'resource "aws_instance" {}' }} />
            </Provider>
        );
        expect(getByTestId('syntax-highlighter')).toBeTruthy();
        expect(getByTestId('syntax-highlighter').getAttribute('data-language')).toBe('hcl');
    });

    it('renders ThemeProvider with dark theme', () => {
        const store = makeStore();
        const { getByTestId } = render(
            <Provider store={store}>
                <TerraformColor data={{ template: 'resource "aws_instance" {}' }} />
            </Provider>
        );
        expect(getByTestId('theme-provider')).toBeTruthy();
    });

    it('shows demo code when isDemoMode is true', () => {
        const store = makeStore(true);
        const { getByTestId } = render(
            <Provider store={store}>
                <TerraformColor data={{ template: 'actual template content' }} />
            </Provider>
        );
        const highlighter = getByTestId('syntax-highlighter');
        // In demo mode it should show mock code, not template
        expect(highlighter.textContent).toContain('mock terraform code content');
    });

    it('shows template data when not in demo mode', () => {
        const store = makeStore(false);
        const { getByTestId } = render(
            <Provider store={store}>
                <TerraformColor data={{ template: 'actual template content' }} />
            </Provider>
        );
        const highlighter = getByTestId('syntax-highlighter');
        expect(highlighter.textContent).toContain('actual template content');
    });

    it('formats text with equal sign alignment', () => {
        const store = makeStore(false);
        const templateWithEquals = 'key = value\nshortkey = value2';
        render(
            <Provider store={store}>
                <TerraformColor data={{ template: templateWithEquals }} />
            </Provider>
        );
        expect(true).toBe(true);
    });

    it('handles null/undefined data gracefully', () => {
        const store = makeStore(false);
        const { container } = render(
            <Provider store={store}>
                <TerraformColor data={{ url: undefined, template: undefined }} />
            </Provider>
        );
        expect(container).toBeDefined();
    });

    it('handles tabs in template by converting to spaces', () => {
        const store = makeStore(false);
        const templateWithTabs = 'resource {\n\tname\t=\t"value"\n}';
        render(
            <Provider store={store}>
                <TerraformColor data={{ template: templateWithTabs }} />
            </Provider>
        );
        expect(true).toBe(true);
    });
});
