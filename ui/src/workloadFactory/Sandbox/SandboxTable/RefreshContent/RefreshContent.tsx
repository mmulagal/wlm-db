import { DsTypography } from '@netapp/design-system';
import styles from './RefreshContent.module.scss';
import RebaseRollbackContent from '../RebaseRollbackContent/RebaseRollbackContent';
import { GENERAL } from '../../../../utils/appConstants';
import { ReactComponent as Bullet } from '../../../../assets/ic_bullet.svg';

const RefreshContent = ({ databaseName, sandboxName }: any) => {
    return (
        <div className={styles.refreshContent}>
            <DsTypography variant="Regular_14">
                {GENERAL.REFRESH_DIALOG_TITLE[0]} <span style={{ fontWeight: '590' }}>{sandboxName}</span>
                {GENERAL.REFRESH_DIALOG_TITLE[1]} <span style={{ fontWeight: '590' }}>{databaseName}</span>?
            </DsTypography>
            <DsTypography variant="Regular_14" className={styles.secondLine}>
                <div className={styles.list}>
                    <div className={styles.listItem}>
                        <Bullet />
                        <DsTypography variant="Regular_14" className={styles.textWidth}>
                            {GENERAL.REFRESH_DIALOG_FIRST_BULLET}
                        </DsTypography>
                    </div>
                    <div className={styles.listItem}>
                        <Bullet />
                        <DsTypography variant="Regular_14" className={styles.textWidth}>
                            {GENERAL.REFRESH_DIALOG_SECOND_BULLET}
                        </DsTypography>
                    </div>
                </div>
            </DsTypography>

            <div className={styles.rollbackContainer}>
                <RebaseRollbackContent />
            </div>
        </div>
    );
};

export default RefreshContent;
