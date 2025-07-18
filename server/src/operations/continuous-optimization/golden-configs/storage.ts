import {
    ASSESSMENT_RESOURCE_TYPE,
    AssessmentStatus,
    AwsWellArchitecturedPillars,
    DEFAULT_MPIO_TIMEOUT,
    SEVERITY
} from '../../../utils/continous-optimization-consts';

const GOLDEN_CONFIG = {
    configuration: {
        volume: [
            {
                parameter: 'thin-provision',
                value: true,
                severity: SEVERITY.CRITICAL,
                recommendation:
                    'To optimize storage efficiency and cost-effectiveness, configure thin provisioning, autosize and space management options for your FSx ONTAP volumes and LUNs\nIf Not Configured Properly:\n- Over-provisioning risks: Without thin provisioning, storage is allocated upfront, leading to inefficient use and higher costs due to over-provisioning.\n- Increased storage costs: Static allocation results in paying for unused capacity, increasing expenses.\n- Limited scalability: Lack of dynamic allocation hampers scalability and flexibility, impacting performance.\n- Inefficient space utilization: Without space reclamation, deleted data occupies space, reducing efficiency.',
                tags: [
                    AwsWellArchitecturedPillars.COST_OPTIMIZATION,
                    AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE
                ]
            },
            {
                parameter: 'autosize',
                value: 'on',
                severity: SEVERITY.CRITICAL,
                recommendation:
                    'To optimize storage efficiency and cost-effectiveness, configure thin provisioning, autosize and space management options for your FSx ONTAP volumes and LUNs\nIf Not Configured Properly:\n- Over-provisioning risks: Without thin provisioning, storage is allocated upfront, leading to inefficient use and higher costs due to over-provisioning.\n- Increased storage costs: Static allocation results in paying for unused capacity, increasing expenses.\n- Limited scalability: Lack of dynamic allocation hampers scalability and flexibility, impacting performance.\n- Inefficient space utilization: Without space reclamation, deleted data occupies space, reducing efficiency.',
                tags: [
                    AwsWellArchitecturedPillars.COST_OPTIMIZATION,
                    AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE
                ]
            },
            {
                parameter: 'autosize-mode',
                value: 'grow',
                severity: SEVERITY.CRITICAL,
                recommendation:
                    'To optimize storage efficiency and cost-effectiveness, configure thin provisioning, autosize and space management options for your FSx ONTAP volumes and LUNs\nIf Not Configured Properly:\n- Over-provisioning risks: Without thin provisioning, storage is allocated upfront, leading to inefficient use and higher costs due to over-provisioning.\n- Increased storage costs: Static allocation results in paying for unused capacity, increasing expenses.\n- Limited scalability: Lack of dynamic allocation hampers scalability and flexibility, impacting performance.\n- Inefficient space utilization: Without space reclamation, deleted data occupies space, reducing efficiency.',
                tags: [
                    AwsWellArchitecturedPillars.COST_OPTIMIZATION,
                    AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE
                ]
            },
            {
                parameter: 'fractional-reserve',
                value: 0,
                severity: SEVERITY.CRITICAL,
                recommendation:
                    'To optimize storage efficiency and cost-effectiveness, configure thin provisioning, autosize and space management options for your FSx ONTAP volumes and LUNs\nIf Not Configured Properly:\n- Over-provisioning risks: Without thin provisioning, storage is allocated upfront, leading to inefficient use and higher costs due to over-provisioning.\n- Increased storage costs: Static allocation results in paying for unused capacity, increasing expenses.\n- Limited scalability: Lack of dynamic allocation hampers scalability and flexibility, impacting performance.\n- Inefficient space utilization: Without space reclamation, deleted data occupies space, reducing efficiency.',
                tags: [
                    AwsWellArchitecturedPillars.COST_OPTIMIZATION,
                    AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE
                ]
            },
            {
                parameter: 'snapshot-copy-reserve',
                value: 0,
                severity: SEVERITY.CRITICAL,
                recommendation:
                    'To optimize storage efficiency and cost-effectiveness, configure thin provisioning, autosize and space management options for your FSx ONTAP volumes and LUNs\nIf Not Configured Properly:\n- Over-provisioning risks: Without thin provisioning, storage is allocated upfront, leading to inefficient use and higher costs due to over-provisioning.\n- Increased storage costs: Static allocation results in paying for unused capacity, increasing expenses.\n- Limited scalability: Lack of dynamic allocation hampers scalability and flexibility, impacting performance.\n- Inefficient space utilization: Without space reclamation, deleted data occupies space, reducing efficiency.',
                tags: [
                    AwsWellArchitecturedPillars.COST_OPTIMIZATION,
                    AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE
                ]
            },
            {
                parameter: 'snapshot-autodelete',
                value: true,
                severity: SEVERITY.WARNING,
                recommendation:
                    'To optimize storage efficiency and cost-effectiveness, configure thin provisioning, autosize and space management options for your FSx ONTAP volumes and LUNs\nIf Not Configured Properly:\n- Over-provisioning risks: Without thin provisioning, storage is allocated upfront, leading to inefficient use and higher costs due to over-provisioning.\n- Increased storage costs: Static allocation results in paying for unused capacity, increasing expenses.\n- Limited scalability: Lack of dynamic allocation hampers scalability and flexibility, impacting performance.\n- Inefficient space utilization: Without space reclamation, deleted data occupies space, reducing efficiency.',
                tags: [
                    AwsWellArchitecturedPillars.COST_OPTIMIZATION,
                    AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE
                ]
            },
            {
                parameter: 'space-mgmt-try-first',
                value: 'volume_grow',
                severity: SEVERITY.WARNING,
                recommendation:
                    'To optimize storage efficiency and cost-effectiveness, configure thin provisioning, autosize and space management options for your FSx ONTAP volumes and LUNs\nIf Not Configured Properly:\n- Over-provisioning risks: Without thin provisioning, storage is allocated upfront, leading to inefficient use and higher costs due to over-provisioning.\n- Increased storage costs: Static allocation results in paying for unused capacity, increasing expenses.\n- Limited scalability: Lack of dynamic allocation hampers scalability and flexibility, impacting performance.\n- Inefficient space utilization: Without space reclamation, deleted data occupies space, reducing efficiency.',
                tags: [
                    AwsWellArchitecturedPillars.COST_OPTIMIZATION,
                    AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE
                ]
            },
            {
                parameter: 'tiering-policy',
                value: 'snapshot_only',
                severity: SEVERITY.CRITICAL,
                recommendation:
                    'For optimal database performance and cost efficiency, Workload Factory recommends moving only snapshots to the capacity tier. This strategy ensures high performance while reducing costs. It is especially recommended to tier snapshots that are older than 7 days.',
                tags: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY]
            },
            {
                parameter: 'tiering-min-cooling-days',
                value: 7,
                severity: SEVERITY.WARNING,
                recommendation:
                    'For optimal database performance and cost efficiency, Workload Factory recommends moving only snapshots to the capacity tier. This strategy ensures high performance while reducing costs. It is especially recommended to tier snapshots that are older than 7 days.',
                tags: [AwsWellArchitecturedPillars.COST_OPTIMIZATION]
            }
        ],
        lun: [
            {
                parameter: 'os-type',
                value: 'windows_2008',
                severity: SEVERITY.CRITICAL,
                recommendation:
                    'ONTAP LUN os type value shall match the operating system partionioning scheme to achieve I/O alignment. Incorrect configuration may result in suboptimal performance',
                tags: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY]
            },
            {
                parameter: 'space-reservation-enabled',
                value: true,
                severity: SEVERITY.CRITICAL,
                recommendation:
                    'When space reservation is enabled, ONTAP reserves enough space in the volume so that writes to those LUNs do not fail because of a lack of disk space.',
                tags: [AwsWellArchitecturedPillars.RELIABILITY]
            },
            {
                parameter: 'space-allocation-allocated',
                value: true,
                severity: SEVERITY.CRITICAL,
                recommendation:
                    'This option ensure FSx ONTAP notifies the EC2 host when the volume is full and cannot accept writes. This setting also allows FSx for ONTAP to automatically reclaim space when SQL Server on the EC2 host deletes data. Failure to enable this option may result in write failures and inefficient space utilization.',
                tags: [AwsWellArchitecturedPillars.RELIABILITY]
            }
        ],
        os: [
            {
                parameter: 'mpio-enabled',
                value: true,
                severity: SEVERITY.CRITICAL,
                recommendation:
                    'To ensure optimal uptime and data access consistency for MSSQL databases on EC2 with underlying LUNs provisioned in FSx for ONTAP, it is recommended to enable and configure Multipath I/O (MPIO). MPIO provides multiple paths to FSx for ONTAP, enhancing both resiliency and performance. This best practice protects against potential data loss or downtime by maintaining data access even if a component fails.',
                tags: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY, AwsWellArchitecturedPillars.RELIABILITY]
            },
            {
                parameter: 'mpio-load-balance-policy',
                value: 'RR',
                severity: SEVERITY.CRITICAL,
                recommendation:
                    'To ensure optimal uptime and data access consistency for MSSQL databases on EC2 with underlying LUNs provisioned in FSx for ONTAP, it is recommended to enable and configure Multipath I/O (MPIO). MPIO provides multiple paths to FSx for ONTAP, enhancing both resiliency and performance. This best practice protects against potential data loss or downtime by maintaining data access even if a component fails.',
                tags: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY, AwsWellArchitecturedPillars.RELIABILITY]
            },
            {
                parameter: 'mpio-iscsi-count',
                value: '5',
                severity: SEVERITY.CRITICAL,
                recommendation:
                    'To ensure optimal uptime and data access consistency for MSSQL databases on EC2 with underlying LUNs provisioned in FSx for ONTAP, it is recommended to enable and configure Multipath I/O (MPIO). MPIO provides multiple paths to FSx for ONTAP, enhancing both resiliency and performance. This best practice protects against potential data loss or downtime by maintaining data access even if a component fails.',
                tags: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY, AwsWellArchitecturedPillars.RELIABILITY]
            },
            {
                parameter: 'ntfs-allocation-unit-size',
                value: 65536,
                severity: SEVERITY.CRITICAL,
                recommendation:
                    'Set NTFS allocation unit size to 64K to better utilize disk space, reduce fragmentation, and improve file read/write performance. Failure to configure this properly may lead to inefficient disk usage and degraded performance.',
                tags: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY]
            },
            {
                parameter: 'mpio-timeout',
                value: DEFAULT_MPIO_TIMEOUT,
                severity: SEVERITY.WARNING,
                recommendation:
                    'Ensure the Multipath I/O Timeout setting on the host is configured to 60 seconds to maintain connectivity and stability during FSxN failovers. Properly configured Multipath I/O Timeout settings prevent disconnections from the disk, which can occur during FSX failovers. Insufficient timeout settings can lead to temporary disconnections, application errors, and potential data loss.',
                tags: [AwsWellArchitecturedPillars.RELIABILITY]
            }
        ]
    },
    layout: [
        {
            parameter: 'default-data-files-location',
            value: 'separate-drive',
            severity: SEVERITY.CRITICAL,
            recommendation:
                'Separating data and log files onto different drives improves performance by allowing simultaneous I/O activity it also allows independent backup schedules and leverage fast and granular restore functionality',
            tags: [
                AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY,
                AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE
            ]
        },
        {
            parameter: 'default-log-files-location',
            value: 'separate-drive',
            severity: SEVERITY.CRITICAL,
            recommendation:
                'Separating data and log files onto different drives improves performance by allowing simultaneous I/O activity it also allows independent backup schedules and leverage fast and granular restore functionality',
            tags: [
                AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY,
                AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE
            ]
        },
        {
            parameter: 'tempdb-files-location',
            value: 'separate-drive',
            severity: SEVERITY.CRITICAL,
            recommendation:
                'Isolate TempDB I/O and avoid I/O contention from other databases by placing TempDB on its own dedicated drive. This optimization improves overall SQL Server performance and stability. Failure to do so can result in significant I/O bottlenecks, slower query performance, and potential system instability.',
            tags: [
                AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY,
                AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE
            ]
        }
    ],
    sizing: [
        {
            parameter: 'performance-tier',
            value: '100%',
            severity: SEVERITY.CRITICAL,
            recommendation:
                'For optimal storage performance, provision FSx ONTAP volumes on the primary SSD tier. Using the capacity pool tier may result in slower performance and high latency',
            tags: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY]
        },
        {
            parameter: 'headroom',
            value: '35%',
            severity: SEVERITY.CRITICAL,
            recommendation:
                'For optimal storage performance, provision file-system capacity to 1.35x times the size of total database usage.',
            tags: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY]
        },
        {
            parameter: 'log-drive-size',
            value: '25%',
            severity: SEVERITY.WARNING,
            recommendation:
                'Ensure accurate sizing and regular monitoring of the SQL Server log drive to prevent issues such as transaction rollbacks, database unavailability, data corruption, and performance degradation caused by a full log drive.',
            tags: [AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE]
        },
        {
            parameter: 'tempdb-drive-size',
            value: '10%',
            severity: SEVERITY.WARNING,
            recommendation:
                'Ensure accurate sizing and regular monitoring of the SQL Server TempDB to optimize performance and maintain overall stability. Properly configured TempDB prevents performance issues and instability. Insufficient space or high contention can lead to query slowdowns, application timeouts, and system crashes.',
            tags: [AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE]
        }
    ],
    resiliency: {
        snapshotPolicy: {
            tags: [AwsWellArchitecturedPillars.RELIABILITY],
            severity: SEVERITY.WARNING,
            recommended: AssessmentStatus.OPTIMIZED,
            resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
            recommendation:
                'Local snapshots allows you to create instantaneous capacity efficient point-in-time images of your data volumes.Use local snapshots as an additional backup mechanism for quick restores or for testing.'
        },
        awsBackup: {
            tags: [AwsWellArchitecturedPillars.RELIABILITY],
            severity: SEVERITY.WARNING,
            resourceType: ASSESSMENT_RESOURCE_TYPE.FILE_SYSTEM,
            recommendation:
                'Scheduled FSx for ONTAP backups recommendation: Backing up your SQL Server volumes is crucial for supporting your data retention and compliance requirements. Use FSx for ONTAP backup to implement a centrally managed, automated backup and retention strategy for your SQL Server data.'
        },
        heartbeatSettings: {
            SameSubnetDelay: 1000,
            SameSubnetThreshold: 10,
            CrossSubnetDelay: 1000,
            CrossSubnetThreshold: 20,
            CrossSiteDelay: 1000,
            CrossSiteThreshold: 20
        },
        highAvailability: {
            sharedStorage: {
                parameter: 'shared-storage',
                value: true,
                severity: SEVERITY.CRITICAL,
                tags: [AwsWellArchitecturedPillars.RELIABILITY],
                resourceType: ASSESSMENT_RESOURCE_TYPE.LUN,
                recommendation: 'All shared disks (iSCSI LUNs) should be accessible by both nodes to allow failover.',
                recommended: ''
            },
            driveLetter: {
                parameter: 'drive-letter-consistency',
                value: true,
                severity: SEVERITY.WARNING,
                tags: [AwsWellArchitecturedPillars.RELIABILITY],
                resourceType: ASSESSMENT_RESOURCE_TYPE.LUN,
                recommendation: 'Validate availability of same drive letters on standby node.',
                recommended: ''
            },
            clusterQuorum: {
                parameter: 'cluster-quorum-configuration',
                value: 'majority',
                severity: SEVERITY.CRITICAL,
                tags: [AwsWellArchitecturedPillars.RELIABILITY],
                resourceType: ASSESSMENT_RESOURCE_TYPE.INSTANCE,
                recommendation: 'The quorum configuration should be appropriate for the cluster size and environment.',
                recommended: ''
            },
            heartbeat: {
                parameter: 'cluster-heartbeat-interval',
                value: 1000,
                severity: SEVERITY.WARNING,
                tags: [AwsWellArchitecturedPillars.RELIABILITY],
                resourceType: ASSESSMENT_RESOURCE_TYPE.INSTANCE,
                recommendation: 'Cluster heartbeat settings should be optimized to prevent unnecessary failovers.',
                recommended: ''
            },
            sqlServerService: {
                parameter: 'sql-server-service-recovery',
                value: 'automatic',
                severity: SEVERITY.CRITICAL,
                tags: [AwsWellArchitecturedPillars.RELIABILITY],
                resourceType: ASSESSMENT_RESOURCE_TYPE.INSTANCE,
                recommendation:
                    'SQL Server services should be set to start automatically and run on the primary node and stopped on the secondary node.',
                recommended: ''
            }
        }
    }
};

export default GOLDEN_CONFIG;
