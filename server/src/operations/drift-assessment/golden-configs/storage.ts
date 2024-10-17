import { AwsWellArchitecturedPillars } from '../../../utils/consts';

const GOLDEN_CONFIG = {
    configuration: {
        volume: [
            {
                parameter: 'thin-provision',
                value: true,
                severity: 'critical',
                recommendation:
                    'To optimize storage efficiency and cost-effectiveness, configure thin provisioning for your FSx ONTAP volumes and LUNs\nIf Not Configured Properly:\n- Over-provisioning risks: Without thin provisioning, storage is allocated upfront, leading to inefficient use and higher costs due to over-provisioning.\n- Increased storage costs: Static allocation results in paying for unused capacity, increasing expenses.\n- Limited scalability: Lack of dynamic allocation hampers scalability and flexibility, impacting performance.\n- Inefficient space utilization: Without space reclamation, deleted data occupies space, reducing efficiency.',
                tags: [
                    AwsWellArchitecturedPillars.COST_OPTIMIZATION,
                    AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE
                ]
            },
            {
                parameter: 'autosize',
                value: 'on',
                severity: 'critical',
                recommendation:
                    'To optimize storage efficiency and cost-effectiveness, configure thin provisioning for your FSx ONTAP volumes and LUNs\nIf Not Configured Properly:\n- Over-provisioning risks: Without thin provisioning, storage is allocated upfront, leading to inefficient use and higher costs due to over-provisioning.\n- Increased storage costs: Static allocation results in paying for unused capacity, increasing expenses.\n- Limited scalability: Lack of dynamic allocation hampers scalability and flexibility, impacting performance.\n- Inefficient space utilization: Without space reclamation, deleted data occupies space, reducing efficiency.',
                tags: [
                    AwsWellArchitecturedPillars.COST_OPTIMIZATION,
                    AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE
                ]
            },
            {
                parameter: 'autosize-mode',
                value: 'grow',
                severity: 'critical',
                recommendation:
                    'To optimize storage efficiency and cost-effectiveness, configure thin provisioning for your FSx ONTAP volumes and LUNs\nIf Not Configured Properly:\n- Over-provisioning risks: Without thin provisioning, storage is allocated upfront, leading to inefficient use and higher costs due to over-provisioning.\n- Increased storage costs: Static allocation results in paying for unused capacity, increasing expenses.\n- Limited scalability: Lack of dynamic allocation hampers scalability and flexibility, impacting performance.\n- Inefficient space utilization: Without space reclamation, deleted data occupies space, reducing efficiency.',
                tags: [
                    AwsWellArchitecturedPillars.COST_OPTIMIZATION,
                    AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE
                ]
            },
            {
                parameter: 'fractional-reserve',
                value: 0,
                severity: 'critical',
                recommendation:
                    'To optimize storage efficiency and cost-effectiveness, configure thin provisioning for your FSx ONTAP volumes and LUNs\nIf Not Configured Properly:\n- Over-provisioning risks: Without thin provisioning, storage is allocated upfront, leading to inefficient use and higher costs due to over-provisioning.\n- Increased storage costs: Static allocation results in paying for unused capacity, increasing expenses.\n- Limited scalability: Lack of dynamic allocation hampers scalability and flexibility, impacting performance.\n- Inefficient space utilization: Without space reclamation, deleted data occupies space, reducing efficiency.',
                tags: [
                    AwsWellArchitecturedPillars.COST_OPTIMIZATION,
                    AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE
                ]
            },
            {
                parameter: 'snapshot-copy-reserve',
                value: 0,
                severity: 'critical',
                recommendation:
                    'To optimize storage efficiency and cost-effectiveness, configure thin provisioning for your FSx ONTAP volumes and LUNs\nIf Not Configured Properly:\n- Over-provisioning risks: Without thin provisioning, storage is allocated upfront, leading to inefficient use and higher costs due to over-provisioning.\n- Increased storage costs: Static allocation results in paying for unused capacity, increasing expenses.\n- Limited scalability: Lack of dynamic allocation hampers scalability and flexibility, impacting performance.\n- Inefficient space utilization: Without space reclamation, deleted data occupies space, reducing efficiency.',
                tags: [
                    AwsWellArchitecturedPillars.COST_OPTIMIZATION,
                    AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE
                ]
            },
            {
                parameter: 'snapshot-autodelete',
                value: true,
                severity: 'warning',
                recommendation:
                    'To optimize storage efficiency and cost-effectiveness, configure thin provisioning for your FSx ONTAP volumes and LUNs\nIf Not Configured Properly:\n- Over-provisioning risks: Without thin provisioning, storage is allocated upfront, leading to inefficient use and higher costs due to over-provisioning.\n- Increased storage costs: Static allocation results in paying for unused capacity, increasing expenses.\n- Limited scalability: Lack of dynamic allocation hampers scalability and flexibility, impacting performance.\n- Inefficient space utilization: Without space reclamation, deleted data occupies space, reducing efficiency.',
                tags: [
                    AwsWellArchitecturedPillars.COST_OPTIMIZATION,
                    AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE
                ]
            },
            {
                parameter: 'space-mgmt-try-first',
                value: 'volume_grow',
                severity: 'warning',
                recommendation:
                    'To optimize storage efficiency and cost-effectiveness, configure thin provisioning for your FSx ONTAP volumes and LUNs\nIf Not Configured Properly:\n- Over-provisioning risks: Without thin provisioning, storage is allocated upfront, leading to inefficient use and higher costs due to over-provisioning.\n- Increased storage costs: Static allocation results in paying for unused capacity, increasing expenses.\n- Limited scalability: Lack of dynamic allocation hampers scalability and flexibility, impacting performance.\n- Inefficient space utilization: Without space reclamation, deleted data occupies space, reducing efficiency.',
                tags: [
                    AwsWellArchitecturedPillars.COST_OPTIMIZATION,
                    AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE
                ]
            },
            {
                parameter: 'tiering-policy',
                value: 'snapshot_only',
                severity: 'critical',
                recommendation:
                    'To optimize storage efficiency and cost-effectiveness, configure thin provisioning for your FSx ONTAP volumes and LUNs\nIf Not Configured Properly:\n- Over-provisioning risks: Without thin provisioning, storage is allocated upfront, leading to inefficient use and higher costs due to over-provisioning.\n- Increased storage costs: Static allocation results in paying for unused capacity, increasing expenses.\n- Limited scalability: Lack of dynamic allocation hampers scalability and flexibility, impacting performance.\n- Inefficient space utilization: Without space reclamation, deleted data occupies space, reducing efficiency.',
                tags: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY]
            },
            {
                parameter: 'tiering-min-cooling-days',
                value: 7,
                severity: 'warning',
                recommendation: '',
                tags: [AwsWellArchitecturedPillars.COST_OPTIMIZATION]
            }
        ],
        lun: [
            {
                parameter: 'os-type',
                value: 'windows_2008',
                severity: 'critical',
                recommendation:
                    'ONTAP LUN os type value shall match the operating system partionioning scheme to achieve I/O alignment. Incorrect configuration may result in suboptimal performance',
                tags: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY]
            },
            {
                parameter: 'space-reservation-enabled',
                value: true,
                severity: 'critical',
                recommendation:
                    'When space reservation is enabled, ONTAP reserves enough space in the volume so that writes to those LUNs do not fail because of a lack of disk space.',
                tags: [AwsWellArchitecturedPillars.RELIABILITY]
            },
            {
                parameter: 'space-allocation-allocated',
                value: true,
                severity: 'critical',
                recommendation:
                    'This option ensure FSx ONTAP notifies the EC2 host when the volume is full and cannot accept writes. This setting also allows FSx for ONTAP to automatically reclaim space when SQL Server on the EC2 host deletes data. Failure to enable this option may result in write failures and inefficient space utilization.',
                tags: [AwsWellArchitecturedPillars.RELIABILITY]
            }
        ],
        os: [
            {
                parameter: 'mpio-enabled',
                value: true,
                severity: 'critical',
                recommendation:
                    'To ensure optimal uptime and data access consistency for MSSQL databases on EC2 with underlying LUNs provisioned in FSx for ONTAP, it is recommended to enable and configure Multipath I/O (MPIO). MPIO provides multiple paths to FSx for ONTAP, enhancing both resiliency and performance. This best practice protects against potential data loss or downtime by maintaining data access even if a component fails.',
                tags: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY, AwsWellArchitecturedPillars.RELIABILITY]
            },
            {
                parameter: 'mpio-load-balance-policy',
                value: 'RR',
                severity: 'critical',
                recommendation:
                    'To ensure optimal uptime and data access consistency for MSSQL databases on EC2 with underlying LUNs provisioned in FSx for ONTAP, it is recommended to enable and configure Multipath I/O (MPIO). MPIO provides multiple paths to FSx for ONTAP, enhancing both resiliency and performance. This best practice protects against potential data loss or downtime by maintaining data access even if a component fails.',
                tags: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY, AwsWellArchitecturedPillars.RELIABILITY]
            },
            {
                parameter: 'mpio-iscsi-count',
                value: '5',
                severity: 'critical',
                recommendation:
                    'To ensure optimal uptime and data access consistency for MSSQL databases on EC2 with underlying LUNs provisioned in FSx for ONTAP, it is recommended to enable and configure Multipath I/O (MPIO). MPIO provides multiple paths to FSx for ONTAP, enhancing both resiliency and performance. This best practice protects against potential data loss or downtime by maintaining data access even if a component fails.',
                tags: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY, AwsWellArchitecturedPillars.RELIABILITY]
            },
            {
                parameter: 'ntfs-allocation-unit-size',
                value: 65536,
                severity: 'critical',
                recommendation:
                    'Set NTFS allocation unit size to 64K to better utilize disk space, reduce fragmentation, and improve file read/write performance. Failure to configure this properly may lead to inefficient disk usage and degraded performance.',
                tags: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY]
            }
        ]
    },
    layout: [
        {
            parameter: 'default-data-files-location',
            value: 'separate-drive',
            severity: 'critical',
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
            severity: 'critical',
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
            severity: 'critical',
            recommendation:
                'Isolate TempDB I/O from other databases by placing TempDB on its own dedicated drive to avoid I/O contention. This optimization improves overall SQL Server performance and stability. Failure to do so can result in significant I/O bottlenecks, slower query performance, and potential system instability.',
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
            severity: 'critical',
            recommendation:
                'For optimal storage performance, provision FSx ONTAP volumes on the primary SSD tier. Using the capacity tier may result in slower performance and high latency',
            tags: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY]
        },
        {
            parameter: 'headroom',
            value: '36-100%',
            severity: 'critical',
            recommendation:
                'For optimal storage performance, provision file-system capacity to 1.35x times the size of total database usage.',
            tags: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY]
        },
        {
            parameter: 'log-drive-size',
            value: '20-30%',
            severity: 'warning',
            recommendation:
                'Ensure proper sizing and regular monitoring of the SQL Server log drive to prevent issues such as transaction rollbacks, database unavailability, data corruption, and performance degradation caused by a full log drive.',
            tags: [AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE]
        },
        {
            parameter: 'tempdb-drive-size',
            value: '10-20%',
            severity: 'warning',
            recommendation:
                'Ensure proper sizing and regular monitoring of the SQL Server TempDB to optimize performance and maintain overall stability. Properly configured TempDB prevents performance issues and instability. Insufficient space or high contention can lead to query slowdowns, application timeouts, and system crashes.',
            tags: [AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE]
        }
    ]
};

export default GOLDEN_CONFIG;
