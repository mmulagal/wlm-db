import { DsTypography } from '@tlveng/wlm-ds';
import { ReactComponent as Bullet } from '../../../../assets/ic_bullet.svg';
import styles from './TableTooltip.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { DBType } from '../../../../utils/consts';

const TableTooltip = () => {
    const { selectedTCOHostType } = useAppSelector(state => state.exploreSavings);
    return (
        <div className={styles.infoContainer}>
             <div className={styles.item}>
                {selectedTCOHostType === DBType.MSSQL && <Bullet />}
                <DsTypography variant="Regular_14">The table includes results from uploaded scripts.</DsTypography>
            </div>
            {selectedTCOHostType === DBType.MSSQL &&<div className={styles.item}>
                <Bullet />
                <DsTypography variant="Regular_14">
                    Select up to five hosts from the table below, then proceed to explore potential savings.
                </DsTypography>
            </div>}
            {selectedTCOHostType === DBType.MSSQL &&<div className={styles.item}>
                <Bullet />
                <DsTypography variant="Regular_14">
                    After five selections are made, the remaining checkboxes will be disabled.
                </DsTypography>
            </div>}
        </div>
    );
};

export default TableTooltip;
