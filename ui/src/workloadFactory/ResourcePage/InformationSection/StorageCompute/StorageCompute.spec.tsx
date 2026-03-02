import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import StorageCompute from './StorageCompute';

const mockSetDialog = vi.hoisted(() => vi.fn());

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const map: Record<string, string> = {
                'databases.resource-overview.associated_luns': 'Associated LUNs',
                'databases.resource-overview.associated_volumes_2': 'Associated Volumes',
                'databases.general.not-available': 'N/A'
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

vi.mock('@netapp/design-system', () => ({
    Button: ({ children, onClick, variant }: any) => (
        <button data-testid="button" onClick={onClick} data-variant={variant}>
            {children}
        </button>
    ),
    useDialog: () => ({ setDialog: mockSetDialog })
}));

vi.mock('../../DatabaseOverviewLayout/DBAccordion/DBAccordion', () => ({
    default: ({ heading, toggle, open, content, resourceLoading }: any) => (
        <div data-testid="db-accordion" data-loading={resourceLoading}>
            <div data-testid="accordion-heading" onClick={() => toggle(heading)}>
                {heading}
            </div>
            {open && <div data-testid="accordion-content">{content}</div>}
        </div>
    )
}));

vi.mock('../../../../utils/CommonStyles.module.scss', () => ({
    default: { row: 'row', heading: 'heading', valueCSS: 'valueCSS', luns: 'luns' }
}));

vi.mock('./StorageCompute.module.scss', () => ({
    default: { statusIconClass: 'statusIconClass', protectionDialog: 'protectionDialog' }
}));

vi.mock('../../../../utils/appConstants', () => ({
    GENERAL: {
        DB_INSTANCE_TYPE: 'Instance Type',
        FILE_SYS_NAME: 'File System Name',
        FILE_SYS_ID: 'File System ID',
        FILE_SYS_TYPE: 'File System Type',
        FILE_SYS_STATUS: 'File System Status',
        STORAGE_CAPACITY_INFO: 'Storage Capacity',
        FILE_SYS_DP_TYPE: 'Deployment Type',
        FSX_THROUGHPUT_TYPE: 'Throughput',
        CLOSE: 'Close'
    }
}));

vi.mock('../../../../utils/utilityFunctions', () => ({
    formatString: vi.fn((val: string) => val || '')
}));

vi.mock('../../../../utils/consts', () => ({
    DBType: { MSSQL: 'MSSQL', ORACLE: 'ORACLE' }
}));

vi.mock('../../../../assets/success.svg', () => ({
    ReactComponent: () => <svg data-testid="success-icon" />
}));

vi.mock('../../../../assets/error-icon.svg', () => ({
    ReactComponent: () => <svg data-testid="failure-icon" />
}));

vi.mock('../../../../common/Dialog/DialogComponent', () => ({
    default: ({ header, content, primaryButton }: any) => (
        <div data-testid="dialog-component">
            <div>{header}</div>
            <div>{content}</div>
            <div>{primaryButton}</div>
        </div>
    )
}));

vi.mock('./LunsDialogContent/LunsDialogContent', () => ({
    default: () => <div data-testid="luns-dialog-content">LunsContent</div>
}));

const baseResourceDetails = {
    topology: {
        ec2Details: [{ instanceType: 't3.large' }],
        fileSystemName: 'fsx-001',
        fileSystemId: 'fs-123',
        fileSystemType: 'ONTAP',
        fileSystemStatus: 'AVAILABLE',
        fileSystemStorageCapacity: 1024,
        fileSystemDeploymentMode: 'MULTI_AZ',
        fileSystemThroughputCapacity: 512
    },
    storage: { fsxn: { protocol: ['iSCSI'] } },
    databaseInstanceTopology: {
        storageSummary: {
            volumes: [{ name: 'vol1', luns: [{ name: 'lun1' }] }],
            totalLuns: 1,
            totalVolumes: 1
        }
    }
};

describe('StorageCompute', () => {
    const defaultProps = {
        handleToggle: vi.fn(),
        openKey: 'Storage & Compute',
        resourceDetails: baseResourceDetails,
        resourceLoading: false,
        engineType: 'MSSQL'
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render accordion with "Storage & Compute" heading', () => {
        render(<StorageCompute {...defaultProps} />);
        expect(screen.getByText('Storage & Compute')).toBeTruthy();
    });

    it('should render Instance Type label', () => {
        render(<StorageCompute {...defaultProps} />);
        expect(screen.getByText('Instance Type')).toBeTruthy();
    });

    it('should render instance type value', () => {
        render(<StorageCompute {...defaultProps} />);
        expect(screen.getByText('t3.large')).toBeTruthy();
    });

    it('should render File System Name', () => {
        render(<StorageCompute {...defaultProps} />);
        expect(screen.getByText('fsx-001')).toBeTruthy();
    });

    it('should render File System ID', () => {
        render(<StorageCompute {...defaultProps} />);
        expect(screen.getByText('fs-123')).toBeTruthy();
    });

    it('should render File System Type', () => {
        render(<StorageCompute {...defaultProps} />);
        expect(screen.getByText('ONTAP')).toBeTruthy();
    });

    it('should render success icon when fileSystemStatus is available', () => {
        render(<StorageCompute {...defaultProps} />);
        expect(screen.getByTestId('success-icon')).toBeTruthy();
    });

    it('should render failure icon when fileSystemStatus is not available', () => {
        render(
            <StorageCompute
                {...defaultProps}
                resourceDetails={{
                    ...baseResourceDetails,
                    topology: { ...baseResourceDetails.topology, fileSystemStatus: 'DEGRADED' }
                }}
            />
        );
        expect(screen.getByTestId('failure-icon')).toBeTruthy();
    });

    it('should render storage capacity with GiB', () => {
        render(<StorageCompute {...defaultProps} />);
        expect(screen.getByText('1024 GiB')).toBeTruthy();
    });

    it('should render throughput with MB/s', () => {
        render(<StorageCompute {...defaultProps} />);
        expect(screen.getByText('512 MB/s')).toBeTruthy();
    });

    it('should render MSSQL LUNs section when engineType is MSSQL and volumes exist', () => {
        render(<StorageCompute {...defaultProps} />);
        expect(screen.getByText('View')).toBeTruthy();
    });

    it('should render N/A for LUNs when no volumes in MSSQL mode', () => {
        render(
            <StorageCompute
                {...defaultProps}
                resourceDetails={{
                    ...baseResourceDetails,
                    databaseInstanceTopology: { storageSummary: { volumes: [] } }
                }}
            />
        );
        expect(screen.getByText('N/A')).toBeTruthy();
    });

    it('should render Oracle volumes section when engineType is ORACLE', () => {
        render(
            <StorageCompute
                {...defaultProps}
                engineType="ORACLE"
                resourceDetails={{
                    ...baseResourceDetails,
                    storage: { fsxn: { protocol: ['iSCSI'] } }
                }}
            />
        );
        expect(screen.getByText('View')).toBeTruthy();
    });

    it('should render Oracle volume label using NFS protocol', () => {
        render(
            <StorageCompute
                {...defaultProps}
                engineType="ORACLE"
                resourceDetails={{
                    ...baseResourceDetails,
                    storage: { fsxn: { protocol: ['NFS'] } }
                }}
            />
        );
        expect(screen.getByText(/Associated Volumes/)).toBeTruthy();
    });

    it('should call setDialog when View button is clicked', () => {
        render(<StorageCompute {...defaultProps} />);
        fireEvent.click(screen.getByText('View'));
        expect(mockSetDialog).toHaveBeenCalled();
    });

    it('should NOT render content when accordion is closed', () => {
        render(<StorageCompute {...defaultProps} openKey="Other" />);
        expect(screen.queryByTestId('accordion-content')).toBeNull();
    });

    it('should pass resourceLoading to accordion', () => {
        render(<StorageCompute {...defaultProps} resourceLoading />);
        expect(screen.getByTestId('db-accordion').getAttribute('data-loading')).toBe('true');
    });

    it('should render empty storage capacity when missing', () => {
        render(
            <StorageCompute
                {...defaultProps}
                resourceDetails={{
                    ...baseResourceDetails,
                    topology: { ...baseResourceDetails.topology, fileSystemStorageCapacity: null }
                }}
            />
        );
        // Should not render "GiB" when capacity is missing
        expect(screen.queryByText(/GiB/)).toBeNull();
    });

    it('should render empty throughput when missing', () => {
        render(
            <StorageCompute
                {...defaultProps}
                resourceDetails={{
                    ...baseResourceDetails,
                    topology: { ...baseResourceDetails.topology, fileSystemThroughputCapacity: null }
                }}
            />
        );
        expect(screen.queryByText(/MB\/s/)).toBeNull();
    });
});
