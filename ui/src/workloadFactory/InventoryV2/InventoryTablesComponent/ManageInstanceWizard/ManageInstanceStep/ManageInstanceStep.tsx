import { DsTypography, useWizard } from '@netapp/design-system';
import ManageWizardFooter from '../ManageWizardFooter';
import styles from './ManageInstanceStep.module.scss';
import ActionComponent from './ActionComponent/ActionComponent';
import NoteComponent from './NoteComponent/NoteComponent';
import PermissionListComponent from './PermissionListComponent/PermissionListComponent';
import DetectHeader from '../DetectInstanceStep/DetectHeader/DetectHeader';

export const Content = () => {
    const { state, setState } = useWizard();
    const isAlreadyDetected = false;
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
            <ActionComponent />

            {/* Accordions */}
            <PermissionListComponent />

            {/* Note */}
            <NoteComponent />
        </div>
    );
};

export const Footer = () => {
    return <ManageWizardFooter />;
};
