import { NOTIFICATION_TYPES, addNotification } from '../../store/notificationSlice';
import store from '../../store/store';
import { GENERAL } from '../../utils/appConstants';
import { CreateSandboxPayloadEntities, SandboxListEntities } from '../../utils/types/sandBoxTypes';
import { formatDateWithTime, formatSize, getTimeDifferenceInDays } from '../../utils/utilityFunctions';
import { uniqueHostRow } from '../InventoryV2/InventoryUtilsV2';

export const generateCreateSandboxPayload = (state: any): CreateSandboxPayloadEntities => {
    const payload = {
        source: {
            host: state?.source?.selectedDatabaseHost?.value,
            instance: state?.source?.selectedDatabaseInstance?.value,
            database: state?.source?.selectedDatabase?.value || state?.source?.selectedDatabase?.label
        },
        destination: {
            host: state?.target?.selectedDatabaseHost?.value,
            instance: state?.target?.selectedDatabaseInstance?.value,
            database: state?.target?.selectedDatabase
        },
        mountPoints: {
            dataDrive: state?.dataDriveMountPoint,
            logDrive: state?.logDriveMountPoint
        },
        tag: state?.selectedTag
    };
    return payload;
};

const formatAge = (val: any) => {
    if (Number(val) >= 0 && Number(val) <= 30) {
        return '0-30 days';
    }
    if (Number(val) >= 31 && Number(val) <= 60) {
        return '31-60 days';
    }
    return '61+ days';
};

export const formatSandboxListData = (data: SandboxListEntities) => {
    const retData = data
        .filter(item => !item?.error)
        .map(item => ({
            id: `${item?.databaseHostId}_${item?.databaseInstanceName}_${item?.sandboxName}`,
            name: item?.sandboxName,
            databaseHostId: item?.databaseHostId,
            hostName: item?.databaseHostName,
            instanceId: item?.databaseInstanceId,
            instanceName: `${item?.databaseHostName}\\${item?.databaseInstanceName}`,
            source: item?.sourceDatabaseName,
            sourceInstanceName: `${item?.sourceDatabaseHostName}\\${item?.sourceDatabaseInstanceName}`,
            sourceHost: item?.sourceDatabaseHostName,
            actualUpdated: item?.updatedAt || '',
            updatedAt: formatDateWithTime(item?.updatedAt || ''),
            age: `${getTimeDifferenceInDays(new Date().getTime(), parseInt(item?.createdAt))} days`,
            ageByRange: `${formatAge(getTimeDifferenceInDays(new Date().getTime(), parseInt(item?.createdAt)))}`,
            tag: item?.tag,
            status: 'active',
            baseSnapshot: item?.baseSnapshot,
            createdAt: item?.createdAt,
            ageForSorting: -1 * parseInt(item?.createdAt)
        }));
    return retData;
};

export const getUniqueSourceDatabasesCount = (sandBoxList: SandboxListEntities) => {
    const uniqueSourceDatabases = new Set();
    sandBoxList.map(item => {
        uniqueSourceDatabases.add(
            `${item?.sourceDatabaseHostName}_${item?.sourceDatabaseInstanceName}_${item?.sourceDatabaseName}`
        );
    });
    return uniqueSourceDatabases.size;
};

export const getSandboxDistributionByAge = (sandBoxList: SandboxListEntities) => {
    const distribution = {
        '0-30': 0,
        '31-60': 0,
        '61+': 0
    };
    sandBoxList?.map(item => {
        const age = getTimeDifferenceInDays(new Date().getTime(), parseInt(item?.createdAt));
        if (age <= 30) {
            distribution['0-30']++;
        } else if (age <= 60) {
            distribution['31-60']++;
        } else {
            distribution['61+']++;
        }
    });
    return distribution;
};

