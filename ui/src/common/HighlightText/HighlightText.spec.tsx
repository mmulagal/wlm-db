import { describe, it, expect } from 'vitest';
import HighlightText from './HighlightText';

describe('HighlightText', () => {
    it('should be a function component', () => {
        expect(typeof HighlightText).toBe('function');
    });

    it('should return null when text is falsy', () => {
        expect(HighlightText({ text: null, searchWords: ['hello'] })).toBeNull();
        expect(HighlightText({ text: '', searchWords: ['hello'] })).toBeNull();
        expect(HighlightText({ text: undefined, searchWords: ['hello'] })).toBeNull();
    });

    it('should render text with no search words', () => {
        const element = HighlightText({ text: 'Hello World', searchWords: [] }) as any;
        expect(element).toBeTruthy();
    });

    it('should render text when no match found', () => {
        const element = HighlightText({ text: 'Hello World', searchWords: ['xyz'] }) as any;
        expect(element).toBeTruthy();
    });

    it('should highlight matched portions of text (case insensitive)', () => {
        const element = HighlightText({ text: 'Hello World', searchWords: ['hello'] }) as any;
        expect(element).toBeTruthy();
        const { children } = element.props;
        expect(Array.isArray(children)).toBe(true);
        // Should have highlighted "Hello" and remaining " World"
        const highlighted = children.find(
            (child: any) => child && typeof child === 'object' && child.props?.style?.color === 'var(--blue-30)'
        );
        expect(highlighted).toBeTruthy();
    });

    it('should highlight multiple search words', () => {
        const element = HighlightText({ text: 'Hello World', searchWords: ['hello', 'world'] }) as any;
        const { children } = element.props;
        const highlightedParts = children.filter(
            (child: any) => child && typeof child === 'object' && child.props?.style?.color === 'var(--blue-30)'
        );
        expect(highlightedParts.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle text with no matching search words', () => {
        const element = HighlightText({ text: 'No match here', searchWords: ['xyz', 'abc'] }) as any;
        expect(element).toBeTruthy();
        // All parts should be plain text (no highlighted spans)
        const { children } = element.props;
        const highlighted = (Array.isArray(children) ? children : [children]).filter(
            (child: any) => child && typeof child === 'object' && child.props?.style?.color
        );
        expect(highlighted.length).toBe(0);
    });
});
