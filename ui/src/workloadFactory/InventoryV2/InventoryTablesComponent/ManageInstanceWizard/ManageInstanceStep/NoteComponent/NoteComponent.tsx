import { DsTypography } from '@netapp/design-system';
import styles from './NoteComponent.module.scss';

const NoteComponent = () => {
    const textDisabled = false;
    return (
        <div className={styles['note-component']}>
            <DsTypography variant="Semibold_16">Note</DsTypography>

            <div>
                <div className={styles['noteContainer']} style={{ borderBottom: '1px solid var(--border)' }}>
                    <DsTypography className={textDisabled ? styles.disabled : ''} variant="Regular_14">
                        PowerShell 7 will be automatically installed by Workload Factory, and a system reboot at your
                        convenience is required to complete the installation
                    </DsTypography>
                </div>
                <div className={styles['noteContainer']}>
                    <DsTypography className={textDisabled ? styles.disabled : ''} variant="Regular_14">
                        Click continue to authorize Workload Factory to automatically perform these actions on your
                        behalf
                    </DsTypography>
                </div>
            </div>
        </div>
    );
};

export default NoteComponent;
