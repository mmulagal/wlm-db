import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

import ProtectionIcons from './ProtectionIcons';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key
    })
}));

vi.mock('@netapp/design-system', () => ({
    Popover: ({ children, container, trigger, title }: any) => (
        <div data-testid="popover" data-trigger={trigger}>
            {container}
            {children}
        </div>
    )
}));

vi.mock('../../assets/Local snapshots - Storage consistent.svg', () => ({
    ReactComponent: () => <svg data-testid="local-snapshots-storage-svg" />
}));
vi.mock('../../assets/Local snapshots - Application consistent.svg', () => ({
    ReactComponent: () => <svg data-testid="local-snapshots-app-svg" />
}));
vi.mock('../../assets/ic_copy.svg', () => ({ ReactComponent: () => <svg data-testid="remote-replication-svg" /> }));
vi.mock('../../assets/FSx for ONTAP backup.svg', () => ({ ReactComponent: () => <svg data-testid="fsx-ontap-svg" /> }));
vi.mock('../../assets/SQL.svg', () => ({ ReactComponent: () => <svg data-testid="native-sql-svg" /> }));

describe('ProtectionIcons', () => {
    const defaultProtectionData = {
        isFsxOntapSnapshotsEnabled: true,
        isAppConsistentBackupEnabled: false,
        isCRREnabled: true,
        isAwsBackupEnabled: { fsxn: false },
        isSqlNativeEnabled: false
    };

    it('should be defined', () => {
        expect(ProtectionIcons).toBeDefined();
    });

    it('should render without crashing', () => {
        const { container } = render(<ProtectionIcons protectionData={defaultProtectionData} />);
        expect(container).toBeTruthy();
    });

    it('should render with all protection data enabled', () => {
        const protectionData = {
            isFsxOntapSnapshotsEnabled: true,
            isAppConsistentBackupEnabled: true,
            isCRREnabled: true,
            isAwsBackupEnabled: { fsxn: true },
            isSqlNativeEnabled: true
        };
        const { container } = render(<ProtectionIcons protectionData={protectionData} />);
        expect(container).toBeTruthy();
    });

    it('should render with empty protectionData', () => {
        const { container } = render(<ProtectionIcons protectionData={{}} />);
        expect(container).toBeTruthy();
    });

    it('should handle excludeIcons prop', () => {
        const { container } = render(
            <ProtectionIcons
                protectionData={defaultProtectionData}
                excludeIcons={['databases.general.local-snapshots-storage-consistent']}
            />
        );
        expect(container).toBeTruthy();
    });

    it('should handle comingSoonIcons prop', () => {
        const { container } = render(
            <ProtectionIcons
                protectionData={defaultProtectionData}
                comingSoonIcons={['databases.general.remote-replications']}
            />
        );
        expect(container).toBeTruthy();
    });

    it('should render with default empty arrays for excludeIcons and comingSoonIcons', () => {
        const { container } = render(<ProtectionIcons protectionData={defaultProtectionData} />);
        expect(container).toBeTruthy();
    });
});
