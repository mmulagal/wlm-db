import { DsTypography } from '@netapp/design-system';
import styles from './NoteComponent.module.scss';
import { useAppSelector } from '../../../../../../store/storeHooks';
import { useMemo } from 'react';
import { MANAGE_STATES } from '../../../../../../utils/consts';

const NoteComponent = () => {
    const textDisabled = false;
    const { installMissingPowershell } = useAppSelector(state => state.inventoryV2.manageInstanceInstallAction);

    return (
        <div className={styles['note-component']}>
            <DsTypography variant="Semibold_16">Note</DsTypography>

            <div>
                {installMissingPowershell && (
                    <div className={styles['noteContainer']} style={{ borderBottom: '1px solid var(--border)' }}>
                        <DsTypography className={textDisabled ? styles.disabled : ''} variant="Regular_14">
                            PowerShell 7 will be automatically installed by Workload Factory, and a system reboot at
                            your convenience is required to complete the installation
                        </DsTypography>
                    </div>
                )}
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
