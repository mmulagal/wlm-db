import { ASSESSMENT_CONFIG_NAMES } from '../../../utils/consts';

export const oracleCardData = {
    user_data_files: {
        id: 'data-files-location',
        mapName: ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF,
        category: 'storage',
        block_one: {
            value: 'Data files (.mdf) placement',
            type: 'Storage layout'
        },
        block_two: {
            type: 'Status',
            value: ''
        },

        block_three: {
            type: 'Severity',
            value: ''
        },
        block_four: {
            type: 'Resource type',
            value: ''
        },
        block_five: {
            type: 'Impacted databases',
            value: '',
            smallFont: true
        },
        recommendation: {
            title: 'Data files (.mdf) placement recommendation',
            description:
                'Separating data and log files onto different drives improves performance by allowing simultaneous I/O activity,\nindependent backup schedules, and improved restore functionality. \nWe recommend separating data and log LUN paths into different volumes for smaller databases. \nThis separation is required when there is more than one large database (> 500 GiB).'
        },
        tags: ['Performance efficiency', 'Operational excellence']
    },
    transaction_log_files: {
        id: 'log-files-location',
        mapName: ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF,
        category: 'storage',
        block_one: {
            value: 'Log files (.ldf) placement',
            type: 'Storage layout'
        },
        block_two: {
            type: 'Status',
            value: ''
        },

        block_three: {
            type: 'Severity',
            value: ''
        },
        block_four: {
            type: 'Resource type',
            value: 'Volumes'
        },
        block_five: {
            type: 'Impacted databases',
            value: '',
            smallFont: true
        },
        recommendation: {
            title: 'Log files (.ldf) placement recommendation',
            description:
                'Separating data and log files onto different drives improves performance by allowing simultaneous I/O activity,\nindependent backup schedules, and improved restore functionality. \nWe recommend separating data and log LUN paths into different volumes for smaller databases. \nThis separation is required when there is more than one large database (> 500 GiB).'
        },
        tags: ['Performance efficiency', 'Operational excellence']
    },
    tempdb_files: {
        id: 'tempdb-files-location',
        mapName: ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT,
        category: 'storage',
        block_one: {
            value: ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT,
            type: 'Storage layout'
        },
        block_two: {
            type: 'Status',
            value: ''
        },

        block_three: {
            type: 'Severity',
            value: ''
        },
        block_four: {
            type: 'Resource type',
            value: ''
        },
        block_five: {
            type: 'TempDB placement',
            value: '',
            smallFont: true
        },
        recommendation: {
            title: 'TempDB placement recommendation',
            description:
                'Isolate TempDB I/O and avoid I/O contention from other databases by placing TempDB on its own dedicated drive.\nThis optimization improves overall SQL Server performance and stability.\nFailure to do so can result in significant I/O bottlenecks, slower query performance, and potential system instability.'
        },
        tags: ['Performance efficiency', 'Operational excellence']
    }
};
