import {
    ASSESSMENT_RESOURCE_TYPE,
    AssessmentStatus,
    AwsWellArchitecturedPillars,
    SEVERITY
} from '../../../utils/continous-optimization-consts';
import type { GoldenConfigEntry } from '../assessment-utils';

const ORACLE_GOLDEN_CONFIG: GoldenConfigEntry[] = [
    // ── configuration / volume ──────────────────────────────────────────────
    {
        parameter: 'spaceGuarantee',
        id: 'thin-provision',
        name: 'Thin Provisioning',
        value: 'none',
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'ONTAP',
        severity: SEVERITY.WARNING,
        recommendation:
            'Workload Factory recommends configuring thin provisioning for FSx for ONTAP volumes hosting Oracle databases. This approach optimizes storage efficiency and cost-effectiveness by allowing more logical data to be stored than physically available.',
        categories: [
            AwsWellArchitecturedPillars.COST_OPTIMIZATION,
            AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
            AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
        ],
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
        configLevel: 'database'
    },
    {
        parameter: 'autosize',
        id: 'autosize',
        name: 'Autosize',
        value: 'on',
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'ONTAP',
        severity: SEVERITY.CRITICAL,
        recommendation:
            'Workload Factory recommends enabling volume autogrow for FSx for ONTAP volumes for Oracle databases. This configuration enhances flexibility, availability, and scalability for Oracle databases by allowing volumes to grow dynamically to accommodate unexpected data growth, preventing space shortages and avoiding downtime if a volume runs out of space. Volume autogrow is essential when using thin provisioning.',
        categories: [
            AwsWellArchitecturedPillars.COST_OPTIMIZATION,
            AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
            AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
        ],
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
        configLevel: 'database'
    },
    {
        parameter: 'autosizeMode',
        id: 'autosize-mode',
        name: 'Autosize Mode',
        value: 'grow',
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'ONTAP',
        severity: SEVERITY.CRITICAL,
        recommendation:
            'Workload Factory recommends enabling volume autogrow for FSx for ONTAP volumes for Oracle databases. This configuration enhances flexibility and availability by allowing volumes to grow dynamically to accommodate unexpected data growth. This prevents space shortages and helps avoid downtime if a volume runs out of space, ensuring seamless scalability for Oracle databases. Volume autogrow is essential when using thin provisioning.',
        categories: [
            AwsWellArchitecturedPillars.COST_OPTIMIZATION,
            AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
            AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
        ],
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
        configLevel: 'database'
    },
    {
        parameter: 'snapshotPolicy',
        id: 'snapshot-policy',
        name: 'Scheduled Local Snapshots',
        value: 'none',
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'ONTAP',
        severity: SEVERITY.WARNING,
        recommendation:
            'Workload Factory recommends disabling snapshots for FSx for ONTAP volumes for Oracle databases to save space and lower costs. Oracle snapshots should be managed externally via tools like SnapCenter, which creates application-consistent snapshots, preventing corruption during restoration.',
        categories: [
            AwsWellArchitecturedPillars.COST_OPTIMIZATION,
            AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
            AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
        ],
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
        configLevel: 'database'
    },
    {
        parameter: 'snapshotCopyReserve',
        id: 'snapshot-copy-reserve',
        name: 'Snapshot Copy Reserve',
        value: 0,
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'ONTAP',
        severity: SEVERITY.WARNING,
        recommendation:
            'Workload Factory recommends that capacity isnt reserved for snapshots on FSx for ONTAP volumes used by databases, making the entire volume capacity available for active data and any snapshots that are created.',
        categories: [
            AwsWellArchitecturedPillars.COST_OPTIMIZATION,
            AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
            AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
        ],
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
        configLevel: 'database'
    },
    {
        parameter: 'snapshotAutodelete',
        id: 'snapshot-autodelete',
        name: 'Snapshot Autodelete',
        value: true,
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'ONTAP',
        severity: SEVERITY.WARNING,
        recommendation:
            'Workload Factory recommends configuring the snapshot autodelete feature in FSx for ONTAP for Oracle databases to delete older snapshots first. This feature is designed to automatically manage snapshot storage by deleting the oldest snapshots when a volume approaches its capacity limit. This configuration helps in thin-provisioned environments, where more logical storage is allocated than physically available.',
        categories: [
            AwsWellArchitecturedPillars.COST_OPTIMIZATION,
            AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
            AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
        ],
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
        configLevel: 'database'
    },
    {
        parameter: 'spaceMgmtTryFirst',
        id: 'space-mgmt-try-first',
        name: 'Space Management',
        value: 'volume_grow',
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'ONTAP',
        severity: SEVERITY.WARNING,
        recommendation:
            'Workload Factory recommends configuring space management to prioritize volume expansion over snapshot deletion for thin-provisioned FSx for ONTAP volumes with volume autogrow enabled.',
        categories: [
            AwsWellArchitecturedPillars.COST_OPTIMIZATION,
            AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
            AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
        ],
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
        configLevel: 'database'
    },
    {
        id: 'storage-efficiencies',
        name: 'Storage Efficiencies',
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'ONTAP',
        severity: SEVERITY.WARNING,
        recommendation:
            'Workload Factory recommends implementing storage efficiencies (compression, compaction, and deduplication) in NetApp ONTAP for Oracle database environments to significantly reduce storage footprint, lower costs, and optimize resource utilization while maintaining performance. Tailored settings for each volume type ensure alignment with Oracle I/O patterns: Data and archive Volumes benefit from inline adaptive compression (8KB), compaction and deduplication while Redo Log Volumes prioritize performance with minimal savings from these features.',
        categories: [
            AwsWellArchitecturedPillars.COST_OPTIMIZATION,
            AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
            AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
        ],
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
        components: [
            {
                parameter: 'compressionType',
                name: 'compression',
                value: '',
                objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME
            },
            {
                parameter: 'deduplication',
                name: 'deduplication',
                value: '',
                objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME
            },
            {
                parameter: 'compaction',
                name: 'compaction',
                value: 'enabled',
                objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME
            }
        ],
        configLevel: 'database'
    },
    {
        id: 'tiering-tco-optimization',
        name: 'Tiering / TCO Optimization',
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'ONTAP',
        severity: SEVERITY.CRITICAL,
        recommendation:
            'Workload Factory recommends enabling tiering for some Oracle database volumes on Amazon FSx for NetApp ONTAP where appropriate, to move cold data to lower-cost capacity storage and reduce overall storage costs, while keeping active database data on high-performance SSDs to preserve critical performance. Recommended policies are based on the data type in each volume, with tiering disabled (none) for data files and redo logs, and auto for archive logs. For archive/FRA volumes, it is also recommended to set an appropriate cooling period before data is tiered—typically 2 days for compressed backups and 14 days for uncompressed backups—to balance cost efficiency and performance.',
        categories: [
            AwsWellArchitecturedPillars.COST_OPTIMIZATION,
            AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
            AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
        ],
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
        components: [
            {
                parameter: 'tieringPolicy',
                name: 'tiering-policy',
                value: '',
                objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME
            },
            {
                parameter: 'tieringMinCoolingDays',
                name: 'tiering-min-cooling-days',
                value: '',
                objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME
            }
        ],
        configLevel: 'database'
    },

    // ── configuration / volume_nfs (applicableTo: nfs) ──────────────────────
    {
        parameter: 'nfs-rootonly',
        id: 'nfs-rootonly',
        name: 'NFS Root Only',
        value: 'disabled',
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'ONTAP',
        severity: SEVERITY.CRITICAL,
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
        recommendation:
            'Workload Factory recommends disabling the nfs-rootonly parameter for dNFS. ONTAPs nfs-rootonly setting restricts NFS connections to privileged ports (<1024). Since dNFS processes in NFSv4+ do not run as root and use higher ports, disabling this parameter allows necessary connections.',
        categories: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY, AwsWellArchitecturedPillars.RELIABILITY],
        applicableTo: 'nfs',
        configLevel: 'database'
    },
    {
        parameter: 'export-policy',
        id: 'export-policy',
        name: 'Export Policy',
        value: 'superuser: sys, allow_suid: true',
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'ONTAP',
        severity: SEVERITY.CRITICAL,
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
        recommendation:
            'Workload Factory recommends ensuring that if Oracle binaries are located on an NFS share, the export policy includes superuser and setuid permissions.Superuser (root) access allows NFS clients to map as root, needed for binary execution.',
        categories: [
            AwsWellArchitecturedPillars.SECURITY,
            AwsWellArchitecturedPillars.RELIABILITY,
            AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE
        ],
        applicableTo: 'nfs',
        configLevel: 'database'
    },

    // ── configuration / volume_or_lun (applicableTo: iscsi) ────────────────
    {
        id: 'block-device-space-management',
        name: 'Block Device Space Management',
        type: 'storage',
        subType: 'configuration',
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME_OR_LUN,
        focusWidgetName: 'ONTAP',
        severity: SEVERITY.CRITICAL,
        recommendation:
            'Workload Factory recommends configuring block device space settings for LUNs used by Oracle database instances to prevent write failures and improve space efficiency on FSx for ONTAP. This configuration applies the recommended combination of settings for thin-provisioned volumes:\n- Space reservation: enabled - reserves enough space in the volume so writes to the LUN do not fail.\n- Space allocation: enabled - allows FSx for ONTAP to notify the EC2 host when a volume is full and supports automatic space reclamation when the database deletes data.\n- Fractional reserve: disabled - avoids unnecessary overwrite reservation, optimizing space utilization and cost effectiveness for thin provisioning.\nTogether, these settings help ensure predictable database behavior while minimizing wasted capacity.',
        categories: [
            AwsWellArchitecturedPillars.COST_OPTIMIZATION,
            AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
            AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
        ],
        applicableTo: 'iscsi',
        components: [
            { parameter: 'spaceReservationEnabled', name: 'space-reservation-enabled', value: true, source: 'lun' },
            { parameter: 'spaceAllocationAllocated', name: 'space-allocation-allocated', value: true, source: 'lun' },
            { parameter: 'fractionalReserve', name: 'fractional-reserve', value: 0, source: 'volume' }
        ],
        configLevel: 'database'
    },

    // ── configuration / os_iscsi (applicableTo: iscsi) ─────────────────────
    {
        parameter: 'multipath-io',
        id: 'multipath-io',
        name: 'Multipath I/O Status',
        recommended: 'enabled',
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'Operating system',
        severity: SEVERITY.CRITICAL,
        resourceType: 'EC2 Instance',
        recommendation:
            'Workload Factory recommends enabling Multipath I/O (MPIO) on database hosts that connect to ISCSI LUNs for Oracle databases. This host-level configuration enhances storage reliability and performance by providing redundant data paths between the server and storage. With multipath enabled, the system can automatically reroute I/O operations in the event of a path failure, minimizing downtime and ensuring consistent access to critical data.',
        categories: [AwsWellArchitecturedPillars.RELIABILITY, AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE],
        applicableTo: 'iscsi',
        configLevel: 'database'
    },
    {
        parameter: 'host-utilities',
        id: 'host-utilities',
        name: 'Host Utilities',
        recommended: 'installed',
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'Operating system',
        severity: SEVERITY.WARNING,
        resourceType: 'EC2 Instance',
        recommendation:
            'Workload Factory recommends installing host utilities for LUN and multipath management on systems hosting Oracle databases. These utilities ensure optimal compatibility, performance, and reliability when connecting to enterprise storage systems. Proper installation of host utilities helps streamline storage operations and supports best practices for Oracle deployments.',
        categories: [AwsWellArchitecturedPillars.RELIABILITY, AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE],
        applicableTo: 'iscsi',
        configLevel: 'database'
    },
    {
        parameter: 'multipath-io-sessions',
        id: 'multipath-io-sessions',
        name: 'Multipath I/O Sessions',
        recommended: '4',
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'Operating system',
        severity: SEVERITY.WARNING,
        resourceType: 'EC2 Instance',
        recommendation:
            'Workload Factory recommends configuring host with four iSCSI sessions to each FSx ONTAP iSCSI endpoint in order to fully leverage multipath I/O',
        categories: [AwsWellArchitecturedPillars.RELIABILITY, AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY],
        applicableTo: 'iscsi',
        configLevel: 'database'
    },
    {
        parameter: 'transparent-hugepages',
        id: 'transparent-hugepages',
        name: 'Transparent Hugepages',
        recommended: 'disabled',
        type: 'compute',
        subType: 'configuration',
        focusWidgetName: 'Operating system',
        severity: SEVERITY.WARNING,
        resourceType: 'EC2 Instance',
        recommendation:
            'Workload Factory recommends disabling Transparent HugePages (THP) on database hosts running Oracle databases. \nDisabling THP is an Oracle best practice to prevent potential performance issues and ensure optimal database stability.',
        categories: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY],
        applicableTo: 'iscsi',
        configLevel: 'database'
    },
    {
        parameter: 'iscsi-replacement-timeout',
        id: 'iscsi-replacement-timeout',
        name: 'iSCSI Replacement Timeout',
        recommended: '5',
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'Operating system',
        severity: SEVERITY.CRITICAL,
        resourceType: 'EC2 Instance',
        recommendation:
            'Workload Factory recommends setting node.session.timeo.replacement_timeout = 5 in /etc/iscsi/iscsid.conf for Oracle database hosts using multipath I/O. This adjustment reduces the time required to detect and recover from iSCSI path failures, ensuring that database operations remain highly available and responsive. After applying this change and restarting the iSCSI service, the host will be able to fail over to alternate paths within 5 seconds of a path failure, minimizing the risk of application downtime.',
        categories: [AwsWellArchitecturedPillars.RELIABILITY, AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY],
        applicableTo: 'iscsi',
        configLevel: 'database'
    },
    {
        parameter: 'multipath-friendly-names',
        id: 'multipath-friendly-names',
        name: 'Multipath Friendly Names',
        recommended: 'enabled',
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'Operating system',
        severity: SEVERITY.WARNING,
        resourceType: 'EC2 Instance',
        recommendation:
            'Workload Factory recommends enabling Multipath Friendly Names in the multipath configuration for Oracle database hosts. This setting simplifies device identification by assigning human-readable names to multipath devices, making storage management and troubleshooting more efficient and reducing the risk of configuration errors.',
        categories: [AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE],
        applicableTo: 'iscsi',
        configLevel: 'database'
    },
    {
        parameter: 'tcp-advanced-options',
        id: 'tcp-advanced-options',
        name: 'TCP Advanced Options',
        recommended: 'enabled',
        type: 'compute',
        subType: 'configuration',
        focusWidgetName: 'Operating system',
        severity: SEVERITY.WARNING,
        resourceType: 'EC2 Instance',
        recommendation: 'Workload Factory recommends enabling TCP features such as TCP window scaling',
        categories: [AwsWellArchitecturedPillars.RELIABILITY, AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY],
        applicableTo: 'iscsi',
        configLevel: 'database'
    },
    {
        parameter: 'filesystems-io-options',
        id: 'filesystems-io-options',
        name: 'Filesystems I/O Options',
        recommended: 'setall',
        type: 'compute',
        subType: 'configuration',
        focusWidgetName: 'Operating system',
        severity: SEVERITY.WARNING,
        resourceType: 'EC2 Instance',
        recommendation:
            'Workload Factory recommends setting filesystemio_options = setall for optimal I/O performance. \nAdjust SGA size if needed when moving away from buffered I/O.',
        categories: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY],
        applicableTo: 'iscsi',
        configLevel: 'database'
    },
    {
        parameter: 'multiblock-readcount',
        id: 'multiblock-readcount',
        name: 'Multiblock Read Count',
        recommended: 'disabled',
        type: 'compute',
        subType: 'configuration',
        focusWidgetName: 'Operating system',
        severity: SEVERITY.WARNING,
        resourceType: 'EC2 Instance',
        recommendation:
            'Workload Factory recommends removing db_file_multiblock_read_count from init.ora to prevent performance issues and allow Oracle to manage this setting automatically.',
        categories: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY],
        applicableTo: 'iscsi',
        configLevel: 'database'
    },
    {
        parameter: 'multipath-configuration',
        id: 'multipath-configuration',
        name: 'Multipath Configuration',
        recommended: '',
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'Operating system',
        severity: SEVERITY.CRITICAL,
        resourceType: 'EC2 Instance',
        recommendation:
            'Workload Factory strongly recommends that the multipath configuration file (/etc/multipath.conf) be properly configured with NetApp recommended settings for ONTAP LUNs, as this is critical for reliable path management, optimal performance, and compatibility with ONTAP storage systems. In addition, installing the Device Mapper Multipath package on all database hosts that connect to ONTAP storage via iSCSI enables multipath I/O, providing redundancy, failover, and resilient storage connectivity for Oracle databases. This combined approach ensures robust and dependable integration with ONTAP storage.',
        categories: [AwsWellArchitecturedPillars.RELIABILITY, AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE],
        applicableTo: 'iscsi',
        configLevel: 'database'
    },

    // ── configuration / asmOS ──────────────────────────────────────────────
    {
        parameter: 'asm-setup',
        id: 'asm-setup',
        name: 'ASM Setup',
        recommended: '',
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'Operating system',
        severity: SEVERITY.WARNING,
        resourceType: 'EC2 Instance',
        recommendation:
            'Workload Factory recommends using Oracle Automatic Storage Management (ASM) for iSCSI-based storage, such as FSx for NetApp ONTAP, to optimize performance, simplify storage management, and enhance scalability for Oracle Database deployments.',
        categories: [AwsWellArchitecturedPillars.RELIABILITY, AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY],
        applicableTo: 'asm',
        configLevel: 'database'
    },
    {
        parameter: 'asm-external-redundancy',
        id: 'asm-external-redundancy',
        name: 'ASM External Redundancy',
        recommended: '',
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'Operating system',
        severity: SEVERITY.WARNING,
        resourceType: 'ASM Disk Group',
        recommendation:
            'Workload Factory recommends configuring Oracle ASM disk groups with External Redundancy for FSxN iSCSI LUNs to leverage FSxN\u2019s built-in high availability, optimize storage efficiency, and reduce costs by avoiding Oracle-level data mirroring.',
        categories: [AwsWellArchitecturedPillars.COST_EFFICIENCY, AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY],
        applicableTo: 'asm',
        configLevel: 'database'
    },
    {
        parameter: 'afd-logical-block-size',
        id: 'afd-logical-block-size',
        name: 'AFD Logical Block Size',
        recommended: '1',
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'Operating system',
        severity: SEVERITY.CRITICAL,
        resourceType: 'EC2 Instance',
        recommendation:
            'Workload Factory recommends configuring the Oracle ASM Filter Driver (AFD) to use the logical block size of the underlying FSx for NetApp ONTAP. This ensures that AFD aligns I/O operations with the storage\u2019s block size, optimizing performance by minimizing latency and reducing unnecessary I/O overhead.',
        categories: [AwsWellArchitecturedPillars.RELIABILITY, AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY],
        applicableTo: 'asm',
        configLevel: 'database'
    },
    {
        parameter: 'asmlib-logical-block-size',
        id: 'asmlib-logical-block-size',
        name: 'ASMLIB Logical Block Size',
        recommended: 'true',
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'Operating system',
        severity: SEVERITY.CRITICAL,
        resourceType: 'EC2 Instance',
        recommendation:
            'Workload Factory recommends configuring Oracle ASMLib to use the logical block size of the underlying FSx for NetApp ONTAP, by setting the appropriate option in the ASMLib configuration file. This ensures that ASMLib aligns I/O operations with the storage\u2019s block size, optimizing performance by minimizing latency and reducing unnecessary I/O overhead.',
        categories: [AwsWellArchitecturedPillars.RELIABILITY, AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY],
        applicableTo: 'asm',
        configLevel: 'database'
    },

    // ── configuration / os_nfs (applicableTo: nfs) ──────────────────────────
    {
        parameter: 'kernel-parameters',
        id: 'kernel-parameters',
        name: 'Kernel Parameters',
        recommended: '',
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'Operating system',
        severity: SEVERITY.CRITICAL,
        resourceType: 'EC2 Instance',
        recommendation:
            'Workload Factory recommends configuring the kernel parameters for the TCP slot table to 128, optimized specifically for Oracle workloads.',
        categories: [AwsWellArchitecturedPillars.RELIABILITY, AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY],
        applicableTo: 'nfs',
        configLevel: 'database'
    },
    {
        parameter: 'nfs-mount-options-databasefiles',
        id: 'nfs-mount-options-databasefiles',
        name: 'NFS Mount Options (Database Files)',
        recommended: '',
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'Operating system',
        severity: SEVERITY.WARNING,
        resourceType: 'EC2 Instance',
        recommendation:
            'Workload Factory recommends using optimized NFS mount options for database files: rw,bg,hard,[vers=3,vers=4.1],proto=tcp,timeo=600,rsize=262144,wsize=262144,nointr. This configuration is designed to improve database performance and resilience, particularly in high-throughput environments.',
        categories: [
            AwsWellArchitecturedPillars.RELIABILITY,
            AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
            AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
        ],
        applicableTo: 'nfs',
        configLevel: 'database'
    },
    {
        parameter: 'nfs-mount-options-adrhome',
        id: 'nfs-mount-options-adrhome',
        name: 'NFS Mount Options (ADR Home)',
        recommended: '',
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'Operating system',
        severity: SEVERITY.WARNING,
        resourceType: 'EC2 Instance',
        recommendation:
            'Workload Factory recommends using optimized NFS mount options for ADR home: rw,bg,hard,[vers=3,vers=4.1],proto=tcp,timeo=600,rsize=262144,wsize=262144 ',
        categories: [
            AwsWellArchitecturedPillars.RELIABILITY,
            AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY,
            AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE
        ],
        applicableTo: 'nfs',
        configLevel: 'database'
    },
    {
        parameter: 'nfsv4-domain-name',
        id: 'nfsv4-domain-name',
        name: 'NFSv4 Domain Name',
        recommended: '',
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'Operating system',
        severity: SEVERITY.CRITICAL,
        resourceType: 'EC2 Instance',
        recommendation:
            'Workload Factory recommends matching NFSv4 domain names between the host (/etc/idmapd.conf or hostname -d) and NFS server (v4-id-domain in ONTAP).',
        categories: [AwsWellArchitecturedPillars.RELIABILITY, AwsWellArchitecturedPillars.SECURITY],
        applicableTo: 'nfs',
        configLevel: 'database'
    },
    {
        parameter: 'nfs-caching-options',
        id: 'nfs-caching-options',
        name: 'NFS Caching Options',
        recommended: '',
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'Operating system',
        severity: SEVERITY.WARNING,
        resourceType: 'EC2 Instance',
        recommendation:
            'Workload Factory recommends avoiding the use of the following mount options in standalone deployments to prevent disabling cache: "cio", "actimeo=0", "noac", and "forcedirectio".',
        categories: [AwsWellArchitecturedPillars.RELIABILITY, AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY],
        applicableTo: 'nfs',
        configLevel: 'database'
    },
    {
        parameter: 'dnfs-enabled',
        id: 'dnfs-enabled',
        name: 'dNFS Enabled',
        recommended: 'Enabled',
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'Operating system',
        severity: SEVERITY.CRITICAL,
        resourceType: 'EC2 Instance',
        recommendation:
            'Workload Factory recommends enabling Direct NFS (dNFS) for your Oracle environment. Enabling dNFS can improve database performance and simplify NFS storage management by allowing Oracle to manage NFS I/O directly.',
        categories: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY, AwsWellArchitecturedPillars.RELIABILITY],
        applicableTo: 'nfs',
        configLevel: 'database'
    },
    {
        parameter: 'dnfs-consistent-ip-resolution',
        id: 'dnfs-consistent-ip-resolution',
        name: 'dNFS Consistent IP Resolution',
        recommended: 'No round-robin IP resolution',
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'Operating system',
        severity: SEVERITY.CRITICAL,
        resourceType: 'EC2 Instance',
        recommendation:
            'Workload Factory recommends avoiding the use of Direct NFS (dNFS) with any type of round-robin name resolution, including DNS, DDNS, NIS, or any other method. This includes the DNS load balancing feature available in ONTAP. Ensuring consistent IP address resolution is crucial for maintaining database stability and preventing potential crashes or data corruption.',
        categories: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY, AwsWellArchitecturedPillars.RELIABILITY],
        applicableTo: 'nfs',
        configLevel: 'database'
    },
    {
        parameter: 'dnfs-configuration-file',
        id: 'dnfs-configuration-file',
        name: 'dNFS Configuration File',
        recommended: 'Optimized oranfstab content',
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'Operating system',
        severity: SEVERITY.CRITICAL,
        resourceType: 'EC2 Instance',
        recommendation:
            'Workload Factory recommends verifying and optimizing the oranfstab file content to ensure proper Direct NFS (dNFS) usage. The oranfstab file is essential for configuring advanced dNFS features such as multipathing and specific NFS options. Proper configuration ensures efficient data access and management.',
        categories: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY, AwsWellArchitecturedPillars.RELIABILITY],
        applicableTo: 'nfs',
        configLevel: 'database'
    },
    {
        parameter: 'dnfs-no-shared-cache',
        id: 'dnfs-no-shared-cache',
        name: 'dNFS No Shared Cache',
        recommended: 'Enabled nosharecache mount option',
        type: 'storage',
        subType: 'configuration',
        focusWidgetName: 'Operating system',
        severity: SEVERITY.CRITICAL,
        resourceType: 'EC2 Instance',
        recommendation:
            'Workload Factory recommends configuring the nosharecache mount option for environments where Direct NFS (dNFS) is enabled, and a source volume is mounted more than once on a single server with nested NFS mounts. This configuration prevents cache sharing between mounts, ensuring data consistency and optimal performance.',
        categories: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY, AwsWellArchitecturedPillars.RELIABILITY],
        applicableTo: 'nfs',
        configLevel: 'database'
    },

    // ── layout ───────────────────────────────────────────────────────────────
    {
        parameter: 'archive-placement',
        id: 'archive-placement',
        name: 'Archive Placement',
        recommended: 'Separate volume',
        type: 'storage',
        subType: 'layout',
        focusWidgetName: 'Archive placement',
        severity: SEVERITY.WARNING,
        recommendation:
            'Placing archive logs on a dedicated volume enhances performance and recovery processes. This isolation prevents high I/O demands from interfering with other operations, ensuring efficient logging, sorting, and reliable backup and recovery.',
        categories: [
            AwsWellArchitecturedPillars.COST_OPTIMIZATION,
            AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
            AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
        ],
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
        configLevel: 'database'
    },
    {
        parameter: 'datafiles-placement',
        id: 'datafiles-placement',
        name: 'Data Files Placement',
        recommended: 'Separate volume or shared with control files',
        type: 'storage',
        subType: 'layout',
        focusWidgetName: 'Data files placement',
        severity: SEVERITY.WARNING,
        recommendation:
            'Placing data files on a dedicated volume or shared with control files boosts performance by isolating their random I/O from redo or archive log writes, reducing contention. This separation allows you to benefit from customized snapshot configurations, tiering policies, and efficiency mechanisms to optimize performance and cost.',
        categories: [
            AwsWellArchitecturedPillars.COST_OPTIMIZATION,
            AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
            AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
        ],
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
        configLevel: 'database'
    },
    {
        parameter: 'controlfiles-placement',
        id: 'controlfiles-placement',
        name: 'Control Files Placement',
        recommended: 'Separate volume or shared with data, redo, or temp files',
        type: 'storage',
        subType: 'layout',
        focusWidgetName: 'Control files placement',
        severity: SEVERITY.WARNING,
        recommendation:
            'Oracle strongly recommends multiplexing control files to avoid a single point of failure in production environments. Maintain at least two, preferably three, control file copies across separate volumes or disks to enhance redundancy and reduce the risk of losing all copies. Control files can be placed on a dedicated volume or shared with redo logs or data files, but avoid placing them on volumes tiered to object storage, such as archive volumes, as its slower access pattern is incompatible with control file performance needs.',
        categories: [
            AwsWellArchitecturedPillars.COST_OPTIMIZATION,
            AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
            AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
        ],
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
        configLevel: 'database'
    },
    {
        parameter: 'redologs-placement',
        id: 'redologs-placement',
        name: 'Redo Logs Placement',
        recommended: 'Separate volume or shared with temp or control files',
        type: 'storage',
        subType: 'layout',
        focusWidgetName: 'Redo logs placement',
        severity: SEVERITY.WARNING,
        recommendation:
            'Placing redo logs, whether multiplexed or not, on a dedicated volume or shared with temp/control files isolates their high-write I/O from data file transactions, improving performance. Each multiplexed redo log copy should reside on a separate volume for redundancy. Frequent changes make redo logs unsuitable for snapshotted volumes, like data volumes, as they inflate snapshot sizes. Redo logs must not be placed on volumes tiered to object storage, such as archive volumes, as their frequent updates are incompatible with object storages slower access patterns. This separation enables customized efficiency mechanisms and tiering configurations for optimal database performance and cost efficiency.',
        categories: [
            AwsWellArchitecturedPillars.COST_OPTIMIZATION,
            AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
            AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
        ],
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
        configLevel: 'database'
    },
    {
        parameter: 'templogs-placement',
        id: 'templogs-placement',
        name: 'Temp Placement',
        recommended: 'Separate volume or shared with redo or control files',
        type: 'storage',
        subType: 'layout',
        focusWidgetName: 'Temp placement',
        severity: SEVERITY.WARNING,
        recommendation:
            'Placing temp logs on a dedicated volume or shared with redo/control files isolates their high-write I/O from data file transactions, improving performance. Each multiplexed temp log copy should reside on a separate volume for redundancy. Frequent changes make temp logs unsuitable for snapshotted volumes, like data volumes, as they inflate snapshot sizes. Temp logs must not be placed on volumes tiered to object storage, such as archive volumes, as their frequent updates are incompatible with object storages slower access patterns. This separation enables customized efficiency mechanisms and tiering configurations for optimal database performance and cost efficiency.',
        categories: [
            AwsWellArchitecturedPillars.COST_OPTIMIZATION,
            AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
            AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
        ],
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
        configLevel: 'database'
    },
    {
        parameter: 'oracle-binary-placement',
        id: 'oracle-binary-placement',
        name: 'Oracle Binary Placement',
        recommended: 'separate-volume',
        type: 'storage',
        subType: 'layout',
        focusWidgetName: 'Oracle binary placement',
        severity: SEVERITY.WARNING,
        recommendation:
            'Placing Oracle binaries on a dedicated volume ensures optimal performance and stability by reducing I/O contention with other files. This separation simplifies software updates and minimizes the risk of accidental modifications or corruption, ensuring the database runs smoothly.',
        categories: [
            AwsWellArchitecturedPillars.COST_OPTIMIZATION,
            AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
            AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
        ],
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
        configLevel: 'database'
    },
    {
        parameter: 'data-dg-lun-layout',
        id: 'data-dg-lun-layout',
        name: 'ASM Data Disk Group LUNs',
        recommended: 'associated-lun-count',
        type: 'storage',
        subType: 'layout',
        focusWidgetName: 'ASM data disk group LUNs',
        severity: SEVERITY.WARNING,
        recommendation:
            'Multiple LUNs laid out within an Amazon FSx ONTAP volume provides better performance. It is recommended that ASM Disk Group that contains data files will consist of at least 4-8 LUNs.',
        categories: [
            AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
            AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
        ],
        resourceType: ASSESSMENT_RESOURCE_TYPE.DISK_GROUP,
        applicableTo: 'asm',
        configLevel: 'database'
    },
    {
        parameter: 'redolog-dg-lun-layout',
        id: 'redolog-dg-lun-layout',
        name: 'ASM Logs Disk Group LUNs',
        recommended: 'associated-lun-count',
        type: 'storage',
        subType: 'layout',
        focusWidgetName: 'ASM logs disk group LUNs',
        severity: SEVERITY.WARNING,
        recommendation:
            'Multiple LUNs laid out within an Amazon FSx ONTAP volume provides better performance.It is recommended that ASM Disk Group that contains redo logs will consist of at least 2-8 LUNs.',
        categories: [
            AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
            AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
        ],
        resourceType: ASSESSMENT_RESOURCE_TYPE.DISK_GROUP,
        applicableTo: 'asm',
        configLevel: 'database'
    },
    {
        parameter: 'fra-dg-lun-layout',
        id: 'fra-dg-lun-layout',
        name: 'ASM FRA Disk Group LUNs',
        recommended: 'associated-lun-count',
        type: 'storage',
        subType: 'layout',
        focusWidgetName: 'ASM archive log disk group LUNs',
        severity: SEVERITY.WARNING,
        recommendation:
            'Multiple LUNs laid out within an Amazon FSx ONTAP volume provides better performance. It is recommended that  ASM Disk Group for archive logs will consist of at least 2-8 LUNs.',
        categories: [
            AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
            AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
        ],
        resourceType: ASSESSMENT_RESOURCE_TYPE.DISK_GROUP,
        applicableTo: 'asm',
        configLevel: 'database'
    },
    {
        parameter: 'archivelog-dg-lun-layout',
        id: 'archivelog-dg-lun-layout',
        name: 'ASM Archive Log Disk Group LUNs',
        recommended: 'associated-lun-count',
        type: 'storage',
        subType: 'layout',
        focusWidgetName: 'ASM archive log disk group LUNs',
        severity: SEVERITY.WARNING,
        recommendation:
            'Multiple LUNs laid out within an Amazon FSx ONTAP volume provides better performance. It is recommended that  ASM Disk Group for archive logs will consist of at least 2-8 LUNs.',
        categories: [
            AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
            AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
        ],
        resourceType: ASSESSMENT_RESOURCE_TYPE.DISK_GROUP,
        applicableTo: 'asm',
        configLevel: 'database'
    },

    // ── sizing ───────────────────────────────────────────────────────────────
    {
        parameter: 'swap-space',
        id: 'swap-space',
        name: 'Swap Space',
        type: 'storage',
        subType: 'sizing',
        focusWidgetName: 'Swap space',
        severity: SEVERITY.CRITICAL,
        recommendation:
            'Proper swap sizing ensures that the system can handle memory pressure gracefully, avoiding potential performance degradation or system crashes.',
        categories: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY],
        resourceType: ASSESSMENT_RESOURCE_TYPE.INSTANCE,
        configLevel: 'database'
    },
    {
        parameter: 'headroom',
        id: 'headroom',
        name: 'File System Headroom',
        type: 'storage',
        subType: 'sizing',
        focusWidgetName: 'File system headroom',
        severity: SEVERITY.CRITICAL,
        recommendation:
            'To optimize storage performance, provision file system capacity as 1.2 times of total size of provisioned volume.',
        categories: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY],
        resourceType: ASSESSMENT_RESOURCE_TYPE.FILE_SYSTEM,
        configLevel: 'database'
    },

    // ── resiliency ───────────────────────────────────────────────────────────
    {
        id: 'snapcenter-snapshot',
        name: 'Application-Consistent Snapshots',
        categories: [AwsWellArchitecturedPillars.RELIABILITY],
        type: 'resiliency',
        subType: 'protection',
        focusWidgetName: 'Application-Consistent Snapshots',
        severity: SEVERITY.WARNING,
        recommended: AssessmentStatus.OPTIMIZED,
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
        recommendation:
            'Use application-consistent snapshots with NetApp SnapCenter to take accurate, reliable snapshots of your volume data at a specific moment in time. This keeps your apps running smoothly and your data safe. SnapCenter makes backups easier and helps you restore data quickly and correctly, reducing downtime and protecting your most important workloads.',
        configLevel: 'database'
    },
    {
        id: 'crr',
        name: 'Cross-Region Replication (CRR)',
        categories: [AwsWellArchitecturedPillars.RELIABILITY],
        type: 'resiliency',
        subType: 'resiliency',
        focusWidgetName: 'Cross-Region Replication (CRR)',
        severity: SEVERITY.WARNING,
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
        recommendation:
            'Workload Factory recommends enabling Cross-Region Replication (CRR) for your FSx for ONTAP filesystems serving Oracle. CRR ensures that your data is replicated to another AWS region, providing enhanced data durability and availability. It is recommended to configure CRR for disaster recovery and compliance requirements. Replicating redo logs (when applicable) can also assist with recovery to a specific point in time.',
        configLevel: 'database'
    },
    {
        id: 'backup-configuration',
        name: 'Backup Configuration',
        categories: [AwsWellArchitecturedPillars.RELIABILITY],
        type: 'resiliency',
        subType: 'resiliency',
        focusWidgetName: 'Backup Configuration',
        severity: SEVERITY.WARNING,
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
        recommendation:
            'Backup Configuration recommendation: Enable FSx Backup or AWS Backup for Oracle database volumes to support data retention and compliance. If using both, consider removing redundant backups manually.',
        configLevel: 'database'
    },

    // ── compute ──────────────────────────────────────────────────────────────
    {
        id: 'host-os-patch',
        name: 'Operating System Patch',
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
        id: 'oracle-security-patch',
        name: 'Oracle Critical Patch Updates',
        categories: [AwsWellArchitecturedPillars.SECURITY, AwsWellArchitecturedPillars.RELIABILITY],
        type: 'application',
        subType: 'application',
        focusWidgetName: 'Oracle security patch',
        severity: SEVERITY.CRITICAL,
        resourceType: ASSESSMENT_RESOURCE_TYPE.DATABASE,
        recommendation:
            'Oracle Critical Patch Updates (CPUs) include security fixes for supported self-managed Oracle databases. Installing the latest patch helps protect your database from vulnerabilities and improves system reliability.',
        configLevel: 'database'
    },

    // ── cloning ──────────────────────────────────────────────────────────────
    {
        id: 'clone-management',
        name: 'Clone Cleanup',
        type: 'cloning',
        subType: 'cloning',
        categories: [AwsWellArchitecturedPillars.COST_EFFICIENCY],
        severity: SEVERITY.WARNING,
        resourceType: ASSESSMENT_RESOURCE_TYPE.DATABASE,
        recommendation:
            'Old clones can incur significant costs. Consider deleting these clones to optimize your storage expenses.',
        configLevel: 'database'
    }
];

export default ORACLE_GOLDEN_CONFIG;
