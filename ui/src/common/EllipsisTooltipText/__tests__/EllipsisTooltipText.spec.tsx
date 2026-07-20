import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import EllipsisTooltipText from '../EllipsisTooltipText';

describe('EllipsisTooltipText', () => {
    beforeEach(() => {
        class ResizeObserverMock {
            observe() {}

            disconnect() {}
        }

        vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    });

    it('renders text content', () => {
        render(<EllipsisTooltipText text="Well-architected configurations" />);
        expect(screen.getByText('Well-architected configurations')).toBeDefined();
    });

    it('does not set title when text is not truncated', () => {
        Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
            configurable: true,
            value: 100
        });
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
            configurable: true,
            value: 100
        });

        render(<EllipsisTooltipText text="Short text" />);
        expect(screen.getByText('Short text').getAttribute('title')).toBeNull();
    });

    it('sets title when text is truncated', () => {
        Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
            configurable: true,
            value: 200
        });
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
            configurable: true,
            value: 100
        });

        render(<EllipsisTooltipText text="Well-architected resources:" />);
        expect(screen.getByText('Well-architected resources:').getAttribute('title')).toBe(
            'Well-architected resources:'
        );
    });
});
