import { DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import { ReactComponent as SingleAuth } from '../../../../../../assets/SingleAuth.svg';
import styles from './NewAuthenticatedScreen.module.scss';
import { useAppSelector } from '../../../../../../store/storeHooks';
import { DBType } from '../../../../../../utils/consts';

const NewAuthenticatedScreen = () => {
    const { t } = useTranslation();
    const { manageSingleInstanceData, registerHostType } = useAppSelector(state => state.inventoryV2);

    // Determine if this is an Oracle database
    const isOracle = registerHostType === DBType.ORACLE || manageSingleInstanceData?.hostType === DBType.ORACLE;

    return (
        <div className={styles['new-authenticated-screen']}>
            <SingleAuth />
            <div className={styles.textContainer}>
                <DsTypography variant="Semibold_14">
                    {isOracle
                        ? t('databases.register-flow.database-authenticated')
                        : t('databases.register-flow.instance-authenticated')}
                </DsTypography>
                <DsTypography variant="Regular_14">
                    {isOracle ? t('databases.register-flow.database-name') : t('databases.register-flow.instance-name')}{' '}
                    {manageSingleInstanceData?.databaseInstanceName}
                </DsTypography>
            </div>
        </div>
    );
};

export default NewAuthenticatedScreen;
