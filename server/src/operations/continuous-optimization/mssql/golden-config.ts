import {
    ASSESSMENT_RESOURCE_TYPE,
    AssessmentStatus,
    AwsWellArchitecturedPillars,
    DEFAULT_MPIO_TIMEOUT,
    MIN_OPTIMIZED_HEADROOM_PERCENTAGE,
    OptimizeStorageConfigs,
    SEVERITY
} from '../../../utils/continous-optimization-consts';
import type { GoldenConfigEntry } from '../assessment-utils';

interface HeartbeatSettings {
    SameSubnetDelay: number;
    SameSubnetThreshold: number;
    CrossSubnetDelay: number;
    CrossSubnetThreshold: number;
    CrossSiteDelay: number;
    CrossSiteThreshold: number;
}

const MSSQL_HEARTBEAT_SETTINGS: HeartbeatSettings = {
    SameSubnetDelay: 1000,
    SameSubnetThreshold: 40,
    CrossSubnetDelay: 1000,
    CrossSubnetThreshold: 40,
    CrossSiteDelay: 1000,
    CrossSiteThreshold: 40
};

const MSSQL_GOLDEN_CONFIG: GoldenConfigEntry[] = [
    // ── configuration / volume ──────────────────────────────────────────────
    {
        id: 'thin-provision',
        name: 'Thin provisioning',
        parameter: 'thin-provision',
        value: true,
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'ONTAP',
        severity: SEVERITY.CRITICAL,
        recommendation:
            'To optimize storage efficiency and cost-effectiveness, configure thin provisioning, autosize and space management options for your FSx ONTAP volumes and LUNs\nIf Not Configured Properly:\n- Over-provisioning risks: Without thin provisioning, storage is allocated upfront, leading to inefficient use and higher costs due to over-provisioning.\n- Increased storage costs: Static allocation results in paying for unused capacity, increasing expenses.\n- Limited scalability: Lack of dynamic allocation hampers scalability and flexibility, impacting performance.\n- Inefficient space utilization: Without space reclamation, deleted data occupies space, reducing efficiency.',
        categories: [AwsWellArchitecturedPillars.COST_OPTIMIZATION, AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE],
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
        configLevel: 'database',
        globalWadApplicable: true,
        metadata: { linkRequired: true, schedulingSupported: true, bulkFixSupported: true }
    },
    {
        id: 'autosize',
        name: 'Autosize',
        parameter: 'autosize',
        value: 'on',
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'ONTAP',
        severity: SEVERITY.CRITICAL,
        recommendation:
            'To optimize storage efficiency and cost-effectiveness, turn on autosize to automatically increases the size of a volume when it nears full capacity, thus preventing a volume from running out of space and becoming read-only, which can disrupt operations.\n Lack of autosize requires manual monitoring and intervention to manage volume sizes, increasing administrative overhead and the possibility of errors.',
        categories: [AwsWellArchitecturedPillars.COST_OPTIMIZATION, AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE],
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
        configLevel: 'database'
    },
    {
        id: 'autosize-mode',
        name: 'Autosize-mode',
        parameter: 'autosize-mode',
        value: 'grow',
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'ONTAP',
        severity: SEVERITY.WARNING,
        recommendation:
            'Set autosize mode to "grow" to automatically increase volume size when it gets full. If autosize is off, you must monitor and resize volumes manually, which takes more time and increases the risk of mistakes.',
        categories: [AwsWellArchitecturedPillars.COST_OPTIMIZATION, AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE],
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
        configLevel: 'database'
    },
    {
        id: 'snapshot-copy-reserve',
        name: 'Snapshot copy reserve',
        parameter: 'snapshot-copy-reserve',
        value: 0,
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'ONTAP',
        severity: SEVERITY.CRITICAL,
        recommendation:
            'Set the snapshot copy reserve to 0% to use more storage for active file data and reduce costs.',
        categories: [AwsWellArchitecturedPillars.COST_OPTIMIZATION, AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE],
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
        configLevel: 'database'
    },
    {
        id: 'snapshot-autodelete',
        name: 'Snapshot autodelete',
        parameter: 'snapshot-autodelete',
        value: true,
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'ONTAP',
        severity: SEVERITY.WARNING,
        recommendation:
            'Turn on automatic snapshot deletion to remove older snapshots when space runs low, so snapshots do not use space needed for user data.',
        categories: [AwsWellArchitecturedPillars.COST_OPTIMIZATION, AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE],
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
        configLevel: 'database'
    },
    {
        id: 'snapshot-policy',
        name: 'Snapshot policy',
        parameter: 'snapshot-policy',
        value: 'none',
        categories: [
            AwsWellArchitecturedPillars.COST_OPTIMIZATION,
            AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
            AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
        ],
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'ONTAP',
        severity: SEVERITY.WARNING,
        recommended: 'none',
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
        recommendation:
            'Workload Factory recommends disabling snapshots for FSx for ONTAP volumes for MS SQL Server instances to save space and lower costs. MS SQL Server snapshots should be managed externally via tools like SnapCenter, which creates application-consistent snapshots, preventing corruption during restoration.',
        configLevel: 'database',
        globalWadApplicable: true,
        metadata: { linkRequired: true, schedulingSupported: true, bulkFixSupported: true }
    },
    {
        id: 'space-mgmt-try-first',
        name: 'Space management',
        parameter: 'space-mgmt-try-first',
        value: 'volume_grow',
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'ONTAP',
        severity: SEVERITY.WARNING,
        recommendation:
            'When space runs low, try expanding the volume before deleting snapshot copies. This helps prevent "volume full" errors, reduces write failures and app interruptions, and keeps snapshot recovery points for easier, stronger recovery while managing capacity.',
        categories: [AwsWellArchitecturedPillars.COST_OPTIMIZATION, AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE],
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
        configLevel: 'database'
    },
    {
        id: 'tiering-tco-optimization',
        name: 'Cold data tiering',
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'ONTAP',
        severity: SEVERITY.CRITICAL,
        recommendation:
            'For optimal database performance and cost efficiency, Workload Factory recommends using the snapshot-only tiering policy, which moves only snapshot data to the capacity tier while keeping active data on the SSD tier. This approach preserves low-latency performance for SQL workloads while reducing storage costs. Workload Factory recommends tiering snapshot data after a 7-day cooling period.',
        categories: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY, AwsWellArchitecturedPillars.COST_OPTIMIZATION],
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
        components: [
            { parameter: 'tiering-policy', value: 'snapshot_only', source: 'volume' },
            { parameter: 'tiering-min-cooling-days', value: 7, source: 'volume' }
        ],
        configLevel: 'database',
        globalWadApplicable: true,
        metadata: { linkRequired: true, schedulingSupported: true, bulkFixSupported: true }
    },
    {
        id: 'storage-efficiencies',
        name: 'Storage efficiencies',
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'ONTAP',
        severity: SEVERITY.WARNING,
        recommendation:
            'Workload Factory recommends enabling storage efficiencies—deduplication, adaptive compression, and compaction—on volumes used by Microsoft SQL Server to reduce storage footprint, lower costs, and optimize resource utilization while maintaining performance.',
        categories: [
            AwsWellArchitecturedPillars.COST_OPTIMIZATION,
            AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
            AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
        ],
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
        components: [
            {
                parameter: 'compressionType',
                name: OptimizeStorageConfigs.COMPRESSION,
                value: 'adaptive',
                objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME
            },
            {
                parameter: 'deduplication',
                name: OptimizeStorageConfigs.DEDUPLICATION,
                value: 'inline',
                objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME
            },
            {
                parameter: 'compaction',
                name: OptimizeStorageConfigs.COMPACTION,
                value: 'enabled',
                objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME
            }
        ],
        configLevel: 'database',
        globalWadApplicable: true,
        metadata: { linkRequired: true, schedulingSupported: true, bulkFixSupported: true }
    },

    // ── configuration / lun ─────────────────────────────────────────────────
    {
        id: 'os-type',
        name: 'OS type',
        parameter: 'os-type',
        value: 'windows_2008',
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'ONTAP',
        severity: SEVERITY.CRITICAL,
        resourceType: ASSESSMENT_RESOURCE_TYPE.LUN,
        recommendation:
            'ONTAP LUN os type value shall match the operating system partionioning scheme to achieve I/O alignment. Incorrect configuration may result in suboptimal performance',
        categories: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY],
        configLevel: 'database',
        globalWadApplicable: true,
        metadata: { linkRequired: true, schedulingSupported: true, bulkFixSupported: true }
    },
    {
        id: 'block-device-space-management',
        name: 'Block device space management',
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'ONTAP',
        severity: SEVERITY.CRITICAL,
        recommendation:
            'Workload Factory recommends configuring block device space settings for LUNs used by Microsoft SQL server instances to prevent write failures and improve space efficiency on FSx for ONTAP. This configuration applies the recommended combination of settings for thin-provisioned volumes:\n- Space reservation: enabled - reserves enough space in the volume so writes to the LUN do not fail.\n- Space allocation: enabled - allows FSx for ONTAP to notify the EC2 host when a volume is full and supports automatic space reclamation when the database deletes data.\n- Fractional reserve: disabled - avoids unnecessary overwrite reservation, optimizing space utilization and cost effectiveness for thin provisioning.\nTogether, these settings help ensure predictable database behavior while minimizing wasted capacity.',
        categories: [
            AwsWellArchitecturedPillars.RELIABILITY,
            AwsWellArchitecturedPillars.COST_OPTIMIZATION,
            AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE
        ],
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME_OR_LUN,
        components: [
            { parameter: 'space-reservation-enabled', value: true, source: 'lun' },
            { parameter: 'space-allocation-allocated', value: true, source: 'lun' },
            { parameter: 'fractional-reserve', value: 0, source: 'volume' }
        ],
        configLevel: 'database',
        globalWadApplicable: true,
        metadata: { linkRequired: true, schedulingSupported: true, bulkFixSupported: true }
    },

    // ── configuration / os ──────────────────────────────────────────────────
    {
        id: 'mpio-enabled',
        name: 'Multipath I/O status',
        parameter: 'mpio-enabled',
        value: true,
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'Operating system',
        severity: SEVERITY.CRITICAL,
        recommendation:
            'To ensure optimal uptime and data access consistency for MSSQL databases on EC2 with underlying LUNs provisioned in FSx for ONTAP, it is recommended to enable and configure Multipath I/O (MPIO). MPIO provides multiple paths to FSx for ONTAP, enhancing both resiliency and performance. This best practice protects against potential data loss or downtime by maintaining data access even if a component fails.',
        categories: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY, AwsWellArchitecturedPillars.RELIABILITY],
        resourceType: ASSESSMENT_RESOURCE_TYPE.STORAGE_MULTIPATH,
        configLevel: 'database'
    },
    {
        id: 'mpio-load-balance-policy',
        name: 'Multipath I/O policy',
        parameter: 'mpio-load-balance-policy',
        value: 'RR',
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'Operating system',
        severity: SEVERITY.WARNING,
        recommendation:
            'To ensure optimal uptime and data access consistency for MSSQL databases on EC2 with underlying LUNs provisioned in FSx for ONTAP, it is recommended to enable and configure Multipath I/O (MPIO). MPIO provides multiple paths to FSx for ONTAP, enhancing both resiliency and performance. This best practice protects against potential data loss or downtime by maintaining data access even if a component fails.',
        categories: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY, AwsWellArchitecturedPillars.RELIABILITY],
        resourceType: ASSESSMENT_RESOURCE_TYPE.DRIVE,
        configLevel: 'database'
    },
    {
        id: 'mpio-iscsi-count',
        name: 'Multipath I/O sessions',
        parameter: 'mpio-iscsi-count',
        value: '5',
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'Operating system',
        severity: SEVERITY.CRITICAL,
        recommendation:
            'For SQL Server on FSx for ONTAP iSCSI LUNs, use five multipath IO (MPIO) sessions per target interface. This balances traffic across paths and improves redundancy, throughput, and failover',
        categories: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY, AwsWellArchitecturedPillars.RELIABILITY],
        resourceType: ASSESSMENT_RESOURCE_TYPE.STORAGE_MULTIPATH,
        configLevel: 'database'
    },
    {
        id: 'ntfs-allocation-unit-size',
        name: 'NTFS allocation unit size',
        parameter: 'ntfs-allocation-unit-size',
        value: 65536,
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'Operating system',
        severity: SEVERITY.WARNING,
        recommendation:
            'Set NTFS allocation unit size to 64K to better utilize disk space, reduce fragmentation, and improve file read/write performance. Failure to configure this properly may lead to inefficient disk usage and degraded performance.',
        categories: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY],
        resourceType: ASSESSMENT_RESOURCE_TYPE.DRIVE,
        configLevel: 'database'
    },
    {
        id: 'mpio-timeout',
        name: 'Multipath I/O timeout',
        parameter: 'mpio-timeout',
        value: DEFAULT_MPIO_TIMEOUT,
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'Operating system',
        severity: SEVERITY.WARNING,
        recommendation:
            'Ensure the Multipath I/O Timeout setting on the host is configured to 60 seconds to maintain connectivity and stability during FSxN failovers. Properly configured Multipath I/O Timeout settings prevent disconnections from the disk, which can occur during FSX failovers. Insufficient timeout settings can lead to temporary disconnections, application errors, and potential data loss.',
        categories: [AwsWellArchitecturedPillars.RELIABILITY],
        resourceType: ASSESSMENT_RESOURCE_TYPE.STORAGE_MULTIPATH,
        configLevel: 'database'
    },

    // ── layout ───────────────────────────────────────────────────────────────
    {
        id: 'data-files-location',
        name: 'Data files (.mdf) placement',
        parameter: 'default-data-files-location',
        value: 'separate-drive',
        type: 'storage',
        subType: 'layout',
        focusWidgetName: 'Data files (.mdf)',
        severity: SEVERITY.CRITICAL,
        recommendation:
            'Separating data and log files onto different drives improves performance by allowing simultaneous I/O activity',
        categories: [
            AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY,
            AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE
        ],
        resourceType: ASSESSMENT_RESOURCE_TYPE.DATABASE,
        configLevel: 'database'
    },
    {
        id: 'log-files-location',
        name: 'Log files (.ldf) placement',
        parameter: 'default-log-files-location',
        value: 'separate-drive',
        type: 'storage',
        subType: 'layout',
        focusWidgetName: 'Log Files (.ldf)',
        severity: SEVERITY.CRITICAL,
        recommendation:
            'Separating data and log files onto different drives improves performance by allowing simultaneous I/O activity',
        categories: [
            AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY,
            AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE
        ],
        resourceType: ASSESSMENT_RESOURCE_TYPE.DATABASE,
        configLevel: 'database'
    },
    {
        id: 'tempdb-files-location',
        name: 'TempDB placement',
        parameter: 'tempdb-files-location',
        value: 'separate-drive',
        type: 'storage',
        subType: 'layout',
        focusWidgetName: 'TempDB placement',
        severity: SEVERITY.CRITICAL,
        recommendation:
            'Isolate TempDB I/O and avoid I/O contention from other databases by placing TempDB on its own dedicated drive. This optimization improves overall SQL Server performance and stability.Failure to do so can result in significant I/O bottlenecks, slower query performance, and potential system instability.',
        categories: [
            AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY,
            AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE
        ],
        resourceType: ASSESSMENT_RESOURCE_TYPE.DATABASE,
        configLevel: 'database'
    },

    // ── sizing ───────────────────────────────────────────────────────────────
    {
        id: 'performance-tier',
        name: 'Storage tier',
        parameter: 'performance-tier',
        value: '100%',
        type: 'storage',
        subType: 'sizing',
        focusWidgetName: 'Storage tier',
        severity: SEVERITY.CRITICAL,
        recommendation:
            'For optimal storage performance, provision FSx for ONTAP volumes on the primary SSD tier.\nUsing the capacity pool tier may result in slower performance and higher latency.',
        categories: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY],
        configLevel: 'database'
    },
    {
        id: 'headroom',
        name: 'File system headroom',
        parameter: 'headroom',
        value: `${MIN_OPTIMIZED_HEADROOM_PERCENTAGE.MSSQL}%`,
        type: 'storage',
        subType: 'sizing',
        focusWidgetName: 'File system headroom',
        severity: SEVERITY.CRITICAL,
        recommendation:
            'To optimize storage performance, provision file system capacity as 1.35 times of total size of provisioned volume.',
        categories: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY],
        resourceType: ASSESSMENT_RESOURCE_TYPE.FILE_SYSTEM,
        configLevel: 'database',
        globalWadApplicable: true
    },
    {
        id: 'log-drive-size',
        name: 'Log drive size',
        parameter: 'log-drive-size',
        value: '25%',
        type: 'storage',
        subType: 'sizing',
        focusWidgetName: 'Log drive size',
        severity: SEVERITY.WARNING,
        recommendation:
            'Ensure accurate sizing and regular monitoring of the SQL Server log drive to prevent issues such as transaction rollbacks, \ndatabase unavailability, data corruption, and performance degradation caused by a full log drive.\nAn additional 20% buffer is required if the drive is hosting a primary replica of Always On Availability Group.',
        categories: [AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE],
        configLevel: 'database'
    },
    {
        id: 'tempdb-drive-size',
        name: 'TempDB drive size',
        parameter: 'tempdb-drive-size',
        value: '10%',
        type: 'storage',
        subType: 'sizing',
        focusWidgetName: 'TempDB drive size',
        severity: SEVERITY.WARNING,
        recommendation:
            'Ensure accurate sizing and regular monitoring of the SQL Server TempDB to well-architect performance and maintain overall stability.\nProperly configured TempDB prevents performance issues and instability. Insufficient space or high contention can lead to query slowdowns, application timeouts, and system crashes.',
        categories: [AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE],
        configLevel: 'database'
    },

    // ── compute ──────────────────────────────────────────────────────────────
    {
        id: 'mtu-alignment',
        name: 'MTU alignment',
        status: AssessmentStatus.OPTIMIZED,
        recommended: AssessmentStatus.OPTIMIZED,
        type: 'compute',
        subType: 'compute',
        focusWidgetName: 'MTU alignment',
        severity: SEVERITY.CRITICAL,
        recommendation:
            'Workload Factory recommends aligning EC2 instance Maximum Transmission Unit (MTU) settings with your \nFSx for ONTAP file system to prevent network fragmentation and optimize SQL Server performance. \nFixing MTU misalignment ensures consistent MTU configuration across all nodes and network paths.',
        categories: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY, AwsWellArchitecturedPillars.RELIABILITY],
        resourceType: ASSESSMENT_RESOURCE_TYPE.NETWORK_INTERFACE,
        configLevel: 'host'
    },
    {
        id: 'host-os-patch',
        name: 'Operating system patch',
        categories: [AwsWellArchitecturedPillars.SECURITY, AwsWellArchitecturedPillars.RELIABILITY],
        type: 'compute',
        subType: 'compute',
        focusWidgetName: 'Operating system patch',
        severity: SEVERITY.CRITICAL,
        resourceType: ASSESSMENT_RESOURCE_TYPE.INSTANCE,
        recommendation:
            'Critical security patches are missing. We recommend applying the latest patches to ensure your database infrastructure is secure and up-to-date.',
        configLevel: 'host'
    },
    {
        id: 'rss-config',
        name: 'Network adapter settings',
        categories: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY],
        type: 'compute',
        subType: 'compute',
        focusWidgetName: 'Network adapter settings',
        severity: SEVERITY.WARNING,
        resourceType: ASSESSMENT_RESOURCE_TYPE.NETWORK_ADAPTER,
        recommendation:
            'To enhance network performance and system efficiency for your SQL Server EC2 instance, we recommend optimizing your Receive Side Scaling (RSS) configuration. Proper RSS settings distribute network processing across multiple processors, reducing latency and improving application responsiveness. Adhering to best practices ensures efficient handling of network traffic, leading to better stability and reliability.',
        configLevel: 'host'
    },
    {
        id: 'compute-rightsizing',
        name: 'Compute rightsizing',
        type: 'compute',
        subType: 'compute',
        focusWidgetName: 'Compute rightsizing',
        severity: SEVERITY.WARNING,
        resourceType: ASSESSMENT_RESOURCE_TYPE.INSTANCE,
        categories: [AwsWellArchitecturedPillars.COST_OPTIMIZATION, AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY],
        recommendation:
            'To ensure optimal performance and cost efficiency for your SQL Server EC2 instance, right-size your EC2 instance to match the workload requirements of your SQL Server database.',
        configLevel: 'host'
    },

    // ── resiliency ───────────────────────────────────────────────────────────
    {
        id: 'backup-configuration',
        name: 'Backup configuration',
        categories: [AwsWellArchitecturedPillars.RELIABILITY],
        type: 'resiliency',
        subType: 'resiliency',
        focusWidgetName: 'Backup Configuration',
        severity: SEVERITY.WARNING,
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
        recommendation:
            'Enable FSx Backup or AWS Backup for SQL Server volumes to support data retention and compliance. \nIf using both, consider removing redundant backups manually.',
        configLevel: 'host'
    },
    {
        id: 'crr',
        name: 'Cross-region replication (CRR)',
        categories: [AwsWellArchitecturedPillars.RELIABILITY],
        type: 'resiliency',
        subType: 'resiliency',
        focusWidgetName: 'Cross-Region Replication (CRR)',
        severity: SEVERITY.WARNING,
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
        recommendation:
            'Workload Factory recommends enabling Cross-Region Replication (CRR) for your FSx for ONTAP filesystems. CRR ensures that your data is replicated to another AWS region, providing enhanced data durability and availability.',
        configLevel: 'database'
    },
    {
        id: 'snapcenter-snapshot',
        name: 'Application-consistent snapshots',
        categories: [AwsWellArchitecturedPillars.RELIABILITY],
        type: 'resiliency',
        subType: 'protection',
        focusWidgetName: 'Application-Consistent Snapshots',
        severity: SEVERITY.WARNING,
        recommended: AssessmentStatus.OPTIMIZED,
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
        recommendation:
            'Use application-consistent snapshots with NetApp SnapCenter to take accurate, reliable snapshots of your volume data at a specific moment in time. This keeps your apps running smoothly and your data safe. SnapCenter makes backups easier and helps you restore data quickly and correctly, reducing downtime and protecting your most important workloads.',
        configLevel: 'database',
        globalWadApplicable: true,
        metadata: { linkRequired: true, schedulingSupported: true, bulkFixSupported: true }
    },

    // ── resiliency / highAvailability ────────────────────────────────────────
    {
        id: 'shared-storage',
        name: 'Shared storage',
        parameter: 'shared-storage',
        value: true,
        type: 'resiliency',
        subType: 'highAvailability',
        focusWidgetName: 'Microsoft SQL Server High Availability',
        severity: SEVERITY.CRITICAL,
        categories: [AwsWellArchitecturedPillars.RELIABILITY],
        resourceType: ASSESSMENT_RESOURCE_TYPE.LUN,
        recommendation:
            'All shared disks (iSCSI LUNs) must be accessible by both nodes in the FCI deployment model to allow failover.',
        recommended: '',
        configLevel: 'database'
    },
    {
        id: 'drive-letter',
        name: 'Drive letter',
        parameter: 'drive-letter-consistency',
        value: true,
        type: 'resiliency',
        subType: 'highAvailability',
        focusWidgetName: 'Microsoft SQL Server High Availability',
        severity: SEVERITY.CRITICAL,
        categories: [AwsWellArchitecturedPillars.RELIABILITY],
        resourceType: ASSESSMENT_RESOURCE_TYPE.DRIVE,
        recommendation: 'Validate availability of the same drive letters on the secondary node.',
        recommended: '',
        configLevel: 'database'
    },
    {
        id: 'cluster-quorum',
        name: 'Cluster quorum',
        parameter: 'cluster-quorum-configuration',
        value: 'majority',
        type: 'resiliency',
        subType: 'highAvailability',
        focusWidgetName: 'Microsoft SQL Server High Availability',
        severity: SEVERITY.CRITICAL,
        categories: [AwsWellArchitecturedPillars.RELIABILITY],
        resourceType: ASSESSMENT_RESOURCE_TYPE.WINDOWS_CLUSTER,
        recommendation:
            'The quorum configuration should be tailored to a 2-node Windows Failover Cluster, using Node and Disk Majority with a Disk Witness to ensure high availability.',
        recommended: '',
        configLevel: 'host'
    },
    {
        id: 'heartbeat-settings',
        name: 'Heartbeat settings',
        parameter: 'cluster-heartbeat-interval',
        value: 1000,
        type: 'resiliency',
        subType: 'highAvailability',
        focusWidgetName: 'Microsoft SQL Server High Availability',
        severity: SEVERITY.CRITICAL,
        categories: [AwsWellArchitecturedPillars.RELIABILITY],
        resourceType: ASSESSMENT_RESOURCE_TYPE.INSTANCE,
        recommendation:
            'Set heartbeat thresholds to 40 heartbeats, specifically optimized for cloud deployments, to ensure high availability and prevent unnecessary failovers.',
        recommended: '',
        configLevel: 'host'
    },
    {
        id: 'sql-server-service',
        name: 'SQL server service',
        parameter: 'sql-server-service-recovery',
        value: 'automatic',
        type: 'resiliency',
        subType: 'highAvailability',
        focusWidgetName: 'Microsoft SQL Server High Availability',
        severity: SEVERITY.CRITICAL,
        categories: [AwsWellArchitecturedPillars.RELIABILITY],
        resourceType: ASSESSMENT_RESOURCE_TYPE.INSTANCE,
        recommendation: 'SQL Server service must be configured for automatic failover and startup.',
        recommended: '',
        configLevel: 'database'
    },

    // ── application ──────────────────────────────────────────────────────────
    {
        id: 'sql-license',
        name: 'License',
        categories: [AwsWellArchitecturedPillars.COST_OPTIMIZATION],
        type: 'application',
        subType: 'application',
        focusWidgetName: 'License',
        severity: SEVERITY.WARNING,
        resourceType: ASSESSMENT_RESOURCE_TYPE.INSTANCE,
        recommendation:
            'The SQL Server license assessment is at the host level. If any instance running on the host is not using the Enterprise license features, the license is considered not optimized.',
        configLevel: 'host'
    },
    {
        id: 'maxdop',
        name: 'MAXDOP',
        categories: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY],
        type: 'application',
        subType: 'application',
        focusWidgetName: 'MAXDOP',
        severity: SEVERITY.WARNING,
        resourceType: ASSESSMENT_RESOURCE_TYPE.SQL_INSTANCE,
        recommendation:
            'For optimal performance, it is recommended to set max degree of parallelism (MAXDOP) to 4 if the number of virtual CPUs is less than or equal to 8, 8 if the number of vCPUs is between 9 and 16, and 16 if the number of vCPUs is greater than 16. Your current settings are not optimized.',
        configLevel: 'database'
    },
    {
        id: 'mssql-patch',
        name: 'Microsoft SQL server patch',
        categories: [AwsWellArchitecturedPillars.SECURITY, AwsWellArchitecturedPillars.RELIABILITY],
        type: 'application',
        subType: 'application',
        focusWidgetName: 'Microsoft SQL Server patch',
        severity: SEVERITY.CRITICAL,
        resourceType: ASSESSMENT_RESOURCE_TYPE.SQL_INSTANCE,
        recommendation:
            'Critical (criticalPatchesCount) and important (importantPatchesCount) patches are missing. We recommend applying the latest patches to ensure your MSSQL instance is secure and up-to-date.',
        configLevel: 'database'
    },

    // ── cloning ──────────────────────────────────────────────────────────────
    {
        id: 'clone-management',
        name: 'Clone cleanup',
        categories: [AwsWellArchitecturedPillars.COST_EFFICIENCY],
        type: 'cloning',
        subType: 'cloning',
        focusWidgetName: 'Clone cleanup',
        severity: SEVERITY.WARNING,
        resourceType: ASSESSMENT_RESOURCE_TYPE.DATABASE,
        recommendation:
            'Old and divergent clones can incur significant costs. Consider deleting or refreshing these clones to optimize your storage expenses.',
        configLevel: 'database'
    }
];

export { MSSQL_HEARTBEAT_SETTINGS, MSSQL_GOLDEN_CONFIG };
