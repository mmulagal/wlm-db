import { DsTypography, useWizard } from '@netapp/design-system';
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
import { ACTION_TYPE, INVENTORY_STATUS, MANAGE_STATES } from '../../../../../utils/consts';
import { GENERAL } from '../../../../../utils/appConstants';
import {
    setBulkDetectedInstanceList,
    setManageSingleInstanceChecks
} from '../../../../../store/workloadFactory/inventoryV2Slice';
import MultiInstanceHeader from '../DetectInstanceStep/DetectHeader/MultiInstanceHeader';
import {
    checkOverallManageState,
    getPermissionState,
    hasMissingPowershell7,
    mergeReadinessData,
    missingModules
} from '../ManageInstanceUtils';
import { useGetWlmdbPoliciesQuery } from '../../../../../utils/apiService';
import {
    BulkDetectedInstance,
    ExtendedManageStates,
    ManageReadinessData,
    ManageStates
} from '../../../../../utils/types/registerTypes';

export const Content = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { state, setState } = useWizard();
    const [manageMultiChecks, setManageMultiChecks] = useState<Partial<ManageStates>>({});
    const { wizardOperationType } = useAppSelector(state => state.inventoryV2);
    const { manageSingleInstanceData, manageSingleInstanceReadiness, selectedMultiDetectInstances } = useAppSelector(
        state => state.inventoryV2
    );
    const { discoveredHostData } = useAppSelector(state => state.inventoryV2.discoveredHosts);

    const isAlreadyDetected = useMemo(() => {
        if (manageSingleInstanceData && manageSingleInstanceData?.statusColText === INVENTORY_STATUS.UNMANAGED) {
            return true;
        }
        return false;
    }, [manageSingleInstanceData]);

    const { data: policiesList, isFetching: policiesLoading, isError: policiesError } = useGetWlmdbPoliciesQuery({});

    const getManageReadinessData = (
        data: BulkDetectedInstance[],
        ec2InstanceId: string,
        credentialId: string,
        regionId: string,
        sqlServerName: string
    ) => {
        // Get managereadiness data directly from discoveredHostData for MSSQL
        if (!Array.isArray(data)) {
            return null; // Return null if data is not an array
        }
        for (const instance of data) {
            if (
                instance.ec2InstanceId === ec2InstanceId &&
                instance.credentialId === credentialId &&
                instance.regionId === regionId
            ) {
                for (const sqlInstance of instance.sqlServerInstances) {
                    if (sqlInstance.sqlServerInstance === sqlServerName) {
                        return sqlInstance.manageReadiness;
                    }
                }
            }
        }
        return null; // Return null if no match is found
    };

    // Function to merge readiness data for any single instance
    const getMergedReadinessData = (
        instanceData: BulkDetectedInstance['data'],
        discoveredHostData: BulkDetectedInstance[],
        getManageReadinessData: Function,
        mergeReadinessData: Function
    ) => {
        const { ec2InstanceId, credentialId, regionId, databaseInstanceName, hostRow, manageReadiness } =
            instanceData || {};

        // Find partner instance (if any)
        const partnerInstance = hostRow?.ec2Details?.find((inst: { id?: string }) => inst.id !== ec2InstanceId);

        // Get primary readiness data
        const primaryReadiness =
            manageReadiness ||
            getManageReadinessData(discoveredHostData, ec2InstanceId, credentialId, regionId, databaseInstanceName);

        // Get partner readiness data (if partner exists)
        let partnerReadiness = null;
        if (partnerInstance?.id) {
            partnerReadiness = getManageReadinessData(
                discoveredHostData,
                partnerInstance.id,
                credentialId,
                regionId,
                databaseInstanceName
            );
        }

        // Merge if both exist, else return primary
        return partnerReadiness && primaryReadiness
            ? mergeReadinessData(primaryReadiness, partnerReadiness)
            : primaryReadiness;
    };

    // Manage checks for single instance
    const manageChecks = useMemo(() => {
        if (wizardOperationType !== ACTION_TYPE.SINGLE) {
            return;
        }
        let manageCheckObj: Partial<ManageStates> = {
            installMissingAWS: false,
            installMissingAWSList: [],
            installMissingPowershell: false,
            assessment: GENERAL.NOT_AVAILABLE,
            remediation: GENERAL.NOT_AVAILABLE,
            dbcreation: GENERAL.NOT_AVAILABLE,
            sandbox: GENERAL.NOT_AVAILABLE,
            ec2InstanceId: '',
            region: '',
            credentialsId: '',
            databaseInstanceName: ''
        };

        let manageReadinessData: ManageReadinessData | null = null;
        if (
            !manageSingleInstanceData?.windowsAuthentication &&
            !manageSingleInstanceData?.sqlServerAuthentication &&
            !manageSingleInstanceData?.windowsDomainUserAuthentication &&
            manageSingleInstanceReadiness
        ) {
            manageReadinessData = manageSingleInstanceReadiness;
        } else {
            manageReadinessData = getMergedReadinessData(
                manageSingleInstanceData,
                discoveredHostData,
                getManageReadinessData,
                mergeReadinessData
            );
        }
        if (manageReadinessData) {
            const missingModulesList = missingModules(manageReadinessData);
            manageCheckObj = {
                installMissingAWS: missingModulesList.length > 0,
                installMissingAWSList: missingModulesList,
                installMissingPowershell: hasMissingPowershell7(manageReadinessData),
                assessment: getPermissionState('assessment', manageReadinessData),
                remediation: getPermissionState('remediation', manageReadinessData),
                dbcreation: getPermissionState('dbcreation', manageReadinessData),
                sandbox: getPermissionState('sandbox', manageReadinessData),
                ec2InstanceId: manageSingleInstanceData?.ec2InstanceId,
                region: manageSingleInstanceData?.regionId,
                credentialsId: manageSingleInstanceData?.credentialId,
                databaseInstanceName: manageSingleInstanceData?.databaseInstanceName,
                manageReadinessData
            };
            dispatch(setManageSingleInstanceChecks(manageCheckObj));
            return manageCheckObj;
        }
        return manageCheckObj;
    }, [manageSingleInstanceData, manageSingleInstanceReadiness]);

    // Manage checks for multiple instances
    const manageCheck = (instance: BulkDetectedInstance) => {
        let manageCheckObj: Partial<ExtendedManageStates> = {
            installMissingAWS: false,
            installMissingAWSList: [],
            installMissingPowershell: false,
            assessment: GENERAL.NOT_AVAILABLE,
            remediation: GENERAL.NOT_AVAILABLE,
            dbcreation: GENERAL.NOT_AVAILABLE,
            sandbox: GENERAL.NOT_AVAILABLE,
            ec2InstanceId: '',
            region: '',
            credentialsId: '',
            databaseInstanceName: '',
            overallState: GENERAL.NOT_AVAILABLE,
            readyCount: 0,
            perRowState: [
                {
                    key: t('databases.register-flow.review-well-architected-issues-and-recommendations'),
                    value: GENERAL.NOT_AVAILABLE
                },
                {
                    key: t('databases.register-flow.fix-well-architected-issues'),
                    value: GENERAL.NOT_AVAILABLE
                },
                {
                    key: t('databases.register-flow.create-database'),
                    value: GENERAL.NOT_AVAILABLE
                },
                {
                    key: t('databases.register-flow.create-database-copies-sandbox'),
                    value: GENERAL.NOT_AVAILABLE
                }
            ]
        };

        let manageReadinessData: ManageReadinessData | null = null;
        // If no authentication methods are set, use manageReadiness
        if (
            !instance?.data?.windowsAuthentication &&
            !instance?.data?.sqlServerAuthentication &&
            !instance?.data?.windowsDomainUserAuthentication
        ) {
            manageReadinessData = instance?.manageReadiness;
        } else {
            manageReadinessData = getMergedReadinessData(
                instance?.data,
                discoveredHostData,
                getManageReadinessData,
                mergeReadinessData
            );
        }
        if (manageReadinessData) {
            const missingModulesList = missingModules(manageReadinessData);
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
            manageCheckObj = {
                installMissingAWS: missingModulesList.length > 0,
                installMissingAWSList: missingModulesList,
                installMissingPowershell: hasMissingPowershell7(manageReadinessData),
                assessment,
                remediation,
                dbcreation,
                sandbox,
                ec2InstanceId: instance?.data?.ec2InstanceId,
                region: instance?.data?.regionId,
                credentialsId: instance?.data?.credentialId,
                databaseInstanceName: instance?.data?.databaseInstanceName,
                overallState,
                readyCount,
                perRowState
            };
            return manageCheckObj;
        }
        return manageCheckObj;
    };

    // Effect to handle single instance checks
    useEffect(() => {
        if (wizardOperationType !== ACTION_TYPE.BULK) {
            return;
        }
        const newTableData: BulkDetectedInstance[] = [];
        let installMissingAWSAll = false;
        let installMissingPowershellAll = false;
        selectedMultiDetectInstances?.forEach((item: BulkDetectedInstance) => {
            const manageStates = manageCheck(item);
            if (manageStates?.installMissingAWS) {
                installMissingAWSAll = true;
            }
            if (manageStates?.installMissingPowershell) {
                installMissingPowershellAll = true;
            }
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
                totalCount: 4,
                perRowState: manageStates?.perRowState || [],
                manageStates: {
                    installMissingAWS: manageStates?.installMissingAWS ?? false,
                    installMissingAWSList: manageStates?.installMissingAWSList ?? [],
                    installMissingPowershell: manageStates?.installMissingPowershell ?? false,
                    assessment: manageStates?.assessment ?? GENERAL.NOT_AVAILABLE,
                    remediation: manageStates?.remediation ?? GENERAL.NOT_AVAILABLE,
                    dbcreation: manageStates?.dbcreation ?? GENERAL.NOT_AVAILABLE,
                    sandbox: manageStates?.sandbox ?? GENERAL.NOT_AVAILABLE,
                    ec2InstanceId: manageStates?.ec2InstanceId ?? '',
                    region: manageStates?.region ?? '',
                    credentialsId: manageStates?.credentialsId ?? '',
                    databaseInstanceName: manageStates?.databaseInstanceName ?? ''
                }
            });
        });
        setManageMultiChecks({
            installMissingAWS: installMissingAWSAll,
            installMissingPowershell: installMissingPowershellAll
        });
        dispatch(setBulkDetectedInstanceList(newTableData));
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
                    <MultiInstanceHeader />
                </div>
            )}

            <div className={styles.textSection}>
                <DsTypography variant="Regular_14">
                    {t('databases.register-flow.manage-instance-page-content1')}
                </DsTypography>
                <DsTypography variant="Regular_14">
                    {t('databases.register-flow.manage-instance-page-content2')}
                </DsTypography>
            </div>

            {/* Action component */}
            {wizardOperationType === ACTION_TYPE.SINGLE &&
                (manageChecks?.installMissingPowershell || manageChecks?.installMissingAWS) && (
                    <ActionComponent manageChecks={manageChecks} />
                )}
            {wizardOperationType === ACTION_TYPE.BULK &&
                (manageMultiChecks?.installMissingPowershell || manageMultiChecks?.installMissingAWS) && (
                    <ActionComponent manageChecks={manageMultiChecks} />
                )}

            {/* Accordions */}
            <PermissionListComponent manageChecks={manageChecks} policiesList={policiesList} />

            {/* Note */}
            {wizardOperationType === ACTION_TYPE.SINGLE && manageChecks?.installMissingPowershell && <NoteComponent />}
            {wizardOperationType === ACTION_TYPE.BULK && manageMultiChecks?.installMissingPowershell && (
                <NoteComponent />
            )}
        </div>
    );
};

export const Footer = () => <ManageWizardFooter />;
