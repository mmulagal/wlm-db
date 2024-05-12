import { CreateSandboxPayloadEntities, SandboxListEntities } from '../../utils/types/sandBoxTypes';
import { formatDateWithTime, getTimeDifferenceInDays } from '../../utils/utilityFunctions';

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
        mountPt: state?.mountPath,
        tag: state?.selectedTag
    };
    return payload;
};

export const formatSandboxListData = (data: SandboxListEntities) => {
    const retData = data
        .filter(item => !item?.error)
        .map(item => {
            return {
                id: `${item?.databaseHostId}_${item?.databaseInstanceName}_${item?.sandboxName}`,
                name: item?.sandboxName,
                hostName: item?.databaseHostName,
                source: item?.sourceDatabaseName,
                sourceHost: item?.sourceDatabaseHostName,
                updatedAt: formatDateWithTime(item?.updatedAt || ''),
                age: `${getTimeDifferenceInDays(new Date().getTime(), parseInt(item?.createdAt))} days`,
                tag: item?.tag,
                status: 'active'
            };
        });
    return retData;
};

export const getUniqueSourceDatabasesCount = (sandBoxList: SandboxListEntities) => {
    let uniqueSourceDatabases = new Set();
    sandBoxList.map(item => {
        uniqueSourceDatabases.add(
            `${item?.sourceDatabaseHostName}_${item?.sourceDatabaseInstanceName}_${item?.sourceDatabaseName}`
        );
    });
    return uniqueSourceDatabases.size;
};

export const getSandboxDistributionByAge = (sandBoxList: SandboxListEntities) => {
    let distribution = {
        '0-7': 0,
        '8-14': 0,
        '15-30': 0,
        '30+': 0
    };
    sandBoxList.map(item => {
        const age = getTimeDifferenceInDays(new Date().getTime(), parseInt(item?.createdAt));
        if (age < 8) {
            distribution['0-7']++;
        } else if (age < 15) {
            distribution['8-14']++;
        } else if (age < 31) {
            distribution['15-30']++;
        } else {
            distribution['30+']++;
        }
    });
    return distribution;
};

export const getSandboxDistributionByTag = (sandBoxList: SandboxListEntities) => {
    let distribution: any = {
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
