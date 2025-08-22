import store from '../store/store';
import { addNotification, NOTIFICATION_TYPES } from '../store/notificationSlice';
import { DETECT_HOST_VAR, RESET_PASSWORD_TYPE } from './consts';
import { resetAllPasswords, setPasswordResetLoading } from '../store/workloadFactory/workloadFactoryResourceSlice';

interface Dispatch {
    (action: any): void;
}

export const getUniqueEntries = (arrays: any) => {
    const combinedArray = [].concat(...arrays);
    const seen = new Set();
    return combinedArray.filter(item => {
        const serializedItem = JSON.stringify(item);
        if (seen.has(serializedItem)) {
            return false;
        }
        seen.add(serializedItem);
        return true;
    });
};

export const groupByType = (array: any, returnType: string = 'id') =>
    array.reduce((acc: any, item: any) => {
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

export const removeObjectFromArray = (array: any, obj: any) =>
    array.filter(
        (item: any) =>
            !(item.id === obj.id && item.label === obj.label && item.value === obj.value && item.type === obj.type)
    );

export const handleSelectForFilter = (
    filters: Array<{ id: string; label: string; value: string }>,
    filterLabel: string,
    filterTags: Array<{ id: string; label: string; value: string; type: string }>,
    dispatch: Dispatch,
    setFilterTags: (tags: Array<{ id: string; label: string; value: string; type: string }>) => void,
    setDefaultFilterOptions: (options: { [key: string]: string[] }) => void
) => {
    let updatedFilters = [...filterTags];

    const selectedIds = new Set(filters.map((filter: any) => filter.id));

    updatedFilters = updatedFilters.filter(
        (filter: any) => !(filter.type === filterLabel && !selectedIds.has(filter.id))
    );

    filters.forEach((filter: any) => {
        const existingFilterIndex = updatedFilters.findIndex(
            (selectedFilter: any) => selectedFilter.value === filter.value && selectedFilter.type === filterLabel
        );

        if (existingFilterIndex === -1) {
            updatedFilters.push({ ...filter, type: filterLabel });
        }
    });

    const uniqueArray = getUniqueEntries([updatedFilters]);
    const reArrange = groupByType(uniqueArray);

    dispatch(setFilterTags(uniqueArray));
    dispatch(setDefaultFilterOptions(reArrange));
};

/** Function to map the dismissed values */
export const mapDismissedValues = (data: any, itemName: string | any) => {
    for (const key in data) {
        const section = data[key];
        if (Array.isArray(section)) {
            // For sizing and layout
            for (const item of section) {
                if (item?.configurationName === itemName) {
                    return item;
                }
            }
        } else if (typeof section === 'object') {
            // For configuration
            for (const subKey in section) {
                const subSection = section[subKey];
                if (Array.isArray(subSection)) {
                    for (const item of subSection) {
                        if (item?.configurationName === itemName) {
                            return item;
                        }
                    }
                }
            }
        }
    }
    return null;
};

export const createOraclePayLoad = (value: string, selectedDatabaseInstanceName: string) => {
    const state = store.getState();
    const { sqlServerPasswords, sqlServerUserName } = state.workloadFactoryResource;
    const { password } = sqlServerPasswords;
    const credList = [];
    credList.push({
        resourceId: selectedDatabaseInstanceName,
        resourceType: value === RESET_PASSWORD_TYPE.ORACLESERVER ? DETECT_HOST_VAR.ORACLE : DETECT_HOST_VAR.ORACLE_ASM,
        username: sqlServerUserName,
        password
    });

    return { credentials: credList };
};

export const createPayload = (resourceDetails: any) => {
    const state = store.getState();
    const { fsxAdminPasswords } = state.workloadFactoryResource;
    const { password } = fsxAdminPasswords;
    const credList = [];
    credList.push({
        resourceId: resourceDetails?.topology?.fileSystemId, // need to implementfrom GetWell
        resourceType: DETECT_HOST_VAR.FSX,
        username: 'fsxadmin',
        password
    });

    return { credentials: credList };
};

export const handleFSXAdminApply = async (
    value: string,
    selectedDatabaseInstanceName: string,
    resourceDetails: any,
    selectedResourceCredId: string,
    selectedResourceRegionId: string,
    registerResourceCredBulk: any,
    dispatch: any,
    closeDialog: () => void
) => {
    dispatch(setPasswordResetLoading(true));
    try {
        let credList =
            value === RESET_PASSWORD_TYPE.ORACLESERVER
                ? createOraclePayLoad(RESET_PASSWORD_TYPE.ORACLESERVER, selectedDatabaseInstanceName)
                : createOraclePayLoad(RESET_PASSWORD_TYPE.ORACLEASM, selectedDatabaseInstanceName);
        if (value === RESET_PASSWORD_TYPE.FSXADMIN) {
            credList = createPayload(resourceDetails);
        }
        const getPasswordTypeLabel = (type: string) => {
            if (type === RESET_PASSWORD_TYPE.FSXADMIN) return 'fsxadmin';
            if (type === RESET_PASSWORD_TYPE.ORACLESERVER) return 'Oracle Server';
            return 'Oracle ASM';
        };
        const payload = {
            items: [
                {
                    ...credList,
                    ec2InstanceId: resourceDetails?.nodeTopology?.ec2Details[0]?.id,
                    region: selectedResourceRegionId,
                    credentialsId: selectedResourceCredId
                }
            ]
        };
        const result = await registerResourceCredBulk({ payload });
        if (result && !result?.error && result?.data) {
            if (
                result?.data?.items?.length > 0 &&
                !result?.data?.items?.[0]?.registerDetails?.[0]?.databaseServerError &&
                !result?.data?.items?.[0]?.registerDetails?.[0]?.fsxnError
            ) {
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.SUCCESS,
                        message: `${getPasswordTypeLabel(value)} password updated successfully`
                    })
                );
            } else {
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.ERROR,
                        message:
                            result?.data?.items?.[0]?.registerDetails?.[0]?.fsxnError ||
                            result?.data?.items?.[0]?.registerDetails?.[0]?.databaseServerError ||
                            `Failed to update ${getPasswordTypeLabel(value)} password. `
                    })
                );
            }
        } else {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message:
                        // @ts-ignore
                        result?.error?.data?.message || `Failed to update ${getPasswordTypeLabel(value)} password. `
                })
            );
        }
    } catch (error) {
        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.ERROR,
                message: error || 'Failed to update fsxadmin password. '
            })
        );
    } finally {
        dispatch(resetAllPasswords());
        dispatch(setPasswordResetLoading(false));
        closeDialog();
    }
};
