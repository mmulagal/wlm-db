import { DsTypography, useWizard } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import ManageWizardFooter from '../ManageWizardFooter';
import styles from './ManageInstanceStep.module.scss';
import ActionComponent from './ActionComponent/ActionComponent';
import NoteComponent from './NoteComponent/NoteComponent';
import PermissionListComponent from './PermissionListComponent/PermissionListComponent';
import DetectHeader from '../DetectInstanceStep/DetectHeader/DetectHeader';
import { useAppSelector } from '../../../../../store/storeHooks';
import { ACTION_TYPE, INVENTORY_STATUS, MANAGE_STATES } from '../../../../../utils/consts';
import { useMemo } from 'react';
import { GENERAL } from '../../../../../utils/appConstants';
import { setManageSingleInstanceChecks } from '../../../../../store/workloadFactory/inventoryV2Slice';
import { useDispatch } from 'react-redux';
import MultiInstanceHeader from '../DetectInstanceStep/DetectHeader/MultiInstanceHeader';
import { getPermissionState, hasMissingPowershell7, mergeReadinessData, missingModules } from '../ManageInstanceUtils';
import { useGetWlmdbPoliciesQuery } from '../../../../../utils/apiService';

export const Content = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { state, setState } = useWizard();
    const { wizardOperationType } = useAppSelector(state => state.inventoryV2);

    const { manageSingleInstanceData, manageSingleInstanceReadiness } = useAppSelector(state => state.inventoryV2);
    const { discoveredHostData } = useAppSelector(state => state.inventoryV2.discoveredHosts);

    const isAlreadyDetected = useMemo(() => {
        if (manageSingleInstanceData && manageSingleInstanceData?.statusColText === INVENTORY_STATUS.UNMANAGED) {
            return true;
        }
        return false;
    }, [manageSingleInstanceData]);

    const { data: policiesList, isFetching: policiesLoading, isError: policiesError } = useGetWlmdbPoliciesQuery({});

    const getManageReadinessData = (
        data: any[],
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

    const manageChecks = useMemo(() => {
        let manageCheckObj: any = {
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

        let manageReadinessData: any = null;
        if (
            !manageSingleInstanceData?.windowsAuthentication &&
            !manageSingleInstanceData?.sqlServerAuthentication &&
            manageSingleInstanceReadiness
        ) {
            manageReadinessData = manageSingleInstanceReadiness;
        } else {
            // If user Deregister and instance or in case of mixed case of manage and unmanage. Get managereadiness data directly from discoveredHostData.
            let ec2InstanceId = manageSingleInstanceData?.ec2InstanceId;
            let credentialId = manageSingleInstanceData?.credentialId;
            let regionId = manageSingleInstanceData?.regionId;
            let instanceName = manageSingleInstanceData?.databaseInstanceName;
            const partnerInstance = manageSingleInstanceData?.hostRow?.ec2Details?.find(
                (instance: any) => instance.id !== ec2InstanceId
            );

            let primaryManageReadinessData: any = null;
            if (manageSingleInstanceData?.manageReadiness) {
                primaryManageReadinessData = manageSingleInstanceData?.manageReadiness;
            } else {
                primaryManageReadinessData = getManageReadinessData(
                    discoveredHostData,
                    ec2InstanceId,
                    credentialId,
                    regionId,
                    instanceName
                );
            }

            // If partner node is present than merge manageReadiness for partner also
            let partnerManageReadinessData: any = null;
            if (partnerInstance?.id) {
                partnerManageReadinessData = getManageReadinessData(
                    discoveredHostData,
                    partnerInstance?.id,
                    credentialId,
                    regionId,
                    instanceName
                );
            }
            if (primaryManageReadinessData && partnerManageReadinessData) {
                // Merge manageReadiness if both node and partner node are present
                manageReadinessData = mergeReadinessData(primaryManageReadinessData, partnerManageReadinessData);
            } else {
                manageReadinessData = primaryManageReadinessData;
            }
        }
        if (manageReadinessData) {
            let missingModulesList = missingModules(manageReadinessData);
            manageCheckObj = {
                installMissingAWS: missingModulesList.length > 0 ? true : false,
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
                manageReadinessData: manageReadinessData
            };
            dispatch(setManageSingleInstanceChecks(manageCheckObj));
            return manageCheckObj;
        }
        return manageCheckObj;
    }, [manageSingleInstanceData, manageSingleInstanceReadiness]);

    const isAllReady = useMemo(() => {
        return (
            manageChecks?.assessment === MANAGE_STATES.READY &&
            manageChecks?.remediation === MANAGE_STATES.READY &&
            manageChecks?.dbcreation === MANAGE_STATES.READY &&
            manageChecks?.sandbox === MANAGE_STATES.READY
        );
    }, [manageChecks]);

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
            {(manageChecks?.installMissingPowershell || manageChecks?.installMissingAWS) && (
                <ActionComponent manageChecks={manageChecks} />
            )}

            {/* Accordions */}
            <PermissionListComponent manageChecks={manageChecks} policiesList={policiesList} />

            {/* Note */}
            {manageChecks?.installMissingPowershell && <NoteComponent />}
        </div>
    );
};

export const Footer = () => {
    return <ManageWizardFooter />;
};
