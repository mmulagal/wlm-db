import {
    setCardData,
    setGwTimestamp,
    setOntapConfigTableData,
    setOptimizationBreakDown,
    setOsConfigTableData
} from '../../store/workloadFactory/getWellOptimizeSlice';
import { GETWELL_CONFIG, GETWELL_VALUES } from '../../utils/consts';
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
        tags: []
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
                'To optimize storage performance, provision file system capacity as 1.35 times the size of total database usage.',
            values: ['Under-provisioned: 0-35%', 'Optimized: 36-100%', 'Over-provisioned: >100%']
        },
        tags: []
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
        tags: []
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
        tags: []
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
        tags: []
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
        tags: []
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
        tags: []
    },
    ontap_configuration: {
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
        },
        tags: []
    },
    os_configuration: {
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
        },
        tags: []
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
            value: 'Critical'
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
            value: 'Critical'
        },
        tags: []
    }
};

// This function is used to format the data for the individual card main config.
export const formatIndividualCardMainConfig = (data: AssessmentResponseInterface) => {
    let cardsData = {};
    let cardMainConfig = [data?.storage?.sizing, data?.storage?.layout];
    cardMainConfig?.map(category => {
        category?.map((item: PerConfigInterface) => {
            let itemName = item?.name || '';
            itemName = GETWELL_CONFIG?.[itemName] || itemName;
            cardsData = {
                ...cardsData,
                [itemName]: {
                    ...(cardDataDefault?.[itemName] || {}),
                    block_two: {
                        ...(cardDataDefault?.[itemName]?.block_two || {}),
                        value: GETWELL_VALUES[item?.status || ''] || item?.status
                    },
                    block_three: {
                        ...(cardDataDefault?.[itemName]?.block_three || {}),
                        value: GETWELL_VALUES?.[item?.recommended || ''] || item?.recommended
                    },
                    block_four: {
                        ...(cardDataDefault?.[itemName]?.block_four || {}),
                        value: GETWELL_VALUES?.[item?.severity || ''] || item?.severity
                    },
                    tags: item?.tags
                }
            };
        });
    });
    return cardsData;
};

// This function is used to format the ONTAP configuration data.
export const formatOntapConfig = (data: AssessmentResponseInterface) => {
    let ontapTagsList: Array<string> = [];
    const ontapConfigList = [
        ...(data?.storage?.configuration?.volumes || []),
        ...(data?.storage?.configuration?.luns || [])
    ];
    let formatOntapConfigList: PerConfigInterface[] = [];
    ontapConfigList?.map((item: PerConfigInterface) => {
        formatOntapConfigList.push({
            ...item,
            name: GETWELL_CONFIG?.[item?.name || ''] || item?.name,
            status: GETWELL_VALUES?.[item?.status || ''] || item?.status,
            severity: GETWELL_VALUES?.[item?.severity || ''] || item?.severity
        });
        ontapTagsList = [...ontapTagsList, ...(item?.tags || [])];
    });

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
    return { formatOntapConfigList, ontapTagsList, ontapOptimizedConfig, ontapNotOptimizedConfig };
};

// This function is used to format the OS configuration data.
export const formatOsConfig = (data: AssessmentResponseInterface) => {
    let osTagsList: Array<string> = [];
    let formatOsConfigList: PerConfigInterface[] = [];
    data?.storage?.configuration?.os?.map((item: PerConfigInterface) => {
        formatOsConfigList.push({
            ...item,
            name: GETWELL_CONFIG?.[item?.name || ''] || item?.name,
            status: GETWELL_VALUES?.[item?.status || ''] || item?.status,
            severity: GETWELL_VALUES?.[item?.severity || ''] || item?.severity
        });
        osTagsList = [...osTagsList, ...(item?.tags || [])];
    });

    let osOptimizedConfig = 0;
    let osNotOptimizedConfig = 0;
    data?.storage?.configuration?.os?.map((item: PerConfigInterface) => {
        if (item?.status === 'optimized') {
            osOptimizedConfig++;
        } else {
            osNotOptimizedConfig++;
        }
    });
    return { formatOsConfigList, osTagsList, osOptimizedConfig, osNotOptimizedConfig };
};

// This function is used to format the optimization breakdown data.
export const formatOptimizationBreakDown = (data: AssessmentResponseInterface) => {
    let optBreakDown = {
        storage: {
            total: data?.storage?.optimisedCount?.total ?? 0,
            optimized: data?.storage?.optimisedCount?.optimised ?? 0,
            percent: data?.storage?.optimisedCount
                ? formatNumberWithCustomComma(
                      ((data?.storage?.optimisedCount?.optimised ?? 0) / (data?.storage?.optimisedCount?.total ?? 1)) *
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
            percent: data?.storage?.optimisedCount
                ? formatNumberWithCustomComma(
                      ((data?.storage?.optimisedCount?.optimised || 0) / (data?.storage?.optimisedCount?.total || 1)) *
                          100
                  )
                : 0
        }
    };
    return optBreakDown;
};

// This function is used to format the get well data.
export const formatGetWellData = (data: AssessmentResponseInterface, dispatch: any) => {
    let cardsData = formatIndividualCardMainConfig(data);

    const { formatOntapConfigList, ontapTagsList, ontapOptimizedConfig, ontapNotOptimizedConfig } =
        formatOntapConfig(data);

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
                    formatNumberWithCustomComma(
                        (ontapNotOptimizedConfig / (ontapOptimizedConfig + ontapNotOptimizedConfig)) * 100
                    ) + '%'
            },
            block_four: {
                ...cardDataDefault?.ontap_configuration?.block_four,
                value: 'Critical'
            },
            tags: ontapTagsList.filter((value: any, index: any, self: string | any[]) => self.indexOf(value) === index)
        }
    };

    const { formatOsConfigList, osTagsList, osOptimizedConfig, osNotOptimizedConfig } = formatOsConfig(data);

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
                    formatNumberWithCustomComma(
                        (osNotOptimizedConfig / (osOptimizedConfig + osNotOptimizedConfig)) * 100
                    ) + '%'
            },
            block_four: {
                ...cardDataDefault?.os_configuration?.block_four,
                value: 'Warning'
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