export const getSandboxDistributionByAgeValue = (sandBoxList: SandboxListEntities) => {
    const distribution = getSandboxDistributionByAge(sandBoxList);
    const distributionUiValue = {
        '0-30': `${distribution['0-30']} ${distribution['0-30'] === 1 ? GENERAL.SANDBOX : GENERAL.SANDBOXES}`,
        '31-60': `${distribution['31-60']} ${distribution['31-60'] === 1 ? GENERAL.SANDBOX : GENERAL.SANDBOXES}`,
        '61+': `${distribution['61+']} ${distribution['61+'] === 1 ? GENERAL.SANDBOX : GENERAL.SANDBOXES}`
    };
    return distributionUiValue;
};

export const getSandboxDistributionByTag = (sandBoxList: SandboxListEntities) => {
    const distribution: any = {
        Development: 0,
        Training: 0,
        QA: 0,
        Analytics: 0,
        Integration: 0,
        Other: 0
    };
    sandBoxList.map(item => {
        if (distribution[item?.tag] || distribution[item?.tag] === 0) {
            distribution[item.tag]++;
        }
    });
    return distribution;
};

export const getDefaultDriveLetters = (
    dbMountPointsData: any,
    source: any,
    target: any,
    selectedMount: any,
    driveInfoData: any,
    dispatch: any
) => {
    const { databaseDataPath, databaseLogPath } = dbMountPointsData || {};
    const dataPathDrive = databaseDataPath?.[0]?.[0];
    const logPathDrive = databaseLogPath?.[0]?.[0];
    if ((dataPathDrive && !dataPathDrive?.match(/[D-Z]/i)) || (logPathDrive && !logPathDrive?.match(/[D-Z]/i))) {
        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.ERROR,
                message: GENERAL.CREATE_SANDBOX_SOURCE_DB_NOT_ISCSI
            })
        );
        return {
            dataDrive: dataPathDrive === '\\' ? databaseDataPath?.[0]?.split('\\')?.[2] : dataPathDrive,
            logDrive: logPathDrive === '\\' ? databaseLogPath?.[0]?.split('\\')?.[2] : logPathDrive
        };
    }
    let defaultDataDriveLetter: any;
    let defaultLogDriveLetter: any;
    if (
        selectedMount === GENERAL.AUTO_ASSIGN_MOUNT_POINT &&
        source?.selectedDatabaseHost?.value === target?.selectedDatabaseHost?.value &&
        source?.selectedDatabaseInstance?.value === target?.selectedDatabaseInstance?.value
    ) {
        defaultDataDriveLetter = dataPathDrive;
        const recommendedDataDrive = driveInfoData?.existingDriveInfo?.find(
            (drive: any) => drive.driveLetter === dataPathDrive
        );
        if (recommendedDataDrive?.hasOwnProperty('isNetappDrive') && !recommendedDataDrive.isNetappDrive) {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message: GENERAL.CREATE_SANDBOX_SOURCE_DB_NOT_ISCSI
                })
            );
        }
        defaultLogDriveLetter = logPathDrive;
        const recommendedLogDrive = driveInfoData?.existingDriveInfo?.find(
            (drive: any) => drive.driveLetter === logPathDrive
        );
        if (recommendedLogDrive?.hasOwnProperty('isNetappDrive') && !recommendedLogDrive.isNetappDrive) {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message: GENERAL.CREATE_SANDBOX_SOURCE_DB_NOT_ISCSI
                })
            );
        }
    } else {
        const recommendedDataDrive = driveInfoData?.existingDriveInfo?.find(
            (drive: any) => drive.driveLetter === dataPathDrive
        );
        const recommendedLogDrive = driveInfoData?.existingDriveInfo?.find(
            (drive: any) => drive.driveLetter === logPathDrive
        );
        if (
            (!recommendedDataDrive?.hasOwnProperty('isClusteredWithSelectedInstance') ||
                recommendedDataDrive?.isClusteredWithSelectedInstance) &&
            recommendedDataDrive?.isNetappDrive
        ) {
            defaultDataDriveLetter = dataPathDrive;
        } else {
            const validDrive = driveInfoData?.existingDriveInfo?.find(
                (drive: any) =>
                    (!drive?.hasOwnProperty('isClusteredWithSelectedInstance') ||
                        drive?.isClusteredWithSelectedInstance) &&
                    drive?.isNetappDrive
            );
            defaultDataDriveLetter = validDrive?.driveLetter;
        }
        if (
            (!recommendedLogDrive?.hasOwnProperty('isClusteredWithSelectedInstance') ||
                recommendedLogDrive?.isClusteredWithSelectedInstance) &&
            recommendedLogDrive?.isNetappDrive
        ) {
            defaultLogDriveLetter = logPathDrive;
        } else {
            const validDrive = driveInfoData?.existingDriveInfo?.find(
                (drive: any) =>
                    (!drive?.hasOwnProperty('isClusteredWithSelectedInstance') ||
                        drive?.isClusteredWithSelectedInstance) &&
                    drive?.isNetappDrive &&
                    drive.driveLetter !== defaultDataDriveLetter
            );
            defaultLogDriveLetter = validDrive?.driveLetter;
        }
    }
    return { dataDrive: defaultDataDriveLetter, logDrive: defaultLogDriveLetter || defaultDataDriveLetter };
};

