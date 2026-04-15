import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import TagComponent from '../TagComponent';
import databaseHomeSlice from '../../../../../store/workloadFactory/databaseHomeSlice';

vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, variant, style }: any) => (
        <span data-testid={`typography-${variant}`} style={style}>
            {children}
        </span>
    )
}));

const stableT = (key: string) => key;

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: stableT
    })
}));

vi.mock('../../../../../common/Tag/Tag', () => ({
    default: ({ text }: any) => <div data-testid="tag">{text}</div>
}));

vi.mock('../../../../../assets/tag.svg', () => ({
    ReactComponent: (props: any) => <svg data-testid="tag-image" {...props} />
}));

vi.mock('../../../../../assets/severity-icon.svg', () => ({
    ReactComponent: (props: any) => <svg data-testid="severity-icon" {...props} />
}));

vi.mock('./TagComponent.module.scss', () => ({
    default: {
        tagComponent: 'tagComponent',
        topSection: 'topSection',
        mainSection: 'mainSection',
        severitySection: 'severitySection',
        severity: 'severity',
        circle: 'circle',
        error: 'error',
        warning: 'warning'
    }
}));

const createStore = (selectedConfig: string | null = null) =>
    configureStore({
        reducer: { databaseHome: databaseHomeSlice.reducer },
        preloadedState: {
            databaseHome: {
                ...databaseHomeSlice.getInitialState(),
                selectedConfig
            }
        } as any
    });

const renderWithStore = (props: any, selectedConfig: string | null = null) => {
    const store = createStore(selectedConfig);
    return render(
        <Provider store={store}>
            <TagComponent {...props} />
        </Provider>
    );
};

