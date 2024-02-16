import { optionType } from '@netapp/design-system/dist/components/Select';
import { TableProps } from '@netapp/design-system/dist/components/Table';
import numeral from 'numeral';
import { GENERAL, SELECT_CONFIG } from './appConstants';
import {
    API_ERRORS,
    COSTING_TYPES,
    CREATE_DATABASE_YAML,
    CREDENTIAL_PROD_LINK,
    CREDENTIAL_STAGE_LINK,
    DB_HOME_DATA_TYPE,
    DEFAULT_MASTER_KEY,
    DISABLED_STATE,
    ENABLED_STATE,
    JM_DOWNLOAD,
    JOBS_REPORT,
    JOB_MONITORING_STATUS,
    PENDING_DELETION,
    PRODUCTION,
    RECOMMENDED_TEMPLATES,
    REGIONS_CODE_LIST,
    SQL_DATABASE,
    SQL_DEPLOYMENT_MODE,
    STATUS_CONST
} from './consts';
import { AvailabilityZonesObj, KmsKeys, Regions, Subnets, TagObj } from './types/mssqlTypes';
import store from '../store/store';
import { DatabaseHostItem, DatabaseJobsItem, JobsSummaryRes } from './types/databaseHomeTypes';
import { WorkloadFactoryDatabaseItem, WorkloadFactoryResourceDetails } from './types/workloadFactoryResourceTypes';
import { databaseHomeApi } from './apiService';
import { addInitialData, initialDBHomepageState } from '../store/workloadFactory/databaseHomeSlice';
const moment = require('moment');

// Extended to store data that requires for another API input or post request
interface OptionsWithData extends optionType {
    data?: Object;
}

export const generateOptionType = (
    value: string | any,
    label: string | any,
    label2: string,
    isDisabled: boolean,
    disabledTitle: string,
    data?: Object
) => {
    const option: OptionsWithData = {
        value: value,
        label: label,
        label2: label2,
        isDisabled: isDisabled,
        disabledTitle: disabledTitle,
        data: data
    };
    return option;
};

export function getSelectedFromSelectionState<T extends { id: string }>(
    selectionState: TableProps['selectionState'],
    data: T[]
): T[] {
    const selectedRows = selectionState?.rows;

    if (!selectedRows) return [];

    const rows: T[] = [];

    for (let item in selectedRows) {
        if (selectedRows[item]) {
            const entry = data.find(entry => {
                return entry.id === item;
            });

            if (entry) {
                rows.push(entry);
            }
        }
    }

    return rows;
}

export const formatSize = (value: number, passedformat?: string) => {
    let byteVal = 0;
    if (passedformat === 'kib') {
        byteVal = value * 1024;
    } else if (passedformat === 'mib') {
        byteVal = value * 1024 * 1024;
    } else if (passedformat === 'gib') {
        byteVal = value * 1024 * 1024 * 1024;
    } else if (passedformat === 'tib') {
        byteVal = value * 1024 * 1024 * 1024 * 1024;
    } else {
        byteVal = value;
    }
    return numeral(byteVal).format('0.[00] ib');
};

export const formatKmsData = (data: { keys?: KmsKeys[] }) => {
    let newData: KmsKeys[] = [];
    data?.keys
        ?.filter((key: KmsKeys) => key?.state === ENABLED_STATE || key?.state === PENDING_DELETION)
        .map((val: KmsKeys) => {
            if (val?.state === DISABLED_STATE) {
                val = {
                    ...val,
                    cellProps: {
                        isDisabled: true
                    }
                };
            }
            if (val?.name === DEFAULT_MASTER_KEY) {
                val = { ...val, default: true };
                newData.unshift(val);
            } else {
                newData.push(val);
            }
        });
    return newData;
};

export const formatVpcSubnetsData = (data: { subnets: Subnets[] }) => {
    let azObj: AvailabilityZonesObj = {};
    data?.subnets?.map((val: Subnets) => {
        const azName = val?.availabilityZone;
        if (azName && azObj.hasOwnProperty(azName)) {
            azObj[azName].push(val);
        } else if (azName && !azObj.hasOwnProperty(azName)) {
            azObj[azName] = [val];
        }
    });
    return azObj;
};

