import { TFunction } from 'i18next';
import { DBType, MANAGE_STATES, REGISTER_INSTANCE_STATE } from '../../../../../utils/consts';
import {
    BulkDetectedInstance,
    ExtendedManageStates,
    ManageReadinessData,
    ManageStates
} from '../../../../../utils/types/registerTypes';
import { checkOverallManageState, getPermissionState } from '../ManageInstanceUtils';

// Map engine types to required checks
export const ENGINE_TYPE_CHECKS: Record<string, string[]> = {
    [DBType.ORACLE]: ['installMissingAWS', 'installMissingJQ'],
    [DBType.MSSQL]: ['installMissingAWS', 'installMissingPowershell']
};

export const ENGINE_TYPE_CONTENT_KEYS: Record<string, { content1: string; content2: string }> = {
    [DBType.ORACLE]: {
        content1: 'databases.register-flow.manage-instance-page-content1-oracle',
        content2: 'databases.register-flow.manage-instance-page-content2-oracle'
    },
    [DBType.MSSQL]: {
        content1: 'databases.register-flow.manage-instance-page-content1',
        content2: 'databases.register-flow.manage-instance-page-content2'
    }
};

export const CHECK_LABELS: Record<string, Record<string, string>> = {
    installMissingAWS: {
        [DBType.ORACLE]: 'databases.register-flow.missing-aws-title',
        [DBType.MSSQL]: 'databases.register-flow.missing-modules-title'
    },
    installMissingPowershell: {
        [DBType.MSSQL]: 'databases.register-flow.missing-powershell-title'
    },
    installMissingJQ: {
        [DBType.ORACLE]: 'databases.register-flow.missing-jq-title'
    }
};

export const ENGINE_AUTH_FIELDS: Record<string, string[]> = {
    [DBType.MSSQL]: ['windowsAuthentication', 'sqlServerAuthentication', 'windowsDomainUserAuthentication'],
    [DBType.ORACLE]: ['isDefaultAuthentication', 'oracleServerAuthentication']
};

export const getDiscoveredHostDataByType = (
    engineType: string,
    discoveredHostData: any,
    discoveredOracleHostData: any
) => {
    switch (engineType) {
        case DBType.ORACLE:
            return discoveredOracleHostData;
        case DBType.MSSQL:
        default:
            return discoveredHostData;
    }
};

export const getManageReadinessFromInstance = (instance: any, hostType: string, serverName: string): any => {
    if (!instance) return null;
    if (hostType === DBType.ORACLE) {
        // For Oracle, use databaseInstanceDetails and match on instanceName
        const dbDetail = instance.databaseInstanceDetails?.find((inst: any) => inst.instanceName === serverName);
        return dbDetail?.manageReadiness || null;
    }
    // Default: MSSQL, use sqlServerInstances and match on sqlServerInstance
    const sqlInstance = instance.sqlServerInstances?.find((sqlInst: any) => sqlInst.sqlServerInstance === serverName);
    return sqlInstance?.manageReadiness || null;
};

export const getEffectiveManageReadinessData = (
    instance: BulkDetectedInstance,
    discoveredHostData: any,
    discoveredOracleHostData: any,
    getMergedReadinessData: (
        instanceData: BulkDetectedInstance['data'],
        discoveredHostDataL: BulkDetectedInstance[]
    ) => ManageReadinessData | null
): ManageReadinessData | null => {
    const hostType = instance?.data?.hostType || '';
    const discoveredData = getDiscoveredHostDataByType(hostType, discoveredHostData, discoveredOracleHostData);
    if (hostType === DBType.ORACLE) {
        if (instance?.data?.isDefaultAuthentication === true && instance?.data?.oracleServerAuthentication === false) {
            return instance?.manageReadiness;
        }

        return getMergedReadinessData(instance?.data, discoveredData);
    }

    // Default (MSSQL and others)
    if (
        !instance?.data?.windowsAuthentication &&
        !instance?.data?.sqlServerAuthentication &&
        !instance?.data?.windowsDomainUserAuthentication
    ) {
        return instance?.manageReadiness;
    }
    return getMergedReadinessData(instance?.data, discoveredData);
};

export const getManageCheckObjInitial = (hostType: string) => {
    const manageCheckObj: Partial<ManageStates> = {
        ec2InstanceId: '',
        region: '',
        credentialsId: '',
        databaseInstanceName: '',
        installMissingAWS: false,
        installMissingAWSList: []
    };

    if (hostType === DBType.ORACLE) {
        manageCheckObj.assessment = REGISTER_INSTANCE_STATE.NOT_AVAILABLE;
    } else {
        manageCheckObj.assessment = REGISTER_INSTANCE_STATE.NOT_AVAILABLE;
        manageCheckObj.remediation = REGISTER_INSTANCE_STATE.NOT_AVAILABLE;
        manageCheckObj.dbcreation = REGISTER_INSTANCE_STATE.NOT_AVAILABLE;
        manageCheckObj.sandbox = REGISTER_INSTANCE_STATE.NOT_AVAILABLE;
    }

    return manageCheckObj;
};

