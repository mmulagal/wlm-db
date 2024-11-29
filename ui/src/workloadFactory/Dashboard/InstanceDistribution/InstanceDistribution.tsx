import { DsTypography } from '@netapp/design-system';
import styles from './InstanceDistribution.module.scss';
import BarComponent from '../BarComponent/BarComponent';

const InstanceDistribution = () => {
    return (
        <div className={styles.instanceDistribution}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Instance distribution
                </DsTypography>

                {/* {loading && <FlashingDotsLoader />} */}
            </div>

            <div className={styles.mainSection}>
                <DsTypography variant="Semibold_14">Managed instances</DsTypography>
                <div className={styles.barContainer}>
                    <BarComponent
                        color="var(--chart-3)"
                        headingText="Microsoft SQL Server"
                        percentage={20}
                        beforeOutOf={100}
                        afterOutOf={120}
                        bottomText="Managed instances:"
                    />
                    <BarComponent
                        color="var(--chart-9)"
                        headingText="PostgreSQL"
                        percentage={20}
                        beforeOutOf={100}
                        afterOutOf={120}
                        bottomText="Managed instances:"
                    />
                </div>
            </div>
        </div>
    );
};

export default InstanceDistribution;
