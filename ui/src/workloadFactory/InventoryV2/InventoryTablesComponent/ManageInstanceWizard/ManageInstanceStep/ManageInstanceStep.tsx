import { DsTypography, useWizard } from '@netapp/design-system';
import ManageWizardFooter from '../ManageWizardFooter';
import styles from './ManageInstanceStep.module.scss';
import ActionComponent from './ActionComponent/ActionComponent';
import NoteComponent from './NoteComponent/NoteComponent';
import PermissionListComponent from './PermissionListComponent/PermissionListComponent';
import DetectHeader from '../DetectInstanceStep/DetectHeader/DetectHeader';
import { useAppSelector } from '../../../../../store/storeHooks';
import { INVENTORY_STATUS, MANAGE_STATES } from '../../../../../utils/consts';
import { useMemo } from 'react';
import { GENERAL } from '../../../../../utils/appConstants';
import { setManageSingleInstanceChecks } from '../../../../../store/workloadFactory/inventoryV2Slice';
import { useDispatch } from 'react-redux';
import MultiInstanceHeader from '../DetectInstanceStep/DetectHeader/MultiInstanceHeader';
import { getPermissionState, hasMissingPowershell7, isAllowManage, missingModules } from '../ManageInstanceUtils';

export const Content = () => {
    const dispatch = useDispatch();
    const { state, setState } = useWizard();
    const { wizardOperationType } = useAppSelector(state => state.inventoryV2);

    const { manageSingleInstanceData, manageSingleInstanceReadiness } = useAppSelector(state => state.inventoryV2);
    const isAlreadyDetected = useMemo(() => {
        if (manageSingleInstanceData && manageSingleInstanceData?.statusColText === INVENTORY_STATUS.UNMANAGED) {
            return true;
        }
        return false;
    }, [manageSingleInstanceData]);

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
        if (!manageSingleInstanceData?.windowsAuthentication && !manageSingleInstanceData?.sqlServerAuthentication) {
            manageReadinessData = manageSingleInstanceReadiness;
        } else {
            manageReadinessData = manageSingleInstanceData?.manageReadiness;
        }
        if (manageReadinessData) {
            let missingModulesList = missingModules(manageReadinessData);
            manageCheckObj = {
                installMissingAWS: missingModulesList.length > 0 ? true : false,
                installMissingAWSList: missingModulesList,
                installMissingPowershell: hasMissingPowershell7(manageReadinessData),
                allowManage: isAllowManage(manageReadinessData),
                assessment: getPermissionState('assessment', manageReadinessData),
                remediation: getPermissionState('remediation', manageReadinessData),
                dbcreation: getPermissionState('dbcreation', manageReadinessData),
                sandbox: getPermissionState('sandbox', manageReadinessData),
                ec2InstanceId: manageSingleInstanceData?.ec2InstanceId,
                region: manageSingleInstanceData?.regionId,
                credentialsId: manageSingleInstanceData?.credentialId,
                databaseInstanceName: manageSingleInstanceData?.databaseInstanceName
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
            {wizardOperationType !== 'bulk' && isAlreadyDetected && (
                <div className={styles.detectSection}>
                    <DetectHeader />
                </div>
            )}

            {wizardOperationType === 'bulk' && (
                <div style={{ marginBottom: '40px' }}>
                    <MultiInstanceHeader />
                </div>
            )}

            <div className={styles.textSection}>
                <DsTypography variant="Regular_14">
                    This prerequisite check validates that your SQL Server instance meets the required prerequisites and
                    if prepared for management in Workload Factory.
                </DsTypography>
                <DsTypography variant="Regular_14">
                    To complete instance registration, complete all required prerequisites.
                </DsTypography>
            </div>

            {/* Action component */}
            <ActionComponent manageChecks={manageChecks} />

            {/* Accordions */}
            <PermissionListComponent manageChecks={manageChecks} />

            {/* Note */}
            {!isAllReady && <NoteComponent />}
        </div>
    );
};

export const Footer = () => {
    return <ManageWizardFooter />;
};
