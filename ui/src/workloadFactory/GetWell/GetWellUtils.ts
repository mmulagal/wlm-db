export const cardData = {
    StorageTier: {
        block_one: {
            type: 'Storage sizing',
            value: 'Storage tier'
        },
        block_two: {
            type: 'Status',
            value: 'Optimized'
        },
        block_three: {
            type: 'Performance tier',
            value: '25%'
        },
        block_four: {
            type: 'Severity',
            value: 'Critical'
        }
    },
    FileSystemHeadroom: {
        block_one: {
            value: 'File system headroom',
            type: 'Storage sizing'
        },
        block_two: {
            type: 'Status',
            value: 'Under-provisioned'
        },
        block_three: {
            type: 'File system headroom',
            value: '35%'
        },
        block_four: {
            type: 'Severity',
            value: 'Critical'
        }
    },
    TransactionLogDriveSize: {
        block_one: {
            value: 'Log drive size',
            type: 'Storage sizing'
        },
        block_two: {
            type: 'Status',
            value: 'Over-provisioned'
        },
        block_three: {
            type: 'Percentage of data drive size',
            value: '100%'
        },
        block_four: {
            type: 'Severity',
            value: 'Warning'
        }
    },
    TempDBDriveSize: {
        block_one: {
            value: 'TempDB drive size',
            type: 'Storage sizing'
        },
        block_two: {
            type: 'Status',
            value: 'Optimized'
        },
        block_three: {
            type: 'Percentage of data drive size',
            value: '50%'
        },
        block_four: {
            type: 'Severity',
            value: 'None'
        }
    },
    UserDataFiles: {
        block_one: {
            value: 'User data files (.mdf) placement',
            type: 'Storage layout'
        },
        block_two: {
            type: 'Status',
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
            value: 'Log files (.ldf) placement',
            type: 'Storage layout'
        },
        block_two: {
            type: 'Status',
            value: 'Optimized'
        },
        block_three: {
            type: 'Log files',
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
            type: 'Status',
            value: 'Optimized'
        },
        block_three: {
            type: 'TempDB placement',
            value: 'Separate drive',
            smallFont: true
        },
        block_four: {
            type: 'Severity',
            value: 'Critical'
        }
    },
    ONTAPConfiguartion: {
        block_one: {
            value: 'ONTAP configuration',
            type: 'Configuration'
        },
        block_two: {
            type: 'Status',
            value: 'Not optimized'
        },
        block_three: {
            type: 'Not optimized configurations',
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
            value: 'Optimized'
        },
        block_three: {
            type: 'Not optimized configurations',
            value: '0%'
        },
        block_four: {
            type: 'Severity',
            value: 'Critical'
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
        configuration: 'Multipath I/O Status',
        value: 'Enabled',
        status: 'Optimized',
        severity: 'Critical',
        tags: ['Operational excellence', 'Cost optimization'],
        recommendation: 'Recommendation text'
    },
    {
        configuration: 'Multipath I/O Policy',
        value: 'Round robin',
        status: 'Not optimized',
        severity: 'Critical',
        tags: [],
        recommendation: 'Recommendation text'
    },
    {
        configuration: 'Multipath I/O Sessions',
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
            'For optimal storage performance, provision FSx for ONTAP volumes on the primary SSD tier.\nUsing the capacity tier may result in slower performance and higher latency.'
    },
    FileSystemHeadroom: {
        title: 'File system headroom recommendation',
        description:
            'To optimize storage performance, provision file system capacity as 1.35 times the size of total database usage.',
        values: ['Under-provisioned: 0-35%', 'Optimized: 36-100%', 'Over-provisioned: >100%']
    },
    TransactionLogDriveSize: {
        title: 'Log drive size recommendation',
        description:
            'Ensure proper sizing and regular monitoring of the SQL Server log drive to prevent issues such as transaction rollbacks, \ndatabase unavailability, data corruption, and performance degradation caused by a full log drive.',
        values: ['Under-provisioned: 0-20%', 'Optimized: 21-30%', 'Over-provisioned: >31%']
    },
    TransactionDBDriveSize: {
        title: 'TempDB drive size recommendation',
        description:
            'Ensure proper sizing and regular monitoring of the SQL Server TempDB to optimize performance and maintain overall stability.\nProperly configured TempDB prevents performance issues and instability. Insufficient space or high contention can lead to query slowdowns, application timeouts, and system crashes.',
        values: ['Under-provisioned: 0-20%', 'Optimized: 21-30%', 'Over-provisioned: >31%']
    },
    UserDataFileMdf: {
        title: 'User data files (.mdf) placement recommendation',
        description:
            'Separating data and log files onto different drives improves performance by allowing simultaneous I/O activity,\nindependent backup schedules, and improved restore functionality.'
    },
    TransactionLogFiles: {
        title: 'Log files (.ldf) placement recommendation',
        description:
            'Separating data and log files onto different drives improves performance by allowing simultaneous I/O activity,\nindependent backup schedules, and improved restore functionality.'
    },
    TempDBPlacement: {
        title: 'TempDB placement recommendation',
        description:
            'Isolate TempDB I/O from other databases by placing TempDB on its own dedicated drive to avoid I/O contention.\nThis optimization improves overall SQL Server performance and stability.\nFailure to do so can result in significant I/O bottlenecks, slower query performance, and potential system instability.'
    }
};

export const getUniqueEntries = (arrays: any) => {
    const combinedArray = [].concat(...arrays);
    const seen = new Set();
    return combinedArray.filter(item => {
        const serializedItem = JSON.stringify(item);
        if (seen.has(serializedItem)) {
            return false;
        } else {
            seen.add(serializedItem);
            return true;
        }
    });
};

export const groupByType = (array: any) => {
    return array.reduce((acc: any, item: any) => {
        const { type, id } = item;
        if (!acc[type]) {
            acc[type] = [];
        }
        if (!acc[type].includes(id)) {
            acc[type].push(id);
        }
        return acc;
    }, {});
};

export const removeEntry = (input: any, obj: any) => {
    const { id, type } = obj;

    // Create a new object to avoid mutating the original input object
    const updatedInput = { ...input };

    // Check if the type exists in the input object and filter out the id
    if (updatedInput[type]) {
        updatedInput[type] = updatedInput[type].filter((item: any) => item !== id);
    }

    return updatedInput;
};

export const removeObjectFromArray = (array: any, obj: any) => {
    return array.filter((item: any) => {
        return !(item.id === obj.id && item.label === obj.label && item.value === obj.value && item.type === obj.type);
    });
};

export const generateDate = () => {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    return `${year}${month}${day}_${hours}${minutes}`;
};
