import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import HighlighterWord from '../Highlighter';

vi.mock('../Highlighter.scss', () => ({}));

describe('HighlighterWord', () => {
    it('returns children as-is when highlight is falsy', () => {
        render(
            <div data-testid="wrapper">
                <HighlighterWord highlight="" count={vi.fn()}>
                    plain text
                </HighlighterWord>
            </div>
        );
        expect(screen.getByTestId('wrapper')).toHaveTextContent('plain text');
    });

    it('returns children as-is when highlight has length < 2', () => {
        render(
            <div data-testid="wrapper">
                <HighlighterWord highlight="a" count={vi.fn()}>
                    plain text
                </HighlighterWord>
            </div>
        );
        expect(screen.getByTestId('wrapper')).toHaveTextContent('plain text');
    });

    it('returns children as-is when highlight is only special characters', () => {
        render(
            <div data-testid="wrapper">
                <HighlighterWord highlight="!@" count={vi.fn()}>
                    plain text
                </HighlighterWord>
            </div>
        );
        expect(screen.getByTestId('wrapper')).toHaveTextContent('plain text');
    });

    it('renders highlighted text for plain string children', () => {
        const countFn = vi.fn();
        render(
            <HighlighterWord highlight="he" count={countFn} isAWSCli={false}>
                hello world
            </HighlighterWord>
        );
        expect(screen.getByText('he')).toHaveClass('highlighted');
        expect(countFn).toHaveBeenCalled();
    });

    it('renders inside .aws-cli when isAWSCli is true', () => {
        const countFn = vi.fn();
        const { container } = render(
            <HighlighterWord highlight="he" count={countFn} isAWSCli={true}>
                hello world
            </HighlighterWord>
        );
        expect(container.querySelector('.aws-cli')).not.toBeNull();
        expect(container.querySelector('.fontFamily')).toBeNull();
    });

    it('renders inside pre.fontFamily when isAWSCli is false', () => {
        const countFn = vi.fn();
        const { container } = render(
            <HighlighterWord highlight="he" count={countFn} isAWSCli={false}>
                hello world
            </HighlighterWord>
        );
        expect(container.querySelector('.fontFamily')).not.toBeNull();
        expect(container.querySelector('.aws-cli')).toBeNull();
    });

    it('uses apiResForSearch.props.textToHighlight when provided', () => {
        const countFn = vi.fn();
        const apiResForSearch = {
            props: { textToHighlight: 'hello world' }
        };
        render(
            <HighlighterWord highlight="he" count={countFn} isAWSCli={false} apiResForSearch={apiResForSearch}>
                ignored children
            </HighlighterWord>
        );
        expect(screen.getByText('he')).toHaveClass('highlighted');
    });

    it('uses children.props.children.props.textToHighlight when available', () => {
        const countFn = vi.fn();
        const innerChild = {
            props: { textToHighlight: 'hello world' }
        };
        const children = { props: { children: innerChild } } as any;
        render(
            <HighlighterWord highlight="he" count={countFn} isAWSCli={false}>
                {children}
            </HighlighterWord>
        );
        expect(screen.getByText('he')).toHaveClass('highlighted');
    });

    it('handles multiple matches in text', () => {
        const countFn = vi.fn();
        render(
            <HighlighterWord highlight="ab" count={countFn} isAWSCli={false}>
                ab cd ab
            </HighlighterWord>
        );
        const highlighted = screen.getAllByText('ab');
        expect(highlighted.length).toBeGreaterThan(0);
    });
});