export const dbPassVal = (password: string) => {
    if (password?.length) {
        const state = store.getState();
        const userName = state.mssqlForm.dbCredentials.name;
        if (state.auth.isDemoMode) {
            return '';
        }
        const categories = [
            /[A-Z]/, // uppercase letters
            /[a-z]/, // lowercase letters
            /[0-9]/, // Base 10 digits
            /[!$#%]/ // Non-alphanumeric characters
        ];

        const metCategories = categories.filter(category => category.test(password));

        if (password.length >= 8 && metCategories.length >= 3 && !password.includes(userName)) {
            return '';
        } else {
            return GENERAL.PASSWORD_ERROR_CHECK;
        }
    }
};

export const adPassVal = (password: string) => {
    if (password?.length && password.length < 8) {
        return GENERAL.PASSWORD_MIN_LENGTH_8;
    }
};

export const fsxPassVal = (password: string) => {
    if (password?.length) {
        const state = store.getState();
        if (state.auth.isDemoMode) {
            return '';
        }
        let fsxUserName = '';
        if (state.mssqlForm.fsxN.fsxNType === GENERAL.SELECT_EXISTING_FSX) {
            fsxUserName = state.mssqlForm.fsxN.fsxNExistingUserName;
        } else {
            fsxUserName = state.mssqlForm.fsxN.fsxNNewUserName;
        }
        // Criteria checks
        const isAtLeastEightChars = password.length >= 8;
        const hasAtLeastOneNumber = /[0-9]/.test(password);
        const hasAtLeastOneAlphabetic = (password.match(/[a-zA-Z]/g) || []).length >= 1;

        if (isAtLeastEightChars && hasAtLeastOneNumber && hasAtLeastOneAlphabetic && !password.includes(fsxUserName)) {
            return '';
        } else {
            return GENERAL.PASSWORD_ERROR_CHECK;
        }
    }
};

export const encodeAll = (text: string) => {
    if (text && typeof text === 'string') {
        const internalEncoding = text
            .replace(/%/g, '%25')
            .replace(/\//g, '%2F')
            .replace(/\./g, '%2E')
            .replace(/-/g, '%2D')
            .replace(/\(/g, '%2C');
        const encodedComponent = encodeURIComponent(internalEncoding);
        return encodedComponent.replace(/%/g, '---'); //replacing the precent to prevent the default encoding on the way back which ruined the url
    }
    return text;
};

export const requiredFieldError = (inputString: string) => {
    if (!inputString) {
        return null;
    }
    const regex = /'([^']+)'/;
    const match = inputString.match(regex);
    const subStr = 'must have required property';
    if (match && match.length >= 2 && inputString.includes(subStr)) {
        return match[1];
    } else {
        return null;
    }
};

export const customErrorMessages = (inputString: string) => {
    if (!inputString) {
        return null;
    }
    if (inputString.includes(API_ERRORS.DUPLICATE_CONFIG_NAME)) {
        return SELECT_CONFIG.DUPLICATE_CONFIG_NAME;
    }
    return inputString;
};

export const getCssVariableValue = (variableName: string) =>
    getComputedStyle(document.body).getPropertyValue(variableName);

export const formatDate = (date: string | number) => {
    const dateStr = date.toString();
    const timeStamp = dateStr.substring(6, dateStr.length - 2);
    return moment(new Date(parseInt(timeStamp))).format('LL');
};

export const formatDateWithTime = (date: string | number) => {
    const dateStr = date.toString();
    return moment(new Date(parseInt(dateStr))).format('LL HH:mm');
};

export const isNotNumberOrNA = (value: string | number) => {
    if (!value) {
        return false;
    } else {
        return isNaN(parseFloat(String(value))) && value !== 'N/A';
    }
};

export const formatSizeOrString = (value: number) => {
    if (!isNaN(parseFloat(value.toString()))) {
        return formatSize(value);
    } else {
        return value;
    }
};

export const regionsSort = (regions: Array<Regions>) => {
    if (!regions || regions.length < 2) {
        return regions;
    }

    const newRegionList = regions.slice().sort((a, b) => {
        const indexA = REGIONS_CODE_LIST.indexOf(a.regionCode || '');
        const indexB = REGIONS_CODE_LIST.indexOf(b.regionCode || '');
        if (indexA !== -1 && indexB !== -1) {
            return indexA - indexB;
        }
        if (indexA !== -1) {
            return -1;
        }
        if (indexB !== -1) {
            return 1;
        }
        return 0;
    });
    return newRegionList;
};

export const isValidUserName = (userName: string) => {
    if (
        userName &&
        userName.length &&
        (userName.length < 5 ||
            !/^[a-zA-Z0-9]+$/.test(userName) ||
            userName === 'admin' ||
            userName === 'administrator')
    ) {
        return GENERAL.USERNAME_TOOLTIP;
    }
};

export const sortListOfDict = (dataList: any, field: string, ascOrder = true) => {
    if (!dataList || (dataList && dataList.length < 2)) {
        return dataList;
    }
    let newDBList = [];
    try {
        if (ascOrder) {
            newDBList = dataList
                .slice()
                .sort((a: any, b: any) => a[field].toString().localeCompare(b[field].toString()));
        } else {
            newDBList = dataList
                .slice()
                .sort((a: any, b: any) => b[field].toString().localeCompare(a[field].toString()));
        }
    } catch {
        return dataList;
    }
    return newDBList;
};

export const formatSizeOnePrecision = (value: number | string) => numeral(value).format('0.[0] ib');

export const formatSizeSplit = (value: number | string) => {
    const formatted = formatSizeOnePrecision(value);
    const splitted = formatted.split(' ');
    const actualValue = splitted[0];
    const format = splitted[1];
    return { value: actualValue, format };
};

export const displayFormattedValue = (value: number, msg: string) => {
    return `${formatSize(value)} ${msg}`;
};

export const generateRandomDBName = () => {
    return SQL_DATABASE + Array.from(Array(4), () => Math.floor(Math.random() * 36).toString(36)).join('');
};

export const formatFractionalNumber = (value: number | undefined, precision: number = 1) => {
    if (Number.isNaN(value)) {
        return 0;
    }
    if (value && typeof value === 'number' && !Number.isInteger(value)) {
        return value.toFixed(precision);
    }
    return value;
};

export const mergeDatabaseHostsData = (hostsData: DatabaseHostItem[] | null) => {
    if (!hostsData) {
        return [];
    }
    let uniqueIds: Array<String> = [];
    const mergedList: any[] = [];
    hostsData?.map(val => {
        if (!uniqueIds.includes(val?.id)) {
            // Protection text added to enable filter
            let protectionText = '';
            if (
                val?.protection?.isAwsBackUpEnabled ||
                val?.protection?.isFsxOntapSnapshotsEnabled ||
                val?.protection?.isSqlNativeEnabled
            ) {
                protectionText = GENERAL.PROTECTED;
            } else if (val?.protection) {
                protectionText = GENERAL.NOT_PROTECTED;
            }
            const storagePercent = val?.storage ? (val.storage?.spaceSavings / val.storage?.used) * 100 : 0;
            val = {
                ...val,
                type: DB_HOME_DATA_TYPE.HOSTS,
                databaseHostname: (val?.name || '') + (val?.status || ''),
                protectionText: protectionText,
                // Total cost to enable search in table
                totalCost: (
                    (val?.estimatedUsageCost?.compute || 0) +
                    (val?.estimatedUsageCost?.storage || 0) +
                    (val?.estimatedUsageCost?.connectivity || 0) +
                    (val?.estimatedUsageCost?.others || 0)
                ).toString(),
                // performance table text to search in table
                performanceText: val?.performance && val.performance?.assessment,
                // Storage saving table text to search in table
                storageSavingsText:
                    val?.storage &&
                    formatFractionalNumber(storagePercent, 2) +
                        '% (' +
                        formatSizeOnePrecision(val.storage?.spaceSavings) +
                        ')'
            };
            mergedList.push(val);
            uniqueIds.push(val?.id);
        }
    });
    return mergedList;
};

export const jobStatusPercent = (data: JobsSummaryRes) => {
    if (!data) {
        return null;
    }
    const completed = data?.completed || 0;
    const failed = data?.failed || 0;
    const inProgress = data?.inProgress || 0;
    const totalJobs = failed + inProgress + completed;
    const newData = {
        ...data,
        totalJobs: totalJobs,
        completedPercent: completed ? (completed / totalJobs) * 100 : 0,
        failedPercent: failed ? (failed / totalJobs) * 100 : 0,
        inProgressPercent: inProgress ? (inProgress / totalJobs) * 100 : 0
    };
    return newData;
};

export const getHostStatusCount = (data: DatabaseHostItem[]) => {
    let totalUpHosts = 0;
    let totalInitializingHosts = 0;
    let totalDownHosts = 0;
    let totalFailedHosts = 0;
    let totalDatabases = 0;

    data?.map(val => {
        if (val?.status === STATUS_CONST.UP) {
            totalUpHosts += 1;
        } else if (val?.status === STATUS_CONST.INITIALIZING) {
            totalInitializingHosts += 1;
        } else if (val?.status === STATUS_CONST.DOWN) {
            totalDownHosts += 1;
        } else if (val?.status === STATUS_CONST.FAILED) {
            totalFailedHosts += 1;
        }
        totalDatabases += val?.databaseCount || 0;
    });
    return {
        totalDatabases: totalDatabases,
        totalHosts: data?.length || 0,
        totalUpHosts: totalUpHosts,
        totalInitializingHosts: totalInitializingHosts,
        totalDownHosts: totalDownHosts,
        totalFailedHosts: totalFailedHosts
    };
};

export const getAggrProtection = (data: DatabaseHostItem[] | WorkloadFactoryDatabaseItem[]) => {
    let protectedDb = 0;
    let unprotectedDb = 0;
    let awsBackupDb = 0;
    let fsxOntapSnapshotsDb = 0;
    let sqlServerBackupDb = 0;

    data?.map((val: any) => {
        if (
            val?.protection?.isAwsBackUpEnabled ||
            val?.protection?.isFsxOntapSnapshotsEnabled ||
            val?.protection?.isSqlNativeEnabled
        ) {
            protectedDb += 1;
        } else if (
            (val?.status === STATUS_CONST.DOWN ||
                val?.status === STATUS_CONST.UP ||
                val?.status === 'ONLINE' ||
                val?.status === 'OFFLINE') &&
            !val?.protection?.isAwsBackUpEnabled &&
            !val?.protection?.isFsxOntapSnapshotsEnabled &&
            !val?.protection?.isSqlNativeEnabled
        ) {
            unprotectedDb += 1;
        }
        if (val?.protection?.isFsxOntapSnapshotsEnabled) {
            fsxOntapSnapshotsDb += 1;
        }
        if (val?.protection?.isAwsBackUpEnabled) {
            awsBackupDb += 1;
        }
        if (val?.protection?.isSqlNativeEnabled) {
            sqlServerBackupDb += 1;
        }
    });

    const totalHost = protectedDb + unprotectedDb;

    return {
        protectedDb: protectedDb,
        unprotectedDb: unprotectedDb,
        protectedPercent: (protectedDb / totalHost) * 100 || 0,
        unprotectedPercent: (unprotectedDb / totalHost) * 100 || 0,
        awsBackupDb: awsBackupDb,
        fsxOntapSnapshotsDb: fsxOntapSnapshotsDb,
        sqlServerBackupDb: sqlServerBackupDb
    };
};

export const getAggrStorageSavings = (data: DatabaseHostItem[] | WorkloadFactoryResourceDetails[]) => {
    let totalConsume = 0;
    let storageSavings = 0;

    data?.map((val: any) => {
        if (val?.storage?.used) {
            totalConsume += val.storage.used;
        }
        if (val?.storage?.spaceSavings) {
            storageSavings += val.storage.spaceSavings;
        }
    });

    const storageConsume = totalConsume - storageSavings;

    return {
        storageConsumes: formatSizeOnePrecision(storageConsume),
        storageSavings: formatSizeOnePrecision(storageSavings),
        storageSavingsPercent: (storageSavings / totalConsume) * 100 || 0
    };
};

export const getAggrCost = (data: DatabaseHostItem[] | WorkloadFactoryResourceDetails[]) => {
    let storageCost = 0;
    let computeCost = 0;
    let connectivityCost = 0;
    let otherCost = 0;

    let storageList: (string | undefined)[] = [];
    let vpcList: (string | undefined)[] = [];
    let requireBillingPerm = false;
    let noDeploymentChk = true;

    data?.map((val: any) => {
        if (val?.estimatedUsageCost?.compute) {
            computeCost += val.estimatedUsageCost.compute;
        }

        // If storage cost is already added than no need to add again based on FSXId
        let fsxVal = '';
        if (val?.topology?.fileSystemId) {
            fsxVal = val.topology.fileSystemId;
        }
        if ((!fsxVal || !storageList.includes(fsxVal)) && val?.estimatedUsageCost?.storage) {
            storageCost += val.estimatedUsageCost.storage;
            if (fsxVal) {
                storageList.push(fsxVal);
            }
        }

        // If connectivity cost is already added than no need to add again based on VPCId
        let vpcVal = '';
        if (val?.topology?.vpcId) {
            vpcVal = val.topology.vpcId;
        }
        if ((!vpcVal || !vpcList.includes(vpcVal)) && val?.estimatedUsageCost?.connectivity) {
            connectivityCost += val.estimatedUsageCost.connectivity;
            if (vpcVal) {
                vpcList.push(vpcVal);
            }
        }

        if (val?.estimatedUsageCost?.others) {
            otherCost += val.estimatedUsageCost.others;
        }

        if (val?.estimatedUsageCost?.estimationType === COSTING_TYPES.PRICING) {
            requireBillingPerm = true;
        }

        if (
            val?.estimatedUsageCost?.estimationType === COSTING_TYPES.PRICING ||
            val?.estimatedUsageCost?.estimationType === COSTING_TYPES.BILLING
        ) {
            noDeploymentChk = false;
        }
    });

    const totalCost = storageCost + computeCost + connectivityCost + otherCost;

    return {
        storageCost: formatFractionalNumber(storageCost, 2),
        computeCost: formatFractionalNumber(computeCost, 2),
        connectivityCost: formatFractionalNumber(connectivityCost, 2),
        otherCost: formatFractionalNumber(otherCost, 2),
        totalCost: formatFractionalNumber(totalCost, 2),
        storageCostPercent: formatFractionalNumber((storageCost / totalCost) * 100),
        computeCostPercent: formatFractionalNumber((computeCost / totalCost) * 100),
        connectivityCostPercent: formatFractionalNumber((connectivityCost / totalCost) * 100),
        otherCostPercent: formatFractionalNumber((otherCost / totalCost) * 100),
        requireBillingPerm: requireBillingPerm || noDeploymentChk
    };
};

export const wrapContext = (question?: string) => {
    return `\n\nHuman: ${question} \n\nAssistant:`;
};

export const getWlmdbPayload = (params: any) => {
    return {
        region: params.region || '',
        networkConfiguration: {
            vpcCidr: params.vpcCidr || '',
            availabilityZone1: params.availabilityZone1 || ''
        },
        ec2Configuration: {
            workloadInstanceType: params.workloadInstanceType || '',
            keyPairName: params.keyPairName || ''
        },
        adConfiguration: {
            adScenarioType: params.adScenarioType || '',
            domainUsername: params.domainUsername || '',
            domainPassword: params.domainPassword ? '********' : '',
            domainDnsname: params.domainDnsname || '',
            dnsIpaddress: params.dnsIpaddress || ''
        },
        sqlConfiguration: {
            sqlDeploymentMode: params.sqlDeploymentMode || '',
            sqlAmiId: params.sqlAmiId || '',
            serviceAccountName: params.serviceAccountName || '',
            serviceAccountPassword: params.serviceAccountPassword ? '********' : '',
            sqlFciName: params.sqlFciName || ''
        },
        fsxConfiguration: {
            fsxDeploymentMode: params.fsxDeploymentMode || '',
            fsxUsername: params.fsxUsername || '',
            fsxPassword: params.fsxPassword ? '********' : '',
            databaseSize: params.databaseSize || '',
            fsxVolThroughput: params.fsxVolThroughput || '',
            fsxIOPS: params.fsxIOPS || '',
            ontapSgGroupId: params.ontapSgGroupId || ''
        }
    };
};

/*
This function is used to set recommended values for recommended templates load.
Type dev is for Dev/Test template and type prod is for Prod template
*/
export const setRecommendedValues = (initialFormData: any, type: string) => {
    let result = { ...initialFormData };
    if (type === RECOMMENDED_TEMPLATES.DEV_ID) {
        result.selectConfig = SELECT_CONFIG.STANDARD_CREATE;
        // setting instance type
        const value = 'm5.xlarge';
        const label2 = '4vCPU, 16 GiB RAM, 4750Mbps';
        const data = {
            instanceType: 'm5.xlarge',
            vCpus: 4,
            ramInMib: 16384,
            iopsInMbps: 4750,
            architecture: ['x86_64']
        };
        const option = generateOptionType(value, value, label2, false, '', data);
        result.instanceType = option;
        // setting database edition
        result.dbEdition = {
            label: GENERAL.SQL_SERVER_STANDARD_EDITION,
            value: GENERAL.SQL_SERVER_STANDARD
        };
        // setting deployment mode
        result.dbDeploymentModel = {
            label: GENERAL.SINGLE_INSTANCE,
            value: SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE
        };
        //Data drive Size
        result.storageCapacity = {
            capacity: '100',
            unit: 'GiB'
        };
        //Throughput value
        result.throughput = '128';
    } else if (type === RECOMMENDED_TEMPLATES.PROD_ID) {
        result.selectConfig = SELECT_CONFIG.STANDARD_CREATE;
        // setting instance type
        const value = 'm5.2xlarge';
        const label2 = '8vCPU, 32 GiB RAM, 4750Mbps';
        const data = {
            instanceType: 'm5.2xlarge',
            vCpus: 8,
            ramInMib: 32768,
            iopsInMbps: 4750,
            architecture: ['x86_64']
        };
        const option = generateOptionType(value, value, label2, false, '', data);
        result.instanceType = option;
        // setting database edition
        result.dbEdition = {
            label: GENERAL.SQL_SERVER_STANDARD_EDITION,
            value: GENERAL.SQL_SERVER_STANDARD
        };
        // setting deployment mode
        result.dbDeploymentModel = {
            label: GENERAL.FAILOVER_CLUSTER,
            value: SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE
        };
        //Data drive Size
        result.storageCapacity = {
            capacity: '500',
            unit: 'GiB'
        };
        //Throughput value
        result.throughput = '128';
    }

    return result;
};

export const handleDownloadYAML = (data: any, name = 'data') => {
    const yamlData = data;
    const blob = new Blob([yamlData], { type: 'application/x-yaml' });
    const url = window.URL.createObjectURL(blob);

    // Create a link element and trigger a click to download the YAML file.
    const a = document.createElement('a');
    a.href = url;
    a.download = name + '.yaml';
    a.click();

    // Clean up by revoking the object URL.
    window.URL.revokeObjectURL(url);
};

// To get credential id and region for saved config
export const getCredDetails = (data: any) => {
    const state = store.getState();
    const result = {
        accountId: state?.auth?.accountId || '',
        credId: data?.awsAccount?.selectedCredential?.data?.credentialsId || '',
        region: data?.regionAndVpc?.selectedRegion?.data?.regionCode || ''
    };
    return result;
};

export const validateChatbotField = (fieldName: string, value: any) => {
    const val = value.replace(/^"(.+(?="$))"$/, '$1');
    switch (fieldName) {
        case 'fsxPassword':
            return fsxPassVal(val) || '';
        case 'serviceAccountName':
            return isValidUserName(val) || (val && val.length && val.length > 20 && GENERAL.PASSWORD_ERROR_CHECK) || '';
        case 'serviceAccountPassword':
            return dbPassVal(val) || '';
        case 'databaseSize':
            const numValue = parseInt(val);
            return !isNaN(numValue) && numValue >= 120 && numValue <= 13320
                ? ''
                : `Supported capacity should be between 120 GiB to 13320 GiB`;
        case 'sqlServerName':
            return val &&
                (val.length > 15 || !/^[a-zA-Z0-9]/.test(val.charAt(0) || '') || !/^[a-zA-Z0-9/-]+$/.test(val))
                ? GENERAL.DB_NAME_TOOLTIP
                : '';
        case 'domainPassword':
            return adPassVal(val) || '';
    }
};

