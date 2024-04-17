import { CreateSandboxPayloadEntities, SandboxListEntities } from '../../utils/types/sandBoxTypes';
import { formatDateWithTime, getTimeDifferenceInDays } from '../../utils/utilityFunctions';

export const generateCreateSandboxPayload = (state: any): CreateSandboxPayloadEntities => {
    const payload = {
        source: {
            host: state?.source?.selectedDatabaseHost?.value,
            instance: '',
            database: state?.source?.selectedDatabase?.value
        },
        target: {
            host: state?.target?.selectedDatabaseHost?.value,
            instance: '',
            database: state?.target?.selectedDatabase?.value
        },
        mountPt: state?.mountPath,
        tag: state?.selectedTag
    };
    return payload;
};

export const formatSandboxListData = (data: SandboxListEntities) => {
    const retData = data.map(item => {
        return {
            id: item?.databaseHostId,
            name: item?.sandboxName,
            hostName: item?.databaseHostName,
            source: item?.sourceDatabaseName,
            sourceHost: item?.sourceDatabaseHostName,
            creationDate: formatDateWithTime(item?.creationTime),
            age: `${getTimeDifferenceInDays(new Date().getTime(), parseInt(item?.creationTime))} days`,
            tag: item?.tag
        };
    });
    return retData;
};

export const getUniqueSourceDatabasesCount = (sandBoxList: SandboxListEntities) => {
    let uniqueSourceDatabases = new Set();
    sandBoxList.map(item => {
        uniqueSourceDatabases.add(item?.sourceDatabaseName);
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
        const age = getTimeDifferenceInDays(new Date().getTime(), parseInt(item?.creationTime));
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
