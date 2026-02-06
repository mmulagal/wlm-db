import { DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import { ReactComponent as Bullet } from '../../../../assets/ic_bullet.svg';
import styles from './TableTooltip.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { DBType } from '../../../../utils/consts';

const TableTooltip = () => {
    const { selectedTCOHostType } = useAppSelector(state => state.exploreSavings);
    const { t } = useTranslation();
    return (
        <div
            className={styles.infoContainer}
            style={{ width: selectedTCOHostType === DBType.MSSQL ? '690px' : 'auto' }}
        >
            <div className={styles.item}>
                {selectedTCOHostType === DBType.MSSQL && <Bullet />}
                <DsTypography variant="Regular_14">{t('databases.explore-savings.table-tooltip-content')}</DsTypography>
            </div>
            {selectedTCOHostType === DBType.MSSQL && (
                <div className={styles.item}>
                    <Bullet />
                    <div className={styles.subItem}>
                        <DsTypography variant="Regular_14">
                            {t('databases.explore-savings.table-tooltip-content-two')}
                        </DsTypography>
                        <DsTypography variant="Semibold_14">
                            {t('databases.explore-savings.table-tooltip-content-three')}
                        </DsTypography>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TableTooltip;