export const databaseTableSort = (data: DatabaseHostItem[] | null) => {
    if (!data || data.length < 2) {
        return data;
    }
    const sort_order_list = [STATUS_CONST.INITIALIZING, STATUS_CONST.UP, STATUS_CONST.DOWN, STATUS_CONST.FAILED];
    const newDataList = data.slice().sort((a, b) => {
        const indexA = sort_order_list.indexOf(a.status || '');
        const indexB = sort_order_list.indexOf(b.status || '');
        if (indexA !== -1 && indexB !== -1) {
            return indexA - indexB;
        }
        if (indexA !== -1) {
            return -1;
        }
        if (indexB !== -1) {
            return 1;
        }
        return 0;
    });
    return newDataList;
};

export const delay = (ms: number) => {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve('');
        }, ms);
    });
};

export const getChatbotParamsFromPayload = (payload: any) => {
    let params: any = {};
    if (payload?.awsAccount?.selectedCredential?.data?.credentialsId) {
        params.credentialsId = payload.awsAccount.selectedCredential.data.credentialsId;
    }
    if (payload?.dbDeploymentModel?.value) {
        params.fsxDeploymentMode = payload.dbDeploymentModel.value === 'fci' ? 'MULTI_AZ_1' : 'SINGLE_AZ_1';
    }
    if (payload?.regionAndVpc?.selectedRegion?.data?.regionCode) {
        params.region = payload.regionAndVpc.selectedRegion.data.regionCode;
    }
    if (payload?.regionAndVpc?.selectedVPC?.data?.id) {
        params.vpcId = payload.regionAndVpc.selectedVPC.data.id;
    }
    if (payload?.availabilityZones?.selectedAzNode1?.data?.availabilityZone) {
        params.availabilityZone1 = payload.availabilityZones.selectedAzNode1.data.availabilityZone;
    }
    if (payload?.availabilityZones?.selectedSubnetNode1?.data?.id) {
        params.privateSubnet1Id = payload.availabilityZones.selectedSubnetNode1.data.id;
    }
    if (payload?.availabilityZones?.selectedAzNode2?.data?.availabilityZone) {
        params.availabilityZone2 = payload.availabilityZones.selectedAzNode2.data.availabilityZone;
    }
    if (payload?.availabilityZones?.selectedSubnetNode2?.data?.id) {
        params.privateSubnet2Id = payload.availabilityZones.selectedSubnetNode2.data.id;
    }
    if (payload?.keyPair?.selectedKeyPair?.data?.name) {
        params.keyPairName = payload.keyPair.selectedKeyPair.data.name;
    }
    if (payload?.instanceType?.data?.instanceType) {
        params.workloadInstanceType = payload.instanceType.data.instanceType;
    }
    if (payload?.activeDirectory?.userName) {
        params.domainUsername = payload.activeDirectory.userName;
    }
    if (payload?.activeDirectory?.password) {
        params.domainPassword = payload.activeDirectory.password;
    }
    if (payload?.activeDirectory?.domainName?.value) {
        params.domainDnsname = payload.activeDirectory.domainName?.value;
    }
    if (payload?.activeDirectory?.domainAddress) {
        params.dnsIpaddress = payload.activeDirectory.domainAddress;
    }
    if (payload?.dbCredentials?.name) {
        params.serviceAccountName = payload.dbCredentials.name;
    }
    if (payload?.dbCredentials?.password) {
        params.serviceAccountPassword = payload.dbCredentials.password;
    }
    if (payload?.license?.selectedLicenseId?.value) {
        params.sqlAmiId = payload.license.selectedLicenseId.value;
    }
    if (payload?.fsxN?.fsxNExistingName?.data?.fileSystemId) {
        params.fsxFileSystemId = payload.fsxN.fsxNExistingName.data.fileSystemId;
    }
    if (payload?.fsxN?.fsxNNewUserName) {
        params.fsxUsername = payload.fsxN.fsxNNewUserName;
    }
    if (payload?.fsxN?.fsxNPassword) {
        params.fsxPassword = payload.fsxN.fsxNPassword;
    }
    if (payload?.throughput?.value) {
        const throughputVal = payload.throughput.value.split(' ')[0];
        params.fsxVolThroughput = throughputVal ? parseInt(throughputVal) : '';
    }
    if (payload?.securityGroup?.selectedExistingSecurityGroup?.value) {
        params.ontapSgGroupId = payload.securityGroup.selectedExistingSecurityGroup.value;
    }
    if (payload?.dbName) {
        params.sqlServerName = payload.dbName;
    }
    if (payload?.fsxN?.fsxNType) {
        params.fsxType = payload.fsxN.fsxNType === GENERAL.CREATE_NEW_FSXN ? 'NEW' : 'EXISTING';
    }
    if (payload?.dbDeploymentModel?.value) {
        params.sqlDeploymentMode = payload.dbDeploymentModel.value;
    }
    if (payload?.storageCapacity?.capacity && payload?.storageCapacity?.unit) {
        params.databaseSize =
            parseInt(payload.storageCapacity.capacity) * (payload.storageCapacity.unit.value === 'GiB' ? 1 : 1024);
    }
    if (payload?.tags) {
        const tags = payload.tags.filter((tag: TagObj) => tag.key);
        if (tags.length > 0) {
            params.tags = tags;
        }
    }
    if (payload?.activeDirectory?.scenarioType) {
        params.adScenarioType = payload.activeDirectory.scenarioType;
    }
    params.enableCloudWatch = true;
    return params;
};

