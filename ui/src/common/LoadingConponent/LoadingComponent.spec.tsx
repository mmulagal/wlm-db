import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

import LoadingComponent from './LoadingComponent';

vi.mock('@netapp/design-system', () => ({
    FlashingDotsLoader: () => <div data-testid="flashing-dots-loader" />,
    Typography: ({ children, variant }: any) => (
        <span data-testid="typography" data-variant={variant}>
            {children}
        </span>
    )
}));

vi.mock('../../utils/appConstants', () => ({
    GENERAL: {
        LOADING_DATA: 'Loading data...'
    }
}));

describe('LoadingComponent', () => {
    it('should be defined', () => {
        expect(LoadingComponent).toBeDefined();
    });

    it('should render without crashing', () => {
        const { container } = render(<LoadingComponent />);
        expect(container).toBeTruthy();
    });

    it('should render FlashingDotsLoader', () => {
        const { getByTestId } = render(<LoadingComponent />);
        expect(getByTestId('flashing-dots-loader')).toBeTruthy();
    });

    it('should render Loading Data text', () => {
        const { getByText } = render(<LoadingComponent />);
        expect(getByText('Loading data...')).toBeTruthy();
    });
});
