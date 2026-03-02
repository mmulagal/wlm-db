import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import LunsDialogContent from './LunsDialogContent';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const map: Record<string, string> = {
                'databases.resource-overview.associated_volumes': 'Associated Volumes',
                'databases.resource-overview.associated_lun': 'Associated LUN'
            };
            return map[key] || key;
        }
    })
}));

vi.mock('@tlveng/wlm-ds', () => ({
    DsTypography: ({ children, variant, className, title }: any) => (
        <span data-testid="ds-typography" data-variant={variant} className={className} title={title}>
            {children}
        </span>
    )
}));

vi.mock('./LunsDialogContent.module.scss', () => ({
    default: {
        tableWrapper: 'tableWrapper',
        tableRow: 'tableRow',
        tableCell: 'tableCell',
        tableCellFsx: 'tableCellFsx'
    }
}));

vi.mock('../../../../../utils/consts', () => ({
    DBType: { MSSQL: 'MSSQL', ORACLE: 'ORACLE' }
}));

const mockResourceDetails = {
    databaseInstanceTopology: {
        fileSystemName: 'fsx-ontap-01',
        storageSummary: {
            volumes: [
                { name: 'vol1', luns: [{ name: 'lun1' }, { name: 'lun2' }] },
                { name: 'vol2', luns: [] }
            ]
        }
    },
    storage: { fsxn: { protocol: ['iSCSI'] } }
};

describe('LunsDialogContent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render FSx for ONTAP header', () => {
        render(<LunsDialogContent resourceDetails={mockResourceDetails} engineType="MSSQL" />);
        expect(screen.getByText('FSx for ONTAP')).toBeTruthy();
    });

    it('should render Associated Volumes column header', () => {
        render(<LunsDialogContent resourceDetails={mockResourceDetails} engineType="MSSQL" />);
        expect(screen.getByText('Associated Volumes')).toBeTruthy();
    });

    it('should render Associated LUN column header for MSSQL with iSCSI', () => {
        render(<LunsDialogContent resourceDetails={mockResourceDetails} engineType="MSSQL" />);
        expect(screen.getByText('Associated LUN')).toBeTruthy();
    });

    it('should NOT render Associated LUN column for Oracle with NFS protocol', () => {
        render(
            <LunsDialogContent
                resourceDetails={{ ...mockResourceDetails, storage: { fsxn: { protocol: ['NFS'] } } }}
                engineType="ORACLE"
            />
        );
        expect(screen.queryByText('Associated LUN')).toBeNull();
    });

    it('should render volume names as rows', () => {
        render(<LunsDialogContent resourceDetails={mockResourceDetails} engineType="MSSQL" />);
        expect(screen.getByText('vol1')).toBeTruthy();
        expect(screen.getByText('vol2')).toBeTruthy();
    });

    it('should render fsxn file system name for each row', () => {
        render(<LunsDialogContent resourceDetails={mockResourceDetails} engineType="MSSQL" />);
        const fsnTexts = screen.getAllByText('fsx-ontap-01');
        expect(fsnTexts.length).toBeGreaterThanOrEqual(2);
    });

    it('should render LUN names joined by comma', () => {
        render(<LunsDialogContent resourceDetails={mockResourceDetails} engineType="MSSQL" />);
        expect(screen.getByText('lun1, lun2')).toBeTruthy();
    });

    it('should render empty LUN cell when volume has no luns', () => {
        render(<LunsDialogContent resourceDetails={mockResourceDetails} engineType="MSSQL" />);
        // vol2 has no luns, should render empty lun string
        expect(screen.getByText('vol2')).toBeTruthy();
    });

    it('should render empty table when no volumes', () => {
        const emptyDetails = {
            databaseInstanceTopology: { fileSystemName: 'fsx', storageSummary: { volumes: [] } },
            storage: { fsxn: { protocol: ['iSCSI'] } }
        };
        render(<LunsDialogContent resourceDetails={emptyDetails} engineType="MSSQL" />);
        // Only header row should be visible
        expect(screen.getByText('FSx for ONTAP')).toBeTruthy();
        expect(screen.queryByText('vol1')).toBeNull();
    });

    it('should handle missing volumes gracefully', () => {
        const noVolumes = {
            databaseInstanceTopology: { fileSystemName: 'fsx' },
            storage: { fsxn: { protocol: ['iSCSI'] } }
        };
        render(<LunsDialogContent resourceDetails={noVolumes} engineType="MSSQL" />);
        expect(screen.getByText('FSx for ONTAP')).toBeTruthy();
    });

    it('should render LUN column for Oracle with iSCSI protocol', () => {
        render(
            <LunsDialogContent
                resourceDetails={{ ...mockResourceDetails, storage: { fsxn: { protocol: ['iSCSI'] } } }}
                engineType="ORACLE"
            />
        );
        expect(screen.getByText('Associated LUN')).toBeTruthy();
    });
});
