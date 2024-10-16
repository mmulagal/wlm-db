import styles from './DialogContent.module.scss';
import { DsTypography } from '@netapp/design-system';
import { ReactComponent as Bullet } from '../../../../assets/ic_bullet.svg';
import { GENERAL } from '../../../../utils/appConstants';

type DialogType = {
    type: string;
};

const DialogContent = ({ type }: DialogType) => {
    return (
        <div className={styles.dialogContent}>
            {type === 'Storage tier' && (
                <div className={styles['storage-tier-block']}>
                    <div className={styles['first-section']}>
                        <DsTypography variant="Semibold_14">Action summary</DsTypography>
                        <DsTypography variant="Regular_14">
                            Workload Factory intends to optimize your SQL Server's performance by adjusting its storage
                            tiers.
                        </DsTypography>
                    </div>

                    <div className={styles['first-section']}>
                        <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                            What will happen
                        </DsTypography>
                        <div className={styles.content}>
                            <div className={styles.row}>
                                <div>
                                    <Bullet />
                                </div>
                                <DsTypography variant="Regular_14">
                                    Volume tiering policy change: The tiering policy for your SQL Server volumes will be
                                    modified.
                                </DsTypography>
                            </div>

                            <div className={styles.row}>
                                <div>
                                    <Bullet />
                                </div>
                                <DsTypography variant="Regular_14">
                                    Cloud retrieval policy update: The cloud retrieval policy will also be updated.
                                </DsTypography>
                            </div>

                            <div className={styles.row}>
                                <div>
                                    <Bullet />
                                </div>
                                <DsTypography variant="Regular_14">
                                    Data movement: As a result, your data will be moved from the capacity tier to the
                                    performance tier.
                                </DsTypography>
                            </div>
                        </div>
                    </div>

                    <div className={styles['first-section']}>
                        <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                            {GENERAL.NOTE}
                        </DsTypography>
                        <div className={styles.content}>
                            <div className={styles.row}>
                                <div>
                                    <Bullet />
                                </div>
                                <DsTypography variant="Regular_14">{GENERAL.NOTE_PONT_ONE}</DsTypography>
                            </div>

                            <div className={styles.row}>
                                <div>
                                    <Bullet />
                                </div>
                                <DsTypography variant="Regular_14">{GENERAL.NOTE_PONT_TWO}</DsTypography>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {type === 'File system headroom' && (
                <div className={styles['storage-tier-block']}>
                    <div className={styles['first-section']}>
                        <DsTypography variant="Semibold_14">Action summary</DsTypography>
                        <DsTypography variant="Regular_14">
                            Workload Factory is ready to increase the FSx for ONTAP file system capacity to maintain the
                            right headroom.
                        </DsTypography>
                    </div>

                    <div className={styles['first-section']}>
                        <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                            What will happen
                        </DsTypography>
                        <div className={styles.content}>
                            <div className={styles.row}>
                                <div>
                                    <Bullet />
                                </div>
                                <DsTypography variant="Regular_14">
                                    Storage capacity update: The capacity of your FSx for ONTAP file system will be
                                    increased.
                                </DsTypography>
                            </div>
                        </div>
                    </div>

                    <div className={styles['first-section']}>
                        <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                            {GENERAL.NOTE}
                        </DsTypography>
                        <div className={styles.content}>
                            <div className={styles.row}>
                                <div>
                                    <Bullet />
                                </div>
                                <DsTypography variant="Regular_14">{GENERAL.NOTE_PONT_ONE}</DsTypography>
                            </div>

                            <div className={styles.row}>
                                <div>
                                    <Bullet />
                                </div>
                                <DsTypography variant="Regular_14">{GENERAL.NOTE_PONT_TWO}</DsTypography>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DialogContent;
