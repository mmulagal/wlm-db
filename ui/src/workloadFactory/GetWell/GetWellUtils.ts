import { NOTIFICATION_TYPES, addNotification } from '../../store/notificationSlice';
import store from '../../store/store';
import {
    setCardData,
    setDriftAssessmentData,
    setGwTimestamp,
    setOntapConfigTableData,
    setOptimizationBreakDown,
    setOptimizingData,
    setOptimizingInstanceData,
    setOsConfigTableData
} from '../../store/workloadFactory/getWellOptimizeSlice';
import { GENERAL } from '../../utils/appConstants';
import {
    GETWELL_CONFIG,
    GETWELL_STATUS,
    GETWELL_VALUES,
    JOB_MONITORING_STATUS,
    OPTIMIZE_POLLING_INTERVAL
} from '../../utils/consts';
import {
    AssessmentResponseInterface,
    GwCardDataInterface,
    GwSqlServerInstanceInterface,
    PerConfigInterface
} from '../../utils/types/getWellTypes';
import { formatDateWithTime, formatNumberWithCustomComma, sortListOfDict } from '../../utils/utilityFunctions';

// This is strutcure of cardDataDefault. It is used to set the default values for the card data.
export const cardDataDefault: GwCardDataInterface = {
    storage_tier: {
        id: 'performance-tier',
        category: 'storage',
        block_one: {
            type: 'Storage sizing',
            value: 'Storage tier'
        },
        block_two: {
            type: 'Status',
            value: ''
        },
        block_three: {
            type: 'Performance tier',
            value: ''
        },
        block_four: {
            type: 'Severity',
            value: ''
        },
        recommendation: {
            title: 'Storage tier recommendation',
            description:
                'For optimal storage performance, provision FSx for ONTAP volumes on the primary SSD tier.\nUsing the capacity tier may result in slower performance and higher latency.'
        },
        tags: ['Performance efficiency']
    },
    file_system_headroom: {
        id: 'headroom',
        category: 'storage',
        block_one: {
            value: 'File system headroom',
            type: 'Storage sizing'
        },
        block_two: {
            type: 'Status',
            value: ''
        },
        block_three: {
            type: 'File system headroom',
            value: ''
        },
        block_four: {
            type: 'Severity',
            value: ''
        },
        recommendation: {
            title: 'File system headroom recommendation',
            description:
                'To optimize storage performance, provision file system capacity as 1.35 times of total size of provisioned volume.',
            values: ['Under-provisioned: <35%', 'Optimized: 35-100%', 'Over-provisioned: >100%']
        },
        tags: ['Performance efficiency']
    },
    transaction_log_drive_size: {
        id: 'log-drive-size',
        category: 'storage',
        block_one: {
            value: 'Log drive size',
            type: 'Storage sizing'
        },
        block_two: {
            type: 'Status',
            value: ''
        },
        block_three: {
            type: 'Percentage of data drive size',
            value: ''
        },
        block_four: {
            type: 'Severity',
            value: ''
        },
        recommendation: {
            title: 'Log drive size recommendation',
            description:
                'Ensure proper sizing and regular monitoring of the SQL Server log drive to prevent issues such as transaction rollbacks, \ndatabase unavailability, data corruption, and performance degradation caused by a full log drive.',
            values: ['Under-provisioned: <20%', 'Optimized: 20-30%', 'Over-provisioned: >30%']
        },
        tags: ['Operational excellence']
    },
    tempdb_drive_size: {
        id: 'tempdb-drive-size',
        category: 'storage',
        block_one: {
            value: 'TempDB drive size',
            type: 'Storage sizing'
        },
        block_two: {
            type: 'Status',
            value: ''
        },
        block_three: {
            type: 'Percentage of data drive size',
            value: ''
        },
        block_four: {
            type: 'Severity',
            value: ''
        },
        recommendation: {
            title: 'TempDB drive size recommendation',
            description:
                'Ensure proper sizing and regular monitoring of the SQL Server TempDB to optimize performance and maintain overall stability.\nProperly configured TempDB prevents performance issues and instability. Insufficient space or high contention can lead to query slowdowns, application timeouts, and system crashes.',
            values: ['Under-provisioned: <10%', 'Optimized: 10-20%', 'Over-provisioned: >20%']
        },
        tags: ['Operational excellence']
    },
    user_data_files: {
        id: 'default-data-files-location',
        category: 'storage',
        block_one: {
            value: 'User data files (.mdf) placement',
            type: 'Storage layout'
        },
        block_two: {
            type: 'Status',
            value: ''
        },
        block_three: {
            type: 'User data files',
            value: '',
            smallFont: true
        },
        block_four: {
            type: 'Severity',
            value: ''
        },
        recommendation: {
            title: 'User data files (.mdf) placement recommendation',
            description:
                'Separating data and log files onto different drives improves performance by allowing simultaneous I/O activity,\nindependent backup schedules, and improved restore functionality.'
        },
        tags: ['Performance efficiency', 'Operational excellence']
    },
    transaction_log_files: {
        id: 'default-log-files-location',
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
            type: 'Log files',
            value: '',
            smallFont: true
        },
        block_four: {
            type: 'Severity',
            value: ''
        },
        recommendation: {
            title: 'Log files (.ldf) placement recommendation',
            description:
                'Separating data and log files onto different drives improves performance by allowing simultaneous I/O activity,\nindependent backup schedules, and improved restore functionality.'
        },
        tags: ['Performance efficiency', 'Operational excellence']
    },
    tempdb_files: {
        id: 'tempdb-files-location',
        category: 'storage',
        block_one: {
            value: 'TempDB placement',
            type: 'Storage layout'
        },
        block_two: {
            type: 'Status',
            value: ''
        },
        block_three: {
            type: 'TempDB placement',
            value: '',
            smallFont: true
        },
        block_four: {
            type: 'Severity',
            value: ''
        },
        recommendation: {
            title: 'TempDB placement recommendation',
            description:
                'Isolate TempDB I/O from other databases by placing TempDB on its own dedicated drive to avoid I/O contention.\nThis optimization improves overall SQL Server performance and stability.\nFailure to do so can result in significant I/O bottlenecks, slower query performance, and potential system instability.'
        },
        tags: ['Performance efficiency', 'Operational excellence']
    },
    ontap_configuration: {
        category: 'storage',
        block_one: {
            value: 'ONTAP configuration',
            type: 'Configuration'
        },
        block_two: {
            type: 'Status',
            value: ''
        },
        block_three: {
            type: 'Not optimized configurations',
            value: ''
        },
        block_four: {
            type: 'Severity',
            value: 'Critical'
        },
        tags: ['Cost optimization', 'Operational excellence', 'Performance efficiency', 'Reliability']
    },
    os_configuration: {
        category: 'storage',
        block_one: {
            value: 'Operating system',
            type: 'Configuration'
        },
        block_two: {
            type: 'Status',
            value: ''
        },
        block_three: {
            type: 'Not optimized configurations',
            value: ''
        },
        block_four: {
            type: 'Severity',
            value: 'Critical'
        },
        tags: ['Performance efficiency', 'Reliability']
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
        },
        tags: []
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
            value: ''
        },
        tags: []
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
            value: ''
        },
        tags: []
    },
    compute_rightsizing: {
        id: 'compute-rightsizing',
        category: 'compute',
        block_one: {
            type: 'Compute',
            value: 'Compute rightsizing'
        },
        block_two: {
            type: 'Status',
            value: ''
        },
        block_three: {
            type: 'Finding reasons',
            value: '',
            list: null
        },
        block_four: {
            type: 'Severity',
            value: ''
        },
        recommendation: {
            title: 'Compute rightsizing recommendation',
            description:
                'To ensure optimal performance and cost efficiency for your SQL Server EC2 instance, we recommend rightsizing based on your workload demands.\nIf your current instance is under-provisioned, upgrading will enhance CPU, memory, and I/O capacity.\nIf it is over-provisioned, downgrading will maintain performance while reducing costs.\nClick Optimize to compare costs between your current and recommended instance types and identify potential savings.'
        },
        tags: ['Cost optimization', 'Performance efficiency']
    },
    host_os_patch: {
        id: 'host-os-patch',
        category: 'compute',
        block_one: {
            type: 'Compute',
            value: GENERAL.OPERATING_SYSTEM_PATCH
        },
        block_two: {
            type: 'Status',
            value: ''
        },
        block_three: {
            type: 'Missing patches',
            value: '',
            smallFont: true
        },
        block_four: {
            type: 'Severity',
            value: ''
        },
        recommendation: {
            title: 'Operating system patch recommendation',
            description:
                'Whenever possible, apply the latest patches to ensure security and stability. \nApplying the latest patch helps protect your SQL server databases from vulnerabilities and significantly improves overall system reliability.'
        },
        tags: ['Security', 'Reliability']
    },
    sql_licenses: {
        id: 'sql-license',
        category: 'application',
        block_one: {
            type: GENERAL.APPLICATION_SQL_SERVER,
            value: 'Licenses'
        },
        block_two: {
            type: 'Status',
            value: ''
        },
        block_three: {
            type: 'License edition',
            value: '',
            smallFont: true
        },
        block_four: {
            type: 'Severity',
            value: ''
        },
        recommendation: {
            title: 'License recommendation',
            descriptionList: [
                {
                    title: 'Not optimized: ',
                    description:
                        'A license is considered "not optimized" when Workload Factory detects that your database \ninfrastructure doesn\'t use any of the commercial software license features you\'re paying for. An not-optimized license \nmight result in unnecessary costs.'
                },
                {
                    title: 'Optimized: ',
                    description:
                        'A license is considered "optimized" when the commercial software license for your databases meets your \nperformance requirements.'
                }
            ],
            info: 'The SQL Server license assessment and recommendation are provided at the host level.'
        },
        tags: ['Cost optimization']
    }
};

