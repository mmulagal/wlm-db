import { optionType } from '@netapp/design-system/dist/components/Select';
import { TableProps } from '@netapp/design-system/dist/components/Table';
import numeral from 'numeral';
import { GENERAL } from './appConstants';
import { DEFAULT_MASTER_KEY, ENABLED_STATE, EXPIRED_STATUS } from './consts';
import { AvailabilityZonesObj, KmsKeys, Subnets } from './types/mssqlTypes';
import store from '../store/store';

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
        ?.filter((key: KmsKeys) => key?.state === ENABLED_STATE)
        .map((val: KmsKeys) => {
            if (val?.expiryStatus === EXPIRED_STATUS) {
                val = {
                    ...val,
                    cellProps: {
                        isDisabled: true
                    }
                };
            }
            if (val?.name === DEFAULT_MASTER_KEY) {
                val = { ...val, default: true };
            }
            newData.push(val);
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
        // Criteria checks
        const isAtLeastEightChars = password.length >= 8;
        const hasAtLeastOneNumber = /[0-9]/.test(password);
        const hasAtLeastTwoAlphabetic = (password.match(/[a-zA-Z]/g) || []).length >= 2;
        const hasInvalidCombination =
            !password.includes('Ctrl-c') && !password.includes('Ctrl-d') && !password.includes('^D');

        if (isAtLeastEightChars && hasAtLeastOneNumber && hasAtLeastTwoAlphabetic && hasInvalidCombination) {
            return '';
        } else {
            return GENERAL.PASSWORD_ERROR_CHECK;
        }
    }
};

export const encodeAll = (text: string | (string | null)[] | null) => {
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
    const regex = /'([^']+)'/;
    const match = inputString.match(regex);
    const subStr = 'must have required property';
    if(match && match.length >= 2 && inputString.includes(subStr)){
        return match[1];
    } else {
        return null;
    }
};
