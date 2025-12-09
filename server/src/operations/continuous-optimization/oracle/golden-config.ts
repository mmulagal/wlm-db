import {
    ASSESSMENT_RESOURCE_TYPE,
    AwsWellArchitecturedPillars,
    MIN_OPTIMIZED_HEADROOM_PERCENTAGE,
    SEVERITY
} from '../../../utils/continous-optimization-consts';

const GOLDEN_CONFIG = {
    configuration: {
        volume: [
            {
                parameter: 'spaceGuarantee',
                name: 'thin-provision',
                value: 'none',
                severity: SEVERITY.WARNING,
                recommendation:
                    'Workload Factory recommends configuring thin provisioning for FSx for ONTAP volumes hosting Oracle databases. This approach optimizes storage efficiency and cost-effectiveness by allowing more logical data to be stored than physically available.',
                tags: [
                    AwsWellArchitecturedPillars.COST_OPTIMIZATION,
                    AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
                    AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
                ]
            },
            {
                parameter: 'autosize',
                name: 'autosize',
                value: 'on',
                severity: SEVERITY.CRITICAL,
                recommendation:
                    'Workload Factory recommends enabling volume autogrow for FSx for ONTAP volumes for Oracle databases. This configuration enhances flexibility, availability, and scalability for Oracle databases by allowing volumes to grow dynamically to accommodate unexpected data growth, preventing space shortages and avoiding downtime if a volume runs out of space. Volume autogrow is essential when using thin provisioning.',
                tags: [
                    AwsWellArchitecturedPillars.COST_OPTIMIZATION,
                    AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
                    AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
                ]
            },
            {
                parameter: 'autosizeMode',
                name: 'autosize-mode',
                value: 'grow',
                severity: SEVERITY.CRITICAL,
                recommendation:
                    'Workload Factory recommends enabling volume autogrow for FSx for ONTAP volumes for Oracle databases. This configuration enhances flexibility and availability by allowing volumes to grow dynamically to accommodate unexpected data growth. This prevents space shortages and helps avoid downtime if a volume runs out of space, ensuring seamless scalability for Oracle databases. Volume autogrow is essential when using thin provisioning.',
                tags: [
                    AwsWellArchitecturedPillars.COST_OPTIMIZATION,
                    AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
                    AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
                ]
            },
            {
                parameter: 'fractionalReserve',
                name: 'fractional-reserve',
                value: 0,
                severity: SEVERITY.CRITICAL,
                recommendation:
                    'Workload Factory recommends disabling fractional reserve to eliminate unnecessary space reservation for overwrites thereby optimizing space utilization and cost-effectiveness for thin-provisioned FSx for ONTAP volumes. This configuration is essential when using thin provisioning with Oracle databases.',
                tags: [
                    AwsWellArchitecturedPillars.COST_OPTIMIZATION,
                    AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
                    AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
                ]
            },
            {
                parameter: 'snapshotPolicy',
                name: 'snapshot-policy',
                value: 'none',
                severity: SEVERITY.WARNING,
                recommendation:
                    'Workload Factory recommends disabling snapshots for FSx for ONTAP volumes for Oracle databases to save space and lower costs. Oracle snapshots should be managed externally via tools like SnapCenter, which creates application-consistent snapshots, preventing corruption during restoration.',
                tags: [
                    AwsWellArchitecturedPillars.COST_OPTIMIZATION,
                    AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
                    AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
                ]
            },
            {
                parameter: 'snapshotCopyReserve',
                name: 'snapshot-copy-reserve',
                value: 0,
                severity: SEVERITY.WARNING,
                recommendation:
                    'Workload Factory recommends that capacity isnt reserved for snapshots on FSx for ONTAP volumes used by databases, making the entire volume capacity available for active data and any snapshots that are created.',
                tags: [
                    AwsWellArchitecturedPillars.COST_OPTIMIZATION,
                    AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
                    AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
                ]
            },
            {
                parameter: 'snapshotAutodelete',
                name: 'snapshot-autodelete',
                value: true,
                severity: SEVERITY.WARNING,
                recommendation:
                    'Workload Factory recommends configuring the snapshot autodelete feature in FSx for ONTAP for Oracle databases to delete older snapshots first. This feature is designed to automatically manage snapshot storage by deleting the oldest snapshots when a volume approaches its capacity limit. This configuration helps in thin-provisioned environments, where more logical storage is allocated than physically available.',
                tags: [
                    AwsWellArchitecturedPillars.COST_OPTIMIZATION,
                    AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
                    AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
                ]
            },
            {
                parameter: 'spaceMgmtTryFirst',
                name: 'space-mgmt-try-first',
                value: 'volume_grow',
                severity: SEVERITY.WARNING,
                recommendation:
                    'Workload Factory recommends configuring space management to prioritize volume expansion over snapshot deletion for thin-provisioned FSx for ONTAP volumes with volume autogrow enabled.',
                tags: [
                    AwsWellArchitecturedPillars.COST_OPTIMIZATION,
                    AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
                    AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
                ]
            },
            {
                parameter: 'tieringPolicy',
                name: 'tiering-policy',
                value: 'snapshot_only',
                severity: SEVERITY.CRITICAL,
                recommendation:
                    'Workload Factory recommends tiering FSx for ONTAP volumes used by databases when applicable. Tiering optimizes storage utilization by automatically moving less frequently accessed data such as snapshots or archived logs to cost-effective capacity tiers while keeping active data and redo logs on the high-performance primary storage tier. Tiering reduces overall storage costs, enhances performance for critical workloads, and simplifies management through automated data placement. For different Oracle files—data, redo log, and archive —distinct tiering policies ensure tailored efficiency.',
                tags: [
                    AwsWellArchitecturedPillars.COST_OPTIMIZATION,
                    AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
                    AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
                ]
            },
            {
                parameter: 'tieringMinCoolingDays',
                name: 'tiering-min-cooling-days',
                value: '',
                severity: SEVERITY.CRITICAL,
                recommendation:
                    'Workload Factory recommends setting the appropriate minimum cooling days for a volume because it determines when data becomes eligible to move to cost-effective capacity tiers, optimizing storage costs while maintaining performance for frequently accessed data. Archive/FRA Volumes (tiering-minimum-cooling-days=2(for RMAN-compressed backups) tiering-minimum-cooling-days=14(for uncompressed backups)).',
                tags: [
                    AwsWellArchitecturedPillars.COST_OPTIMIZATION,
                    AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
                    AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
                ]
            },
            {
                parameter: 'compressionType',
                name: 'compression',
                value: '',
                severity: SEVERITY.CRITICAL,
                recommendation:
                    'Workload Factory recommends implementing storage efficiencies—compression, compaction, and deduplication—in NetApp ONTAP for Oracle database environments to significantly reduce storage footprint, lower costs, and optimize resource utilization while maintaining performance. Tailored settings for each volume type ensure alignment with Oracle’s I/O patterns: Data and archive Volumes benefit from inline adaptive compression (8KB), compaction and deduplication while Redo Log Volumes prioritize performance with minimal savings from these features.',
                tags: [
                    AwsWellArchitecturedPillars.COST_OPTIMIZATION,
                    AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
                    AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
                ]
            },
            {
                parameter: 'deduplication',
                name: 'deduplication',
                value: '',
                severity: SEVERITY.CRITICAL,
                recommendation:
                    'Workload Factory recommends implementing storage efficiencies—compression, compaction, and deduplication—in NetApp ONTAP for Oracle database environments to significantly reduce storage footprint, lower costs, and optimize resource utilization while maintaining performance. Tailored settings for each volume type ensure alignment with Oracle’s I/O patterns: Data and archive Volumes benefit from inline adaptive compression (8KB), compaction and deduplication while Redo Log Volumes prioritize performance with minimal savings from these features.',
                tags: [
                    AwsWellArchitecturedPillars.COST_OPTIMIZATION,
                    AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
                    AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
                ]
            },
            {
                parameter: 'compaction',
                name: 'compaction',
                value: 'enabled',
                severity: SEVERITY.CRITICAL,
                recommendation:
                    'Workload Factory recommends implementing storage efficiencies—compression, compaction, and deduplication—in NetApp ONTAP for Oracle database environments to significantly reduce storage footprint, lower costs, and optimize resource utilization while maintaining performance. Tailored settings for each volume type ensure alignment with Oracle’s I/O patterns: Data and archive Volumes benefit from inline adaptive compression (8KB), compaction and deduplication while Redo Log Volumes prioritize performance with minimal savings from these features.',
                tags: [
                    AwsWellArchitecturedPillars.COST_OPTIMIZATION,
                    AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
                    AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
                ]
            }
        ],
        volume_nfs: [
            {
                parameter: 'nfs-rootonly',
                name: 'nfs-rootonly',
                value: 'disabled',
                severity: SEVERITY.CRITICAL,
                resourceType: 'Volume',
                recommendation:
                    'Workload Factory recommends disabling the nfs-rootonly parameter for dNFS. ONTAPs nfs-rootonly setting restricts NFS connections to privileged ports (<1024). Since dNFS processes in NFSv4+ do not run as root and use higher ports, disabling this parameter allows necessary connections.',
                tags: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY, AwsWellArchitecturedPillars.RELIABILITY]
            },
            {
                parameter: 'export-policy',
                name: 'export-policy',
                value: 'superuser: sys, allow_suid: true',
                severity: SEVERITY.CRITICAL,
                resourceType: 'Volume',
                recommendation:
                    'Workload Factory recommends ensuring that if Oracle binaries are located on an NFS share, the export policy includes superuser and setuid permissions.Superuser (root) access allows NFS clients to map as root, needed for binary execution.',
                tags: [
                    AwsWellArchitecturedPillars.SECURITY,
                    AwsWellArchitecturedPillars.RELIABILITY,
                    AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE
                ]
            }
        ],
        lun: [
            {
                name: 'space-reservation-enabled',
                parameter: 'spaceReservationEnabled',
                value: true,
                severity: SEVERITY.CRITICAL,
                recommendation:
                    'Workload Factory recommends enabling space reservation on LUNs used by Oracle databases to reserve enough space in the volume so that writes to those LUNs dont fail.',
                tags: [
                    AwsWellArchitecturedPillars.COST_OPTIMIZATION,
                    AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
                    AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
                ]
            },
            {
                name: 'space-allocation-allocated',
                parameter: 'spaceAllocationAllocated',
                value: true,
                severity: SEVERITY.CRITICAL,
                recommendation:
                    'Workload Factory recommends enabling the space allocation feature on LUNs used by Oracle databases to ensure FSx ONTAP notifies the EC2 host when the volume is full and cannot accept writes. This setting also allows FSx for ONTAP to automatically reclaim space when SQL Server on the EC2 host deletes data. Failure to enable this option may result in write failures and inefficient space utilization.',
                tags: [
                    AwsWellArchitecturedPillars.COST_OPTIMIZATION,
                    AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
                    AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
                ]
            }
        ],
        os_iscsi: [
            {
                parameter: 'multipath-io',
                name: 'multipath-io',
                recommended: 'enabled',
                severity: SEVERITY.CRITICAL,
                resourceType: 'EC2 Instance',
                recommendation:
                    'Workload Factory recommends enabling Multipath I/O (MPIO) on database hosts that connect to ISCSI LUNs for Oracle databases. This host-level configuration enhances storage reliability and performance by providing redundant data paths between the server and storage. With multipath enabled, the system can automatically reroute I/O operations in the event of a path failure, minimizing downtime and ensuring consistent access to critical data.',
                tags: [AwsWellArchitecturedPillars.RELIABILITY, AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE]
            },
            {
                parameter: 'host-utilities',
                name: 'host-utilities',
                recommended: 'installed',
                severity: SEVERITY.WARNING,
                resourceType: 'EC2 Instance',
                recommendation:
                    'Workload Factory recommends installing host utilities for LUN and multipath management on systems hosting Oracle databases. These utilities ensure optimal compatibility, performance, and reliability when connecting to enterprise storage systems. Proper installation of host utilities helps streamline storage operations and supports best practices for Oracle deployments.',
                tags: [AwsWellArchitecturedPillars.RELIABILITY, AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE]
            },
            {
                parameter: 'multipath-io-sessions',
                name: 'multipath-io-sessions',
                recommended: '4',
                severity: SEVERITY.WARNING,
                resourceType: 'EC2 Instance',
                recommendation:
                    'Workload Factory recommends configuring host with four iSCSI sessions to each FSx ONTAP iSCSI endpoint in order to fully leverage multipath I/O',
                tags: [AwsWellArchitecturedPillars.RELIABILITY, AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY]
            },
            {
                parameter: 'transparent-hugepages',
                name: 'transparent-hugepages',
                recommended: 'disabled',
                severity: SEVERITY.WARNING,
                resourceType: 'EC2 Instance',
                recommendation:
                    'Workload Factory recommends disabling Transparent HugePages (THP) on database hosts running Oracle databases. Disabling THP is an Oracle best practice to prevent potential performance issues and ensure optimal database stability.',
                tags: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY]
            },
            {
                parameter: 'iscsi-replacement-timeout',
                name: 'iscsi-replacement-timeout',
                recommended: '5',
                severity: SEVERITY.CRITICAL,
                resourceType: 'EC2 Instance',
                recommendation:
                    'Workload Factory recommends setting node.session.timeo.replacement_timeout = 5 in /etc/iscsi/iscsid.conf for Oracle database hosts using multipath I/O. This adjustment reduces the time required to detect and recover from iSCSI path failures, ensuring that database operations remain highly available and responsive. After applying this change and restarting the iSCSI service, the host will be able to fail over to alternate paths within 5 seconds of a path failure, minimizing the risk of application downtime.',
                tags: [AwsWellArchitecturedPillars.RELIABILITY, AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY]
            },
            {
                parameter: 'multipath-friendly-names',
                name: 'multipath-friendly-names',
                recommended: 'enabled',
                severity: SEVERITY.WARNING,
                resourceType: 'EC2 Instance',
                recommendation:
                    'Workload Factory recommends enabling Multipath Friendly Names in the multipath configuration for Oracle database hosts. This setting simplifies device identification by assigning human-readable names to multipath devices, making storage management and troubleshooting more efficient and reducing the risk of configuration errors.',
                tags: [AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE]
            },
            {
                parameter: 'tcp-advanced-options',
                name: 'tcp-advanced-options',
                recommended: 'enabled',
                severity: SEVERITY.WARNING,
                resourceType: 'EC2 Instance',
                recommendation:
                    'Workload Factory recommends enabling TCP timestamps, SACK, and window scaling for best network performance and reliability.',
                tags: [AwsWellArchitecturedPillars.RELIABILITY, AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY]
            },
            {
                parameter: 'filesystems-io-options',
                name: 'filesystems-io-options',
                recommended: 'setall',
                severity: SEVERITY.WARNING,
                resourceType: 'EC2 Instance',
                recommendation:
                    'Workload Factory recommends setting filesystemio_options = setall for optimal I/O performance. Adjust SGA size if needed when moving away from buffered I/O.',
                tags: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY]
            },
            {
                parameter: 'multiblock-readcount',
                name: 'multiblock-readcount',
                recommended: 'disabled',
                severity: SEVERITY.WARNING,
                resourceType: 'EC2 Instance',
                recommendation:
                    'Workload Factory recommends removing db_file_multiblock_read_count from init.ora to prevent performance issues and allow Oracle to manage this setting automatically.',
                tags: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY]
            },
            {
                parameter: 'multipath-configuration',
                name: 'multipath-configuration',
                recommended: '',
                severity: SEVERITY.CRITICAL,
                resourceType: 'EC2 Instance',
                recommendation:
                    'Workload Factory strongly recommends that the multipath configuration file (/etc/multipath.conf) be properly configured with NetApp recommended settings for ONTAP LUNs, as this is critical for reliable path management, optimal performance, and compatibility with ONTAP storage systems. In addition, installing the Device Mapper Multipath package on all database hosts that connect to ONTAP storage via iSCSI enables multipath I/O, providing redundancy, failover, and resilient storage connectivity for Oracle databases. This combined approach ensures robust and dependable integration with ONTAP storage.',
                tags: [AwsWellArchitecturedPillars.RELIABILITY, AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE]
            }
        ],
        asmOS: [
            {
                parameter: 'asm-setup',
                name: 'asm-setup',
                recommended: '',
                severity: SEVERITY.WARNING,
                resourceType: 'EC2 Instance',
                recommendation:
                    'Workload Factory recommends using Oracle Automatic Storage Management (ASM) for iSCSI-based storage, such as FSx for NetApp ONTAP, to optimize performance, simplify storage management, and enhance scalability for Oracle Database deployments.',
                tags: [AwsWellArchitecturedPillars.RELIABILITY, AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY]
            },
            {
                parameter: 'asm-external-redundancy',
                name: 'asm-external-redundancy',
                recommended: '',
                severity: SEVERITY.WARNING,
                resourceType: 'ASM Disk Group',
                recommendation:
                    'Workload Factory recommends configuring Oracle ASM disk groups with External Redundancy for FSxN iSCSI LUNs to leverage FSxN’s built-in high availability, optimize storage efficiency, and reduce costs by avoiding Oracle-level data mirroring.',
                tags: [AwsWellArchitecturedPillars.COST_EFFICIENCY, AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY]
            },
            {
                parameter: 'afd-logical-block-size',
                name: 'afd-logical-block-size',
                recommended: '1',
                severity: SEVERITY.CRITICAL,
                resourceType: 'EC2 Instance',
                recommendation:
                    'Workload Factory recommends configuring the Oracle ASM Filter Driver (AFD) to use the logical block size of the underlying FSx for NetApp ONTAP. This ensures that AFD aligns I/O operations with the storage’s block size, optimizing performance by minimizing latency and reducing unnecessary I/O overhead.',
                tags: [AwsWellArchitecturedPillars.RELIABILITY, AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY]
            },
            {
                parameter: 'asmlib-logical-block-size',
                name: 'asmlib-logical-block-size',
                recommended: 'true',
                severity: SEVERITY.CRITICAL,
                resourceType: 'EC2 Instance',
                recommendation:
                    'Workload Factory recommends configuring Oracle ASMLib to use the logical block size of the underlying FSx for NetApp ONTAP, by setting the appropriate option in the ASMLib configuration file. This ensures that ASMLib aligns I/O operations with the storage’s block size, optimizing performance by minimizing latency and reducing unnecessary I/O overhead.',
                tags: [AwsWellArchitecturedPillars.RELIABILITY, AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY]
            }
        ],
        os_nfs: [
            {
                parameter: 'kernel-parameters',
                name: 'kernel-parameters',
                recommended: '',
                severity: SEVERITY.CRITICAL,
                resourceType: 'EC2 Instance',
                recommendation:
                    'Workload Factory recommends configuring the kernel parameters for the TCP slot table to 128, optimized specifically for Oracle workloads.',
                tags: [AwsWellArchitecturedPillars.RELIABILITY, AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY]
            },
            {
                parameter: 'nfs-mount-options-databasefiles',
                name: 'nfs-mount-options-databasefiles',
                recommended: '',
                severity: SEVERITY.WARNING,
                resourceType: 'EC2 Instance',
                recommendation:
                    'Workload Factory recommends using optimized NFS mount options for database files: rw,bg,hard,[vers=3,vers=4.1],proto=tcp,timeo=600,rsize=262144,wsize=262144,nointr. This configuration is designed to improve database performance and resilience, particularly in high-throughput environments.',
                tags: [
                    AwsWellArchitecturedPillars.RELIABILITY,
                    AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
                    AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
                ]
            },
            {
                parameter: 'nfs-mount-options-adrhome',
                name: 'nfs-mount-options-adrhome',
                recommended: '',
                severity: SEVERITY.WARNING,
                resourceType: 'EC2 Instance',
                recommendation:
                    'Workload Factory recommends using optimized NFS mount options for ADR home: rw,bg,hard,[vers=3,vers=4.1],proto=tcp,timeo=600,rsize=262144,wsize=262144 ',
                tags: [
                    AwsWellArchitecturedPillars.RELIABILITY,
                    AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY,
                    AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE
                ]
            },
            {
                parameter: 'nfsv4-domain-name',
                name: 'nfsv4-domain-name',
                recommended: '',
                severity: SEVERITY.CRITICAL,
                resourceType: 'EC2 Instance',
                recommendation:
                    'Workload Factory recommends matching NFSv4 domain names between the host (/etc/idmapd.conf or hostname -d) and NFS server (v4-id-domain in ONTAP).',
                tags: [AwsWellArchitecturedPillars.RELIABILITY, AwsWellArchitecturedPillars.SECURITY]
            },
            {
                parameter: 'nfs-caching-options',
                name: 'nfs-caching-options',
                recommended: '',
                severity: SEVERITY.WARNING,
                resourceType: 'EC2 Instance',
                recommendation:
                    'Workload Factory recommends avoiding the use of the following mount options in standalone deployments to prevent disabling cache: "cio", "actimeo=0", "noac", and "forcedirectio".',
                tags: [AwsWellArchitecturedPillars.RELIABILITY, AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY]
            }
        ]
    },
    archivePlacement: {
        parameter: 'archive-placement',
        name: 'archive-placement',
        recommended: 'separate-volume',
        severity: SEVERITY.WARNING,
        recommendation:
            'Placing archive logs on a dedicated volume enhances performance and recovery processes. This isolation prevents high I/O demands from interfering with other operations, ensuring efficient logging, sorting, and reliable backup and recovery.',
        tags: [
            AwsWellArchitecturedPillars.COST_OPTIMIZATION,
            AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
            AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
        ],
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME
    },
    datafilesPlacement: {
        parameter: 'datafiles-placement',
        name: 'datafiles-placement',
        recommended: 'separate-volume-or-shared-with-control-files',
        severity: SEVERITY.WARNING,
        recommendation:
            'Placing data files on a dedicated volume or shared with control files boosts performance by isolating their random I/O from redo or archive log writes, reducing contention. This separation allows you to benefit from customized snapshot configurations, tiering policies, and efficiency mechanisms to optimize performance and cost.',
        tags: [
            AwsWellArchitecturedPillars.COST_OPTIMIZATION,
            AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
            AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
        ],
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME
    },
    controlfilesPlacement: {
        parameter: 'controlfiles-placement',
        name: 'controlfiles-placement',
        recommended: 'separate-volume-or-shared-with-data-redo-temp',
        severity: SEVERITY.WARNING,
        recommendation:
            'Oracle strongly recommends multiplexing control files to avoid a single point of failure in production environments. Maintain at least two, preferably three, control file copies across separate volumes or disks to enhance redundancy and reduce the risk of losing all copies. Control files can be placed on a dedicated volume or shared with redo logs or data files, but avoid placing them on volumes tiered to object storage, such as archive volumes, as its slower access pattern is incompatible with control file performance needs.',
        tags: [
            AwsWellArchitecturedPillars.COST_OPTIMIZATION,
            AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
            AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
        ],
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME
    },
    redologsPlacement: {
        parameter: 'redologs-placement',
        name: 'redologs-placement',
        recommended: 'separate-volume-or-shared-with-temp-control-files',
        severity: SEVERITY.WARNING,
        recommendation:
            'Placing redo logs, whether multiplexed or not, on a dedicated volume or shared with temp/control files isolates their high-write I/O from data file transactions, improving performance. Each multiplexed redo log copy should reside on a separate volume for redundancy. Frequent changes make redo logs unsuitable for snapshotted volumes, like data volumes, as they inflate snapshot sizes. Redo logs must not be placed on volumes tiered to object storage, such as archive volumes, as their frequent updates are incompatible with object storages slower access patterns. This separation enables customized efficiency mechanisms and tiering configurations for optimal database performance and cost efficiency.',
        tags: [
            AwsWellArchitecturedPillars.COST_OPTIMIZATION,
            AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
            AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
        ],
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME
    },
    templogsPlacement: {
        parameter: 'templogs-placement',
        name: 'templogs-placement',
        recommended: 'separate-volume-or-shared-with-redo-control-files',
        severity: SEVERITY.WARNING,
        recommendation:
            'Placing temp logs on a dedicated volume or shared with redo/control files isolates their high-write I/O from data file transactions, improving performance. Each multiplexed temp log copy should reside on a separate volume for redundancy. Frequent changes make temp logs unsuitable for snapshotted volumes, like data volumes, as they inflate snapshot sizes. Temp logs must not be placed on volumes tiered to object storage, such as archive volumes, as their frequent updates are incompatible with object storages slower access patterns. This separation enables customized efficiency mechanisms and tiering configurations for optimal database performance and cost efficiency.',
        tags: [
            AwsWellArchitecturedPillars.COST_OPTIMIZATION,
            AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
            AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
        ],
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME
    },
    oracleBinaryPlacement: {
        parameter: 'oracle-binary-placement',
        name: 'oracle-binary-placement',
        recommended: 'separate-volume',
        severity: SEVERITY.WARNING,
        recommendation:
            'Placing Oracle binaries on a dedicated volume ensures optimal performance and stability by reducing I/O contention with other files. This separation simplifies software updates and minimizes the risk of accidental modifications or corruption, ensuring the database runs smoothly.',
        tags: [
            AwsWellArchitecturedPillars.COST_OPTIMIZATION,
            AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
            AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
        ],
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME
    },
    dataDiskLunLayout: {
        parameter: 'data-dg-lun-layout',
        name: 'data-dg-lun-layout',
        recommended: 'associated-lun-count',
        severity: SEVERITY.WARNING,
        recommendation:
            'Multiple LUNs laid out within an Amazon FSx ONTAP volume provides better performance. It is recommended that ASM Disk Group that contains data files will consist of at least 4-8 LUNs.',
        tags: [AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE, AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY],
        resourceType: ASSESSMENT_RESOURCE_TYPE.DISK_GROUP
    },
    redoLogDiskLunLayout: {
        parameter: 'redolog-dg-lun-layout',
        name: 'redolog-dg-lun-layout',
        recommended: 'associated-lun-count',
        severity: SEVERITY.WARNING,
        recommendation:
            'Multiple LUNs laid out within an Amazon FSx ONTAP volume provides better performance.It is recommended that ASM Disk Group that contains redo logs will consist of at least 2-8 LUNs.',
        tags: [AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE, AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY],
        resourceType: ASSESSMENT_RESOURCE_TYPE.DISK_GROUP
    },
    fraDiskLunLayout: {
        parameter: 'fra-dg-lun-layout',
        name: 'fra-dg-lun-layout',
        recommended: 'associated-lun-count',
        severity: SEVERITY.WARNING,
        recommendation:
            'Multiple LUNs laid out within an Amazon FSx ONTAP volume provides better performance. It is recommended that  ASM Disk Group for archive logs will consist of at least 2-8 LUNs.',
        tags: [AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE, AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY],
        resourceType: ASSESSMENT_RESOURCE_TYPE.DISK_GROUP
    },
    archivelogDiskLunLayout: {
        parameter: 'archivelog-dg-lun-layout',
        name: 'archivelog-dg-lun-layout',
        recommended: 'associated-lun-count',
        severity: SEVERITY.WARNING,
        recommendation:
            'Multiple LUNs laid out within an Amazon FSx ONTAP volume provides better performance. It is recommended that  ASM Disk Group for archive logs will consist of at least 2-8 LUNs.',
        tags: [AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE, AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY],
        resourceType: ASSESSMENT_RESOURCE_TYPE.DISK_GROUP
    },
    sizing: [
        {
            parameter: 'swap-space',
            name: 'swap-space',
            severity: SEVERITY.CRITICAL,
            recommendation: `Swap space sizing recommendation Proper swap sizing ensures that the system can handle memory pressure gracefully, avoiding potential performance degradation or system crashes. Swap space should be sized relatively to RAM: 
                - Between 1 GB and 2 GB: 1.5 times the size of the RAM 
                - Between 2 GB and 16 GB: Equal to the size of the RAM 
                - More than 16 GB: 16 GB`,
            tags: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY],
            resourceType: ASSESSMENT_RESOURCE_TYPE.INSTANCE
        },
        {
            parameter: 'headroom',
            name: 'headroom',
            severity: SEVERITY.CRITICAL,
            recommendation: `File system headroom recommendation to optimize storage performance, provision file system capacity as 1.2 times of total size of provisioned volume. File system headroom percentages are as follows: Under-provisioned: <${MIN_OPTIMIZED_HEADROOM_PERCENTAGE.ORACLE}%; Optimized: ${MIN_OPTIMIZED_HEADROOM_PERCENTAGE.ORACLE}%-50%; Over-provisioned: >50%`,
            tags: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY],
            resourceType: ASSESSMENT_RESOURCE_TYPE.FILE_SYSTEM
        }
    ]
};

export default GOLDEN_CONFIG;
