import { DsTypography, Spinner } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import ManageWizardFooter from '../ManageWizardFooter';
import styles from './ManageInstanceStep.module.scss';
import ActionComponent from './ActionComponent/ActionComponent';
import NoteComponent from './NoteComponent/NoteComponent';
import PermissionListComponent from './PermissionListComponent/PermissionListComponent';
import DetectHeader from '../DetectInstanceStep/DetectHeader/DetectHeader';
import { useAppSelector } from '../../../../../store/storeHooks';
import { ACTION_TYPE, DBType, MANAGE_STATES } from '../../../../../utils/consts';
import {
    setBulkDetectedInstanceList,
    setManageSingleInstanceChecks
} from '../../../../../store/workloadFactory/inventoryV2Slice';
import MultiInstanceHeader from '../DetectInstanceStep/DetectHeader/MultiInstanceHeader';
import {
    hasMissingJQ,
    hasMissingPowershell7,
    isAlreadyDetectedCheck,
    mergeReadinessData,
    missingModules
} from '../ManageInstanceUtils';
import { useGetLogAnalyzerPreReqMutation, useGetWlmdbPoliciesQuery } from '../../../../../utils/apiService';
import {
    BulkDetectedInstance,
    ExtendedManageStates,
    ManageReadinessData,
    ManageStates
} from '../../../../../utils/types/registerTypes';
import {
    ENGINE_AUTH_FIELDS,
    ENGINE_TYPE_CHECKS,
    ENGINE_TYPE_CONTENT_KEYS,
    fetchErrorInvestigationState,
    getDiscoveredHostDataByType,
    getEffectiveManageReadinessData,
    getManageCheckObjFinal,
    getManageCheckObjInitial,
    getManageCheckObjMultiFinal,
    getManageCheckObjMultiInitial,
    getManageReadinessFromInstance
} from './ManageInstanceStepHelper';

