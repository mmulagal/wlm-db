import { optionType } from '@netapp/design-system/dist/components/Select';
import { TableProps } from '@netapp/design-system/dist/components/Table';
import { get, sortBy, compact, uniqBy, map } from 'lodash';
import { css } from '@emotion/css';
import numeral from 'numeral';
import { BlueXPListeners, postBlueXPMessage } from '@netapp/design-system';
import moment from 'moment';
import classNames from 'classnames';
import { TFunction } from 'i18next';
import { GENERAL, SELECT_CONFIG } from './appConstants';
import {
    API_ERRORS,
    ASSESSMENT_CONFIG_NAMES,
    ASSESSMENT_CONFIG_OTHER,
    AUTHENTICATION_TYPE,
    CREATE_DATABASE_YAML,
    CREDENTIAL_PROD_LINK,
    CREDENTIAL_STAGE_LINK,
    DBType,
    DB_HOME_DATA_TYPE,
    DEFAULT_MASTER_KEY,
    DETECT_HOST_VAR,
    DISABLED_STATE,
    ENABLED_STATE,
    ERR_MSG_TO_CHECK,
    FORM_OPTIONS,
    FSXN_STORAGE_PROTOCOLS,
    GETWELL_STATUS,
    GIB_IN_BYTE,
    JM_DOWNLOAD,
    JOBS_REPORT,
    JOB_MONITORING_STATUS,
    JOB_MONITORING_TYPE,
    PENDING_DELETION,
    POSTGRE_USERNAME,
    PRODUCTION,
    RECOMMENDED_TEMPLATES,
    REGIONS_CODE_LIST,
    SQL_DATABASE,
    SQL_DEPLOYMENT_MODE,
    STATUS_CONST,
    WLF_TABS,
    severityOptions
} from './consts';
import { AvailabilityZonesObj, KmsKeys, Regions, Subnets, TagObj } from './types/mssqlTypes';
import store from '../store/store';
import { DatabaseHostItem, JobsSummaryRes } from './types/databaseHomeTypes';
import { WorkloadFactoryDatabaseItem, WorkloadFactoryResourceDetails } from './types/workloadFactoryResourceTypes';
import { databaseHomeApi } from './apiService';
import {
    addInitialData,
    initialDBHomepageState,
    setSelectedRowsForDismiss,
    setSelectedRowsForOptimize
} from '../store/workloadFactory/databaseHomeSlice';
import { setSelectedExploreSavingsTab } from '../store/workloadFactory/exploreSavingsSlice';
import { PgsqlInstancesDiscovered } from './types/inventoryV2Types';
import { addNotification, NOTIFICATION_TYPES } from '../store/notificationSlice';

// Extended to store data that requires for another API input or post request
export interface OptionsWithData extends optionType {
    data?: Object;
}

export interface OptionsWitMultipleData {
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
        value,
        label,
        label2,
        isDisabled,
        disabledTitle,
        data
    };
    return option;
};

export const generateMultipleOptionType = (
    value: string | any,
    label: string | any,
    id: string | number,
    isDisabled: boolean,
    disabledTitle: string,
    data?: Object
) => {
    const option: any = {
        value,
        label,
        id,
        isDisabled,
        disabledTitle,
        data
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

    for (const item in selectedRows) {
        if (selectedRows[item]) {
            const entry = data.find(entry => entry.id === item);

            if (entry) {
                rows.push(entry);
            }
        }
    }

    return rows;
}

export const getTruncatedItems = (items: any) => {
    let totalWidth = 0;

    const maxItemsToShow = [];
    const remaining = [];

    // Dynamically calculate the width
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    // @ts-ignore
    context.font = '14px'; // Adjust font-size and family as per your table

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        // @ts-ignore
        const itemWidth = context.measureText(`${item}, `).width;
        // @ts-ignore
        if (totalWidth + itemWidth <= 180 || maxItemsToShow.length === 0) {
            maxItemsToShow.push(item);
            totalWidth += itemWidth;
        } else {
            remaining.push(...items.slice(i));
            break;
        }
    }

    return {
        maxItemsToShow,
        remaining
    };
};

const openNewTabWithPayload = (url: string, payload: {}) => {
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);

    const compactPayload = btoa(payloadString);

    const urlWithFragment = `${url}#wlmdb_data=${compactPayload}`;

    const newTab = window.open(urlWithFragment, '_blank');

    if (!newTab) {
        throw new Error('Failed to open new tab...');
    }

    return newTab;
};

/**
 * Generic function to handle redirects with wlmdbParams for both workload factory and non-workload factory scenarios
 * @param isWorkloadFactory - Boolean indicating if it's workload factory mode
 * @param baseUrl - The base URL for the redirect
 * @param wlmdbParams - The parameters object to be passed with the redirect
 */
export const handleRedirectWithParams = (isWorkloadFactory: boolean, baseUrl: string, wlmdbParams: any) => {
    if (isWorkloadFactory) {
        openNewTabWithPayload(baseUrl, JSON.stringify(wlmdbParams));
    } else {
        postBlueXPMessage({
            type: BlueXPListeners.navigate,
            payload: {
                pathname: '/unified-backup-restore',
                state: {
                    wlmdbParams: JSON.stringify(wlmdbParams)
                }
            }
        });
    }
};

export const bxpRedirect = async (
    isWorkloadFactory: boolean,
    rowData?: any,
    from?: 'instance' | 'database',
    getDiscoverInstanceResult?: any,
    getDiscoverHostResult?: any
) => {
    const stageURL = 'https://staging.console.netapp.com/unified-backup-restore';
    const prodURL = 'https://console.netapp.com/unified-backup-restore';
    const { dispatch } = store;
    const { selectedAgent, alreadyExistAgentId, workSpaceData } = store.getState().snapCenter;
    const { isDemoMode, orgId } = store.getState().auth;

    let baseUrl = '';
    if (import.meta.env.VITE_APP_ENVIRONMENT === PRODUCTION) {
        baseUrl = prodURL;
    } else {
        baseUrl = stageURL;
    }

    // Demo Mode Handling
    if (isDemoMode) {
        if (isWorkloadFactory) {
            window.open(baseUrl, '_blank', 'noopener,noreferrer');
        } else if (window.top) {
            window.top.location.href = baseUrl;
        }
        return;
    }

    const agentID = selectedAgent?.[0]?.id || alreadyExistAgentId;

    // Check if we have the required API for the specific type
    const missingRequiredApi =
        (from === 'instance' && !getDiscoverInstanceResult) || (from === 'database' && !getDiscoverHostResult);

    // Case 1: Default behavior (no additional params) - Updated condition to check agentID instead of selectedAgent
    if (!rowData || !from || !agentID || missingRequiredApi) {
        if (isWorkloadFactory) {
            window.open(baseUrl, '_blank', 'noopener,noreferrer');
        } else if (window.top) {
            window.top.location.href = baseUrl;
        }
        return;
    }

    // Case 2: Dynamic URL building with rowData
    try {
        if (rowData && from === 'instance') {
            // Extract instance information from rowData
            const {
                databaseInstanceName: instanceName, // "MSSQLSERVER" or "INSTANCEJUN_9"
                name: hostName, // "dec04std2"
                hostRow: { fqdn } = {} // "DEC04STD2.WLM.COM"
            } = rowData || {};

            const { id: workspaceID } = workSpaceData || {};

            if (!instanceName || !hostName || !fqdn || !orgId || !agentID || !workspaceID) {
                return;
            }

            // Determine search parameter based on instance type
            // For default instance (MSSQLSERVER), search with fqdn
            // For named instances, search with instance name
            const searchParam = instanceName === 'MSSQLSERVER' ? fqdn : instanceName;

            const searchResult = await getDiscoverInstanceResult({
                accountID: orgId,
                name: searchParam, // Use fqdn for default instance, instance name for named instances
                agentID,
                workspaceID
            }).unwrap();

            // Check for API errors
            if (searchResult.errorMessage || !searchResult.instances || searchResult.instances.length === 0) {
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.ERROR,
                        message:
                            'Discover resources on Unified Backup & Recovery(UBR)  is taking longer time than expected, please check in UBR Job Monitor for more details.'
                    })
                );
                return;
            }

            // Find matching instance with proper name and host validation
            const matchingInstance = searchResult.instances.find((instance: any) => {
                const { name: apiInstanceName, host: apiHostName } = instance || {};

                // Host validation - compare FQDN with API host (case insensitive)
                const hostMatches = fqdn.toLowerCase() === apiHostName.toLowerCase();

                // Instance name validation - handle different formats
                let nameMatches = false;

                if (instanceName === 'MSSQLSERVER') {
                    // For default instance (MSSQLSERVER), API returns just hostname
                    // e.g., "dec04std1" vs "dec04std1"
                    nameMatches = apiInstanceName.toLowerCase() === hostName.toLowerCase();
                } else {
                    // For named instances, API returns hostname\instancename
                    // e.g., "dec04std1\INSTANCEJUN_9" vs "INSTANCEJUN_9"
                    const expectedFullName = `${hostName}\\${instanceName}`.toLowerCase();
                    nameMatches = apiInstanceName.toLowerCase() === expectedFullName.toLowerCase();
                }

                return hostMatches && nameMatches;
            });

            if (matchingInstance) {
                // Build common instance fields
                const { host, name, id, protectionGroupId, policies } = matchingInstance;
                const policy = (Array.isArray(policies) && policies[0]) || undefined;

                if (rowData?.editProtection === true) {
                    const editParams = {
                        source: isWorkloadFactory ? 'wlmdb' : 'wlmdbbxp',
                        type: 'instance',
                        editProtection: true,
                        redirectToWorkloadFactory: false,
                        hostName: host,
                        instanceName: name,
                        instanceId: id,
                        policy,
                        protectionGroupId
                    };
                    handleRedirectWithParams(isWorkloadFactory, baseUrl, editParams);
                    return;
                }

                const instanceParams = {
                    source: isWorkloadFactory ? 'wlmdb' : 'wlmdbbxp',
                    redirectToWorkloadFactory: true,
                    hostName: host,
                    instanceName: name,
                    instanceId: id
                };
                handleRedirectWithParams(isWorkloadFactory, baseUrl, instanceParams);
                return;
            }
        } else if (rowData && from === 'database') {
            const {
                name: databaseName,
                databaseInstanceName: instanceName,
                hostName,
                hostRow: { fqdn } = {}
            } = rowData || {};
            const { id: workspaceID } = workSpaceData;

            if (!databaseName || !instanceName || !hostName || !fqdn || !orgId || !agentID || !workspaceID) {
                return;
            }

            const searchResult = await getDiscoverHostResult({
                accountID: orgId,
                hostName: databaseName,
                agentID,
                workspaceID
            }).unwrap();

            // Check for API errors
            if (searchResult.errorMessage || !searchResult.databases || searchResult.databases.length === 0) {
                return;
            }

            // Find matching database with proper name, instance and host validation
            const matchingDatabase = searchResult.databases.find((database: any) => {
                const { name: apiDatabaseName, instance: apiInstanceName, host: apiHostName } = database || {};

                // Database name validation
                const databaseMatches = apiDatabaseName.toLowerCase() === databaseName.toLowerCase();

                // Host validation - compare FQDN with API host (case insensitive)
                const hostMatches = fqdn.toLowerCase() === apiHostName.toLowerCase();

                // Instance name validation - handle different formats
                let instanceMatches = false;

                if (instanceName === 'MSSQLSERVER') {
                    // For default instance (MSSQLSERVER), API returns just hostname
                    // e.g., "dec04std1" vs "dec04std1"
                    instanceMatches = apiInstanceName.toLowerCase() === hostName.toLowerCase();
                } else {
                    // For named instances, API might return hostname\instancename or just instancename
                    const expectedFullName = `${hostName}\\${instanceName}`.toLowerCase();
                    instanceMatches =
                        apiInstanceName.toLowerCase() === expectedFullName.toLowerCase() ||
                        apiInstanceName.toLowerCase() === instanceName.toLowerCase();
                }

                return databaseMatches && hostMatches && instanceMatches;
            });

            if (matchingDatabase) {
                const { policies, instanceId, name, id, host, instance, storageType, protectionGroupId } =
                    matchingDatabase;

                const policy = (Array.isArray(policies) && policies[0]) || undefined;

                const commonDbParams = {
                    source: isWorkloadFactory ? 'wlmdb' : 'wlmdbbxp',
                    type: 'database',
                    hostName: host,
                    instanceName: instance,
                    instanceId: instanceId || 'unknown',
                    databaseName: name,
                    databaseId: id,
                    policy
                };

                if (rowData?.viewProtectionDetails === true) {
                    const viewDbParams = {
                        ...commonDbParams,
                        policies,
                        storageType,
                        editProtection: false,
                        viewProtection: true,
                        redirectToWorkloadFactory: false
                    };
                    handleRedirectWithParams(isWorkloadFactory, baseUrl, viewDbParams);
                    return;
                }

                if (rowData?.editProtection === true) {
                    const editDbParams = {
                        ...commonDbParams,
                        protectionGroupId,
                        editProtection: true,
                        viewProtection: false,
                        redirectToWorkloadFactory: false
                    };
                    handleRedirectWithParams(isWorkloadFactory, baseUrl, editDbParams);
                    return;
                }

                const databaseParams = {
                    ...commonDbParams,
                    redirectToWorkloadFactory: true
                };
                handleRedirectWithParams(isWorkloadFactory, baseUrl, databaseParams);
                return;
            }
        }
    } catch (error) {
        // console.warn('Error in bxpRedirect:', error);
    }

    // Fallback to base URL
    if (isWorkloadFactory) {
        window.open(baseUrl, '_blank', 'noopener,noreferrer');
    } else if (window.top) {
        window.top.location.href = baseUrl;
    }
};

