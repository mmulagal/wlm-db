import { NOTIFICATION_TYPES, addNotification } from '../../store/notificationSlice';
import store from '../../store/store';
import {
    setCardData,
    setDriftAssessmentData,
    setGwTimestamp,
    setOntapConfigTableData,
    setOptimizationBreakDown,
    setOptimizingData,
    setOsConfigTableData
} from '../../store/workloadFactory/getWellOptimizeSlice';
import { GETWELL_CONFIG, GETWELL_VALUES, JOB_MONITORING_STATUS, OPTIMIZE_POLLING_INTERVAL } from '../../utils/consts';
import { AssessmentResponseInterface, GwCardDataInterface, PerConfigInterface } from '../../utils/types/getWellTypes';
import { formatNumberWithCustomComma } from '../../utils/utilityFunctions';

// This is strutcure of cardDataDefault. It is used to set the default values for the card data.
export const cardDataDefault: GwCardDataInterface = {
    storage_tier: {
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
            values: ['Under-provisioned: 0-35%', 'Optimized: 36-100%', 'Over-provisioned: >100%']
        },
        tags: ['Performance efficiency']
    },
    transaction_log_drive_size: {
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
            values: ['Under-provisioned: 0-20%', 'Optimized: 21-30%', 'Over-provisioned: >31%']
        },
        tags: ['Operational excellence']
    },
    tempdb_drive_size: {
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
            values: ['Under-provisioned: 0-20%', 'Optimized: 21-30%', 'Over-provisioned: >31%']
        },
        tags: ['Operational excellence']
    },
    user_data_files: {
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
    }
};

// This function is used to format the data for the individual card main config.
export const formatIndividualCardMainConfig = (data: AssessmentResponseInterface, optimizingData: any) => {
    let cardsData = {};
    let cardMainConfig = [data?.storage?.sizing, data?.storage?.layout];
    cardMainConfig?.map(category => {
        category?.map((item: PerConfigInterface) => {
            let itemName = item?.name || '';
            let status = item?.status || '';
            if (optimizingData?.[itemName]) {
                status = optimizingData?.[itemName];
            }
            itemName = GETWELL_CONFIG?.[itemName] || itemName;
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
                        value: GETWELL_VALUES?.[item?.recommended || ''] || item?.recommended
                    },
                    block_four: {
                        ...(cardDataDefault?.[itemName]?.block_four || {}),
                        value: GETWELL_VALUES?.[item?.severity || ''] || item?.severity
                    },
                    tags: item?.tags,
                    id: item?.name
                }
            };
        });
    });
    return cardsData;
};

