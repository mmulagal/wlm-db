import { DsTypography, FlashingDotsLoader } from '@netapp/design-system';
import styles from './SandboxDistributionDate.module.scss';
import SandboxChart from './SandboxChart/SandboxChart';
import useResize from '../../../common/hooks/useResize';
import { GENERAL } from '../../../utils/appConstants';

const SandboxDistributionDate = () => {
    const windowSize = useResize();
    const loading = false;
    return (
        <div className={styles.sandboxDate}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    {GENERAL.SANDBOXES_DISTRIBUTION_BY_AGE}
                </DsTypography>

                {loading && <FlashingDotsLoader />}
            </div>

            <div className={styles.mainSection}>
                <SandboxChart />

                <div className={styles.rightSide}>
                    <div className={styles.individualRow}>
                        <div className={styles.square} style={{ backgroundColor: '#68C6B3' }} />
                        <DsTypography variant="Regular_14" className={styles.days}>
                            {GENERAL.ONE_SEVEN_DAYS}
                        </DsTypography>
                        {windowSize.width > 1500 && (
                            <>
                                <div className={styles.separator} />
                                <DsTypography variant="Semibold_14">30 {GENERAL.SANDBOXES}</DsTypography>
                            </>
                        )}
                        {windowSize.width <= 1500 && <DsTypography variant="Regular_14">(30)</DsTypography>}
                    </div>

                    <div className={styles.individualRow}>
                        <div className={styles.square} style={{ backgroundColor: '#0BAFFC' }} />
                        <DsTypography variant="Regular_14" className={styles.days}>
                            {GENERAL.SEVEN_FOURTEEN_DAYS}
                        </DsTypography>
                        {windowSize.width > 1500 && (
                            <>
                                <div className={styles.separator} />
                                <DsTypography variant="Semibold_14">30 {GENERAL.SANDBOXES}</DsTypography>
                            </>
                        )}
                        {windowSize.width <= 1500 && <DsTypography variant="Regular_14">(30)</DsTypography>}
                    </div>

                    <div className={styles.individualRow}>
                        <div className={styles.square} style={{ backgroundColor: '#A815F3' }} />
                        <DsTypography variant="Regular_14" className={styles.days}>
                            {GENERAL.FOURTEEN_THIRTY_DAYS}
                        </DsTypography>

                        {windowSize.width > 1500 && (
                            <>
                                <div className={styles.separator} />
                                <DsTypography variant="Semibold_14">40 {GENERAL.SANDBOXES}</DsTypography>
                            </>
                        )}

                        {windowSize.width <= 1500 && <DsTypography variant="Regular_14">(40)</DsTypography>}
                    </div>

                    <div className={styles.individualRow}>
                        <div className={styles.square} style={{ backgroundColor: '#FDC300' }} />
                        <DsTypography variant="Regular_14" className={styles.days}>
                            {GENERAL.THIRTY_PLUS_DAYS}
                        </DsTypography>
                        {windowSize.width > 1500 && (
                            <>
                                <div className={styles.separator} />
                                <DsTypography variant="Semibold_14">20 {GENERAL.SANDBOXES}</DsTypography>
                            </>
                        )}

                        {windowSize.width <= 1500 && <DsTypography variant="Regular_14">(20)</DsTypography>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SandboxDistributionDate;