export const formatApplicationCardMainConfig = (
    data: AssessmentResponseInterface,
    optimizingData: { [key: string]: string },
    cardsData: any
) => {
    let item: any = data?.license;
    let categoryVal = 'application';
    let itemName = item?.name || '';
    let status = item?.status || '';
    let severity = item?.severity || '';
    if (optimizingData?.[itemName] && optimizingData?.[itemName] !== '') {
        status = optimizingData?.[itemName];
    }
    itemName = GETWELL_CONFIG?.[itemName] || itemName;

    let licenseVal = '';
    const state = store.getState();
    const selectedDatabaseInstanceName = state.getWellOptimize.selectedDatabaseInstanceName || '';
    const instance = item?.sqlServerInstances?.find(
        (instance: GwSqlServerInstanceInterface) => instance?.sqlServerInstance === selectedDatabaseInstanceName
    );
    const selectedDatabaseLicense = instance?.sqlServerEdition || '';
    if (selectedDatabaseLicense.includes('Standard')) {
        licenseVal = 'Standard';
    } else if (selectedDatabaseLicense.includes('Enterprise')) {
        licenseVal = 'Enterprise';
    } else if (selectedDatabaseLicense.includes('Developer')) {
        licenseVal = 'Developer';
    } else {
        licenseVal = selectedDatabaseLicense;
    }

    cardsData = {
        ...cardsData,
        [itemName]: {
            ...(cardDataDefault?.[itemName] || {}),
            block_two: {
                ...(cardDataDefault?.[itemName]?.block_two || {}),
                value: GETWELL_VALUES?.[status] || status
            },
            block_three: {
                ...(cardDataDefault?.[itemName]?.block_three || {}),
                value: licenseVal
            },
            block_four: {
                ...(cardDataDefault?.[itemName]?.block_four || {}),
                value: GETWELL_VALUES?.[severity] || severity
            },
            tags: item?.tags,
            id: item?.name,
            category: categoryVal
        }
    };
    return cardsData;
};