export function getManageCheckObjFinal(
    hostType: string,
    manageReadinessData: ManageReadinessData,
    manageSingleInstanceData: any,
    manageCheckObj: Partial<ManageStates>
): Partial<ManageStates> {
    const baseObj = {
        ...manageCheckObj,
        ec2InstanceId: manageSingleInstanceData?.ec2InstanceId || '',
        region: manageSingleInstanceData?.regionId || '',
        credentialsId: manageSingleInstanceData?.credentialId || '',
        databaseInstanceName: manageSingleInstanceData?.databaseInstanceName || '',
        manageReadinessData
    };

    // Set permission fields based on engine type
    if (hostType === DBType.ORACLE) {
        return {
            ...baseObj,
            assessment: getPermissionState('assessment', manageReadinessData)
        };
    }
    return {
        ...baseObj,
        assessment: getPermissionState('assessment', manageReadinessData),
        remediation: getPermissionState('remediation', manageReadinessData),
        dbcreation: getPermissionState('dbcreation', manageReadinessData),
        sandbox: getPermissionState('sandbox', manageReadinessData)
    };
}

export const getManageCheckObjMultiInitial = (hostType: string, t: TFunction) => {
    const manageCheckObj: Partial<ExtendedManageStates> = {
        installMissingAWS: false,
        installMissingAWSList: [],
        ec2InstanceId: '',
        region: '',
        credentialsId: '',
        databaseInstanceName: '',
        overallState: REGISTER_INSTANCE_STATE.NOT_AVAILABLE,
        readyCount: 0
    };

    if (hostType === DBType.ORACLE) {
        manageCheckObj.assessment = REGISTER_INSTANCE_STATE.NOT_AVAILABLE;
        manageCheckObj.perRowState = [
            {
                key: t('databases.register-flow.review-well-architected-issues-and-recommendations'),
                value: REGISTER_INSTANCE_STATE.NOT_AVAILABLE
            }
        ];
    } else {
        manageCheckObj.assessment = REGISTER_INSTANCE_STATE.NOT_AVAILABLE;
        manageCheckObj.remediation = REGISTER_INSTANCE_STATE.NOT_AVAILABLE;
        manageCheckObj.dbcreation = REGISTER_INSTANCE_STATE.NOT_AVAILABLE;
        manageCheckObj.sandbox = REGISTER_INSTANCE_STATE.NOT_AVAILABLE;
        manageCheckObj.perRowState = [
            {
                key: t('databases.register-flow.review-well-architected-issues-and-recommendations'),
                value: REGISTER_INSTANCE_STATE.NOT_AVAILABLE
            },
            {
                key: t('databases.register-flow.fix-well-architected-issues'),
                value: REGISTER_INSTANCE_STATE.NOT_AVAILABLE
            },
            {
                key: t('databases.register-flow.create-database'),
                value: REGISTER_INSTANCE_STATE.NOT_AVAILABLE
            },
            {
                key: t('databases.register-flow.create-database-copies-sandbox'),
                value: REGISTER_INSTANCE_STATE.NOT_AVAILABLE
            }
        ];
    }

    return manageCheckObj;
};

export function getManageCheckObjMultiFinal(
    hostType: string,
    manageReadinessData: ManageReadinessData,
    manageInstanceData: any,
    manageCheckObj: Partial<ManageStates>,
    t: TFunction
): Partial<ExtendedManageStates> {
    if (hostType === DBType.ORACLE) {
        const assessment = getPermissionState('assessment', manageReadinessData);
        const overallState = assessment;
        const readyCount = assessment === MANAGE_STATES.READY ? 1 : 0;
        const perRowState = [
            {
                key: t('databases.register-flow.review-well-architected-issues-and-recommendations'),
                value: assessment
            }
        ];
        return {
            ...manageCheckObj,
            assessment,
            overallState,
            readyCount,
            perRowState,
            ec2InstanceId: manageInstanceData?.ec2InstanceId || '',
            region: manageInstanceData?.regionId || '',
            credentialsId: manageInstanceData?.credentialId || '',
            databaseInstanceName: manageInstanceData?.databaseInstanceName || '',
            manageReadinessData
        };
    }
    const assessment = getPermissionState('assessment', manageReadinessData);
    const remediation = getPermissionState('remediation', manageReadinessData);
    const dbcreation = getPermissionState('dbcreation', manageReadinessData);
    const sandbox = getPermissionState('sandbox', manageReadinessData);
    const overallState = checkOverallManageState(assessment, remediation, dbcreation, sandbox);
    let readyCount = 0;
    const perRowState = [
        {
            key: t('databases.register-flow.review-well-architected-issues-and-recommendations'),
            value: assessment
        },
        {
            key: t('databases.register-flow.fix-well-architected-issues'),
            value: remediation
        },
        {
            key: t('databases.register-flow.create-database'),
            value: dbcreation
        },
        {
            key: t('databases.register-flow.create-database-copies-sandbox'),
            value: sandbox
        }
    ];
    if (assessment === MANAGE_STATES.READY) {
        readyCount += 1;
    }
    if (remediation === MANAGE_STATES.READY) {
        readyCount += 1;
    }
    if (dbcreation === MANAGE_STATES.READY) {
        readyCount += 1;
    }
    if (sandbox === MANAGE_STATES.READY) {
        readyCount += 1;
    }
    return {
        ...manageCheckObj,
        assessment,
        remediation,
        dbcreation,
        sandbox,
        ec2InstanceId: manageInstanceData?.data?.ec2InstanceId,
        region: manageInstanceData?.data?.regionId,
        credentialsId: manageInstanceData?.data?.credentialId,
        databaseInstanceName: manageInstanceData?.data?.databaseInstanceName,
        overallState,
        readyCount,
        perRowState
    };
}
