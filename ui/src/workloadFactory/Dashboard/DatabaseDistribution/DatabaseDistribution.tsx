import { DsTypography } from '@netapp/design-system';
import styles from './DatabaseDistribution.module.scss';
import BarComponent from '../BarComponent/BarComponent';

const DatabaseDistribution = () => {
    return (
        <div className={styles.databaseDistribution}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Database distribution
                </DsTypography>

                {/* {loading && <FlashingDotsLoader />} */}
            </div>

            <div className={styles.mainSection}>
                <DsTypography variant="Semibold_14">Managed databases</DsTypography>
                <div className={styles.barContainer}>
                    <BarComponent
                        color="var(--chart-3)"
                        headingText="Microsoft SQL Server"
                        percentage={20}
                        beforeOutOf={100}
                        afterOutOf={120}
                        bottomText="Managed databases:"
                    />
                    <BarComponent
                        color="var(--chart-9)"
                        headingText="PostgreSQL"
                        percentage={20}
                        beforeOutOf={100}
                        afterOutOf={120}
                        bottomText="Managed databases:"
                    />
                </div>
            </div>
        </div>
    );
};

export default DatabaseDistribution;