export const getAggregatedSplitEstimate = (volumes: any) => {
    const aggregatedSplitEstimate = volumes
        ? volumes.reduce((aggEstimate: number, vol: any) => aggEstimate + (vol?.splitEstimate || 0), 0)
        : 0;
    return formatSize(aggregatedSplitEstimate);
};

export const isValidSandboxName = (name: any) => {
    if (name && name.length > 0 && (name.length > 27 || !/^[a-zA-Z0-9/_]+$/.test(name))) {
        return false;
    }
    return true;
};

/**
 * Transform tableData into unique rows based on databaseHostName, databaseHostId,
 * databaseInstanceName, databaseInstanceId, credentialId, regionId
 * and add sandboxCount field
 */
export const createUniqueSandboxTableData = (tableData: any[]) => {
    if (!tableData || !Array.isArray(tableData)) {
        return [];
    }

    const state = store.getState();
    const { inventoryTableData, getDatabaseHosts } = state.inventoryV2;

    const uniqueMap = new Map();
    let id = 1;
    tableData.forEach(item => {
        // Create unique key based on the specified fields
        const uniqueKey = `${item.databaseHostId}_${item.databaseInstanceName}_${item.credentialId}_${item.regionId}`;
        if (uniqueMap.has(uniqueKey)) {
            // If key exists, increment sandbox count
            const existingItem = uniqueMap.get(uniqueKey);
            existingItem.sandboxCount += 1;
        } else {
            const host = inventoryTableData?.[uniqueHostRow(item.databaseHostId, item?.credentialId, item.regionId)];
            const isLoading = getDatabaseHosts?.fullHostDataLoading || getDatabaseHosts?.databaseHostsLoading;
            let loadingStatus = false;
            let status;
            if (!host) {
                loadingStatus = isLoading;
            } else {
                const instance = host?.sqlServerInstances?.find(
                    (instance: any) => instance.databaseInstanceId === item.databaseInstanceId
                );
                if (!instance) {
                    loadingStatus = isLoading;
                } else {
                    status = instance?.status || '';
                    loadingStatus = false;
                }
            }
            // If key doesn't exist, create new entry with sandbox count = 1
            uniqueMap.set(uniqueKey, {
                databaseHostName: item.databaseHostName,
                databaseHostId: item.databaseHostId,
                databaseInstanceName: item.databaseInstanceName,
                databaseInstanceId: item.databaseInstanceId,
                credentialId: item.credentialId,
                regionId: item.regionId,
                sandboxCount: 1,
                type: item.type,
                loadingStatus,
                status,
                id: id++
            });
        }
    });

    return Array.from(uniqueMap.values());
};
