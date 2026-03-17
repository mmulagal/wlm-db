import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { DsBlueXpMenu } from './DsBlueXpMenu';

// Hoist mock so it can be used inside vi.mock factories
const mockPostBlueXPMessage = vi.hoisted(() => vi.fn());

vi.mock('@netapp/design-system', () => {
    // Mock DsButton to call formatOptionLabel with every item so all switch cases are exercised
    const DsButton = ({ dropDown, ...props }: any) => {
        const items = dropDown?.items || [];
        return (
            <div data-testid="ds-button" {...props}>
                {items.map((item: any) => (
                    <div key={item.id} data-testid={`option-${item.id}`}>
                        {dropDown?.formatOptionLabel ? dropDown.formatOptionLabel(item) : null}
                    </div>
                ))}
            </div>
        );
    };

    const DsTypography = ({ children, onClick, className }: any) => (
        <span className={className} onClick={onClick} data-testid="ds-typography">
            {children}
        </span>
    );

    return {
        DsButton,
        DsTypography,
        BlueXPListeners: { navigate: 'navigate' },
        postBlueXPMessage: mockPostBlueXPMessage
    };
});

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('./DsBlueXpMenu.module.scss', () => ({
    default: {
        dsHamburgerMenu: 'dsHamburgerMenu',
        blueMenuItem: 'blueMenuItem',
        extenalLink: 'extenalLink'
    }
}));

vi.mock('@netapp/icons/ic_menu.svg', () => ({
    ReactComponent: () => <svg data-testid="menu-icon" />
}));

vi.mock('@netapp/icons/ic_external_link.svg', () => ({
    ReactComponent: () => <svg data-testid="external-link-icon" />
}));