export const openCredentialTab = () => {
    const state = store.getState();
    const isWorkloadFactoryStatus = state.auth.isWorkloadFactory;
    let url;
    if (isWorkloadFactoryStatus) {
        url = process.env.REACT_APP_CREDENTIAL_WF_LINK;
    } else {
        url = process.env.REACT_APP_ENVIRONMENT === PRODUCTION ? CREDENTIAL_PROD_LINK : CREDENTIAL_STAGE_LINK;
    }
    window.open(url, '_blank', 'noopener');
};

function getLastXDays(val: number) {
    let dates = [];
    for (let i = 0; i < val; i++) {
        let date = new Date();

        date.setDate(date.getDate() - i);
        dates.push(date);
    }
    return dates;
}

// Getting the last 7 days
export const lastSevenDays = getLastXDays(7).reverse();

// Getting the last 14 days
export const last14Days = getLastXDays(14).reverse();

function get30Days() {
    let dates = [];
    for (let i = 0; i < 30; i++) {
        let date = new Date();
        date.setDate(date.getDate() - i);
        dates.push(date);
    }
    return dates;
}

export const last30Days = get30Days().reverse();

export const resetDBHomePageState = (dispatch: any) => {
    dispatch(databaseHomeApi.util.resetApiState());
    dispatch(addInitialData(initialDBHomepageState));
};