// This function is used to format the ONTAP configuration data.
export const formatOntapConfig = (data: AssessmentResponseInterface, optimizingData: any) => {
    let ontapTagsList: Array<string> = [];
    let highestOntapSeverity = 'None';
    let formatOntapConfigList: PerConfigInterface[] = [];
    let ontapCritical = 0;
    let ontapWarning = 0;
    data?.storage?.configuration?.volumes?.map((item: PerConfigInterface) => {
        let status = item?.status || '';
        if (optimizingData?.[item?.name || '']) {
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

    data?.storage?.configuration?.luns?.map((item: PerConfigInterface) => {
        let status = item?.status || '';
        if (optimizingData?.[item?.name || '']) {
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

    if (ontapCritical === 1) {
        highestOntapSeverity = 'Critical';
    } else if (ontapWarning === 1) {
        highestOntapSeverity = 'Warning';
    }

    let ontapOptimizedConfig = 0;
    let ontapNotOptimizedConfig = 0;
    let ontapVolAndLunList = [data?.storage?.configuration?.volumes, data?.storage?.configuration?.luns];
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
export const formatOsConfig = (data: AssessmentResponseInterface, optimizingData: any) => {
    let osTagsList: Array<string> = [];
    let highestOsSeverity = 'None';
    let formatOsConfigList: PerConfigInterface[] = [];
    let osCritical = 0;
    let osWarning = 0;
    data?.storage?.configuration?.os?.map((item: PerConfigInterface) => {
        let status = item?.status || '';
        if (optimizingData?.[item?.name || '']) {
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

    if (osCritical === 1) {
        highestOsSeverity = 'Critical';
    } else if (osWarning === 1) {
        highestOsSeverity = 'Warning';
    }

    let osOptimizedConfig = 0;
    let osNotOptimizedConfig = 0;
    data?.storage?.configuration?.os?.map((item: PerConfigInterface) => {
        if (item?.status === 'optimized') {
            osOptimizedConfig++;
        } else {
            osNotOptimizedConfig++;
        }
    });
    return { formatOsConfigList, osTagsList, osOptimizedConfig, osNotOptimizedConfig, highestOsSeverity };
};

// This function is used to format the optimization breakdown data.
export const formatOptimizationBreakDown = (data: AssessmentResponseInterface) => {
    let optBreakDown = {
        storage: {
            total: data?.storage?.optimisedCount?.total ?? 0,
            optimized: data?.storage?.optimisedCount?.optimised ?? 0,
            percent:
                data?.storage?.optimisedCount && data?.storage?.optimisedCount?.optimised !== 0
                    ? formatNumberWithCustomComma(
                          ((data?.storage?.optimisedCount?.optimised ?? 0) /
                              (data?.storage?.optimisedCount?.total ?? 1)) *
                              100
                      )
                    : 0
        },
        total: {
            // Total configuration will be calculated by adding the total number of configurations in the storage layout and sizing
            // Currently only storage is supported to directly adding that to the total
            total: data?.storage?.optimisedCount?.total || 0,
            optimized: data?.storage?.optimisedCount?.optimised || 0,
            notOptimized: (data?.storage?.optimisedCount?.total || 0) - (data?.storage?.optimisedCount?.optimised || 0),
            percent:
                data?.storage?.optimisedCount && data?.storage?.optimisedCount?.optimised !== 0
                    ? formatNumberWithCustomComma(
                          ((data?.storage?.optimisedCount?.optimised || 0) /
                              (data?.storage?.optimisedCount?.total || 1)) *
                              100
                      )
                    : 0
        }
    };
    return optBreakDown;
};

// This function is used to format the get well data.
export const formatGetWellData = (dispatch: any, data?: AssessmentResponseInterface | undefined) => {
    const state = store.getState();
    const optimizingData = state.getWellOptimize.optimizingData || {};
    if (!data) {
        data = state.getWellOptimize.driftAssessmentData || {};
    }
    let cardsData = formatIndividualCardMainConfig(data, optimizingData);

    const {
        formatOntapConfigList,
        ontapTagsList,
        ontapOptimizedConfig,
        ontapNotOptimizedConfig,
        highestOntapSeverity
    } = formatOntapConfig(data, optimizingData);

    cardsData = {
        ...cardsData,
        ['ontap_configuration']: {
            ...cardDataDefault?.ontap_configuration,
            block_two: {
                ...cardDataDefault?.ontap_configuration?.block_two,
                value: ontapNotOptimizedConfig > 0 ? 'Not optimized' : 'Optimized'
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
            tags: ontapTagsList.filter((value: any, index: any, self: string | any[]) => self.indexOf(value) === index)
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
                value: osNotOptimizedConfig > 0 ? 'Not optimized' : 'Optimized'
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
            tags: osTagsList.filter((value: any, index: any, self: string | any[]) => self.indexOf(value) === index)
        }
    };

    let optBreakDown = formatOptimizationBreakDown(data);

    // Dispatch the formatted cards data to the store
    dispatch(setCardData(cardsData));

    // Dispatch the formatted ONTAP configuration data to the store
    dispatch(setOntapConfigTableData(formatOntapConfigList));

    // Dispatch the formatted OS configuration data to the store
    dispatch(setOsConfigTableData(formatOsConfigList));

    // Dispatch the formatted optimization breakdown data to the store
    dispatch(setOptimizationBreakDown(optBreakDown));

    // Dispatch the timestamp to the store
    dispatch(setGwTimestamp(data?.storage?.timestamp));
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
    const filters = groupByType(optimizeFilterTags, 'value');
    const subCategoryData: any = {
        file_system_headroom: 'Storage sizing',
        storage_tier: 'Storage sizing',
        transaction_log_drive_size: 'Storage sizing',
        tempdb_drive_size: 'Storage sizing',
        user_data_files: 'Storage layout',
        transaction_log_files: 'Storage layout',
        tempdb_files: 'Storage layout',
        ontap_configuration: 'Storage configuration',
        os_configuration: 'Storage configuration'
    };
    Object.keys(cardData).map((key: any) => {
        const checkSubCategory = !filters['sub-catagories'] || filters['sub-catagories'].includes(subCategoryData[key]);

        const isOptmized = cardData[key]['block_two'].value === GETWELL_VALUES.optimized;
        const checkStatus =
            !filters.status ||
            (filters.status.includes(GETWELL_VALUES.optimized) && isOptmized) ||
            (filters.status.includes('Not optimized') && !isOptmized);

        const checkSeverity = !filters.severity || filters.severity.includes(cardData[key]['block_four'].value);

        const checkTags =
            !filters.tags || filters.tags.filter((tag: string) => cardData[key].tags.includes(tag)).length > 0;

        if (checkSubCategory && checkStatus && checkSeverity && checkTags) {
            filteredCardData[key] = cardData[key];
        }
    });
    return filteredCardData;
};

export const resetGwValuesOnRefresh = (dispatch: any) => {
    dispatch(setDriftAssessmentData(null));
    dispatch(setCardData(cardDataDefault));
    dispatch(setOsConfigTableData(null));
    dispatch(setOntapConfigTableData(null));
    dispatch(setOptimizationBreakDown(null));
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
    let { headerSelectedCred, headerSelectedRegion } = state.headers;

    setTimeout(() => {
        if (res?.data) {
            const jobInterval = setInterval(() => {
                getJobDetailApi({
                    credentialId: headerSelectedCred?.data?.credentialsId,
                    region: headerSelectedRegion?.label2,
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
                        clearInterval(jobInterval);
                    } else if (status === JOB_MONITORING_STATUS.FAILED) {
                        dispatch(
                            setOptimizingData({
                                ...optimizingData,
                                [rowData?.id]: 'not-optimized'
                            })
                        );
                        formatGetWellData(dispatch);
                        dispatch(
                            addNotification({
                                notificationType: NOTIFICATION_TYPES.ERROR,
                                message: failedMsgData
                            })
                        );
                        clearInterval(jobInterval);
                    }
                });
            }, OPTIMIZE_POLLING_INTERVAL);
        } else {
            dispatch(
                setOptimizingData({
                    ...optimizingData,
                    [rowData?.id]: 'not-optimized'
                })
            );
            formatGetWellData(dispatch);
            // Error message for failed optimization API will be returned here
        }
    }, 10);
};
