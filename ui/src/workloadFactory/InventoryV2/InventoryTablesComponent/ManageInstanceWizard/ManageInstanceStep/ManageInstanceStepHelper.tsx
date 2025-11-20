import { TFunction } from 'i18next';
import { ACTION_TYPE, DBType, MANAGE_STATES, REGISTER_INSTANCE_STATE } from '../../../../../utils/consts';
import {
    BulkDetectedInstance,
    ExtendedManageStates,
    ManageReadinessData,
    ManageStates
} from '../../../../../utils/types/registerTypes';
import { checkOverallManageState, getPermissionState } from '../ManageInstanceUtils';
import {
    setAgenticRegisterFlowLoading,
    setAgenticRegisterFlowData
} from '../../../../../store/workloadFactory/agenticAISlice';
import { GENERAL } from '../../../../../utils/appConstants';
import { setManageSingleInstanceChecks } from '../../../../../store/workloadFactory/inventoryV2Slice';
import store from '../../../../../store/store';

// Map engine types to required checks
export const ENGINE_TYPE_CHECKS: Record<string, string[]> = {
    [DBType.ORACLE]: ['installMissingAWS', 'installMissingJQ', 'installMissingPython'],
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
    },
    installMissingPython: {
        [DBType.ORACLE]: 'databases.register-flow.missing-python-title'
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
        manageCheckObj.remediation = REGISTER_INSTANCE_STATE.NOT_AVAILABLE;
        manageCheckObj.errorInvestigation = REGISTER_INSTANCE_STATE.NOT_AVAILABLE;
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
            assessment: getPermissionState('assessment', manageReadinessData),
            remediation: getPermissionState('remediation', manageReadinessData),
            errorInvestigation: getPermissionState('errorInvestigation', manageReadinessData)
        };
    }
    return {
        ...baseObj,
        assessment: getPermissionState('assessment', manageReadinessData),
        remediation: getPermissionState('remediation', manageReadinessData),
        dbcreation: getPermissionState('dbcreation', manageReadinessData),
        sandbox: getPermissionState('sandbox', manageReadinessData),
        errorInvestigation: getPermissionState('errorInvestigation', manageReadinessData)
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
        manageCheckObj.remediation = REGISTER_INSTANCE_STATE.NOT_AVAILABLE;
        manageCheckObj.errorInvestigation = REGISTER_INSTANCE_STATE.NOT_AVAILABLE;
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
                key: t('databases.register-flow.error-investigation'),
                value: REGISTER_INSTANCE_STATE.NOT_AVAILABLE
            }
        ];
    } else {
        manageCheckObj.assessment = REGISTER_INSTANCE_STATE.NOT_AVAILABLE;
        manageCheckObj.remediation = REGISTER_INSTANCE_STATE.NOT_AVAILABLE;
        manageCheckObj.dbcreation = REGISTER_INSTANCE_STATE.NOT_AVAILABLE;
        manageCheckObj.sandbox = REGISTER_INSTANCE_STATE.NOT_AVAILABLE;
        manageCheckObj.errorInvestigation = REGISTER_INSTANCE_STATE.NOT_AVAILABLE;
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
        const assessment = getPermissionState('assessment', manageReadinessData);
        const remediation = getPermissionState('remediation', manageReadinessData);
        const errorInvestigation = getPermissionState('errorInvestigation', manageReadinessData);

        const states = [assessment, remediation, errorInvestigation];
        const overallState = checkOverallManageState(assessment, remediation, errorInvestigation);
        const readyCount = states.filter(state => state === MANAGE_STATES.READY).length;

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
                key: t('databases.register-flow.error-investigation'),
                value: errorInvestigation
            }
        ];
        return {
            ...manageCheckObj,
            assessment,
            remediation,
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
    const errorInvestigation = getPermissionState('errorInvestigation', manageReadinessData);

    const states = [assessment, remediation, dbcreation, sandbox, errorInvestigation];
    const overallState = checkOverallManageState(assessment, remediation, dbcreation, sandbox, errorInvestigation);
    const readyCount = states.filter(state => state === MANAGE_STATES.READY).length;

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
    manageSingleInstanceData: any,
    hostType?: string
) => {
    if (manageCheckObj && manageSingleInstanceData) {
        try {
            const agenticPreReqChk = await getAgenticPreReqData(
                getLogAnalyzerPreReqApi,
                dispatch,
                manageSingleInstanceData,
                hostType
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
    manageSingleInstanceData: any,
    hostType?: string
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
            typeId: ec2InstanceId + (partnerInstance ? `,${partnerInstance?.id}` : ''),
            dbType: hostType
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

export const fetchErrorInvestigationStateBulk = async (
    selectedMultiDetectInstances: BulkDetectedInstance[],
    getLogAnalyzerPreReqApi: any,
    dispatch: any,
    hostType: string
) => {
    if (!selectedMultiDetectInstances || selectedMultiDetectInstances.length === 0) {
        return;
    }

    // Helper function to create default prerequisite data
    const createDefaultPrereqData = (ec2InstanceId: string, databaseHostId: string = '') => ({
        databaseHostId,
        ec2InstanceId,
        bedrockPreRequisites: { ready: false, message: '' },
        instanceProfilePreRequisites: { ready: false, message: '' },
        credentialsPreRequisites: { ready: false, message: '' },
        networkingPreRequisites: { ready: false, message: '' }
    });

    try {
        dispatch(setAgenticRegisterFlowLoading(true));

        // Get current state data
        const state = store.getState();
        const existingData = state.agenticAI.agenticRegisterFlowChecks.data || {};

        // Collect all unique EC2 instance IDs including partner instances
        const ec2InstanceMap = new Map<string, { credentialId: string; regionId: string; databaseHostId: string }>();
        const keysToFetch = new Set<string>(); // Only keys that need API calls

        selectedMultiDetectInstances.forEach((instance: BulkDetectedInstance) => {
            const { ec2InstanceId, credentialId, regionId, hostRow, databaseHostId } = instance.data || {};

            if (ec2InstanceId && credentialId && regionId) {
                const key = `${credentialId}_${regionId}_${ec2InstanceId}`;
                ec2InstanceMap.set(key, {
                    credentialId,
                    regionId,
                    databaseHostId: databaseHostId || ''
                });

                // Check if key exists in state, if not add to fetch list
                if (!existingData[key]) {
                    keysToFetch.add(key);
                }

                // Add partner instance if it exists
                const partnerInstance = hostRow?.ec2Details?.find((inst: { id?: string }) => inst.id !== ec2InstanceId);
                if (partnerInstance?.id) {
                    const partnerKey = `${credentialId}_${regionId}_${partnerInstance.id}`;
                    ec2InstanceMap.set(partnerKey, {
                        credentialId,
                        regionId,
                        databaseHostId: databaseHostId || ''
                    });

                    // Check if partner key exists in state, if not add to fetch list
                    if (!existingData[partnerKey]) {
                        keysToFetch.add(partnerKey);
                    }
                }
            }
        });

        // If all data already exists, no need to make API calls
        if (keysToFetch.size === 0) {
            dispatch(setAgenticRegisterFlowLoading(false));
            return;
        }

        // Group instances that need fetching by credential and region for batching
        const groupedInstances = new Map<string, string[]>();
        keysToFetch.forEach(key => {
            const [credentialId, regionId, ec2InstanceId] = key.split('_');
            const groupKey = `${credentialId}_${regionId}`;
            if (!groupedInstances.has(groupKey)) {
                groupedInstances.set(groupKey, []);
            }
            groupedInstances.get(groupKey)!.push(ec2InstanceId);
        });

        // Process instances in batches of 5 per credential/region combination
        const batchSize = 5;
        const newResults: Record<string, any> = {};

        for (const [groupKey, instanceIds] of groupedInstances) {
            const [credentialId, regionId] = groupKey.split('_');

            // Process in batches
            for (let i = 0; i < instanceIds.length; i += batchSize) {
                const batch = instanceIds.slice(i, i + batchSize);
                const batchEc2Ids = batch.join(',');

                try {
                    const apiResult: { data?: any; error?: any } = await getLogAnalyzerPreReqApi({
                        credentialId,
                        regionId,
                        type: 'ec2InstanceId',
                        typeId: batchEc2Ids,
                        dbType: hostType
                    });

                    if (apiResult && !apiResult?.error && apiResult?.data?.items) {
                        // Process each item in the batch response
                        apiResult.data.items.forEach((item: any) => {
                            const key = `${credentialId}_${regionId}_${item.ec2InstanceId}`;
                            newResults[key] = item;
                        });
                    } else {
                        // Handle failed batch - set default values for all instances in batch
                        batch.forEach(ec2InstanceId => {
                            const key = `${credentialId}_${regionId}_${ec2InstanceId}`;
                            const instanceInfo = ec2InstanceMap.get(key);
                            newResults[key] = createDefaultPrereqData(ec2InstanceId, instanceInfo?.databaseHostId);
                        });
                    }
                } catch (batchError) {
                    // Set default values for failed batch
                    batch.forEach(ec2InstanceId => {
                        const key = `${credentialId}_${regionId}_${ec2InstanceId}`;
                        const instanceInfo = ec2InstanceMap.get(key);
                        newResults[key] = createDefaultPrereqData(ec2InstanceId, instanceInfo?.databaseHostId);
                    });
                }
            }
        }

        // Update Redux store with new results only (existing data is preserved)
        if (Object.keys(newResults).length > 0) {
            dispatch(
                setAgenticRegisterFlowData({
                    ...existingData,
                    ...newResults
                })
            );
        }
    } catch (error) {
        // Handle overall fetch error
    } finally {
        dispatch(setAgenticRegisterFlowLoading(false));
    }
};

export const isEc2InstanceAgenticReady = (instanceData: any) => {
    const itemEc2InstanceId = instanceData?.data?.ec2InstanceId || '';
    const partnerInstanceId = instanceData?.ec2Details?.find((inst: { id?: string }) => inst.id !== itemEc2InstanceId);
    const state = store.getState();
    const agenticPreReqData = state.agenticAI.agenticRegisterFlowChecks.data;
    const key1 = `${instanceData?.data?.credentialId}_${instanceData?.data?.regionId}_${itemEc2InstanceId}`;
    const key2 = partnerInstanceId
        ? `${instanceData?.data?.credentialId}_${instanceData?.data?.regionId}_${partnerInstanceId.id}`
        : null;

    if (!agenticPreReqData?.[key1]) {
        return '';
    }
    const itemsData = [agenticPreReqData[key1]];
    if (key2 && agenticPreReqData?.[key2]) {
        itemsData.push(agenticPreReqData[key2]);
    }
    const allItemsReady = itemsData?.every((item: any) => {
        const prerequisites = [
            item.bedrockPreRequisites?.ready,
            item.instanceProfilePreRequisites?.ready,
            item.credentialsPreRequisites?.ready,
            item.networkingPreRequisites?.ready
        ];

        // All 4 prerequisites must be true for this item to be ready
        return prerequisites.every(prereq => prereq === true);
    });
    return allItemsReady ? MANAGE_STATES.READY : MANAGE_STATES.MISSING_PREREQUISITES;
};

export const updateItemWithAgenticData = (item: any) => {
    const isAgenticReady = isEc2InstanceAgenticReady(item);

    // Early return if no agentic state
    if (!isAgenticReady) {
        return item;
    }

    // Determine missing permissions based on state
    const missingSqlPermissions =
        isAgenticReady === MANAGE_STATES.MISSING_PREREQUISITES ? ['bedrockPreRequisites'] : [];

    // Create updated item with error investigation data
    return {
        ...item,
        data: {
            ...item.data,
            manageReadiness: {
                ...item?.data?.manageReadiness,
                errorInvestigation: {
                    missingSqlPermissions,
                    missingModules: []
                }
            }
        }
    };
};
