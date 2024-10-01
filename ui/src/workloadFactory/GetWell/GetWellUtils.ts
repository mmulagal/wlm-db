export const cardData = {
    StorageTier: {
        block_one: {
            type: 'Storage sizing',
            value: 'Storage tier'
        },
        block_two: {
            type: 'status',
            value: 'Optimized'
        },
        block_three: {
            type: 'Capacity tier',
            value: '0%'
        },
        block_four: {
            type: 'Severity',
            value: 'None'
        }
    },
    FileSystemHeadroom: {
        block_one: {
            value: 'File system headroom',
            type: 'Storage tier'
        },
        block_two: {
            type: 'status',
            value: 'Under-provisioned'
        },
        block_three: {
            type: 'File system headroom value',
            value: '35%'
        },
        block_four: {
            type: 'Severity',
            value: 'Critical'
        }
    },
    TransactionLogDriveSize: {
        block_one: {
            value: 'Transaction log drive size',
            type: 'Storage sizing'
        },
        block_two: {
            type: 'status',
            value: 'Over-provisioned'
        },
        block_three: {
            type: 'Transaction log drive size value',
            value: '100%'
        },
        block_four: {
            type: 'Severity',
            value: 'Warning'
        }
    },
    TempDBDriveSize: {
        block_one: {
            value: 'Temp DB drive size',
            type: 'Storage sizing'
        },
        block_two: {
            type: 'status',
            value: 'Optimized'
        },
        block_three: {
            type: 'TempDB drive size value',
            value: '50%'
        },
        block_four: {
            type: 'Severity',
            value: 'None'
        }
    },
    UserDataFiles: {
        block_one: {
            value: 'User data files (.mdf)',
            type: 'Storage layout'
        },
        block_two: {
            type: 'status',
            value: 'Optimized'
        },
        block_three: {
            type: 'User data files',
            value: 'Separate drive',
            smallFont: true
        },
        block_four: {
            type: 'Severity',
            value: 'None'
        }
    },
    TransactionLogFiles: {
        block_one: {
            value: 'Transaction log files (.ldf)',
            type: 'Storage layout'
        },
        block_two: {
            type: 'status',
            value: 'Optimized'
        },
        block_three: {
            type: 'Transaction log files (.Ldf)',
            value: 'Separate drive',
            smallFont: true
        },
        block_four: {
            type: 'Severity',
            value: 'None'
        }
    },
    TempDBPlacement: {
        block_one: {
            value: 'TempDB placement',
            type: 'Storage layout'
        },
        block_two: {
            type: 'status',
            value: 'Optimized'
        },
        block_three: {
            type: 'TempDB placement',
            value: 'Separate drive',
            smallFont: true
        },
        block_four: {
            type: 'Severity',
            value: 'None'
        }
    },
    ONTAPConfiguartion: {
        block_one: {
            value: 'ONTAP configuration',
            type: 'ONTAP configuration'
        },
        block_two: {
            type: 'Status',
            value: 'Not optimized'
        },
        block_three: {
            type: 'Not-optimized values',
            value: '20%'
        },
        block_four: {
            type: 'Severity',
            value: 'Critical'
        }
    },
    Configuartion: {
        block_one: {
            value: 'Operating system',
            type: 'Configuration'
        },
        block_two: {
            type: 'Status',
            value: 'optimized'
        },
        block_three: {
            type: 'Not-optimized values',
            value: '0%'
        },
        block_four: {
            type: 'Severity',
            value: 'None'
        }
    },
    Latency: {
        block_one: {
            value: 'Latency',
            type: 'Storage performance '
        },
        block_two: {
            type: 'Status',
            value: 'Not optimized'
        },
        block_three: {
            type: 'Latency',
            value: '< 20 ms'
        },
        block_four: {
            type: 'Severity',
            value: 'Critical'
        }
    },
    Throughput: {
        block_one: {
            value: 'Throughput',
            type: 'Storage performance '
        },
        block_two: {
            type: 'Status',
            value: 'Not optimized'
        },
        block_three: {
            type: 'Throughput',
            value: '> 80%'
        },
        block_four: {
            type: 'Severity',
            value: 'Critical'
        }
    },
    IOPS: {
        block_one: {
            value: 'IOPS',
            type: 'Storage performance '
        },
        block_two: {
            type: 'Status',
            value: 'Not optimized'
        },
        block_three: {
            type: 'Throughput',
            value: '> 80%'
        },
        block_four: {
            type: 'Severity',
            value: 'Critical'
        }
    }
};

export const operatingSystemTableData = [
    {
        configuration: 'Multipath I/O (MPIO) Status',
        value: 'Enabled',
        status: 'Optimized',
        severity: 'Critical',
        tags: ['Operational excellence', 'Cost optimization'],
        recommendation: 'Recommendation text'
    },
    {
        configuration: 'Multipath I/O (MPIO) Policy',
        value: 'Round robin',
        status: 'Not optimized',
        severity: 'Critical',
        tags: [],
        recommendation: 'Recommendation text'
    },
    {
        configuration: 'Multipath I/O (MPIO) Sessions',
        value: '5',
        status: 'Not optimized',
        severity: 'Critical',
        tags: ['Operational excellence'],
        recommendation: 'Recommendation text'
    },
    {
        configuration: 'NTFS Allocation unit size',
        value: '64K',
        status: 'Not optimized',
        severity: 'Critical',
        tags: ['Cost optimization'],
        recommendation: 'Recommendation text'
    }
];

