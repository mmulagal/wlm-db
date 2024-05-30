import { DsTypography } from '@netapp/design-system';
import styles from './RebaseSplitContent.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { ReactComponent as Bullet } from '../../../../assets/ic_bullet.svg';

const RebaseSplitContent = ({ databaseName, sandboxName, aggSplitEstimate }: any) => {
    return (
        <div className={styles.rebaseSplitContent}>
            <DsTypography variant="Regular_14">
                {GENERAL.SPLIT_DIALOG_TITLE[0]} <span style={{ fontWeight: '590' }}>{sandboxName}</span>
                {GENERAL.SPLIT_DIALOG_TITLE[1]} <span style={{ fontWeight: '590' }}>{databaseName}</span>?
            </DsTypography>
            <DsTypography variant="Regular_14" className={styles.secondLine}>
                <div className={styles.list}>
                    <div className={styles.listItem}>
                        <Bullet />
                        <div className={styles.textWidth}>
                            {GENERAL.SPLIT_DIALOG_FIRST_BULLET[0]}
                            {aggSplitEstimate}
                            {GENERAL.SPLIT_DIALOG_FIRST_BULLET[1]}
                        </div>
                    </div>
                    <div className={styles.listItem}>
                        <Bullet />
                        <div className={styles.textWidth}>{GENERAL.SPLIT_DIALOG_SECOND_BULLET}</div>
                    </div>
                </div>
            </DsTypography>
        </div>
    );
};

export default RebaseSplitContent;
