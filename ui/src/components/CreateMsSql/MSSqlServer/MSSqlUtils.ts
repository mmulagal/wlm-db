import {
    setEncryptionARN,
    setEncryptionRow,
    setEncryptionType,
    setInstanceType,
    setProvisionedIOPSValue,
    setProvisionedType,
    setSelectedExistingSecurityGroup,
    setSelectedLicenseId,
    setSelectedLicenseType,
    setSelectedSecurityGroup,
    setSqlServerCollation,
    setThroughputValue
} from '../../../store/mssql/mssqlFormSlice';
import store from '../../../store/store';
import { GENERAL } from '../../../utils/appConstants';
import {
    DEAFULT_INSTANCE_VALUE,
    FORM_OPTIONS,
    MSSQL_DB_SIZE_TIB_THRESHOLDS,
    MSSQL_RECOMMENDED_INSTANCE_BY_DB_SIZE
} from '../../../utils/consts';
import { formatSize, generateOptionType, isFsxnExisting } from '../../../utils/utilityFunctions';

export const selectDefaultSecurityGroup = (dispatch: any) => {
    dispatch(setSelectedSecurityGroup(GENERAL.GENERATED_SECURITY_GROUP));
    dispatch(setSelectedExistingSecurityGroup([]));
};

export const selectDefaultInstanceType = (instanceTypeData: any, dispatch: any) => {
    if (instanceTypeData && instanceTypeData?.instanceTypes?.length > 0) {
        const defaultInsType = instanceTypeData?.instanceTypes?.filter(
            (instance: { instanceType: string }) => instance.instanceType === DEAFULT_INSTANCE_VALUE
        );
        const firstInstanceName =
            defaultInsType && defaultInsType.length > 0 ? defaultInsType[0] : instanceTypeData?.instanceTypes[0];
        const value = firstInstanceName?.instanceType || '';
        let label2 = '';
        if (firstInstanceName?.vCpus) {
            label2 += `${firstInstanceName?.vCpus}vCPU, `;
        }
        if (firstInstanceName?.ramInMib) {
            label2 += `${formatSize(firstInstanceName?.ramInMib, 'mib')} RAM, `;
        }
        if (firstInstanceName?.iopsInMbps) {
            label2 += `${firstInstanceName?.iopsInMbps}Mbps`;
        }
        const option = generateOptionType(value, value, label2, false, '', firstInstanceName);
        dispatch(setInstanceType(option));
    }
};

export const selectDefaultEncryption = (kmsData: any, dispatch: any) => {
    if (kmsData && kmsData.length > 0) {
        dispatch(setEncryptionRow([kmsData[0]]));
    }
};

export const selectDefaultLicense = (amiData: any, dispatch: any) => {
    if (amiData && amiData?.amis?.length > 0) {
        const firstAmi = amiData?.amis[0];
        const amiVal = firstAmi?.imageId;
        const amiName = firstAmi?.name;
        const data = {
            architecture: firstAmi?.architecture,
            amiVal: firstAmi?.imageId,
            amiName: firstAmi?.name,
            ebsVolumeSize: firstAmi?.ebsVolumeSize
        };
        const option = generateOptionType(amiVal, amiVal, amiName, false, '', data);
        dispatch(setSelectedLicenseType(FORM_OPTIONS.LICENSE_AMI));
        dispatch(setSelectedLicenseId(option));
    }
};

export const selectDefaultCollation = (collationData: any, dispatch: any) => {
    if (collationData && collationData?.collationList?.length) {
        let foundDefault = false;
        for (let i = 0; i < collationData?.collationList?.length; i++) {
            const val = collationData?.collationList[i];
            if (val?.name === collationData?.defaultCollation) {
                const option = generateOptionType(val?.name, val?.name, val?.description, false, '');
                dispatch(setSqlServerCollation(option));
                foundDefault = true;
                break;
            }
        }
        if (!foundDefault) {
            const val = collationData.collationList[0];
            const option = generateOptionType(val?.name, val?.name, val?.description, false, '');
            dispatch(setSqlServerCollation(option));
        }
    } else {
        dispatch(setSqlServerCollation(null));
    }
};

export const selectFsxThroughput = (
    selectedFsxnType: string,
    selectedExistingFsxnName: any,
    defaultVal: string,
    dispatch: any
) => {
    const state = store.getState();
    const throughputVal = state.mssqlForm.throughput;
    const throughput = selectedExistingFsxnName?.data?.throughput || 0;
    if (isFsxnExisting(selectedFsxnType) && selectedExistingFsxnName && throughput !== 0) {
        let val = '';
        if (throughput <= 512) {
            val = `${throughput} MBps`;
        } else {
            val = `${throughput / 1024} GBps`;
        }
        const option = generateOptionType(val, val, '', false, '');
        dispatch(setThroughputValue(option));
    } else {
        if (!defaultVal || throughputVal?.value) {
            return;
        }
        const option = generateOptionType(defaultVal, defaultVal, '', false, '');
        dispatch(setThroughputValue(option));
    }
};

export const selectFsxIops = (selectedFsxnType: string, selectedExistingFsxnName: any, dispatch: any) => {
    const state = store.getState();
    const provisionedIOPSval = state.mssqlForm.provisionedIOPS.IOPSValue;
    const iops = selectedExistingFsxnName?.data?.iops || 0;
    if (isFsxnExisting(selectedFsxnType) && selectedExistingFsxnName && iops !== 0) {
        dispatch(setProvisionedType(GENERAL.USER_PROVISIONED));
        dispatch(setProvisionedIOPSValue(iops));
    } else if (!provisionedIOPSval) {
        dispatch(setProvisionedType(GENERAL.AUTOMATIC));
        dispatch(setProvisionedIOPSValue(''));
    }
};

