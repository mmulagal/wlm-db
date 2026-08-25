import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExploreSavingsPartialDataBanner from './ExploreSavingsPartialDataBanner';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) =>
            ({
                'databases.wad.additional-access-banner-title': 'Additional access required',
                'databases.explore-savings.partial-data-message':
                    'Some savings data may be incomplete because this host is not fully registered.',
                'databases.explore-savings.authenticate': 'Authenticate',
                'databases.general.close': 'Close'
            }[key] ?? key)
    })
}));

describe('ExploreSavingsPartialDataBanner', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the partial-data banner', () => {
        render(<ExploreSavingsPartialDataBanner />);

        expect(screen.getByTestId('explore-savings-partial-data-banner')).toBeDefined();
        expect(screen.getByText('Additional access required')).toBeDefined();
        expect(
            screen.getByText('Some savings data may be incomplete because this host is not fully registered.')
        ).toBeDefined();
    });

    it('hides the banner when close is clicked', () => {
        render(<ExploreSavingsPartialDataBanner />);

        fireEvent.click(screen.getByTestId('explore-savings-partial-data-banner-close'));

        expect(screen.queryByTestId('explore-savings-partial-data-banner')).toBeNull();
    });

    it('renders authenticate link when showAuthLink and onAuthenticate are provided', () => {
        const onAuthenticate = vi.fn();

        render(<ExploreSavingsPartialDataBanner showAuthLink onAuthenticate={onAuthenticate} />);

        fireEvent.click(screen.getByText('Authenticate'));

        expect(onAuthenticate).toHaveBeenCalledTimes(1);
    });

    it('does not render authenticate link when showAuthLink is false', () => {
        render(<ExploreSavingsPartialDataBanner onAuthenticate={vi.fn()} />);

        expect(screen.queryByText('Authenticate')).toBeNull();
    });

    it('does not render authenticate link when onAuthenticate is missing', () => {
        render(<ExploreSavingsPartialDataBanner showAuthLink />);

        expect(screen.queryByText('Authenticate')).toBeNull();
    });
});
