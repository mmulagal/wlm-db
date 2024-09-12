const GOLDEN_CONFIG = {
    configuration: {
        volume: [
            {
                parameter: 'thin-provision',
                value: true,
                severity: 'critical',
                recommendation: `To optimize storage efficiency and cost-effectiveness, configure thin provisioning for your FSx ONTAP volumes and LUNs
                     If Not Configured Properly:
                     - Over-provisioning risks: Without thin provisioning, storage is allocated upfront, leading to inefficient use and higher costs due to over-provisioning.
                     - Increased storage costs: Static allocation results in paying for unused capacity, increasing expenses.
                     - Limited scalability: Lack of dynamic allocation hampers scalability and flexibility, impacting performance.
                     - Inefficient space utilization: Without space reclamation, deleted data occupies space, reducing efficiency.`
            },
            {
                parameter: 'autosize',
                value: 'on',
                severity: 'critical',
                recommendation: `To optimize storage efficiency and cost-effectiveness, configure thin provisioning for your FSx ONTAP volumes and LUNs
                     If Not Configured Properly:
                     - Over-provisioning risks: Without thin provisioning, storage is allocated upfront, leading to inefficient use and higher costs due to over-provisioning.
                     - Increased storage costs: Static allocation results in paying for unused capacity, increasing expenses.
                     - Limited scalability: Lack of dynamic allocation hampers scalability and flexibility, impacting performance.
                     - Inefficient space utilization: Without space reclamation, deleted data occupies space, reducing efficiency.`
            },
            {
                parameter: 'autosize-mode',
                value: 'grow',
                severity: 'critical',
                recommendation: `To optimize storage efficiency and cost-effectiveness, configure thin provisioning for your FSx ONTAP volumes and LUNs
                    If Not Configured Properly:
                    - Over-provisioning risks: Without thin provisioning, storage is allocated upfront, leading to inefficient use and higher costs due to over-provisioning.
                    - Increased storage costs: Static allocation results in paying for unused capacity, increasing expenses.
                    - Limited scalability: Lack of dynamic allocation hampers scalability and flexibility, impacting performance.
                    - Inefficient space utilization: Without space reclamation, deleted data occupies space, reducing efficiency.`
            },
            {
                parameter: 'fractional-reserve',
                value: 0,
                severity: 'critical',
                recommendation: `To optimize storage efficiency and cost-effectiveness, configure thin provisioning for your FSx ONTAP volumes and LUNs
                    If Not Configured Properly:
                    - Over-provisioning risks: Without thin provisioning, storage is allocated upfront, leading to inefficient use and higher costs due to over-provisioning.
                    - Increased storage costs: Static allocation results in paying for unused capacity, increasing expenses.
                    - Limited scalability: Lack of dynamic allocation hampers scalability and flexibility, impacting performance.
                    - Inefficient space utilization: Without space reclamation, deleted data occupies space, reducing efficiency.`
            },
            {
                parameter: 'snapshot-copy-reserve',
                value: 0,
                severity: 'critical',
                recommendation: `To optimize storage efficiency and cost-effectiveness, configure thin provisioning for your FSx ONTAP volumes and LUNs
                    If Not Configured Properly:
                    - Over-provisioning risks: Without thin provisioning, storage is allocated upfront, leading to inefficient use and higher costs due to over-provisioning.
                    - Increased storage costs: Static allocation results in paying for unused capacity, increasing expenses.
                    - Limited scalability: Lack of dynamic allocation hampers scalability and flexibility, impacting performance.
                    - Inefficient space utilization: Without space reclamation, deleted data occupies space, reducing efficiency.`
            },
            {
                parameter: 'snapshot-autodelete',
                value: true,
                severity: 'warning',
                recommendation: `To optimize storage efficiency and cost-effectiveness, configure thin provisioning for your FSx ONTAP volumes and LUNs
                    If Not Configured Properly:
                    - Over-provisioning risks: Without thin provisioning, storage is allocated upfront, leading to inefficient use and higher costs due to over-provisioning.
                    - Increased storage costs: Static allocation results in paying for unused capacity, increasing expenses.
                    - Limited scalability: Lack of dynamic allocation hampers scalability and flexibility, impacting performance.
                    - Inefficient space utilization: Without space reclamation, deleted data occupies space, reducing efficiency.`
            },
            {
                parameter: 'space-mgmt-try-first',
                value: 'volume_grow',
                severity: 'warning',
                recommendation: `To optimize storage efficiency and cost-effectiveness, configure thin provisioning for your FSx ONTAP volumes and LUNs
                    If Not Configured Properly:
                    - Over-provisioning risks: Without thin provisioning, storage is allocated upfront, leading to inefficient use and higher costs due to over-provisioning.
                    - Increased storage costs: Static allocation results in paying for unused capacity, increasing expenses.
                    - Limited scalability: Lack of dynamic allocation hampers scalability and flexibility, impacting performance.
                    - Inefficient space utilization: Without space reclamation, deleted data occupies space, reducing efficiency.`
            },
            {
                parameter: 'tiering-policy',
                value: 'snapshot_only',
                severity: 'critical',
                recommendation: `To optimize storage efficiency and cost-effectiveness, configure thin provisioning for your FSx ONTAP volumes and LUNs
                    If Not Configured Properly:
                    - Over-provisioning risks: Without thin provisioning, storage is allocated upfront, leading to inefficient use and higher costs due to over-provisioning.
                    - Increased storage costs: Static allocation results in paying for unused capacity, increasing expenses.
                    - Limited scalability: Lack of dynamic allocation hampers scalability and flexibility, impacting performance.
                    - Inefficient space utilization: Without space reclamation, deleted data occupies space, reducing efficiency.`
            },
            {
                parameter: 'tiering-min-cooling-days',
                value: 7,
                severity: 'warning',
                recommendation: ''
            }
        ],
        lun: [
            {
                parameter: 'os-type',
                value: 'windows_2008',
                severity: 'critical',
                recommendation:
                    'ONTAP LUN os type value shall match the operating system partionioning scheme to achieve I/O alignment. Incorrect configuration may result in suboptimal performance'
            },
            {
                parameter: 'space-reservation-enabled',
                value: true,
                severity: 'critical',
                recommendation:
                    'When space reservation is enabled, ONTAP reserves enough space in the volume so that writes to those LUNs do not fail because of a lack of disk space.'
            },
            {
                parameter: 'space-allocation-allocated',
                value: true,
                severity: 'critical',
                recommendation:
                    'This option ensure FSx ONTAP notifies the EC2 host when the volume is full and cannot accept writes. This setting also allows FSx for ONTAP to automatically reclaim space when SQL Server on the EC2 host deletes data. Failure to enable this option may result in write failures and inefficient space utilization.'
            }
        ],
        os: [
            {
                parameter: 'mpio-enabled',
                value: true,
                severity: 'critical',
                recommendation: ''
            },
            {
                parameter: 'mpio-load-balance-policy',
                value: 'RR',
                severity: 'critical',
                recommendation: ''
            },
            {
                parameter: 'mpio-iscsi-count',
                value: 5,
                severity: 'critical',
                recommendation: ''
            },
            {
                parameter: 'ntfs-allocation-unit-size',
                value: 65536,
                severity: 'critical',
                recommendation:
                    'Set NTFS allocation unit size to 64K to better utilize disk space, reduce fragmentation, and improve file read/write performance. Failure to configure this properly may lead to inefficient disk usage and degraded performance.'
            }
        ]
    }
};

export default GOLDEN_CONFIG;