// Returns the recommended MSSQL EC2 instance type for a user-entered database
// size. `capacity` is the raw textual value from the form, `unitLabel` is the
// selected unit ('GiB' or 'TiB'). When `capacity` is empty/non-numeric/zero we
// fall back to the SMALL tier so an unfilled form still renders a sensible
// default selection during initial mount.
export const getRecommendedInstanceTypeForCapacity = (capacity: string | undefined, unitLabel: string | undefined) => {
    const numeric = Number(capacity);
    if (!capacity || !Number.isFinite(numeric) || numeric <= 0) {
        return MSSQL_RECOMMENDED_INSTANCE_BY_DB_SIZE.SMALL;
    }
    const GIB_PER_TIB = 1024;
    const sizeInTib = unitLabel === 'TiB' ? numeric : numeric / GIB_PER_TIB;
    if (sizeInTib <= MSSQL_DB_SIZE_TIB_THRESHOLDS.SMALL_MAX_TIB_INCLUSIVE) {
        return MSSQL_RECOMMENDED_INSTANCE_BY_DB_SIZE.SMALL;
    }
    if (sizeInTib <= MSSQL_DB_SIZE_TIB_THRESHOLDS.MEDIUM_MAX_TIB_INCLUSIVE) {
        return MSSQL_RECOMMENDED_INSTANCE_BY_DB_SIZE.MEDIUM;
    }
    return MSSQL_RECOMMENDED_INSTANCE_BY_DB_SIZE.LARGE;
};

// Set of instance types that the auto-recommendation flow is allowed to
// overwrite without user intervention: the alphabetical fallback default plus
// every value the recommendation itself can produce. Any selection outside
// this set (manual pick, preset tile, or restored config) is left untouched.
export const MSSQL_AUTO_OVERWRITABLE_INSTANCE_TYPES: ReadonlySet<string> = new Set<string>([
    DEAFULT_INSTANCE_VALUE,
    MSSQL_RECOMMENDED_INSTANCE_BY_DB_SIZE.SMALL,
    MSSQL_RECOMMENDED_INSTANCE_BY_DB_SIZE.MEDIUM,
    MSSQL_RECOMMENDED_INSTANCE_BY_DB_SIZE.LARGE
]);

// Dispatches the size-based recommended instance type for the given DB capacity
// into the mssqlForm slice. Used by the Quick create flow (PreviewDefault +
// MssqlApis) where the standard <InstanceType /> accordion is not rendered and
// therefore the InstanceType.tsx auto-recommendation effect never runs.
//
// Returns true if a matching option was found in the catalog and dispatched.
// Returns false if the recommended type isn't available in the current
// region/license combo so the caller can fall back to selectDefaultInstanceType.
export const selectSizeBasedInstanceType = (
    instanceTypeData: {
        instanceTypes?: Array<{
            instanceType?: string;
            vCpus?: number;
            ramInMib?: number;
            iopsInMbps?: number;
            architecture?: string[] | string;
        }>;
    } | null | undefined,
    dispatch: (action: ReturnType<typeof setInstanceType>) => void,
    capacity: string | undefined,
    unitLabel: string | undefined,
    selectedLicense: { data?: { architecture?: string } } | null | undefined
): boolean => {
    const instanceTypes = instanceTypeData?.instanceTypes;
    if (!instanceTypes?.length) {
        return false;
    }
    const recommendedType = getRecommendedInstanceTypeForCapacity(capacity, unitLabel);
    const archVal = selectedLicense?.data?.architecture;
    const match = instanceTypes.find(
        it =>
            it?.instanceType === recommendedType &&
            (!archVal || !it?.architecture || it.architecture.includes(archVal))
    );
    if (!match) {
        return false;
    }
    let label2 = '';
    if (match?.vCpus) {
        label2 += `${match.vCpus}vCPU, `;
    }
    if (match?.ramInMib) {
        label2 += `${formatSize(match.ramInMib, 'mib')} RAM, `;
    }
    if (match?.iopsInMbps) {
        label2 += `${match.iopsInMbps}Mbps`;
    }
    const option = generateOptionType(match.instanceType, match.instanceType, label2, false, '', match);
    dispatch(setInstanceType(option));
    return true;
};

export const selectFsxKmsKey = (selectedFsxnType: string, selectedExistingFsxnName: any, dispatch: any) => {
    if (isFsxnExisting(selectedFsxnType) && selectedExistingFsxnName) {
        const kmsKeyId = selectedExistingFsxnName?.data?.kmsKeyId;
        let kmsKeyVal = '';
        if (kmsKeyId && kmsKeyId.includes('/')) {
            kmsKeyVal = kmsKeyId.split('/')[1];
        }
        dispatch(setEncryptionType(GENERAL.ENCRYPTION_SELECT_FROM_OTHER_ACCOUNT));
        dispatch(setEncryptionARN(kmsKeyVal));
    } else {
        dispatch(setEncryptionType(GENERAL.ENCRYPTION_SELECT_FROM_ACCOUNT));
        dispatch(setEncryptionARN(''));
    }
};