export const formatOsPatchCardConfig = (
    data: AssessmentResponseInterface,
    optimizingData: { [key: string]: string },
    cardsData: any
) => {
    let item: any = data?.hostOsPatch;
    let categoryVal = 'compute';
    let itemName = item?.name || 'host-os-patch';
    let status = item?.status || '';
    let severity = item?.severity || '';
    if (optimizingData?.[itemName] && optimizingData?.[itemName] !== '') {
        status = optimizingData?.[itemName];
    }
    itemName = GETWELL_CONFIG?.[itemName] || itemName;

    let totalViolations = 0;

    data?.hostOsPatch?.ec2InstancesToPatch?.map(perInstance => {
        totalViolations += perInstance?.criticalNonCompliantCount || 0;
        totalViolations += perInstance?.securityNonCompliantCount || 0;
    });

    cardsData = {
        ...cardsData,
        [itemName]: {
            ...(cardDataDefault?.[itemName] || {}),
            block_two: {
                ...(cardDataDefault?.[itemName]?.block_two || {}),
                value: GETWELL_VALUES?.[status] || status
            },
            block_three: {
                ...(cardDataDefault?.[itemName]?.block_three || {}),
                value: String(totalViolations)
            },
            block_four: {
                ...(cardDataDefault?.[itemName]?.block_four || {}),
                value: GETWELL_VALUES?.[severity] || severity
            },
            tags: item?.tags || cardDataDefault?.[itemName]?.tags,
            id: item?.name,
            category: categoryVal
        }
    };
    return cardsData;
};