export const jobMonitoringStatusMapping = (val: string) => {
    let statusValue = val;
    if (val === JOB_MONITORING_STATUS.COMPLETED) {
        statusValue = GENERAL.JM_COMPLETED;
    } else if (val === JOB_MONITORING_STATUS.FAILED) {
        statusValue = GENERAL.JM_FAILED;
    } else if (val === JOB_MONITORING_STATUS.IN_PROGRESS) {
        statusValue = GENERAL.JM_RUNNING;
    }
    return statusValue;
};

export const downloadCsv = (data: any) => {
    const csv = 'data:text/csv;charset=utf-8,' + data;
    const excel = encodeURI(csv); //Links to CSV

    const link = document.createElement('a');
    link.setAttribute('href', excel); //Links to CSV File
    const dateStr = Date.now().toString();
    link.setAttribute('download', JOBS_REPORT + moment(new Date(parseInt(dateStr))).format('DD_MM_YYYY'));
    link.click();
};

export const addBlankCell = (level: number, result: any) => {
    for (var i: number = 0; i < level; i++) {
        result += ',';
    }
    return result;
};

export const createJobMonitorCSV = (array: any, keys: any, headers: any, result: string, level: number) => {
    result = addBlankCell(level, result);
    result += headers;
    result += '\n'; //New Row

    array.map((item: any) => {
        //Goes Through Each Array Object
        result = addBlankCell(level, result);
        keys.map((key: string) => {
            //Goes Through Each Object value
            if (key && key !== '') {
                let value = item[key] ? String(item[key]) : '';
                if (value && value.includes(',')) {
                    value = '"' + value + '"';
                }
                if (key === 'startTime' || key === 'endTime') {
                    result += value ? formatDateWithTime(value).replace(',', '') + ',' : 'N/A,';
                } else if (key === 'name' && value) {
                    result += value.split(';href')[0] + ',';
                } else if (key === 'status' && value) {
                    result += jobMonitoringStatusMapping(value) + ',';
                } else {
                    if (value) {
                        result += value + ',';
                    } else {
                        result += ' ,';
                    }
                }
            }
        });
        result += '\n'; //Creates New Row
        if (item?.subJobs) {
            result = createJobMonitorCSV(
                item?.subJobs,
                JM_DOWNLOAD.SUB_JOBS_KEYS,
                JM_DOWNLOAD.SUB_JOBS_CSV_HEADERS,
                result,
                level + 1
            );
        }
    });
    if (level === 1) {
        result += '\n'; //New Row
    }
    return result;
};

