import { DsTypography,Typography } from '@netapp/design-system';
import { ReactComponent as Warning } from '../../../../../assets/warning.svg';
import { ReactComponent as Bullet } from '../../../../../assets/ic_bullet.svg';
import styles from './ResourceMSSQLPartailContainer.module.scss';
import { GENERAL } from '../../../../../utils/appConstants';

const ResourceMSSQLPartialContainer = () => (
    <div className={styles.partialData}>
        <div className={styles.firstSegment}>
            <Warning />
            <DsTypography variant="Semibold_14">
                Partial data displayed due to a missing module. For complete information, please install the required module.
            </DsTypography>
        </div>
        <DsTypography variant="Regular_14" className={styles.secondSegment}>
            <div className={styles.list}>
                <div className={styles.listItem}>
                    <Bullet />
                    <Typography variant="Regular_13" className={styles.textWidth}>
                        {GENERAL.MISSING_MODULES[0]}
                    </Typography>
                </div>
                <div className={styles.listItem}>
                    <Bullet />
                    <Typography variant="Regular_13" className={styles.textWidth}>
                        {GENERAL.MISSING_MODULES[1]}
                    </Typography>
                </div>
                <div className={styles.listItem}>
                    <Bullet />
                    <Typography variant="Regular_13" className={styles.textWidth}>
                        {GENERAL.MISSING_MODULES[2]}
                    </Typography>
                </div>
            </div>
        </DsTypography>
    </div>
);

export default ResourceMSSQLPartialContainer;
