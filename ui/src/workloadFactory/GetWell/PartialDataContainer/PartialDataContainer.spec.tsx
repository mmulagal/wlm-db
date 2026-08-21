import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import PartialDataContainer from './PartialDataContainer';

const runAssociateLinkPrefetch = vi.fn();
const setDialog = vi.fn();
const closeDialog = vi.fn();

vi.mock('@netapp/design-system', async () => {
    const actual = await vi.importActual<typeof import('@netapp/design-system')>('@netapp/design-system');
    return {
        ...actual,
        useDialog: () => ({ setDialog, closeDialog })
    };
});

vi.mock('../../../common/Dialog/DialogComponent', () => ({
    default: () => <div data-testid="loading-dialog" />
}));

vi.mock('../OptimizeInnerPage/CRRRedirectionContent/associateCrrLinkPrefetch', () => ({
    useAssociateCrrLinkPrefetch: () => ({ runAssociateLinkPrefetch })
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) =>
            ({
                'databases.wad.partial-data-missing-permissions-title':
                    'Warning: Partial data displayed due to missing permissions',
                'databases.wad.partial-data-missing-extensive-run-permission-message-instance':
                    "Some data isn't shown because the instances don't have full extensive run permission.",
                'databases.wad.partial-data-missing-extensive-run-permission-message-database':
                    "Some data isn't shown because the database doesn't have full extensive run permission.",
                'databases.wad.partial-data-displayed-title': 'Partial data is displayed.',
                'databases.wad.partial-data-missing-link-prefix':
                    "Some data isn't shown because this file system doesn't have an associated link.",
                'databases.wad.associate-and-authenticate-link': 'Associate and authenticate link.',
                'databases.well-architect.associate-link': 'Associate Link',
                'databases.wad.learn-more-about-links-prefix': 'Learn more about',
                'databases.wad.learn-more-about-links': 'links',
                'databases.general.close': 'Close'
            }[key] ?? key)
    })
}));

const makeStore = (crrPrefetchLoading = false) =>
    configureStore({
        reducer: {
            inventoryV2: (state = {}) => state,
            databaseHome: (state = {}) => state,
            crrRedirection: (state = { crrPrefetchLoading }) => state
        }
    });

const renderWithStore = (ui: React.ReactElement, crrPrefetchLoading = false) =>
    render(<Provider store={makeStore(crrPrefetchLoading)}>{ui}</Provider>);

describe('PartialDataContainer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders default compute-permissions copy', () => {
        renderWithStore(<PartialDataContainer />);

        expect(screen.getByText('Warning: Partial data displayed due to missing permissions')).toBeDefined();
    });

    it('renders missingExtensiveRunPermission variant copy for instances', () => {
        renderWithStore(<PartialDataContainer variant="missingExtensiveRunPermission" resourceType="instance" />);

        expect(screen.getByText('Partial data is displayed.')).toBeDefined();
        expect(
            screen.getByText("Some data isn't shown because the instances don't have full extensive run permission.")
        ).toBeDefined();
    });

    it('renders missingExtensiveRunPermission variant copy for databases', () => {
        renderWithStore(<PartialDataContainer variant="missingExtensiveRunPermission" resourceType="database" />);

        expect(
            screen.getByText("Some data isn't shown because the database doesn't have full extensive run permission.")
        ).toBeDefined();
    });

    it('hides missingExtensiveRunPermission variant when close is clicked', () => {
        renderWithStore(<PartialDataContainer variant="missingExtensiveRunPermission" resourceType="instance" />);

        fireEvent.click(screen.getByTestId('partial-data-warning-banner-close'));

        expect(screen.queryByText('Partial data is displayed.')).toBeNull();
    });

    it('renders missingAssociatedLink variant copy', () => {
        renderWithStore(<PartialDataContainer variant="missingAssociatedLink" />);

        expect(screen.getByText('Partial data is displayed.')).toBeDefined();
        expect(
            screen.getByText("Some data isn't shown because this file system doesn't have an associated link.")
        ).toBeDefined();
        expect(screen.getByText('Associate and authenticate link.')).toBeDefined();
        expect(screen.getByText('links')).toBeDefined();
    });

    it('opens loading dialog and prefetches links when associate link button is clicked', () => {
        renderWithStore(<PartialDataContainer variant="missingAssociatedLink" />);

        fireEvent.click(screen.getByText('Associate and authenticate link.'));

        expect(setDialog).toHaveBeenCalledTimes(1);
        expect(runAssociateLinkPrefetch).toHaveBeenCalledWith(
            { volumeName: '', volumeId: '' },
            expect.anything(),
            false,
            true
        );
    });

    it('disables associate link button while prefetch is loading', () => {
        renderWithStore(<PartialDataContainer variant="missingAssociatedLink" />, true);

        expect(screen.getByText('Associate and authenticate link.').closest('button')).toBeDisabled();
    });

    it('hides missingAssociatedLink variant when close is clicked', () => {
        renderWithStore(<PartialDataContainer variant="missingAssociatedLink" />);

        fireEvent.click(screen.getByTestId('partial-data-warning-banner-close'));

        expect(screen.queryByText('Partial data is displayed.')).toBeNull();
    });
});