export const cfDownloadName = (name: string) => {
    return CREATE_DATABASE_YAML + '_' + name + '_' + Date.now();
};

export const getShiftedHoursList = (baseList: Array<String | number>) => {
    let hr = moment().hour();
    // if time is 2 PM than it will be used as 14 but when time is 2:30 than it will be in 18
    const min = moment().minute();
    if (min > 0) {
        hr += 1;
    }
    const shift = (Math.ceil(hr / 4) + 1) % baseList.length;
    return [...baseList.slice(shift), ...baseList.slice(0, shift)];
};

export const groupByTime = (days: number, data: any, baseList: Array<number>) => {
    const dayGrouping: any = {};
    if (days === 1) {
        // grouping for lats 24 hours
        data.map((perObj: any) => {
            if (perObj?.timeInterval || perObj?.timeInterval === 0) {
                let hr = perObj?.timeInterval;
                const min = perObj?.minutes;
                if (min > 0) {
                    hr += 1;
                }
                const index = Math.ceil(hr / 4) % baseList.length;
                const newTimeInterval = baseList[index];
                if (newTimeInterval in dayGrouping) {
                    dayGrouping[newTimeInterval] = {
                        completed: dayGrouping[newTimeInterval]?.completed + (perObj?.completed || 0),
                        failed: dayGrouping[newTimeInterval]?.failed + (perObj?.failed || 0)
                    };
                } else {
                    dayGrouping[newTimeInterval] = {
                        completed: perObj?.completed || 0,
                        failed: perObj?.failed || 0
                    };
                }
            }
        });
    } else {
        // Grouping for days
        data.map((perObj: any) => {
            if (perObj?.timeInterval) {
                if (perObj?.timeInterval in dayGrouping) {
                    dayGrouping[perObj?.timeInterval] = {
                        completed: dayGrouping[perObj?.timeInterval]?.completed + (perObj?.completed || 0),
                        failed: dayGrouping[perObj?.timeInterval]?.failed + (perObj?.failed || 0)
                    };
                } else {
                    dayGrouping[perObj?.timeInterval] = {
                        completed: perObj?.completed || 0,
                        failed: perObj?.failed || 0
                    };
                }
            }
        });
    }
    return dayGrouping;
};