export const ontapConfigTableData = [
    {
        configuration: 'Thin provisioning',
        value: 'Thin provisioning',
        status: 'Optimized',
        severity: 'Critical',
        tags: ['Operational excellence', 'Cost optimization'],
        recommendation: 'Recommendation text'
    },
    {
        configuration: 'Autosize',
        value: 'Autosize',
        status: 'Not optimized',
        severity: 'Critical',
        tags: [],
        recommendation: 'Recommendation text'
    },
    {
        configuration: 'Autosize-mode',
        value: 'Autosize-mode',
        status: 'Not optimized',
        severity: 'Critical',
        tags: ['Operational excellence'],
        recommendation: 'Recommendation text'
    },
    {
        configuration: 'Fractional reserve',
        value: 'Fractional reserve',
        status: 'Not optimized',
        severity: 'Critical',
        tags: ['Cost optimization'],
        recommendation: 'Recommendation text'
    },
    {
        configuration: 'Snapshot copy reserve',
        value: 'Snapshot copy reserve',
        status: 'Not optimized',
        severity: 'Critical',
        tags: ['Operational excellence', 'Cost optimization'],
        recommendation: 'Recommendation text'
    },
    {
        configuration: 'Snapshot autodelete',
        value: 'Snapshot autodelete',
        status: 'Not optimized',
        severity: 'Warning',
        tags: ['Operational excellence', 'Cost optimization'],
        recommendation: 'Recommendation text'
    },
    {
        configuration: 'Space management',
        value: 'Space management',
        status: 'Not optimized',
        severity: 'Warning',
        tags: [],
        recommendation: 'Recommendation text'
    },
    {
        configuration: 'Tiering policy',
        value: 'Tiering policy',
        status: 'Not optimized',
        severity: 'Critical',
        tags: ['Operational excellence'],
        recommendation: 'Recommendation text'
    },
    {
        configuration: 'Tiering minimum colling days',
        value: 'Tiering minimum colling days',
        status: 'Not optimized',
        severity: 'Warning',
        tags: ['Cost optimization'],
        recommendation: 'Recommendation text'
    },
    {
        configuration: 'Space reservation',
        value: 'Space reservation',
        status: 'Not optimized',
        severity: 'Critical',
        tags: ['Operational excellence', 'Cost optimization'],
        recommendation: 'Recommendation text'
    },
    {
        configuration: 'Space allocation',
        value: 'Space allocation',
        status: 'Not optimized',
        severity: 'Critical',
        tags: ['Operational excellence', 'Cost optimization'],
        recommendation: 'Recommendation text'
    }
];

export const recommendendationTextData = {
    StorageTier: {
        title: 'Storage tier recommendation',
        description:
            'For optimal storage performance, provision FSx ONTAP volumes on the primary SSD tier. \nUsing the capacity tier may result in slower performance and high latency'
    },
    FileSystemHeadroom: {
        title: 'File system headroom recommendation',
        description:
            'For optimal storage performance, provision file-system capacity to 1.35x times the size of total database usage.',
        values: ['Under-provisioned: 0%-35%', 'Optimized: 35%-100%', 'Over-provisioned: >100%']
    },
    TransactionLogDriveSize: {
        title: 'Transaction log drive size recommendation',
        description:
            'Ensure proper sizing and regular monitoring of the SQL Server log drive to prevent issues such as transaction rollbacks, \ndatabase unavailability, data corruption, and performance degradation caused by a full log drive.',
        values: ['Under-provisioned: 0%-20%', 'Optimized: 20%-30%', 'Over-provisioned: <30%']
    },
    TransactionDBDriveSize: {
        title: 'TempDB drive size recommendation',
        description:
            'Place tempdb on a dedicated volume to optimize performance for I/O intensive operations. \nData protection is less critical as tempdb is recreated upon SQL Server restart',
        values: ['Under-provisioned: 0%-20%', 'Optimized: 20%-30%', 'Over-provisioned: <30%']
    },
    UserDataFileMdf: {
        title: 'User data files (.mdf) recommendation',
        description:
            'Separating data and log files onto different drives  improves performance by allowing simultaneous I/O activity \nit also allows independent backup schedules and leverage fast and granular restore functionality'
    },
    TransactionLogFiles: {
        title: 'Transaction log files recommendation',
        description:
            'Separating data and log files onto different drives  improves performance by allowing simultaneous I/O activity it \nalso allows independent backup schedules and leverage fast and granular restore functionality'
    },
    TempDBPlacement: {
        title: 'TempDB placement recommendation',
        description:
            'Place TempDB on a dedicated volume to optimize performance for I/O intensive operations. \nData protection is less critical as TempDB is recreated upon SQL Server restart'
    }
};
