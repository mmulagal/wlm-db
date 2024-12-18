import { DsTypography } from '@netapp/design-system';
import styles from './DatabaseDistribution.module.scss';
import BarComponent from '../BarComponent/BarComponent';
import { ReactComponent as Database } from '../../../assets/icon database.svg';
import SeparatorComponent from '../../../common/SeparatorComponent/SeparatorComponent';

const DatabaseDistribution = () => {
    return (
        <div className={styles.databaseDistribution}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Databases distribution
                </DsTypography>

                {/* {loading && <FlashingDotsLoader />} */}
            </div>

            <div className={styles.mainSection}>
                {/* top section */}
                <div className={styles.tile}>
                    <div className={styles.leftSection}>
                        <div>
                            <Database />
                        </div>
                        <div className={styles.valueSection}>
                            <DsTypography
                                variant="Regular_32"
                                style={{ lineHeight: 'unset', display: 'flex', gap: '8px' }}
                            >
                                200
                                {/* <DsFlashingDotsLoader /> */}
                            </DsTypography>
                            {/* <div className={styles.loadingSection}>
                            <DsFlashingDotsLoader />
                        </div> */}
                            <DsTypography variant="Regular_14">Total databases</DsTypography>
                        </div>
                    </div>

                    <SeparatorComponent variant="vertical" height="56px" />

                    <div className={styles.valueSection}>
                        <DsTypography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                            120
                        </DsTypography>
                        {/* <div className={styles.loadingSection}>
                            <DsFlashingDotsLoader />
                        </div> */}

                        <DsTypography variant="Regular_14">Managed databases</DsTypography>
                    </div>
                </div>

                <DsTypography variant="Semibold_14">Managed databases</DsTypography>
                <div className={styles.barContainer}>
                    <BarComponent
                        color="var(--chart-3)"
                        headingText="Microsoft SQL Server"
                        percentage={20}
                        beforeOutOf={100}
                        afterOutOf={120}
                        bottomText="Managed databases:"
                        width="440px"
                    />
                    <BarComponent
                        color="var(--chart-9)"
                        headingText="PostgreSQL"
                        percentage={20}
                        beforeOutOf={100}
                        afterOutOf={120}
                        bottomText="Managed databases:"
                        width="440px"
                    />
                </div>
            </div>
        </div>
    );
};

export default DatabaseDistribution;
