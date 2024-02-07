import { DsRadioButton, Typography } from '@netapp/design-system';
import styles from './UndetectedSecondDialog.module.scss';
import { useDispatch } from 'react-redux';
import { setRadioValueDetect } from '../../../../store/workloadFactory/inventorySlice';
import { useAppSelector } from '../../../../store/storeHooks';

const UndetectedSecondDialog = () => {
    const detectHostRadio = useAppSelector(state => state.inventory.detectHostRadio);
    const dispatch = useDispatch();
    const handleRadio = (val: string) => {
        dispatch(setRadioValueDetect(val));
    };
    return (
        <div className={styles.secondDialog}>
            <Typography variant="Semibold_14">Detected host information</Typography>

            <div className={styles.contentSection}>
                <div className={styles.leftSide}>
                    <div className={styles.separator} />

                    <div className={styles.entry} style={{ gap: '80px' }}>
                        <Typography variant="Regular_14" style={{ width: '116px' }}>
                            Host name
                        </Typography>
                        <Typography variant="Semibold_14">Host name number 1</Typography>
                    </div>

                    <div className={styles.separator} />

                    <div className={styles.entry} style={{ gap: '80px' }}>
                        <Typography variant="Regular_14" style={{ width: '116px' }}>
                            Host type
                        </Typography>
                        <Typography variant="Semibold_14">FSx for ONTAP</Typography>
                    </div>

                    <div className={styles.separator} />

                    <div className={styles.entry} style={{ gap: '48px' }}>
                        <Typography variant="Regular_14" style={{ width: '148px' }}>
                            Number of databases
                        </Typography>
                        <Typography variant="Semibold_14">10</Typography>
                    </div>

                    <div className={styles.separator} />
                </div>

                <div className={styles.rightSide}>
                    <div className={styles.separator} />

                    <div className={styles.entry} style={{ gap: '80px' }}>
                        <Typography variant="Regular_14" style={{ width: '124px' }}>
                            SQL version
                        </Typography>
                        <Typography variant="Semibold_14">2022</Typography>
                    </div>

                    <div className={styles.separator} />

                    <div className={styles.entry} style={{ gap: '80px' }}>
                        <Typography variant="Regular_14" style={{ width: '124px' }}>
                            Deployment model
                        </Typography>
                        <Typography variant="Semibold_14">Stand alone</Typography>
                    </div>

                    <div className={styles.separator} />

                    <div className={styles.entry} style={{ gap: '80px' }}>
                        <Typography variant="Regular_14" style={{ width: '124px' }}>
                            Edition
                        </Typography>
                        <Typography variant="Semibold_14">Enterprise</Typography>
                    </div>

                    <div className={styles.separator} />
                </div>
            </div>

            {/* Second section after content - EBS */}
            {/* <div className={styles.ebsSection}>
                <Typography variant="Regular_14">Host detected successfully.</Typography>
                <Typography variant="Regular_14">
                    After detection the host was redirected to the unmanaged hosts tab.
                </Typography>
            </div> */}

            {/* Second section after content - FSX */}
            <div className={styles.fsxSection}>
                <Typography variant="Semibold_14">Detected hosts management</Typography>
                <Typography variant="Regular_14" className={styles.subHeading}>
                    Would you like to manage the detected host via workload factory?
                </Typography>

                <div className={styles.radioSection}>
                    <DsRadioButton
                        isSelected={detectHostRadio === 'Yes, Manage host via workload factory'}
                        title="Yes, Manage host via workload factory"
                        id="1"
                        variant="Default"
                        onClick={() => handleRadio('Yes, Manage host via workload factory')}
                    />
                    <DsRadioButton
                        isSelected={detectHostRadio === 'No, moved host to the Unmanaged hosts tab.'}
                        title="No, moved host to the Unmanaged hosts tab."
                        id="2"
                        variant="Default"
                        onClick={() => handleRadio('No, moved host to the Unmanaged hosts tab.')}
                    />
                </div>
            </div>
        </div>
    );
};

export default UndetectedSecondDialog;