describe('TagComponent', () => {
    it('renders without crashing', () => {
        renderWithStore({ tagHeight: '100px' });
        expect(screen.getAllByTestId('tag').length).toBeGreaterThan(0);
    });

    it('renders title typography', () => {
        renderWithStore({ tagHeight: '100px' });
        expect(screen.getByText('databases.well-architect.tags.title')).toBeTruthy();
    });

    it('renders tag image svg', () => {
        renderWithStore({ tagHeight: '100px' });
        expect(screen.getByTestId('tag-image')).toBeTruthy();
    });

    // --- Severity section ---
    it('renders severity section when severity is Critical', () => {
        renderWithStore({ tagHeight: '100px', severity: 'Critical' });
        expect(screen.getByTestId('severity-icon')).toBeTruthy();
        expect(screen.getByText('Critical')).toBeTruthy();
    });

    it('renders severity section when severity is Warning', () => {
        renderWithStore({ tagHeight: '100px', severity: 'Warning' });
        expect(screen.getByText('Warning')).toBeTruthy();
    });

    it('does not render severity section when no severity', () => {
        renderWithStore({ tagHeight: '100px' });
        expect(screen.queryByTestId('severity-icon')).toBeNull();
    });

    // ===== MSSQL engine type (default) =====

    it('renders STORAGE_TIER tags for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Storage tier', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
    });

    it('renders FILE_SYSTEM_HEADROOM tags for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'File system headroom', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
    });

    it('renders MAXDOP tags for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'MAXDOP', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
    });

    it('renders RSS_CONFIGURATION (Network adapter settings) for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Network adapter settings', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
    });

    it('renders NTFS allocation unit size for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'NTFS allocation unit size', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
    });

    it('renders OS type for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'OS type', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
    });

    it('renders Tiering policy for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Tiering policy', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
    });

    it('renders Thin provisioning for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Thin provisioning', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.costOptimization')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.operationalExcellence')).toBeTruthy();
    });

    it('renders Autosize for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Autosize', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.costOptimization')).toBeTruthy();
    });

    it('renders Autosize-mode for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Autosize-mode', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.costOptimization')).toBeTruthy();
    });

    it('renders Fractional reserve for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Fractional reserve', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.costOptimization')).toBeTruthy();
    });

    it('renders Snapshot copy reserve for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Snapshot copy reserve', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.costOptimization')).toBeTruthy();
    });

    it('renders Snapshot autodelete for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Snapshot autodelete', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.costOptimization')).toBeTruthy();
    });

    it('renders Space management for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Space management', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.costOptimization')).toBeTruthy();
    });

    it('renders LOG_DRIVE_SIZE for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Log drive size', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.operationalExcellence')).toBeTruthy();
    });

    it('renders TEMPDB_DRIVE_SIZE for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'TempDB drive size', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.operationalExcellence')).toBeTruthy();
    });

    it('renders SCHEDULED_LOCAL_SNAPSHOT for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Scheduled local snapshot', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.reliability')).toBeTruthy();
    });

    it('renders Space allocation for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Space allocation', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.reliability')).toBeTruthy();
    });

    it('renders Space reservation for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Space reservation', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.reliability')).toBeTruthy();
    });

    it('renders Multipath I/O Timeout for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Multipath I/O Timeout', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.reliability')).toBeTruthy();
    });

    it('renders SCHEDULED_FSX_FOR_ONTAP_BACKUPS for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Backup Configuration', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.reliability')).toBeTruthy();
    });

    it('renders CLONE_MANAGEMENT for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Clone cleanup', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.costEfficiency')).toBeTruthy();
    });

    it('renders OPERATING_SYSTEM_PATCH (via GENERAL) for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Operating system patch', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.security')).toBeTruthy();
    });

    it('renders Multipath I/O Policy for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Multipath I/O Policy', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.reliability')).toBeTruthy();
    });

    it('renders MTU for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'MTU alignment', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.reliability')).toBeTruthy();
    });

    it('renders DATA_FILES_MDF for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Data files (.mdf) placement', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.operationalExcellence')).toBeTruthy();
    });

    it('renders LOG_FILES_LDF for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Log files (.ldf) placement', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.operationalExcellence')).toBeTruthy();
    });

    it('renders TEMPDB_PLACEMENT for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'TempDB placement', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
    });

    it('renders Data files string for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Data files', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.noTagsAvailable')).toBeTruthy();
    });

    it('renders Log files string for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Log files', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.noTagsAvailable')).toBeTruthy();
    });

    it('renders Microsoft SQL Server patch for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Microsoft SQL Server patch', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.reliability')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.security')).toBeTruthy();
    });

    it('renders License for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'License', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.costOptimization')).toBeTruthy();
    });

    it('renders Tiering minimum cooling days for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Tiering minimum cooling days', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.costOptimization')).toBeTruthy();
    });

    it('renders CRR for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Cross-Region Replication (CRR)', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.reliability')).toBeTruthy();
    });

    it('renders Cross-Region Replication (CRR) string for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Cross-Region Replication (CRR)', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.reliability')).toBeTruthy();
    });

    it('renders MSSQL_HIGH_AVAILABILITY for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Microsoft SQL Server High Availability', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.reliability')).toBeTruthy();
    });

    it('renders SHARED_STORAGE for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Shared storage', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.reliability')).toBeTruthy();
    });

    it('renders DRIVE_LETTER for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Drive Letter', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.reliability')).toBeTruthy();
    });

    it('renders HEARTBEAT_SETTINGS for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Heartbeat Settings', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.reliability')).toBeTruthy();
    });

    it('renders CLUSTER_QUORUM for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Cluster Quorum', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.reliability')).toBeTruthy();
    });

    it('renders SQL_SERVER_SERVICE for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'SQL Server Service', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.reliability')).toBeTruthy();
    });

    it('renders ONTAP_CAPS for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'ONTAP', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.costOptimization')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.operationalExcellence')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.reliability')).toBeTruthy();
    });

    it('renders OPERATING_SYSTEM for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Operating system', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.reliability')).toBeTruthy();
    });

    it('renders COMPUTE_RIGHTSIZING for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Compute rightsizing', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.operationalExcellence')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.costOptimization')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.reliability')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.security')).toBeTruthy();
    });

    it('renders MULTIPATH_IO for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Multipath I/O', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.reliability')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.operationalExcellence')).toBeTruthy();
    });

    it('renders HOST_UTILITIES for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Host utilities', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.reliability')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.operationalExcellence')).toBeTruthy();
    });

    it('renders MULTIPATH_CONFIGURATION for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Multipath config file', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.reliability')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.operationalExcellence')).toBeTruthy();
    });

    it('renders TRANSPARENT_HUGEPAGES for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Transparent hugepages', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
    });

    it('renders MULTIPATH_READCOUNT for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Multiblock read count', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
    });

    it('renders FILESYSTEMS_IO_OPTIONS for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Filesystem I/O options', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
    });

    it('renders SWAP_SPACE for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Swap space', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
    });

    it('renders SELINUX for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'SELinux', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.security')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.operationalExcellence')).toBeTruthy();
    });

    it('renders ISCSI_REPLACEMENT_TIMEOUT for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'ISCSI replacement timeout', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.reliability')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
    });

    it('renders MULTIPATH_IO_SESSIONS for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Multipath I/O sessions', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.reliability')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
    });

    it('renders TCP_ADVANCED_OPTIONS for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'TCP advanced options', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.reliability')).toBeTruthy();
    });

    it('renders ASM_SETUP for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'ASM setup', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.reliability')).toBeTruthy();
    });

    it('renders AFD_LOGICAL_BLOCK_SIZE for MSSQL', () => {
        renderWithStore({
            tagHeight: '100px',
            type: 'ASM filter driver logical block size alignment',
            engineType: 'MSSQL'
        });
        expect(screen.getByText('databases.well-architect.tags.reliability')).toBeTruthy();
    });

    it('renders ASMLIB_LOGICAL_BLOCK_SIZE for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'ASMLib logical block size alignment', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.reliability')).toBeTruthy();
    });

    it('renders ASM_EXTERNAL_REDUNDANCY for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'ASM external redundancy', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.costEfficiency')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
    });

    it('renders MULTIPATH_FRIENDLY_NAMES for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Multipath friendly names', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.operationalExcellence')).toBeTruthy();
    });

    it('renders REDO_LOGS_PLACEMENT for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Redo logs placement', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.operationalExcellence')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.costOptimization')).toBeTruthy();
    });

    it('renders TEMP_LOGS_PLACEMENT for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Temp placement', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
    });

    it('renders ARCHIVE_PLACEMENT for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Archive placement', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
    });

    it('renders DATAFILES_PLACEMENT for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Data files placement', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
    });

    it('renders CONTROLFILES_PLACEMENT for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Control files placement', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
    });

    it('renders ORACLE_BINARY_PLACEMENT for MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Oracle binary placement', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
    });

    it('renders default no-tags for unrecognized MSSQL type', () => {
        renderWithStore({ tagHeight: '100px', type: 'UNKNOWN_TYPE', engineType: 'MSSQL' });
        expect(screen.getByText('databases.well-architect.tags.noTagsAvailable')).toBeTruthy();
    });

    // ===== Oracle engine type =====

    it('renders ASM_EXTERNAL_REDUNDANCY for Oracle', () => {
        renderWithStore({ tagHeight: '100px', type: 'ASM external redundancy', engineType: 'Oracle' });
        expect(screen.getByText('databases.well-architect.tags.costEfficiency')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
    });

    it('renders NFS_MOUNT_OPTIONS_DATABASEFILES for Oracle', () => {
        renderWithStore({ tagHeight: '100px', type: 'NFS mount options - database files', engineType: 'Oracle' });
        expect(screen.getByText('databases.well-architect.tags.reliability')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.operationalExcellence')).toBeTruthy();
    });

    it('renders EXPORT_POLICY for Oracle', () => {
        renderWithStore({ tagHeight: '100px', type: 'Binaries export policy', engineType: 'Oracle' });
        expect(screen.getByText('databases.well-architect.tags.reliability')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.operationalExcellence')).toBeTruthy();
    });

    it('renders NFS_ROOTONLY for Oracle', () => {
        renderWithStore({ tagHeight: '100px', type: 'NFS rootonly', engineType: 'Oracle' });
        expect(screen.getByText('databases.well-architect.tags.reliability')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
    });

    it('renders DNFS_CONFIGURATION_FILE for Oracle', () => {
        renderWithStore({ tagHeight: '100px', type: 'dNFS configuration file', engineType: 'Oracle' });
        expect(screen.getByText('databases.well-architect.tags.reliability')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
    });

    it('renders DNFS_NO_SHARED_CACHE for Oracle', () => {
        renderWithStore({ tagHeight: '100px', type: 'dNFS no shared cache', engineType: 'Oracle' });
        expect(screen.getByText('databases.well-architect.tags.reliability')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
    });

    it('renders OPERATING_SYSTEM_PATCH for Oracle', () => {
        renderWithStore({ tagHeight: '100px', type: 'Operating system patch', engineType: 'Oracle' });
        expect(screen.getByText('databases.well-architect.tags.reliability')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.security')).toBeTruthy();
    });

    it('renders ONTAP_CAPS for Oracle', () => {
        renderWithStore({ tagHeight: '100px', type: 'ONTAP', engineType: 'Oracle' });
        expect(screen.getByText('databases.well-architect.tags.costOptimization')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.operationalExcellence')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.reliability')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.security')).toBeTruthy();
    });

    it('renders OPERATING_SYSTEM for Oracle', () => {
        renderWithStore({ tagHeight: '100px', type: 'Operating system', engineType: 'Oracle' });
        expect(screen.getByText('databases.well-architect.tags.reliability')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.operationalExcellence')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.security')).toBeTruthy();
    });

    it('renders FILE_SYSTEM_HEADROOM for Oracle', () => {
        renderWithStore({ tagHeight: '100px', type: 'File system headroom', engineType: 'Oracle' });
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
    });

    it('renders SWAP_SPACE for Oracle', () => {
        renderWithStore({ tagHeight: '100px', type: 'Swap space', engineType: 'Oracle' });
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
    });

    it('renders DATA_DG_LUN_LAYOUT for Oracle', () => {
        renderWithStore({ tagHeight: '100px', type: 'ASM data disk group LUNs', engineType: 'Oracle' });
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.operationalExcellence')).toBeTruthy();
    });

    it('renders LOG_DG_LUN_LAYOUT for Oracle', () => {
        renderWithStore({ tagHeight: '100px', type: 'ASM logs disk group LUNs', engineType: 'Oracle' });
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.operationalExcellence')).toBeTruthy();
    });

    it('renders FRA_DG_LUN_LAYOUT for Oracle', () => {
        renderWithStore({ tagHeight: '100px', type: 'ASM FRA disk group LUNs', engineType: 'Oracle' });
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.operationalExcellence')).toBeTruthy();
    });

    it('renders ARCHIVELOG_DG_LUN_LAYOUT for Oracle', () => {
        renderWithStore({ tagHeight: '100px', type: 'ASM archive log disk group LUNs', engineType: 'Oracle' });
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.operationalExcellence')).toBeTruthy();
    });

    it('renders default tags for unknown Oracle type', () => {
        renderWithStore({ tagHeight: '100px', type: 'SOME_UNKNOWN_ORACLE_TYPE', engineType: 'Oracle' });
        expect(screen.getByText('databases.well-architect.tags.costOptimization')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.operationalExcellence')).toBeTruthy();
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
    });

    // ===== selectedConfig from Redux =====

    it('uses selectedConfig from Redux when type is not passed (MSSQL)', () => {
        const store = createStore('Storage tier');
        render(
            <Provider store={store}>
                <TagComponent tagHeight="100px" engineType="MSSQL" />
            </Provider>
        );
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
    });

    it('uses selectedConfig from Redux when type is not passed (Oracle)', () => {
        const store = createStore('ONTAP');
        render(
            <Provider store={store}>
                <TagComponent tagHeight="100px" engineType="Oracle" />
            </Provider>
        );
        expect(screen.getByText('databases.well-architect.tags.costOptimization')).toBeTruthy();
    });

    it('renders with no engineType defaults to MSSQL', () => {
        renderWithStore({ tagHeight: '100px', type: 'Storage tier' });
        expect(screen.getByText('databases.well-architect.tags.performanceEfficiency')).toBeTruthy();
    });
});
