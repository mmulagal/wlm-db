import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import FetchingDataNotification from '../FetchingDataNotification';

vi.mock('lodash', () => ({ padEnd: vi.fn() }));

vi.mock('../../../../common/ProgressLoader/ProgressLoader', () => ({
    default: ({ percent, style }: any) => (
        <div data-testid="progress-loader" data-percent={percent} style={style} />
    )
}));

vi.mock('../../../../ui-components/Typography', () => ({
    Text: ({ children, style }: any) => <span data-testid="text" style={style}>{children}</span>,
    Heading: ({ children, level }: any) => <h4 data-testid={`heading-${level}`}>{children}</h4>
}));

vi.mock('../../../../ui-components/Layout/Grid', () => ({
    Grid: ({ children, style }: any) => <div data-testid="grid" style={style}>{children}</div>,
    GridItem: ({ children, lg }: any) => <div data-testid={`grid-item-${lg}`}>{children}</div>
}));

describe('FetchingDataNotification', () => {
    it('renders heading text', () => {
        render(
            <FetchingDataNotification
                pendingQueriesCounter={5}
                completedTask={2}
                regions="us-east-1"
                credentials="myCred"
            />
        );
        expect(screen.getByTestId('heading-4')).toHaveTextContent('Scanning database hosts and instances.');
    });

    it('renders credentials and regions text', () => {
        render(
            <FetchingDataNotification
                pendingQueriesCounter={5}
                completedTask={2}
                regions="us-east-1"
                credentials="myCred"
            />
        );
        expect(screen.getByTestId('text')).toHaveTextContent('myCred / us-east-1');
    });

    it('renders progress loader with correct percent', () => {
        render(
            <FetchingDataNotification
                pendingQueriesCounter={10}
                completedTask={5}
                regions="us-east-1"
                credentials="cred1"
            />
        );
        const loader = screen.getByTestId('progress-loader');
        expect(loader.getAttribute('data-percent')).toBe('50');
    });

    it('handles zero pendingQueriesCounter gracefully (NaN percent)', () => {
        render(
            <FetchingDataNotification
                pendingQueriesCounter={0}
                completedTask={0}
                regions="us-east-1"
                credentials="cred1"
            />
        );
        const loader = screen.getByTestId('progress-loader');
        expect(loader.getAttribute('data-percent')).toBe('NaN');
    });

    it('renders without optional regions and credentials', () => {
        render(
            <FetchingDataNotification
                pendingQueriesCounter={3}
                completedTask={1}
            />
        );
        expect(screen.getByTestId('text')).toHaveTextContent('undefined / undefined');
    });
});