export const groupByJobSummaryTimeline = (data: any, days: number) => {
    const groupedData: any = { time: [], completed: [], failed: [] };
    if (!data || data?.length === 0) {
        return groupedData;
    }

    // Using endTime calculate hr or day
    if (days === 1) {
        data = data.map((e: any) => ({
            ...e,
            timeInterval: new Date(e.endTime).getHours(),
            minutes: new Date(e.endTime).getMinutes()
        }));
    } else {
        data = data.map((e: any) => ({ ...e, timeInterval: new Date(e.endTime).getDate() }));
    }

    // Used only in case of last 24 hours
    const baseList = [0, 4, 8, 12, 16, 20];

    // calculate daysList that is projected as x-axis also
    let lastDaysList: any[] = [];
    let daysList: any[] = [];
    if (days === 1) {
        daysList = getShiftedHoursList(baseList);
    } else {
        if (days === 7) {
            lastDaysList = lastSevenDays;
        } else if (days === 14) {
            lastDaysList = last14Days;
        } else if (days === 30) {
            lastDaysList = last30Days;
        }
        daysList = lastDaysList.map(date => {
            const day = date.getDate();
            return `${day}`;
        });
    }

    // Group data by time used in x-axis line chart
    const dayGrouping = groupByTime(days, data, baseList);

    daysList.map(day => {
        groupedData['time'].push(day);
        groupedData['completed'].push(day in dayGrouping ? dayGrouping[day]?.completed : 0);
        groupedData['failed'].push(day in dayGrouping ? dayGrouping[day]?.failed : 0);
    });

    return groupedData;
};

