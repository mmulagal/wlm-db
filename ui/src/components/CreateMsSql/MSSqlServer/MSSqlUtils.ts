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
import { DEAFULT_INSTANCE_VALUE, FORM_OPTIONS } from '../../../utils/consts';
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
