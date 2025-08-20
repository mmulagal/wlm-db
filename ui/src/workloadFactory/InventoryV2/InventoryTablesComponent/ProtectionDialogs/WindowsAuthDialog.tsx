import { useTranslation } from 'react-i18next';
import { DsTextField, DsTypography } from '@tlveng/wlm-ds';
import { useDispatch } from 'react-redux';
import { ChangeEvent } from 'react';
import styles from './ProtectionDialogs.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { setSCCredentials } from '../../../../store/workloadFactory/snapcenterSlice';

const WindowsAuthDialog = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { username, password } = useAppSelector(state => state.snapCenter.credentials);
    return (
        <div className={styles.windowsAuthDialog}>
            <DsTypography variant="Semibold_14" className={styles.authHeader}>
                {t('databases.inventory.windows-authentication')}
            </DsTypography>

            <div className={styles.textSection}>
                <DsTextField
                    title={t('databases.inventory.windows-user-name')}
                    placeholder={t('databases.inventory.enter-windows-username')}
                    value={username}
                    onChange={(event?: ChangeEvent<HTMLInputElement>) => {
                        dispatch(setSCCredentials({ username: event?.target?.value || '' }));
                    }}
                    className={styles.textFieldStyle}
                />

                <DsTextField
                    title={t('databases.inventory.windows-password')}
                    placeholder={t('databases.inventory.enter-password')}
                    value={password}
                    isPassword
                    onChange={(event?: ChangeEvent<HTMLInputElement>) => {
                        dispatch(setSCCredentials({ password: event?.target?.value || '' }));
                    }}
                    className={styles.textFieldStyle}
                />
            </div>
        </div>
    );
};

export default WindowsAuthDialog;
