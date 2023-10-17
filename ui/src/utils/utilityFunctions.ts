import { optionType } from '@netapp/design-system/dist/components/Select';
import { TableProps } from '@netapp/design-system/dist/components/Table';
import numeral from 'numeral';
import { GENERAL, SELECT_CONFIG } from './appConstants';
import {
    API_ERRORS,
    DEFAULT_MASTER_KEY,
    DISABLED_STATE,
    ENABLED_STATE,
    PENDING_DELETION,
    RECOMMENDED_TEMPLATES,
    REGIONS_CODE_LIST,
    SQL_DATABASE,
    SQL_DEPLOYMENT_MODE,
    STATUS_CONST
} from './consts';
import { AvailabilityZonesObj, KmsKeys, Regions, Subnets } from './types/mssqlTypes';
import store from '../store/store';
import { DatabaseHostItem, DatabaseJobsItem, JobsSummaryRes } from './types/databaseHomeTypes';
const moment = require('moment');

// Extended to store data that requires for another API input or post request
interface OptionsWithData extends optionType {
    data?: Object;
}

export const generateOptionType = (
    value: string,
    label: string,
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
    if (password.length) {
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

export const fsxPassVal = (password: string) => {
    if (password.length) {
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
    if (value && typeof value === 'number' && !Number.isInteger(value)) {
        return value.toFixed(precision);
    }
    return value;
};

export const mergeDatabaseHostsData = (hostsData: DatabaseHostItem[] | null, jobsData: DatabaseJobsItem[] | null) => {
    if (!hostsData && !jobsData) {
        return [];
    }
    let uniqueIds: Array<String> = [];
    const mergedList: any[] = [];
    jobsData?.map(val => {
        if (!uniqueIds.includes(val?.id)) {
            val = {
                ...val,
                topology: val?.metadata
            };
            mergedList.push(val);
            uniqueIds.push(val?.id);
        }
    });
    hostsData?.map(val => {
        if (!uniqueIds.includes(val?.id)) {
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
    const totalJobs = (data?.failed || 0) + (data?.initializing || 0) + (data?.success || 0);
    const newData = {
        ...data,
        totalJobs: totalJobs,
        successPercent: data?.success ? (data.success / totalJobs) * 100 : 0,
        failedPercent: data?.failed ? (data.failed / totalJobs) * 100 : 0,
        initializingPercent: data?.initializing ? (data.initializing / totalJobs) * 100 : 0
    };
    return newData;
};

export const getHostStatusCount = (data: DatabaseHostItem[]) => {
    let totalUpHosts = 0;
    let totalInitializingHosts = 0;
    let totalDownHosts = 0;
    let totalFailedHosts = 0;

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
    });
    return {
        totalHosts: data?.length || 0,
        totalUpHosts: totalUpHosts,
        totalInitializingHosts: totalInitializingHosts,
        totalDownHosts: totalDownHosts,
        totalFailedHosts: totalFailedHosts
    };
};

export const getAggrProtection = (data: DatabaseHostItem[]) => {
    let protectedDb = 0;
    let unprotectedDb = 0;
    let awsBackupDb = 0;
    let fsxOntapSnapshotsDb = 0;
    let sqlServerBackupDb = 0;

    data?.map(val => {
        if (
            val?.protection?.isAwsBackUpEnabled ||
            val?.protection?.isFsxOntapSnapshotsEnabled ||
            val?.protection?.isSqlNativeEnabled
        ) {
            protectedDb += 1;
        } else {
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
        awsBackupPercent: (awsBackupDb / totalHost) * 100 || 0,
        fsxOntapSnapshotsDb: fsxOntapSnapshotsDb,
        fsxOntapSnapshotsPercent: (fsxOntapSnapshotsDb / totalHost) * 100 || 0,
        sqlServerBackupDb: sqlServerBackupDb,
        sqlServerBackupPercent: (sqlServerBackupDb / totalHost) * 100 || 0
    };
};

export const getAggrStorageSavings = (data: DatabaseHostItem[]) => {
    let storageConsumes = 0;
    let storageSavings = 0;
    let totalSize = 0;

    data?.map(val => {
        if (val?.storage?.allocated) {
            totalSize += val.storage.allocated;
        }
        if (val?.storage?.used) {
            storageConsumes += val.storage.used;
        }
        if (val?.storage?.savings) {
            storageSavings += val.storage.savings;
        }
    });

    return {
        storageConsumes: formatFractionalNumber(storageConsumes / 1024) || 'N/A',
        storageSavings: formatFractionalNumber(storageSavings / 1024) || 'N/A',
        storageSavingsPercent: (storageSavings / totalSize) * 100 || 0
    };
};

export const getAggrCost = (data: DatabaseHostItem[]) => {
    let storageCost = 0;
    let computeCost = 0;
    let connectivityCost = 0;
    let otherCost = 0;

    data?.map(val => {
        if (val?.estimatedUsageCost?.compute) {
            storageCost += val.estimatedUsageCost.compute;
        }
        if (val?.estimatedUsageCost?.storage) {
            computeCost += val.estimatedUsageCost.storage;
        }
        if (val?.estimatedUsageCost?.connectivity) {
            connectivityCost += val.estimatedUsageCost.connectivity;
        }
        if (val?.estimatedUsageCost?.others) {
            otherCost += val.estimatedUsageCost.others;
        }
    });

    const totalCost = storageCost + computeCost + connectivityCost + otherCost;

    return {
        storageCost: storageCost,
        computeCost: computeCost,
        connectivityCost: connectivityCost,
        otherCost: otherCost,
        totalCost: totalCost,
        storageCostPercent: (storageCost / totalCost) * 100,
        computeCostPercent: (computeCost / totalCost) * 100,
        connectivityCostPercent: (connectivityCost / totalCost) * 100,
        otherCostPercent: (otherCost / totalCost) * 100
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
    let result = {...initialFormData};
    if(type === RECOMMENDED_TEMPLATES.DEV_ID) {
        result.selectConfig = SELECT_CONFIG.STANDARD_CREATE;
        // setting instance type 
        const value = 'm5.xlarge';
        const label2 = '2vCPU, 8 GiB RAM, 4750Mbps';
        const data = {
            instanceType: 'm5.xlarge',
            vCpus: 2,
            ramInMib: 8192,
            iopsInMbps: 4750,
            architecture: [
                'x86_64'
            ]
        }
        const option = generateOptionType(value, value, label2, false, '', data);
        result.instanceType = option;
        // setting database edition 
        result.dbEdition = {
            label: GENERAL.SQL_SERVER_STANDARD_EDITION,
            value: GENERAL.SQL_SERVER_STANDARD
        }
        // setting deployment mode
        result.dbDeploymentModel = {
            label: GENERAL.SINGLE_INSTANCE,
            value: SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE
        }
    } else if (type === RECOMMENDED_TEMPLATES.PROD_ID) {
        result.selectConfig = SELECT_CONFIG.STANDARD_CREATE;
        // setting instance type 
        const value = 'r5.xlarge';
        const label2 = '4vCPU, 16 GiB RAM, 4750Mbps';
        const data = {
            instanceType: 'r5.xlarge',
            vCpus: 4,
            ramInMib: 32768,
            iopsInMbps: 4750,
            architecture: [
                'x86_64'
            ]
        }
        const option = generateOptionType(value, value, label2, false, '', data);
        result.instanceType = option;
        // setting database edition 
        result.dbEdition = {
            label: GENERAL.SQL_SERVER_STANDARD_EDITION,
            value: GENERAL.SQL_SERVER_STANDARD
        }
        // setting deployment mode
        result.dbDeploymentModel = {
            label: GENERAL.FAILOVER_CLUSTER,
            value: SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE
        }
    }
    
    return result;
};