// This function is used to format the data for the individual card main config.
export const formatIndividualCardMainConfig = (
    data: AssessmentResponseInterface,
    optimizingData: { [key: string]: string }
) => {
    let cardsData: any = cardDataDefault;
    let cardMainConfig = [data?.storage?.sizing, data?.storage?.layout];
    let computeMissingPermissions = false;
    if (data?.compute?.name === 'compute-rightsizing') {
        cardMainConfig?.push([data?.compute]);
    } else if (data?.compute?.errorMessage && data?.compute?.errorMessage.includes('is not authorized to perform: ')) {
        computeMissingPermissions = true;
        cardMainConfig?.push([
            {
                ...data?.compute,
                name: 'compute-rightsizing',
                errorMessage: data?.compute?.errorMessage
            }
        ]);
    } else {
        cardMainConfig?.push([
            {
                ...data?.compute,
                name: 'compute-rightsizing',
                errorMessage: data?.compute?.errorMessage
            }
        ]);
    }

    cardMainConfig?.map((category, index) => {
        let categoryVal = '';
        if (index === 0 || index === 1) {
            categoryVal = 'storage';
        } else if (index === 2) {
            categoryVal = 'compute';
        }

        // user-database-layout is newly added and to check status for User data files (.mdf) placement we need to check status of user-database-layout also along with default-data-files-location
        let userDataStatus: string = '';
        let userDataSeverity: string = '';
        category?.map((item: PerConfigInterface) => {
            if (item?.name === 'user-database-layout') {
                userDataStatus = item?.status || '';
                userDataSeverity = item?.severity || '';
            }
        });
        category?.map((item: PerConfigInterface) => {
            if (item?.name === 'user-database-layout') {
                return;
            }
            let itemName = item?.name || '';
            let status = item?.status || '';
            let severity = item?.severity || '';
            if (optimizingData?.[itemName] && optimizingData?.[itemName] !== '') {
                status = optimizingData?.[itemName];
            }

            if (itemName === 'default-data-files-location' && userDataStatus === 'not-optimized') {
                if (status === 'optimized') {
                    severity = userDataSeverity;
                } else if (status === 'not-optimized') {
                    if (userDataSeverity === 'critical') {
                        severity = 'critical';
                    }
                }
                status = 'not-optimized';
            }

            itemName = GETWELL_CONFIG?.[itemName] || itemName;

            let blockThreeValue = '';
            if (categoryVal === 'storage') {
                blockThreeValue = GETWELL_VALUES?.[item?.current || ''] || item?.current;
            } else {
                blockThreeValue = GETWELL_VALUES?.[item?.recommended || ''] || item?.recommended;
            }

            cardsData = {
                ...cardsData,
                [itemName]: {
                    ...(cardDataDefault?.[itemName] || {}),
                    block_two: {
                        ...(cardDataDefault?.[itemName]?.block_two || {}),
                        value: GETWELL_VALUES?.[status] || status
                    },
                    block_three: {
                        ...(cardDataDefault?.[itemName]?.block_three || {}),
                        value: blockThreeValue,
                        list: item?.objectsInViolation ? item?.objectsInViolation : null
                    },
                    block_four: {
                        ...(cardDataDefault?.[itemName]?.block_four || {}),
                        value: GETWELL_VALUES?.[severity] || severity
                    },
                    tags: item?.tags,
                    id: item?.name,
                    category: categoryVal,
                    recommendationOptions: index === 2 ? item?.recommendationOptions || [] : null,
                    isMissingPermissions: index === 2 ? computeMissingPermissions : null,
                    missingPermissions: item?.missingPermissions,
                    recommendedSizeInGib: item?.recommendedSizeInGib
                }
            };
        });
    });
    return cardsData;
};

