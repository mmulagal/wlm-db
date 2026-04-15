import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ImpactedResourceDialog from './ImpactedResourceDialog';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string) => k })
}));

vi.mock('../../../../../utils/consts', () => ({
    ASSESSMENT_CONFIG_NAMES: {
        NTFS_ALLOCATION_UNIT_SIZE: 'NTFS allocation unit size',
        MULTIPATH_IO_POLICY: 'Multipath I/O Policy',
        OS_TYPE: 'OS type',
        THIN_PROVISIONING: 'Thin provisioning',
        AUTOSIZE: 'Autosize',
        AUTOSIZE_MODE: 'Autosize-mode',
        FRACTIONAL_RESERVE: 'Fractional reserve',
        SNAPSHOT_AUTODELETE: 'Snapshot autodelete',
        SPACE_MANAGEMENT: 'Space management',
        SNAPSHOT_COPY_RESERVE: 'Snapshot copy reserve',
        TIERING_POLICY: 'Tiering policy',
        TIERING_MINIMUM_COOLING_DAYS: 'Tiering minimum cooling days',
        SPACE_RESERVATION: 'Space reservation',
        SPACE_ALLOCATION: 'Space allocation',
        DRIVE_LETTER: 'Drive letter',
        SHARED_STORAGE: 'Shared storage'
    },
    DBType: { MSSQL: 'MSSQL', ORACLE: 'ORACLE' }
}));

vi.mock('../../../../../store/storeHooks', () => ({
    useAppSelector: () => ({ configEngineType: 'MSSQL' })
}));

vi.mock('./ImpactedResourceDialog.module.scss', () => ({
    default: {
        tableWrapper: 'tableWrapper',
        headerRow: 'headerRow',
        headerCell: 'headerCell',
        bodyRow: 'bodyRow',
        bodyCell: 'bodyCell',
        cellLine: 'cellLine'
    }
}));

vi.mock('@tlveng/wlm-ds', () => ({
    DsTypography: ({ children }: any) => <span>{children}</span>
}));

describe('ImpactedResourceDialog', () => {
    it('renders null for unknown config', () => {
        const { container } = render(<ImpactedResourceDialog data={{ configurationName: 'unknown-config' } as any} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders database name column for data-files-location without additionalInfo', () => {
        const data = {
            configurationName: 'data-files-location',
            objectsInViolation: ['db1', 'db2'],
            violationDetails: []
        };
        render(<ImpactedResourceDialog data={data as any} />);
        expect(screen.getByText('databases.well-architect.database-name')).toBeTruthy();
        expect(screen.getByText('db1')).toBeTruthy();
        expect(screen.getByText('db2')).toBeTruthy();
    });

    it('renders drive and LUN path columns for data-files-location with additionalInfo', () => {
        const data = {
            configurationName: 'data-files-location',
            objectsInViolation: ['testdb'],
            violationDetails: [
                {
                    objectName: 'placement',
                    value: 'testdb',
                    objectType: 'Database',
                    additionalInfo: { lunPath: '/vol/data/lun1', driveLetter: 'D:' }
                }
            ]
        };
        render(<ImpactedResourceDialog data={data as any} />);
        expect(screen.getByText('databases.well-architect.database-name')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.drive')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.lun-path')).toBeTruthy();
        expect(screen.getByText('testdb')).toBeTruthy();
    });

    it('renders for tempdb-files-location with additionalInfo', () => {
        const data = {
            configurationName: 'tempdb-files-location',
            objectsInViolation: ['tempdb'],
            violationDetails: [
                {
                    objectName: 'placement',
                    value: 'tempdb',
                    objectType: 'Database',
                    additionalInfo: { lunPath: '/vol/tempdb/lun1', driveLetter: 'T:' }
                },
                {
                    objectName: 'placement',
                    value: 'tempdb',
                    objectType: 'Database',
                    additionalInfo: { lunPath: '/vol/tempdb/lun2', driveLetter: 'U:' }
                }
            ]
        };
        render(<ImpactedResourceDialog data={data as any} />);
        expect(screen.getByText('databases.well-architect.database-name')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.drive')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.lun-path')).toBeTruthy();
        expect(screen.getByText('tempdb')).toBeTruthy();
    });

    it('renders for log-files-location without additionalInfo', () => {
        const data = {
            configurationName: 'log-files-location',
            objectsInViolation: ['logdb1'],
            violationDetails: []
        };
        render(<ImpactedResourceDialog data={data as any} />);
        expect(screen.getByText('databases.well-architect.database-name')).toBeTruthy();
        expect(screen.getByText('logdb1')).toBeTruthy();
    });
});
