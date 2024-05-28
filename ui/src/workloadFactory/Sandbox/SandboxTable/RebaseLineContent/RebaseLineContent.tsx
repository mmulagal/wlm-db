import { DsTypography } from '@netapp/design-system';
import styles from './RebaseLineContent.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { ReactComponent as Bullet } from '../../../../assets/ic_bullet.svg';

const RebaseLineContent = ({ databaseName }: any) => {
    return (
        <div className={styles.rebaseLineContent}>
            <DsTypography variant="Regular_14">
                {GENERAL.REBASELINE_DIALOG_TITLE} <span style={{ fontWeight: '590' }}>{databaseName}</span>?
            </DsTypography>
            <DsTypography variant="Regular_14" className={styles.secondLine}>
                <div className={styles.list}>
                    <div className={styles.listItem}>
                        <Bullet />
                        <div className={styles.textWidth}>{GENERAL.REBASELINE_DIALOG_FIRST_BULLET}</div>
                    </div>
                    <div className={styles.listItem}>
                        <Bullet />
                        <div className={styles.textWidth}>{GENERAL.REBASELINE_DIALOG_SECOND_BULLET}</div>
                    </div>
                </div>
            </DsTypography>
        </div>
    );
};

export default RebaseLineContent;