// This function is used to format the ONTAP configuration data.
export const formatOntapConfig = (data: AssessmentResponseInterface, optimizingData: { [key: string]: string }) => {
    let ontapTagsList: Array<string> = [];
    let highestOntapSeverity = 'None';
    let formatOntapConfigList: PerConfigInterface[] = [];
    let ontapCritical = 0;
    let ontapWarning = 0;
    let volumesList = data?.storage?.configuration?.volumes;
    if (volumesList && !volumesList?.[0]?.errorMessage) {
        data?.storage?.configuration?.volumes?.map((item: PerConfigInterface) => {
            let status = item?.status || '';
            if (optimizingData?.[item?.name || ''] && optimizingData?.[item?.name || ''] !== '') {
                status = optimizingData?.[item?.name || ''];
            }
            formatOntapConfigList.push({
                ...item,
                id: item?.name,
                type: 'volume',
                name: GETWELL_CONFIG?.[item?.name || ''] || item?.name,
                status: GETWELL_VALUES?.[status] || status,
                severity: GETWELL_VALUES?.[item?.severity || ''] || item?.severity
            });
            if (item?.severity === 'critical') {
                ontapCritical = 1;
            } else if (item?.severity === 'warning') {
                ontapWarning = 1;
            }
            ontapTagsList = [...ontapTagsList, ...(item?.tags || [])];
        });
    }

    let lunsList = data?.storage?.configuration?.luns;
    if (lunsList && !lunsList?.[0]?.errorMessage) {
        data?.storage?.configuration?.luns?.map((item: PerConfigInterface) => {
            let status = item?.status || '';
            if (optimizingData?.[item?.name || ''] && optimizingData?.[item?.name || ''] !== '') {
                status = optimizingData?.[item?.name || ''];
            }
            formatOntapConfigList.push({
                ...item,
                id: item?.name,
                type: 'lun',
                name: GETWELL_CONFIG?.[item?.name || ''] || item?.name,
                status: GETWELL_VALUES?.[status] || status,
                severity: GETWELL_VALUES?.[item?.severity || ''] || item?.severity
            });
            if (item?.severity === 'critical') {
                ontapCritical = 1;
            } else if (item?.severity === 'warning') {
                ontapWarning = 1;
            }
            ontapTagsList = [...ontapTagsList, ...(item?.tags || [])];
        });
    }

    if (ontapCritical === 1) {
        highestOntapSeverity = 'Critical';
    } else if (ontapWarning === 1) {
        highestOntapSeverity = 'Warning';
    }

    let ontapOptimizedConfig = 0;
    let ontapNotOptimizedConfig = 0;

    let ontapVolAndLunList = [];
    if (volumesList && !volumesList?.[0]?.errorMessage) {
        ontapVolAndLunList.push(data?.storage?.configuration?.volumes);
    }
    if (lunsList && !lunsList?.[0]?.errorMessage) {
        ontapVolAndLunList.push(data?.storage?.configuration?.luns);
    }
    ontapVolAndLunList?.map(type => {
        type?.map((item: PerConfigInterface) => {
            if (item?.status === 'optimized') {
                ontapOptimizedConfig++;
            } else {
                ontapNotOptimizedConfig++;
            }
        });
    });
    return {
        formatOntapConfigList,
        ontapTagsList,
        ontapOptimizedConfig,
        ontapNotOptimizedConfig,
        highestOntapSeverity
    };
};

// This function is used to format the OS configuration data.
export const formatOsConfig = (data: AssessmentResponseInterface, optimizingData: { [key: string]: string }) => {
    let osTagsList: Array<string> = [];
    let highestOsSeverity = 'None';
    let formatOsConfigList: PerConfigInterface[] = [];
    let osCritical = 0;
    let osWarning = 0;
    let osList = data?.storage?.configuration?.os;
    if (osList && !osList?.[0]?.errorMessage) {
        data?.storage?.configuration?.os?.map((item: PerConfigInterface) => {
            let status = item?.status || '';
            if (optimizingData?.[item?.name || ''] && optimizingData?.[item?.name || ''] !== '') {
                status = optimizingData?.[item?.name || ''];
            }
            formatOsConfigList.push({
                ...item,
                id: item?.name,
                type: 'os',
                name: GETWELL_CONFIG?.[item?.name || ''] || item?.name,
                status: GETWELL_VALUES?.[status] || status,
                severity: GETWELL_VALUES?.[item?.severity || ''] || item?.severity
            });
            if (item?.severity === 'critical') {
                osCritical = 1;
            } else if (item?.severity === 'warning') {
                osWarning = 1;
            }
            osTagsList = [...osTagsList, ...(item?.tags || [])];
        });
    }

    formatOsConfigList = sortListOfDict(formatOsConfigList, 'name');

    if (osCritical === 1) {
        highestOsSeverity = 'Critical';
    } else if (osWarning === 1) {
        highestOsSeverity = 'Warning';
    }

    let osOptimizedConfig = 0;
    let osNotOptimizedConfig = 0;
    if (osList && !osList?.[0]?.errorMessage) {
        data?.storage?.configuration?.os?.map((item: PerConfigInterface) => {
            if (item?.status === 'optimized') {
                osOptimizedConfig++;
            } else {
                osNotOptimizedConfig++;
            }
        });
    }
    return { formatOsConfigList, osTagsList, osOptimizedConfig, osNotOptimizedConfig, highestOsSeverity };
};

