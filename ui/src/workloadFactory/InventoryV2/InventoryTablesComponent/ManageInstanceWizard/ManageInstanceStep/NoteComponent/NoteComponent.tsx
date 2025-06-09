import { useTranslation } from 'react-i18next';
import { DsTypography } from '@netapp/design-system';
import styles from './NoteComponent.module.scss';
import { useAppSelector } from '../../../../../../store/storeHooks';

const NoteComponent = () => {
    const { t } = useTranslation();
    const { installMissingPowershell } = useAppSelector(state => state.inventoryV2.manageInstanceInstallAction);

    return (
        <div className={styles['note-component']}>
            <DsTypography variant="Semibold_16">{t('databases.register-flow.note')}</DsTypography>

            <div>
                <div className={styles.noteContainer} style={{ borderBottom: '1px solid var(--border)' }}>
                    <DsTypography className={!installMissingPowershell ? styles.disabled : ''} variant="Regular_14">
                        {t('databases.register-flow.install-note')}
                    </DsTypography>
                </div>
            </div>
        </div>
    );
};

export default NoteComponent;