export const Content = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [getLogAnalyzerPreReqApi] = useGetLogAnalyzerPreReqMutation();

    const [manageMultiChecks, setManageMultiChecks] = useState<Partial<ManageStates>>({});
    const { wizardOperationType } = useAppSelector(state => state.inventoryV2);
    const {
        manageSingleInstanceData,
        manageSingleInstanceReadiness,
        selectedMultiDetectInstances,
        manageSingleInstanceChecks: manageChecks
    } = useAppSelector(state => state.inventoryV2);
    const { discoveredHostData } = useAppSelector(state => state.inventoryV2.discoveredHosts);
    const { discoveredOracleHostData } = useAppSelector(state => state.inventoryV2.discoveredOracleHosts);

    const isAlreadyDetected = useMemo(
        () => isAlreadyDetectedCheck(manageSingleInstanceData),
        [manageSingleInstanceData]
    );

    // Determine the host type based on the operation type
    const hostType =
        wizardOperationType === ACTION_TYPE.SINGLE
            ? manageSingleInstanceData?.hostType
            : (selectedMultiDetectInstances?.[0] as BulkDetectedInstance | undefined)?.data?.hostType || DBType.MSSQL;

    const contentKeys = ENGINE_TYPE_CONTENT_KEYS[hostType] || ENGINE_TYPE_CONTENT_KEYS[DBType.MSSQL];

    const getAuthFieldsForEngine = (hostType: string) =>
        ENGINE_AUTH_FIELDS[hostType] || ENGINE_AUTH_FIELDS[DBType.MSSQL];

    const { data: policiesList } = useGetWlmdbPoliciesQuery({});

    const getManageReadinessData = (
        data: BulkDetectedInstance[],
        ec2InstanceId: string,
        credentialId: string,
        regionId: string,
        sqlServerName: string
    ) => {
        // Get managereadiness data directly from discoveredHostData
        if (!Array.isArray(data)) {
            return null; // Return null if data is not an array
        }
        const instance = data.find(
            inst =>
                inst.ec2InstanceId === ec2InstanceId && inst.credentialId === credentialId && inst.regionId === regionId
        );
        if (instance) {
            // Use helper to get manageReadiness for MSSQL or Oracle
            return getManageReadinessFromInstance(instance, instance?.hostType || DBType.MSSQL, sqlServerName);
        }
        return null; // Return null if no match is found
    };

    // Function to merge readiness data for any single instance
    const getMergedReadinessData = (
        instanceData: BulkDetectedInstance['data'],
        discoveredHostDataL: BulkDetectedInstance[],
        engineType: string
    ) => {
        const { ec2InstanceId, credentialId, regionId, databaseInstanceName, hostRow, manageReadiness } =
            instanceData || {};
        // Find partner instance (if any)
        const partnerInstance = hostRow?.ec2Details?.find((inst: { id?: string }) => inst.id !== ec2InstanceId);

        // Get primary readiness data
        const primaryReadiness =
            manageReadiness ||
            getManageReadinessData(
                discoveredHostDataL,
                ec2InstanceId || '',
                credentialId || '',
                regionId || '',
                databaseInstanceName || ''
            );

        // Get partner readiness data (if partner exists)
        let partnerReadiness = null;
        if (partnerInstance?.id) {
            partnerReadiness = getManageReadinessData(
                discoveredHostDataL,
                partnerInstance.id,
                credentialId || '',
                regionId || '',
                databaseInstanceName || ''
            );
        }

        // Merge if both exist, else return primary
        return partnerReadiness && primaryReadiness
            ? mergeReadinessData(primaryReadiness, partnerReadiness, engineType)
            : primaryReadiness;
    };

    // Manage checks for single instance
    useEffect(() => {
        if (wizardOperationType !== ACTION_TYPE.SINGLE) {
            return;
        }

        let manageCheckObj: Partial<ManageStates> = getManageCheckObjInitial(hostType);

        let manageReadinessData: ManageReadinessData | null = null;
        const authFields = getAuthFieldsForEngine(hostType);

        let isNoAuth = false;
        if (hostType === DBType.ORACLE) {
            const isDefault = manageSingleInstanceData?.isDefaultAuthentication;
            const isOracleAuth = manageSingleInstanceData?.oracleServerAuthentication;
            if (isDefault === true) {
                isNoAuth = false;
            } else if (isDefault === false) {
                isNoAuth = !isOracleAuth && !!manageSingleInstanceReadiness;
            }
        } else {
            // For MSSQL and others: no auth if all auth fields are falsy
            isNoAuth =
                !manageSingleInstanceData?.windowsAuthentication &&
                !manageSingleInstanceData?.sqlServerAuthentication &&
                !manageSingleInstanceData?.windowsDomainUserAuthentication &&
                !!manageSingleInstanceReadiness;
        }
        if (isNoAuth) {
            manageReadinessData = manageSingleInstanceReadiness;
        } else {
            const discoveredData = getDiscoveredHostDataByType(hostType, discoveredHostData, discoveredOracleHostData);
            manageReadinessData = getMergedReadinessData(manageSingleInstanceData, discoveredData, hostType);
        }

        if (manageReadinessData) {
            const missingModulesList = missingModules(manageReadinessData);

            // Dynamically build checks based on engine type
            const engineChecks = ENGINE_TYPE_CHECKS[hostType] || [];
            engineChecks.forEach(check => {
                if (check === 'installMissingAWS') {
                    manageCheckObj.installMissingAWS = missingModulesList.length > 0;
                    manageCheckObj.installMissingAWSList = missingModulesList;
                }
                if (check === 'installMissingPowershell') {
                    manageCheckObj.installMissingPowershell = hasMissingPowershell7(manageReadinessData);
                }
                if (check === 'installMissingJQ') {
                    manageCheckObj.installMissingJQ = hasMissingJQ(manageReadinessData);
                }
            });

            manageCheckObj = getManageCheckObjFinal(
                hostType,
                manageReadinessData,
                manageSingleInstanceData,
                manageCheckObj
            );
            dispatch(setManageSingleInstanceChecks(manageCheckObj));

            // Fetch agentic pre-requisites if available
            if (hostType === DBType.MSSQL && wizardOperationType === ACTION_TYPE.SINGLE) {
                fetchErrorInvestigationState(
                    manageCheckObj,
                    getLogAnalyzerPreReqApi,
                    dispatch,
                    manageSingleInstanceData
                );
            }
        }
        dispatch(setManageSingleInstanceChecks(manageCheckObj));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [manageSingleInstanceData, manageSingleInstanceReadiness, hostType]);

    // Function to determine if the action component should be shown
    const shouldShowActionComponent = (manageChecks: any, engineType: string) => {
        const checks = ENGINE_TYPE_CHECKS[engineType] || [];
        return checks.some(check => manageChecks[check]);
    };

    // Manage checks for multiple instances
    const manageCheck = (instance: BulkDetectedInstance) => {
        let manageCheckObj: Partial<ExtendedManageStates> = getManageCheckObjMultiInitial(instance?.data?.hostType, t);

        const manageReadinessData: ManageReadinessData | null = getEffectiveManageReadinessData(
            instance,
            discoveredHostData,
            discoveredOracleHostData,
            getMergedReadinessData
        );

        if (manageReadinessData) {
            const missingModulesList = missingModules(manageReadinessData);
            manageCheckObj.installMissingAWS = missingModulesList.length > 0;
            manageCheckObj.installMissingAWSList = missingModulesList;

            manageCheckObj = getManageCheckObjMultiFinal(
                instance?.data?.hostType,
                manageReadinessData,
                instance.data,
                manageCheckObj,
                t
            );

            const hostType = instance?.data?.hostType || DBType.MSSQL;
            const engineChecks = ENGINE_TYPE_CHECKS[hostType] || [];
            if (engineChecks.includes('installMissingPowershell')) {
                manageCheckObj.installMissingPowershell = hasMissingPowershell7(manageReadinessData);
            }
            if (engineChecks.includes('installMissingJQ')) {
                manageCheckObj.installMissingJQ = hasMissingJQ(manageReadinessData);
            }
            return manageCheckObj;
        }
        return manageCheckObj;
    };

    // Effect to handle bulk instance checks
    useEffect(() => {
        if (wizardOperationType !== ACTION_TYPE.BULK) {
            return;
        }
        const newTableData: BulkDetectedInstance[] = [];
        const bulkHostType =
            (selectedMultiDetectInstances?.[0] as BulkDetectedInstance | undefined)?.data?.hostType || DBType.MSSQL;
        const engineChecks = ENGINE_TYPE_CHECKS[bulkHostType] || [];
        // Track if any instance is missing a required module for each check
        const checksAll: Record<string, boolean> = {};
        engineChecks.forEach(check => {
            checksAll[check] = false;
        });

        selectedMultiDetectInstances?.forEach((item: BulkDetectedInstance) => {
            const manageStates = manageCheck(item);
            // For each check, update checksAll if any instance is missing it
            engineChecks.forEach(check => {
                if ((manageStates as any)?.[check]) {
                    checksAll[check] = true;
                }
            });
            // Build manageStates for this row, only including relevant checks
            const rowManageStates: any = { ...manageStates };
            engineChecks.forEach(check => {
                rowManageStates[check] = (manageStates as any)?.[check] ?? false;
                // If you have associated lists (like installMissingAWSList), add them here as needed
                if (check === 'installMissingAWS') {
                    rowManageStates.installMissingAWS = (manageStates?.installMissingAWSList?.length ?? 0) > 0;
                    rowManageStates.installMissingAWSList = manageStates?.installMissingAWSList ?? [];
                }
                if (check === 'installMissingPowershell') {
                    rowManageStates.installMissingPowershell = manageStates?.installMissingPowershell ?? false;
                }
                if (check === 'installMissingJQ') {
                    rowManageStates.installMissingJQ = manageStates?.installMissingJQ ?? false;
                }
            });

            newTableData.push({
                ...item,
                id: item?.id,
                instanceName: item?.data?.databaseInstanceName,
                authenticationStatus: item?.authorized
                    ? t('databases.general.authenticated')
                    : t('databases.general.unauthenticated'),
                hostName: item?.data?.name,
                readinessStatus: item?.authorized ? manageStates?.overallState : MANAGE_STATES.NOT_READY,
                readyCount: manageStates?.readyCount,
                totalCount: 5,
                perRowState: manageStates?.perRowState || [],
                manageStates: rowManageStates
            });
        });
        const multiChecks: Record<string, boolean> = {};
        engineChecks.forEach(check => {
            multiChecks[check] = checksAll[check];
        });
        setManageMultiChecks(multiChecks);
        dispatch(setBulkDetectedInstanceList(newTableData));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedMultiDetectInstances]);

    return (
        <div className={styles['manage-instance-step']}>
            {wizardOperationType !== ACTION_TYPE.BULK && isAlreadyDetected && (
                <div className={styles.detectSection}>
                    <DetectHeader />
                </div>
            )}

            {wizardOperationType === ACTION_TYPE.BULK && (
                <div style={{ marginBottom: '40px', width: '100%' }}>
                    <MultiInstanceHeader engineType={hostType} />
                </div>
            )}

            <div className={styles.textSection}>
                <DsTypography variant="Regular_14">{t(contentKeys.content1)}</DsTypography>
                <DsTypography variant="Regular_14">{t(contentKeys.content2)}</DsTypography>
            </div>

            {/* Action component */}
            {wizardOperationType === ACTION_TYPE.SINGLE &&
                manageChecks &&
                shouldShowActionComponent(manageChecks, hostType) && (
                    <ActionComponent manageChecks={manageChecks} engineType={hostType} />
                )}
            {wizardOperationType === ACTION_TYPE.BULK &&
                manageMultiChecks &&
                shouldShowActionComponent(manageMultiChecks, hostType) && (
                    <ActionComponent manageChecks={manageMultiChecks} engineType={hostType} />
                )}

            {/* Accordions */}
            {wizardOperationType === ACTION_TYPE.SINGLE && manageChecks && (
                <PermissionListComponent
                    manageChecks={manageChecks}
                    policiesList={policiesList}
                    engineType={hostType}
                />
            )}

            {wizardOperationType === ACTION_TYPE.BULK && manageMultiChecks && (
                <PermissionListComponent
                    manageChecks={manageMultiChecks}
                    policiesList={policiesList}
                    engineType={hostType}
                />
            )}

            {/* Note */}
            {wizardOperationType === ACTION_TYPE.SINGLE && manageChecks?.installMissingPowershell && <NoteComponent />}
            {wizardOperationType === ACTION_TYPE.BULK && manageMultiChecks?.installMissingPowershell && (
                <NoteComponent />
            )}
        </div>
    );
};

export const Footer = () => <ManageWizardFooter />;