// This function is used to format the optimization breakdown data.
export const formatOptimizationBreakDown = (cardsData: any) => {
    let optimizedStorage = 0;
    let notOptimizedStorage = 0;
    let optimizedCompute = 0;
    let notOptimizedCompute = 0;
    let optimizedApplication = 0;
    let notOptimizedApplication = 0;

    Object.keys(cardsData).forEach(key => {
        const nestedObject = cardsData[key];
        if (nestedObject?.category === 'storage') {
            if (nestedObject?.block_two?.value === GETWELL_STATUS.OPTIMIZED) {
                optimizedStorage++;
            } else {
                notOptimizedStorage++;
            }
        } else if (nestedObject?.category === 'compute') {
            if (
                nestedObject?.block_two?.value === GETWELL_STATUS.OPTIMIZED ||
                nestedObject?.block_two?.value === GETWELL_STATUS.ANALYZING
            ) {
                optimizedCompute++;
            } else {
                notOptimizedCompute++;
            }
        } else if (nestedObject?.category === 'application') {
            if (nestedObject?.block_two?.value === GETWELL_STATUS.OPTIMIZED) {
                optimizedApplication++;
            } else {
                notOptimizedApplication++;
            }
        }
    });

    let storageCount = {
        total: optimizedStorage + notOptimizedStorage,
        optimized: optimizedStorage,
        notOptimized: notOptimizedStorage,
        percent: optimizedStorage
            ? formatNumberWithCustomComma((optimizedStorage / (optimizedStorage + notOptimizedStorage)) * 100)
            : 0
    };
    let computeCount = {
        total: optimizedCompute + notOptimizedCompute,
        optimized: optimizedCompute,
        notOptimized: notOptimizedCompute,
        percent: optimizedCompute
            ? formatNumberWithCustomComma((optimizedCompute / (optimizedCompute + notOptimizedCompute)) * 100)
            : 0
    };
    let applicationCount = {
        total: optimizedApplication + notOptimizedApplication,
        optimized: optimizedApplication,
        notOptimized: notOptimizedApplication,
        percent: optimizedApplication
            ? formatNumberWithCustomComma(
                  (optimizedApplication / (optimizedApplication + notOptimizedApplication)) * 100
              )
            : 0
    };

    let optBreakDown = {
        storage: storageCount,
        compute: computeCount,
        application: applicationCount,
        total: {
            // Total configuration will be calculated by adding the total number of configurations in the storage layout and sizing
            total: storageCount?.total + computeCount?.total + applicationCount?.total,
            optimized: storageCount?.optimized + computeCount?.optimized + applicationCount?.optimized,
            notOptimized: storageCount?.notOptimized + computeCount?.notOptimized + applicationCount?.notOptimized,
            percent:
                storageCount?.optimized || computeCount?.optimized || applicationCount?.optimized
                    ? formatNumberWithCustomComma(
                          ((storageCount?.optimized + computeCount?.optimized + applicationCount?.optimized || 0) /
                              (storageCount?.total + computeCount?.total + applicationCount?.total || 1)) *
                              100
                      )
                    : 0
        }
    };
    return optBreakDown;
};