export const getFilterOptions = (data: any[], propName: string, renderLabel?: (val: any) => any) =>
    !data
        ? []
        : sortBy(
              uniqBy(
                  compact(
                      map(data, row => {
                          const value = get(row, propName, null);
                          return { value, label: renderLabel ? renderLabel(value) : value };
                      })
                  ),
                  'label'
              ),
              'value'
          );

export const formatSize = (value: number, passedformat?: string) =>
    numeral(getByteVal(value, passedformat)).format('0.[00] ib');

export const categorizeStorageSize = (value: string): string => {
    // Convert value string to bytes for comparison
    const sizeInBytes = convertToBytes(value);

    if (sizeInBytes >= 0 && sizeInBytes < 100 * 1024 ** 2) {
        return '0 - 100 MiB';
    }
    if (sizeInBytes >= 100 * 1024 ** 2 && sizeInBytes < 1024 ** 3) {
        return '100 MiB - 1 GiB';
    }
    if (sizeInBytes >= 1024 ** 3 && sizeInBytes < 10 * 1024 ** 3) {
        return '1 GiB - 10 GiB';
    }
    if (sizeInBytes >= 10 * 1024 ** 3 && sizeInBytes < 5 * 1024 ** 4) {
        return '10 GiB - 5 TiB';
    }
    return '5 TiB+';
};

export const cloneAgeRange = (value: any) => {
    if (value >= 60 && value < 99) {
        return '60 - 99 days';
    }
    if (value >= 100 && value <= 200) {
        return '100 - 200 days';
    }
    if (value >= 201) {
        return '200+ days';
    }
};

export const backupStartTime = (selectedAWSBackup: any) => `${selectedAWSBackup?.hour}:${selectedAWSBackup?.minute}`;

// Helper function to convert "GiB" into bytes
const convertToBytes = (sizeStr: string): number => {
    const units: { [key: string]: number } = {
        B: 1,
        KiB: 1024,
        MiB: 1024 ** 2,
        GiB: 1024 ** 3,
        TiB: 1024 ** 4
    };

    // First try to match with unit
    const match = sizeStr.match(/^([\d.]+)\s*(B|KiB|MiB|GiB|TiB)$/);

    // If no unit found, try to match just the number and default to bytes
    if (!match) {
        const numberMatch = sizeStr.trim().match(/^([\d.]+)\s*$/);
        if (numberMatch) {
            const value = parseFloat(numberMatch[1]);
            return value * units.B; // Default to bytes
        }
        throw new Error(`Invalid size format: ${sizeStr}`);
    }

    const value = parseFloat(match[1]);
    const unit = match[2];

    return value * units[unit];
};

export const getByteVal = (value: number, passedformat?: string) => {
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
    return byteVal;
};

export const formatKmsData = (data: { keys?: KmsKeys[] }) => {
    const newData: KmsKeys[] = [];
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
    const azObj: AvailabilityZonesObj = {};
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
        }
        return GENERAL.PASSWORD_ERROR_CHECK;
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
        if (isFsxnExisting(state.mssqlForm.fsxN.fsxNType)) {
            fsxUserName = state.mssqlForm.fsxN.fsxNExistingUserName;
        } else {
            fsxUserName = state.mssqlForm.fsxN.fsxNNewUserName;
        }
        // Criteria checks
        const isAtLeastEightChars = password.length >= 8;
        const hasAtLeastOneNumber = /[0-9]/.test(password);
        const hasAtLeastOneAlphabetic = (password.match(/[a-zA-Z]/g) || []).length >= 1;

        if (
            isAtLeastEightChars &&
            hasAtLeastOneNumber &&
            hasAtLeastOneAlphabetic &&
            !password.includes(fsxUserName) &&
            !password.includes('admin')
        ) {
            return '';
        }
        return GENERAL.PASSWORD_ERROR_CHECK;
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
        return encodedComponent.replace(/%/g, '---'); // replacing the precent to prevent the default encoding on the way back which ruined the url
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
    }
    return null;
};

export const errorMessagesToBlock = (errorMsg: string) => {
    for (const msg of ERR_MSG_TO_CHECK) {
        if (errorMsg.includes(msg)) {
            return true;
        }
    }
    return false;
};

export const customErrorMessages = (inputString: string, endpoint: string) => {
    if (!inputString) {
        return null;
    }
    if (inputString.includes(API_ERRORS.DUPLICATE_CONFIG_NAME)) {
        return SELECT_CONFIG.DUPLICATE_CONFIG_NAME;
    }
    // For deploy API if it gets rate exceeded than update notification message
    if (endpoint === 'deploySqlTemplate' && inputString.toLowerCase().includes(API_ERRORS.RATE_EXCEEDED)) {
        return GENERAL.DEPLOY_RATE_EXCEEDED;
    }
    return inputString;
};

// function to convert byte to TiB
export const bytesToTB = (bytes: number) => {
    const TB = bytes / 1024 ** 4;
    return TB.toFixed(2);
};

// function to convert byte to GiB
export const byteToGiB = (value: number) => {
    if (value === null || value === undefined) return 0;
    if (isNaN(value)) return 0;
    if (value <= 0) return 0;
    const gib = value / 1024 ** 3;

    return +gib.toFixed(2);
};

export const formatDateAssess = (date: string | number) => {
    const dateStr = date.toString();
    return moment(new Date(parseInt(dateStr))).format('DD MMMM YYYY');
};

export const formatDate = (date: string | number) => {
    const dateStr = date.toString();
    const timeStamp = dateStr.substring(6, dateStr.length - 2);
    return moment(new Date(parseInt(timeStamp))).format('LL');
};

export const formatDateWithTime = (date: string | number) => {
    const dateStr = (date && date.toString()) || '';
    return moment(new Date(parseInt(dateStr))).format('LL HH:mm');
};

