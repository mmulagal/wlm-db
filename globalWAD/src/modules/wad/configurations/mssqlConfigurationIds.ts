/**
 * MSSQL Well-Architected configuration IDs served by this bundle.
 * These values must match the configurationId strings from the WAD backend.
 */
export const MssqlConfigurationIds = new Set<string>([
    // Compute
    'compute-rightsizing',
    'host-os-patch',
    'mtu-alignment',
    'rss-config',

    // Application
    'sql-license',
    'mssql-patch',
    'maxdop',

    // Storage
    'performance-tier',
    'log-drive-size',
    'tempdb-drive-size',
    'data-files-location',
    'log-files-location',
    'tempdb-files-location',
    'ntfs-allocation-unit-size',
    'ntfs-allocation-size',
    'drive-letter',
    'file-system-headroom',

    // Resiliency
    'snapshot-policy',
    'crr',
    'backup-configuration',
    'mssql-high-availability',
    'high-availability',
    'cluster-quorum',
    'heartbeat-settings',
    'sql-server-service',

    // Cloning
    'clone-management'
]);
