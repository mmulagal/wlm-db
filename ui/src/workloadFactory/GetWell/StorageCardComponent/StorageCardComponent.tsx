import { DsTypography } from '@netapp/design-system';
import { ReactComponent as NotActive } from '../../../assets/ic_not_active.svg';
import styles from './StorageCardComponent.module.scss';
import GetWellChart from './GetWellChart/GetWellChart';

const StorageCardComponent = () => {
    return (
        <div className={styles.storageCardComponent}>
            {/* Section one */}
            <div className={styles.commonSection}>
                <DsTypography variant="Semibold_14">Storage tier</DsTypography>
                <DsTypography variant="Regular_14">Storage sizing</DsTypography>
            </div>

            {/* Section Two */}
            <div className={styles.commonSection}>
                <div className={styles.statusTopSection}>
                    <div className={styles.svgSection}>
                        <NotActive />
                    </div>
                    <DsTypography variant="Semibold_14">Not optimized</DsTypography>
                </div>
                <DsTypography variant="Regular_14">Status</DsTypography>
            </div>

            {/* Section three */}
            <div className={styles.thirdSection}>
                <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                    25%
                </DsTypography>
                <DsTypography variant="Regular_14">Capacity tier</DsTypography>
            </div>

            {/* Fourth Section */}
            <div className={styles.fourthSection}>
                <GetWellChart startColor="#A815F3" endColor="rgba(168, 21, 243, 0.00)" />
            </div>
        </div>
    );
};

export default StorageCardComponent;