export const formatTime = (date: string | number) => {
    const dateStr = (date && date.toString()) || '';
    return moment(new Date(parseInt(dateStr))).format('hh:mm A');
};

export const formatDateRange = (startTime: string | number, endTime: string | number) => {
    const startStr = (startTime && startTime.toString()) || '';
    const endStr = (endTime && endTime.toString()) || '';
    const startFormatted = moment(new Date(parseInt(startStr))).format('MMMM DD, YYYY, hh:mm A');
    const endFormatted = moment(new Date(parseInt(endStr))).format('MMMM DD, YYYY, hh:mm A');
    return `${startFormatted} - ${endFormatted}`;
};

export const getTimeDifferenceInDays = (timeStamp1: number, timeStamp2: number) =>
    Math.floor((timeStamp1 - timeStamp2) / 1000 / 60 / 60 / 24);

export const formatSizeOrString = (value: number) => {
    if (!isNaN(parseFloat(value.toString()))) {
        return formatSize(value);
    }
    return value;
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

export const isValidSqlUsername = (username: string, t: TFunction) => {
    const state = store.getState();
    const { selectedAuthenticationType } = state.workloadFactoryResource;

    const forbiddenChars = /[*:;|=,+?`'"]/;
    if (forbiddenChars.test(username)) {
        return t('databases.update-credentials.username-invalid-sql');
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

export const formatSizeTwoPrecision = (value: number | string) => numeral(value).format('0.[00] ib');

export const formatSizeRoundOff = (value: number | string) => numeral(value).format('0 ib');

export const formatSizeSplit = (value: number | string) => {
    const formatted = formatSizeOnePrecision(value);
    const splitted = formatted.split(' ');
    const actualValue = splitted[0];
    const format = splitted[1];
    return { value: actualValue, format };
};

export const generateRandomDBName = () =>
    SQL_DATABASE + Array.from(Array(4), () => Math.floor(Math.random() * 36).toString(36)).join('');

export const generateRandomPGSQLName = () => POSTGRE_USERNAME;

export const generatePGSQLOperatingSystem = () => ({
    value: 'Amazon Linux 2023 AMI',
    label: 'Amazon Linux 2023 AMI',
    label2: 'Amazon Linux 2023 AMI',
    isDisabled: false,
    disabledTitle: ''
});

export function roundOffNumber(number: any) {
    let roundOffNumber;
    if (Number(number) < 1) {
        roundOffNumber = number;
    } else {
        roundOffNumber = Math.round(Number(number));
    }
    return roundOffNumber;
}

export function formatNumberWithCustomComma(number: any, roundOffRequired: boolean = true) {
    let roundOffNumber;
    if (roundOffRequired) {
        if (Number(number) < 1) {
            roundOffNumber = number;
        } else {
            roundOffNumber = Math.round(Number(number));
        }
    } else {
        roundOffNumber = number;
    }

    // Convert the number to a string and remove any existing commas
    const numStr = roundOffNumber.toString().replace(/,/g, '');

    let formattedNumber;

    // Add commas to the number
    if (Number(numStr) > 1) {
        formattedNumber = numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    } else {
        formattedNumber = Number(numStr).toFixed(2);
    }

    return formattedNumber;
}

export const formatFractionalNumber = (value: number | undefined, precision: number = 1) => {
    if (Number.isNaN(value)) {
        return 0;
    }
    if (value && typeof value === 'number' && !Number.isInteger(value)) {
        return value.toFixed(precision);
    }
    return value;
};

export const formatFractionalNumberForCost = (
    value: number | undefined,
    precision: number = 1,
    roundOffRequired: boolean = true
) => {
    if (Number.isNaN(value)) {
        return 0;
    }
    if (value && typeof value === 'number' && !Number.isInteger(value)) {
        const numberForFormat = value.toFixed(precision);
        const formattedNumber = formatNumberWithCustomComma(numberForFormat, roundOffRequired);

        return formattedNumber;
    }
    return value;
};

export const isAwsBackupEnabled = (val: any) =>
    val?.protection?.isAwsBackupEnabled?.fsxw ||
    val?.protection?.isAwsBackupEnabled?.fsxn ||
    val?.protection?.isAwsBackupEnabled?.ebs;

export const getDiscoveredHostDeployment = (host: any) => {
    // This will get deployment type in case of unmanaged hosts
    const sqlServerDeploymentType = host?.sqlServerInstances?.[0]?.sqlServerDeploymentType || '';
    let type = '';

    if (sqlServerDeploymentType.toLowerCase() === SQL_DEPLOYMENT_MODE.AOAG) {
        type = GENERAL.AOAG;
    } else if (sqlServerDeploymentType.toLowerCase() === SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE) {
        type = GENERAL.FAILOVER_CLUSTER_INSTANCES;
    } else if (sqlServerDeploymentType.toLowerCase() === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE) {
        type = GENERAL.STANDALONE;
    } else {
        type = sqlServerDeploymentType;
    }
    return type;
};

export const getAzType = (deploymentType: string | undefined) => {
    if (!deploymentType) {
        return '';
    }
    const singleAzPattern = /^SINGLE_AZ_\d+$/i;
    const multiAzPattern = /^MULTI_AZ_\d+$/i;
    return singleAzPattern.test(deploymentType)
        ? GENERAL.SINGLE_AZ
        : multiAzPattern.test(deploymentType)
        ? GENERAL.MULTI_AZ
        : deploymentType;
};

export const getPgsqlAzType = (perRow: PgsqlInstancesDiscovered) => {
    let deploymentType = '';
    perRow?.storage?.forEach((storageObj: any) => {
        if (storageObj?.deploymentType) {
            deploymentType = storageObj?.deploymentType;
        }
    });
    return getAzType(deploymentType);
};

export const formatHostData = (val: any) => {
    // Protection text added to enable filter
    let protectionText = '';
    if (isAwsBackupEnabled(val) || val?.protection?.isFsxOntapSnapshotsEnabled || val?.protection?.isSqlNativeEnabled) {
        protectionText = GENERAL.PROTECTED;
    } else if (val?.protection) {
        protectionText = GENERAL.NOT_PROTECTED;
    }

    // instance names list
    const instanceNames: string[] = [];
    val?.topology?.ec2Details?.map((row: any) => {
        instanceNames.push(row?.name);
    });

    // AZ Type - Single AZ or Multi AZ
    let azType = '';
    if (val?.topology?.fileSystemDeploymentMode) {
        azType = getAzType(val?.topology?.fileSystemDeploymentMode);
    } else {
        const deploymentType = val?.sqlServerInstances?.[0]?.deploymentTypes?.[0]?.type;
        azType = getAzType(deploymentType);
    }

    // server installation mode
    const serverInstallationMode = val?.topology?.serverInstallationMode || getDiscoveredHostDeployment(val);

    // fileSystemType
    const typeList: string[] = [];
    val?.sqlServerInstances?.[0]?.storage?.map((storageObj: any) => {
        if (storageObj.type === DETECT_HOST_VAR.FSXN && !typeList.includes(GENERAL.FSX_FOR_ONTAP)) {
            typeList.push(GENERAL.FSX_FOR_ONTAP);
        }
        if (storageObj.type === DETECT_HOST_VAR.EBS && !typeList.includes(GENERAL.EBS)) {
            typeList.push(GENERAL.EBS);
        }
        if (storageObj.type === DETECT_HOST_VAR.FSXW && !typeList.includes(GENERAL.FSX_FOR_WINDOWS)) {
            typeList.push(GENERAL.FSX_FOR_WINDOWS);
        }
    });
    const fileSystemType = typeList.join(', ') || val?.topology?.fileSystemType || '';

    let storagePercent = 0;
    let storageSavingsText = '';
    let fsxType = '';
    if (fileSystemType.includes(GENERAL.FSX_FOR_ONTAP)) {
        fsxType = 'fsxn';
    } else if (fileSystemType.includes(GENERAL.FSX_FOR_WINDOWS)) {
        fsxType = 'fsxw';
    } else if (fileSystemType.includes(GENERAL.EBS)) {
        fsxType = 'ebs';
    }

    if (fsxType) {
        storagePercent = val?.storage?.[fsxType]
            ? (val.storage?.[fsxType]?.spaceSavings / val.storage?.[fsxType]?.used) * 100
            : 0;
        storageSavingsText =
            val?.storage?.[fsxType]?.spaceSavings &&
            val?.storage?.[fsxType]?.used &&
            `${formatFractionalNumber(storagePercent, 2)}% (${formatSizeOnePrecision(
                val.storage?.[fsxType]?.spaceSavings
            )})`;
    }

    const totalSize =
        (val?.storage?.fsxn?.size || 0) + (val?.storage?.fsxw?.size || 0) + (val?.storage?.ebs?.size || 0);

    let clusterEc2Instances;
    if (val?.clusterNodeDetails && val?.clusterNodeDetails?.length === 2) {
        clusterEc2Instances = val?.clusterNodeDetails?.map((inst: any) => inst?.ec2InstanceId);
    } else if (val?.ec2InstanceId) {
        clusterEc2Instances = [val?.ec2InstanceId];
    }

    val = {
        ...val,
        type: DB_HOME_DATA_TYPE.HOSTS,
        databaseHostname: (val?.name || '') + (val?.status || '') + (val?.sqlServerInstances?.[0]?.sqlServerName || ''),
        databaseServerName: val?.sqlServerInstances?.[0]?.sqlServerName
            ? val.sqlServerInstances?.[0].sqlServerName.toLowerCase()
            : '',
        protectionText,
        // Total cost to enable search in table
        totalCost: (
            (val?.estimatedUsageCost?.compute || 0) +
            (val?.estimatedUsageCost?.storage?.fsxn || 0) +
            (val?.estimatedUsageCost?.storage?.fsxw || 0) +
            (val?.estimatedUsageCost?.storage?.ebs || 0) +
            (val?.estimatedUsageCost?.connectivity || 0) +
            (val?.estimatedUsageCost?.others || 0)
        ).toString(),
        // performance table text to search in table
        performanceText: val?.performance && val.performance?.assessment,
        // Storage saving table text to search in table
        storageSavingsText,
        sizeformat: val?.storage ? formatSizeTwoPrecision(totalSize) : '',
        instanceNames: instanceNames.join(',') || val?.ec2InstanceName,
        vpcNames: val?.topology?.vpcName || val?.vpc?.name,
        azType,
        serverInstallationMode,
        fileSystemType,
        clusterEc2Instances
    };
    return val;
};

export const jobStatusPercent = (data: JobsSummaryRes) => {
    if (!data) {
        return null;
    }
    const completed = data?.completed || 0;
    const failed = data?.failed || 0;
    const inProgress = data?.inProgress || 0;
    const warning = data?.warning || 0;
    const totalJobs = failed + inProgress + completed + warning;
    const newData = {
        ...data,
        totalJobs,
        completedPercent: completed ? (completed / totalJobs) * 100 : 0,
        failedPercent: failed ? (failed / totalJobs) * 100 : 0,
        inProgressPercent: inProgress ? (inProgress / totalJobs) * 100 : 0,
        warningPercent: warning ? (warning / totalJobs) * 100 : 0
    };
    return newData;
};

export const getAggrProtection = (data: DatabaseHostItem[] | WorkloadFactoryDatabaseItem[]) => {
    let protectedDb = 0;
    let unprotectedDb = 0;
    let awsBackupDb = 0;
    let fsxOntapSnapshotsDb = 0;
    let sqlServerBackupDb = 0;
    let crrEnabled = 0;

    data?.map((val: any) => {
        if (
            isAwsBackupEnabled(val) ||
            val?.protection?.isFsxOntapSnapshotsEnabled ||
            val?.protection?.isSqlNativeEnabled ||
            val?.protection?.isCrrEnabled
        ) {
            protectedDb += 1;
        } else if (
            (val?.status === STATUS_CONST.DOWN ||
                val?.status === STATUS_CONST.UP ||
                val?.status === 'ONLINE' ||
                val?.status === 'OFFLINE') &&
            !val?.protection?.isAwsBackupEnabled?.fsxw &&
            !val?.protection?.isAwsBackupEnabled?.fsxn &&
            !val?.protection?.isAwsBackupEnabled?.ebs &&
            !val?.protection?.isFsxOntapSnapshotsEnabled &&
            !val?.protection?.isSqlNativeEnabled
        ) {
            unprotectedDb += 1;
        }
        if (val?.protection?.isFsxOntapSnapshotsEnabled) {
            fsxOntapSnapshotsDb += 1;
        }
        if (isAwsBackupEnabled(val)) {
            awsBackupDb += 1;
        }
        if (val?.protection?.isSqlNativeEnabled) {
            sqlServerBackupDb += 1;
        }
        if (val?.protection?.isCRREnabled === true) {
            crrEnabled += 1;
        }
    });

    const totalHost = protectedDb + unprotectedDb;

    return {
        protectedDb,
        unprotectedDb,
        protectedPercent: (protectedDb / totalHost) * 100 || 0,
        unprotectedPercent: (unprotectedDb / totalHost) * 100 || 0,
        awsBackupDb,
        fsxOntapSnapshotsDb,
        sqlServerBackupDb,
        crrEnabled,
        crrEnabledPercent: (crrEnabled / totalHost) * 100 || 0
    };
};

export const getAggrStorageSavings = (
    data: DatabaseHostItem[] | WorkloadFactoryResourceDetails[],
    sandboxSavings?: any
) => {
    let totalConsume = 0;
    let storageSavings = 0;
    const storageList: (string | undefined)[] = [];

    data?.map((val: any) => {
        const storageType = val?.topology?.fileSystemType || '';
        const fsxVal = val?.topology?.fileSystemId || '';
        let fsxType = '';
        if (storageType.includes(GENERAL.FSX_FOR_ONTAP)) {
            fsxType = 'fsxn';
        } else if (storageType.includes(GENERAL.FSX_FOR_WINDOWS)) {
            fsxType = 'fsxw';
        } else if (storageType.includes(GENERAL.EBS)) {
            fsxType = 'ebs';
        }
        if (fsxType) {
            if (!fsxVal || !storageList.includes(fsxVal)) {
                if (val?.storage?.[fsxType]?.used) {
                    totalConsume += val.storage[fsxType].used;
                }
                if (val?.storage?.[fsxType]?.spaceSavings) {
                    storageSavings += val.storage[fsxType].spaceSavings;
                }
                if (fsxVal) {
                    storageList.push(fsxVal);
                }
            }
        }
    });

    if (sandboxSavings) {
        totalConsume += (sandboxSavings?.consumedStorage || 0) + (sandboxSavings?.savedStorage || 0);
        storageSavings += sandboxSavings?.savedStorage || 0;
    }
    const storageConsume = totalConsume - storageSavings;

    return {
        storageConsumes: formatSizeOnePrecision(storageConsume),
        storageSavings: formatSizeOnePrecision(storageSavings),
        storageSavingsPercent: (storageSavings / totalConsume) * 100 || 0
    };
};

export const wrapContext = (question?: string) => `\n\nHuman: ${question} \n\nAssistant:`;

/*
This function is used to set recommended values for recommended templates load.
Type dev is for Dev/Test template and type prod is for Prod template
*/
export const setRecommendedValues = (initialFormData: any, type: string) => {
    const result = { ...initialFormData };
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
        // Data drive Size
        result.storageCapacity = {
            capacity: '120',
            unit: 'GiB'
        };
        // Throughput value
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
        // Data drive Size
        result.storageCapacity = {
            capacity: '500',
            unit: 'GiB'
        };
        // Throughput value
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
    a.download = `${name}.yaml`;
    a.click();

    // Clean up by revoking the object URL.
    window.URL.revokeObjectURL(url);
};

export const handleDownloadTerraform = (url: string) => {
    if (url) {
        window.open(url, '_blank', 'noopener');
    }
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
                : 'Supported capacity should be between 120 GiB to 13320 GiB';
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
    const sort_order_list = ['', STATUS_CONST.INITIALIZING, STATUS_CONST.UP, STATUS_CONST.DOWN, STATUS_CONST.FAILED];
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

export const delay = (ms: number) =>
    new Promise(resolve => {
        setTimeout(() => {
            resolve('');
        }, ms);
    });

export const openCredentialTab = () => {
    const state = store.getState();
    const isWorkloadFactoryStatus = state.auth.isWorkloadFactory;
    let url;
    if (isWorkloadFactoryStatus) {
        url = import.meta.env.VITE_APP_CREDENTIAL_WF_LINK;
    } else {
        url = import.meta.env.VITE_APP_ENVIRONMENT === PRODUCTION ? CREDENTIAL_PROD_LINK : CREDENTIAL_STAGE_LINK;
    }
    window.open(url, '_blank', 'noopener');
};

function getLastXDays(val: number) {
    const dates = [];
    for (let i = 0; i < val; i++) {
        const date = new Date();

        date.setDate(date.getDate() - i);
        dates.push(date);
    }
    return dates;
}

export const checkBoxHandle = (tableData: any, rowsData: any, dispatch: any) => {
    if (!rowsData || rowsData.length === 0) return;

    rowsData.forEach((row: any) => {
        // @ts-ignore
        tableData.rows[row.id] = false;
    });

    // @ts-ignore
    tableData.count = 0;
    // @ts-ignore
    tableData.allSelected = false;
    dispatch(setSelectedRowsForOptimize([]));
};

export const checkBoxHandleDismiss = (tableData: any, rowsData: any, dispatch: any) => {
    if (!rowsData || rowsData.length === 0) return;

    rowsData.forEach((row: any) => {
        // @ts-ignore
        tableData.rows[row.id] = false;
    });

    // @ts-ignore
    tableData.count = 0;
    // @ts-ignore
    tableData.allSelected = false;
    dispatch(setSelectedRowsForDismiss([]));
};

// Getting the last 7 days
export const lastSevenDays = getLastXDays(7).reverse();

// Getting the last 14 days
export const last14Days = getLastXDays(14).reverse();

function get30Days() {
    const dates = [];
    for (let i = 0; i < 30; i++) {
        const date = new Date();
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
    } else if (val === JOB_MONITORING_STATUS.WARNING) {
        statusValue = GENERAL.JM_WARNING;
    }
    return statusValue;
};

export const jobMonitoringTypeMapping = (val: string, t: any) => {
    let typeValue = val;
    if (val === JOB_MONITORING_TYPE.DEPLOYMENT) {
        typeValue = 'Deployment';
    } else if (val === JOB_MONITORING_TYPE.CREATE_RESOURCE || val === JOB_MONITORING_TYPE.CREATE_DATABASE) {
        typeValue = 'Create database';
    } else if (val === JOB_MONITORING_TYPE.PREPARE_RESOURCE) {
        typeValue = 'Prepare resource';
    } else if (val === JOB_MONITORING_TYPE.SANDBOX) {
        typeValue = 'Sandbox';
    } else if (val === JOB_MONITORING_TYPE.ASSESSMENT) {
        typeValue = 'Assessment';
    } else if (val === JOB_MONITORING_TYPE.OPTIMIZE || val === JOB_MONITORING_TYPE.WELL_ARCHITECTED) {
        typeValue = 'Well-architected';
    } else if (val === JOB_MONITORING_TYPE.REGISTER_RESOURCE) {
        typeValue = 'Register resource';
    } else if (val === JOB_MONITORING_TYPE.LOGS_ANALYSIS) {
        typeValue = 'Logs analysis';
    }
    return typeValue;
};

export const downloadCsv = (data: any) => {
    const csv = `data:text/csv;charset=utf-8,${data}`;
    const excel = encodeURI(csv); // Links to CSV

    const link = document.createElement('a');
    link.setAttribute('href', excel); // Links to CSV File
    const dateStr = Date.now().toString();
    link.setAttribute('download', JOBS_REPORT + moment(new Date(parseInt(dateStr))).format('DD_MM_YYYY'));
    link.click();
};

export const addBlankCell = (level: number, result: any) => {
    for (let i: number = 0; i < level; i++) {
        result += ',';
    }
    return result;
};

export const createJobMonitorCSV = (array: any, keys: any, headers: any, result: string, level: number) => {
    result = addBlankCell(level, result);
    result += headers;
    result += '\n'; // New Row

    array.map((item: any) => {
        // Goes Through Each Array Object
        result = addBlankCell(level, result);
        keys.map((key: string) => {
            // Goes Through Each Object value
            if (key && key !== '') {
                let value = item[key] ? String(item[key]) : '';
                if (value && value.includes(',')) {
                    value = `"${value}"`;
                }
                if (key === 'startTime' || key === 'endTime') {
                    result += value ? `${formatDateWithTime(value).replace(',', '')},` : `${GENERAL.NOT_AVAILABLE},`;
                } else if (key === 'name' && value) {
                    result += `${value.split(';href')[0]},`;
                } else if (key === 'status' && value) {
                    result += `${jobMonitoringStatusMapping(value)},`;
                } else if (key === 'type' && value) {
                    result += `${jobMonitoringTypeMapping(value, null)},`;
                } else if (value) {
                    result += `${value},`;
                } else {
                    result += ' ,';
                }
            }
        });
        result += '\n'; // Creates New Row
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
        result += '\n'; // New Row
    }
    return result;
};

export const cfDownloadName = (name: string) => `${CREATE_DATABASE_YAML}_${name}_${Date.now()}`;

export const getShiftedHoursList = (baseList: Array<string | number>) => {
    let hr = moment().hour();
    // if time is 2 PM than it will be used as 14 but when time is 2:30 than it will be in 18
    const min = moment().minute();
    if (min > 0) {
        hr += 1;
    }
    const shift = (Math.ceil(hr / 4) + 1) % baseList.length;
    return [...baseList.slice(shift), ...baseList.slice(0, shift)];
};

export const groupByTime = (days: number, data: any, baseList: Array<number>, daysList: any = []) => {
    const dayGrouping: any = {};
    if (days === 1) {
        // grouping for lats 24 hours
        data.map((perObj: any) => {
            if (perObj?.timeInterval || perObj?.timeInterval === 0) {
                let hr = perObj?.timeInterval;
                const min = perObj?.minutes;
                const objDate = perObj?.date;
                if (min > 0) {
                    hr += 1;
                }
                const index = Math.ceil(hr / 4) % baseList.length;
                let newTimeInterval = baseList[index];
                // This logic is to check count before putting data in x-axis last point. If it is yesterday count than add in x-axix first point.
                const currDate = new Date().getDate();
                if (daysList.length >= 6 && newTimeInterval === daysList[5] && objDate && objDate !== currDate) {
                    newTimeInterval = daysList[0];
                }
                if (newTimeInterval in dayGrouping) {
                    dayGrouping[newTimeInterval] = {
                        completed: dayGrouping[newTimeInterval]?.completed + (perObj?.completed || 0),
                        failed: dayGrouping[newTimeInterval]?.failed + (perObj?.failed || 0),
                        warning: dayGrouping[newTimeInterval]?.warning + (perObj?.warning || 0)
                    };
                } else {
                    dayGrouping[newTimeInterval] = {
                        completed: perObj?.completed || 0,
                        failed: perObj?.failed || 0,
                        warning: perObj?.warning || 0
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
                        failed: dayGrouping[perObj?.timeInterval]?.failed + (perObj?.failed || 0),
                        warning: dayGrouping[perObj?.timeInterval]?.warning + (perObj?.warning || 0)
                    };
                } else {
                    dayGrouping[perObj?.timeInterval] = {
                        completed: perObj?.completed || 0,
                        failed: perObj?.failed || 0,
                        warning: perObj?.warning || 0
                    };
                }
            }
        });
    }
    return dayGrouping;
};

export const groupByJobSummaryTimeline = (data: any, days: number) => {
    const groupedData: any = { time: [], completed: [], failed: [], warning: [] };
    if (!data || data?.length === 0) {
        return groupedData;
    }

    // Using endTime calculate hr or day
    if (days === 1) {
        data = data.map((e: any) => ({
            ...e,
            timeInterval: new Date(e.endTime).getHours(),
            minutes: new Date(e.endTime).getMinutes(),
            date: new Date(e.endTime).getDate()
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
    const dayGrouping = groupByTime(days, data, baseList, daysList);

    daysList.map(day => {
        groupedData.time.push(day);
        groupedData.completed.push(day in dayGrouping ? dayGrouping[day]?.completed : 0);
        groupedData.failed.push(day in dayGrouping ? dayGrouping[day]?.failed : 0);
        groupedData.warning.push(day in dayGrouping ? dayGrouping[day]?.warning : 0);
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

export const removePasswordInConfig = (payload: any) => {
    if (payload?.dbCredentials?.password) {
        payload = { ...payload, dbCredentials: { ...payload.dbCredentials, password: '' } };
    }
    if (payload?.activeDirectory?.password) {
        payload = { ...payload, activeDirectory: { ...payload.activeDirectory, password: '' } };
    }
    if (payload?.fsxN?.fsxNPassword) {
        payload = { ...payload, fsxN: { ...payload.fsxN, fsxNPassword: '' } };
    }
    return payload;
};

const isLastSticky = (columns: any[], columnIndex: number) => {
    if (columnIndex < 0 || columnIndex >= columns.length) {
        return false; // Prevent out-of-bounds errors
    }

    return (
        columns.every((column, index) => column.isSticky || index > columnIndex) &&
        (columns[columnIndex + 1]?.isSticky === false || columns[columnIndex + 1] === undefined)
    );
};

export const convertPxStringToNumber = (pxWidth: string): number => +pxWidth.slice(0, -2);

const getLeft = (columns: any[], columnIndex: number) => {
    const left = columns.reduce((acc, column, index) => {
        if (index < columnIndex) {
            acc += convertPxStringToNumber(column.width || '0px');
        }
        return acc;
    }, 0);
    return `${left}px`;
};

export const getStickyClass = (columns: any, columnIndex: number) => {
    const column = columns[columnIndex];

    if (!column.isSticky) {
        return null;
    }
    const isStickyLeft = columnIndex < columns?.length / 2;
    const isLast = isLastSticky(columns, columnIndex);
    const stickyStyling = isStickyLeft
        ? {
              left: getLeft(columns, columnIndex),
              ...(isLast && { boxShadow: '4px 0 4px 0 var(--Grey200)' })
          }
        : {
              right: getLeft(columns.slice().reverse(), columns.length - columnIndex - 1)
          };
    return css({
        '&': stickyStyling
    });
};

export const removeOldApisError = (data: any) => {
    const state = store.getState();
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = state.headers;
    if (data?.endpointName === 'getDatabaseHosts') {
        if (
            data?.originalArgs &&
            (!headerSelectedMultiCredIdsList.includes(data?.originalArgs?.credentialId) ||
                !headerSelectedMultiRegionIdsList.includes(data?.originalArgs?.region))
        ) {
            return true;
        }
        return false;
    }
    if (data?.endpointName === 'discoverHosts') {
        if (
            data?.originalArgs &&
            (!headerSelectedMultiCredIdsList.includes(data?.originalArgs?.credentialsId) ||
                !headerSelectedMultiRegionIdsList.includes(data?.originalArgs?.regionId))
        ) {
            return true;
        }
        return false;
    }
    return false;
};

// This function will create post payload for register credential API (registerResourceCredentials)
export const createDetectHostPayload = (sqlServerInstance: string, fsxId: string, rowData: any) => {
    const state = store.getState();
    const {
        detectManageUserName,
        detectManagePassword,
        detectWindowsAuthentication,
        detectOntapUsername,
        detectOntapPassword,
        detectAsmAuthentication,
        authenticationType
    } = state?.inventoryV2;
    const credList = [];
    let checkManageReadiness = false;
    // Add SQL Server credentials when SQL Server Authentication is selected as authentication type
    if (
        detectManageUserName &&
        detectManagePassword &&
        authenticationType === AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION
    ) {
        credList.push({
            resourceId: sqlServerInstance,
            resourceType: rowData?.hostType === DBType.MSSQL ? DETECT_HOST_VAR.MSSQL : rowData?.hostType?.toUpperCase(),
            username: detectManageUserName,
            password: detectManagePassword
        });
        checkManageReadiness = true;
    }
    // Add Windows credentials when Windows Authentication is selected as authentication type
    else if (
        detectWindowsAuthentication.username &&
        detectWindowsAuthentication.password &&
        authenticationType === AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION
    ) {
        credList.push({
            resourceId: sqlServerInstance,
            resourceType: DETECT_HOST_VAR.WINDOWS,
            username: detectWindowsAuthentication.username,
            password: detectWindowsAuthentication.password
        });
        checkManageReadiness = true;
    }
    // Add FSx ONTAP credentials to the credential list
    if (detectOntapUsername && detectOntapPassword) {
        credList.push({
            resourceId: fsxId,
            resourceType: DETECT_HOST_VAR.FSX,
            username: detectOntapUsername,
            password: detectOntapPassword
        });
    }

    // Add Oracle ASM credentials to the credential list (optional)
    if (rowData?.hostType === DBType.ORACLE && detectAsmAuthentication?.username && detectAsmAuthentication?.password) {
        credList.push({
            resourceId: sqlServerInstance,
            resourceType: DETECT_HOST_VAR.ORACLE_ASM,
            username: detectAsmAuthentication.username,
            password: detectAsmAuthentication.password
        });
    }

    // Logic to add clusterNodesIpAddress for FCI only. This is for resourec-credentials API.
    if (rowData?.sqlServerDeploymentType?.toLowerCase() === SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE) {
        const addresses = rowData?.windowsClusterNodes?.map((obj: { Address: string; Node: string }) => obj?.Address);
        return { credentials: credList, clusterNodesIpAddress: addresses, checkManageReadiness };
    }
    return { credentials: credList, checkManageReadiness };
};

export const formatUnamanagedHostList = (data: any, mssqlInstancesData: any) =>
    data.map((item: any) => {
        const perRowInstanceData = mssqlInstancesData[item?.ec2InstanceId];
        if (!perRowInstanceData?.error && !perRowInstanceData?.loading && perRowInstanceData?.data) {
            return formatHostData({
                ...item,
                id: perRowInstanceData?.data?.id,
                name: perRowInstanceData?.data?.name,
                status: perRowInstanceData?.data?.status,
                databaseCount: perRowInstanceData?.data?.databaseCount,
                topology: perRowInstanceData?.data?.topology,
                databaseServer: perRowInstanceData?.data?.databaseServer,
                protection: perRowInstanceData?.data?.protection,
                performance: perRowInstanceData?.data?.performance,
                storage: perRowInstanceData?.data?.storage,
                estimatedUsageCost: perRowInstanceData?.data?.estimatedUsageCost,
                resourceUtilization: perRowInstanceData?.data?.resourceUtilization,
                ebsResourceInfo: perRowInstanceData?.data?.ebsResourceInfo,
                clusterNodeDetails: perRowInstanceData?.data?.clusterNodeDetails,
                loading: false
            });
        }
        if (perRowInstanceData?.loading) {
            return {
                ...item,
                id: item?.ec2InstanceId,
                name: item?.ec2InstanceId,
                loading: true
            };
        }
        return {
            ...item,
            id: item?.ec2InstanceId,
            name: item?.ec2InstanceId,
            loading: false
        };
    });

//  This function is to add new row in existing database host managed list
export const addNewManagedHostData = (existingList: any, newItem: any) => {
    let newItemFound = false;
    const newList = existingList?.map((per: any) => {
        if (newItem?.id === per?.id) {
            newItemFound = true;
            return formatHostData(newItem);
        }
        return per;
    });
    if (!newItemFound) {
        return [...[formatHostData(newItem), ...existingList]];
    }
    return newList;
};

// Function to check if array includes an object or not
export const checkValueSavedForRegion = (options: any, value: any) => {
    let containsValue = false;
    for (let i = 0; i < options.length; i++) {
        const objA: any = options[i];
        for (const key in value) {
            if (key === 'data') {
                if (objA[key]?.regionCode === value[key]?.regionCode) {
                    containsValue = true;
                    break;
                }
            }
        }
    }
    return containsValue;
};

export interface HashTable<T> {
    [key: string]: T;
}

// Function to check if array includes an object or not
export const checkValueSavedForCred = (options: any, value: any) => {
    let containsValue = false;
    for (let i = 0; i < options.length; i++) {
        const objA: any = options[i];
        for (const key in value) {
            if (key === 'data') {
                if (
                    objA[key]?.credentialsId === value[key]?.credentialsId &&
                    objA[key]?.providerAccountId === value[key]?.providerAccountId
                ) {
                    containsValue = true;
                    break;
                }
            }
        }
    }
    return containsValue;
};

export const isFsxnNew = (val: any) => {
    if (val && (val === FORM_OPTIONS.FSXN_NEW || val === GENERAL.CREATE_NEW_FSXN || val === 'Create new FSxN')) {
        return true;
    }
    return false;
};

export const isFsxnExisting = (val: any) => {
    if (
        val &&
        (val === FORM_OPTIONS.FSXN_EXISTING ||
            val === GENERAL.SELECT_EXISTING_FSX ||
            val === 'Select an existing FSxN ')
    ) {
        return true;
    }
    return false;
};

export const downloadObjectAsJson = (obj: any, filename: any) => {
    const blob = new Blob([obj], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

export const isSmbProtocol = (protocolList: Array<string> | undefined) => {
    if (protocolList && protocolList.length === 1 && protocolList[0] === FSXN_STORAGE_PROTOCOLS.SMB) {
        return true;
    }
    return false;
};

export const isClusteredWithSelectedInstance = (val: any) =>
    'isClusteredWithSelectedInstance' in val ? !val.isClusteredWithSelectedInstance : false;

// Route path mapping function for console
export const setRoutePath = (path: string, search?: string) => {
    switch (path) {
        case 'Inventory':
            path = 'inventory';
            break;
        case 'Create new sandbox':
            path = 'sandboxes/create-new-sandbox';
            break;
        case 'Well Architected Tab':
            path = 'well-architected';
            break;
        case 'Dashboard':
            path = 'dashboard';
            break;
        case 'Sandboxes':
            path = 'sandboxes';
            break;
        case 'Explore savings':
            path = 'explore-savings';
            break;
        case 'Explore savings EBS':
            path = 'explore-savings-ebs';
            break;
        case 'Explore savings FsxW':
            path = 'explore-savings-fsxw';
            break;
        case 'Job monitoring':
            path = 'job-monitoring';
            break;
        case 'Explore savings OnPrem':
            path = 'explore-savings-on-premise';
            break;
        case 'Savings Calculator':
            if (search && search.includes('fsxw')) {
                path = 'storage-saving-calculator-fsxw';
            } else {
                path = 'storage-saving-calculator';
            }

            break;
        case 'Register Component':
            path = 'register-wizard';
            break;
        default:
            path = 'redirect';
            break;
    }
    return path;
};

export const setTabInfoFOrBXP = (tab: string, statusData: any) => {
    const state = store.getState();
    switch (tab) {
        case '/fsxdb/dashboard':
            return WLF_TABS.DASHBOARD;
        case '/fsxdb/sandboxes/create-new-sandbox':
            return 'Create new sandbox';
        case '/fsxdb/well-architected':
            return WLF_TABS.WELL_ARCHITECTED_TAB;
        case '/fsxdb/inventory':
        case '/fsxdb/inventory/optimize/oracle':
        case '/fsxdb/inventory/optimize/mssql':
            return WLF_TABS.INVENTORY;
        case '/fsxdb/sandbox':
        case '/fsxdb/sandboxes':
            return WLF_TABS.SANDBOXES;
        case '/fsxdb/exploreSaving':
        case '/fsxdb/explore-savings':
            return WLF_TABS.EXPLORE_SAVINGS;
        case '/fsxdb/explore-savings-ebs':
            return WLF_TABS.EXPLORE_SAVINGS_EBS;
        case '/fsxdb/explore-savings-fsxw':
            return WLF_TABS.EXPLORE_SAVINGS_FsxW;
        case '/fsxdb/explore-savings-on-premise':
            return WLF_TABS.EXPLORE_SAVINGS_ONPREM;
        case '/fsxdb/storage-saving-calculator':
            if (state?.exploreSavings.selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES) {
                return WLF_TABS.EXPLORE_SAVINGS_ONPREM;
            }
            return WLF_TABS.SAVINGS_CALCULATOR;
        case '/fsxdb/jobMonitoring':
        case '/fsxdb/job-monitoring':
            return WLF_TABS.JOB_MONITORING;
        case '/fsxdb/register-wizard':
            return WLF_TABS.REGISTER_COMPONENT;
        default:
            return WLF_TABS.DASHBOARD;
    }
};

export const handleExploreSavingsURL = (value: string, isWorkloadFactory: boolean) => {
    let path = '';
    if (isWorkloadFactory) {
        switch (value) {
            case WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE:
                path = './explore-savings/explore-savings-ebs';
                break;
            case WLF_TABS.MSSQL_FSX_FOR_WINDOWS:
                path = './explore-savings/explore-savings-fsxw';
                break;
            case WLF_TABS.MSSQL_ON_PREMISES:
                path = './explore-savings/explore-savings-on-premise';
                break;
        }
    } else {
        switch (value) {
            case WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE:
                path = '../../fsxdb/explore-savings-ebs';
                break;
            case WLF_TABS.MSSQL_FSX_FOR_WINDOWS:
                path = '../../fsxdb/explore-savings-fsxw';
                break;
            case WLF_TABS.MSSQL_ON_PREMISES:
                path = '../../fsxdb/explore-savings-on-premise';
                break;
        }
    }
    if (isWorkloadFactory) {
        postBlueXPMessage({
            type: BlueXPListeners.navigate,
            payload: {
                pathname: `${path}`,
                replace: true
            }
        });
    }
};

export const checkLeftNavRoute = (route: string) => {
    if (
        route === '/databases/dashboard' ||
        route === '/databases/inventory' ||
        route === '/databases/sandboxes' ||
        route === '/databases/explore-savings' ||
        route === '/databases/job-monitoring' ||
        route === '/databases/well-architected'
    ) {
        return true;
    }
    return false;
};

export const handleURLFromDashboard = (value: string, isWorkloadFactory: boolean, navigate?: any) => {
    let path = '';
    if (isWorkloadFactory) {
        switch (value) {
            case 'Inventory':
                path = '../databases/inventory';
                break;
            case 'Dashboard':
                path = '../databases/dashboard';
                break;
            case 'Sandboxes':
                path = '../databases/sandboxes';
                break;
            case 'Explore savings':
                path = '../databases/explore-savings';
                break;
            case 'Job monitoring':
                path = '../databases/job-monitoring';
                break;
            case 'Well Architected Tab':
                path = '../databases/well-architected';
                break;
        }
    } else {
        switch (value) {
            case 'Inventory':
                path = '../../fsxdb/inventory';
                break;
            case 'Dashboard':
                path = '../../fsxdb/dashboard';
                break;
            case 'Sandboxes':
                path = '../../fsxdb/sandboxes';
                break;
            case 'Explore savings':
                path = '../../fsxdb/explore-savings';
                break;
            case 'Job monitoring':
                path = '../../fsxdb/job-monitoring';
                break;
            case 'Well Architected Tab':
                path = '../../fsxdb/well-architected';
                break;
        }
    }
    navigate(path);
    postBlueXPMessage({
        type: BlueXPListeners.navigate,
        payload: {
            pathname: `${path}`,
            replace: true
        }
    });
};

export const handleURL = (value: string, isWorkloadFactory: boolean) => {
    let path = '';
    if (isWorkloadFactory) {
        switch (value) {
            case 'Inventory':
                path = './inventory';
                break;
            case 'Dashboard':
                path = './dashboard';
                break;
            case 'Sandboxes':
                path = './sandboxes';
                break;
            case 'Explore savings':
                path = './explore-savings';
                break;
            case 'Job monitoring':
                path = './job-monitoring';
                break;
            case 'Well Architected Tab':
                path = './well-architected';
                break;
        }
    } else {
        switch (value) {
            case 'Inventory':
                path = '../../fsxdb/inventory';
                break;
            case 'Dashboard':
                path = '../../fsxdb/dashboard';
                break;
            case 'Sandboxes':
                path = '../../fsxdb/sandboxes';
                break;
            case 'Explore savings':
                path = '../../fsxdb/explore-savings';
                break;
            case 'Job monitoring':
                path = '../../fsxdb/job-monitoring';
                break;
            case 'Well Architected Tab':
                path = '../../fsxdb/well-architected';
                break;
        }
    }

    postBlueXPMessage({
        type: BlueXPListeners.navigate,
        payload: {
            pathname: `${path}`,
            replace: true
        }
    });
};

export const _Classes = (...classes: classNames.ArgumentArray): string => {
    const classList: string[] = [];
    classes.forEach(_class => {
        if (typeof _class === 'string') {
            classList.push(_class);
        } else if (_class && typeof _class === 'object') {
            Object.entries(_class).forEach(entry => {
                if (entry[1] === true) {
                    classList.push(entry[0]);
                }
            });
        }
    });

    return classList.join(' ');
};

export const updateSizeInGib = (data: any): any => {
    if (Array.isArray(data)) {
        return data.map(item => updateSizeInGib(item));
    }
    if (typeof data === 'object' && data !== null) {
        const updatedData: any = {};
        for (const key in data) {
            if (key === 'size') {
                if (typeof data[key] === 'object') {
                    updatedData[key] = {};
                    for (const subKey in data[key]) {
                        updatedData[key][subKey] = data[key][subKey] / GIB_IN_BYTE;
                    }
                } else {
                    updatedData[key] = data[key] / GIB_IN_BYTE;
                }
            } else {
                updatedData[key] = updateSizeInGib(data[key]);
            }
        }
        return updatedData;
    }
    return data;
};

export const compareDataAndCalculateDifference = (arrays: any) => {
    const firstSum = arrays[0].reduce((sum: number, num: number) => sum + num, 0);
    const secondSum = arrays[1].reduce((sum: number, num: number) => sum + num, 0);

    if (firstSum > secondSum) {
        const difference = firstSum - secondSum;
        const percentage = (difference / firstSum) * 100;
        return {
            result: true,
            difference,
            percentage: `${percentage.toFixed(2)}%`
        };
    }
    return {
        result: false,
        message: 'First sum is not greater than second sum.'
    };
};

export const formatString = (s: string | undefined) => {
    if (s === undefined) {
        return '';
    }
    if (!s) {
        return '';
    }
    const lowerCased = s.toLowerCase();
    // Capitalize the first letter and return the result
    return lowerCased.charAt(0).toUpperCase() + lowerCased.slice(1);
};

// This function is only for BXP
export const setSelectedTabInformation = (tabInfo: string, pathName: string) => {
    if (pathName === '/fsxdb/inventory/optimize/mssql') {
        return WLF_TABS.OPTIMIZE;
    }
    if (pathName === '/fsxdb/inventory/optimize/oracle') {
        return WLF_TABS.ORACLE_WELL_ARCHITECTED;
    }
    if (pathName === '/fsxdb/sandboxes/create-new-sandbox') {
        return WLF_TABS.SANDBOXES;
    }
    return tabInfo;
};

export const navigateToInventory = (dbType: string, isWorkloadFactory: boolean) => {
    if (isWorkloadFactory) {
        postBlueXPMessage({
            type: BlueXPListeners.navigate,
            payload: {
                pathname: '../databases/inventory',
                replace: true
            }
        });
    } else {
        postBlueXPMessage({
            type: BlueXPListeners.navigate,
            payload: {
                pathname: `../fsxdb/inventory/optimize/${dbType}`,
                replace: true
            }
        });
    }
};

export const setTabValue = (tab: string, selectedHeaderTab: any | string) => {
    switch (tab) {
        case WLF_TABS.INVENTORY:
            if (selectedHeaderTab === WLF_TABS.OPTIMIZE || selectedHeaderTab === WLF_TABS.ORACLE_WELL_ARCHITECTED) {
                return selectedHeaderTab;
            }
            return WLF_TABS.INVENTORY;
        case WLF_TABS.WELL_ARCHITECTED_TAB:
            return WLF_TABS.WELL_ARCHITECTED_TAB;
        case WLF_TABS.EXPLORE_SAVINGS_EBS:
            return WLF_TABS.EXPLORE_SAVINGS_EBS;
        case WLF_TABS.EXPLORE_SAVINGS_FsxW:
            return WLF_TABS.EXPLORE_SAVINGS_FsxW;
        case WLF_TABS.EXPLORE_SAVINGS_ONPREM:
            return WLF_TABS.EXPLORE_SAVINGS_ONPREM;
        case WLF_TABS.SANDBOXES:
            return WLF_TABS.SANDBOXES;
        case WLF_TABS.EXPLORE_SAVINGS:
            return WLF_TABS.EXPLORE_SAVINGS;
        case WLF_TABS.JOB_MONITORING:
            return WLF_TABS.JOB_MONITORING;
        case WLF_TABS.DASHBOARD:
            return WLF_TABS.DASHBOARD;
        case WLF_TABS.SAVINGS_CALCULATOR:
            return WLF_TABS.SAVINGS_CALCULATOR;
        default:
            return selectedHeaderTab;
    }
};

interface Dispatch {
    (action: any): void;
}

export const setExploreSavingsSubTab = (tabValue: string, dispatch: Dispatch): void => {
    if (tabValue === WLF_TABS.EXPLORE_SAVINGS_EBS) {
        dispatch(setSelectedExploreSavingsTab(WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE));
    } else if (tabValue === WLF_TABS.EXPLORE_SAVINGS_FsxW) {
        dispatch(setSelectedExploreSavingsTab(WLF_TABS.MSSQL_FSX_FOR_WINDOWS));
    } else {
        dispatch(setSelectedExploreSavingsTab(WLF_TABS.MSSQL_ON_PREMISES));
    }
};

export const makeCredMapping = (data: any) => {
    const credMapping: HashTable<string> = {};
    data?.map((cred: any) => {
        if (cred?.credentialsId) {
            credMapping[cred.credentialsId] = cred;
        }
    });
    return credMapping;
};

export const makeRegionMapping = (data: any) => {
    const regionMapping: HashTable<string> = {};
    data?.map((region: any) => {
        if (region?.regionCode) {
            regionMapping[region.regionCode] = region;
        }
    });
    return regionMapping;
};

export const isPartialData = (resourceDetails: any) => {
    const rwMetrics = resourceDetails?.performance?.rwMetrics;
    return [
        rwMetrics?.iops?.read,
        rwMetrics?.iops?.write,
        rwMetrics?.latency?.read,
        rwMetrics?.latency?.write,
        rwMetrics?.throughput?.read,
        rwMetrics?.throughput?.write,
        resourceDetails?.resourceUtilization?.cpu
    ].every(arr => (Array.isArray(arr) && arr.length === 0) || !Array.isArray(arr));
};

const roundedFormatter = Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const twoDecimalFormatter = Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const rounded = (value: number) => roundedFormatter.format(value);

export const twoFractionDigits = (value: number) => twoDecimalFormatter.format(value);

export const formatTimeAMPM = (time: string, showPeriod: boolean = true) => {
    const [h, m] = time.split(':').map(Number);
    const hour = h % 12 === 0 ? 12 : h % 12;
    const ampm = h < 12 || h === 24 ? 'AM' : 'PM';
    return showPeriod ? `${hour}:${m.toString().padStart(2, '0')} ${ampm}` : `${hour}:${m.toString().padStart(2, '0')}`;
};
export const blobToDataURL = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
        try {
            if (!blob || blob.size === 0) {
                return reject(new Error('Invalid or empty blob'));
            }

            setTimeout(() => {
                const reader = new FileReader();

                reader.onloadend = () => {
                    const { result } = reader;
                    if (result && typeof result === 'string') {
                        resolve(result);
                    } else {
                        reject(new Error('Could not convert blob to base64'));
                    }
                };

                reader.onerror = () => {
                    reject(new Error('FileReader failed'));
                };

                reader.readAsDataURL(blob);
            }, 0);
        } catch (err) {
            reject(err);
        }
    });

export const derivedType = (type: string) => {
    switch (type) {
        case ASSESSMENT_CONFIG_NAMES.STORAGE_TIER:
        case ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM:
        case ASSESSMENT_CONFIG_NAMES.SWAP_SPACE:
        case ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE:
        case ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE:
        case ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF:
        case ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF:
        case ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT:
        case ASSESSMENT_CONFIG_NAMES.ONTAP:
        case ASSESSMENT_CONFIG_NAMES.OS:
        case ASSESSMENT_CONFIG_NAMES.ORACLE_BINARY_PLACEMENT:
        case ASSESSMENT_CONFIG_NAMES.DATAFILES_PLACEMENT:
        case ASSESSMENT_CONFIG_NAMES.CONTROLFILES_PLACEMENT:
        case ASSESSMENT_CONFIG_NAMES.REDO_LOGS_PLACEMENT:
        case ASSESSMENT_CONFIG_NAMES.TEMP_LOGS_PLACEMENT:
        case ASSESSMENT_CONFIG_NAMES.ARCHIVE_PLACEMENT:
        case ASSESSMENT_CONFIG_NAMES.DATA_DG_LUN_LAYOUT:
        case ASSESSMENT_CONFIG_NAMES.LOG_DG_LUN_LAYOUT:
        case ASSESSMENT_CONFIG_NAMES.FRA_DG_LUN_LAYOUT:
        case ASSESSMENT_CONFIG_NAMES.ARCHIVELOG_DG_LUN_LAYOUT:
            return ASSESSMENT_CONFIG_OTHER.STORAGE;

        case ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING:
        case ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH:
        case ASSESSMENT_CONFIG_NAMES.RSS_CONFIGURATION:
        case ASSESSMENT_CONFIG_NAMES.MTU:
            return ASSESSMENT_CONFIG_OTHER.COMPUTE;

        case ASSESSMENT_CONFIG_NAMES.LICENSE:
        case ASSESSMENT_CONFIG_NAMES.MICROSOFT_SQL_SERVER_PATCH:
        case ASSESSMENT_CONFIG_NAMES.MAXDOP:
            return ASSESSMENT_CONFIG_OTHER.APPLICATION;

        case ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT:
        case ASSESSMENT_CONFIG_NAMES.CRR:
        case ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS:
        case ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY:
            return ASSESSMENT_CONFIG_OTHER.RESILIENCY;

        case ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT:
            return ASSESSMENT_CONFIG_OTHER.CLONE;
    }
};

export const derivedSeverity = (type: string) => {
    switch (type) {
        case ASSESSMENT_CONFIG_NAMES.STORAGE_TIER:
        case ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM:
        case ASSESSMENT_CONFIG_NAMES.SWAP_SPACE:
        case ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF:
        case ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF:
        case ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT:
        case ASSESSMENT_CONFIG_NAMES.ONTAP:
        case ASSESSMENT_CONFIG_NAMES.OS:
        case ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH:
        case ASSESSMENT_CONFIG_NAMES.MTU:
        case ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY:
            return GETWELL_STATUS.CRITICAL;
        case ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE:
        case ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE:
        case ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING:
        case ASSESSMENT_CONFIG_NAMES.RSS_CONFIGURATION:
        case ASSESSMENT_CONFIG_NAMES.LICENSE:
        case ASSESSMENT_CONFIG_NAMES.MICROSOFT_SQL_SERVER_PATCH:
        case ASSESSMENT_CONFIG_NAMES.MAXDOP:
        case ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT:
        case ASSESSMENT_CONFIG_NAMES.CRR:
        case ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS:
        case ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT:
        case ASSESSMENT_CONFIG_NAMES.ORACLE_BINARY_PLACEMENT:
        case ASSESSMENT_CONFIG_NAMES.DATAFILES_PLACEMENT:
        case ASSESSMENT_CONFIG_NAMES.CONTROLFILES_PLACEMENT:
        case ASSESSMENT_CONFIG_NAMES.REDO_LOGS_PLACEMENT:
        case ASSESSMENT_CONFIG_NAMES.TEMP_LOGS_PLACEMENT:
        case ASSESSMENT_CONFIG_NAMES.ARCHIVE_PLACEMENT:
        case ASSESSMENT_CONFIG_NAMES.DATA_DG_LUN_LAYOUT:
        case ASSESSMENT_CONFIG_NAMES.LOG_DG_LUN_LAYOUT:
        case ASSESSMENT_CONFIG_NAMES.FRA_DG_LUN_LAYOUT:
        case ASSESSMENT_CONFIG_NAMES.ARCHIVELOG_DG_LUN_LAYOUT:
            return GETWELL_STATUS.WARNING;
    }
};

export const oracleAssessmentKeys = [
    ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM,
    ASSESSMENT_CONFIG_NAMES.SWAP_SPACE,
    ASSESSMENT_CONFIG_NAMES.ORACLE_BINARY_PLACEMENT,
    ASSESSMENT_CONFIG_NAMES.DATAFILES_PLACEMENT,
    ASSESSMENT_CONFIG_NAMES.CONTROLFILES_PLACEMENT,
    ASSESSMENT_CONFIG_NAMES.REDO_LOGS_PLACEMENT,
    ASSESSMENT_CONFIG_NAMES.TEMP_LOGS_PLACEMENT,
    ASSESSMENT_CONFIG_NAMES.ARCHIVE_PLACEMENT,
    ASSESSMENT_CONFIG_NAMES.DATA_DG_LUN_LAYOUT,
    ASSESSMENT_CONFIG_NAMES.LOG_DG_LUN_LAYOUT,
    ASSESSMENT_CONFIG_NAMES.FRA_DG_LUN_LAYOUT,
    ASSESSMENT_CONFIG_NAMES.ARCHIVELOG_DG_LUN_LAYOUT,
    ASSESSMENT_CONFIG_NAMES.ONTAP,
    ASSESSMENT_CONFIG_NAMES.OS
];

export const mssqlAssessmentKeys = [
    ASSESSMENT_CONFIG_NAMES.STORAGE_TIER,
    ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM,
    ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE,
    ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE,
    ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF,
    ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF,
    ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT,
    ASSESSMENT_CONFIG_NAMES.ONTAP,
    ASSESSMENT_CONFIG_NAMES.OS,
    ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING,
    ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH,
    ASSESSMENT_CONFIG_NAMES.RSS_CONFIGURATION,
    ASSESSMENT_CONFIG_NAMES.MTU,
    ASSESSMENT_CONFIG_NAMES.LICENSE,
    ASSESSMENT_CONFIG_NAMES.MICROSOFT_SQL_SERVER_PATCH,
    ASSESSMENT_CONFIG_NAMES.MAXDOP,
    ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT,
    ASSESSMENT_CONFIG_NAMES.CRR,
    ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS,
    ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY,
    ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT
];

// Function to get category for each assessment configuration
export const getCategoryForAssessment = (assessmentKey: string): string => {
    const categoryMap: { [key: string]: string } = {
        [ASSESSMENT_CONFIG_NAMES.STORAGE_TIER]: 'Storage',
        [ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM]: 'Storage',
        [ASSESSMENT_CONFIG_NAMES.SWAP_SPACE]: 'Storage',
        [ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE]: 'Storage',
        [ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE]: 'Storage',
        [ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF]: 'Storage',
        [ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF]: 'Storage',
        [ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT]: 'Storage',
        [ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING]: 'Compute',
        [ASSESSMENT_CONFIG_NAMES.LICENSE]: 'Application',
        [ASSESSMENT_CONFIG_NAMES.MICROSOFT_SQL_SERVER_PATCH]: 'Application',
        [ASSESSMENT_CONFIG_NAMES.MAXDOP]: 'Application',
        [ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH]: 'Compute',
        [ASSESSMENT_CONFIG_NAMES.RSS_CONFIGURATION]: 'Compute',
        [ASSESSMENT_CONFIG_NAMES.MTU]: 'Compute',
        [ASSESSMENT_CONFIG_NAMES.OS]: 'Storage',
        [ASSESSMENT_CONFIG_NAMES.ONTAP]: 'Storage',
        [ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT]: 'Resiliency',
        [ASSESSMENT_CONFIG_NAMES.CRR]: 'Resiliency',
        [ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS]: 'Resiliency',
        [ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY]: 'Resiliency',
        [ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT]: 'Cloning'
    };
    return categoryMap[assessmentKey] || 'Storage';
};

export const dashboardRedirection = (path: string = 'inventory') => {
    const state = store.getState();
    const isWorkloadFactory = state?.auth?.isWorkloadFactory;
    if (isWorkloadFactory) {
        postBlueXPMessage({
            type: BlueXPListeners.navigate,
            payload: {
                pathname: `../../databases/${path}`,
                replace: true
            }
        });
    } else {
        postBlueXPMessage({
            type: BlueXPListeners.navigate,
            payload: {
                pathname: `../../fsxdb/${path}`,
                replace: true
            }
        });
    }
};

export const createSandboxNavigation = (navigate: any) => {
    const state = store.getState();
    const isWorkloadFactory = state?.auth?.isWorkloadFactory;
    if (isWorkloadFactory) {
        postBlueXPMessage({
            type: BlueXPListeners.navigate,
            payload: { pathname: '../../databases/sandboxes/create-new-sandbox', replace: true }
        });
        navigate('../../databases/sandboxes/create-new-sandbox');
    } else {
        postBlueXPMessage({
            type: BlueXPListeners.navigate,
            payload: { pathname: '../../fsxdb/sandboxes/create-new-sandbox', replace: true }
        });
        navigate('../../fsxdb/sandboxes/create-new-sandbox');
    }
};

export const dashboardRedirectionToWellArchitected = () => {
    const state = store.getState();
    const isWorkloadFactory = state?.auth?.isWorkloadFactory;
    if (isWorkloadFactory) {
        postBlueXPMessage({
            type: BlueXPListeners.navigate,
            payload: {
                pathname: '../../databases/well-architected',
                replace: true
            }
        });
    } else {
        postBlueXPMessage({
            type: BlueXPListeners.navigate,
            payload: {
                pathname: '../../fsxdb/well-architected',
                replace: true
            }
        });
    }
};
