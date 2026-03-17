import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import SyntaxHighlighterComponent from './SyntaxHighlighter';

// Hoist mockRegisterLanguage so it can be used inside vi.mock factory
const mockRegisterLanguage = vi.hoisted(() => vi.fn());

vi.mock('react-syntax-highlighter', () => {
    const PrismLight = ({ children, language, style, ...props }) =>
        React.createElement(
            'pre',
            { 'data-testid': 'syntax-highlighter', 'data-language': language, ...props },
            children
        );
    PrismLight.registerLanguage = mockRegisterLanguage;
    return { PrismLight };
});

vi.mock('react-syntax-highlighter/dist/esm//languages/prism/json', () => ({ default: { name: 'json' } }));
vi.mock('react-syntax-highlighter/dist/esm//languages/prism/javascript', () => ({ default: { name: 'javascript' } }));
vi.mock('react-syntax-highlighter/dist/esm//languages/prism/jsx', () => ({ default: { name: 'jsx' } }));
vi.mock('react-syntax-highlighter/dist/esm//languages/prism/yaml', () => ({ default: { name: 'yaml' } }));
vi.mock('react-syntax-highlighter/dist/esm//languages/prism/bash', () => ({ default: { name: 'bash' } }));
vi.mock('react-syntax-highlighter/dist/esm//languages/prism/hcl', () => ({ default: { name: 'hcl' } }));

describe('SyntaxHighlighter', () => {
    describe('language registration', () => {
        it('registers all 6 languages on module load', () => {
            expect(mockRegisterLanguage).toHaveBeenCalledWith('json', expect.anything());
            expect(mockRegisterLanguage).toHaveBeenCalledWith('javascript', expect.anything());
            expect(mockRegisterLanguage).toHaveBeenCalledWith('jsx', expect.anything());
            expect(mockRegisterLanguage).toHaveBeenCalledWith('yaml', expect.anything());
            expect(mockRegisterLanguage).toHaveBeenCalledWith('bash', expect.anything());
            expect(mockRegisterLanguage).toHaveBeenCalledWith('hcl', expect.anything());
            expect(mockRegisterLanguage).toHaveBeenCalledTimes(6);
        });
    });

    describe('string children', () => {
        it('renders SyntaxHighlighter with string children after effect runs', async () => {
            render(<SyntaxHighlighterComponent language="json">{'{ "key": "value" }'}</SyntaxHighlighterComponent>);
            const el = await screen.findByTestId('syntax-highlighter');
            expect(el).toBeTruthy();
            expect(el.textContent).toBe('{ "key": "value" }');
        });

        it('renders plain text (bash)', async () => {
            render(<SyntaxHighlighterComponent language="bash">echo hello world</SyntaxHighlighterComponent>);
            const el = await screen.findByTestId('syntax-highlighter');
            expect(el.textContent).toBe('echo hello world');
        });

        it('passes extra props through to the highlighter', async () => {
            render(
                <SyntaxHighlighterComponent language="yaml" data-custom="yes">
                    key: value
                </SyntaxHighlighterComponent>
            );
            const el = await screen.findByTestId('syntax-highlighter');
            expect(el).toHaveAttribute('data-custom', 'yes');
        });
    });

    describe('object children — converted to JSON string', () => {
        it('stringifies a plain object with JSON.stringify(obj, null, 4)', async () => {
            const obj = { name: 'test', count: 42 };
            render(<SyntaxHighlighterComponent language="json">{obj}</SyntaxHighlighterComponent>);
            const el = await screen.findByTestId('syntax-highlighter');
            expect(el.textContent).toBe(JSON.stringify(obj, null, 4));
        });

        it('stringifies a nested object', async () => {
            const obj = { outer: { inner: [1, 2, 3] } };
            render(<SyntaxHighlighterComponent language="json">{obj}</SyntaxHighlighterComponent>);
            const el = await screen.findByTestId('syntax-highlighter');
            expect(el.textContent).toBe(JSON.stringify(obj, null, 4));
        });

        it('stringifies an array', async () => {
            const arr = [1, 'two', { three: 3 }];
            render(<SyntaxHighlighterComponent language="json">{arr}</SyntaxHighlighterComponent>);
            const el = await screen.findByTestId('syntax-highlighter');
            expect(el.textContent).toBe(JSON.stringify(arr, null, 4));
        });
    });

    describe('null / falsy children — renders nothing', () => {
        it('renders nothing when children is null', () => {
            const { container } = render(
                <SyntaxHighlighterComponent language="json">{null}</SyntaxHighlighterComponent>
            );
            expect(screen.queryByTestId('syntax-highlighter')).toBeNull();
            expect(container.firstChild).toBeNull();
        });

        it('renders nothing when children is undefined', () => {
            const { container } = render(<SyntaxHighlighterComponent language="json" />);
            expect(screen.queryByTestId('syntax-highlighter')).toBeNull();
        });

        it('renders nothing when children is empty string', () => {
            const { container } = render(<SyntaxHighlighterComponent language="json" />);
            expect(screen.queryByTestId('syntax-highlighter')).toBeNull();
        });
    });

    describe('children updates', () => {
        it('re-renders when string children prop changes', async () => {
            const { rerender } = render(<SyntaxHighlighterComponent language="json">first</SyntaxHighlighterComponent>);
            expect(await screen.findByText('first')).toBeTruthy();

            rerender(<SyntaxHighlighterComponent language="json">second</SyntaxHighlighterComponent>);
            expect(await screen.findByText('second')).toBeTruthy();
        });

        it('switches from string to object children', async () => {
            const { rerender } = render(
                <SyntaxHighlighterComponent language="json">plain text</SyntaxHighlighterComponent>
            );
            expect(await screen.findByText('plain text')).toBeTruthy();

            const obj = { key: 'updated' };
            rerender(<SyntaxHighlighterComponent language="json">{obj}</SyntaxHighlighterComponent>);
            const el = await screen.findByTestId('syntax-highlighter');
            expect(el.textContent).toBe(JSON.stringify(obj, null, 4));
        });

        it('switches from object to string children', async () => {
            const obj = { a: 1 };
            const { rerender } = render(<SyntaxHighlighterComponent language="json">{obj}</SyntaxHighlighterComponent>);
            expect(await screen.findByTestId('syntax-highlighter')).toBeTruthy();

            rerender(<SyntaxHighlighterComponent language="json">plain string now</SyntaxHighlighterComponent>);
            const el = await screen.findByTestId('syntax-highlighter');
            expect(el.textContent).toBe('plain string now');
        });
    });
});
