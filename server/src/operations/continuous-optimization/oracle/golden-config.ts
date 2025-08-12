import { AwsWellArchitecturedPillars, SEVERITY } from '../../../utils/continous-optimization-consts';

const GOLDEN_CONFIG = {
    configuration: {
        volume: [
            {
                parameter: 'thinProvision',
                name: 'thin-provision',
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
                name: 'autosize',
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
                parameter: 'autosizeMode',
                name: 'autosize-mode',
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
                parameter: 'fractionalReserve',
                name: 'fractional-reserve',
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
                parameter: 'snapshotCopyReserve',
                name: 'snapshot-copy-reserve',
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
                parameter: 'snapshotAutodelete',
                name: 'snapshot-autodelete',
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
                name: 'space-mgmt-try-first',
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
                parameter: 'tieringPolicy',
                name: 'tiering-policy',
                value: 'snapshot_only',
                severity: SEVERITY.CRITICAL,
                recommendation:
                    'For optimal database performance and cost efficiency, Workload Factory recommends moving only snapshots to the capacity tier. This strategy ensures high performance while reducing costs. It is especially recommended to tier snapshots that are older than 7 days.',
                tags: [AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY]
            },
            {
                parameter: 'tieringMinCoolingDays',
                name: 'tiering-min-cooling-days',
                value: 7,
                severity: SEVERITY.WARNING,
                recommendation:
                    'For optimal database performance and cost efficiency, Workload Factory recommends moving only snapshots to the capacity tier. This strategy ensures high performance while reducing costs. It is especially recommended to tier snapshots that are older than 7 days.',
                tags: [AwsWellArchitecturedPillars.COST_OPTIMIZATION]
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
        ]
    },
    datafilesControlfilesPlacement: {
        parameter: 'datafiles-controlfiles-placement',
        name: 'datafiles-controlfiles-placement',
        recommended: 'separate-volume',
        severity: SEVERITY.WARNING,
        recommendation:
            'Data files and control files should reside on a dedicated volume to optimize performance and maintain data integrity. Isolating these files allows for efficient read/write operations and ensures critical control file accessibility, reducing the risk of corruption and enhancing database robustness.',
        tags: [
            AwsWellArchitecturedPillars.COST_OPTIMIZATION,
            AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
            AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
        ]
    },
    redologsTempPlacement: {
        parameter: 'redologs-temp-placement',
        name: 'redologs-temp-placement',
        recommended: 'separate-volume',
        severity: SEVERITY.WARNING,
        recommendation:
            'Placing redo logs, temp files, and archive logs on a dedicated volume enhances performance and recovery processes. This isolation prevents high I/O demands from interfering with other operations, ensuring efficient logging, sorting, and reliable backup and recovery.',
        tags: [
            AwsWellArchitecturedPillars.COST_OPTIMIZATION,
            AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
            AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
        ]
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
        ]
    }
};

export default GOLDEN_CONFIG;
