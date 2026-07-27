import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PartialDataContainer from './PartialDataContainer';

const mockDispatch = vi.fn();

vi.mock('react-redux', () => ({
    useDispatch: () => mockDispatch
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
                'databases.wad.learn-more-about-links-prefix': 'Learn more about',
                'databases.wad.learn-more-about-links': 'links'
            }[key] ?? key)
    })
}));

vi.mock('../../../store/workloadFactory/databaseHomeSlice', () => ({
    selectedTabSelection: vi.fn((tab: string) => ({ type: 'selectedTabSelection', payload: tab }))
}));

describe('PartialDataContainer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders default compute-permissions copy', () => {
        render(<PartialDataContainer />);

        expect(screen.getByText('Warning: Partial data displayed due to missing permissions')).toBeDefined();
    });

    it('renders missingExtensiveRunPermission variant copy for instances', () => {
        render(<PartialDataContainer variant="missingExtensiveRunPermission" resourceType="instance" />);

        expect(screen.getByText('Partial data is displayed.')).toBeDefined();
        expect(
            screen.getByText("Some data isn't shown because the instances don't have full extensive run permission.")
        ).toBeDefined();
        expect(screen.queryByText('Associate and authenticate link.')).toBeNull();
    });

    it('renders missingExtensiveRunPermission variant copy for databases', () => {
        render(<PartialDataContainer variant="missingExtensiveRunPermission" resourceType="database" />);

        expect(
            screen.getByText("Some data isn't shown because the database doesn't have full extensive run permission.")
        ).toBeDefined();
    });

    it('hides missingExtensiveRunPermission variant when close is clicked', () => {
        render(<PartialDataContainer variant="missingExtensiveRunPermission" resourceType="instance" />);

        fireEvent.click(screen.getByTestId('partial-data-warning-banner-close'));

        expect(screen.queryByText('Partial data is displayed.')).toBeNull();
    });

    it('renders missingAssociatedLink variant copy', () => {
        render(<PartialDataContainer variant="missingAssociatedLink" />);

        expect(screen.getByText('Partial data is displayed.')).toBeDefined();
        expect(
            screen.getByText("Some data isn't shown because this file system doesn't have an associated link.")
        ).toBeDefined();
        expect(screen.getByText('Associate and authenticate link.')).toBeDefined();
        expect(screen.getByText('links')).toBeDefined();
    });

    it('hides missingAssociatedLink variant when close is clicked', () => {
        render(<PartialDataContainer variant="missingAssociatedLink" />);

        fireEvent.click(screen.getByTestId('partial-data-warning-banner-close'));

        expect(screen.queryByText('Partial data is displayed.')).toBeNull();
    });
});