export const getCardsData = (data: AssessmentResponseInterface, optimizingData: { [key: string]: string }) => {
    const {
        formatOntapConfigList,
        ontapTagsList,
        ontapOptimizedConfig,
        ontapNotOptimizedConfig,
        highestOntapSeverity
    } = formatOntapConfig(data, optimizingData);

    let cardsData = formatIndividualCardMainConfig(data, optimizingData);

    cardsData = formatApplicationCardMainConfig(data, optimizingData, cardsData);

    cardsData = formatOsPatchCardConfig(data, optimizingData, cardsData);

    cardsData = {
        ...cardsData,
        ['ontap_configuration']: {
            ...cardDataDefault?.ontap_configuration,
            block_two: {
                ...cardDataDefault?.ontap_configuration?.block_two,
                value:
                    (ontapOptimizedConfig || 0) + (ontapNotOptimizedConfig || 0) !== 0
                        ? ontapNotOptimizedConfig > 0
                            ? 'Not optimized'
                            : 'Optimized'
                        : ''
            },
            block_three: {
                ...cardDataDefault?.ontap_configuration?.block_three,
                value:
                    ontapNotOptimizedConfig !== 0
                        ? formatNumberWithCustomComma(
                              (ontapNotOptimizedConfig / (ontapOptimizedConfig + ontapNotOptimizedConfig)) * 100
                          ) + '%'
                        : '0%'
            },
            block_four: {
                ...cardDataDefault?.ontap_configuration?.block_four,
                value: highestOntapSeverity
            },
            tags: ontapTagsList.filter((value: any, index: any, self: string | any[]) => self.indexOf(value) === index),
            category: 'storage'
        }
    };

    const { formatOsConfigList, osTagsList, osOptimizedConfig, osNotOptimizedConfig, highestOsSeverity } =
        formatOsConfig(data, optimizingData);

    cardsData = {
        ...cardsData,
        ['os_configuration']: {
            ...cardDataDefault?.os_configuration,
            block_two: {
                ...cardDataDefault?.os_configuration?.block_two,
                value:
                    (osOptimizedConfig || 0) + (osNotOptimizedConfig || 0) !== 0
                        ? osNotOptimizedConfig > 0
                            ? 'Not optimized'
                            : 'Optimized'
                        : ''
            },
            block_three: {
                ...cardDataDefault?.os_configuration?.block_three,
                value:
                    osNotOptimizedConfig !== 0
                        ? formatNumberWithCustomComma(
                              (osNotOptimizedConfig / (osOptimizedConfig + osNotOptimizedConfig)) * 100
                          ) + '%'
                        : '0%'
            },
            block_four: {
                ...cardDataDefault?.os_configuration?.block_four,
                value: highestOsSeverity
            },
            tags: osTagsList.filter((value: any, index: any, self: string | any[]) => self.indexOf(value) === index),
            category: 'storage'
        }
    };

    return { cardsData, formatOntapConfigList, formatOsConfigList };
};

