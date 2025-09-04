import { AwsWellArchitecturedPillars, SEVERITY } from '../../../utils/continous-optimization-consts';

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
        lun: [
            {
                name: 'os-type',
                parameter: 'osType',
                value: 'linux',
                severity: SEVERITY.CRITICAL,
                recommendation:
                    'Workload Factory recommends ensuring that the ONTAP LUN operating system (OS) type value matches the operating system partionioning scheme to achieve I/O alignment. Incorrect configuration might reduce performance.',
                tags: [
                    AwsWellArchitecturedPillars.COST_OPTIMIZATION,
                    AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE,
                    AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY
                ]
            },
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
        ]
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
        ]
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
        ]
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
