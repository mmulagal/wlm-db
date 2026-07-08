/**
 * Oracle Well-Architected configuration IDs served by this bundle.
 * These values must match the configurationId strings from the WAD backend.
 */
export const OracleConfigurationIds = new Set<string>([
    // Compute
    'transparent-hugepages',
    'tcp-advanced-options',
    'filesystems-io-options',
    'multiblock-readcount',

    // Application
    'oracle-security-patch',

    // Storage — placement
    'redologs-placement',
    'templogs-placement',
    'archive-placement',
    'datafiles-placement',
    'controlfiles-placement',
    'oracle-binary-placement',
    'data-dg-lun-layout',
    'log-dg-lun-layout',
    'fra-dg-lun-layout',
    'archivelog-dg-lun-layout',

    // Storage — sizing
    'headroom',
    'swap-space',

    // Resiliency
    'snapcenter-snapshot',

    // Cloning
    'clone-management'
]);

/**
 * Oracle configuration IDs shared with MSSQL that are still
 * served by this bundle when the workload is Oracle.
 */
export const OracleSharedConfigurationIds = new Set<string>(['host-os-patch', 'crr', 'backup-configuration']);