// This function is used to format the get well data.
export const formatGetWellData = (dispatch: any, data?: AssessmentResponseInterface | undefined) => {
    const state = store.getState();
    const optimizingData = state.getWellOptimize.optimizingData || {};
    if (!data) {
        data = state.getWellOptimize.driftAssessmentData || {};
    }
    let { cardsData, formatOntapConfigList, formatOsConfigList } = getCardsData(data, optimizingData);

    let optBreakDown = formatOptimizationBreakDown(cardsData);

    // Dispatch the formatted cards data to the store
    dispatch(setCardData(cardsData));

    // Dispatch the formatted ONTAP configuration data to the store
    dispatch(setOntapConfigTableData(formatOntapConfigList));

    // Dispatch the formatted OS configuration data to the store
    dispatch(setOsConfigTableData(formatOsConfigList));

    // Dispatch the formatted optimization breakdown data to the store
    dispatch(setOptimizationBreakDown(optBreakDown));

    // Dispatch the timestamp to the store
    dispatch(
        setGwTimestamp(
            data?.storage?.timestamp && isNaN(Date.parse(data?.storage?.timestamp))
                ? formatDateWithTime(data?.storage?.timestamp)
                : data?.storage?.timestamp
        )
    );
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

export const groupByType = (array: any, returnType: string = 'id') => {
    return array.reduce((acc: any, item: any) => {
        const { type, id, value } = item;
        if (!acc[type]) {
            acc[type] = [];
        }
        const retValue = returnType === 'id' ? id : value;
        if (!acc[type].includes(retValue)) {
            acc[type].push(retValue);
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

// filters card data based on filter tags
export const applyFilter = (cardData: any, optimizeFilterTags: any) => {
    let filteredCardData: any = {};
    let configCount = 0;
    const filters = groupByType(optimizeFilterTags, 'value');
    const categoryData: any = {
        file_system_headroom: { category: 'Storage', subCategory: 'Storage sizing' },
        storage_tier: { category: 'Storage', subCategory: 'Storage sizing' },
        transaction_log_drive_size: { category: 'Storage', subCategory: 'Storage sizing' },
        tempdb_drive_size: { category: 'Storage', subCategory: 'Storage sizing' },
        user_data_files: { category: 'Storage', subCategory: 'Storage layout' },
        transaction_log_files: { category: 'Storage', subCategory: 'Storage layout' },
        tempdb_files: { category: 'Storage', subCategory: 'Storage layout' },
        ontap_configuration: { category: 'Storage', subCategory: 'Storage configuration' },
        os_configuration: { category: 'Storage', subCategory: 'Storage configuration' },
        compute_rightsizing: { category: 'Compute', subCategory: 'Compute_sub' },
        host_os_patch: { category: 'Compute', subCategory: 'Compute_sub' },
        sql_licenses: { category: 'Application', subCategory: 'Application_sub' }
    };
    Object.keys(cardData).map((key: any) => {
        const checkCategory =
            !filters['all-catagories'] || filters['all-catagories'].includes(categoryData[key]?.category);
        const checkSubCategory =
            !filters['sub-catagories'] || filters['sub-catagories'].includes(categoryData[key]?.subCategory);

        const isOptmized = cardData[key]['block_two'].value === GETWELL_VALUES.optimized;
        const checkStatus =
            !filters.status ||
            (filters.status.includes(GETWELL_VALUES.optimized) && isOptmized) ||
            (filters.status.includes('Not optimized') && !isOptmized);

        const checkSeverity = !filters.severity || filters.severity.includes(cardData[key]['block_four'].value);

        const checkTags =
            !filters.tags || filters.tags.filter((tag: string) => cardData[key].tags.includes(tag)).length > 0;

        if (checkCategory && checkSubCategory && checkStatus && checkSeverity && checkTags) {
            filteredCardData[key] = cardData[key];
            if (categoryData[key] && cardData[key]['block_two'].value) {
                configCount++;
            }
        }
    });
    return { data: filteredCardData, configCount };
};

export const resetGwValuesOnRefresh = (dispatch: any) => {
    dispatch(setDriftAssessmentData(null));
    dispatch(setCardData(cardDataDefault));
    dispatch(setOsConfigTableData(null));
    dispatch(setOntapConfigTableData(null));
    dispatch(setOptimizationBreakDown(null));
    dispatch(setOptimizingData({}));
    dispatch(setOptimizingInstanceData(false));
};

export const handleOptimizeStorageJob = (
    res: any,
    rowData: any,
    failedMsgData: any,
    getJobDetailApi: any,
    dispatch: any
) => {
    const state = store.getState();
    let optimizingData = state.getWellOptimize.optimizingData || {};

    setTimeout(() => {
        if (res?.data) {
            const jobInterval = setInterval(() => {
                getJobDetailApi({
                    id: res?.data?.jobId
                }).then((jobRes: any) => {
                    const status = jobRes?.data?.status;
                    const state = store.getState();
                    let optimizingData = state.getWellOptimize.optimizingData || {};
                    if (status === JOB_MONITORING_STATUS.COMPLETED) {
                        dispatch(
                            setOptimizingData({
                                ...optimizingData,
                                [rowData?.id]: 'optimized'
                            })
                        );
                        formatGetWellData(dispatch);
                        dispatch(
                            addNotification({
                                notificationType: NOTIFICATION_TYPES.SUCCESS,
                                message: `${rowData?.name} optimized successfully.`
                            })
                        );
                        dispatch(setOptimizingInstanceData(false));
                        clearInterval(jobInterval);
                    } else if (status === JOB_MONITORING_STATUS.FAILED) {
                        dispatch(
                            setOptimizingData({
                                ...optimizingData,
                                [rowData?.id]: ''
                            })
                        );
                        formatGetWellData(dispatch);
                        dispatch(
                            addNotification({
                                notificationType: NOTIFICATION_TYPES.ERROR,
                                message: failedMsgData
                            })
                        );
                        dispatch(setOptimizingInstanceData(false));
                        clearInterval(jobInterval);
                    }
                });
            }, OPTIMIZE_POLLING_INTERVAL);
        } else {
            dispatch(
                setOptimizingData({
                    ...optimizingData,
                    [rowData?.id]: ''
                })
            );
            formatGetWellData(dispatch);
            dispatch(setOptimizingInstanceData(false));
            // Error message for failed optimization API will be returned here
        }
    }, 10);
};
