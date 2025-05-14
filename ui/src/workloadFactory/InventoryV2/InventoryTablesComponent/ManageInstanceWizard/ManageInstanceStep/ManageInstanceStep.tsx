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

    const hasMissingPowershell7 = (manageReadinessData: any) => {
        if (!manageReadinessData) return false;
        const readinessKeys = Object.keys(manageReadinessData);
        for (const key of readinessKeys) {
            const missingModules = manageReadinessData[key]?.missingModules || [];
            if (missingModules.includes(MANAGE_STATES.POWERSHELL7)) {
                return true;
            }
        }
        return false;
    };

    const missingModules = (manageReadinessData: any) => {
        if (!manageReadinessData) return [];

        const readinessKeys = Object.keys(manageReadinessData);
        let filteredModulesSet: Set<string> = new Set();

        readinessKeys.forEach(key => {
            const missingModules = manageReadinessData[key]?.missingModules || [];
            missingModules
                .filter((module: string) => module !== MANAGE_STATES.POWERSHELL7)
                .forEach((module: string) => filteredModulesSet.add(module));
        });

        const filteredModules = Array.from(filteredModulesSet);

        return filteredModules;
    };

    const getPermissionState = (type: string, manageReadinessData: any) => {
        const readinessData = manageReadinessData?.[type];

        if (!readinessData) return GENERAL.NOT_AVAILABLE;

        const missingModules = readinessData?.missingModules || [];
        const hasPowershell7 = missingModules.includes(MANAGE_STATES.POWERSHELL7);
        const otherModules = missingModules.filter((module: string) => module !== MANAGE_STATES.POWERSHELL7);

        const permissions = readinessData?.missingSqlPermissions;

        if (otherModules.length > 0 || permissions.length > 0) {
            return MANAGE_STATES.MISSING_PREREQUISITES;
        }

        if (hasPowershell7) {
            return MANAGE_STATES.MISSING_POWERSHELL;
        }

        return MANAGE_STATES.READY;
    };

    const isAllowManage = (manageReadinessData: any) => {
        let anyListEmpty = false;
        const readinessKeys = Object.keys(manageReadinessData);
        for (const key of readinessKeys) {
            const missingSqlPermissions = manageReadinessData[key]?.missingSqlPermissions || [];
            if (missingSqlPermissions.length == 0) {
                anyListEmpty = true;
            }
        }
        return anyListEmpty;
    };

    const manageChecks = useMemo(() => {
        let manageCheckObj: any = {
            installMissingAWS: false,
            installMissingAWSList: [],
            installMissingPowershell: false,
            assessment: GENERAL.NOT_AVAILABLE,
            remediation: GENERAL.NOT_AVAILABLE,
            dbCreation: GENERAL.NOT_AVAILABLE,
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
                dbCreation: getPermissionState('dbCreation', manageReadinessData),
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

    return (
        <div className={styles['manage-instance-step']}>
            {isAlreadyDetected && (
                <div style={{ marginBottom: '40px' }}>
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
                    Before proceeding, ensure you have completed all required preparations.
                </DsTypography>
                <DsTypography variant="Regular_14">
                    This checker validates that your SQL Server instance meets the necessary prerequisites for
                    management in Workload Factory.
                </DsTypography>
            </div>

            {/* Action component */}
            <ActionComponent manageChecks={manageChecks} />

            {/* Accordions */}
            <PermissionListComponent manageChecks={manageChecks} />

            {/* Note */}
            <NoteComponent />
        </div>
    );
};

export const Footer = () => {
    return <ManageWizardFooter />;
};
