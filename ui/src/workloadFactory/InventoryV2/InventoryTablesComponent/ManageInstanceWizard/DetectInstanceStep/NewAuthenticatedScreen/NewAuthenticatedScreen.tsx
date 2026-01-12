import { DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import { ReactComponent as SingleAuth } from '../../../../../../assets/SingleAuth.svg';
import styles from './NewAuthenticatedScreen.module.scss';
import { useAppSelector } from '../../../../../../store/storeHooks';

const NewAuthenticatedScreen = () => {
    const { t } = useTranslation();
    const { manageSingleInstanceData } = useAppSelector(state => state.inventoryV2);
    return (
        <div className={styles['new-authenticated-screen']}>
            <SingleAuth />
            <div className={styles.textContainer}>
                <DsTypography variant="Semibold_14">{t('databases.register-flow.instance-authenticated')}</DsTypography>
                <DsTypography variant="Regular_14">
                    {t('databases.register-flow.instance-name')} {manageSingleInstanceData?.databaseInstanceName}
                </DsTypography>
            </div>
        </div>
    );
};

export default NewAuthenticatedScreen;
