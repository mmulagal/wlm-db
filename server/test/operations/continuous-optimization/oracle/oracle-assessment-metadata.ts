const oracleAssessmentMetadata = {
    storage: {
        layout: [
            {
                name: 'archive-placement',
                errorMessage: 'No archive log volumes found.'
            },
            {
                name: 'datafiles-placement',
                tags: ['Cost optimization', 'Operational excellence', 'Performance efficiency'],
                status: 'not-optimized',
                severity: 'warning',
                parameter: 'datafiles-placement',
                recommended: 'separate-volume-or-shared-with-control-files',
                recommendation:
                    'Placing data files on a dedicated volume or shared with control files boosts performance by isolating their random I/O from redo or archive log writes, reducing contention. This separation allows you to benefit from customized snapshot configurations, tiering policies, and efficiency mechanisms to optimize performance and cost.',
                objectsInViolation: ['asm_log_150925004922', 'asm_recovery_150925004922'],
                totalObjectsAssessed: 2,
                totalObjectsInViolation: 2
            },
            {
                name: 'controlfiles-placement',
                tags: ['Cost optimization', 'Operational excellence', 'Performance efficiency'],
                status: 'optimized',
                severity: 'warning',
                parameter: 'controlfiles-placement',
                recommended: 'separate-volume-or-shared-with-data-redo-temp',
                recommendation:
                    'Oracle strongly recommends multiplexing control files to avoid a single point of failure in production environments. Maintain at least two, preferably three, control file copies across separate volumes or disks to enhance redundancy and reduce the risk of losing all copies. Control files can be placed on a dedicated volume or shared with redo logs or data files, but avoid placing them on volumes tiered to object storage, such as archive volumes, as its slower access pattern is incompatible with control file performance needs.',
                objectsInViolation: [],
                totalObjectsAssessed: 3,
                totalObjectsInViolation: 0
            },
            {
                name: 'redologs-placement',
                tags: ['Cost optimization', 'Operational excellence', 'Performance efficiency'],
                status: 'not-optimized',
                severity: 'warning',
                parameter: 'redologs-placement',
                recommended: 'separate-volume-or-shared-with-temp-control-files',
                recommendation:
                    'Placing redo logs, whether multiplexed or not, on a dedicated volume or shared with temp/control files isolates their high-write I/O from data file transactions, improving performance. Each multiplexed redo log copy should reside on a separate volume for redundancy. Frequent changes make redo logs unsuitable for snapshotted volumes, like data volumes, as they inflate snapshot sizes. Redo logs must not be placed on volumes tiered to object storage, such as archive volumes, as their frequent updates are incompatible with object storages slower access patterns. This separation enables customized efficiency mechanisms and tiering configurations for optimal database performance and cost efficiency.',
                objectsInViolation: ['asm_log_150925004922', 'asm_recovery_150925004922'],
                totalObjectsAssessed: 3,
                totalObjectsInViolation: 2
            },
            {
                name: 'templogs-placement',
                tags: ['Cost optimization', 'Operational excellence', 'Performance efficiency'],
                status: 'not-optimized',
                severity: 'warning',
                parameter: 'templogs-placement',
                recommended: 'separate-volume-or-shared-with-redo-control-files',
                recommendation:
                    'Placing temp logs on a dedicated volume or shared with redo/control files isolates their high-write I/O from data file transactions, improving performance. Each multiplexed temp log copy should reside on a separate volume for redundancy. Frequent changes make temp logs unsuitable for snapshotted volumes, like data volumes, as they inflate snapshot sizes. Temp logs must not be placed on volumes tiered to object storage, such as archive volumes, as their frequent updates are incompatible with object storages slower access patterns. This separation enables customized efficiency mechanisms and tiering configurations for optimal database performance and cost efficiency.',
                objectsInViolation: ['asm_log_150925004922', 'asm_recovery_150925004922'],
                totalObjectsAssessed: 2,
                totalObjectsInViolation: 2
            },
            {
                name: 'oracle-binary-placement',
                tags: ['Cost optimization', 'Operational excellence', 'Performance efficiency'],
                status: 'optimized',
                severity: 'warning',
                parameter: 'oracle-binary-placement',
                recommended: 'separate-volume',
                recommendation:
                    'Placing Oracle binaries on a dedicated volume ensures optimal performance and stability by reducing I/O contention with other files. This separation simplifies software updates and minimizes the risk of accidental modifications or corruption, ensuring the database runs smoothly.',
                objectsInViolation: [],
                totalObjectsAssessed: 1,
                totalObjectsInViolation: 0
            },
            {
                name: 'data-dg-lun-layout',
                tags: ['Operational excellence', 'Performance efficiency'],
                status: 'not-optimized',
                severity: 'warning',
                parameter: 'data-dg-lun-layout',
                recommended: 'associated-lun-count',
                recommendation:
                    'Multiple LUNs laid out within an Amazon FSx ONTAP volume provides better performance.It is recommended that ASM Disk Group that contains data files will consist of at least 4-8 LUNs.',
                objectsInViolation: ['DATADG'],
                totalObjectsAssessed: 1,
                totalObjectsInViolation: 2
            },
            {
                name: 'redolog-dg-lun-layout',
                tags: ['Operational excellence', 'Performance efficiency'],
                status: 'optimized',
                severity: 'warning',
                parameter: 'redolog-dg-lun-layout',
                recommended: 'associated-lun-count',
                recommendation:
                    'Multiple LUNs laid out within an Amazon FSx ONTAP volume provides better performance.It is recommended that ASM Disk Group that contains redo logs will consist of at least 2-8 LUNs.',
                objectsInViolation: [],
                totalObjectsAssessed: 2,
                totalObjectsInViolation: 0
            },
            {
                name: 'fra-dg-lun-layout',
                tags: ['Operational excellence', 'Performance efficiency'],
                status: 'not-optimized',
                severity: 'warning',
                parameter: 'fra-dg-lun-layout',
                recommended: 'associated-lun-count',
                recommendation:
                    'Multiple LUNs laid out within an Amazon FSx ONTAP volume provides better performance. It is recommended that  ASM Disk Group for archive logs will consist of at least 2-8 LUNs.',
                objectsInViolation: ['DATARG'],
                totalObjectsAssessed: 1,
                totalObjectsInViolation: 1
            }
        ],
        configuration: {
            luns: [
                {
                    name: 'space-reservation-enabled',
                    tags: ['Cost optimization', 'Operational excellence', 'Performance efficiency'],
                    value: true,
                    status: 'optimized',
                    severity: 'critical',
                    parameter: 'spaceReservationEnabled',
                    recommended: 'true',
                    recommendation:
                        'Workload Factory recommends enabling space reservation on LUNs used by Oracle databases to reserve enough space in the volume so that writes to those LUNs dont fail.',
                    violationDetails: [],
                    objectsInViolation: [],
                    totalObjectsAssessed: 3,
                    totalObjectsInViolation: 0
                },
                {
                    name: 'space-allocation-allocated',
                    tags: ['Cost optimization', 'Operational excellence', 'Performance efficiency'],
                    value: true,
                    status: 'optimized',
                    severity: 'critical',
                    parameter: 'spaceAllocationAllocated',
                    recommended: 'true',
                    recommendation:
                        'Workload Factory recommends enabling the space allocation feature on LUNs used by Oracle databases to ensure FSx ONTAP notifies the EC2 host when the volume is full and cannot accept writes. This setting also allows FSx for ONTAP to automatically reclaim space when SQL Server on the EC2 host deletes data. Failure to enable this option may result in write failures and inefficient space utilization.',
                    violationDetails: [],
                    objectsInViolation: [],
                    totalObjectsAssessed: 3,
                    totalObjectsInViolation: 0
                }
            ],
            volumes: [
                {
                    name: 'thin-provision',
                    tags: ['Cost optimization', 'Operational excellence', 'Performance efficiency'],
                    value: 'none',
                    status: 'optimized',
                    severity: 'warning',
                    parameter: 'spaceGuarantee',
                    recommended: 'none',
                    resourceType: 'Volume',
                    recommendation:
                        'Workload Factory recommends configuring thin provisioning for FSx for ONTAP volumes hosting Oracle databases. This approach optimizes storage efficiency and cost-effectiveness by allowing more logical data to be stored than physically available.',
                    violationDetails: [],
                    objectsInViolation: [],
                    totalObjectsAssessed: 3,
                    totalObjectsInViolation: 0
                },
                {
                    name: 'autosize',
                    tags: ['Cost optimization', 'Operational excellence', 'Performance efficiency'],
                    value: 'on',
                    status: 'not-optimized',
                    severity: 'critical',
                    parameter: 'autosize',
                    recommended: 'on',
                    resourceType: 'Volume',
                    recommendation:
                        'Workload Factory recommends enabling volume autogrow for FSx for ONTAP volumes for Oracle databases. This configuration enhances flexibility, availability, and scalability for Oracle databases by allowing volumes to grow dynamically to accommodate unexpected data growth, preventing space shortages and avoiding downtime if a volume runs out of space. Volume autogrow is essential when using thin provisioning.',
                    violationDetails: [
                        {
                            value: 'off',
                            objectName: 'asm_log_150925004922',
                            objectType: 'Volume',
                            recommended: 'on',
                            dataCategory: ''
                        },
                        {
                            value: 'off',
                            objectName: 'asm_recovery_150925004922',
                            objectType: 'Volume',
                            recommended: 'on',
                            dataCategory: ''
                        },
                        {
                            value: 'off',
                            objectName: 'extra_volume_150925004922',
                            objectType: 'Volume',
                            recommended: 'on',
                            dataCategory: ''
                        }
                    ],
                    objectsInViolation: [
                        'asm_log_150925004922',
                        'asm_recovery_150925004922',
                        'extra_volume_150925004922'
                    ],
                    totalObjectsAssessed: 3,
                    totalObjectsInViolation: 3
                },
                {
                    name: 'autosize-mode',
                    tags: ['Cost optimization', 'Operational excellence', 'Performance efficiency'],
                    value: 'grow',
                    status: 'not-optimized',
                    severity: 'critical',
                    parameter: 'autosizeMode',
                    recommended: 'grow',
                    resourceType: 'Volume',
                    recommendation:
                        'Workload Factory recommends enabling volume autogrow for FSx for ONTAP volumes for Oracle databases. This configuration enhances flexibility and availability by allowing volumes to grow dynamically to accommodate unexpected data growth. This prevents space shortages and helps avoid downtime if a volume runs out of space, ensuring seamless scalability for Oracle databases. Volume autogrow is essential when using thin provisioning.',
                    violationDetails: [
                        {
                            value: 'off',
                            objectName: 'asm_log_150925004922',
                            objectType: 'Volume',
                            recommended: 'grow',
                            dataCategory: ''
                        },
                        {
                            value: 'off',
                            objectName: 'asm_recovery_150925004922',
                            objectType: 'Volume',
                            recommended: 'grow',
                            dataCategory: ''
                        },
                        {
                            value: 'off',
                            objectName: 'extra_volume_150925004922',
                            objectType: 'Volume',
                            recommended: 'grow',
                            dataCategory: ''
                        }
                    ],
                    objectsInViolation: [
                        'asm_log_150925004922',
                        'asm_recovery_150925004922',
                        'extra_volume_150925004922'
                    ],
                    totalObjectsAssessed: 3,
                    totalObjectsInViolation: 3
                },
                {
                    name: 'fractional-reserve',
                    tags: ['Cost optimization', 'Operational excellence', 'Performance efficiency'],
                    value: 0,
                    status: 'optimized',
                    severity: 'critical',
                    parameter: 'fractionalReserve',
                    recommended: '0',
                    resourceType: 'Volume',
                    recommendation:
                        'Workload Factory recommends disabling fractional reserve to eliminate unnecessary space reservation for overwrites thereby optimizing space utilization and cost-effectiveness for thin-provisioned FSx for ONTAP volumes. This configuration is essential when using thin provisioning with Oracle databases.',
                    violationDetails: [],
                    objectsInViolation: [],
                    totalObjectsAssessed: 3,
                    totalObjectsInViolation: 0
                },
                {
                    name: 'snapshot-policy',
                    tags: ['Cost optimization', 'Operational excellence', 'Performance efficiency'],
                    value: 'none',
                    status: 'not-optimized',
                    severity: 'warning',
                    parameter: 'snapshotPolicy',
                    recommended: 'none',
                    resourceType: 'Volume',
                    recommendation:
                        'Workload Factory recommends disabling snapshots for FSx for ONTAP volumes for Oracle databases to save space and lower costs. Oracle snapshots should be managed externally via tools like SnapCenter, which creates application-consistent snapshots, preventing corruption during restoration.',
                    violationDetails: [
                        {
                            value: 'default',
                            objectName: 'asm_log_150925004922',
                            objectType: 'Volume',
                            recommended: 'none',
                            dataCategory: ''
                        },
                        {
                            value: 'default',
                            objectName: 'asm_recovery_150925004922',
                            objectType: 'Volume',
                            recommended: 'none',
                            dataCategory: ''
                        },
                        {
                            value: 'default',
                            objectName: 'extra_volume_150925004922',
                            objectType: 'Volume',
                            recommended: 'none',
                            dataCategory: ''
                        }
                    ],
                    objectsInViolation: [
                        'asm_log_150925004922',
                        'asm_recovery_150925004922',
                        'extra_volume_150925004922'
                    ],
                    totalObjectsAssessed: 3,
                    totalObjectsInViolation: 3
                },
                {
                    name: 'snapshot-copy-reserve',
                    tags: ['Cost optimization', 'Operational excellence', 'Performance efficiency'],
                    value: 0,
                    status: 'not-optimized',
                    severity: 'warning',
                    parameter: 'snapshotCopyReserve',
                    recommended: '0',
                    resourceType: 'Volume',
                    recommendation:
                        'Workload Factory recommends that capacity isnt reserved for snapshots on FSx for ONTAP volumes used by databases, making the entire volume capacity available for active data and any snapshots that are created.',
                    violationDetails: [
                        {
                            value: '5',
                            objectName: 'asm_log_150925004922',
                            objectType: 'Volume',
                            recommended: '0',
                            dataCategory: ''
                        },
                        {
                            value: '5',
                            objectName: 'asm_recovery_150925004922',
                            objectType: 'Volume',
                            recommended: '0',
                            dataCategory: ''
                        },
                        {
                            value: '5',
                            objectName: 'extra_volume_150925004922',
                            objectType: 'Volume',
                            recommended: '0',
                            dataCategory: ''
                        }
                    ],
                    objectsInViolation: [
                        'asm_log_150925004922',
                        'asm_recovery_150925004922',
                        'extra_volume_150925004922'
                    ],
                    totalObjectsAssessed: 3,
                    totalObjectsInViolation: 3
                },
                {
                    name: 'snapshot-autodelete',
                    tags: ['Cost optimization', 'Operational excellence', 'Performance efficiency'],
                    value: true,
                    status: 'not-optimized',
                    severity: 'warning',
                    parameter: 'snapshotAutodelete',
                    recommended: 'true',
                    resourceType: 'Volume',
                    recommendation:
                        'Workload Factory recommends configuring the snapshot autodelete feature in FSx for ONTAP for Oracle databases to delete older snapshots first. This feature is designed to automatically manage snapshot storage by deleting the oldest snapshots when a volume approaches its capacity limit. This configuration helps in thin-provisioned environments, where more logical storage is allocated than physically available.',
                    violationDetails: [
                        {
                            value: 'disabled',
                            objectName: 'asm_log_150925004922',
                            objectType: 'Volume',
                            recommended: 'enabled',
                            dataCategory: ''
                        },
                        {
                            value: 'disabled',
                            objectName: 'asm_recovery_150925004922',
                            objectType: 'Volume',
                            recommended: 'enabled',
                            dataCategory: ''
                        },
                        {
                            value: 'disabled',
                            objectName: 'extra_volume_150925004922',
                            objectType: 'Volume',
                            recommended: 'enabled',
                            dataCategory: ''
                        }
                    ],
                    objectsInViolation: [
                        'asm_log_150925004922',
                        'asm_recovery_150925004922',
                        'extra_volume_150925004922'
                    ],
                    totalObjectsAssessed: 3,
                    totalObjectsInViolation: 3
                },
                {
                    name: 'space-mgmt-try-first',
                    tags: ['Cost optimization', 'Operational excellence', 'Performance efficiency'],
                    value: 'volume_grow',
                    status: 'optimized',
                    severity: 'warning',
                    parameter: 'spaceMgmtTryFirst',
                    recommended: 'volume_grow',
                    resourceType: 'Volume',
                    recommendation:
                        'Workload Factory recommends configuring space management to prioritize volume expansion over snapshot deletion for thin-provisioned FSx for ONTAP volumes with volume autogrow enabled.',
                    violationDetails: [],
                    objectsInViolation: [],
                    totalObjectsAssessed: 3,
                    totalObjectsInViolation: 0
                },
                {
                    name: 'tiering-policy',
                    tags: ['Cost optimization', 'Operational excellence', 'Performance efficiency'],
                    value: 'snapshot_only',
                    status: 'not-optimized',
                    severity: 'critical',
                    parameter: 'tieringPolicy',
                    recommended: 'snapshot_only',
                    resourceType: 'Volume',
                    recommendation:
                        'Workload Factory recommends tiering FSx for ONTAP volumes used by databases when applicable. Tiering optimizes storage utilization by automatically moving less frequently accessed data such as snapshots or archived logs to cost-effective capacity tiers while keeping active data and redo logs on the high-performance primary storage tier. Tiering reduces overall storage costs, enhances performance for critical workloads, and simplifies management through automated data placement. For different Oracle files—data, redo log, and archive —distinct tiering policies ensure tailored efficiency.',
                    violationDetails: [
                        {
                            value: 'snapshot_only',
                            objectName: 'asm_recovery_150925004922',
                            objectType: 'Volume',
                            recommended: 'none',
                            dataCategory: 'mixed'
                        },
                        {
                            value: 'snapshot_only',
                            objectName: 'extra_volume_150925004922',
                            objectType: 'Volume',
                            recommended: 'none',
                            dataCategory: 'mixed'
                        }
                    ],
                    objectsInViolation: ['asm_recovery_150925004922', 'extra_volume_150925004922'],
                    totalObjectsAssessed: 3,
                    totalObjectsInViolation: 2
                },
                {
                    name: 'tiering-min-cooling-days',
                    tags: ['Cost optimization', 'Operational excellence', 'Performance efficiency'],
                    value: '',
                    status: 'optimized',
                    severity: 'critical',
                    parameter: 'tieringMinCoolingDays',
                    recommended: '',
                    resourceType: 'Volume',
                    recommendation:
                        'Workload Factory recommends setting the appropriate minimum cooling days for a volume because it determines when data becomes eligible to move to cost-effective capacity tiers, optimizing storage costs while maintaining performance for frequently accessed data. Archive/FRA Volumes (tiering-minimum-cooling-days=2(for RMAN-compressed backups) tiering-minimum-cooling-days=14(for uncompressed backups)).',
                    violationDetails: [],
                    objectsInViolation: [],
                    totalObjectsAssessed: 0,
                    totalObjectsInViolation: 0
                },
                {
                    name: 'compression',
                    tags: ['Cost optimization', 'Operational excellence', 'Performance efficiency'],
                    value: '',
                    status: 'not-optimized',
                    severity: 'critical',
                    parameter: 'compressionType',
                    recommended: '',
                    resourceType: 'Volume',
                    recommendation:
                        'Workload Factory recommends implementing storage efficiencies—compression, compaction, and deduplication—in NetApp ONTAP for Oracle database environments to significantly reduce storage footprint, lower costs, and optimize resource utilization while maintaining performance. Tailored settings for each volume type ensure alignment with Oracle’s I/O patterns: Data and archive Volumes benefit from inline adaptive compression (8KB), compaction and deduplication while Redo Log Volumes prioritize performance with minimal savings from these features.',
                    violationDetails: [
                        {
                            value: 'adaptive',
                            objectName: 'asm_log_150925004922',
                            objectType: 'Volume',
                            recommended: 'none',
                            dataCategory: 'mixed'
                        },
                        {
                            value: 'adaptive',
                            objectName: 'asm_recovery_150925004922',
                            objectType: 'Volume',
                            recommended: 'none',
                            dataCategory: 'mixed'
                        },
                        {
                            value: 'adaptive',
                            objectName: 'extra_volume_150925004922',
                            objectType: 'Volume',
                            recommended: 'none',
                            dataCategory: 'mixed'
                        }
                    ],
                    objectsInViolation: [
                        'asm_log_150925004922',
                        'asm_recovery_150925004922',
                        'extra_volume_150925004922'
                    ],
                    totalObjectsAssessed: 3,
                    totalObjectsInViolation: 3
                },
                {
                    name: 'deduplication',
                    tags: ['Cost optimization', 'Operational excellence', 'Performance efficiency'],
                    value: '',
                    status: 'not-optimized',
                    severity: 'critical',
                    parameter: 'deduplication',
                    recommended: '',
                    resourceType: 'Volume',
                    recommendation:
                        'Workload Factory recommends implementing storage efficiencies—compression, compaction, and deduplication—in NetApp ONTAP for Oracle database environments to significantly reduce storage footprint, lower costs, and optimize resource utilization while maintaining performance. Tailored settings for each volume type ensure alignment with Oracle’s I/O patterns: Data and archive Volumes benefit from inline adaptive compression (8KB), compaction and deduplication while Redo Log Volumes prioritize performance with minimal savings from these features.',
                    violationDetails: [
                        {
                            value: 'both',
                            objectName: 'asm_log_150925004922',
                            objectType: 'Volume',
                            recommended: 'none',
                            dataCategory: 'mixed'
                        },
                        {
                            value: 'both',
                            objectName: 'asm_recovery_150925004922',
                            objectType: 'Volume',
                            recommended: 'none',
                            dataCategory: 'mixed'
                        },
                        {
                            value: 'both',
                            objectName: 'extra_volume_150925004922',
                            objectType: 'Volume',
                            recommended: 'none',
                            dataCategory: 'mixed'
                        }
                    ],
                    objectsInViolation: [
                        'asm_log_150925004922',
                        'asm_recovery_150925004922',
                        'extra_volume_150925004922'
                    ],
                    totalObjectsAssessed: 3,
                    totalObjectsInViolation: 3
                },
                {
                    name: 'compaction',
                    tags: ['Cost optimization', 'Operational excellence', 'Performance efficiency'],
                    value: 'enabled',
                    status: 'optimized',
                    severity: 'critical',
                    parameter: 'compaction',
                    recommended: 'enabled',
                    resourceType: 'Volume',
                    recommendation:
                        'Workload Factory recommends implementing storage efficiencies—compression, compaction, and deduplication—in NetApp ONTAP for Oracle database environments to significantly reduce storage footprint, lower costs, and optimize resource utilization while maintaining performance. Tailored settings for each volume type ensure alignment with Oracle’s I/O patterns: Data and archive Volumes benefit from inline adaptive compression (8KB), compaction and deduplication while Redo Log Volumes prioritize performance with minimal savings from these features.',
                    violationDetails: [],
                    objectsInViolation: [],
                    totalObjectsAssessed: 3,
                    totalObjectsInViolation: 0
                }
            ]
        },
        os: [
            {
                name: 'multipath-io',
                status: 'optimized',
                recommended: 'enabled',
                severity: 'critical',
                recommendation:
                    'Workload Factory recommends enabling Multipath I/O (MPIO) on database hosts that connect to ISCSI LUNs for Oracle databases. This host-level configuration enhances storage reliability and performance by providing redundant data paths between the server and storage. With multipath enabled, the system can automatically reroute I/O operations in the event of a path failure, minimizing downtime and ensuring consistent access to critical data.',
                tags: ['Reliability', 'Operational excellence'],
                objectsInViolation: [],
                violationDetails: [],
                totalObjectsAssessed: 1,
                totalObjectsInViolation: 0
            },
            {
                name: 'host-utilities',
                status: 'not-optimized',
                recommended: 'installed',
                severity: 'warning',
                recommendation:
                    'Workload Factory recommends installing host utilities for LUN and multipath management on systems hosting Oracle databases. These utilities ensure optimal compatibility, performance, and reliability when connecting to enterprise storage systems. Proper installation of host utilities helps streamline storage operations and supports best practices for Oracle deployments.',
                tags: ['Reliability', 'Operational excellence'],
                objectsInViolation: ['i-03ed3dc17db570670'],
                violationDetails: [
                    {
                        objectName: 'i-03ed3dc17db570670',
                        value: 'sanlun not installed',
                        objectType: 'EC2 instance'
                    }
                ],
                totalObjectsAssessed: 1,
                totalObjectsInViolation: 1
            },
            {
                name: 'multipath-io-sessions',
                status: 'not-optimized',
                recommended: '4',
                severity: 'warning',
                recommendation:
                    'Workload Factory recommends configuring host with four iSCSI sessions to each FSx ONTAP iSCSI endpoint in order to fully leverage multipath I/O',
                tags: ['Reliability', 'Performance efficiency'],
                objectsInViolation: ['172.31.48.72', '172.31.6.100'],
                violationDetails: [
                    {
                        objectName: '172.31.48.72',
                        value: '1',
                        objectType: 'iscsi target'
                    },
                    {
                        objectName: '172.31.6.100',
                        value: '0',
                        objectType: 'iscsi target'
                    }
                ],
                totalObjectsAssessed: 2,
                totalObjectsInViolation: 2
            },
            {
                name: 'transparent-hugepages',
                status: 'optimized',
                recommended: 'disabled',
                severity: 'warning',
                recommendation:
                    'Workload Factory recommends disabling Transparent HugePages (THP) on database hosts running Oracle databases. Disabling THP is an Oracle best practice to prevent potential performance issues and ensure optimal database stability.',
                tags: ['Performance efficiency'],
                objectsInViolation: [],
                violationDetails: [],
                totalObjectsAssessed: 1,
                totalObjectsInViolation: 0
            },
            {
                name: 'selinux',
                status: 'not-optimized',
                recommended: 'disabled',
                severity: 'warning',
                recommendation:
                    'Workload Factory recommends disabling SELinux on Oracle database hosts by setting SELINUX=disabled in the system configuration. Disabling SELinux can help avoid compatibility issues and administrative overhead associated with managing SELinux policies for Oracle workloads. After this change, SELinux will no longer enforce access controls, so ensure that your environment is otherwise secured.',
                tags: ['Security', 'Operational excellence'],
                objectsInViolation: ['i-03ed3dc17db570670'],
                violationDetails: [
                    {
                        objectName: 'i-03ed3dc17db570670',
                        value: 'permissive',
                        objectType: 'EC2 instance'
                    }
                ],
                totalObjectsAssessed: 1,
                totalObjectsInViolation: 1
            },
            {
                name: 'iscsi-replacement-timeout',
                status: 'not-optimized',
                recommended: '5',
                severity: 'critical',
                recommendation:
                    'Workload Factory recommends setting node.session.timeo.replacement_timeout = 5 in /etc/iscsi/iscsid.conf for Oracle database hosts using multipath I/O. This adjustment reduces the time required to detect and recover from iSCSI path failures, ensuring that database operations remain highly available and responsive. After applying this change and restarting the iSCSI service, the host will be able to fail over to alternate paths within 5 seconds of a path failure, minimizing the risk of application downtime.',
                tags: ['Reliability', 'Performance efficiency'],
                objectsInViolation: ['i-03ed3dc17db570670'],
                violationDetails: [
                    {
                        objectName: 'i-03ed3dc17db570670',
                        value: '120',
                        objectType: 'EC2 instance'
                    }
                ],
                totalObjectsAssessed: 1,
                totalObjectsInViolation: 1
            },
            {
                name: 'multipath-friendly-names',
                status: 'not-optimized',
                recommended: 'enabled',
                severity: 'warning',
                recommendation:
                    'Workload Factory recommends enabling Multipath Friendly Names in the multipath configuration for Oracle database hosts. This setting simplifies device identification by assigning human-readable names to multipath devices, making storage management and troubleshooting more efficient and reducing the risk of configuration errors.',
                tags: ['Operational excellence'],
                objectsInViolation: ['i-03ed3dc17db570670'],
                violationDetails: [
                    {
                        objectName: 'user_friendly_names',
                        value: 'false',
                        objectType: 'netapp device configuration'
                    }
                ],
                totalObjectsAssessed: 1,
                totalObjectsInViolation: 1
            },
            {
                name: 'tcp-advanced-options',
                status: 'optimized',
                recommended: 'enabled',
                severity: 'warning',
                recommendation:
                    'Workload Factory recommends enabling TCP timestamps, SACK, and window scaling for best network performance and reliability.',
                tags: ['Reliability', 'Performance efficiency'],
                objectsInViolation: [],
                violationDetails: [],
                totalObjectsAssessed: 1,
                totalObjectsInViolation: 0
            },
            {
                name: 'filesystems-io-options',
                status: 'not-optimized',
                recommended: 'setall',
                severity: 'warning',
                recommendation:
                    'Workload Factory recommends setting filesystemio_options = setall for optimal I/O performance. Adjust SGA size if needed when moving away from buffered I/O.',
                tags: ['Performance efficiency'],
                objectsInViolation: ['asm04y'],
                violationDetails: [
                    {
                        objectName: 'asm04y',
                        value: 'none',
                        objectType: 'EC2 Instance'
                    }
                ],
                totalObjectsAssessed: 1,
                totalObjectsInViolation: 1,
                resourceType: 'EC2 Instance'
            },
            {
                name: 'multipath-readcount',
                status: 'optimized',
                recommended: 'disabled',
                severity: 'warning',
                recommendation:
                    'Workload Factory recommends removing db_file_multiblock_read_count from init.ora to prevent performance issues and allow Oracle to manage this setting automatically.',
                tags: ['Performance efficiency'],
                objectsInViolation: [],
                violationDetails: [],
                totalObjectsAssessed: 1,
                totalObjectsInViolation: 0,
                resourceType: 'EC2 Instance'
            },
            {
                name: 'multipath-configuration',
                status: 'not-optimized',
                recommended: '',
                severity: 'critical',
                recommendation:
                    'Workload Factory strongly recommends that the multipath configuration file (/etc/multipath.conf) be properly configured with NetApp recommended settings for ONTAP LUNs, as this is critical for reliable path management, optimal performance, and compatibility with ONTAP storage systems. In addition, installing the Device Mapper Multipath package on all database hosts that connect to ONTAP storage via iSCSI enables multipath I/O, providing redundancy, failover, and resilient storage connectivity for Oracle databases. This combined approach ensures robust and dependable integration with ONTAP storage.',
                tags: ['Reliability', 'Operational excellence'],
                objectsInViolation: ['i-03ed3dc17db570670'],
                violationDetails: [
                    {
                        objectName: 'path_selector',
                        value: 'not found',
                        objectType: 'netapp device configuration'
                    },
                    {
                        objectName: 'features',
                        value: '2 pg_init_retries 50',
                        objectType: 'netapp device configuration'
                    },
                    {
                        objectName: 'hardware_handler',
                        value: 'not found',
                        objectType: 'netapp device configuration'
                    },
                    {
                        objectName: 'rr_weight',
                        value: 'not found',
                        objectType: 'netapp device configuration'
                    },
                    {
                        objectName: 'fast_io_fail_tmo',
                        value: 'not found',
                        objectType: 'netapp device configuration'
                    },
                    {
                        objectName: 'detect_prio',
                        value: 'not found',
                        objectType: 'netapp device configuration'
                    },
                    {
                        objectName: 'flush_on_last_del',
                        value: 'true',
                        objectType: 'netapp device configuration'
                    },
                    {
                        objectName: 'retain_attached_hw_handler',
                        value: 'not found',
                        objectType: 'netapp device configuration'
                    },
                    {
                        objectName: 'path_checker',
                        value: 'not found',
                        objectType: 'netapp device configuration'
                    },
                    {
                        objectName: 'polling_interval',
                        value: 'not found',
                        objectType: 'netapp device configuration'
                    },
                    {
                        objectName: 'max_sectors_kb',
                        value: 'not found',
                        objectType: 'netapp device configuration'
                    }
                ],
                totalObjectsAssessed: 1,
                totalObjectsInViolation: 1,
                resourceType: 'EC2 Instance'
            }
        ]
    },
    fileSystemId: 'fs-0f53fbecdd3d85fb2',
    ec2InstanceId: 'i-07e76a4b916548dc',
    deploymentType: 'Standalone',
    storageProtocol: 'iSCSI',
    databaseInstanceName: 'asm04y',
    lastAssessmentTimestamp: 1758014364464
};