export const collapseAllRows = (updateRowState: any, rowState: any) => {
    for (const rowId in rowState) {
        if (rowState[rowId]?.isExpanded) {
            updateRowState(rowId)({
                isExpanded: !rowState[rowId]?.isExpanded
            });
        }
    }
};

export const expandTableRow = (
    updateRowState: (arg0: any) => { (arg0: { isExpanded: boolean }): void; new (): any },
    rowData: { id: any },
    currentRowState: { isExpanded: any },
    rowState: any
) => {
    collapseAllRows(updateRowState, rowState);
    updateRowState(rowData.id)({
        isExpanded: !currentRowState?.isExpanded
    });
};

export const getCurrentDateTime = () => {
    const currentDate = new Date();

    // Format the date as "January 30, 2024, 00:00:00"
    const formattedDate = currentDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const formattedTime = currentDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });

    return `${formattedDate}, ${formattedTime}`;
};

export const initialColStateManagedHosts = {
    1: {
        isHidden: false,
        isRemovalDisabled: true
    },
    2: {
        isHidden: false
    },
    3: {
        isHidden: false
    },
    4: {
        isHidden: false
    },
    5: {
        isHidden: false
    },
    6: {
        isHidden: false
    },
    7: {
        isHidden: false
    },
    8: {
        isHidden: true
    },
    9: {
        isHidden: true
    },

    10: {
        isHidden: true
    },
    11: {
        isHidden: true
    }
};
