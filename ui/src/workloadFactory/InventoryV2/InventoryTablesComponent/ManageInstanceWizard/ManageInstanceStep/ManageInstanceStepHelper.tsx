import { TFunction } from 'i18next';
import { ACTION_TYPE, DBType, MANAGE_STATES, REGISTER_INSTANCE_STATE } from '../../../../../utils/consts';
import {
    BulkDetectedInstance,
    ExtendedManageStates,
    ManageReadinessData,
    ManageStates
} from '../../../../../utils/types/registerTypes';
import { checkOverallManageState, getPermissionState } from '../ManageInstanceUtils';
import { setAgenticRegisterFlowLoading } from '../../../../../store/workloadFactory/agenticAISlice';
import { GENERAL } from '../../../../../utils/appConstants';
import { setManageSingleInstanceChecks } from '../../../../../store/workloadFactory/inventoryV2Slice';

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
        discoveredHostDataL: BulkDetectedInstance[],
        engineType: string
    ) => ManageReadinessData | null
): ManageReadinessData | null => {
    const hostType = instance?.data?.hostType || '';
    const discoveredData = getDiscoveredHostDataByType(hostType, discoveredHostData, discoveredOracleHostData);
    if (hostType === DBType.ORACLE) {
        if (instance?.data?.isDefaultAuthentication === false && !instance?.data?.oracleServerAuthentication) {
            return instance?.manageReadiness;
        }

        return getMergedReadinessData(instance?.data, discoveredData, hostType);
    }

    // Default (MSSQL and others)
    if (
        !instance?.data?.windowsAuthentication &&
        !instance?.data?.sqlServerAuthentication &&
        !instance?.data?.windowsDomainUserAuthentication
    ) {
        return instance?.manageReadiness;
    }
    return getMergedReadinessData(instance?.data, discoveredData, hostType);
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
        manageCheckObj.errorInvestigation = REGISTER_INSTANCE_STATE.NOT_AVAILABLE;
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
            assessment: getPermissionState('', manageReadinessData, DBType.ORACLE)
        };
    }
    return {
        ...baseObj,
        assessment: getPermissionState('assessment', manageReadinessData, DBType.MSSQL),
        remediation: getPermissionState('remediation', manageReadinessData, DBType.MSSQL),
        dbcreation: getPermissionState('dbcreation', manageReadinessData, DBType.MSSQL),
        sandbox: getPermissionState('sandbox', manageReadinessData, DBType.MSSQL),
        errorInvestigation: getPermissionState('errorInvestigation', manageReadinessData, DBType.MSSQL)
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
            },
            {
                key: t('databases.register-flow.error-investigation'),
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
        const assessment = getPermissionState('', manageReadinessData, DBType.ORACLE);
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
    const assessment = getPermissionState('assessment', manageReadinessData, DBType.MSSQL);
    const remediation = getPermissionState('remediation', manageReadinessData, DBType.MSSQL);
    const dbcreation = getPermissionState('dbcreation', manageReadinessData, DBType.MSSQL);
    const sandbox = getPermissionState('sandbox', manageReadinessData, DBType.MSSQL);
    const errorInvestigation = getPermissionState('errorInvestigation', manageReadinessData, DBType.MSSQL);

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
        },
        {
            key: t('databases.register-flow.error-investigation'),
            value: errorInvestigation
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
    if (errorInvestigation === MANAGE_STATES.READY) {
        readyCount += 1;
    }
    return {
        ...manageCheckObj,
        assessment,
        remediation,
        dbcreation,
        sandbox,
        errorInvestigation,
        ec2InstanceId: manageInstanceData?.data?.ec2InstanceId,
        region: manageInstanceData?.data?.regionId,
        credentialsId: manageInstanceData?.data?.credentialId,
        databaseInstanceName: manageInstanceData?.data?.databaseInstanceName,
        overallState,
        readyCount,
        perRowState
    };
}

export const fetchErrorInvestigationState = async (
    manageCheckObj: Partial<ManageStates>,
    getLogAnalyzerPreReqApi: any,
    dispatch: any,
    manageSingleInstanceData: any
) => {
    if (manageCheckObj && manageSingleInstanceData) {
        try {
            const agenticPreReqChk = await getAgenticPreReqData(
                getLogAnalyzerPreReqApi,
                dispatch,
                manageSingleInstanceData
            );
            const missingSqlPermissionsList: string[] = [];
            if (agenticPreReqChk === MANAGE_STATES.MISSING_PREREQUISITES) {
                missingSqlPermissionsList.push('bedrockPreRequisites');
            }

            // Update the Redux store with the new errorInvestigation state
            dispatch(
                setManageSingleInstanceChecks({
                    ...manageCheckObj,
                    manageReadinessData: {
                        ...manageCheckObj.manageReadinessData,
                        errorInvestigation: {
                            missingModules: [],
                            missingSqlPermissions: missingSqlPermissionsList
                        }
                    },
                    errorInvestigation: agenticPreReqChk
                })
            );
        } catch (error) {
            // Fallback to missing prerequisites state
            dispatch(
                setManageSingleInstanceChecks({
                    ...manageCheckObj,
                    errorInvestigation: GENERAL.NOT_AVAILABLE
                })
            );
        }
    }
};

export const getAgenticPreReqData = async (
    getLogAnalyzerPreReqApi: any,
    dispatch: any,
    manageSingleInstanceData: any
) => {
    let result = GENERAL.NOT_AVAILABLE;
    const { ec2InstanceId, credentialId, regionId, hostRow } = manageSingleInstanceData || {};

    // Find partner instance (if any)
    const partnerInstance = hostRow?.ec2Details?.find((inst: { id?: string }) => inst.id !== ec2InstanceId);

    try {
        dispatch(setAgenticRegisterFlowLoading(true));
        const apiResult: { data?: any; error?: any } = await getLogAnalyzerPreReqApi({
            credentialId,
            regionId,
            type: 'ec2InstanceId',
            typeId: ec2InstanceId + (partnerInstance ? `,${partnerInstance?.id}` : '')
        });

        if (apiResult && !apiResult?.error && apiResult?.data?.items) {
            // Check if all prerequisites are ready for all items
            const allItemsReady = apiResult.data.items?.every((item: any) => {
                const prerequisites = [
                    item.bedrockPreRequisites?.ready,
                    item.instanceProfilePreRequisites?.ready,
                    item.credentialsPreRequisites?.ready,
                    item.networkingPreRequisites?.ready
                ];

                // All 4 prerequisites must be true for this item to be ready
                return prerequisites.every(prereq => prereq === true);
            });

            result = allItemsReady ? MANAGE_STATES.READY : MANAGE_STATES.MISSING_PREREQUISITES;
        } else {
            result = MANAGE_STATES.MISSING_PREREQUISITES;
        }
    } catch (error) {
        result = MANAGE_STATES.MISSING_PREREQUISITES;
    } finally {
        dispatch(setAgenticRegisterFlowLoading(false));
    }

    return result;
};