const oracleInstanceMappedVolMetadata = {
    'fs-0f53fbecdd3d85fb2': {
        protocol: 'iSCSI',
        lunRecords: [],
        isASMManaged: true,
        volumeMappings: [
            {
                asm04y: {
                    isCDB: true,
                    ontapVolumes: {
                        PDB1: {
                            FRA: [
                                {
                                    lunId: '50224a44-17f3-435f-beea-47723c58499e',
                                    svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                    lunName: '/vol/extra_volume_150925004922/lun1',
                                    svmName: 'wlmdb_sqlsvm_1733286308083',
                                    diskName: 'DISK5',
                                    volumeId: 'f3565fd0-91ef-11f0-9e3f-b750f9c1c48e',
                                    diskGroup: 'DATARG',
                                    volumeName: 'extra_volume_150925004922'
                                }
                            ],
                            REDO_LOGS: [
                                {
                                    lunId: '26c5a5aa-3644-4a2b-9ed0-c3732bf346d2',
                                    svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                    lunName: '/vol/asm_log_150925004922/lun1',
                                    svmName: 'wlmdb_sqlsvm_1733286308083',
                                    diskName: 'DISK2',
                                    volumeId: '814b487b-91ef-11f0-9e3f-b750f9c1c48e',
                                    diskGroup: 'DATADG',
                                    volumeName: 'asm_log_150925004922'
                                },
                                {
                                    lunId: '9895da73-40ce-4279-a264-e8681861ccc6',
                                    svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                    lunName: '/vol/asm_recovery_150925004922/lun1',
                                    svmName: 'wlmdb_sqlsvm_1733286308083',
                                    diskName: 'DISK3',
                                    volumeId: 'ab8ef366-91ef-11f0-9e3f-b750f9c1c48e',
                                    diskGroup: 'DATADG',
                                    volumeName: 'asm_recovery_150925004922'
                                },
                                {
                                    lunId: '50224a44-17f3-435f-beea-47723c58499e',
                                    svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                    lunName: '/vol/extra_volume_150925004922/lun1',
                                    svmName: 'wlmdb_sqlsvm_1733286308083',
                                    diskName: 'DISK5',
                                    volumeId: 'f3565fd0-91ef-11f0-9e3f-b750f9c1c48e',
                                    diskGroup: 'DATARG',
                                    volumeName: 'extra_volume_150925004922'
                                }
                            ],
                            DATA_FILES: [
                                {
                                    lunId: '26c5a5aa-3644-4a2b-9ed0-c3732bf346d2',
                                    svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                    lunName: '/vol/asm_log_150925004922/lun1',
                                    svmName: 'wlmdb_sqlsvm_1733286308083',
                                    diskName: 'DISK2',
                                    volumeId: '814b487b-91ef-11f0-9e3f-b750f9c1c48e',
                                    diskGroup: 'DATADG',
                                    volumeName: 'asm_log_150925004922'
                                },
                                {
                                    lunId: '9895da73-40ce-4279-a264-e8681861ccc6',
                                    svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                    lunName: '/vol/asm_recovery_150925004922/lun1',
                                    svmName: 'wlmdb_sqlsvm_1733286308083',
                                    diskName: 'DISK3',
                                    volumeId: 'ab8ef366-91ef-11f0-9e3f-b750f9c1c48e',
                                    diskGroup: 'DATADG',
                                    volumeName: 'asm_recovery_150925004922'
                                }
                            ],
                            TEMP_FILES: [
                                {
                                    lunId: '26c5a5aa-3644-4a2b-9ed0-c3732bf346d2',
                                    svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                    lunName: '/vol/asm_log_150925004922/lun1',
                                    svmName: 'wlmdb_sqlsvm_1733286308083',
                                    diskName: 'DISK2',
                                    volumeId: '814b487b-91ef-11f0-9e3f-b750f9c1c48e',
                                    diskGroup: 'DATADG',
                                    volumeName: 'asm_log_150925004922'
                                },
                                {
                                    lunId: '9895da73-40ce-4279-a264-e8681861ccc6',
                                    svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                    lunName: '/vol/asm_recovery_150925004922/lun1',
                                    svmName: 'wlmdb_sqlsvm_1733286308083',
                                    diskName: 'DISK3',
                                    volumeId: 'ab8ef366-91ef-11f0-9e3f-b750f9c1c48e',
                                    diskGroup: 'DATADG',
                                    volumeName: 'asm_recovery_150925004922'
                                }
                            ],
                            ARCHIVE_LOGS: [],
                            CONTROL_FILES: [
                                {
                                    lunId: '26c5a5aa-3644-4a2b-9ed0-c3732bf346d2',
                                    svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                    lunName: '/vol/asm_log_150925004922/lun1',
                                    svmName: 'wlmdb_sqlsvm_1733286308083',
                                    diskName: 'DISK2',
                                    volumeId: '814b487b-91ef-11f0-9e3f-b750f9c1c48e',
                                    diskGroup: 'DATADG',
                                    volumeName: 'asm_log_150925004922'
                                },
                                {
                                    lunId: '9895da73-40ce-4279-a264-e8681861ccc6',
                                    svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                    lunName: '/vol/asm_recovery_150925004922/lun1',
                                    svmName: 'wlmdb_sqlsvm_1733286308083',
                                    diskName: 'DISK3',
                                    volumeId: 'ab8ef366-91ef-11f0-9e3f-b750f9c1c48e',
                                    diskGroup: 'DATADG',
                                    volumeName: 'asm_recovery_150925004922'
                                },
                                {
                                    lunId: '50224a44-17f3-435f-beea-47723c58499e',
                                    svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                    lunName: '/vol/extra_volume_150925004922/lun1',
                                    svmName: 'wlmdb_sqlsvm_1733286308083',
                                    diskName: 'DISK5',
                                    volumeId: 'f3565fd0-91ef-11f0-9e3f-b750f9c1c48e',
                                    diskGroup: 'DATARG',
                                    volumeName: 'extra_volume_150925004922'
                                }
                            ]
                        },
                        PDB2: {
                            FRA: [
                                {
                                    lunId: '50224a44-17f3-435f-beea-47723c58499e',
                                    svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                    lunName: '/vol/extra_volume_150925004922/lun1',
                                    svmName: 'wlmdb_sqlsvm_1733286308083',
                                    diskName: 'DISK5',
                                    volumeId: 'f3565fd0-91ef-11f0-9e3f-b750f9c1c48e',
                                    diskGroup: 'DATARG',
                                    volumeName: 'extra_volume_150925004922'
                                }
                            ],
                            REDO_LOGS: [
                                {
                                    lunId: '26c5a5aa-3644-4a2b-9ed0-c3732bf346d2',
                                    svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                    lunName: '/vol/asm_log_150925004922/lun1',
                                    svmName: 'wlmdb_sqlsvm_1733286308083',
                                    diskName: 'DISK2',
                                    volumeId: '814b487b-91ef-11f0-9e3f-b750f9c1c48e',
                                    diskGroup: 'DATADG',
                                    volumeName: 'asm_log_150925004922'
                                },
                                {
                                    lunId: '9895da73-40ce-4279-a264-e8681861ccc6',
                                    svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                    lunName: '/vol/asm_recovery_150925004922/lun1',
                                    svmName: 'wlmdb_sqlsvm_1733286308083',
                                    diskName: 'DISK3',
                                    volumeId: 'ab8ef366-91ef-11f0-9e3f-b750f9c1c48e',
                                    diskGroup: 'DATADG',
                                    volumeName: 'asm_recovery_150925004922'
                                },
                                {
                                    lunId: '50224a44-17f3-435f-beea-47723c58499e',
                                    svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                    lunName: '/vol/extra_volume_150925004922/lun1',
                                    svmName: 'wlmdb_sqlsvm_1733286308083',
                                    diskName: 'DISK5',
                                    volumeId: 'f3565fd0-91ef-11f0-9e3f-b750f9c1c48e',
                                    diskGroup: 'DATARG',
                                    volumeName: 'extra_volume_150925004922'
                                }
                            ],
                            DATA_FILES: [
                                {
                                    lunId: '26c5a5aa-3644-4a2b-9ed0-c3732bf346d2',
                                    svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                    lunName: '/vol/asm_log_150925004922/lun1',
                                    svmName: 'wlmdb_sqlsvm_1733286308083',
                                    diskName: 'DISK2',
                                    volumeId: '814b487b-91ef-11f0-9e3f-b750f9c1c48e',
                                    diskGroup: 'DATADG',
                                    volumeName: 'asm_log_150925004922'
                                },
                                {
                                    lunId: '9895da73-40ce-4279-a264-e8681861ccc6',
                                    svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                    lunName: '/vol/asm_recovery_150925004922/lun1',
                                    svmName: 'wlmdb_sqlsvm_1733286308083',
                                    diskName: 'DISK3',
                                    volumeId: 'ab8ef366-91ef-11f0-9e3f-b750f9c1c48e',
                                    diskGroup: 'DATADG',
                                    volumeName: 'asm_recovery_150925004922'
                                }
                            ],
                            TEMP_FILES: [
                                {
                                    lunId: '26c5a5aa-3644-4a2b-9ed0-c3732bf346d2',
                                    svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                    lunName: '/vol/asm_log_150925004922/lun1',
                                    svmName: 'wlmdb_sqlsvm_1733286308083',
                                    diskName: 'DISK2',
                                    volumeId: '814b487b-91ef-11f0-9e3f-b750f9c1c48e',
                                    diskGroup: 'DATADG',
                                    volumeName: 'asm_log_150925004922'
                                },
                                {
                                    lunId: '9895da73-40ce-4279-a264-e8681861ccc6',
                                    svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                    lunName: '/vol/asm_recovery_150925004922/lun1',
                                    svmName: 'wlmdb_sqlsvm_1733286308083',
                                    diskName: 'DISK3',
                                    volumeId: 'ab8ef366-91ef-11f0-9e3f-b750f9c1c48e',
                                    diskGroup: 'DATADG',
                                    volumeName: 'asm_recovery_150925004922'
                                }
                            ],
                            ARCHIVE_LOGS: [],
                            CONTROL_FILES: [
                                {
                                    lunId: '26c5a5aa-3644-4a2b-9ed0-c3732bf346d2',
                                    svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                    lunName: '/vol/asm_log_150925004922/lun1',
                                    svmName: 'wlmdb_sqlsvm_1733286308083',
                                    diskName: 'DISK2',
                                    volumeId: '814b487b-91ef-11f0-9e3f-b750f9c1c48e',
                                    diskGroup: 'DATADG',
                                    volumeName: 'asm_log_150925004922'
                                },
                                {
                                    lunId: '9895da73-40ce-4279-a264-e8681861ccc6',
                                    svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                    lunName: '/vol/asm_recovery_150925004922/lun1',
                                    svmName: 'wlmdb_sqlsvm_1733286308083',
                                    diskName: 'DISK3',
                                    volumeId: 'ab8ef366-91ef-11f0-9e3f-b750f9c1c48e',
                                    diskGroup: 'DATADG',
                                    volumeName: 'asm_recovery_150925004922'
                                },
                                {
                                    lunId: '50224a44-17f3-435f-beea-47723c58499e',
                                    svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                    lunName: '/vol/extra_volume_150925004922/lun1',
                                    svmName: 'wlmdb_sqlsvm_1733286308083',
                                    diskName: 'DISK5',
                                    volumeId: 'f3565fd0-91ef-11f0-9e3f-b750f9c1c48e',
                                    diskGroup: 'DATARG',
                                    volumeName: 'extra_volume_150925004922'
                                }
                            ]
                        },
                        PDB3: {
                            FRA: [
                                {
                                    lunId: '50224a44-17f3-435f-beea-47723c58499e',
                                    svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                    lunName: '/vol/extra_volume_150925004922/lun1',
                                    svmName: 'wlmdb_sqlsvm_1733286308083',
                                    diskName: 'DISK5',
                                    volumeId: 'f3565fd0-91ef-11f0-9e3f-b750f9c1c48e',
                                    diskGroup: 'DATARG',
                                    volumeName: 'extra_volume_150925004922'
                                }
                            ],
                            REDO_LOGS: [
                                {
                                    lunId: '26c5a5aa-3644-4a2b-9ed0-c3732bf346d2',
                                    svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                    lunName: '/vol/asm_log_150925004922/lun1',
                                    svmName: 'wlmdb_sqlsvm_1733286308083',
                                    diskName: 'DISK2',
                                    volumeId: '814b487b-91ef-11f0-9e3f-b750f9c1c48e',
                                    diskGroup: 'DATADG',
                                    volumeName: 'asm_log_150925004922'
                                },
                                {
                                    lunId: '9895da73-40ce-4279-a264-e8681861ccc6',
                                    svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                    lunName: '/vol/asm_recovery_150925004922/lun1',
                                    svmName: 'wlmdb_sqlsvm_1733286308083',
                                    diskName: 'DISK3',
                                    volumeId: 'ab8ef366-91ef-11f0-9e3f-b750f9c1c48e',
                                    diskGroup: 'DATADG',
                                    volumeName: 'asm_recovery_150925004922'
                                },
                                {
                                    lunId: '50224a44-17f3-435f-beea-47723c58499e',
                                    svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                    lunName: '/vol/extra_volume_150925004922/lun1',
                                    svmName: 'wlmdb_sqlsvm_1733286308083',
                                    diskName: 'DISK5',
                                    volumeId: 'f3565fd0-91ef-11f0-9e3f-b750f9c1c48e',
                                    diskGroup: 'DATARG',
                                    volumeName: 'extra_volume_150925004922'
                                }
                            ],
                            DATA_FILES: [
                                {
                                    lunId: '26c5a5aa-3644-4a2b-9ed0-c3732bf346d2',
                                    svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                    lunName: '/vol/asm_log_150925004922/lun1',
                                    svmName: 'wlmdb_sqlsvm_1733286308083',
                                    diskName: 'DISK2',
                                    volumeId: '814b487b-91ef-11f0-9e3f-b750f9c1c48e',
                                    diskGroup: 'DATADG',
                                    volumeName: 'asm_log_150925004922'
                                },
                                {
                                    lunId: '9895da73-40ce-4279-a264-e8681861ccc6',
                                    svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                    lunName: '/vol/asm_recovery_150925004922/lun1',
                                    svmName: 'wlmdb_sqlsvm_1733286308083',
                                    diskName: 'DISK3',
                                    volumeId: 'ab8ef366-91ef-11f0-9e3f-b750f9c1c48e',
                                    diskGroup: 'DATADG',
                                    volumeName: 'asm_recovery_150925004922'
                                }
                            ],
                            TEMP_FILES: [
                                {
                                    lunId: '26c5a5aa-3644-4a2b-9ed0-c3732bf346d2',
                                    svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                    lunName: '/vol/asm_log_150925004922/lun1',
                                    svmName: 'wlmdb_sqlsvm_1733286308083',
                                    diskName: 'DISK2',
                                    volumeId: '814b487b-91ef-11f0-9e3f-b750f9c1c48e',
                                    diskGroup: 'DATADG',
                                    volumeName: 'asm_log_150925004922'
                                },
                                {
                                    lunId: '9895da73-40ce-4279-a264-e8681861ccc6',
                                    svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                    lunName: '/vol/asm_recovery_150925004922/lun1',
                                    svmName: 'wlmdb_sqlsvm_1733286308083',
                                    diskName: 'DISK3',
                                    volumeId: 'ab8ef366-91ef-11f0-9e3f-b750f9c1c48e',
                                    diskGroup: 'DATADG',
                                    volumeName: 'asm_recovery_150925004922'
                                }
                            ],
                            ARCHIVE_LOGS: [],
                            CONTROL_FILES: [
                                {
                                    lunId: '26c5a5aa-3644-4a2b-9ed0-c3732bf346d2',
                                    svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                    lunName: '/vol/asm_log_150925004922/lun1',
                                    svmName: 'wlmdb_sqlsvm_1733286308083',
                                    diskName: 'DISK2',
                                    volumeId: '814b487b-91ef-11f0-9e3f-b750f9c1c48e',
                                    diskGroup: 'DATADG',
                                    volumeName: 'asm_log_150925004922'
                                },
                                {
                                    lunId: '9895da73-40ce-4279-a264-e8681861ccc6',
                                    svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                    lunName: '/vol/asm_recovery_150925004922/lun1',
                                    svmName: 'wlmdb_sqlsvm_1733286308083',
                                    diskName: 'DISK3',
                                    volumeId: 'ab8ef366-91ef-11f0-9e3f-b750f9c1c48e',
                                    diskGroup: 'DATADG',
                                    volumeName: 'asm_recovery_150925004922'
                                },
                                {
                                    lunId: '50224a44-17f3-435f-beea-47723c58499e',
                                    svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                    lunName: '/vol/extra_volume_150925004922/lun1',
                                    svmName: 'wlmdb_sqlsvm_1733286308083',
                                    diskName: 'DISK5',
                                    volumeId: 'f3565fd0-91ef-11f0-9e3f-b750f9c1c48e',
                                    diskGroup: 'DATARG',
                                    volumeName: 'extra_volume_150925004922'
                                }
                            ]
                        }
                    }
                }
            }
        ]
    }
};

export { oracleAssessmentMetadata, oracleInstanceMappedVolMetadata };
