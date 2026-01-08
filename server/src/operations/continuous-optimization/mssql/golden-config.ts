import {
    ASSESSMENT_RESOURCE_TYPE,
    AssessmentStatus,
    AwsWellArchitecturedPillars,
    DEFAULT_MPIO_TIMEOUT,
    MIN_OPTIMIZED_HEADROOM_PERCENTAGE,
    SEVERITY
} from '../../../utils/continous-optimization-consts';

const GOLDEN_CONFIG = {
    configuration: {
        volume: [
            {
                parameter: 'thin-provision',
                value: true,
                category: 'storage',
                subCategory: 'configuration',
                focusWidgetName: 'ONTAP',
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
                category: 'storage',
                subCategory: 'configuration',
                focusWidgetName: 'ONTAP',
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
                category: 'storage',
                subCategory: 'configuration',
                focusWidgetName: 'ONTAP',
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
                category: 'storage',
                subCategory: 'configuration',
                focusWidgetName: 'ONTAP',
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
                category: 'storage',
                subCategory: 'configuration',
                focusWidgetName: 'ONTAP',
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
                category: 'storage',
                subCategory: 'configuration',
                focusWidgetName: 'ONTAP',
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
                category: 'storage',
                subCategory: 'configuration',
                focusWidgetName: 'ONTAP',
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
                category: 'storage',
                subCategory: 'configuration',
                focusWidgetName: 'ONTAP',
                severity: SEVERITY.CRITICAL,
                recommendation:
                    'For optimal database performance and cost efficiency, Workload Factory recommends moving only snapshots to the capacity tier. This strategy ensures high performance while reducing costs. It is especially recommended to tier snapshots that are older than 7 days.',
                tags: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY]
            },
            {
                parameter: 'tiering-min-cooling-days',
                value: 7,
                category: 'storage',
                subCategory: 'configuration',
                focusWidgetName: 'ONTAP',
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
                category: 'storage',
                subCategory: 'configuration',
                focusWidgetName: 'ONTAP',
                severity: SEVERITY.CRITICAL,
                recommendation:
                    'ONTAP LUN os type value shall match the operating system partionioning scheme to achieve I/O alignment. Incorrect configuration may result in suboptimal performance',
                tags: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY]
            },
            {
                parameter: 'space-reservation-enabled',
                value: true,
                category: 'storage',
                subCategory: 'configuration',
                focusWidgetName: 'ONTAP',
                severity: SEVERITY.CRITICAL,
                recommendation:
                    'When space reservation is enabled, ONTAP reserves enough space in the volume so that writes to those LUNs do not fail because of a lack of disk space.',
                tags: [AwsWellArchitecturedPillars.RELIABILITY]
            },
            {
                parameter: 'space-allocation-allocated',
                value: true,
                category: 'storage',
                subCategory: 'configuration',
                focusWidgetName: 'ONTAP',
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
                category: 'storage',
                subCategory: 'configuration',
                focusWidgetName: 'Operating system',
                severity: SEVERITY.CRITICAL,
                recommendation:
                    'To ensure optimal uptime and data access consistency for MSSQL databases on EC2 with underlying LUNs provisioned in FSx for ONTAP, it is recommended to enable and configure Multipath I/O (MPIO). MPIO provides multiple paths to FSx for ONTAP, enhancing both resiliency and performance. This best practice protects against potential data loss or downtime by maintaining data access even if a component fails.',
                tags: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY, AwsWellArchitecturedPillars.RELIABILITY],
                resourceType: ASSESSMENT_RESOURCE_TYPE.STORAGE_MULTIPATH
            },
            {
                parameter: 'mpio-load-balance-policy',
                value: 'RR',
                category: 'storage',
                subCategory: 'configuration',
                focusWidgetName: 'Operating system',
                severity: SEVERITY.CRITICAL,
                recommendation:
                    'To ensure optimal uptime and data access consistency for MSSQL databases on EC2 with underlying LUNs provisioned in FSx for ONTAP, it is recommended to enable and configure Multipath I/O (MPIO). MPIO provides multiple paths to FSx for ONTAP, enhancing both resiliency and performance. This best practice protects against potential data loss or downtime by maintaining data access even if a component fails.',
                tags: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY, AwsWellArchitecturedPillars.RELIABILITY],
                resourceType: ASSESSMENT_RESOURCE_TYPE.DRIVE
            },
            {
                parameter: 'mpio-iscsi-count',
                value: '5',
                category: 'storage',
                subCategory: 'configuration',
                focusWidgetName: 'Operating system',
                severity: SEVERITY.CRITICAL,
                recommendation:
                    'To ensure optimal uptime and data access consistency for MSSQL databases on EC2 with underlying LUNs provisioned in FSx for ONTAP, it is recommended to enable and configure Multipath I/O (MPIO). MPIO provides multiple paths to FSx for ONTAP, enhancing both resiliency and performance. This best practice protects against potential data loss or downtime by maintaining data access even if a component fails.',
                tags: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY, AwsWellArchitecturedPillars.RELIABILITY],
                resourceType: ASSESSMENT_RESOURCE_TYPE.STORAGE_MULTIPATH
            },
            {
                parameter: 'ntfs-allocation-unit-size',
                value: 65536,
                category: 'storage',
                subCategory: 'configuration',
                focusWidgetName: 'Operating system',
                severity: SEVERITY.CRITICAL,
                recommendation:
                    'Set NTFS allocation unit size to 64K to better utilize disk space, reduce fragmentation, and improve file read/write performance. Failure to configure this properly may lead to inefficient disk usage and degraded performance.',
                tags: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY],
                resourceType: ASSESSMENT_RESOURCE_TYPE.DRIVE
            },
            {
                parameter: 'mpio-timeout',
                value: DEFAULT_MPIO_TIMEOUT,
                category: 'storage',
                subCategory: 'configuration',
                focusWidgetName: 'Operating system',
                severity: SEVERITY.WARNING,
                recommendation:
                    'Ensure the Multipath I/O Timeout setting on the host is configured to 60 seconds to maintain connectivity and stability during FSxN failovers. Properly configured Multipath I/O Timeout settings prevent disconnections from the disk, which can occur during FSX failovers. Insufficient timeout settings can lead to temporary disconnections, application errors, and potential data loss.',
                tags: [AwsWellArchitecturedPillars.RELIABILITY],
                resourceType: ASSESSMENT_RESOURCE_TYPE.STORAGE_MULTIPATH
            }
        ]
    },
    layout: [
        {
            parameter: 'default-data-files-location',
            value: 'separate-drive',
            category: 'storage',
            subCategory: 'layout',
            focusWidgetName: 'Data files (.mdf)',
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
            category: 'storage',
            subCategory: 'layout',
            focusWidgetName: 'Log Files (.ldf)',
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
            category: 'storage',
            subCategory: 'layout',
            focusWidgetName: 'TempDB placement',
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
            category: 'storage',
            subCategory: 'sizing',
            focusWidgetName: 'Storage tier',
            severity: SEVERITY.CRITICAL,
            recommendation:
                'For optimal storage performance, provision FSx ONTAP volumes on the primary SSD tier. Using the capacity pool tier may result in slower performance and high latency',
            tags: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY]
        },
        {
            parameter: 'headroom',
            value: `${MIN_OPTIMIZED_HEADROOM_PERCENTAGE.MSSQL}%`,
            category: 'storage',
            subCategory: 'sizing',
            focusWidgetName: 'File system headroom',
            severity: SEVERITY.CRITICAL,
            recommendation:
                'For optimal storage performance, provision file-system capacity to 1.35x times the size of total database usage.',
            tags: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY]
        },
        {
            parameter: 'log-drive-size',
            value: '25%',
            category: 'storage',
            subCategory: 'sizing',
            focusWidgetName: 'Log drive size',
            severity: SEVERITY.WARNING,
            recommendation:
                'Ensure accurate sizing and regular monitoring of the SQL Server log drive to prevent issues such as transaction rollbacks, database unavailability, data corruption, and performance degradation caused by a full log drive.',
            tags: [AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE]
        },
        {
            parameter: 'tempdb-drive-size',
            value: '10%',
            category: 'storage',
            subCategory: 'sizing',
            focusWidgetName: 'TempDB drive size',
            severity: SEVERITY.WARNING,
            recommendation:
                'Ensure accurate sizing and regular monitoring of the SQL Server TempDB to optimize performance and maintain overall stability. Properly configured TempDB prevents performance issues and instability. Insufficient space or high contention can lead to query slowdowns, application timeouts, and system crashes.',
            tags: [AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE]
        }
    ],
    mtuAlignment: {
        name: 'mtu-alignment',
        status: AssessmentStatus.OPTIMIZED,
        recommended: AssessmentStatus.OPTIMIZED,
        category: 'compute',
        subCategory: 'compute',
        focusWidgetName: 'MTU alignment',
        severity: SEVERITY.CRITICAL,
        recommendation:
            'Workload Factory recommends aligning EC2 instance Maximum Transmission Unit (MTU) settings with your FSX for ONTAP file system to prevent network fragmentation and optimize SQL Server performance. Fixing MTU misalignment ensures consistent MTU configuration across all nodes and network paths.',
        tags: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY, AwsWellArchitecturedPillars.RELIABILITY],
        resourceType: ASSESSMENT_RESOURCE_TYPE.NETWORK_INTERFACE
    },
    resiliency: {
        snapshotPolicy: {
            tags: [AwsWellArchitecturedPillars.RELIABILITY],
            category: 'resiliency',
            subCategory: 'resiliency',
            focusWidgetName: 'Scheduled local snapshot',
            severity: SEVERITY.WARNING,
            recommended: AssessmentStatus.OPTIMIZED,
            resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
            recommendation:
                'Local snapshots allows you to create instantaneous capacity efficient point-in-time images of your data volumes.Use local snapshots as an additional backup mechanism for quick restores or for testing.'
        },
        awsBackup: {
            tags: [AwsWellArchitecturedPillars.RELIABILITY],
            category: 'resiliency',
            subCategory: 'resiliency',
            focusWidgetName: 'Backup Configuration',
            severity: SEVERITY.WARNING,
            resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
            recommendation:
                'Backup Configuration recommendation: Enable FSx Backup or AWS Backup for SQL Server volumes to support data retention and compliance. If using both, consider removing redundant backups manually.'
        },
        heartbeatSettings: {
            SameSubnetDelay: 1000,
            SameSubnetThreshold: 40,
            CrossSubnetDelay: 1000,
            CrossSubnetThreshold: 40,
            CrossSiteDelay: 1000,
            CrossSiteThreshold: 40
        },
        highAvailability: {
            sharedStorage: {
                parameter: 'shared-storage',
                value: true,
                category: 'resiliency',
                subCategory: 'highAvailability',
                focusWidgetName: 'Microsoft SQL Server High Availability',
                severity: SEVERITY.CRITICAL,
                tags: [AwsWellArchitecturedPillars.RELIABILITY],
                resourceType: ASSESSMENT_RESOURCE_TYPE.LUN,
                recommendation:
                    'All shared disks (iSCSI LUNs) must be accessible by both nodes in the FCI deployment model to allow failover.',
                recommended: ''
            },
            driveLetter: {
                parameter: 'drive-letter-consistency',
                value: true,
                category: 'resiliency',
                subCategory: 'highAvailability',
                focusWidgetName: 'Microsoft SQL Server High Availability',
                severity: SEVERITY.CRITICAL,
                tags: [AwsWellArchitecturedPillars.RELIABILITY],
                resourceType: ASSESSMENT_RESOURCE_TYPE.DRIVE,
                recommendation: 'Validate availability of the same drive letters on the secondary node.',
                recommended: ''
            },
            clusterQuorum: {
                parameter: 'cluster-quorum-configuration',
                value: 'majority',
                category: 'resiliency',
                subCategory: 'highAvailability',
                focusWidgetName: 'Microsoft SQL Server High Availability',
                severity: SEVERITY.CRITICAL,
                tags: [AwsWellArchitecturedPillars.RELIABILITY],
                resourceType: ASSESSMENT_RESOURCE_TYPE.INSTANCE,
                recommendation:
                    'The quorum configuration should be tailored to a 2-node Windows Failover Cluster, using Node and Disk Majority with a Disk Witness to ensure high availability.',
                recommended: ''
            },
            heartbeat: {
                parameter: 'cluster-heartbeat-interval',
                value: 1000,
                category: 'resiliency',
                subCategory: 'highAvailability',
                focusWidgetName: 'Microsoft SQL Server High Availability',
                severity: SEVERITY.CRITICAL,
                tags: [AwsWellArchitecturedPillars.RELIABILITY],
                resourceType: ASSESSMENT_RESOURCE_TYPE.INSTANCE,
                recommendation:
                    'Set heartbeat thresholds to 40 heartbeats, specifically optimized for cloud deployments, to ensure high availability and prevent unnecessary failovers.',
                recommended: ''
            },
            sqlServerService: {
                parameter: 'sql-server-service-recovery',
                value: 'automatic',
                category: 'resiliency',
                subCategory: 'highAvailability',
                focusWidgetName: 'Microsoft SQL Server High Availability',
                severity: SEVERITY.CRITICAL,
                tags: [AwsWellArchitecturedPillars.RELIABILITY],
                resourceType: ASSESSMENT_RESOURCE_TYPE.INSTANCE,
                recommendation:
                    'SQL Server services must be set to start automatically and run on the primary node and stop on the secondary node.',
                recommended: ''
            }
        }
    },
    cloning: {
        tags: [AwsWellArchitecturedPillars.COST_EFFICIENCY],
        category: 'cloning',
        subCategory: 'cloning',
        focusWidgetName: 'Clone cleanup',
        severity: SEVERITY.WARNING,
        resourceType: ASSESSMENT_RESOURCE_TYPE.DATABASE,
        recommendation:
            'Old and divergent clones can incur significant costs. Consider deleting or refreshing these clones to optimize your storage expenses.'
    },
    hostOsPatch: {
        tags: [AwsWellArchitecturedPillars.SECURITY, AwsWellArchitecturedPillars.RELIABILITY],
        category: 'compute',
        subCategory: 'compute',
        focusWidgetName: 'Operating system patch',
        severity: SEVERITY.CRITICAL,
        resourceType: ASSESSMENT_RESOURCE_TYPE.INSTANCE,
        recommendation:
            'Critical security patches are missing. We recommend applying the latest patches to ensure your database infrastructure is secure and up-to-date.'
    },
    license: {
        tags: [AwsWellArchitecturedPillars.COST_OPTIMIZATION],
        category: 'application',
        subCategory: 'application',
        focusWidgetName: 'License',
        severity: SEVERITY.WARNING,
        resourceType: ASSESSMENT_RESOURCE_TYPE.INSTANCE,
        recommendation:
            'When Workload Factory detects that your database infrastructure is not using any of the commercial software license features you are paying for, a license is considered not optimized. A license that is not optimized might result in unnecessary additional costs.'
    },
    maxdop: {
        tags: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY],
        category: 'application',
        subCategory: 'application',
        focusWidgetName: 'MAXDOP',
        severity: SEVERITY.WARNING,
        resourceType: ASSESSMENT_RESOURCE_TYPE.SQL_INSTANCE,
        recommendation:
            'For optimal performance, it is recommended to set max degree of parallelism (MAXDOP) to 4 if the number of virtual CPUs is less than or equal to 8, 8 if the number of vCPUs is between 9 and 16, and 16 if the number of vCPUs is greater than 16. Your current settings are not optimized.'
    },
    mssqlPatch: {
        tags: [AwsWellArchitecturedPillars.SECURITY, AwsWellArchitecturedPillars.RELIABILITY],
        category: 'application',
        subCategory: 'application',
        focusWidgetName: 'Microsoft SQL Server patch',
        severity: SEVERITY.CRITICAL,
        resourceType: ASSESSMENT_RESOURCE_TYPE.INSTANCE,
        recommendation:
            'Critical (criticalPatchesCount) and important (importantPatchesCount) patches are missing. We recommend applying the latest patches to ensure your MSSQL instance is secure and up-to-date.'
    },
    rssConfig: {
        tags: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY],
        category: 'compute',
        subCategory: 'compute',
        focusWidgetName: 'Network adapter settings',
        severity: SEVERITY.WARNING,
        resourceType: ASSESSMENT_RESOURCE_TYPE.NETWORK_ADAPTER,
        recommendation:
            'To enhance network performance and system efficiency for your SQL Server EC2 instance, we recommend optimizing your Receive Side Scaling (RSS) configuration. Proper RSS settings distribute network processing across multiple processors, reducing latency and improving application responsiveness. Adhering to best practices ensures efficient handling of network traffic, leading to better stability and reliability.'
    }
};

export default GOLDEN_CONFIG;
