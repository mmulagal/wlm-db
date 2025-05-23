import { DsTypography } from '@netapp/design-system';
import styles from './NoteComponent.module.scss';
import { useAppSelector } from '../../../../../../store/storeHooks';
import { useMemo } from 'react';
import { MANAGE_STATES } from '../../../../../../utils/consts';

const NoteComponent = () => {
    const { installMissingPowershell } = useAppSelector(state => state.inventoryV2.manageInstanceInstallAction);

    return (
        <div className={styles['note-component']}>
            <DsTypography variant="Semibold_16">Note</DsTypography>

            <div>
                <div className={styles['noteContainer']} style={{ borderBottom: '1px solid var(--border)' }}>
                    <DsTypography className={!installMissingPowershell ? styles.disabled : ''} variant="Regular_14">
                        Installing missing PowerShell module 7 requires a system reboot at your convenience. Select
                        "Register" to authorize Workload Factory to automatically install PowerShell 7.
                    </DsTypography>
                </div>
            </div>
        </div>
    );
};

export default NoteComponent;
