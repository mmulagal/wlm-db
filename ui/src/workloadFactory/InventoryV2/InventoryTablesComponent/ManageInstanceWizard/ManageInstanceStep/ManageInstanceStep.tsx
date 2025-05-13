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

export const Content = () => {
    const dispatch = useDispatch();
    const { state, setState } = useWizard();
    const manageSingleInstanceData = useAppSelector(state => state.inventoryV2.manageSingleInstanceData);
    const isAlreadyDetected = useMemo(() => {
        if (manageSingleInstanceData && manageSingleInstanceData?.statusColText === INVENTORY_STATUS.UNMANAGED) {
            return true;
        }
        return false;
    }, [manageSingleInstanceData]);

    const hasMissingPowershell7 = () => {
        if (!manageSingleInstanceData?.manageReadiness) return false;
        const readinessKeys = Object.keys(manageSingleInstanceData.manageReadiness);
        for (const key of readinessKeys) {
            const missingModules = manageSingleInstanceData.manageReadiness[key]?.missingModules || [];
            if (missingModules.includes(MANAGE_STATES.POWERSHELL7)) {
                return true;
            }
        }
        return false;
    };

    const missingModules = () => {
        if (!manageSingleInstanceData?.manageReadiness) return [];

        const readinessKeys = Object.keys(manageSingleInstanceData.manageReadiness);
        let filteredModulesSet: Set<string> = new Set();

        readinessKeys.forEach(key => {
            const missingModules = manageSingleInstanceData.manageReadiness[key]?.missingModules || [];
            missingModules
                .filter((module: string) => module !== MANAGE_STATES.POWERSHELL7)
                .forEach((module: string) => filteredModulesSet.add(module));
        });

        const filteredModules = Array.from(filteredModulesSet);

        return filteredModules;
    };

    const getPermissionState = (type: string) => {
        const readinessData = manageSingleInstanceData?.manageReadiness?.[type];
        const instanceName = manageSingleInstanceData?.databaseInstanceName;

        if (!readinessData) return GENERAL.NOT_AVAILABLE;

        const missingModules = readinessData?.missingModules || [];
        const hasPowershell7 = missingModules.includes(MANAGE_STATES.POWERSHELL7);
        const otherModules = missingModules.filter((module: string) => module !== MANAGE_STATES.POWERSHELL7);

        const permissions =
            readinessData?.missingSqlPermissions?.find((permission: any) => permission?.instanceName === instanceName)
                ?.permissions || [];

        if (hasPowershell7) {
            return MANAGE_STATES.MISSING_POWERSHELL;
        }

        if (otherModules.length > 0 || permissions.length > 0) {
            return MANAGE_STATES.MISSING_PREREQUISITES;
        }

        return MANAGE_STATES.READY;
    };

    const manageChecks = useMemo(() => {
        let manageCheckObj: any = {
            installMissingAWS: false,
            installMissingAWSList: [],
            installMissingPowershell: false,
            assessment: GENERAL.NOT_AVAILABLE,
            remediation: GENERAL.NOT_AVAILABLE,
            dbCreation: GENERAL.NOT_AVAILABLE,
            sandbox: GENERAL.NOT_AVAILABLE
        };
        if (manageSingleInstanceData?.manageReadiness) {
            let missingModulesList = missingModules();
            manageCheckObj = {
                installMissingAWS: missingModulesList.length > 0 ? true : false,
                installMissingAWSList: missingModulesList,
                installMissingPowershell: hasMissingPowershell7(),
                assessment: getPermissionState('assessment'),
                remediation: getPermissionState('remediation'),
                dbCreation: getPermissionState('dbCreation'),
                sandbox: getPermissionState('sandbox')
            };
            dispatch(setManageSingleInstanceChecks(manageCheckObj));
            return manageCheckObj;
        }
        return manageCheckObj;
    }, [manageSingleInstanceData]);

    return (
        <div className={styles['manage-instance-step']}>
            {isAlreadyDetected && (
                <div style={{ marginBottom: '40px' }}>
                    <DetectHeader />
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
