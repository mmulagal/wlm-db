import { DsTypography } from '@netapp/design-system';
import styles from './RefreshContent.module.scss';
import RebaseRollbackContent from '../RebaseRollbackContent/RebaseRollbackContent';
import { GENERAL } from '../../../../utils/appConstants';
import { ReactComponent as Bullet } from '../../../../assets/ic_bullet.svg';

const RefreshContent = ({ databaseName }: any) => {
    return (
        <div className={styles.refreshContent}>
            <DsTypography variant="Regular_14">
                {GENERAL.REFRESH_DIALOG_TITLE} <span style={{ fontWeight: '590' }}>{databaseName}</span>?
            </DsTypography>
            <DsTypography variant="Regular_14" className={styles.secondLine}>
                <div className={styles.list}>
                    <div className={styles.listItem}>
                        <Bullet />
                        <div className={styles.textWidth}>{GENERAL.REFRESH_DIALOG_FIRST_BULLET}</div>
                    </div>
                    <div className={styles.listItem}>
                        <Bullet />
                        <div className={styles.textWidth}>{GENERAL.REFRESH_DIALOG_SECOND_BULLET}</div>
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