describe('DsBlueXpMenu', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders without crashing', () => {
        const { container } = render(<DsBlueXpMenu domain="cloud.netapp.com" />);
        expect(container).toBeTruthy();
    });

    it('renders with id and data-testid props', () => {
        render(<DsBlueXpMenu domain="cloud.netapp.com" id="menu-1" data-testid="my-menu" />);
        expect(screen.getByTestId('my-menu')).toBeTruthy();
    });

    it('renders with className prop', () => {
        render(<DsBlueXpMenu domain="cloud.netapp.com" className="custom-class" />);
        expect(screen.getByTestId('ds-button')).toBeTruthy();
    });

    describe('formatOptionLabel — links item', () => {
        it('renders the links menu item', () => {
            render(<DsBlueXpMenu domain="cloud.netapp.com" />);
            expect(screen.getByTestId('option-links')).toBeTruthy();
            expect(screen.getByText('databases.bluexp-menu.links')).toBeTruthy();
        });

        it('calls navigateTo /fsxhome/links when links item is clicked', () => {
            render(<DsBlueXpMenu domain="cloud.netapp.com" />);
            fireEvent.click(screen.getByText('databases.bluexp-menu.links'));
            expect(mockPostBlueXPMessage).toHaveBeenCalledWith({
                type: 'navigate',
                payload: { pathname: '/fsxhome/links', replace: true }
            });
        });
    });

    describe('formatOptionLabel — notifications item', () => {
        it('renders the notifications menu item', () => {
            render(<DsBlueXpMenu domain="cloud.netapp.com" />);
            expect(screen.getByTestId('option-notifications')).toBeTruthy();
            expect(screen.getByText('databases.bluexp-menu.workload-factory-notification')).toBeTruthy();
        });

        it('calls navigateTo /fsxhome/notification-setup when notifications clicked', () => {
            render(<DsBlueXpMenu domain="cloud.netapp.com" />);
            fireEvent.click(screen.getByText('databases.bluexp-menu.workload-factory-notification'));
            expect(mockPostBlueXPMessage).toHaveBeenCalledWith({
                type: 'navigate',
                payload: { pathname: '/fsxhome/notification-setup', replace: true }
            });
        });
    });

    describe('formatOptionLabel — credentials item (default case)', () => {
        it('renders the credentials menu item', () => {
            render(<DsBlueXpMenu domain="cloud.netapp.com" />);
            expect(screen.getByTestId('option-credentials')).toBeTruthy();
            expect(screen.getByText('databases.bluexp-menu.workload-factory-credentials')).toBeTruthy();
        });

        it('calls navigateTo /fsxhome/credentials when credentials clicked', () => {
            render(<DsBlueXpMenu domain="cloud.netapp.com" />);
            fireEvent.click(screen.getByText('databases.bluexp-menu.workload-factory-credentials'));
            expect(mockPostBlueXPMessage).toHaveBeenCalledWith({
                type: 'navigate',
                payload: { pathname: '/fsxhome/credentials', replace: true }
            });
        });
    });

    describe('formatOptionLabel — hub item', () => {
        it('renders the API hub menu item with external link', () => {
            render(<DsBlueXpMenu domain="cloud.netapp.com" />);
            expect(screen.getByTestId('option-hub')).toBeTruthy();
            expect(screen.getByText('databases.bluexp-menu.api-hub')).toBeTruthy();
        });

        it('renders hub link with correct href using domain prop', () => {
            render(<DsBlueXpMenu domain="cloud.netapp.com" />);
            const link = screen.getByRole('link', { name: /databases\.bluexp-menu\.api-hub/i });
            expect(link).toHaveAttribute('href', 'https://cloud.netapp.com/api-doc');
            expect(link).toHaveAttribute('target', '_blank');
            expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        });

        it('builds correct api-doc URL for different domains', () => {
            render(<DsBlueXpMenu domain="staging.console.workloads.netapp.com" />);
            const link = screen.getByRole('link', { name: /databases\.bluexp-menu\.api-hub/i });
            expect(link).toHaveAttribute('href', 'https://staging.console.workloads.netapp.com/api-doc');
        });
    });

    describe('formatOptionLabel — gitRepo item', () => {
        it('renders the GitHub monitoring repo menu item', () => {
            render(<DsBlueXpMenu domain="cloud.netapp.com" />);
            expect(screen.getByTestId('option-gitRepo')).toBeTruthy();
            expect(screen.getByText('databases.bluexp-menu.monitoring-github')).toBeTruthy();
        });

        it('renders gitRepo link with correct GitHub href', () => {
            render(<DsBlueXpMenu domain="cloud.netapp.com" />);
            const link = screen.getByRole('link', { name: /databases\.bluexp-menu\.monitoring-github/i });
            expect(link).toHaveAttribute(
                'href',
                'https://github.com/NetApp/FSx-ONTAP-samples-scripts/tree/main/Monitoring'
            );
            expect(link).toHaveAttribute('target', '_blank');
            expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        });
    });

    describe('formatOptionLabel — rss item', () => {
        it('renders the RSS feed menu item', () => {
            render(<DsBlueXpMenu domain="cloud.netapp.com" />);
            expect(screen.getByTestId('option-rss')).toBeTruthy();
            expect(screen.getByText('databases.bluexp-menu.subscribe-to-rss')).toBeTruthy();
        });

        it('renders rss link with correct href', () => {
            render(<DsBlueXpMenu domain="cloud.netapp.com" />);
            const link = screen.getByRole('link', { name: /databases\.bluexp-menu\.subscribe-to-rss/i });
            expect(link).toHaveAttribute('href', 'https://docs.netapp.com/us-en/workload-relnotes/feed.xml');
            expect(link).toHaveAttribute('target', '_blank');
            expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        });

        it('renders the custom RSS SVG icon inside the rss item', () => {
            render(<DsBlueXpMenu domain="cloud.netapp.com" />);
            const rssOption = screen.getByTestId('option-rss');
            // The RSS SVG has a specific className
            expect(rssOption.querySelector('.rssIcon')).toBeTruthy();
        });
    });

    describe('all 6 menu items are rendered', () => {
        it('renders all menu item options', () => {
            render(<DsBlueXpMenu domain="cloud.netapp.com" />);
            expect(screen.getByTestId('option-links')).toBeTruthy();
            expect(screen.getByTestId('option-notifications')).toBeTruthy();
            expect(screen.getByTestId('option-credentials')).toBeTruthy();
            expect(screen.getByTestId('option-hub')).toBeTruthy();
            expect(screen.getByTestId('option-gitRepo')).toBeTruthy();
            expect(screen.getByTestId('option-rss')).toBeTruthy();
        });
    });
});
